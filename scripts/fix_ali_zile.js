
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    const userId = 'cml68m2ec0000mxrw4bp5nkso'; // Ali BAŞER
    const targetSiteId = 'cmkmooxq1000jsjtfm8kfo5hp'; // Tokat Zile Ovası 1 Kısım...

    console.log('Starting data fix for User:', userId, '-> Site:', targetSiteId);

    // 1. Check applicable transactions
    // Model name in schema is CashTransaction -> prisma.cashTransaction
    const count = await prisma.cashTransaction.count({
        where: {
            responsibleUserId: userId,
            siteId: null
        }
    });

    console.log(`Found ${count} transactions with no site for this user.`);

    if (count > 0) {
        // 2. Update
        const result = await prisma.cashTransaction.updateMany({
            where: {
                responsibleUserId: userId,
                siteId: null
            },
            data: {
                siteId: targetSiteId
            }
        });

        console.log(`Updated ${result.count} transactions successfully.`);
    } else {
        console.log('No transactions to update.');
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
