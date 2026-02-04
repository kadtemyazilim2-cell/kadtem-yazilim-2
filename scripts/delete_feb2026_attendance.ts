
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MONTH_START = new Date("2026-02-01T00:00:00.000Z");
const MONTH_END = new Date("2026-03-01T00:00:00.000Z");
const PLATE = "60 ACN 701";

async function main() {
    console.log(`Deleting Vehicle Attendance for ${PLATE} in Feb 2026...`);

    const vehicle = await prisma.vehicle.findFirst({
        where: { plate: { contains: PLATE } }
    });

    if (!vehicle) {
        console.error("Vehicle not found!");
        return;
    }

    const { count } = await prisma.vehicleAttendance.deleteMany({
        where: {
            vehicleId: vehicle.id,
            date: {
                gte: MONTH_START,
                lt: MONTH_END
            }
        }
    });

    console.log(`Deleted ${count} records.`);
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
