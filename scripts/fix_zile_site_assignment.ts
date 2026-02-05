
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function moveZileLogs() {
    const sourceSiteId = 'cmkmootaw0007sjtfz9o7c3j4'; // The one with 29 logs (Inactive)
    const targetSiteId = 'cmkmooxq1000jsjtfm8kfo5hp'; // The one with 322 logs (Active - "Tokat Zile Ovası 1 Kısım...")
    const vehicleId = 'v_ik_4'; // 34-00-24-7675

    // Verify constraints
    const sourceSite = await prisma.site.findUnique({ where: { id: sourceSiteId } });
    const targetSite = await prisma.site.findUnique({ where: { id: targetSiteId } });

    if (!sourceSite || !targetSite) {
        console.error("Source or Target site not found!");
        return;
    }

    console.log(`Moving logs FROM: ${sourceSite.name} (${sourceSite.id})`);
    console.log(`TO: ${targetSite.name} (${targetSite.id})`);

    // Update Logs
    // We specifically target the logs we just imported, or generally logs for this vehicle at the wrong site.
    // Given the previous step identified 29 logs at the source, and we know they are the ones, we can move all logs for this vehicle at this source site.

    const result = await prisma.fuelLog.updateMany({
        where: {
            vehicleId: vehicleId,
            siteId: sourceSiteId
        },
        data: {
            siteId: targetSiteId
        }
    });

    console.log(`Moved ${result.count} fuel logs.`);

    // Check availability after move
    const newCount = await prisma.fuelLog.count({
        where: {
            vehicleId: vehicleId,
            siteId: targetSiteId
        }
    });
    console.log(`New Log Count at Target Site: ${newCount}`);
}

moveZileLogs()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
