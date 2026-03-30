const { PrismaClient } = require('@prisma/client');

async function main() {
    const prisma = new PrismaClient();
    try {
        const tanks = await prisma.fuelTank.findMany({
            where: {
                OR: [
                    { name: { contains: 'Vezirköprü' } },
                    { name: { contains: 'Aydın' } },
                    { name: { contains: 'Yenipazar' } }
                ]
            },
            select: { id: true, name: true, currentLevel: true }
        });
        console.log(JSON.stringify(tanks, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
