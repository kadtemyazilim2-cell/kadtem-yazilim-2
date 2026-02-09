
import { upsertPersonnelAttendance } from '@/actions/personnel';
import { prisma } from '@/lib/db';

async function main() {
    console.log('--- Testing Upsert Action with Empty SiteID ---');

    const person = await prisma.personnel.findFirst({
        where: { status: 'ACTIVE' }
    });

    if (!person) {
        console.error('No personnel found.');
        return;
    }

    console.log(`Testing with Person: ${person.fullName} (ID: ${person.id})`);

    // Mock Authentication Context if needed or ensure action handles it gracefully?
    // The action calls `auth()`, which might fail in script.
    // We might need to mock it or just rely on the fact that we can't easily run server actions requiring auth in standalone scripts without setup.
    // However, let's try calling it. If it fails due to auth, we know at least it reached that point.

    try {
        const res = await upsertPersonnelAttendance(person.id, new Date().toISOString().split('T')[0], {
            status: 'FULL',
            hours: 11,
            siteId: '' // TESTING EMPTY STRING
        });
        console.log('Result:', res);
    } catch (e: any) {
        console.error('Script Error:', e.message);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
