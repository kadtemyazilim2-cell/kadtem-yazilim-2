
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PLATE = "60 ACN 701";
const MONTH_START = new Date("2026-02-01T00:00:00.000Z");
const MONTH_END = new Date("2026-03-01T00:00:00.000Z");

async function main() {
    const vehicle = await prisma.vehicle.findFirst({
        where: { plate: { contains: PLATE } }
    });

    if (!vehicle) {
        console.error("Vehicle not found!");
        return;
    }

    console.log(`Vehicle: ${vehicle.plate} (${vehicle.id})`);

    const records = await prisma.vehicleAttendance.findMany({
        where: {
            vehicleId: vehicle.id,
            date: {
                gte: MONTH_START,
                lt: MONTH_END
            }
        },
        include: {
            createdByUser: true,
            vehicle: { include: { assignedSite: true } }
        }
    });

    console.log(`Found ${records.length} records for Feb 2026.`);

    for (const r of records) {
        console.log(`Date: ${r.date.toISOString()} | Status: ${r.status} | Created By: ${r.createdByUser?.username || 'System/Null'} | Created At: ${r.id}`);
        console.log(`  Site ID: ${r.siteId}`);
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
