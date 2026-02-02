
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

    // 1. Fetch Metadata
    const adminUser = await prisma.user.findFirst({
        where: { username: 'ahmetcan' } // Try to find the user from the HTML
    }) || await prisma.user.findFirst();

    if (!adminUser) {
        console.error('No user found.');
        return;
    }

    const sites = await prisma.site.findMany({ include: { fuelTanks: true } });

    // Helper to find Site ID by Name
    function findSite(name: string) {
        if (!name) return null;
        const cleanName = name.replace(/[()]/g, '').trim();
        let site = sites.find(s => s.name === cleanName);
        if (!site) site = sites.find(s => s.name.includes(cleanName) || cleanName.includes(s.name));
        if (!site) {
            if (cleanName.includes('Nazilli')) site = sites.find(s => s.name.includes('Nazilli'));
            if (cleanName.includes('Vezirköprü')) site = sites.find(s => s.name.includes('Vezirköprü'));
            if (cleanName.includes('Zile')) site = sites.find(s => s.name.includes('Zile'));
            if (cleanName.includes('Doğanlı')) site = sites.find(s => s.name.includes('Doğanlı'));
        }
        return site;
    }

    console.log('Parsing rows for Purchases...');
    const rows = $('table tbody tr');

    let processed = 0;
    let skipped = 0;
    let matches = 0;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const cols = $(row).find('td');
        if (cols.length < 10) continue;

        // Date
        const dateStr = $(cols[1]).text().trim();
        if (!dateStr) continue;
        const [day, month, yearTime] = dateStr.split('.');
        const [year, time] = yearTime.split(' ');
        const date = new Date(`${year}-${month}-${day}T${time}:00`);

        // Site & Description
        const aracKolon = $(cols[2]).find('.arac-kolon');
        const aracUst = aracKolon.find('.arac-ust').text().trim();
        const aracAlt = aracKolon.find('.arac-alt').text().replace(/[()]/g, '').trim();
        const desc = $(cols[9]).text().trim();

        // Liters
        const litersStr = $(cols[4]).text().trim().replace('.', '').replace(',', '.');
        const rawLiters = parseFloat(litersStr) || 0;

        // Filter: Positive Liters AND NOT Virman
        if (rawLiters > 0 && !aracUst.includes('VİRMAN') && !desc.includes('Virman')) {
            matches++;

            // Site Resolution
            const site = findSite(aracAlt);
            if (!site) {
                console.warn(`[!] Site not found for purchase: ${aracAlt}`);
                continue;
            }

            let tank = site.fuelTanks[0];
            if (!tank) {
                // Should not happen if previous script ran, but standard check
                tank = await prisma.fuelTank.create({
                    data: { siteId: site.id, name: 'Ana Tank', capacity: 10000, currentLevel: 0 }
                });
            }

            // Duplicate Check
            const exists = await prisma.fuelTransfer.findFirst({
                where: {
                    date: date,
                    amount: rawLiters,
                    toId: tank.id,
                    fromType: 'EXTERNAL'
                }
            });

            if (exists) {
                skipped++;
                continue;
            }

            // Create Purchase (External Transfer)
            await prisma.fuelTransfer.create({
                data: {
                    date: date,
                    amount: rawLiters,
                    description: `${desc} (${aracUst})`, // Preserve usage/provider info
                    fromType: 'EXTERNAL',
                    fromId: 'SUPPLIER', // Or extract from desc if possible
                    toType: 'TANK',
                    toId: tank.id,
                    toTankId: tank.id,
                    createdByUserId: adminUser.id
                }
            });

            // Update Tank Level (Increment)
            await prisma.fuelTank.update({
                where: { id: tank.id },
                data: { currentLevel: { increment: rawLiters } }
            });

            console.log(`[+] Purchase Imported: ${rawLiters}L @ ${site.name}`);
            processed++;
        }
    }

    console.log(`\n--- Summary ---`);
    console.log(`Found Matches: ${matches}`);
    console.log(`Imported: ${processed}`);
    console.log(`Skipped (Duplicate): ${skipped}`);
}

main().finally(() => prisma.$disconnect());
