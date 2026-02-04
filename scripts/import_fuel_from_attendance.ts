
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
const SITE_NAME_KEYWORD = 'Nazilli';

// Explicit Fixes
const GHOST_VEHICLE_SOURCE = 'Fiat Hitachi';
const GHOST_VEHICLE_TARGET_PLATE = '34-00-25-5586'; // 2025 T

interface FuelEntry {
    date: Date;
    liters: number;
    description?: string;
}

interface VehicleFuelData {
    rawName: string;
    logs: FuelEntry[];
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
        where: { name: { contains: SITE_NAME_KEYWORD } },
        include: { fuelTanks: true }
    });

    if (!site) {
        console.error(`Site containing '${SITE_NAME_KEYWORD}' not found in DB!`);
        return;
    }
    console.log(`Target Site: ${site.name} (${site.id})`);

    // Ensure Tank
    let tank = site.fuelTanks[0];
    if (!tank) {
        console.log("Creating default tank for site...");
        tank = await prisma.fuelTank.create({
            data: {
                siteId: site.id,
                name: 'Ana Tank',
                capacity: 10000,
                currentLevel: 0
            }
        });
    }

    // 2. Parse Table
    console.log("Parsing Table for Fuel...");
    const rows = $('table.puantaj tbody tr');
    console.log(`Found ${rows.length} rows.`);

    const vehiclesToImport: VehicleFuelData[] = [];

    rows.each((i, row) => {
        const cells = $(row).find('td');
        if (cells.length < 5) return;

        // Cell 2: Vehicle Name
        const vehicleNameRaw = $(cells[1]).text().trim();

        // Days: Index 2 to 32 (Col 1 to 31)
        const logs: FuelEntry[] = [];
        for (let d = 0; d < 31; d++) {
            const cell = $(cells[d + 2]);
            const day = d + 1;

            // Check for fuel data
            // 1. In title attribute: "⛽ 20,00 L yakıt alındı"
            // 2. In div class="ap-yakit-alt": "20 L"

            let liters = 0;
            const yakitAltText = cell.find('.ap-yakit-alt').text().trim(); // "20 L"
            const titleText = cell.attr('title') || ''; // "... ⛽ 20,00 L yakıt alındı ..."

            if (yakitAltText) {
                const amount = parseFloat(yakitAltText.replace(' L', '').replace(',', '.'));
                if (!isNaN(amount)) liters = amount;
            } else if (titleText.includes('⛽')) {
                // Regex to find "⛽ X,XX L"
                const match = titleText.match(/⛽\s*([\d,.]+)\s*L/);
                if (match) {
                    const amount = parseFloat(match[1].replace(',', '.'));
                    if (!isNaN(amount)) liters = amount;
                }
            }

            if (liters > 0) {
                const date = new Date(Date.UTC(TARGET_YEAR, TARGET_MONTH - 1, day));
                logs.push({
                    date: date,
                    liters: liters,
                    description: `Puantaj Raporu Aktarımı (${day}.${TARGET_MONTH}.${TARGET_YEAR})`
                });
            }
        }

        if (logs.length > 0) {
            vehiclesToImport.push({
                rawName: vehicleNameRaw,
                logs
            });
        }
    });

    console.log(`Found fuel data for ${vehiclesToImport.length} vehicles.`);

    // 3. Clear ALL existing fuel logs for this site/month (Sync Mode)
    console.log("Clearing all existing FUEL logs for this site and period (Sync Mode)...");
    const monthStart = new Date(Date.UTC(TARGET_YEAR, TARGET_MONTH - 1, 1));
    const monthEnd = new Date(Date.UTC(TARGET_YEAR, TARGET_MONTH, 0, 23, 59, 59));

    const deleteResult = await prisma.fuelLog.deleteMany({
        where: {
            siteId: site.id,
            date: {
                gte: monthStart,
                lte: monthEnd
            }
        }
    });
    console.log(`Deleted ${deleteResult.count} existing logs.`);

    // 4. Import to DB
    console.log("Importing Fuel Logs...");

    const allVehicles = await prisma.vehicle.findMany();
    // Default User (Ahmet Can or first)
    const fillerUser = await prisma.user.findFirst() || { id: 'unknown' };

    for (const v of vehiclesToImport) {
        // Find Vehicle logic (duplicated from import_local_html but with FIX)
        const parts = v.rawName.split(' - ');
        const identifier = parts[0].trim();
        const formattedIdentifier = identifier.replace(/\s+/g, '').toUpperCase();

        // --- GHOST FIX ---
        if (v.rawName.includes(GHOST_VEHICLE_SOURCE) || identifier.includes(GHOST_VEHICLE_SOURCE)) {
            console.log(`[FIX] Remapping '${v.rawName}' to ${GHOST_VEHICLE_TARGET_PLATE}`);
            // Force assign to target
            const vehicle = allVehicles.find(av => av.plate === GHOST_VEHICLE_TARGET_PLATE);
            if (vehicle) {
                await insertLogs(vehicle, v.logs, site.id, tank.id, fillerUser.id);
            } else {
                console.error(`[FIX FAILED] Target vehicle ${GHOST_VEHICLE_TARGET_PLATE} not found!`);
            }
            continue;
        }
        // -----------------

        // Standard Matching
        let vehicle: Vehicle | undefined | null = await prisma.vehicle.findFirst({
            where: { plate: identifier }
        });

        if (!vehicle) {
            vehicle = allVehicles.find(av => av.plate.replace(/\s+/g, '').toUpperCase() === formattedIdentifier);
        }

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

        if (!vehicle) {
            vehicle = allVehicles.find(av => v.rawName.toUpperCase().includes(av.plate.replace(/\s+/g, '').toUpperCase()) && av.plate.length > 3);
        }

        if (!vehicle) {
            console.warn(`Vehicle not found for: ${v.rawName}. Skipping Fuel Import.`);
            continue;
        }

        await insertLogs(vehicle, v.logs, site.id, tank.id, fillerUser.id);
    }

    console.log("Fuel Import Completed.");
}

async function insertLogs(vehicle: Vehicle, logs: FuelEntry[], siteId: string, tankId: string, userId: string) {
    console.log(`Importing ${logs.length} logs for ${vehicle.plate}...`);
    for (const log of logs) {
        await prisma.fuelLog.create({
            data: {
                vehicleId: vehicle.id,
                date: log.date,
                liters: log.liters,
                siteId: siteId,
                tankId: tankId,
                filledByUserId: userId,
                mileage: 0, // Not available in this reports cells
                cost: 0,
                fullTank: false,
                description: log.description
            }
        });
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
