
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Cleanup started...');

    // 1. Delete Sites named "Doğanlı Çiftliği" (or similar)
    const sites = await prisma.site.findMany({
        where: {
            OR: [
                { name: { contains: 'Doğanlı', mode: 'insensitive' } },
                { name: { contains: 'Doganli', mode: 'insensitive' } }
            ]
        }
    });

    console.log(`Found ${sites.length} sites to delete.`);
    for (const site of sites) {
        console.log(`Deleting site: ${site.name} (${site.id})`);

        // Delete related data first if needed (usually cascade handles it, but let's be safe)
        // Note: Prisma schema usually has cascades. If not, we might error.
        // Assuming cascades are set or we only delete the site.
        try {
            await prisma.site.delete({ where: { id: site.id } });
            console.log('Deleted site.');
        } catch (e) {
            console.error(`Failed to delete site ${site.id}:`, e);
        }
    }

    // 2. Delete Companies named "Doğanlı Çiftliği"
    const companies = await prisma.company.findMany({
        where: {
            OR: [
                { name: { contains: 'Doğanlı', mode: 'insensitive' } },
                { name: { contains: 'Doganli', mode: 'insensitive' } }
            ]
        }
    });

    console.log(`Found ${companies.length} companies to delete.`);
    for (const company of companies) {
        console.log(`Deleting company: ${company.name} (${company.id})`);
        try {
            // Check if it has sites? We just deleted its sites (if they matched name).
            // But if it has OTHER sites, deletion fits constraint?
            await prisma.company.delete({ where: { id: company.id } });
            console.log('Deleted company.');
        } catch (e) {
            console.error(`Failed to delete company ${company.id} (might have other linked data):`, e);
            // If failed, maybe move its children to a safe company?
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
