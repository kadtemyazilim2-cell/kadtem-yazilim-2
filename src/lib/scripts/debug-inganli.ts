
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Searching for "Doğanlı"...');

    const companies = await prisma.company.findMany({
        where: {
            name: { contains: 'Doğanlı' }
        }
    });

    console.log('Companies found:', companies);

    const sites = await prisma.site.findMany({
        where: {
            name: { contains: 'Doğanlı' }
        }
    });

    console.log('Sites found:', sites);

    // Also check if there is any User with this name
    const users = await prisma.user.findMany({
        where: {
            name: { contains: 'Doğanlı' }
        }
    });
    console.log('Users found:', users);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
