const { PrismaClient } = require('@prisma/client');

async function main() {
    const prisma = new PrismaClient();

    try {
        const count = await prisma.cashTransaction.count();
        console.log('Total cash transactions:', count);

        const all = await prisma.cashTransaction.findMany({
            include: { responsibleUser: { select: { name: true } } }
        });

        all.forEach(t => {
            const sign = t.type === 'INCOME' ? '+' : '-';
            console.log(`  ${t.responsibleUser?.name || '-'}: ${sign}${t.amount} TL (${t.category}) - ${t.description}`);
        });

    } catch (e) {
        console.error('HATA:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
