
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const users = await prisma.user.findMany({
            where: {
                name: { contains: 'Ali' }
            }
        });
        console.log('Users found with "Ali":', users);

        const users2 = await prisma.user.findMany({
            where: {
                name: { contains: 'Baser' }
            }
        });
        console.log('Users found with "Baser":', users2);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
