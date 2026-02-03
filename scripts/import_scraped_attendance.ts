
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const DATA_FILE = 'scraped_attendance_FULL_6_MONTHS.json';

// Mapping Config
const SITE_KEYWORD_MAP: Record<string, string> = {
    'Aydin Nazilli Yenipazar': 'Yenipazar',
    'Samsun Vezirkopru': 'Vezir',
    'Tokat Zile': 'Zile Ovası 1' // [FIX] Updated to match active site
};

async function main() {
    console.log('Starting Import...');

    if (!fs.existsSync(DATA_FILE)) {
        console.error(`Data file ${DATA_FILE} not found!`);
        return;
    }

    const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
    const batches = JSON.parse(rawData);

    console.log(`Loaded ${batches.length} batches.`);

    // 1. Resolve Sites
    const siteMap = new Map<string, string>(); // Scraped Name -> DB ID
    const dbSites = await prisma.site.findMany();

    for (const [scrapedName, keyword] of Object.entries(SITE_KEYWORD_MAP)) {
        const found = dbSites.find(s => s.name.toLowerCase().includes(keyword.toLowerCase()));
        if (found) {
            console.log(`Mapped '${scrapedName}' -> '${found.name}' (${found.id})`);
            siteMap.set(scrapedName, found.id);
        } else {
            console.warn(`[WARN] No DB Site found for '${scrapedName}' (Keyword: ${keyword})`);
        }
    }

    // 2. Resolve Vehicles (Cache)
    const vehicles = await prisma.vehicle.findMany();
    const plateMap = new Map<string, string>(); // Normalized Plate -> ID

    vehicles.forEach(v => {
        const norm = v.plate.replace(/\s+/g, '').toUpperCase();
        plateMap.set(norm, v.id);
    });

    // 3. Process Batches
    for (const batch of batches) {
        const siteId = siteMap.get(batch.siteName);
        if (!siteId) {
            // console.log(`Skipping batch for unresolved site: ${batch.siteName}`);
            continue;
        }

        const year = parseInt(batch.year);
        const month = parseInt(batch.month); // 1-12

        console.log(`Processing ${batch.siteName} - ${year}/${month} (${batch.rows.length} vehicles)...`);

        for (const row of batch.rows) {
            // Extract Plate from "01 C 9569 - New Holland..."
            const parts = row.vehicleInfo.split('-');
            const rawPlate = parts[0].trim();
            const normPlate = rawPlate.replace(/\s+/g, '').toUpperCase();

            const vehicleId = plateMap.get(normPlate);
            if (!vehicleId) {
                continue;
            }

            // Process Days
            for (let dayIndex = 0; dayIndex < row.days.length; dayIndex++) {
                const dayVal = row.days[dayIndex];
                if (!dayVal) continue;

                const day = dayIndex + 1;
                // Validate date
                try {
                    const date = new Date(year, month - 1, day, 12, 0, 0);
                    if (date.getMonth() !== month - 1) continue;

                    // Use 'any' to bypass TS inference issues with switch/if logic flow
                    let status: any = 'IDLE';
                    let hours = 0;

                    if (dayVal === 'WORK') {
                        status = 'WORK';
                        hours = 1;
                    } else if (dayVal === 'HALF') {
                        status = 'WORK';
                        hours = 0.5;
                    } else if (dayVal === 'ABSENT') {
                        status = 'ABSENT';
                        hours = 0;
                    } else if (dayVal === 'REPAIR') {
                        status = 'MAINTENANCE';
                        hours = 0;
                    } else {
                        continue;
                    }

                    await prisma.vehicleAttendance.deleteMany({
                        where: {
                            vehicleId: vehicleId,
                            date: {
                                gte: new Date(year, month - 1, day, 0, 0, 0),
                                lt: new Date(year, month - 1, day, 23, 59, 59)
                            }
                        }
                    });

                    if (status !== 'IDLE') {
                        await prisma.vehicleAttendance.create({
                            data: {
                                vehicleId,
                                siteId,
                                date: date,
                                status: status,
                                hours,
                                note: 'Imported (Scraper)'
                            }
                        });
                    }
                } catch (e) {
                    console.error('Error processing record:', e);
                }
            }
        }
    }

    console.log('Import Completed.');
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
