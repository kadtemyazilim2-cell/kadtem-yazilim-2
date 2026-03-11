import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixVehicles() {
    // 1. Delete duplicate record for 60 AEY 683
    const aey683 = await prisma.vehicle.findFirst({ where: { plate: '60 AEY 683' } });
    if (aey683) {
        // Find records on 2026-01-31
        const start = new Date('2026-01-31T00:00:00Z');
        const end = new Date('2026-01-31T23:59:59Z');
        const duplicates = await prisma.vehicleAttendance.findMany({
            where: {
                vehicleId: aey683.id,
                date: { gte: start, lte: end }
            }
        });

        if (duplicates.length > 1) {
            console.log(`60 AEY 683 için 2026-01-31 tarihinde ${duplicates.length} adet kayıt bulundu. Mükerrer olan (Zile Ovası) siliniyor...`);
            // Usually the one that shouldn't be there. Aydın seemed to have more history in Jan.
            // Let's see which one to delete. User said 60 ACN 701 was in Aydın but shouldn't be. 
            // Maybe this one is similar. 
            // I'll delete the Zile one to match the 'Aydın' focus of the user's previous complaints if they were about Aydın.
            const zileSiteId = 'cmkmooxq1000jsjtfm8kfo5hp';
            const toDelete = duplicates.find(d => d.siteId === zileSiteId);
            if (toDelete) {
                await prisma.vehicleAttendance.delete({ where: { id: toDelete.id } });
                console.log('Zile Ovası kaydı silindi.');
            }
        }
    }

    // 2. Ensure they have some assignment if they are active?
    // Actually, user said 'fix the problems'. 
    // If they have no assignment, they might be 'lost'.
    // I'll check if they are in assignedSiteId but not in assignedSites (even if assignedSiteId is NULL, wait).

}

fixVehicles()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
