const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Find all tanks
    const tanks = await prisma.fuelTank.findMany({
        select: { id: true, name: true, siteId: true, currentLevel: true }
    });
    console.log('All tanks:', JSON.stringify(tanks, null, 2));

    // Find tanks named "Ana Tank" (case-insensitive)
    const anaTanks = tanks.filter(t => t.name.toLowerCase().includes('ana tank'));
    console.log('\nAna Tank records:', JSON.stringify(anaTanks, null, 2));

    if (anaTanks.length === 0) {
        console.log('No "Ana Tank" records found.');
        return;
    }

    for (const tank of anaTanks) {
        // Check if it has any related fuel logs or transfers
        const logsCount = await prisma.fuelLog.count({ where: { tankId: tank.id } });
        const transfersFrom = await prisma.fuelTransfer.count({ where: { fromId: tank.id } });
        const transfersTo = await prisma.fuelTransfer.count({ where: { toId: tank.id } });

        console.log(`\nTank "${tank.name}" (${tank.id}):`);
        console.log(`  Fuel logs: ${logsCount}`);
        console.log(`  Transfers from: ${transfersFrom}`);
        console.log(`  Transfers to: ${transfersTo}`);

        // Delete the tank
        await prisma.fuelTank.delete({ where: { id: tank.id } });
        console.log(`  -> DELETED`);
    }

    console.log('\nDone!');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
