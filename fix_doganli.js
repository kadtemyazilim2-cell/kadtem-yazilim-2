
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Starting migration for Doğanlı Çiftliği (Phase 2)...');

    // 1. Find the incorrect company
    const oldCompany = await prisma.company.findFirst({
        where: { name: 'Doğanlı Çiftliği' }
    });

    if (!oldCompany) {
        console.log('Company "Doğanlı Çiftliği" not found. Migration likely already done.');
        return;
    }
    console.log(`Found old company: ${oldCompany.name} (${oldCompany.id})`);

    // 2. Find the target company
    const targetCompany = await prisma.company.findFirst({
        where: { name: 'KAD-TEM A.Ş.' }
    });

    if (!targetCompany) {
        console.error('Target company "KAD-TEM A.Ş." not found! Aborting.');
        return;
    }
    console.log(`Found target company: ${targetCompany.name} (${targetCompany.id})`);

    // 3. Move Sites (Constraint Error Fix)
    const sitesToMove = await prisma.site.findMany({
        where: { companyId: oldCompany.id }
    });
    console.log(`Found ${sitesToMove.length} sites linked to old company.`);

    for (const site of sitesToMove) {
        console.log(`Moving site: ${site.name} (${site.id})`);
        await prisma.site.update({
            where: { id: site.id },
            data: { companyId: targetCompany.id }
        });
    }

    // 4. Move Vehicles (Re-run to be safe)
    const vehiclesToMove = await prisma.vehicle.count({
        where: { companyId: oldCompany.id }
    });
    console.log(`Found ${vehiclesToMove} remaining vehicles to move.`);

    if (vehiclesToMove > 0) {
        await prisma.vehicle.updateMany({
            where: { companyId: oldCompany.id },
            data: { companyId: targetCompany.id }
        });
    }

    // 5. Move Correspondence
    const correspondenceToMove = await prisma.correspondence.count({
        where: { companyId: oldCompany.id }
    });
    console.log(`Found ${correspondenceToMove} correspondences to move.`);

    if (correspondenceToMove > 0) {
        await prisma.correspondence.updateMany({
            where: { companyId: oldCompany.id },
            data: { companyId: targetCompany.id }
        });
    }

    // 6. Handle Users (Implicit M-N)
    // We need to disconnect oldCompany and connect targetCompany for any user connected to oldCompany.
    const usersWithOldCompany = await prisma.user.findMany({
        where: {
            assignedCompanies: {
                some: { id: oldCompany.id }
            }
        },
        include: { assignedCompanies: true }
    });
    console.log(`Found ${usersWithOldCompany.length} users assigned to old company.`);

    for (const user of usersWithOldCompany) {
        console.log(`Updating user: ${user.name}`);
        // Disconnect old, Connect new
        await prisma.user.update({
            where: { id: user.id },
            data: {
                assignedCompanies: {
                    disconnect: { id: oldCompany.id },
                    connect: { id: targetCompany.id }
                }
            }
        });
    }

    // 7. Delete the old company
    // Now that relations are clear, this should succeed.
    console.log('Deleting old company...');
    await prisma.company.delete({
        where: { id: oldCompany.id }
    });
    console.log('Deleted old company "Doğanlı Çiftliği".');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
