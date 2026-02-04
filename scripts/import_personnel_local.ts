
import fs from 'fs';
import path from 'path';
import { PrismaClient, Status } from '@prisma/client';
import * as cheerio from 'cheerio';

const prisma = new PrismaClient();

// Target File
const FILE_PATH = path.join('C:', 'Users', 'Drone', 'Desktop', 'benzer iş grupları', 'personel', 'Puantaj Personel Ekle.html');

// Helper to convert Turkish Date (2026-01-17) to Date object
function parseDate(dateStr: string): Date | undefined {
    if (!dateStr || dateStr.trim() === '' || dateStr.trim() === '&nbsp;') return undefined;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? undefined : d;
}

function parseSalary(salaryStr: string): number | undefined {
    if (!salaryStr || salaryStr.includes('&nbsp;')) return undefined;
    // Format: 50.000,00 -> remove dots, replace comma with dot
    const clean = salaryStr.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(clean);
    return isNaN(num) ? undefined : num;
}

// Map Status text to Enum
function parseStatus(statusText: string): Status {
    const s = statusText.toLowerCase();
    if (s.includes('çalışıyor')) return 'ACTIVE';
    if (s.includes('ayrıldı')) return 'LEFT';
    return 'ACTIVE'; // Default
}

async function main() {
    console.log(`Reading file: ${FILE_PATH}`);

    if (!fs.existsSync(FILE_PATH)) {
        console.error(`File not found: ${FILE_PATH}`);
        return;
    }

    const html = fs.readFileSync(FILE_PATH, 'utf-8');
    const $ = cheerio.load(html);

    console.log('Parsing HTML...');

    const rows = $('#ContentPlaceHolder1_gvPersoneller tr');
    console.log(`Found ${rows.length} rows.`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 1; i < rows.length; i++) { // Skip header row 0
        const row = $(rows[i]);
        const cells = row.find('td');

        if (cells.length < 7) continue;

        const fullName = $(cells[0]).text().trim();
        let tcNumber = $(cells[1]).text().trim();
        const salaryStr = $(cells[2]).text().trim();
        const dateStr = $(cells[3]).text().trim();
        const role = $(cells[4]).text().trim();
        const category = $(cells[5]).text().trim(); // Sınıf
        const statusText = $(cells[6]).text().trim();

        if (!fullName) continue;

        // Clean TC (handle &nbsp;)
        if (tcNumber === '' || tcNumber.charCodeAt(0) === 160) tcNumber = '';
        if (tcNumber && tcNumber.length !== 11) tcNumber = '';

        const salary = parseSalary(salaryStr);
        const startDate = parseDate(dateStr);
        const status = parseStatus(statusText);

        const data = {
            fullName,
            role: role || 'Tanımsız',
            tcNumber: tcNumber || null,
            salary,
            startDate,
            category: category || 'FIELD', // Default to FIELD if empty
            status,
        };

        // Upsert Logic
        try {
            let existing: any = null;

            // 1. Try Find by TC
            if (tcNumber) {
                existing = await prisma.personnel.findFirst({
                    where: { tcNumber },
                });
            }

            // 2. Try Find by Name
            if (!existing) {
                existing = await prisma.personnel.findFirst({
                    where: { fullName: { equals: fullName, mode: 'insensitive' } },
                });
            }

            if (existing) {
                // Update
                await prisma.personnel.update({
                    where: { id: existing.id },
                    data: {
                        ...data,
                    }
                });
                console.log(`Updated: ${fullName}`);
            } else {
                // Create
                await prisma.personnel.create({
                    data: {
                        ...data,
                    }
                });
                console.log(`Created: ${fullName}`);
            }
            successCount++;
        } catch (error) {
            console.error(`Error processing ${fullName}:`, error);
            failCount++;
        }
    }

    console.log(`Done. Success: ${successCount}, Failed: ${failCount}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
