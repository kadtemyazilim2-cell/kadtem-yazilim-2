
import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';
import type { Vehicle } from '@prisma/client';

const prisma = new PrismaClient();

// Configuration
const FILE_PATH = `C:\\Users\\Drone\\Desktop\\benzer iş grupları\\aydın\\araç puantaj\\ocak 2026\\Araç Puantaj Raporu ocak 2026.html`;
const TARGET_YEAR = 2026;
const TARGET_MONTH = 1; // January

// Status Mapping
const STATUS_MAP: Record<string, string> = {
    '✔️': 'WORK',
    '⛔': 'IDLE',       // UI: "Çalışmadı (Yattı)"
    '🌓': 'HALF_DAY',   // UI: "Yarım Gün"
    '🛠️': 'REPAIR',     // UI: "Arızalı"
    '🎉': 'HOLIDAY',    // UI: "Tatil"
    '❌': 'IDLE'        // Default bad state to IDLE
};

const SITE_NAME_KEYWORD = 'Nazilli';

interface VehicleImportData {
    rawName: string;
    days: string[];
}

async function main() {
    console.log(`Reading file: ${FILE_PATH}`);

    if (!fs.existsSync(FILE_PATH)) {
        console.error("File not found!");
        return;
    }

    const html = fs.readFileSync(FILE_PATH, 'utf8');
    const $ = cheerio.load(html);

    // 1. Resolve Site ID
    console.log("Resolving Site...");
    const site = await prisma.site.findFirst({
        where: { name: { contains: SITE_NAME_KEYWORD } }
    });

    if (!site) {
        console.error(`Site containing '${SITE_NAME_KEYWORD}' not found in DB!`);
        return;
    }
    console.log(`Target Site: ${site.name} (${site.id})`);

    // 2. Parse Table
    console.log("Parsing Table...");
    const rows = $('table.puantaj tbody tr');
    console.log(`Found ${rows.length} rows.`);

    const vehiclesToImport: VehicleImportData[] = [];

    rows.each((i, row) => {
        const cells = $(row).find('td');
        if (cells.length < 5) return;

        // Cell 2: Vehicle Name (Class: left-sticky)
        const vehicleNameRaw = $(cells[1]).text().trim();

        // Days: Index 2 to 32 (Col 1 to 31)
        const days: string[] = [];
        for (let d = 0; d < 31; d++) {
            const cell = $(cells[d + 2]);
            const text = cell.text().trim();
            const icon = cell.find('div').first().text().trim();

            // Determine Status
            let status = 'IDLE'; // Default to IDLE instead of ABSENT so it shows up in UI

            if (STATUS_MAP[icon]) {
                status = STATUS_MAP[icon];
            } else if (text.includes('Tam Gün') || icon.includes('Tam')) status = 'WORK';

            if (cell.hasClass('ap-tamgun')) status = 'WORK';
            else if (cell.hasClass('ap-yarimgun')) status = 'HALF_DAY';
            else if (cell.hasClass('ap-arizali')) status = 'REPAIR';
            else if (cell.hasClass('ap-calismadi')) status = 'IDLE';
            else if (cell.hasClass('ap-tatil')) status = 'HOLIDAY';

            days.push(status);
        }

        vehiclesToImport.push({
            rawName: vehicleNameRaw,
            days
        });
    });

    console.log(`Parsed ${vehiclesToImport.length} vehicles.`);

    // 3. Clear ALL existing records for this site/month (Sync Mode)
    console.log("Clearing all existing records for this site and period (Sync Mode)...");
    const monthStart = new Date(Date.UTC(TARGET_YEAR, TARGET_MONTH - 1, 1));
    const monthEnd = new Date(Date.UTC(TARGET_YEAR, TARGET_MONTH, 0));

    await prisma.vehicleAttendance.deleteMany({
        where: {
            siteId: site.id,
            date: {
                gte: monthStart,
                lte: monthEnd
            }
        }
    });

    // 4. Import to DB
    console.log("Importing to DB...");

    const allVehicles = await prisma.vehicle.findMany();

    for (const v of vehiclesToImport) {
        // Find Vehicle
        // Try splitting by " - " first (Space Hyphen Space) for patterns like "ID - Description"
        const parts = v.rawName.split(' - ');
        const identifier = parts[0].trim();
        const formattedIdentifier = identifier.replace(/\s+/g, '').toUpperCase();

        // 1. Exact Plate Match
        let vehicle: Vehicle | undefined | null = await prisma.vehicle.findFirst({
            where: { plate: identifier }
        });

        // 2. Normalized Plate Match (Local Memory)
        if (!vehicle) {
            vehicle = allVehicles.find(av => av.plate.replace(/\s+/g, '').toUpperCase() === formattedIdentifier);
        }

        // 3. Model Match (Exact or Contains) - Fallback for "2025 T" etc.
        if (!vehicle) {
            vehicle = await prisma.vehicle.findFirst({
                where: {
                    OR: [
                        { model: { equals: identifier, mode: 'insensitive' } },
                        { model: { contains: identifier, mode: 'insensitive' } }
                    ]
                }
            });
        }

        // 4. Raw Name contains Plate (last resort)
        if (!vehicle) {
            vehicle = allVehicles.find(av => v.rawName.toUpperCase().includes(av.plate.replace(/\s+/g, '').toUpperCase()) && av.plate.length > 3);
        }

        if (!vehicle) {
            console.warn(`Vehicle not found for: ${v.rawName} (Identifier: ${identifier}). Skipping.`);
            continue;
        }

        console.log(`Processing ${vehicle.plate} (${v.rawName})...`);

        // Records creation
        const records = v.days.map((status, index) => {
            const day = index + 1;
            const date = new Date(Date.UTC(TARGET_YEAR, TARGET_MONTH - 1, day));
            if (date.getMonth() !== TARGET_MONTH - 1) return null;

            return {
                vehicleId: vehicle.id,
                siteId: site.id,
                date: date,
                status: status,
                hours: status === 'WORK' ? 1 : status === 'HALF_DAY' ? 0.5 : 0
            };
        }).filter((r): r is NonNullable<typeof r> => r !== null);

        if (records.length > 0) {
            await prisma.vehicleAttendance.createMany({
                data: records
            });
        }
    }

    console.log("Import Completed.");
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
