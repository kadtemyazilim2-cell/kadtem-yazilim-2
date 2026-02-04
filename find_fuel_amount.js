
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const TARGET_AMOUNT = 3331.6;
    console.log(`--- SEARCHING FOR FUEL TRANSACTIONS WITH AMOUNT ~${TARGET_AMOUNT} ---`);

    // 1. Search Fuel Logs
    // Allow slight tolerance for float comparison
    const tolerance = 0.5;

    const fuelLogs = await prisma.fuelLog.findMany({
        where: {
            liters: {
                gte: TARGET_AMOUNT - tolerance,
                lte: TARGET_AMOUNT + tolerance
            }
        },
        include: {
            vehicle: true,
            site: true,
            tank: true
        }
    });

    console.log(`\n--- FUEL LOGS FOUND (${fuelLogs.length}) ---`);
    fuelLogs.forEach(l => {
        console.log(`ID: ${l.id} | Date: ${l.date.toISOString().split('T')[0]} | Liters: ${l.liters} | Vehicle: ${l.vehicle?.plate} | Site: ${l.site?.name}`);
    });


    // 2. Search Fuel Transfers
    const transfers = await prisma.fuelTransfer.findMany({
        where: {
            amount: {
                gte: TARGET_AMOUNT - tolerance,
                lte: TARGET_AMOUNT + tolerance
            }
        }
    });

    console.log(`\n--- FUEL TRANSFERS FOUND (${transfers.length}) ---`);
    transfers.forEach(t => {
        console.log(`ID: ${t.id} | Date: ${t.date.toISOString().split('T')[0]} | Amount: ${t.amount} | Desc: ${t.description} | From: ${t.fromType} | To: ${t.toType}`);
    });

    if (fuelLogs.length === 0 && transfers.length === 0) {
        console.log('\n❌ No exact match found. Trying broader search (3300-3400)...');
        const broaderLogs = await prisma.fuelLog.findMany({
            where: {
                liters: {
                    gte: 3300,
                    lte: 3400
                }
            },
            include: { vehicle: true, site: true }
        });
        broaderLogs.forEach(l => {
            console.log(`(Broader) Log: ${l.liters}L | ${l.vehicle?.plate} | ${l.site?.name}`);
        });
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
