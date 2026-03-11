import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixFinal() {
    const aydinSiteId = 'cmkmop5q5000fhgexroggue2m';
    const zileSiteId = 'cmkmooxq1000jsjtfm8kfo5hp';

    const updates = [
        { plate: '60 BP 844', currentSiteId: aydinSiteId },
        { plate: '60 AEY 683', currentSiteId: aydinSiteId },
        { plate: '60 AFA 401', currentSiteId: zileSiteId }
    ];

    for (const u of updates) {
        const vehicle = await prisma.vehicle.findFirst({ where: { plate: u.plate } });
        if (!vehicle) continue;

        console.log(`\n[${u.plate}] Düzenleniyor...`);

        // 1. Ensure the vehicle is connected to the site in the relation
        await prisma.vehicle.update({
            where: { id: vehicle.id },
            data: {
                assignedSiteId: u.currentSiteId,
                assignedSites: {
                    connect: { id: u.currentSiteId }
                }
            }
        });
        console.log(`- Şantiye ataması (assignedSiteId ve Relation) güncellendi.`);

        // 2. Clear any endDate for this site in history or create new history
        const existingHistory = await prisma.vehicleAssignmentHistory.findFirst({
            where: { vehicleId: vehicle.id, siteId: u.currentSiteId },
            orderBy: { startDate: 'desc' }
        });

        if (existingHistory) {
            await prisma.vehicleAssignmentHistory.update({
                where: { id: existingHistory.id },
                data: { endDate: null }
            });
            console.log(`- Mevcut atama geçmişi açık hale getirildi (endDate: NULL).`);
        } else {
            await prisma.vehicleAssignmentHistory.create({
                data: {
                    vehicleId: vehicle.id,
                    siteId: u.currentSiteId,
                    startDate: new Date('2025-01-01T00:00:00Z'),
                    endDate: null
                }
            });
            console.log(`- Yeni açık atama geçmişi oluşturuldu.`);
        }
    }
}

fixFinal()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
