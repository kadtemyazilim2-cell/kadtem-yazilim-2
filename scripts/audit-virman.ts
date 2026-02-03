
import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const filePath = path.join('C:\\Users\\Drone\\Desktop\\benzer iş grupları\\Yeni klasör\\mazot1.html');
    const html = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(html);

    const rows = $('table tbody tr');
    const allVirmans: any[] = [];

    console.log('--- extracting virman rows ---');
    for (let i = 0; i < rows.length; i++) {
        const cols = $(rows[i]).find('td');
        if (cols.length < 10) continue;

        const desc = $(cols[9]).text().trim();
        const aracUst = $(cols[2]).find('.arac-ust').text().trim();

        // Check if it's a Virman row
        if (aracUst.includes('VİRMAN') || desc.includes('Virman')) {
            const dateStr = $(cols[1]).text().trim();
            const [day, month, yearTime] = dateStr.split('.');
            const [year, time] = yearTime.split(' ');
            const date = new Date(`${year}-${month}-${day}T${time}:00`);

            const litersStr = $(cols[4]).text().trim().replace('.', '').replace(',', '.');
            const liters = parseFloat(litersStr) || 0;

            allVirmans.push({
                date,
                liters,
                desc,
                aracUst,
                type: liters > 0 ? 'Gelen' : 'Giden'
            });
        }
    }

    console.log(`Found ${allVirmans.length} Virman rows.`);

    let missingCount = 0;
    let processedCount = 0;

    for (const v of allVirmans) {
        if (v.type === 'Gelen') {
            // Check if this Gelen transfer exists
            // We look for a transfer with same Date, Amount, and ToTank (we assume ToTank is derived from context, but for Audit just Date/Amount is a strong signal)
            const exists = await prisma.fuelTransfer.findFirst({
                where: {
                    date: v.date,
                    amount: v.liters,
                    // We can't easily check toTankId without resolving site again, but Date+Amount is usually unique enough for transfers
                }
            });

            if (exists) {
                console.log(`[OK] Gelen Found: ${v.liters}L - ${v.desc}`);
                processedCount++;
            } else {
                console.log(`[MISSING] Gelen NOT Found: ${v.liters}L - ${v.desc}`);
                missingCount++;
            }
        } else {
            // It's 'Giden'
            // We don't import Giden directly. We expect there to be a matching Gelen?
            // Or if it's Giden to an EXTERNAL place (not in our sites), we might have missed it?
            // Usually Giden -> X means X received it. If X is one of our sites, we should have a confirmation row for X (Gelen).
            // If X is NOT our site, then this is an Export? Or duplicate?
            console.log(`[INFO] Giden Record: ${v.liters}L - ${v.desc}`);
        }
    }

    console.log('--- Summary ---');
    console.log(`Total Virmans: ${allVirmans.length}`);
    console.log(`Gelen (Should be Imported): ${allVirmans.filter(x => x.type === 'Gelen').length}`);
    console.log(`Gelen Verified in DB: ${processedCount}`);
    console.log(`Gelen Missing in DB: ${missingCount}`);
}

main().finally(() => prisma.$disconnect());
