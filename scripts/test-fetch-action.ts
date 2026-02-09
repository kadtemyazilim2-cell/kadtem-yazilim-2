
import { getPersonnelWithAttendance } from '@/actions/personnel';
import { prisma } from '@/lib/db';

async function main() {
    console.log('--- Testing Fetch Action ---');

    const person = await prisma.personnel.findFirst({
        where: { status: 'ACTIVE' },
        include: { attendance: { orderBy: { date: 'desc' }, take: 1 } }
    });

    if (!person) {
        console.error('No personnel found.');
        return;
    }

    console.log(`Testing with Person: ${person.fullName} (ID: ${person.id})`);
    if (person.attendance.length > 0) {
        console.log(`Last Attendance in DB: Date=${person.attendance[0].date.toISOString()}, Site=${person.attendance[0].siteId}`);
    } else {
        console.log('No attendance records found for this person.');
    }

    const today = new Date(); // Use today as reference
    // Fetch for this month

    // Test with 'all' sites
    console.log('\n--- Fetching for ALL sites ---');
    try {
        const res = await getPersonnelWithAttendance(today, 'all');
        if (res.success && res.data) {
            const p = res.data.find((x: any) => x.id === person.id);
            if (p) {
                console.log(`Found person in result. Attendance count: ${p.attendance.length}`);
                p.attendance.forEach((a: any) => {
                    console.log(` - Date: ${a.date}, Status: ${a.status}, Site: ${a.siteId}`);
                });
            } else {
                console.log('Person NOT found in result.');
            }
        } else {
            console.error('Fetch failed:', res.error);
        }
    } catch (e: any) {
        console.error('Script Error (All):', e.message);
    }

    // Test with specific site if person has one
    if (person.siteId) {
        console.log(`\n--- Fetching for Site: ${person.siteId} ---`);
        try {
            const res = await getPersonnelWithAttendance(today, person.siteId);
            if (res.success && res.data) {
                const p = res.data.find((x: any) => x.id === person.id);
                if (p) {
                    console.log(`Found person in result. Attendance count: ${p.attendance.length}`);
                } else {
                    console.log('Person NOT found in result.');
                }
            }
        } catch (e: any) {
            console.error('Script Error (Site):', e.message);
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
