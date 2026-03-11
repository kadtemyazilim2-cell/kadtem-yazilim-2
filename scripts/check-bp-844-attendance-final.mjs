import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkBP844() {
    const vehicle = await prisma.vehicle.findFirst({ where: { plate: { contains: '844' } } });
    if (!vehicle) {
        console.log('Vehicle not found');
        return;
    }

    console.log(`Vehicle: ${vehicle.plate} (ID: ${vehicle.id})`);
    const attendance = await prisma.vehicleAttendance.findMany({
        where: { vehicleId: vehicle.id },
        orderBy: { date: 'asc' }
    });

    for (const a of attendance) {
        console.log(`- Date: ${a.date.toISOString()} | DayPart: ${a.date.toISOString().split('T')[0]} | SiteId: ${a.siteId}`);
    }
}

checkBP844()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
