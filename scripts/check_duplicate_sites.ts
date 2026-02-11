
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const sites = await prisma.site.findMany({
        select: { id: true, name: true, status: true }
    });

    const nameMap = new Map();
    const duplicates: any[] = [];

    for (const site of sites) {
        if (nameMap.has(site.name)) {
            duplicates.push({ name: site.name, ids: [nameMap.get(site.name).id, site.id] });
        } else {
            nameMap.set(site.name, site);
        }
    }

    if (duplicates.length > 0) {
        console.log('Found duplicates:', JSON.stringify(duplicates, null, 2));
    } else {
        console.log('No duplicate site names found.');
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
