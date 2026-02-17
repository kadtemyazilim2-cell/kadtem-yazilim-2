import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const sites = await prisma.site.findMany({
        where: {
            OR: [
                { name: { contains: 'Ana', mode: 'insensitive' } },
                { isWarehouse: true }
            ]
        }
    });

    console.log('Sites matching "Ana" or isWarehouse:');
    sites.forEach(s => {
        console.log(`- ID: ${s.id}, Name: ${s.name}, isWarehouse: ${s.isWarehouse}, Status: ${s.status}`);
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
