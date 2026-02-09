import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Fetching user "can"...');
    const user = await prisma.user.findFirst({
        where: { username: 'can' }
    });

    if (!user) {
        console.error('User not found');
        return;
    }

    console.log('User Role:', user.role);
    console.log('EditLookbackDays:', user.editLookbackDays);

    // Simulation Parameters
    const daysAgo = 10;
    const testDate = new Date();
    testDate.setDate(testDate.getDate() - daysAgo);

    console.log(`Testing with date: ${testDate.toISOString()} (${daysAgo} days ago)`);

    // Logic from transaction.ts
    if (user.role !== 'ADMIN' && user.editLookbackDays !== null && user.editLookbackDays !== undefined) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const target = new Date(testDate);
        target.setHours(0, 0, 0, 0);

        const diffTime = today.getTime() - target.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        console.log(`Logic Result -> DiffDays: ${diffDays}, Allowed: ${user.editLookbackDays}`);

        if (diffDays > user.editLookbackDays) {
            console.log('RESULT: BLOCKED (Correct)');
        } else {
            console.log('RESULT: ALLOWED (Incorrect!)');
        }
    } else {
        console.log('RESULT: ROLE/CONFIG BYPASSED (Incorrect!)');
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
