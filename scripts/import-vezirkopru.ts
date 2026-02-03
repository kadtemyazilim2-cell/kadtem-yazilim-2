
import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const filePath = path.join('C:\\Users\\Drone\\Desktop\\benzer iş grupları\\vezirköprü\\vezirköprü.html');
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

        // Exact match preference
        if (cleanName.includes('Vezirköprü') && cleanName.toLowerCase().includes('arazi')) {
            return sites.find(s => s.name === "Samsun Vezirköprü Arazi Toplulaştırma Ve Tarla İçi Geliştirme Hizmetleri İşi");
        }

        // Fallback or other specific logic
        if (cleanName.includes('Doğanlı')) return sites.find(s => s.name.includes('Doğanlı'));
        if (cleanName.includes('Zile 1') || cleanName.includes('1.Kısım') || cleanName.includes('1 Kısım')) return sites.find(s => s.name.includes('Zile Ovası 1'));
        if (cleanName.includes('Zile')) return sites.find(s => s.name.includes('Zile'));

        // General fallback
        return sites.find(s => s.name.includes(cleanName));
    }

    // Helper: Find Vehicle
    function findVehicle(plateOrName: string) {
        if (!plateOrName) return null;
        // Clean up "Plate - Name" format
        let plate = plateOrName.split('-')[0].trim();
        if (plate.length < 2) plate = plateOrName; // If split fail

        // Try exact plate match
        let v = vehicles.find(x => x.plate === plate);
        if (!v) v = vehicles.find(x => x.plate.replace(/\s/g, '') === plate.replace(/\s/g, ''));
        if (!v) v = vehicles.find(x => plateOrName.includes(x.plate)); // Loose match

        return v;
    }

    const rows = $('table tbody tr');
    let counters = { consumption: 0, transferIn: 0, transferOut: 0, purchase: 0, skipped: 0, errors: 0 };

    console.log(`Processing ${rows.length} rows...`);

    // Target the specific site for this report if context implies it is the "Vezirköprü" report
    // But we should use the "arac-alt" column to be sure per row? 
    // Usually the report contains data for ONE site acting as the 'source' or 'context', 
    // but the HTML structure has 'arac-alt' which implies the site for the vehicle?
    // Let's assume the rows belong to the site mentioned in the row.

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const cols = $(row).find('td');
        if (cols.length < 10) continue;

        // Data Extraction
        const dateStr = $(cols[1]).text().trim();
        if (!dateStr.includes('.')) continue; // Skip bad rows

        const [dPart, tPart] = dateStr.split(' ');
        const [day, month, year] = dPart.split('.');

        // Validate date
        if (!day || !month || !year) continue;

        const date = new Date(`${year}-${month}-${day}T${tPart || '00:00'}:00`);

        const aracKolon = $(cols[2]);
        const aracUst = aracKolon.find('.arac-ust').text().trim(); // Vehicle Name / Virman
        const aracAlt = aracKolon.find('.arac-alt').text().replace(/[()]/g, '').trim(); // Site Name

        const litersStr = $(cols[4]).text().trim().replace('.', '').replace(',', '.');
        const liters = parseFloat(litersStr);
        if (isNaN(liters)) continue;

        const absLiters = Math.abs(liters);

        const userCol = $(cols[9]).text().trim();
        const desc = $(cols[10]).text().trim(); // Description

        // Identify Site VALIDATION
        // If aracAlt is empty, fallback to Vezirköprü?
        // Let's try to find based on aracAlt.
        let currentSite = findSite(aracAlt);

        // If not found, and aracAlt is empty or generic, maybe default to the main Vezirköprü site?
        if (!currentSite && (aracAlt === '' || aracAlt.includes('Vezirköprü'))) {
            currentSite = sites.find(s => s.name === "Samsun Vezirköprü Arazi Toplulaştırma Ve Tarla İçi Geliştirme Hizmetleri İşi");
        }

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
            currentSite.fuelTanks.push(tank);
        }

        // --- Logic Branching ---

        // 1. VIRMAN (Transfer)
        if (aracUst.includes('VİRMAN') || desc.toLowerCase().includes('virman')) {
            if (liters > 0) {
                // INCOMING TRANSFER (Gelen)
                // Source? "Virman Gelen ← Some Site"
                const parts = desc.split('←');
                const sourceName = parts.length > 1 ? parts[1].trim() : 'UNKNOWN';
                const sourceSite = findSite(sourceName);

                const exists = await prisma.fuelTransfer.findFirst({
                    where: { date, amount: absLiters, toId: tank.id }
                });

                if (!exists) {
                    await prisma.fuelTransfer.create({
                        data: {
                            date,
                            amount: absLiters,
                            description: desc,
                            fromType: sourceSite ? 'TANK' : 'EXTERNAL',
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

                    // Only decrement source if it exists internally and we are sure
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
                const parts = desc.split('→');
                const targetName = parts.length > 1 ? parts[1].trim() : 'UNKNOWN';
                const targetSite = findSite(targetName);

                const exists = await prisma.fuelTransfer.findFirst({
                    where: { date, amount: absLiters, fromId: tank.id }
                });

                if (!exists) {
                    await prisma.fuelTransfer.create({
                        data: {
                            date,
                            amount: absLiters,
                            description: desc,
                            fromType: 'TANK',
                            toType: targetSite ? 'TANK' : 'EXTERNAL',
                            fromId: tank.id,
                            toId: targetSite ? (targetSite.fuelTanks[0]?.id || 'UNKNOWN_TANK') : 'EXTERNAL_TARGET',
                            fromTankId: tank.id,
                            toTankId: targetSite ? (targetSite.fuelTanks[0]?.id) : null,
                            createdByUserId: adminUser.id
                        }
                    });
                    await prisma.fuelTank.update({ where: { id: tank.id }, data: { currentLevel: { decrement: absLiters } } });

                    if (targetSite && targetSite.fuelTanks[0]) {
                        await prisma.fuelTank.update({ where: { id: targetSite.fuelTanks[0].id }, data: { currentLevel: { increment: absLiters } } });
                    }

                    console.log(`[-] Transfer Out: ${absLiters}L to ${targetName}`);
                    counters.transferOut++;
                }
            }
        }
        // 2. CONSUMPTION (Vehicle Fueling)
        else if (liters < 0) {
            const vehicle = findVehicle(aracUst);
            if (!vehicle) {
                console.warn(`[WARN] Vehicle not found: ${aracUst}`);
                counters.errors++;
                continue;
            }

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
                        tankId: tank.id,
                        mileage: parseFloat($(cols[3]).text().replace(/\./g, '').replace(',', '.')) || 0,
                        cost: 0,
                        fullTank: false,
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
        // 3. PURCHASE (Non-Virman, Positive Liters)
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
}

main().finally(() => prisma.$disconnect());
