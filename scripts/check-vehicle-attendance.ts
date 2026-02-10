
import { prisma } from '../src/lib/db';

async function main() {
    console.log('Checking Vehicle Attendance Records...');
    const count = await prisma.vehicleAttendance.count();
    console.log(`Total Records: ${count}`);

    const recent = await prisma.vehicleAttendance.findMany({
        take: 5,
        orderBy: { date: 'desc' }
    });

    console.log('Most Recent 5 Records:');
    recent.forEach(r => {
        console.log(`ID: ${r.id}, Vehicle: ${r.vehicleId}, Site: ${r.siteId}, Date: ${r.date}, Status: ${r.status}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
