
import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FILE_PATH = `C:\\Users\\Drone\\Desktop\\benzer iş grupları\\200.3\\200.3.html`;
const TARGET_SITE_NAME_PART = "Tokat Zile Ovası 1 Kısım"; // Partial match
const TARGET_VEHICLE_NAME_PART = "200.3";

async function main() {
    console.log(`Reading file: ${FILE_PATH}`);
    if (!fs.existsSync(FILE_PATH)) {
        console.error("File not found!");
        process.exit(1);
    }

    const html = fs.readFileSync(FILE_PATH, 'utf-8');
    const $ = cheerio.load(html);

    // 1. Find Site
    console.log("Resolving Site...");
    const sites = await prisma.site.findMany();
    const site = sites.find(s => s.name.includes(TARGET_SITE_NAME_PART));

    if (!site) {
        console.error(`Site containing '${TARGET_SITE_NAME_PART}' not found! found: ${sites.map(s => s.name).join(", ")}`);
        process.exit(1);
    }
    console.log(`Target Site: ${site.name} (${site.id})`);

    // 2. Find Vehicle
    console.log("Resolving Vehicle...");
    const vehicles = await prisma.vehicle.findMany({
        where: { assignedSiteId: site.id }
    });
    // Try finding by name part
    let vehicle = vehicles.find(v => v.plate.includes(TARGET_VEHICLE_NAME_PART) || (v.model && v.model.includes(TARGET_VEHICLE_NAME_PART)));

    // If not found in site, try global search
    if (!vehicle) {
        const allVehicles = await prisma.vehicle.findMany();
        vehicle = allVehicles.find(v => v.plate.includes(TARGET_VEHICLE_NAME_PART) || (v.model && v.model.includes(TARGET_VEHICLE_NAME_PART)));
    }

    if (!vehicle) {
        console.error(`Vehicle containing '${TARGET_VEHICLE_NAME_PART}' not found!`);
        process.exit(1);
    }
    console.log(`Target Vehicle: ${vehicle.plate} - ${vehicle.model} (${vehicle.id})`);

    // 3. Parse Rows
    console.log("Parsing Table...");
    const rows = $('table#ContentPlaceHolder1_gvYakitRapor tbody tr');
    console.log(`Found ${rows.length} rows.`);

    let importedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const cols = $(row).find('td');
        if (cols.length < 10) continue; // Skip header or invalid

        const dateStr = $(cols[1]).text().trim();
        const vehicleText = $(cols[2]).text().trim();
        const amountStr = $(cols[4]).text().trim();
        const userStr = $(cols[9]).text().trim();

        // Parse Date: "21.11.2025 11:41" -> Date Object
        const [dPart, tPart] = dateStr.split(' ');
        const [day, month, year] = dPart.split('.');
        const [hour, minute] = tPart.split(':');
        const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));

        // Parse Amount
        const cleanAmount = amountStr.replace(/\./g, '').replace(',', '.').replace('-', '');
        const liters = parseFloat(cleanAmount);

        if (isNaN(liters)) {
            console.log(`Skipping row ${i}: Invalid amount ${amountStr}`);
            continue;
        }

        // Check for duplicate
        const existing = await prisma.fuelLog.findFirst({
            where: {
                vehicleId: vehicle.id,
                date: dateObj,
                liters: liters,
                siteId: site.id
            }
        });

        if (existing) {
            console.log(`Skipping existing log: ${dateStr} - ${liters}Lt`);
            skippedCount++;
            continue;
        }

        // Resolve User with Fallback
        let userId = null;
        if (userStr) {
            const user = await prisma.user.findFirst({
                where: { name: { contains: userStr, mode: 'insensitive' } }
            });
            if (user) userId = user.id;
        }

        if (!userId) {
            // Find fallback
            const defaultUser = await prisma.user.findFirst();
            if (defaultUser) {
                userId = defaultUser.id;
                console.log(`User '${userStr}' not found, using fallback: ${defaultUser.name}`);
            } else {
                console.error("No users found in database! Cannot import.");
                process.exit(1);
            }
        }

        // Create Log
        await prisma.fuelLog.create({
            data: {
                vehicle: { connect: { id: vehicle.id } },
                site: { connect: { id: site.id } },
                date: dateObj,
                liters: liters,
                mileage: 0,
                cost: 0,
                fullTank: false,
                description: `Imported from 200.3.html (${userStr})`,
                filledByUser: { connect: { id: userId } }
            }
        });

        console.log(`Imported: ${dateStr} - ${liters}Lt`);
        importedCount++;
    }

    console.log(`\nDone.`);
    console.log(`Imported: ${importedCount}`);
    console.log(`Skipped: ${skippedCount}`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
