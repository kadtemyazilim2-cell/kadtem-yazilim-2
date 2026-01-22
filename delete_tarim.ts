
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Cleanup Duplicates started...');

    const targetName = "Tarım ve Hayvancılık İşletmesi";

    // 1. Find all sites with this name
    // No orderBy because createdAt might not exist. Result order is undefined but acceptable for this cleanup.
    const sites = await prisma.site.findMany({
        where: { name: targetName }
    });

    console.log(`Found ${sites.length} sites with name "${targetName}".`);

    if (sites.length <= 1) {
        console.log('No duplicates found (or only 1 exists).');
        return;
    }

    // Keep the first one, delete the rest
    const sitesToDelete = sites.slice(1);

    for (const site of sitesToDelete) {
        console.log(`Deleting duplicate site: ${site.name} (${site.id})`);
        try {
            await prisma.site.delete({ where: { id: site.id } });
            console.log('Deleted.');
        } catch (e) {
            console.error(`Failed to delete ${site.id}:`, e);
        }
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
