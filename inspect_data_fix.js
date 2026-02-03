
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        // 1. Find Site 'Zile 1'
        const sites = await prisma.site.findMany({
            where: {
                name: { contains: 'Zile' }
            }
        });
        console.log('Sites found with "Zile":', sites);

        // 2. Find User 'Ali Başer'
        const users = await prisma.user.findMany({
            where: {
                name: { contains: 'Ali Başer' }
            }
        });
        console.log('Users found with "Ali Başer":', users);

        if (users.length > 0) {
            const userId = users[0].id;
            // 3. Find transactions for this user with no site
            const transactions = await prisma.transaction.findMany({
                where: {
                    userId: userId,
                    siteId: null
                },
                take: 10
            });
            console.log('Transactions for user without site:', transactions);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
