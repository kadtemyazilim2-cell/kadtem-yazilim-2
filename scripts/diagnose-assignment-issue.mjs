import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnose() {
    const plates = ['60 BP 844', '60 AEY 683', '60 AFA 401'];
    const aydinSiteId = 'cmkmop5q5000fhgexroggue2m';

    for (const plate of plates) {
        const vehicle = await prisma.vehicle.findFirst({
            where: { plate }
        });

        if (!vehicle) {
            console.log(`\n[${plate}] Bulunamadı.`);
            continue;
        }

        console.log(`\n[${plate}] ID: ${vehicle.id}`);
        console.log(`- assignedSiteId: ${vehicle.assignedSiteId}`);

        const history = await prisma.vehicleAssignmentHistory.findMany({
            where: { vehicleId: vehicle.id }
        });

        console.log(`- Atama Geçmişi (${history.length} adet):`);
        for (const h of history) {
            const site = await prisma.site.findUnique({ where: { id: h.siteId }, select: { name: true } });
            console.log(`  - Şantiye: ${site?.name} (ID: ${h.siteId})`);
            console.log(`    Başlangıç: ${h.startDate?.toISOString()}, Bitiş: ${h.endDate?.toISOString() || 'GÜNCEL'}`);
        }

        // Also check VehicleAssignment table if it exists? 
        // No, based on schema.prisma it's relational.
    }
}

diagnose()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
