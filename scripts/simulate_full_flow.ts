
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Simulating getVehicles logic...');

    // 1. Fetch from DB with Complex Select
    const vehicles = await prisma.vehicle.findMany({
        where: { plate: '01 C 9569' },
        orderBy: { plate: 'asc' },
        select: {
            id: true,
            plate: true,
            assignedSiteId: true,

            // insuranceHistory removed

            // Relations
            /* assignedSite: {
                select: {
                    id: true,
                    name: true
                }
            }, */
            assignedSites: { select: { id: true } },
        }
    });

    const transformedVehicles = vehicles.map((v: any) => ({
        ...v,
        assignedSiteIds: v.assignedSites ? v.assignedSites.map((s: any) => s.id) : []
    }));

    const vComplex = transformedVehicles[0];
    console.log('--- Complex Query for 01 C 9569 ---');
    console.log('AssignedSiteIds:', vComplex?.assignedSiteIds);


    // 2. Simple Query
    const vSimple = await prisma.vehicle.findUnique({
        where: { plate: '01 C 9569' },
        include: { assignedSites: { select: { id: true } } }
    });
    console.log('--- Simple Query for 01 C 9569 ---');
    console.log('AssignedSiteIds:', vSimple?.assignedSites.map(s => s.id));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
