import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Searching for user...');
    const user = await prisma.user.findFirst({
        where: {
            OR: [
                { username: { contains: 'can', mode: 'insensitive' } },
                { name: { contains: 'can', mode: 'insensitive' } }
            ]
        }
    });

    if (!user) {
        console.log('User containing "can" not found.');
    } else {
        console.log('User Found:', user.name, user.username);
        console.log('Details:', {
            id: user.id,
            role: user.role,
            editLookbackDays: user.editLookbackDays,
            permissions: user.permissions
        });
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
