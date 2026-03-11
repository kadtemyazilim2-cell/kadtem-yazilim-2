import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listSites() {
    const sites = await prisma.site.findMany({
        select: { id: true, name: true }
    });

    console.log('Sistemdeki Şantiyeler:');
    sites.forEach(s => console.log(`- ${s.name} (ID: ${s.id})`));
}

listSites()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
