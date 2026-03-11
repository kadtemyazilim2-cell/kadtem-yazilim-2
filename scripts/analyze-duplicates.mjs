import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeDuplicates() {
    const allAttendance = await prisma.vehicleAttendance.findMany({
        orderBy: [{ vehicleId: 'asc' }, { date: 'asc' }]
    });

    const siteCounts = {};

    for (let i = 0; i < allAttendance.length - 1; i++) {
        const current = allAttendance[i];
        const next = allAttendance[i + 1];

        if (current.vehicleId === next.vehicleId &&
            current.date.toISOString().split('T')[0] === next.date.toISOString().split('T')[0]) {

            siteCounts[current.siteId] = (siteCounts[current.siteId] || 0) + 1;
            siteCounts[next.siteId] = (siteCounts[next.siteId] || 0) + 1;
        }
    }
    console.log('Mükerrer Kayıtlardaki Şantiye Dağılımı:');
    for (const [sid, count] of Object.entries(siteCounts)) {
        const site = await prisma.site.findUnique({ where: { id: sid }, select: { name: true } });
        console.log(`- ${site?.name || sid}: ${count} kayıt`);
    }
}

analyzeDuplicates()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
