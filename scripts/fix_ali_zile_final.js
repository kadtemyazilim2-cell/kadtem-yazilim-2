
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const userId = 'cml68m2ec0000mxrw4bp5nkso'; // Ali BAŞER
    const wrongSiteId = 'cmkmop3t8000bhgexg0eg90pe'; // (Alt Yüklenici)
    const targetSiteId = 'cmkmooxq1000jsjtfm8kfo5hp'; // (Main Zile 1)

    console.log('Moving transactions from Wrong Site:', wrongSiteId, '-> Target:', targetSiteId);

    const result = await prisma.cashTransaction.updateMany({
        where: {
            responsibleUserId: userId,
            siteId: wrongSiteId
        },
        data: {
            siteId: targetSiteId
        }
    });

    console.log(`Moved ${result.count} transactions successfully.`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
