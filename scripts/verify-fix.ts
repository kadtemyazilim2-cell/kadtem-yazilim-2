
import { upsertPersonnelAttendance, getPersonnelWithAttendance, addPersonnelToSite, removePersonnelFromSite } from '@/actions/personnel';
import { prisma } from '@/lib/db';

async function main() {
    console.log('--- Comprehensive Verification ---');

    // 1. Setup Data
    console.log('1. Setting up Test Data...');

    // Find or Create a Test Site
    let site = await prisma.site.findFirst({ where: { name: 'TEST_SITE_A' } });
    if (!site) {
        site = await prisma.site.create({
            data: { name: 'TEST_SITE_A', companyId: (await prisma.company.findFirst())?.id || 'error' }
        });
    }
    console.log(`   Site: ${site.name} (${site.id})`);

    // Find or Create a Test Person (No Primary Site)
    let person = await prisma.personnel.findFirst({ where: { fullName: 'TEST_PERSON_NO_SITE' } });
    if (!person) {
        person = await prisma.personnel.create({
            data: { fullName: 'TEST_PERSON_NO_SITE', role: 'Worker', category: 'FIELD', status: 'ACTIVE' }
        });
    } else {
        // Ensure no primary site
        await prisma.personnel.update({ where: { id: person.id }, data: { siteId: null } });
    }
    console.log(`   Person: ${person.fullName} (${person.id})`);

    // Assign Person to Site
    await addPersonnelToSite([person.id], site.id);
    console.log('   Assigned person to site.');

    // 2. Test Upsert with Empty SiteID
    console.log('\n2. Testing Upsert (Empty siteId)...');
    const dateStr = new Date().toISOString().split('T')[0]; // Today
    const res = await upsertPersonnelAttendance(person.id, dateStr, {
        status: 'FULL',
        hours: 11,
        siteId: '' // EMPTY!
    });

    if (res.success) {
        console.log('   Upsert SUCCESS.');
    } else {
        console.error('   Upsert FAILED:', res.error);
        return;
    }

    // 3. Verify DB Content
    console.log('\n3. Verifying DB Content...');
    const record = await prisma.personnelAttendance.findFirst({
        where: { personnelId: person.id, date: new Date(new Date().setUTCHours(0, 0, 0, 0)) } // Approx check
    });

    if (record) {
        console.log(`   DB Record Found: Status=${record.status}, SiteId=${record.siteId}`);
        if (record.siteId === site.id) {
            console.log('   [PASS] Record saved with correct Site ID.');
        } else {
            console.error(`   [FAIL] Record saved with WRONG Site ID: ${record.siteId} (Expected ${site.id})`);
        }
    } else {
        console.error('   [FAIL] No DB Record found (ignoring timezone fuzziness for a moment, assuming UTC match)');
        // Let's print all for this person to be sure
        const all = await prisma.personnelAttendance.findMany({ where: { personnelId: person.id } });
        console.log('   All Records:', all);
    }

    // 4. Test Fetching (Backend Filter)
    console.log(`\n4. Testing Fetch for Site: ${site.name}...`);
    const fetchRes = await getPersonnelWithAttendance(new Date(), site.id);
    if (fetchRes.success && fetchRes.data) {
        const p = fetchRes.data.find(x => x.id === person!.id);
        if (p) {
            console.log('   [PASS] Person found in fetch result.');
            if (p.attendance.length > 0) {
                console.log(`   [PASS] Attendance attached: ${p.attendance.length} items.`);
            } else {
                console.error('   [FAIL] Person found but Attendance MISSING in fetch result.');
            }
        } else {
            console.error('   [FAIL] Person NOT found in fetch result for this site.');
        }
    } else {
        console.error('   Fetch Failed:', fetchRes.error);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
