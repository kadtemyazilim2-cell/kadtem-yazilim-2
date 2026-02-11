
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const v = await prisma.vehicle.findFirst({
        select: {
            id: true,
            insuranceHistory: true
        }
    });
    console.log('Vehicle:', v);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
