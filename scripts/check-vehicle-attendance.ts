
import { prisma } from '../src/lib/db';

async function main() {
    console.log('Checking Vehicle Attendance Records for Feb 2026...');

    // Date range strict check
    const start = new Date('2026-02-01T00:00:00Z');
    const end = new Date('2026-03-01T00:00:00Z');

    const count = await prisma.vehicleAttendance.count({
        where: {
            date: {
                gte: start,
                lt: end
            }
        }
    });
    console.log(`Total Records (Feb 2026): ${count}`);

    const records = await prisma.vehicleAttendance.findMany({
        where: {
            date: {
                gte: start,
                lt: end
            }
        },
        take: 10,
        orderBy: { date: 'desc' }
    });

    console.log('Records:');
    records.forEach(r => {
        console.log(`ID: ${r.id}, Vehicle: ${r.vehicleId}, Site: ${r.siteId}, Date: ${r.date.toISOString()}, Status: ${r.status}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
