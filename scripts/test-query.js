const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    try {
        // Find the Aydın site
        const sites = await prisma.site.findMany({
            where: { name: { contains: 'Ayd' } },
            select: { id: true, name: true, status: true }
        });
        console.log('Matching sites:', sites);

        if (sites.length === 0) {
            console.log('No Aydın site found, listing all sites...');
            const allSites = await prisma.site.findMany({ select: { id: true, name: true, status: true } });
            allSites.forEach(s => console.log(`  ${s.name} (${s.status}) -> ${s.id}`));
            return;
        }

        const siteId = sites[0].id;
        const monthDate = new Date('2026-02-01');
        console.log(`Testing query for site: ${sites[0].name} (${siteId})`);

        // Count personnel assigned to this site
        const directCount = await prisma.personnel.count({
            where: { siteId, status: 'ACTIVE' }
        });
        console.log(`Personnel directly assigned (siteId=${siteId}): ${directCount}`);

        // Count via assignedSites
        const assignedCount = await prisma.personnel.count({
            where: { assignedSites: { some: { id: siteId } }, status: 'ACTIVE' }
        });
        console.log(`Personnel assigned via assignedSites: ${assignedCount}`);

        // Count via attendance
        const attendanceCount = await prisma.personnel.count({
            where: {
                attendance: {
                    some: {
                        siteId,
                        date: {
                            gte: new Date(monthDate.getFullYear(), monthDate.getMonth(), 1),
                            lte: new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
                        }
                    }
                }
            }
        });
        console.log(`Personnel with attendance at this site in Feb 2026: ${attendanceCount}`);

        // Full query (same as server action)
        const result = await prisma.personnel.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            { status: 'ACTIVE' },
                            { leftDate: { gte: new Date(monthDate.getFullYear(), monthDate.getMonth(), 1) } },
                            {
                                attendance: {
                                    some: {
                                        date: {
                                            gte: new Date(monthDate.getFullYear(), monthDate.getMonth(), 1),
                                            lte: new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
                                        }
                                    }
                                }
                            }
                        ]
                    },
                    {
                        OR: [
                            { siteId },
                            { assignedSites: { some: { id: siteId } } },
                            {
                                attendance: {
                                    some: {
                                        siteId,
                                        date: {
                                            gte: new Date(monthDate.getFullYear(), monthDate.getMonth(), 1),
                                            lte: new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
                                        }
                                    }
                                }
                            }
                        ]
                    }
                ]
            },
            select: { id: true, fullName: true, siteId: true, status: true }
        });

        console.log(`\nFull query result: ${result.length} personnel`);
        result.forEach(p => console.log(`  ${p.fullName} (status: ${p.status}, siteId: ${p.siteId})`));

    } catch (e) {
        console.error('ERROR:', e.message);
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

test();
