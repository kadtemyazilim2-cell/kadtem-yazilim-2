
import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const filePath = path.join('C:\\Users\\Drone\\Desktop\\benzer iş grupları\\doğanlı\\doğanlı.html');
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return;
    }

    console.log(`Reading ${filePath}...`);
    const html = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(html);

    // 1. Fetch Context
    const sites = await prisma.site.findMany({ include: { fuelTanks: true } });
    const vehicles = await prisma.vehicle.findMany();
    const adminUser = await prisma.user.findFirst({ where: { username: 'ahmetcan' } }) || await prisma.user.findFirst();

    if (!adminUser) throw new Error("No user found");

    // Helper: Find Site
    function findSite(name: string) {
        if (!name) return null;
        const cleanName = name.replace(/[()]/g, '').trim();

        if (cleanName.includes('Doğanlı')) return sites.find(s => s.name.includes('Doğanlı'));
        if (cleanName.includes('Zile 1') || cleanName.includes('1.Kısım') || cleanName.includes('1 Kısım')) return sites.find(s => s.name.includes('Zile Ovası 1'));
        if (cleanName.includes('Zile')) return sites.find(s => s.name.includes('Zile'));
        if (cleanName.includes('Vezirköprü')) return sites.find(s => s.name.includes('Vezirköprü'));
        if (cleanName.includes('Nazilli')) return sites.find(s => s.name.includes('Nazilli'));

        return sites.find(s => s.name.includes(cleanName)); // Fallback
    }

    // Helper: Find Vehicle
    function findVehicle(plateOrName: string) {
        if (!plateOrName) return null;
        // Clean up "Plate - Name" format
        let plate = plateOrName.split('-')[0].trim();
        if (plate.length < 2) plate = plateOrName; // If split fail

        // Specific map
        if (plateOrName.includes('Massey Ferguson')) return vehicles.find(v => v.plate.includes('60 HF 131'));

        // Try exact plate match
        let v = vehicles.find(x => x.plate === plate);
        if (!v) v = vehicles.find(x => x.plate.replace(/\s/g, '') === plate.replace(/\s/g, ''));
        if (!v) v = vehicles.find(x => plateOrName.includes(x.plate)); // Loose match

        return v;
    }

    const rows = $('table tbody tr');
    let counters = { consumption: 0, transferIn: 0, transferOut: 0, purchase: 0, skipped: 0, errors: 0 };

    console.log(`Processing ${rows.length} rows...`);

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const cols = $(row).find('td');
        if (cols.length < 10) continue;

        // Data Extraction
        const dateStr = $(cols[1]).text().trim(); // 23.12.2025 18:01
        const [dPart, tPart] = dateStr.split(' ');
        const [day, month, year] = dPart.split('.');
        const date = new Date(`${year}-${month}-${day}T${tPart}:00`);

        const aracKolon = $(cols[2]);
        const aracUst = aracKolon.find('.arac-ust').text().trim(); // Vehicle Name / Virman
        const aracAlt = aracKolon.find('.arac-alt').text().replace(/[()]/g, '').trim(); // Site Name

        const litersStr = $(cols[4]).text().trim().replace('.', '').replace(',', '.');
        const liters = parseFloat(litersStr);
        const absLiters = Math.abs(liters);

        const userCol = $(cols[9]).text().trim();
        const desc = $(cols[10]).text().trim(); // Description

        // Identify Site (This Report Context is Doğanlı, but let's confirm per row)
        const currentSite = findSite(aracAlt);
        if (!currentSite) {
            console.warn(`[WARN] Site not found for row ${i}: ${aracAlt}`);
            counters.errors++;
            continue;
        }

        // Ensure Tank
        let tank = currentSite.fuelTanks[0];
        if (!tank) {
            tank = await prisma.fuelTank.create({
                data: { siteId: currentSite.id, name: 'Ana Tank', capacity: 10000, currentLevel: 0 }
            });
            // Update local cache
            currentSite.fuelTanks.push(tank);
        }

        // --- Logic Branching ---

        // 1. VIRMAN (Transfer)
        if (aracUst.includes('VİRMAN') || desc.toLowerCase().includes('virman')) {
            // Is it In or Out?
            // "Virman Gelen" -> In (Positive Liters in report usually, but check value)

            // Note: In HTML report, "Gelen" is usually POSITIVE. "Giden" is NEGATIVE in the "Miktar" column?
            // Or "Miktar" column is always positive and "Fark" is negative?
            // Let's check Row 10: Liters = "1.530,00" (Positive). Desc: "Virman Gelen"

            if (liters > 0) {
                // INCOMING TRANSFER (Gelen)
                // Source? "Virman Gelen ← Tokat Zile 1.Kısım"
                const parts = desc.split('←');
                const sourceName = parts.length > 1 ? parts[1].trim() : 'UNKNOWN';

                const sourceSite = findSite(sourceName);

                if (!sourceSite) {
                    console.warn(`[WARN] Source site not found: ${sourceName}`);
                    // If source not found, maybe treat as purchase or log error? User said "Doğanlı", maybe source is irrelevant?
                    // No, user wants correct data.
                    // If source not found, we can't create TANK->TANK transfer perfectly.
                    // But we should try hard.
                }

                const exists = await prisma.fuelTransfer.findFirst({
                    where: { date, amount: absLiters, toId: tank.id }
                });

                if (!exists) {
                    await prisma.fuelTransfer.create({
                        data: {
                            date,
                            amount: absLiters,
                            description: desc,
                            fromType: sourceSite ? 'TANK' : 'EXTERNAL', // If source known, TANK. Else External import?
                            toType: 'TANK',
                            fromId: sourceSite ? (sourceSite.fuelTanks[0]?.id || 'UNKNOWN_TANK') : 'EXTERNAL_SOURCE',
                            toId: tank.id,
                            toTankId: tank.id,
                            fromTankId: sourceSite ? (sourceSite.fuelTanks[0]?.id) : null,
                            createdByUserId: adminUser.id
                        }
                    });

                    // Update Tank Level
                    await prisma.fuelTank.update({ where: { id: tank.id }, data: { currentLevel: { increment: absLiters } } });

                    // If Source Site exists, we should technically DECREMENT their tank? 
                    // But if that site report is separate, we might double count if we import that file too?
                    // Typically "Virman Gelen" here implies "Virman Giden" there.
                    // If we only process "Gelen" records from all files, we are safe.
                    // If we process "Giden" records, we might double count.
                    // Strategy: Only process LOCAL effects. 
                    // BUT `FuelTransfer` connects two tanks. Creating it affects BOTH if we aren't careful.
                    // Prisma `FuelTransfer` is just a record. 
                    // The `FuelTank` update is manual.
                    // So I 'increment' THIS tank. I should 'decrement' SOURCE tank?
                    // Yes, to keep consistency.
                    if (sourceSite && sourceSite.fuelTanks[0]) {
                        await prisma.fuelTank.update({ where: { id: sourceSite.fuelTanks[0].id }, data: { currentLevel: { decrement: absLiters } } });
                    }

                    console.log(`[+] Transfer In: ${absLiters}L from ${sourceName}`);
                    counters.transferIn++;
                } else {
                    counters.skipped++;
                }

            } else {
                // OUTGOING TRANSFER (Giden) - Negative Liters
                // Logic similar but reversed.
                console.log(`[INFO] Transfer Out (Not Implemented yet): ${absLiters}L`);
                counters.transferOut++;
            }
        }
        // 2. CONSUMPTION (Vehicle Fueling)
        else if (liters < 0) { // Consumption is negative in "Fark" or just negative Liters?
            // In reports, sometimes consumption is shown as consumption.
            // Line 543: "-64,00" in "Fark"? 
            // Line 539: "Miktar (LT)" -> "748,00" ?? Wait.
            // Line 539: Row 2. Vehicle "35 GA 8108". KM 242.528. Liters "748,00"?
            // Why "Fark" is -64?
            // Usually Consumption is Volume Out.
            // Let's check "Miktar". Row 1 (Line 518): Miktar is empty `&nbsp;`. Fark `-63`.
            // Row 2 (Line 539): Miktar `748,00`. Fark `-64`.
            // Row 3 (Line 560): Miktar empty. Fark `-20`.

            // Confusion: Is `Miktar` the fuel TAKEN? Or fuel LEFT?
            // If `Miktar` is 748, it's huge. 
            // Maybe `Miktar` is Purchase?
            // Row 2: `35 GA 8108` - Mercedes Sprinter. 748 Liters? That's a huge tank for a Sprinter (usually 70-100L).
            // Maybe it means it TRANSPORTED 748L? No, it says "Araç".
            // Let's look at Row 10 (Virman): Miktar `1.530,00`.
            // Let's look at Row 1 (Tractor): Miktar empty.

            // User says Process "Verilen Yakıt" (Given Fuel).
            // Usually "Verilen" is what leaves the tank.
            // If Miktar is empty, maybe logic is different?
            // Look at `mazot.html` logic again.
            // `const litersStr = $(cols[4]).text()`. Col 4 is Miktar.
            // `const diffStr = $(cols[5]).text()`. Col 5 is Fark.

            // In `import-fuel-html.ts`:
            // `const litersStr = $(cols[4])...`
            // `if (aracUst.includes('VİRMAN')...)`
            // `else { // Vehicle Log`
            // `   await prisma.fuelLog.create({ ... liters: Math.abs(rawLiters) ... })`

            // If `rawLiters` is 0 (empty), then we import 0L log?
            // Check Row 1 again: Miktar `&nbsp;`.
            // Does `mazot.html` logic handle empty Miktar?
            // `parseFloat` of empty string is NaN -> `|| 0`.
            // So it would import 0L.
            // But Fark is `-63`. Maybe 63 is the consumption?
            // "Fark" might be "Difference in Tank"? Or "Difference in Vehicle Tank"?
            // Usually fuel reports show "Filled Amount".
            // If Miktar is empty, maybe it wasn't recorded?

            // BUT Row 2 has 748L. Sprinter taking 748L is impossible unless it's a tanker?
            // "35 GA 8108 - Mercedes Sprinter Kamyonet". 
            // Maybe it's CUMULATIVE?

            // Let's look at `mazot1.html` Row 42 (Line 1361):
            // Miktar `-223,00`? No that's Col 5 (Fark). Col 4 (Miktar) is `20.564`.
            // Wait, `mazot1.html`:
            // `</td><td align="right">20.564</td><td align="right">-223,00</td><td align="right">18,00</td>`
            // Col 3: KM (20.564)
            // Col 4: Miktar (-223,00) ??
            // Col 5: Fark (18,00) ??

            // Let's check headers in `doğanlı.html` (Line 505):
            // `<th scope="col">Km/Saat</th><th scope="col">Miktar (LT)</th><th scope="col">FARK</th>`
            // So:
            // Col 3: KM
            // Col 4: Miktar
            // Col 5: Fark

            // Row 1 (Line 518):
            // Col 3: `8.202` (KM)
            // Col 4: `-63,00` (Miktar) -> This makes sense! Negative means OUT.
            // Col 5: `&nbsp;` (Fark)

            // Row 2 (Line 539):
            // Col 3: `242.528`
            // Col 4: `-64,00` (Miktar) -> Consumption 64L.
            // Col 5: `748,00` (Fark) -> Maybe previous km diff?

            // Ah! My reading of `doğanlı.html` source text was slightly misaligned in my head vs the snippet.
            // Line 518: `</td><td align="right">8.202</td><td align="right">-63,00</td><td align="right">&nbsp;</td>`
            // Yes. Col 4 is `-63,00`.

            // So logic:
            // Liter < 0 => Consumption (Out).
            // Liter > 0 => Purchase/Transfer In.

            // Back to Row 10 (Virman):
            // Line 707: `</td><td align="right">0</td><td align="right">1.530,00</td><td align="right">&nbsp;</td>`
            // KM = 0.
            // Miktar = 1.530,00 (Positive).

            // So logic holds:
            // Positive = In (Transfer/Purchase).
            // Negative = Out (Consumption/Transfer).

            // CONSUMPTION LOGIC:
            const vehicle = findVehicle(aracUst);
            if (!vehicle) {
                console.warn(`[WARN] Vehicle not found: ${aracUst}`);
                counters.errors++;
                continue;
            }

            // Duplicate Check
            const exists = await prisma.fuelLog.findFirst({
                where: { date, liters: absLiters, vehicleId: vehicle.id }
            });

            if (!exists) {
                await prisma.fuelLog.create({
                    data: {
                        date,
                        liters: absLiters,
                        vehicleId: vehicle.id,
                        siteId: currentSite.id,
                        tankId: tank.id, // Explicitly link tank
                        mileage: parseKm($(cols[3]).text()),
                        cost: 0, // No cost in HTML
                        fullTank: false, // Assumption
                        description: desc + (userCol ? ` (Driver: ${userCol})` : ''),
                        filledByUserId: adminUser.id
                    }
                });
                await prisma.fuelTank.update({ where: { id: tank.id }, data: { currentLevel: { decrement: absLiters } } });

                console.log(`[+] Consumed: ${absLiters}L by ${vehicle.plate}`);
                counters.consumption++;
            } else {
                counters.skipped++;
            }
        }
        // 3. PURCHASE (Non-Virman, Positive Liters usually means Purchase or Return)
        else if (liters > 0) {
            const exists = await prisma.fuelTransfer.findFirst({
                where: { date, amount: absLiters, toId: tank.id, fromType: 'EXTERNAL' }
            });

            if (!exists) {
                await prisma.fuelTransfer.create({
                    data: {
                        date,
                        amount: absLiters,
                        description: desc + ` (${aracUst})`,
                        fromType: 'EXTERNAL',
                        fromId: 'SUPPLIER',
                        toType: 'TANK',
                        toId: tank.id,
                        toTankId: tank.id,
                        createdByUserId: adminUser.id
                    }
                });
                await prisma.fuelTank.update({ where: { id: tank.id }, data: { currentLevel: { increment: absLiters } } });

                console.log(`[+] Purchase: ${absLiters}L`);
                counters.purchase++;
            } else {
                counters.skipped++;
            }
        }
    }

    console.log('--- Summary ---');
    console.log(JSON.stringify(counters, null, 2));

    function parseKm(str: string) {
        return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
    }
}

main().finally(() => prisma.$disconnect());
