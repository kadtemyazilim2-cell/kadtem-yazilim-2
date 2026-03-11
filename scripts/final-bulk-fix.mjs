import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function bulkFix() {
    const vehicles = await prisma.vehicle.findMany({
        include: { assignedSites: { select: { id: true } } }
    });

    let fixedCount = 0;
    for (const v of vehicles) {
        if (v.assignedSiteId) {
            const isAssigned = v.assignedSites.some(s => s.id === v.assignedSiteId);
            if (!isAssigned) {
                console.log(`Fixing ${v.plate}: Clearing assignedSiteId ${v.assignedSiteId} as it's not in assignedSites.`);
                await prisma.vehicle.update({
                    where: { id: v.id },
                    data: { assignedSiteId: null }
                });
                fixedCount++;
            }
        }
    }
    console.log(`\nToplam ${fixedCount} araç düzeltildi.`);
}

bulkFix()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
