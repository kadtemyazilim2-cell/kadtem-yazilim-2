
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const siteId = 'cmkmop5q5000fhgexroggue2m';

    console.log(`Checking personnel for site: ${siteId}`);

    try {
        // Check main siteId
        const countMain = await prisma.personnel.count({
            where: { siteId: siteId }
        });
        console.log(`Personnel with main siteId = ${siteId}: ${countMain}`);

        // Check assignedSites
        const countAssigned = await prisma.personnel.count({
            where: { assignedSites: { some: { id: siteId } } }
        });
        console.log(`Personnel with assignedSites containing ${siteId}: ${countAssigned}`);

        // Check combined logic used in getPersonnelWithAttendance (simplified)
        const combined = await prisma.personnel.findMany({
            where: {
                OR: [
                    { siteId },
                    { assignedSites: { some: { id: siteId } } }
                ]
            },
            select: { id: true, fullName: true, siteId: true }
        });

        console.log('--- Combined Logic Result ---');
        console.log(`Total Found: ${combined.length}`);
        combined.forEach(p => {
            console.log(`- ${p.fullName} (MainSite: ${p.siteId})`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
