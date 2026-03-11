import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAcn701() {
    const vehicle = await prisma.vehicle.findFirst({ where: { plate: '60 ACN 701' } });
    if (!vehicle) return;

    const records = await prisma.vehicleAttendance.findMany({
        where: { vehicleId: vehicle.id },
        orderBy: { date: 'asc' }
    });

    console.log(`60 ACN 701 Attendance:`);
    for (const r of records) {
        const site = await prisma.site.findUnique({ where: { id: r.siteId }, select: { name: true } });
        console.log(`- Date: ${r.date.toISOString()}, Site: ${site?.name}, Note: ${r.note}`);
    }
}

checkAcn701()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
