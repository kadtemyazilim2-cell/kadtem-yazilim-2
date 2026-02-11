const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    try {
        // Find the site "Aydın Nazilli"
        const sites = await p.site.findMany({
            where: { name: { contains: 'Aydın Nazilli' } }
        });

        if (sites.length === 0) {
            console.log('Site not found');
            return;
        }

        const site = sites[0];
        console.log('Site:', site.name, 'ID:', site.id);

        // Find vehicle "15 AAH 448"
        const vehicle = await p.vehicle.findFirst({
            where: { plate: { contains: '15 AAH 448' } },
            include: { assignedSites: true }
        });

        if (!vehicle) {
            console.log('Vehicle 15 AAH 448 not found');
            return;
        }

        console.log('Vehicle:', vehicle.plate, 'ID:', vehicle.id);
        console.log('Assigned Site ID (Legacy):', vehicle.assignedSiteId);
        console.log('Assigned Sites (Relation):', vehicle.assignedSites.map(s => s.name));

        const isAssignedToSite = vehicle.assignedSites.some(s => s.id === site.id);
        console.log('Is Assigned to Site (Relation)?', isAssignedToSite);
        console.log('Is Assigned to Site (Legacy)?', vehicle.assignedSiteId === site.id);

    } catch (e) {
        console.error('ERROR:', e);
    } finally {
        await p.$disconnect();
    }
}

main();
