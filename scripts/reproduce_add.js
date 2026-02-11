
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addVehiclesToSite(vehicleIds, siteId) {
    console.log(`Adding vehicles ${vehicleIds} to site ${siteId}`);
    try {
        await prisma.$transaction(async (tx) => {
            for (const vId of vehicleIds) {
                const vehicle = await tx.vehicle.findUnique({
                    where: { id: vId },
                    include: { assignedSites: true }
                });

                if (!vehicle) {
                    console.log('Vehicle not found');
                    continue;
                }

                const currentSiteIds = vehicle.assignedSites.map(s => s.id);
                // logic from src/actions/vehicle.ts
                const isLegacyAssigned = vehicle.assignedSiteId === siteId;
                const isRelationAssigned = currentSiteIds.includes(siteId);

                console.log(`Processing Vehicle ${vehicle.plate}`);
                console.log(`Legacy: ${isLegacyAssigned}, Relation: ${isRelationAssigned}`);

                // If already fully assigned (relation), skip
                if (isRelationAssigned) {
                    console.log('Already assigned via relation. Skipping.');
                    continue;
                }

                console.log('Connecting relation...');
                // 1. Update Relation (Connect)
                await tx.vehicle.update({
                    where: { id: vId },
                    data: {
                        assignedSites: {
                            connect: { id: siteId }
                        }
                    }
                });

                // 2. Handle History (Create new open history)
                // Only create history if it's a FRESH assignment (not a legacy migration)
                if (!isLegacyAssigned) {
                    console.log('Creating new history record...');
                    await tx.vehicleAssignmentHistory.create({
                        data: {
                            vehicleId: vId,
                            siteId: siteId,
                            startDate: new Date(),
                            endDate: null
                        }
                    });
                } else {
                    console.log('Is legacy migration, skipping history creation.');
                }
            }
        });

        console.log('Transaction successful.');
        return { success: true };
    } catch (error) {
        console.error('addVehiclesToSite Error:', error);
        return { success: false, error: 'Ekleme işlemi yapılamadı: ' + (error.message || error) };
    }
}

async function main() {
    const vId = 'cmkpf4kbu0001ln7f575rdar1'; // 20 AOF 266
    const sId = 'cmkmop5q5000fhgexroggue2m'; // Site

    console.log('--- START ADD TEST ---');
    const res = await addVehiclesToSite([vId], sId);
    console.log('Result:', res);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
