import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAydinVehicles() {
    const aydinSiteId = 'cmkmop5q5000fhgexroggue2m';

    const vehicles = await prisma.vehicle.findMany({
        where: {
            OR: [
                { assignedSiteId: aydinSiteId },
                { assignedSites: { some: { id: aydinSiteId } } }
            ]
        },
        select: { plate: true, assignedSiteId: true, assignedSites: { select: { id: true, name: true } } }
    });

    console.log(`Aydın Nazilli Şantiyesine Atanan Araçlar (${vehicles.length} adet):`);
    vehicles.forEach(v => {
        console.log(`- ${v.plate}: assignedSiteId=${v.assignedSiteId}, assignedSites=[${v.assignedSites.map(s => s.name).join(', ')}]`);
    });
}

checkAydinVehicles()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
