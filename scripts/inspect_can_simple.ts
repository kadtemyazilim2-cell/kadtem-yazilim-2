
import { prisma } from '../src/lib/db';

async function main() {
    console.log('Inspecting User Can...');
    const user = await prisma.user.findFirst({
        where: {
            OR: [
                { name: { contains: 'Can' } },
                { email: { contains: 'can' } }
            ]
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            editLookbackDays: true,
            status: true
        }
    });

    console.log('User Data:', JSON.stringify(user, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
