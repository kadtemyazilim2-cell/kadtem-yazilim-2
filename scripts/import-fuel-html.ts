
import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const filePath = path.join('C:\\Users\\Drone\\Desktop\\benzer iş grupları\\Yeni klasör\\mazot1.html');

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return;
    }

    console.log('Reading HTML file...');
    const html = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(html);

    // 1. Fetch Metadata (Sites, Vehicles, User)
    const adminUser = await prisma.user.findFirst({
        where: { username: 'ahmetcan' } // Try to find the user from the HTML
    }) || await prisma.user.findFirst(); // Fallback to any user

    if (!adminUser) {
        console.error('No user found in database to assign records to.');
        return;
    }
    console.log(`Using user: ${adminUser.username} (${adminUser.id})`);

    const sites = await prisma.site.findMany({ include: { fuelTanks: true } });
    const vehicles = await prisma.vehicle.findMany();

    // Helper to find Site ID by Name
    function findSite(name: string) {
        if (!name) return null;
        const cleanName = name.replace(/[()]/g, '').trim();
        // Try exact match
        let site = sites.find(s => s.name === cleanName);
        // Try contains
        if (!site) site = sites.find(s => s.name.includes(cleanName) || cleanName.includes(s.name));
        // Try specific mappings based on HTML values
        if (!site) {
            if (cleanName.includes('Nazilli')) site = sites.find(s => s.name.includes('Nazilli'));
            if (cleanName.includes('Vezirköprü')) site = sites.find(s => s.name.includes('Vezirköprü'));
            if (cleanName.includes('Zile')) site = sites.find(s => s.name.includes('Zile'));
            if (cleanName.includes('Doğanlı')) site = sites.find(s => s.name.includes('Doğanlı'));
        }
        return site;
    }

    // Helper to find Vehicle ID by Plate or Name
    function findVehicle(plateOrName: string) {
        if (!plateOrName) return null;

        // Explicit User Mappings
        if (plateOrName.includes('2025 T')) {
            // User said: 2025 T -> 34-00-25-5586
            // Try searching for this plate
            const target = vehicles.find(v => v.plate === '34-00-25-5586' || v.plate.includes('34-00-25-5586'));
            if (target) return target;
        }

        if (plateOrName.toLowerCase().includes('fiat hitachi')) {
            // User Mapping: Fiat Hitachi 200.3 -> DB Vehicle
            const target = vehicles.find(v => v.brand.toLowerCase().includes('fiat') || v.model.toLowerCase().includes('hitachi'));
            if (target) return target;
        }

        const parts = plateOrName.split(' - ');
        let plate = parts[0]?.trim();
        let name = parts[1]?.trim();

        // If plate is empty or just dashes, try to match by name
        if (!plate || plate.length < 2) {
            // Search by name (loose match)
            if (name) {
                return vehicles.find(v =>
                    v.model.toLowerCase().includes(name.toLowerCase()) ||
                    v.brand.toLowerCase().includes(name.toLowerCase()) ||
                    name.toLowerCase().includes(v.model.toLowerCase()) // Reverse check for "JENARATÖR"
                );
            }
            return null;
        }

        // Search by plate
        let vehicle = vehicles.find(v => v.plate.replace(/\s/g, '') === plate.replace(/\s/g, ''));
        return vehicle;
    }

    // 2. Parse Table Rows
    console.log('Parsing rows...');
    const rows = $('table tbody tr'); // Verify selector matches the table structure

    let processed = 0;
    let skipped = 0;
    let errors = 0;
    let duplicates = 0;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const cols = $(row).find('td');

        if (cols.length < 10) continue; // Skip separator rows or summary

        // Col 1: Index
        // Col 2: Date (e.g. 18.01.2026 11:29)
        const dateStr = $(cols[1]).text().trim();
        if (!dateStr) continue;

        const [day, month, yearTime] = dateStr.split('.');
        const [year, time] = yearTime.split(' ');
        const date = new Date(`${year}-${month}-${day}T${time}:00`);

        // Col 3: Vehicle & Site
        const aracKolon = $(cols[2]).find('.arac-kolon');
        const aracUst = aracKolon.find('.arac-ust').text().trim();
        const aracAlt = aracKolon.find('.arac-alt').text().replace(/[()]/g, '').trim();

        // Site Resolution
        const site = findSite(aracAlt);
        if (!site) {
            console.warn(`[!] Site not found: ${aracAlt}`);
            errors++;
            continue;
        }

        // Default Tank for Site
        let tank = site.fuelTanks[0];
        if (!tank) {
            // Create a default tank if missing
            tank = await prisma.fuelTank.create({
                data: {
                    siteId: site.id,
                    name: 'Ana Tank',
                    capacity: 10000,
                    currentLevel: 0
                }
            });
            // Update local cache
            site.fuelTanks.push(tank);
        }

        // Col 4: KM
        const kmStr = $(cols[3]).text().trim().replace('.', '').replace(',', '.'); // Remove thousand separator, fix decimal
        const km = parseFloat(kmStr) || 0;

        // Col 5: Liters (Positive = In, Negative = Out)
        const litersStr = $(cols[4]).text().trim().replace('.', '').replace(',', '.');
        const rawLiters = parseFloat(litersStr) || 0;

        // Col 10: Description
        const desc = $(cols[9]).text().trim();

        // LOGIC
        try {
            if (aracUst.includes('DEPO VİRMAN')) {
                // TRANSFER
                // We only handle "Virman Gelen" (Incoming) to avoid duplicates
                if (rawLiters > 0 && desc.includes('Virman Gelen')) {
                    const sourceSiteName = desc.split('←')[1]?.trim();
                    const sourceSite = findSite(sourceSiteName);

                    if (sourceSite) {
                        // DUPLICATE CHECK
                        const exists = await prisma.fuelTransfer.findFirst({
                            where: {
                                date: date,
                                amount: rawLiters,
                                toTankId: tank.id
                            }
                        });

                        if (exists) {
                            duplicates++;
                            continue;
                        }

                        await prisma.fuelTransfer.create({
                            data: {
                                date: date,
                                amount: rawLiters,
                                description: desc,
                                fromType: 'TANK',
                                toType: 'TANK',
                                fromId: sourceSite.fuelTanks[0]?.id || 'UNKNOWN',
                                toId: tank.id,
                                fromTankId: sourceSite.fuelTanks[0]?.id || null,
                                toTankId: tank.id,
                                createdByUserId: adminUser.id
                            }
                        });
                        console.log(`[+] Transfer Imported: ${rawLiters}L from ${sourceSite.name} to ${site.name}`);
                        processed++;
                    } else {
                        console.warn(`[!] Source site not found for transfer: ${sourceSiteName}`);
                        errors++;
                    }
                } else {
                    skipped++;
                }
            } else {
                // CONSUMPTION
                if (rawLiters < 0) {
                    // Determine Vehicle
                    const vehicle = findVehicle(aracUst);
                    const liters = Math.abs(rawLiters); // Convert to positive for storage

                    if (vehicle) {
                        // DUPLICATE CHECK
                        const exists = await prisma.fuelLog.findFirst({
                            where: {
                                date: date,
                                liters: liters,
                                vehicleId: vehicle.id,
                                siteId: site.id
                            }
                        });

                        if (exists) {
                            duplicates++;
                            continue;
                        }

                        await prisma.fuelLog.create({
                            data: {
                                date: date,
                                liters: liters,
                                mileage: km,
                                cost: 0,
                                fullTank: false,
                                description: desc,
                                vehicleId: vehicle.id,
                                siteId: site.id,
                                tankId: tank.id,
                                filledByUserId: adminUser.id
                            }
                        });

                        // Update Vehicle KM if newer
                        if (km > vehicle.currentKm) {
                            await prisma.vehicle.update({
                                where: { id: vehicle.id },
                                data: { currentKm: km }
                            });
                        }

                        // Update Tank Level (Decrease)
                        await prisma.fuelTank.update({
                            where: { id: tank.id },
                            data: { currentLevel: { decrement: liters } }
                        });

                        console.log(`[+] Log Imported: ${vehicle.plate} (${vehicle.brand}) - ${liters}L`);
                        processed++;
                    } else {
                        console.warn(`[!] Vehicle not found: ${aracUst}`);
                        errors++;
                    }
                } else {
                    if (rawLiters > 0 && !aracUst.includes('VİRMAN')) {
                        skipped++;
                    }
                }
            }
        } catch (e) {
            console.error(`Error processing row ${i}:`, e);
            errors++;
        }
    }

    console.log(`\n--- Summary ---`);
    console.log(`Processed (New): ${processed}`);
    console.log(`Duplicates (Skipped): ${duplicates}`);
    console.log(`Skipped (Other): ${skipped}`);
    console.log(`Errors: ${errors}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
