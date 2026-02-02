
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Fetching User...');
        const user = await prisma.user.findFirst();
        if (!user) throw new Error('No user found');
        console.log('User found:', user.id, user.name);

        console.log('Fetching Site...');
        const site = await prisma.site.findFirst();
        if (!site) throw new Error('No site found');
        console.log('Site found:', site.id, site.name);

        console.log('Attempting to create transaction...');
        const payload = {
            siteId: site.id,
            date: new Date(),
            type: 'EXPENSE',
            category: 'Avans',
            amount: 100,
            description: 'Test Transaction',
            createdByUserId: user.id,
            responsibleUserId: user.id,
            paymentMethod: 'CASH'
        };

        const transaction = await prisma.cashTransaction.create({
            data: payload
        });
        console.log('Success! Transaction created:', transaction);
    } catch (error) {
        console.error('ERROR creating transaction:');
        console.error(error);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
