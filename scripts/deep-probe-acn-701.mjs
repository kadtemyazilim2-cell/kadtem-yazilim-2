import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deepProbe() {
    const plate = '60 ACN 701';
    const aydinSiteId = 'cmkmop5q5000fhgexroggue2m';

    const vehicle = await prisma.vehicle.findFirst({
        where: { plate },
        include: {
            assignedSites: true,
            assignmentHistory: { include: { site: true } },
            attendance: { where: { siteId: aydinSiteId } }
        }
    });

    if (!vehicle) {
        console.log('Araç bulunamadı.');
        return;
    }

    console.log(`Araç: ${vehicle.plate} (ID: ${vehicle.id})`);
    console.log(`- assignedSiteId: ${vehicle.assignedSiteId}`);
    console.log(`- assignedSites: ${vehicle.assignedSites.map(s => s.name).join(', ')}`);
    console.log(`- Aydın Atama Geçmişi Sayısı: ${vehicle.assignmentHistory.filter(h => h.siteId === aydinSiteId).length}`);
    console.log(`- Aydın Puantaj Kaydı Sayısı: ${vehicle.attendance.length}`);

    // Check if there is ANY other vehicle with SAME plate but different ID
    const others = await prisma.vehicle.findMany({
        where: { plate: { contains: '701' }, id: { not: vehicle.id } }
    });
    console.log(`- Aynı plakaya benzer diğer araçlar: ${others.length}`);
    others.forEach(o => console.log(`  - ID: ${o.id}, Plate: ${o.plate}`));
}

deepProbe()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
