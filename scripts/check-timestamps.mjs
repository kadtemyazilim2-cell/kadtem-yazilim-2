import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSpecificDuplicate() {
    const vid = 'v_ik_6';
    const records = await prisma.vehicleAttendance.findMany({
        where: {
            vehicleId: vid,
            date: {
                gte: new Date('2026-01-01'),
                lte: new Date('2026-01-31T23:59:59Z')
            }
        },
        orderBy: { date: 'asc' }
    });

    console.log(`Vehicle ${vid} January 2026 Attendance:`);
    for (const r of records) {
        const site = await prisma.site.findUnique({ where: { id: r.siteId }, select: { name: true } });
        console.log(`- Date: ${r.date.toISOString()}, Site: ${site?.name}, Status: ${r.status}, Note: ${r.note || 'None'}`);
    }
}

checkSpecificDuplicate()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
