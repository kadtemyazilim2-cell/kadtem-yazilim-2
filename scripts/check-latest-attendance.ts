import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking latest VehicleAttendance records...');

    const records = await prisma.vehicleAttendance.findMany({
        take: 20,
        orderBy: {
            date: 'desc',
        }
    });

    console.log(`Found ${records.length} records.`);
    records.forEach((r: any) => {
        // Accessing potentially missing relations safely or just raw IDs
        // Since we didn't include relations, we only have scalars.
        console.log(`[${r.id}] VehicleId: ${r.vehicleId}, SiteId: ${r.siteId}, Date: ${r.date.toISOString()}, Status: ${r.status}, CreatedBy: ${r.createdByUserId}`);
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
