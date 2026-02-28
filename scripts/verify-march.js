const { PrismaClient } = require('@prisma/client');

async function main() {
    const prisma = new PrismaClient();

    try {
        // Simulate the March query - same as list/route.ts
        const monthDate = new Date(2026, 2, 1); // March 2026
        const marchStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);

        console.log('=== March 2026 Query Simulation ===');
        console.log('Month start:', marchStart.toISOString());

        const results = await prisma.personnel.findMany({
            where: {
                AND: [
                    {
                        NOT: {
                            AND: [
                                { status: 'LEFT' },
                                { leftDate: { lt: marchStart } }
                            ]
                        }
                    },
                    {
                        OR: [
                            { status: 'ACTIVE' },
                            { leftDate: { gte: marchStart } },
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
                fullName: true,
                status: true,
                leftDate: true
            },
            orderBy: { fullName: 'asc' }
        });

        console.log(`\nReturned ${results.length} personnel for March:`);
        results.forEach(p => {
            console.log(`  ${p.fullName} | status: ${p.status} | leftDate: ${p.leftDate?.toISOString().split('T')[0] || 'null'}`);
        });

        // Check if Salih and Bünyamin are in the list
        const salih = results.find(p => p.fullName.includes('Salih'));
        const bunyamin = results.find(p => p.fullName.includes('Bünyamin'));

        console.log('\n=== Verification ===');
        console.log(`Salih KAYA in March: ${salih ? 'YES ❌ (STILL SHOWING)' : 'NO ✅ (CORRECTLY HIDDEN)'}`);
        console.log(`Bünyamin BEDİR in March: ${bunyamin ? 'YES ❌ (STILL SHOWING)' : 'NO ✅ (CORRECTLY HIDDEN)'}`);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
