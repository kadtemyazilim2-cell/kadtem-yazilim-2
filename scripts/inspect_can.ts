
import { prisma } from '../src/lib/db';

async function main() {
    const users = await prisma.user.findMany({
        where: {
            OR: [
                { name: { contains: 'Can' } },
                { email: { contains: 'can' } } // Case insensitive search usually
            ]
        }
    });

    console.log('Found Users:', JSON.stringify(users, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
