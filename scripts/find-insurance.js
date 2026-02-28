const { PrismaClient } = require('@prisma/client');

async function main() {
    const prisma = new PrismaClient();

    try {
        const count = await prisma.vehicle.count();
        console.log('Total vehicles in DB:', count);

        const all = await prisma.vehicle.findMany({
            select: { plate: true, id: true },
            orderBy: { plate: 'asc' }
        });

        console.log('\nAll plates:');
        all.forEach(v => console.log(`  ${v.plate}`));

        // Try case insensitive search for the 3 plates
        console.log('\n=== Searching for specific plates ===');
        const search = ['GF 3763', 'HN 887', 'ACE 788', 'GF3763', 'HN887', 'ACE788'];
        for (const q of search) {
            const found = all.filter(v => v.plate.includes(q));
            if (found.length > 0) {
                console.log(`  "${q}" -> Found: ${found.map(f => f.plate).join(', ')}`);
            }
        }

    } catch (e) {
        console.error('HATA:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
