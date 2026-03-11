import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkMarchAssignments() {
    const aydinSiteId = 'cmkmop5q5000fhgexroggue2m';

    // Find all vehicles currently in Aydın
    const vehicles = await prisma.vehicle.findMany({
        where: {
            OR: [
                { assignedSiteId: aydinSiteId },
                { assignedSites: { some: { id: aydinSiteId } } }
            ]
        },
        include: { assignmentHistory: { where: { siteId: aydinSiteId } } }
    });

    console.log(`Aydın Şantiyesi Araç Atama Durumları (Mart 2026):`);
    for (const v of vehicles) {
        console.log(`\nAraç: ${v.plate} (ID: ${v.id})`);
        if (v.assignmentHistory.length === 0) {
            console.log(`- UYARI: Atama geçmişi BULUNAMADI! (Bu yüzden silik görünüyor olabilir)`);
        } else {
            v.assignmentHistory.forEach(h => {
                console.log(`- Başlangıç: ${h.startDate?.toISOString() || 'Bilinmiyor'}, Bitiş: ${h.endDate?.toISOString() || 'GÜNCEL'}`);
            });
        }
    }
}

checkMarchAssignments()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
