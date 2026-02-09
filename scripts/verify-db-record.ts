import { prisma } from '../src/lib/db';

async function main() {
    console.log('Verifying Attendance Records...');

    // Fetch last 5 attendance records created
    const recentRecords = await prisma.personnelAttendance.findMany({
        take: 10,
        orderBy: { date: 'desc' },
        include: { personnel: true },
        where: { personnel: { fullName: { contains: 'Alparslan' } } }
    });

    console.log('--- Recent 5 Records ---');
    recentRecords.forEach(r => {
        console.log(`
        ID: ${r.id}
        Person: ${r.personnel.fullName}
        Date: ${r.date.toISOString()}
        Status: ${r.status}
        SiteId: ${r.siteId}
        CreatedBy: ${r.createdByUserId}
        `);
    });


    if (recentRecords.length === 0) {
        console.log('No recent records found.');
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
