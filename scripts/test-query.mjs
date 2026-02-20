import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
    try {
        const monthDate = new Date('2026-02-01');
        // Get a real siteId first
        const sites = await prisma.site.findMany({ where: { status: 'ACTIVE' }, take: 3, select: { id: true, name: true } });
        console.log('Sites:', sites.map(s => s.name));

        if (sites.length === 0) {
            console.log('No active sites found');
            return;
        }

        const siteId = sites[0].id;
        console.log('Testing with site:', sites[0].name, siteId);

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
            include: {
                attendance: {
                    where: {
                        date: {
                            gte: new Date(Date.UTC(monthDate.getFullYear(), monthDate.getMonth(), 1)),
                            lte: new Date(Date.UTC(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999))
                        }
                    }
                },
                salaryAdjustments: {
                    where: {
                        year: monthDate.getFullYear(),
                        month: monthDate.getMonth() + 1
                    }
                }
            },
            orderBy: { fullName: 'asc' }
        });

        console.log('SUCCESS! Personnel count:', result.length);
        result.forEach(p => console.log(`  - ${p.fullName} (siteId: ${p.siteId}, attendance: ${p.attendance.length})`));
    } catch (e) {
        console.error('QUERY ERROR:', e.message);
        console.error('Full error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

test();
