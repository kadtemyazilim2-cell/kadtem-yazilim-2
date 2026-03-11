import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAcn701All() {
    const plate = '60 ACN 701';
    const aydinSiteId = 'cmkmop5q5000fhgexroggue2m';

    const vehicle = await prisma.vehicle.findFirst({ where: { plate } });
    if (!vehicle) return;

    const allAydinRecords = await prisma.vehicleAttendance.findMany({
        where: {
            vehicleId: vehicle.id,
            siteId: aydinSiteId
        },
        orderBy: { date: 'desc' }
    });

    console.log(`60 ACN 701 - Aydın Nazilli Şantiyesindeki TÜM Kayıtlar (${allAydinRecords.length} adet):`);
    allAydinRecords.forEach(r => {
        console.log(`- Tarih: ${r.date.toISOString().split('T')[0]}, Durum: ${r.status}`);
    });
}

checkAcn701All()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
