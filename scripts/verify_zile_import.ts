
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function countZileLogs() {
    // Find Target Site
    const site = await prisma.site.findFirst({
        where: { name: { contains: 'Tokat Zile' } }
    });

    if (!site) {
        console.error("Site not found!");
        return;
    }

    // Find Target Vehicle
    const vehicle = await prisma.vehicle.findFirst({
        where: { plate: { contains: '7675' } }
    });

    if (!vehicle) {
        console.error("Vehicle not found!");
        return;
    }

    // Count Logs
    const count = await prisma.fuelLog.count({
        where: {
            vehicleId: vehicle.id,
            siteId: site.id,
            description: { contains: 'İçe Aktarım' } // Ensure we count only what we imported if we used this Description
        }
    });

    console.log(`Total Imported Logs: ${count}`);

    // Also list date range
    const first = await prisma.fuelLog.findFirst({
        where: { vehicleId: vehicle.id, siteId: site.id, description: { contains: 'İçe Aktarım' } },
        orderBy: { date: 'asc' }
    });
    const last = await prisma.fuelLog.findFirst({
        where: { vehicleId: vehicle.id, siteId: site.id, description: { contains: 'İçe Aktarım' } },
        orderBy: { date: 'desc' }
    });

    if (first && last) {
        console.log(`Date Range: ${first.date.toISOString()} - ${last.date.toISOString()}`);
    }
}

countZileLogs()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
