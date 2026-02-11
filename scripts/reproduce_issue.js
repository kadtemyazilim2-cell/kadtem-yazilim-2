
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function bulkUnassignVehicles(vehicleIds, siteIds) {
    console.log(`Unassigning vehicles ${vehicleIds} from sites ${siteIds}`);
    try {
        await prisma.$transaction(async (tx) => {
            for (const vId of vehicleIds) {
                const vehicle = await tx.vehicle.findUnique({
                    where: { id: vId },
                    include: { assignedSites: true }
                });

                if (!vehicle) {
                    console.log(`Vehicle ${vId} not found`);
                    continue;
                }

                console.log(`Processing Vehicle ${vehicle.plate} (${vehicle.id})`);
                console.log(`Legacy: ${vehicle.assignedSiteId}`);
                console.log(`Relation count: ${vehicle.assignedSites.length}`);

                // 1. Update Relation + clear legacy assignedSiteId if needed
                const updateData = {
                    assignedSites: {
                        disconnect: siteIds.map(sid => ({ id: sid }))
                    }
                };

                // Clear legacy singular field if it matches a site being removed
                if (vehicle.assignedSiteId && siteIds.includes(vehicle.assignedSiteId)) {
                    console.log('Clearing legacy assignedSiteId');
                    updateData.assignedSiteId = null;
                }

                await tx.vehicle.update({
                    where: { id: vId },
                    data: updateData
                });

                // 2. Handle History
                const currentSiteIds = vehicle.assignedSites.map(s => s.id);
                // [FIX] Include legacy assignedSiteId in currentSiteIds so we process history for it too
                if (vehicle.assignedSiteId && !currentSiteIds.includes(vehicle.assignedSiteId)) {
                    currentSiteIds.push(vehicle.assignedSiteId);
                }

                const activeHistories = await tx.vehicleAssignmentHistory.findMany({
                    where: {
                        vehicleId: vId,
                        siteId: { in: siteIds },
                        endDate: null
                    }
                });

                for (const sId of siteIds) {
                    // Only process if the vehicle WAS assigned to this site
                    if (currentSiteIds.includes(sId)) {
                        const history = activeHistories.find(h => h.siteId === sId);
                        if (history) {
                            console.log(`Closing history ${history.id} for site ${sId}`);
                            await tx.vehicleAssignmentHistory.update({
                                where: { id: history.id },
                                data: { endDate: new Date() }
                            });
                        } else {
                            console.log(`Creating legacy history close for site ${sId}`);
                            // Legacy Close
                            const fallbackDate = new Date();
                            fallbackDate.setFullYear(fallbackDate.getFullYear() - 1);

                            await tx.vehicleAssignmentHistory.create({
                                data: {
                                    vehicleId: vId,
                                    siteId: sId,
                                    startDate: fallbackDate,
                                    endDate: new Date()
                                }
                            });
                        }
                    } else {
                        console.log(`Vehicle was NOT assigned to site ${sId}, skipping history.`);
                    }
                }
            }
        });

        console.log('Transaction successful.');
        return { success: true };
    } catch (error) {
        console.error('bulkUnassignVehicles Error:', error);
        return { success: false, error: 'Şantiyeden çıkarma işlemi yapılamadı.' };
    }
}

async function main() {
    // 20 AOF 266 (cmkpf4kbu0001ln7f575rdar1) assigned to cmkmop5q5000fhgexroggue2m (Legacy)
    const vId = 'cmkpf4kbu0001ln7f575rdar1';
    const sId = 'cmkmop5q5000fhgexroggue2m';

    console.log('--- START TEST ---');
    const res = await bulkUnassignVehicles([vId], [sId]);
    console.log('Result:', res);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
