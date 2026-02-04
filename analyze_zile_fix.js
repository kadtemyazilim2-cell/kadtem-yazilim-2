
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const htmlPath = 'C:\\Users\\Drone\\Desktop\\benzer iş grupları\\yakıt zile\\zile yakıt.html';
    const content = fs.readFileSync(htmlPath, 'utf-8');
    const lines = content.split('\n');

    console.log('--- EXTRACTING "Fiat Hitachi 200.3" LOGS FROM HTML ---');
    const htmlLogs = [];

    // Previous logic to extract amounts
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('Fiat Hitachi 200.3')) {
            let dataLine = null;
            for (let j = 1; j < 10; j++) {
                if (lines[i + j] && lines[i + j].includes('<td align="right">')) {
                    dataLine = lines[i + j];
                    break;
                }
            }
            if (dataLine) {
                const matches = dataLine.match(/<td align="right">.*?<\/td><td align="right">([-0-9.,]+)<\/td>/);
                if (matches && matches[1]) {
                    const amountStr = matches[1].replace('.', '').replace(',', '.');
                    const amount = Math.abs(parseFloat(amountStr));
                    htmlLogs.push(amount);
                }
            }
        }
    }

    const totalHtmlCurrent = htmlLogs.reduce((a, b) => a + b, 0);
    console.log(`Total Found in HTML for 'Fiat Hitachi 200.3': ${totalHtmlCurrent.toFixed(2)} Liters`);

    console.log('\n--- CHECKING DB ---');
    const vehicles = await prisma.vehicle.findMany({
        where: {
            OR: [
                { plate: { contains: '200.3' } },
                { plate: { contains: 'Hitachi' } },
                { plate: { contains: '06 DGG 821' } }, // 2025 T
                { plate: { contains: '34-00-25-5586' } }
            ]
        }
    });

    const vehicleIds = vehicles.map(v => v.id);
    const dbLogs = await prisma.fuelLog.findMany({
        where: { vehicleId: { in: vehicleIds } },
        include: { vehicle: true }
    });

    const totalDB = dbLogs.reduce((a, b) => a + b.liters, 0);
    console.log(`Total in DB for matching vehicles: ${totalDB.toFixed(2)} Liters`);
    console.log(`Difference (DB - HTML): ${(totalDB - totalHtmlCurrent).toFixed(2)} Liters`);

    console.log('\n--- CROSS-VEHICLE DATE CHECK ---');
    // Group by Date
    const logsByDate = {};
    dbLogs.forEach(l => {
        const dateKey = l.date.toISOString().split('T')[0];
        if (!logsByDate[dateKey]) logsByDate[dateKey] = [];
        logsByDate[dateKey].push(l);
    });

    const duplicates = [];
    Object.keys(logsByDate).forEach(date => {
        const logs = logsByDate[date];
        if (logs.length > 1) {
            // Check if we have different vehicles on the same day
            const plates = [...new Set(logs.map(l => l.vehicle.plate))];
            if (plates.length > 1) {
                console.log(`⚠️ CROSS-VEHICLE DUPLICATE DATE: ${date}`);
                logs.forEach(l => console.log(`   - ${l.liters}L | ${l.vehicle.plate} (ID: ${l.id})`));
                duplicates.push(...logs);
            }
        }
    });

    if (duplicates.length === 0) {
        console.log('No cross-vehicle date duplicates found.');
    } else {
        console.log(`\nFound ${duplicates.length} potentially conflicting logs.`);
    }

}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
