import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function assignVehicles() {
    const mappings = [
        { plate: '60 AEY 683', siteId: 'cmkmop5q5000fhgexroggue2m' }, // Aydın Nazilli
        { plate: '60 AFA 401', siteId: 'cmkmooxq1000jsjtfm8kfo5hp' }, // Zile Ovası
        { plate: '60 BP 844', siteId: 'cmkmop5q5000fhgexroggue2m' }   // Aydın (Assumption based on user focus)
    ];

    for (const m of mappings) {
        const vehicle = await prisma.vehicle.findFirst({ where: { plate: m.plate } });
        if (!vehicle) continue;

        console.log(`Assigning ${m.plate} to site ${m.siteId}...`);

        // Add to assignedSites (relational)
        await prisma.vehicle.update({
            where: { id: vehicle.id },
            data: {
                assignedSites: {
                    connect: { id: m.siteId }
                }
            }
        });

        // Also create a history record if not exists?
        // Let's just do the assignment first.
    }
}

assignVehicles()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
