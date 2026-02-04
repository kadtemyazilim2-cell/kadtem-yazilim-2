
import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TARGET_PLATE = "34-00-24-7675"; // 34-00-24-7675

const CONFIG = [
    {
        folder: `C:\\Users\\Drone\\Desktop\\benzer iş grupları\\alpha\\aydın`,
        filePattern: "alpha aydın.html",
        siteNamePart: "Aydın Nazilli-Yenipazar Tarla İçi Kapalı (Borulu) Drenaj Ve Tigh Projesi"
    },
    {
        folder: `C:\\Users\\Drone\\Desktop\\benzer iş grupları\\alpha\\vezirköprü`,
        filePattern: "alpha vezirköprü.html",
        siteNamePart: "Samsun Vezirköprü Arazi Toplulaştırma Ve Tarla İçi Geliştirme Hizmetleri İşi"
    },
    {
        folder: `C:\\Users\\Drone\\Desktop\\benzer iş grupları\\alpha\\zile 1`,
        filePattern: "alpha zile 1.html",
        siteNamePart: "Tokat Zile Ovası 1 Kısım Arazi Toplulaştırma Ve Tarla İçi Geliştirme Hizmetleri Yapım İşi"
    }
];

async function main() {
    // 1. Find Vehicle
    console.log(`Resolving Vehicle: ${TARGET_PLATE}...`);
    const vehicle = await prisma.vehicle.findFirst({
        where: { plate: TARGET_PLATE }
    });

    if (!vehicle) {
        console.error(`Vehicle with plate ${TARGET_PLATE} not found!`);
        return;
    }
    console.log(`Target Vehicle: ${vehicle.plate} (${vehicle.id})`);

    // Find Fallback User (First admin or any user)
    let fallbackUser = await prisma.user.findFirst({
        where: { username: "ahmetcan" }
    });
    if (!fallbackUser) {
        fallbackUser = await prisma.user.findFirst();
    }

    if (!fallbackUser) {
        console.error("No users found in DB! Cannot import logs without a user.");
        return;
    }
    console.log(`Fallback User: ${fallbackUser.name} (${fallbackUser.username})`);

    // 2. Process Each Config
    for (const config of CONFIG) {
        console.log(`\nProcessing folder: ${config.folder}`);

        const filePath = path.join(config.folder, config.filePattern);
        if (!fs.existsSync(filePath)) {
            console.error(`File not found: ${filePath}`);
            continue;
        }

        // Find Site
        console.log(`Resolving Site for: ${config.siteNamePart}...`);
        const site = await prisma.site.findFirst({
            where: { name: { contains: config.siteNamePart } }
        });

        if (!site) {
            console.error(`Site containing '${config.siteNamePart}' not found!`);
            continue;
        }
        console.log(`Target Site: ${site.name} (${site.id})`);

        // Parse HTML
        const html = fs.readFileSync(filePath, 'utf8');
        const $ = cheerio.load(html);
        const rows = $('table tr').toArray();

        console.log(`Parsing Table... Found ${rows.length} rows.`);
        let count = 0;

        for (let i = 1; i < rows.length; i++) { // Skip header
            const row = rows[i];
            const cols = $(row).find('td').toArray();

            // Need at least 10 columns
            if (cols.length < 10) continue;

            const dateStr = $(cols[1]).text().trim();
            if (!dateStr) continue;

            const mileageStr = $(cols[3]).text().trim();
            const litersStr = $(cols[4]).text().trim();
            const userStr = $(cols[9]).text().trim(); // "asımaykut"

            // Parse Date
            const [dPart, tPart] = dateStr.split(' ');
            const [day, month, year] = dPart.split('.');
            let hour = '00', min = '00', sec = '00';
            if (tPart) {
                const parts = tPart.split(':');
                if (parts[0]) hour = parts[0];
                if (parts[1]) min = parts[1];
                if (parts[2]) sec = parts[2];
            }

            const dateObj = new Date(
                parseInt(year),
                parseInt(month) - 1,
                parseInt(day),
                parseInt(hour),
                parseInt(min),
                parseInt(sec) || 0
            );

            // Parse Liters
            let cleanLiters = litersStr.replace(/\./g, '').replace(',', '.');
            let liters = parseFloat(cleanLiters);
            if (isNaN(liters)) liters = 0;
            liters = Math.abs(liters);

            // Parse Mileage
            let cleanMileage = mileageStr.replace(/\./g, '').replace(',', '.');
            let mileage = parseFloat(cleanMileage);
            if (isNaN(mileage)) mileage = 0;

            // Resolve User
            let userId = fallbackUser.id;
            if (userStr) {
                const found = await prisma.user.findFirst({
                    where: {
                        OR: [
                            { username: { contains: userStr, mode: 'insensitive' } },
                            { name: { contains: userStr, mode: 'insensitive' } } // Changed from fullName
                        ]
                    }
                });
                if (found) userId = found.id;
            }

            // Conflict Resolution
            const startWindow = new Date(dateObj.getTime() - 60000);
            const endWindow = new Date(dateObj.getTime() + 60000);

            const existing = await prisma.fuelLog.findMany({
                where: {
                    vehicleId: vehicle.id,
                    date: {
                        gte: startWindow,
                        lte: endWindow
                    }
                }
            });

            if (existing.length > 0) {
                console.log(`   -> Deleting ${existing.length} existing logs near ${dateStr}...`);
                await prisma.fuelLog.deleteMany({
                    where: {
                        id: { in: existing.map(e => e.id) }
                    }
                });
            }

            // Create Log
            try {
                await prisma.fuelLog.create({
                    data: {
                        vehicleId: vehicle.id,
                        siteId: site.id,
                        date: dateObj,
                        liters: liters,
                        mileage: mileage,
                        cost: 0,
                        fullTank: false,
                        filledByUserId: userId,
                        description: `Imported from Alpha HTML (Given by: ${userStr})`
                    }
                });
                count++;
            } catch (e) {
                console.error(`Error creating log row ${i}:`, e);
            }
        }
        console.log(`Imported ${count} logs for ${site.name}.`);
    }

    console.log("Done!");
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
