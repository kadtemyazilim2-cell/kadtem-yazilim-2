
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting company merge...');

    const sourceName = 'İKİKAT İNŞAAT';
    const targetName = 'İKİKAT LTD. ŞTİ.';

    // 1. Find Companies
    const sourceCompany = await prisma.company.findFirst({ where: { name: sourceName } });
    const targetCompany = await prisma.company.findFirst({ where: { name: targetName } });

    if (!sourceCompany) {
        console.log(`Source company "${sourceName}" not found.`);
        return;
    }
    if (!targetCompany) {
        console.log(`Target company "${targetName}" not found.`);
        return;
    }

    console.log(`Merging "${sourceName}" (${sourceCompany.id}) -> "${targetName}" (${targetCompany.id})`);

    // 2. Move Sites
    const sites = await prisma.site.updateMany({
        where: { companyId: sourceCompany.id },
        data: { companyId: targetCompany.id }
    });
    console.log(`Updated ${sites.count} sites.`);

    // 3. Move Vehicles
    const vehicles = await prisma.vehicle.updateMany({
        where: { companyId: sourceCompany.id },
        data: { companyId: targetCompany.id }
    });
    console.log(`Updated ${vehicles.count} vehicles.`);

    // 4. Move Correspondences
    const correspondences = await prisma.correspondence.updateMany({
        where: { companyId: sourceCompany.id },
        data: { companyId: targetCompany.id }
    });
    console.log(`Updated ${correspondences.count} correspondences.`);

    // 5. Move Users (Many-to-Many)
    const users = await prisma.user.findMany({
        where: {
            assignedCompanies: {
                some: { id: sourceCompany.id }
            }
        },
        include: { assignedCompanies: true }
    });

    console.log(`Found ${users.length} users with source company assignment.`);

    for (const user of users) {
        // Disconnect source, Connect target (if not already connected)
        // Check if already has target
        const hasTarget = user.assignedCompanies.some(c => c.id === targetCompany.id);

        if (!hasTarget) {
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    assignedCompanies: {
                        disconnect: { id: sourceCompany.id },
                        connect: { id: targetCompany.id }
                    }
                }
            });
            console.log(`User ${user.username}: Swapped company.`);
        } else {
            // Just disconnect source
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    assignedCompanies: {
                        disconnect: { id: sourceCompany.id }
                    }
                }
            });
            console.log(`User ${user.username}: Removed source (already had target).`);
        }
    }

    // 6. Delete Source Company
    await prisma.company.delete({
        where: { id: sourceCompany.id }
    });
    console.log(`Deleted source company "${sourceName}".`);

    console.log('Merge complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
