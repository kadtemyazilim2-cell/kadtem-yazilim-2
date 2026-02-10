import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        select: {
            username: true,
            role: true,
            editLookbackDays: true
        }
    });

    console.log('User Permissions Check:');
    users.forEach(u => {
        console.log(`User: ${u.username}, Role: ${u.role}, Lookback: ${u.editLookbackDays}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
