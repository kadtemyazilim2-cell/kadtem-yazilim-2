import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deepCleanDuplicates() {
    const allAttendance = await prisma.vehicleAttendance.findMany({
        orderBy: [{ vehicleId: 'asc' }, { date: 'asc' }]
    });

    const aydinSiteId = 'cmkmop5q5000fhgexroggue2m';
    let deletedCount = 0;

    for (let i = 0; i < allAttendance.length - 1; i++) {
        const current = allAttendance[i];
        const next = allAttendance[i + 1];

        // Check if same vehicle and same day
        const currentDateStr = current.date.toISOString().split('T')[0];
        const nextDateStr = next.date.toISOString().split('T')[0];

        if (current.vehicleId === next.vehicleId && currentDateStr === nextDateStr) {
            console.log(`Duplicate for ${current.vehicleId} on ${currentDateStr}: ${current.siteId} vs ${next.siteId}`);

            let toDeleteId = null;

            // Strategy 1: If one is Aydın and other isn't, delete Aydın (user's specific complaint)
            if (current.siteId === aydinSiteId && next.siteId !== aydinSiteId) {
                toDeleteId = current.id;
            } else if (next.siteId === aydinSiteId && current.siteId !== aydinSiteId) {
                toDeleteId = next.id;
            } else {
                // Strategy 2: Keep the one with a note
                if (!current.note && next.note) {
                    toDeleteId = current.id;
                } else if (current.note && !next.note) {
                    toDeleteId = next.id;
                } else {
                    // Strategy 3: Just delete one (the first one)
                    toDeleteId = current.id;
                }
            }

            if (toDeleteId) {
                await prisma.vehicleAttendance.delete({ where: { id: toDeleteId } });
                console.log(`- Deleted record ${toDeleteId}`);
                deletedCount++;
                // Skip the next one as we already handled this pair
                i++;
            }
        }
    }

    console.log(`\nToplam ${deletedCount} mükerrer kayıt temizlendi.`);
}

deepCleanDuplicates()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
