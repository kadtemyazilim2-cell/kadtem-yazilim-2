
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
    console.log("Checking DB...");
    const users = await prisma.user.findMany();
    console.log("Users found:", users.length);
    users.forEach(u => {
        console.log(`- ${u.username} (ID: ${u.id}, Role: ${u.role})`);
    });

    const admin = await prisma.user.findUnique({ where: { username: 'admin' } });
    if (admin) {
        console.log("Admin found:", admin);
    } else {
        console.log("Admin NOT found!");
    }
}

check()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
