
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const userId = 'cml68m2ec0000mxrw4bp5nkso'; // Ali BAŞER

    console.log('Checking transactions for:', userId);

    const transactions = await prisma.cashTransaction.findMany({
        where: {
            responsibleUserId: userId
        },
        select: {
            id: true,
            siteId: true,
            description: true,
            amount: true,
            date: true
        }
    });

    console.log(`Found ${transactions.length} transactions.`);
    console.log(JSON.stringify(transactions, null, 2));

    // Also check Company / Sites
    const sites = await prisma.site.findMany({ select: { id: true, name: true } });
    console.log('Sites:', sites);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
