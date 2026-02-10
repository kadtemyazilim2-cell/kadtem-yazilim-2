import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- CHECKING RECENT WRITES (V2) ---');

    const now = new Date();
    // Start of TODAY (UTC) - robust enough for checking recent activity
    const startOfDay = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0));
    const endOfDay = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59));

    console.log(`Checking for records with DATE between: ${startOfDay.toISOString()} and ${endOfDay.toISOString()}`);

    // 2. Query by DATE since createdAt is missing
    const recentRecords = await prisma.vehicleAttendance.findMany({
        where: {
            date: {
                gte: startOfDay,
                lte: endOfDay
            }
        },
        // orderBy: { date: 'desc' }, // Optional
    });

    console.log(`Found ${recentRecords.length} records for TODAY.`);

    if (recentRecords.length > 0) {
        recentRecords.forEach(r => {
            console.log(`ID: ${r.id} | Vehicle: ${r.vehicleId} | Date: ${r.date.toISOString()} | Status: ${r.status} | Site: ${r.siteId} | Note: ${r.note}`);
        });
    } else {
        console.log('❌ No records found for TODAY. The Server Action likely failed to write.');
    }

    // Check for "test" note we might have added manually or via script
    const testRecord = await prisma.vehicleAttendance.findFirst({
        where: { note: { contains: 'TEST' } }
    });
    if (testRecord) {
        console.log('ℹ️ Found a record with note containing TEST:', testRecord);
    }

    console.log('--- END ---');
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
