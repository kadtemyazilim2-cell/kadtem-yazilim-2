const { PrismaClient } = require('@prisma/client');

async function main() {
    const prisma = new PrismaClient();

    try {
        const results = await prisma.vehicle.findMany({
            where: {
                OR: [
                    { plate: { contains: '3763' } },
                    { plate: { contains: '887' } },
                    { plate: { contains: '788' } }
                ]
            },
            select: {
                id: true,
                plate: true,
                ownership: true,
                insuranceExpiry: true,
                insuranceAgency: true,
                insuranceCompany: true,
                insuranceHistory: true
            }
        });

        console.log('Found vehicles:', results.length);
        results.forEach(v => {
            let h = v.insuranceHistory;
            if (typeof h === 'string') try { h = JSON.parse(h) } catch { h = [] };
            if (!Array.isArray(h)) h = [];
            console.log(`  ${v.plate} | ownership=${v.ownership} | historyCount=${h.length} | agency=${v.insuranceAgency} | company=${v.insuranceCompany}`);
            h.forEach((r, i) => console.log(`    [${i}] id=${r.id} type=${r.type} active=${r.active}`));
        });

    } catch (e) {
        console.error('HATA:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
