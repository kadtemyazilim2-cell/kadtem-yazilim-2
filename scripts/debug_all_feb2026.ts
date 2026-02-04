
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MONTH_START = new Date("2026-02-01T00:00:00.000Z");
const MONTH_END = new Date("2026-03-01T00:00:00.000Z");

async function main() {
    console.log(`Checking Vehicle Attendance for Feb 2026...`);

    const records = await prisma.vehicleAttendance.findMany({
        where: {
            date: {
                gte: MONTH_START,
                lt: MONTH_END
            }
        },
        include: {
            vehicle: { select: { plate: true } },
            createdByUser: { select: { username: true } }
        }
    });

    console.log(`Found ${records.length} records.`);

    // Fetch site names for IDs found
    const siteIds = [...new Set(records.map(r => r.siteId))];
    const sites = await prisma.site.findMany({
        where: { id: { in: siteIds } },
        select: { id: true, name: true }
    });
    const siteMap = Object.fromEntries(sites.map(s => [s.id, s.name]));

    const bySite: Record<string, number> = {};
    const byVehicle: Record<string, number> = {};

    for (const r of records) {
        const siteName = siteMap[r.siteId] || r.siteId;
        bySite[siteName] = (bySite[siteName] || 0) + 1;

        const vehicle = r.vehicle.plate;
        byVehicle[vehicle] = (byVehicle[vehicle] || 0) + 1;
    }

    console.log("\nSummary by Site:");
    console.table(bySite);

    console.log("\nSummary by Vehicle (Top 10):");
    console.table(byVehicle);

}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
