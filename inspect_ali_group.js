
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const userId = 'cml68m2ec0000mxrw4bp5nkso'; // Ali BAŞER

    const transactions = await prisma.cashTransaction.groupBy({
        by: ['siteId'],
        where: {
            responsibleUserId: userId
        },
        _count: {
            id: true
        }
    });

    console.log('Grouped Transactions:', transactions);

    for (const t of transactions) {
        const site = await prisma.site.findUnique({ where: { id: t.siteId } });
        console.log(`Site: ${site ? site.name : 'Unknown'} (${t.siteId}) - Count: ${t._count.id}`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
