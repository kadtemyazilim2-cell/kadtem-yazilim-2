
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const total = await prisma.vehicleAttendance.count();
    const bySite = await prisma.vehicleAttendance.groupBy({
        by: ['siteId'],
        _count: { id: true }
    });

    console.log('Total Attendance Records:', total);
    console.log('By Site:', bySite);

    // Check records for Zile (for our period)
    const zileId = 'cmkmooxq1000jsjtfm8kfo5hp';
    const zileCount = await prisma.vehicleAttendance.count({
        where: {
            siteId: zileId,
            date: { gte: new Date('2025-08-01') }
        }
    });
    console.log(`Zile Records since Aug 2025: ${zileCount}`);
}

main().finally(() => prisma.$disconnect());
