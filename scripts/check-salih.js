const { PrismaClient } = require('@prisma/client');

async function main() {
    const prisma = new PrismaClient();

    try {
        // Find Salih Kaya
        const results = await prisma.personnel.findMany({
            where: {
                fullName: { contains: 'Salih', mode: 'insensitive' }
            },
            select: {
                id: true,
                fullName: true,
                status: true,
                leftDate: true,
                startDate: true,
                siteId: true,
                tcNumber: true,
                attendance: {
                    orderBy: { date: 'desc' },
                    take: 5,
                    select: { date: true, status: true, siteId: true }
                }
            }
        });

        console.log('=== Salih Kaya Search Results ===');
        results.forEach(p => {
            console.log(`\nName: ${p.fullName}`);
            console.log(`  ID: ${p.id}`);
            console.log(`  Status: ${p.status}`);
            console.log(`  leftDate: ${p.leftDate}`);
            console.log(`  startDate: ${p.startDate}`);
            console.log(`  siteId: ${p.siteId}`);
            console.log(`  tcNumber: ${p.tcNumber}`);
            console.log(`  Recent attendance (last 5):`);
            p.attendance.forEach(a => {
                console.log(`    ${a.date.toISOString().split('T')[0]} - ${a.status} (site: ${a.siteId})`);
            });
        });

        // Also check what March query would return
        const marchStart = new Date(2026, 2, 1); // March 1, 2026
        console.log('\n=== March query check ===');
        console.log('March start:', marchStart.toISOString());

        results.forEach(p => {
            const isActive = p.status === 'ACTIVE';
            const leftDateGteMarch = p.leftDate && p.leftDate >= marchStart;
            console.log(`\n${p.fullName}:`);
            console.log(`  status === ACTIVE: ${isActive}`);
            console.log(`  leftDate >= March 1: ${leftDateGteMarch}`);
            console.log(`  Would pass NOT filter: ${!(p.status === 'LEFT' && p.leftDate && p.leftDate < marchStart)}`);
        });

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
