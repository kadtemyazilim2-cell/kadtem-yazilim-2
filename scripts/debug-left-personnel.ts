import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Find ALL personnel with status LEFT
    const leftPersonnel = await prisma.personnel.findMany({
        where: { status: 'LEFT' },
        select: {
            id: true,
            fullName: true,
            status: true,
            leftDate: true,
            siteId: true,
            site: { select: { name: true } },
            attendance: {
                where: {
                    date: {
                        gte: new Date('2026-02-01'),
                        lte: new Date('2026-03-31')
                    }
                },
                select: {
                    date: true,
                    status: true,
                    siteId: true
                },
                orderBy: { date: 'desc' },
                take: 5
            }
        },
        orderBy: { fullName: 'asc' }
    });

    console.log(`\n=== İŞTEN AYRILAN PERSONEL (status=LEFT) ===`);
    console.log(`Toplam: ${leftPersonnel.length}\n`);

    leftPersonnel.forEach(p => {
        console.log(`📌 ${p.fullName}`);
        console.log(`   Status: ${p.status}`);
        console.log(`   leftDate: ${p.leftDate ? p.leftDate.toISOString() : 'NULL'}`);
        console.log(`   Site: ${p.site?.name || 'NONE'} (${p.siteId || 'null'})`);
        console.log(`   Son 5 Puantaj (Şubat-Mart):`);
        if (p.attendance.length === 0) {
            console.log(`     (yok)`);
        } else {
            p.attendance.forEach(a => {
                console.log(`     ${a.date.toISOString().split('T')[0]} - ${a.status} (site: ${a.siteId})`);
            });
        }
        console.log('');
    });

    // Now simulate the API query for March 2026
    const monthDate = new Date('2026-03-01');
    const marchPersonnel = await prisma.personnel.findMany({
        where: {
            AND: [
                {
                    NOT: {
                        AND: [
                            { status: 'LEFT' },
                            {
                                OR: [
                                    { leftDate: { lt: new Date(monthDate.getFullYear(), monthDate.getMonth(), 1) } },
                                    { leftDate: null }
                                ]
                            }
                        ]
                    }
                },
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
                }
            ]
        },
        select: {
            id: true,
            fullName: true,
            status: true,
            leftDate: true,
        },
        orderBy: { fullName: 'asc' }
    });

    const marchLeft = marchPersonnel.filter(p => p.status === 'LEFT');
    console.log(`\n=== MART 2026 API SORGUSU SONUCU ===`);
    console.log(`Toplam personel: ${marchPersonnel.length}`);
    console.log(`LEFT olan (hala görünen): ${marchLeft.length}\n`);

    marchLeft.forEach(p => {
        console.log(`⚠️  ${p.fullName} - leftDate: ${p.leftDate ? p.leftDate.toISOString() : 'NULL'}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
