import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkVehicleProperites() {
    try {
        const plate = '60 ACN 701';
        const vehicle = await prisma.vehicle.findUnique({
            where: { plate },
            select: {
                id: true,
                plate: true,
                ownership: true,
                status: true,
                assignedSiteId: true,
                assignedSites: { select: { id: true, name: true } }
            }
        });

        console.log('--- VEHICLE DETAILS ---');
        console.log(JSON.stringify(vehicle, null, 2));

    } catch (e) { console.error(e); }
    finally { await prisma.$disconnect(); }
}

checkVehicleProperites();
