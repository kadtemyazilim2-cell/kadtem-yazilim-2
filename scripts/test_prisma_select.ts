
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Fetching vehicles with exact select...');
    const vehicles = await prisma.vehicle.findMany({
        where: {
            plate: '01 C 9569'
        },
        select: {
            id: true,
            // companyId: true, // simplified for brevity, just checking assignedSites
            plate: true,
            assignedSiteId: true,
            assignedSites: {
                select: {
                    id: true
                }
            }
        }
    });

    console.log(JSON.stringify(vehicles, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
