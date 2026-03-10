import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function simulateFilter() {
    try {
        const vehicles = await prisma.vehicle.findMany({
            include: { assignedSites: true }
        });

        // Mock a selected site (Bilecik)
        const bilecikId = 'cmkmop32u0009hgexdqa3gxar';
        const plateToFind = '60 ACN 701';

        console.log(`Checking Plate: ${plateToFind} for Site: ${bilecikId} (Bilecik)`);

        const v = vehicles.find(v => v.plate === plateToFind);
        if (!v) {
            console.log("NOT FOUND IN DB");
            return;
        }

        const assignedSiteIds = v.assignedSites.map(s => s.id);
        const isAssigned = (assignedSiteIds && assignedSiteIds.includes(bilecikId)) || v.assignedSiteId === bilecikId;

        console.log(`- Status: ${v.status}`);
        console.log(`- AssignedSiteId (Primary): ${v.assignedSiteId}`);
        console.log(`- AssignedSiteIds (Relation): ${JSON.stringify(assignedSiteIds)}`);
        console.log(`- Result (isAssigned): ${isAssigned}`);

        if (v.status === 'PASSIVE') {
            console.log("- Result (Filtered): FALSE (PASSIVE)");
        } else {
            console.log(`- Result (Filtered): ${isAssigned}`);
        }

    } catch (e) { console.error(e); }
    finally { await prisma.$disconnect(); }
}

simulateFilter();
