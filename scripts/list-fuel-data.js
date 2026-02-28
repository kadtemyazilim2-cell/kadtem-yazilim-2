const { PrismaClient } = require('@prisma/client');

async function main() {
    const prisma = new PrismaClient();

    try {
        // 1. List all sites and their fuel tanks
        const sites = await prisma.site.findMany({
            select: {
                id: true,
                name: true,
                fuelTanks: {
                    select: {
                        id: true,
                        name: true,
                        currentLevel: true,
                        capacity: true
                    }
                }
            },
            orderBy: { name: 'asc' }
        });

        console.log('=== Sites & Fuel Tanks ===');
        sites.forEach(s => {
            console.log(`\nSite: ${s.name} (ID: ${s.id})`);
            if (s.fuelTanks.length === 0) {
                console.log('  No fuel tanks');
            } else {
                s.fuelTanks.forEach(t => {
                    console.log(`  Tank: ${t.name} | Level: ${t.currentLevel} Lt | Capacity: ${t.capacity} Lt | ID: ${t.id}`);
                });
            }
        });

        // 2. Count fuel records
        const fuelLogCount = await prisma.fuelLog.count();
        const fuelTransferCount = await prisma.fuelTransfer.count();
        console.log(`\n=== Current Fuel Records ===`);
        console.log(`FuelLog: ${fuelLogCount}`);
        console.log(`FuelTransfer: ${fuelTransferCount}`);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
