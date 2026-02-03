
import { PrismaClient, PaymentMethod } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Configuration
const CONFIG = {
    targetUserIds: ["Gülay Semerci"], // Flexible matching
    filePath: "C:\\Users\\Drone\\Desktop\\benzer iş grupları\\vezirköprü\\Yeni klasör\\Kasa Raporu vezirköprü gülay.html",
    siteKeyword: "Samsun Vezirköprü Arazi Toplulaştırma", // Correct site name per user request
    fileName: "Kasa Raporu vezirköprü gülay.html"
};

async function main() {
    console.log("Starting Gülay Semerci Import...");

    // 1. Find User
    const user = await prisma.user.findFirst({
        where: {
            name: { contains: "Gülay", mode: 'insensitive' }
        }
    });

    if (!user) {
        console.error(`User 'Gülay' not found!`);
        return;
    }
    console.log(`Found User: ${user.name} (${user.id})`);

    // 2. Find Site
    const site = await prisma.site.findFirst({
        where: {
            name: { contains: CONFIG.siteKeyword, mode: 'insensitive' }
        }
    });

    if (!site) {
        console.error(`Site matching '${CONFIG.siteKeyword}' not found!`);
        // List close matches?
        return;
    }
    console.log(`Found Target Site: ${site.name} (${site.id})`);

    // 3. Process File
    if (!fs.existsSync(CONFIG.filePath)) {
        console.error(`File not found: ${CONFIG.filePath}`);
        return;
    }

    console.log(`Reading file...`);
    const content = fs.readFileSync(CONFIG.filePath, 'utf-8');

    // 4. Parse HTML
    const rowRegex = /<tr>([\s\S]*?)<\/tr>/g;
    let match;
    let count = 0;

    while ((match = rowRegex.exec(content)) !== null) {
        const rowContent = match[1];
        const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
        const cells: string[] = [];
        let cellMatch;
        while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
            let text = cellMatch[1].replace(/<[^>]+>/g, '').trim();
            text = text.replace(/&nbsp;/g, ' ');
            cells.push(text);
        }

        if (cells.length < 8) continue;

        // Columns:
        // 0: Index
        // 1: Date (dd.MM.yyyy HH:mm:ss)
        // 2: User
        // 3: Payment Type
        // 4: Description
        // 7: Amount (Net)

        const dateStr = cells[1];
        const userStr = cells[2];
        const payTypeStr = cells[3];
        const desc = cells[4];
        const amountStr = cells[7];

        if (!dateStr || !amountStr) continue;

        // Filter by User? The file is named "gülay", so assume all data is hers or relevant.
        // But if there are mixed users, we should check.
        if (!userStr.toLowerCase().includes("gülay")) {
            // console.log(`Skipping non-Gülay row: ${userStr}`);
            // continue; 
            // Actually, if the file is hers, maybe she is the responsible one even if name varies?
            // But usually report has column "Kullanıcı" which is the actor.
        }

        // Parse Date
        const [dPart, tPart] = dateStr.split(' ');
        const [day, month, year] = dPart.split('.');
        const [hour, minute, second] = tPart.split(':');
        const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));

        // Parse Amount
        const cleanAmount = amountStr.replace(/\./g, '').replace(',', '.');
        const val = parseFloat(cleanAmount);

        if (isNaN(val)) continue;

        const type = val < 0 ? 'EXPENSE' : 'INCOME';
        const amount = Math.abs(val);

        // Payment Method
        let paymentMethod: PaymentMethod = PaymentMethod.CASH;
        if (payTypeStr.toLowerCase().includes('kredi') || payTypeStr.toLowerCase().includes('kkart')) {
            paymentMethod = PaymentMethod.CREDIT_CARD;
        }

        // Check Duplicate
        const exists = await prisma.cashTransaction.findFirst({
            where: {
                siteId: site.id,
                date: date,
                amount: amount,
                // userId check?
                description: desc
            }
        });

        if (exists) {
            process.stdout.write('.');
            continue;
        }

        // Insert
        await prisma.cashTransaction.create({
            data: {
                siteId: site.id,
                date: date,
                type: type,
                category: 'Genel',
                amount: amount,
                description: desc,
                paymentMethod: paymentMethod,
                responsibleUserId: user.id,
                createdByUserId: user.id
            }
        });
        process.stdout.write('+');
        count++;
    }
    console.log(`\nImported ${count} transactions.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
