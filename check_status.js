
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const statuses = await prisma.vehicleAttendance.groupBy({
        by: ['status'],
        _count: { id: true }
    });
    console.log('Existing Statuses:', statuses);
}

main().finally(() => prisma.$disconnect());
