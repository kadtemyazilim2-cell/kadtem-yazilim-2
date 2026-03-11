import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fixAndCheck() {
    try {
        const plate = '60 ACN 701';

        // 1. Fix the reported vehicle
        const v = await prisma.vehicle.findUnique({
            where: { plate },
            include: { assignedSites: true }
        });

        if (v) {
            console.log(`Düzeltiliyor: ${plate}`);
            console.log(`Mevcut assignedSiteId: ${v.assignedSiteId}`);
            console.log(`Mevcut assignedSites:`, v.assignedSites.map(s => s.name));

            // Clear the stale assignedSiteId since it's confirmed wrong by the user
            // and the vehicle is correctly assigned to Bilecik in the plural relation.
            await prisma.vehicle.update({
                where: { id: v.id },
                data: { assignedSiteId: null }
            });
            console.log(`${plate} için assignedSiteId temizlendi.`);
        }

        // 2. Report other potential issues (Optional but helpful)
        console.log('\n--- Diğer Potansiyel Tutarsızlıklar (assignedSiteId != assignedSites) ---');
        const allVehicles = await prisma.vehicle.findMany({
            where: { status: 'ACTIVE' },
            include: { assignedSites: true }
        });

        for (const vehicle of allVehicles) {
            if (vehicle.assignedSiteId) {
                const isInPlural = vehicle.assignedSites.some(s => s.id === vehicle.assignedSiteId);
                if (!isInPlural) {
                    const site = await prisma.site.findUnique({ where: { id: vehicle.assignedSiteId } });
                    console.log(`Uyarı: ${vehicle.plate} | Birincil: ${site?.name} | Çoğul listesinde BU ŞANTİYE YOK.`);
                }
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

fixAndCheck();
