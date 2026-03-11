import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSpecificDuplicate() {
    const vid = 'v_ik_6';
    const records = await prisma.vehicleAttendance.findMany({
        where: { vehicleId: vid },
        orderBy: { date: 'asc' }
    });

    console.log(`Vehicle ${vid} Attendance:`);
    for (const r of records) {
        const site = await prisma.site.findUnique({ where: { id: r.siteId }, select: { name: true } });
        console.log(`- Date: ${r.date.toISOString().split('T')[0]}, Site: ${site?.name}, Status: ${r.status}, Note: ${r.note || 'None'}`);
    }
}

checkSpecificDuplicate()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
