import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAydinRecords() {
    const aydinSiteId = 'cmkmop5q5000fhgexroggue2m';
    const plates = ['60 AEY 683', '60 AFA 401'];

    for (const plate of plates) {
        const vehicle = await prisma.vehicle.findFirst({ where: { plate } });
        if (!vehicle) continue;

        const records = await prisma.vehicleAttendance.findMany({
            where: {
                vehicleId: vehicle.id,
                siteId: aydinSiteId
            },
            orderBy: { date: 'desc' }
        });

        console.log(`\n[${plate}] Aydın Nazilli Şantiyesindeki Kayıt Sayısı: ${records.length}`);
        records.forEach(r => {
            console.log(`- Tarih: ${r.date.toISOString().split('T')[0]}, Durum: ${r.status}`);
        });
    }
}

checkAydinRecords()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
