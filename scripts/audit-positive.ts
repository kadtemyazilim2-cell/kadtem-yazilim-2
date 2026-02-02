
import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

const filePath = path.join('C:\\Users\\Drone\\Desktop\\benzer iş grupları\\Yeni klasör\\mazot1.html');
const html = fs.readFileSync(filePath, 'utf-8');
const $ = cheerio.load(html);

const rows = $('table tbody tr');
let positiveCount = 0;
let virmanCount = 0;
let otherCount = 0;

console.log('--- Scanning for Positive Liters (Incoming Fuel) ---');

for (let i = 0; i < rows.length; i++) {
    const cols = $(rows[i]).find('td');
    if (cols.length < 10) continue;

    const litersStr = $(cols[4]).text().trim().replace('.', '').replace(',', '.');
    const liters = parseFloat(litersStr) || 0;
    const desc = $(cols[9]).text().trim();
    const aracUst = $(cols[2]).find('.arac-ust').text().trim();

    if (liters > 0) {
        positiveCount++;
        if (aracUst.includes('VİRMAN') || desc.includes('Virman')) {
            virmanCount++;
            // Uncomment to see details
            // console.log(`[Virman] ${liters}L - ${desc} (${aracUst})`);
        } else {
            otherCount++;
            console.log(`[OTHER] ${liters}L - ${desc} (${aracUst})`);
        }
    }
}

console.log('--- Summary ---');
console.log(`Total Positive Entries: ${positiveCount}`);
console.log(`Virman (Transfers): ${virmanCount}`);
console.log(`Other (Purchases?): ${otherCount}`);
