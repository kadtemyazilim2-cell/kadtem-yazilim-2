import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Searching for ALL users matching "can"...');
    const users = await prisma.user.findMany({
        where: {
            OR: [
                { username: { contains: 'can', mode: 'insensitive' } },
                { name: { contains: 'can', mode: 'insensitive' } }
            ]
        }
    });

    console.log(`Found ${users.length} users.`);
    users.forEach(user => {
        console.log('------------------------------------------------');
        console.log('Name:', user.name);
        console.log('Username:', user.username);
        console.log('ID:', user.id);
        console.log('Role:', user.role);
        console.log('EditLookbackDays:', user.editLookbackDays);
        // console.log('Permissions:', JSON.stringify(user.permissions, null, 2));
    });
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
