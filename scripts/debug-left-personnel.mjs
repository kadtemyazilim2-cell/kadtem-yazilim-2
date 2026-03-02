import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Check specific personnel
    const names = ['Hamza KAYA', 'Bünyamin BEDİR', 'Salih KAYA'];

    for (const name of names) {
        const results = await prisma.personnel.findMany({
            where: { fullName: { contains: name, mode: 'insensitive' } },
            select: {
                id: true,
                fullName: true,
                status: true,
                leftDate: true,
                siteId: true,
                site: { select: { name: true } },
            }
        });

        console.log(`\n=== ${name} ===`);
        if (results.length === 0) {
            console.log('  Bulunamadı!');
        }
        results.forEach(p => {
            console.log(`  ID: ${p.id}`);
            console.log(`  fullName: ${p.fullName}`);
            console.log(`  status: ${p.status}`);
            console.log(`  leftDate: ${p.leftDate ? p.leftDate.toISOString() : 'NULL'}`);
            console.log(`  site: ${p.site?.name || 'NONE'} (${p.siteId || 'null'})`);
        });
    }

    // Also check: what does the March query return for these specific people?
    const monthDate = new Date('2026-03-01');
    const marchQuery = await prisma.personnel.findMany({
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
        select: { id: true, fullName: true, status: true, leftDate: true },
        orderBy: { fullName: 'asc' }
    });

    const found = marchQuery.filter(p =>
        names.some(n => p.fullName.toLowerCase().includes(n.toLowerCase()))
    );

    console.log(`\n=== MART SORGUSUNDA BU 3 İSİM VAR MI? ===`);
    if (found.length === 0) {
        console.log('Hiçbiri yok (Düzgün filtrelenmiş)');
    } else {
        found.forEach(p => {
            console.log(`⚠️  ${p.fullName} | status: ${p.status} | leftDate: ${p.leftDate ? p.leftDate.toISOString() : 'NULL'}`);
        });
    }

    // Check TOTAL LEFT that still pass through
    const allLeft = marchQuery.filter(p => p.status === 'LEFT');
    console.log(`\nToplam Mart sorgusunda LEFT: ${allLeft.length}`);
    allLeft.forEach(p => {
        console.log(`  ${p.fullName} | leftDate: ${p.leftDate ? p.leftDate.toISOString() : 'NULL'}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
