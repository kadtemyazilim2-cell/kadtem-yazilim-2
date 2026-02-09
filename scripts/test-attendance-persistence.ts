
import { upsertPersonnelAttendance, getPersonnelWithAttendance } from '@/actions/personnel';
import { prisma } from '@/lib/db';

async function main() {
    console.log('--- Starting Attendance Persistence Test ---');

    // 1. Get a test personnel
    const person = await prisma.personnel.findFirst({
        where: { status: 'ACTIVE' }
    });

    if (!person) {
        console.error('No active personnel found to test.');
        return;
    }

    console.log(`Testing with Person: ${person.fullName} (${person.id})`);

    // 2. Define a test date (String format as Client sends it)
    const testDateStr = '2026-02-09';
    console.log(`Test Date: ${testDateStr}`);

    // 3. Upsert Attendance (Save)
    console.log('\n--- Saving Attendance ---');
    const saveRes = await upsertPersonnelAttendance(person.id, testDateStr, {
        status: 'FULL',
        hours: 11,
        note: 'Test Persistence',
        siteId: person.siteId || ''
    });

    if (!saveRes.success) {
        console.error('Save Failed:', saveRes.error);
        return;
    }
    console.log('Save Successful.');

    // 4. Read Attendance (Fetch)
    // Client sends '2026-02-09T...' as Date object usually, but let's simulate what page sends.
    // page.tsx sends 'date' state. 
    // If user is viewing Feb 2026.
    const viewDate = new Date('2026-02-09T10:00:00'); // Mid-day local
    console.log(`\n--- Reading Attendance for View Date: ${viewDate.toISOString()} ---`);

    const readRes = await getPersonnelWithAttendance(viewDate, person.siteId || undefined);

    if (!readRes.success || !readRes.data) {
        console.error('Read Failed:', readRes.error);
        return;
    }

    // 5. Verify
    const targetPerson = readRes.data.find(p => p.id === person.id);
    if (!targetPerson) {
        console.error('Target person not found in result.');
        return;
    }

    // Check attendance array
    console.log(`Attendance Records Found: ${targetPerson.attendance.length}`);
    targetPerson.attendance.forEach(a => {
        console.log(` - Date: ${a.date.toISOString()}, Status: ${a.status}, CreatedAt: ${a.createdAt}`);
    });

    // Check if our test date exists
    // We expect 2026-02-09T00:00:00.000Z
    const match = targetPerson.attendance.find(a => a.date.toISOString() === '2026-02-09T00:00:00.000Z');
    if (match) {
        console.log('\nSUCCESS: Record persisted and retrieved correctly!');
    } else {
        console.error('\nFAILURE: Record NOT found in retrieval.');
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
