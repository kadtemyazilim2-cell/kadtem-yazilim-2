
import { prisma } from '@/lib/db';

async function main() {
    console.log('--- Testing Create with Empty SiteID ---');

    const person = await prisma.personnel.findFirst({
        where: { status: 'ACTIVE' }
    });

    if (!person) {
        console.error('No personnel found.');
        return;
    }

    console.log(`Testing with Person: ${person.fullName}`);

    try {
        const res = await prisma.personnelAttendance.create({
            data: {
                personnelId: person.id,
                date: new Date(),
                status: 'FULL',
                hours: 11,
                siteId: '' // TESTING EMPTY STRING
            }
        });
        console.log('SUCCESS: Created with empty siteId', res);
    } catch (e: any) {
        console.error('FAILURE: Could not create with empty siteId');
        console.error(e.message);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
