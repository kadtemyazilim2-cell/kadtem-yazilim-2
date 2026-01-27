
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const transferCount = await prisma.fuelTransfer.count();
    const logCount = await prisma.fuelLog.count();
    const tankCount = await prisma.fuelTank.count();

    console.log(`FuelTransfer Count: ${transferCount}`);
    console.log(`FuelLog Count: ${logCount}`);
    console.log(`FuelTank Count: ${tankCount}`);

    const purchases = await prisma.fuelTransfer.findMany({
        where: { fromType: 'EXTERNAL' },
        take: 5
    });
    console.log('Sample Purchases:', purchases);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
