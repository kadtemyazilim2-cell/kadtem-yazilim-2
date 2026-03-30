import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Searching for 1150 TL transactions...');
    const transactions = await prisma.cashTransaction.findMany({
        where: {
            OR: [
                { amount: 1150 },
                { description: { contains: '1150' } }
            ]
        },
        include: {
            site: true,
            createdBy: true,
            responsible: true
        }
    });

    console.log('Found transactions:', JSON.stringify(transactions, null, 2));

    const totalByResponsible = await prisma.cashTransaction.groupBy({
        by: ['responsibleUserId'],
        _sum: {
            amount: true
        },
        where: {
            type: 'EXPENSE'
        }
    });

    console.log('Total expenses by responsible user:', JSON.stringify(totalByResponsible, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
