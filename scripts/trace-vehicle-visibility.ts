import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function traceVehicle() {
    try {
        const plate = '60 ACN 701';
        const vehicle = await prisma.vehicle.findUnique({
            where: { plate },
            include: {
                assignedSite: true,
                assignedSites: true,
                company: true
            }
        });

        if (!vehicle) {
            console.log(`Vehicle ${plate} NOT FOUND in database.`);
            return;
        }

        console.log('--- VEHICLE TRACE ---');
        console.log(JSON.stringify(vehicle, null, 2));

        // Check assigned sites specifically
        console.log('\nDirect assignedSiteId:', vehicle.assignedSiteId);
        console.log('assignedSites array length:', vehicle.assignedSites.length);
        vehicle.assignedSites.forEach(s => console.log(` - Site in array: ${s.name} (${s.id})`));

        // Check if there are any users who can see this vehicle's site
        const siteId = vehicle.assignedSiteId;
        if (siteId) {
            const usersWithAccess = await prisma.user.findMany({
                where: {
                    OR: [
                        { role: 'ADMIN' },
                        { assignedSites: { some: { id: siteId } } }
                    ]
                },
                select: { username: true, role: true }
            });
            console.log(`\nUsers with access to site ${siteId}:`, usersWithAccess.map(u => u.username));
        }

    } catch (e) { console.error(e); }
    finally { await prisma.$disconnect(); }
}

traceVehicle();
