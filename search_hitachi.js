
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const vehicles = await prisma.vehicle.findMany({
        where: {
            OR: [
                { brand: { contains: 'Hitachi', mode: 'insensitive' } },
                { model: { contains: 'Hitachi', mode: 'insensitive' } }
            ]
        },
        select: { id: true, plate: true, brand: true, model: true }
    });
    console.log('Found Hitachis:', vehicles);
}

main().finally(() => prisma.$disconnect());
