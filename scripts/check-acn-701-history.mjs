import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkHistory() {
    const plate = '60 ACN 701';
    const aydinSiteId = 'cmkmop5q5000fhgexroggue2m';

    const vehicle = await prisma.vehicle.findFirst({ where: { plate } });
    if (!vehicle) return;

    const history = await prisma.vehicleAssignmentHistory.findMany({
        where: {
            vehicleId: vehicle.id,
            siteId: aydinSiteId
        }
    });

    console.log(`60 ACN 701 - Aydın Atama Geçmişi (${history.length} adet):`);
    history.forEach(h => {
        console.log(`- Başlangıç: ${h.startDate?.toISOString()}, Bitiş: ${h.endDate?.toISOString() || 'GÜNCEL'}`);
    });
}

checkHistory()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
