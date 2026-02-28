const { PrismaClient } = require('@prisma/client');

async function main() {
    const prisma = new PrismaClient();

    try {
        // Find sites that have fuel tanks
        const sitesWithTanks = await prisma.site.findMany({
            where: {
                fuelTanks: { some: {} }
            },
            select: {
                id: true,
                name: true,
                fuelTanks: {
                    select: {
                        id: true,
                        name: true,
                        currentLevel: true,
                        capacity: true
                    }
                }
            },
            orderBy: { name: 'asc' }
        });

        console.log('=== Sites WITH Fuel Tanks ===');
        sitesWithTanks.forEach(s => {
            console.log(`\nSite: ${s.name}`);
            console.log(`  ID: ${s.id}`);
            s.fuelTanks.forEach(t => {
                console.log(`  Tank: ${t.name} | Level: ${t.currentLevel} | Capacity: ${t.capacity} | ID: ${t.id}`);
            });
        });

        // Also search for Doğanlı and Nazilli
        const searchSites = await prisma.site.findMany({
            where: {
                OR: [
                    { name: { contains: 'oğanlı', mode: 'insensitive' } },
                    { name: { contains: 'azilli', mode: 'insensitive' } },
                    { name: { contains: 'ydın', mode: 'insensitive' } }
                ]
            },
            select: { id: true, name: true, fuelTanks: { select: { id: true, name: true, currentLevel: true } } }
        });

        console.log('\n=== Search Results (Doğanlı/Nazilli/Aydın) ===');
        searchSites.forEach(s => {
            console.log(`${s.name} (ID: ${s.id}), tanks: ${s.fuelTanks.length}`);
            s.fuelTanks.forEach(t => console.log(`  Tank: ${t.name} | Level: ${t.currentLevel} | ID: ${t.id}`));
        });

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
