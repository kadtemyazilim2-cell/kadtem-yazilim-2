import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanAcn701() {
    const plate = '60 ACN 701';
    const aydinSiteId = 'cmkmop5q5000fhgexroggue2m';

    const vehicle = await prisma.vehicle.findFirst({ where: { plate } });
    if (!vehicle) return;

    console.log(`Cleaning erroneous Aydın records for ${plate}...`);
    const result = await prisma.vehicleAttendance.deleteMany({
        where: {
            vehicleId: vehicle.id,
            siteId: aydinSiteId,
            date: { gte: new Date('2026-02-01') }
        }
    });

    console.log(`${result.count} adet hatalı Aydın kaydı silindi.`);
}

cleanAcn701()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
