const { PrismaClient } = require('@prisma/client');

async function main() {
    const prisma = new PrismaClient();
    const tank = await prisma.fuelTank.findUnique({
        where: { id: 'cmknxtc9p0001sufe6amae37c' },
        select: { name: true, currentLevel: true }
    });
    console.log('Tank:', tank.name, '| currentLevel:', tank.currentLevel);
    await prisma.$disconnect();
}

main();
