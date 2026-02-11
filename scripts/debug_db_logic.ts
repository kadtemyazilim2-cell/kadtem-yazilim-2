
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const vehicleId = 'cmkpf4tbt000zln7f02vc9cg2'; // 01 C 9569
    const siteId = 'cmkmop5q5000fhgexroggue2m'; // Site

    console.log('--- STARTING TRANSACTION ---');
    const start = Date.now();

    try {
        await prisma.$transaction(async (tx) => {
            // Logic from addVehiclesToSite
            const vehicle = await tx.vehicle.findUnique({
                where: { id: vehicleId },
                include: { assignedSites: true }
            });

            if (!vehicle) throw new Error('Vehicle not found');

            const currentSiteIds = vehicle.assignedSites.map(s => s.id);
            const isLegacyAssigned = vehicle.assignedSiteId === siteId;
            const isRelationAssigned = currentSiteIds.includes(siteId);

            console.log(`Vehicle ${vehicle.plate}: Legacy=${isLegacyAssigned}, Relation=${isRelationAssigned}`);

            if (isRelationAssigned) {
                console.log('Already assigned (relation). Skipping.');
                return;
            }

            console.log('Updating relation...');
            await tx.vehicle.update({
                where: { id: vehicleId },
                data: {
                    assignedSites: {
                        connect: { id: siteId }
                    }
                }
            });

            if (!isLegacyAssigned) {
                console.log('Creating history...');
                await tx.vehicleAssignmentHistory.create({
                    data: {
                        vehicleId: vehicleId,
                        siteId: siteId,
                        startDate: new Date(),
                        endDate: null
                    }
                });
            }
        });

        console.log('--- TRANSACTION SAVED ---');
    } catch (e) {
        console.error('Transaction Failed:', e);
    } finally {
        console.log('Duration:', Date.now() - start, 'ms');
        await prisma.$disconnect();
    }
}

main();
