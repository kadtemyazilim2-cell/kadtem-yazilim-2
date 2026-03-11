import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkStatus() {
    const plates = ['60 ACN 701', '60 AEY 683', '60 AFA 401', '60 BP 844'];
    const aydinSiteId = 'cmkmop5q5000fhgexroggue2m';

    for (const plate of plates) {
        const vehicle = await prisma.vehicle.findFirst({
            where: { plate },
            include: { assignedSites: { select: { id: true, name: true } } }
        });

        if (!vehicle) {
            console.log(`\n[${plate}] Bulunamadı.`);
            continue;
        }

        console.log(`\n[${plate}]`);
        console.log(`- Atanmış Şantiyeler: ${vehicle.assignedSites.map(s => s.name).join(', ') || 'HİÇBİRİ'}`);
        console.log(`- assignedSiteId (Eski): ${vehicle.assignedSiteId || 'NULL'}`);

        // Check for records in Aydın for Feb/Mar 2026
        const aydinRecords = await prisma.vehicleAttendance.findMany({
            where: {
                vehicleId: vehicle.id,
                siteId: aydinSiteId,
                date: {
                    gte: new Date('2026-02-01')
                }
            }
        });
        console.log(`- Aydın Şantiyesindeki Şubat/Mart 2026 Kayıt Sayısı: ${aydinRecords.length}`);
    }
}

checkStatus()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
