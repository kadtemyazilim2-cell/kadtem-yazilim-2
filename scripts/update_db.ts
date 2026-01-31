import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
// import { parse } from 'date-fns'; // Use built-in date parsing for DD.MM.YYYY

const prisma = new PrismaClient();

async function main() {
    // 1. Run the scraper logic (or import it if refactored, but for now we'll just run it as a subprocess or assuming json file exists? 
    // Ideally, we should integrate the scraper code here or read from a file if the scraper saves it.
    // The previous steps printed JSON to stdout. Let's make scrape_vehicles.ts save to a file or module export.
    // For this quick script, let's assume we read from 'vehicles_data.json' or just re-implement/copy the scraping part?
    // User asked for a separate script. Let's make this script *run* the scraper script using child_process or just merge them?
    // Merging is cleaner or just assume `scrape_vehicles.ts` saves to `scraped_vehicles.json`.

    // Let's modify scrape_vehicles.ts to save to file first, THEN run this.
    // Or simpler: this script reads `scraped_vehicles.json`.

    // BUT wait, I haven't modified scrape_vehicles.ts to save to a JSON file yet, it just logs.
    // I will read the JSON from a file. I will first update scrape_vehicles.ts to save to 'scraped_vehicles.json'.

    const dataPath = path.join(process.cwd(), 'scraped_vehicles.json');
    if (!fs.existsSync(dataPath)) {
        console.error('Data file not found:', dataPath);
        process.exit(1);
    }

    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const scrapedVehicles = JSON.parse(rawData);

    console.log(`Found ${scrapedVehicles.length} vehicles in scraped data.`);

    // 2. Fetch OWNED vehicles from DB
    const dbVehicles = await prisma.vehicle.findMany({
        where: {
            ownership: 'OWNED',
            status: 'ACTIVE' // Update only active ones? Or all? User said "öz mal araçların". Usually implies active.
        }
    });

    console.log(`Found ${dbVehicles.length} OWNED vehicles in DB.`);

    // Helper to parse "DD.MM.YYYY" to Date object
    function parseDate(dateStr: string): Date | null {
        if (!dateStr || dateStr.trim() === '') return null;
        const parts = dateStr.trim().split('.');
        if (parts.length !== 3) return null;
        // DD.MM.YYYY -> new Date(YYYY, MM-1, DD)
        // Note: Months serve as 0-indexed in JS Date
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }

    // Helper to compare dates (ignoring time)
    function isSameDate(d1: Date | null, d2: Date | null): boolean {
        if (!d1 && !d2) return true;
        if (!d1 || !d2) return false;
        return d1.getTime() === d2.getTime(); // Assuming we set time to 00:00:00 for both
    }

    // Create UTC midnight date from local parts to avoid timezone shifts affecting comparison if not careful
    // But since Prisma stores as UTC, we should be consistent.
    // Let's us `date-fns` style generic comparison or simple ISO string prefix.
    function toISODate(d: Date | null) {
        if (!d) return null;
        // If the scraped date is "24.06.2026", it implies that day.
        // DB might store it as 2026-06-24T00:00:00.000Z.
        return d.toISOString().split('T')[0];
    }


    let updatedCount = 0;

    for (const scraped of scrapedVehicles) {
        // Normalize plate: remove spaces? Db plates usually have spaces "06 BC 0679". Scraped has spaces too.
        // Let's just trim.
        const plate = scraped.plate.trim();
        const dbVehicle = dbVehicles.find(v => v.plate.replace(/\s+/g, '').toUpperCase() === plate.replace(/\s+/g, '').toUpperCase());

        if (dbVehicle) {
            const newInsurance = parseDate(scraped.insuranceExpiry);
            const newKasko = parseDate(scraped.kaskoExpiry);
            const newInspection = parseDate(scraped.inspectionExpiry);
            const newCard = parseDate(scraped.vehicleCardExpiry);

            // Compare and prepare update
            const updateData: any = {};
            let hasChanges = false;

            // Insurance
            // Note: DB dates are Date objects.
            // When we parse "24.06.2026", we get local time 00:00.
            // Prisma might return UTC.
            // Safest is to set parsed dates to UTC noon to avoid day shifts or just compare YYYY-MM-DD strings.

            const toYMD = (d: Date | null) => d ? d.toISOString().split('T')[0] : null;
            // Hack for local to UTC:
            // Since we construct Date(y, m, d), it uses local time.
            // dbVehicle.insuranceExpiry is typically UTC 00:00.
            // If local is GMT+3, Date(2026, 5, 24) -> 2026-06-23T21:00:00Z.
            // So `toYMD` on local date might be day before if we just do toISOString.
            // Correct way: use UTC construction.
            const parseDateUTC = (dateStr: string) => {
                if (!dateStr || dateStr.trim() === '') return null;
                const [d, m, y] = dateStr.trim().split('.').map(Number);
                return new Date(Date.UTC(y, m - 1, d)); // Noon to be safe? No, midnight.
            };

            const nInsurance = parseDateUTC(scraped.insuranceExpiry);
            const nKasko = parseDateUTC(scraped.kaskoExpiry);
            const nInspection = parseDateUTC(scraped.inspectionExpiry);
            const nCard = parseDateUTC(scraped.vehicleCardExpiry);

            // current values
            const cInsurance = dbVehicle.insuranceExpiry;
            const cKasko = dbVehicle.kaskoExpiry;
            const cInspection = dbVehicle.inspectionExpiry;
            const cCard = dbVehicle.vehicleCardExpiry;

            if (toYMD(nInsurance) !== toYMD(cInsurance)) {
                updateData.insuranceExpiry = nInsurance;
                hasChanges = true;
            }
            if (toYMD(nKasko) !== toYMD(cKasko)) {
                updateData.kaskoExpiry = nKasko;
                hasChanges = true;
            }
            if (toYMD(nInspection) !== toYMD(cInspection)) {
                updateData.inspectionExpiry = nInspection;
                hasChanges = true;
            }
            if (toYMD(nCard) !== toYMD(cCard)) {
                updateData.vehicleCardExpiry = nCard;
                hasChanges = true;
            }

            if (hasChanges) {
                console.log(`Updating ${plate}:`);
                if (updateData.insuranceExpiry !== undefined) console.log(`  Insurance: ${toYMD(cInsurance)} -> ${toYMD(nInsurance)}`);
                if (updateData.kaskoExpiry !== undefined) console.log(`  Kasko: ${toYMD(cKasko)} -> ${toYMD(nKasko)}`);
                if (updateData.inspectionExpiry !== undefined) console.log(`  Inspection: ${toYMD(cInspection)} -> ${toYMD(nInspection)}`);
                if (updateData.vehicleCardExpiry !== undefined) console.log(`  Card: ${toYMD(cCard)} -> ${toYMD(nCard)}`);

                await prisma.vehicle.update({
                    where: { id: dbVehicle.id },
                    data: updateData
                });
                updatedCount++;
            }
        }
    }

    console.log(`Total vehicles updated: ${updatedCount}`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
