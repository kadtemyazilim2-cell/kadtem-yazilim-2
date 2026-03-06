const { PrismaClient } = require('@prisma/client');

async function main() {
    const prisma = new PrismaClient();

    try {
        const SITE_ID = 'cmkmop5q5000fhgexroggue2m';

        // 1. Check ALL fuel logs count
        const totalLogs = await prisma.fuelLog.count();
        console.log(`Toplam FuelLog: ${totalLogs}`);

        // 2. Fuel logs for this specific site
        const siteLogs = await prisma.fuelLog.count({ where: { siteId: SITE_ID } });
        console.log(`Bu şantiye FuelLog: ${siteLogs}`);

        // 3. Get unique siteIds from fuel logs
        const allLogs = await prisma.fuelLog.findMany({
            select: { siteId: true, liters: true, date: true, tankId: true },
            orderBy: { date: 'desc' },
            take: 20
        });

        console.log(`\n=== Son 20 FuelLog ===`);
        allLogs.forEach(l => {
            console.log(`  siteId=${l.siteId} | tankId=${l.tankId} | liters=${l.liters} | date=${l.date.toISOString()}`);
        });

        // 4. Get the tank info
        const tank = await prisma.fuelTank.findUnique({
            where: { id: 'cmknxtc9p0001sufe6amae37c' },
            select: { id: true, name: true, siteId: true, currentLevel: true }
        });
        console.log(`\n=== Tank ===`);
        console.log(`Tank ID: ${tank.id}`);
        console.log(`Tank siteId: ${tank.siteId}`);
        console.log(`Tank currentLevel: ${tank.currentLevel}`);

        // 5. Check ALL tanks
        const allTanks = await prisma.fuelTank.findMany({
            select: { id: true, name: true, siteId: true, currentLevel: true, status: true }
        });
        console.log(`\n=== Tüm Tanklar ===`);
        allTanks.forEach(t => {
            console.log(`  ${t.name}: siteId=${t.siteId}, currentLevel=${t.currentLevel}, status=${t.status}`);
        });

        // 6. Check fuel logs with this tank
        const tankLogs = await prisma.fuelLog.findMany({
            where: { tankId: 'cmknxtc9p0001sufe6amae37c' },
            select: { id: true, siteId: true, liters: true, date: true },
            orderBy: { date: 'desc' }
        });
        console.log(`\n=== Bu Tanka ait FuelLog (${tankLogs.length} adet) ===`);
        tankLogs.forEach(l => {
            console.log(`  siteId=${l.siteId} | liters=${l.liters} | date=${l.date.toISOString()}`);
        });

        // 7. Get unique siteIds from ALL logs
        const uniqueSites = [...new Set(allLogs.map(l => l.siteId))];
        console.log(`\n=== Benzersiz siteId'ler ===`);
        for (const sid of uniqueSites) {
            const site = await prisma.site.findUnique({ where: { id: sid }, select: { name: true } });
            const count = await prisma.fuelLog.count({ where: { siteId: sid } });
            console.log(`  ${sid} -> ${site?.name || 'UNKNOWN'} (${count} kayıt)`);
        }

        // 8. FuelTransfers for this tank
        const transfers = await prisma.fuelTransfer.findMany({
            where: {
                OR: [
                    { fromId: 'cmknxtc9p0001sufe6amae37c' },
                    { toId: 'cmknxtc9p0001sufe6amae37c' }
                ]
            },
            select: { id: true, fromType: true, fromId: true, toType: true, toId: true, amount: true, date: true },
            orderBy: { date: 'desc' }
        });
        console.log(`\n=== Bu Tanka ait FuelTransfer (${transfers.length} adet) ===`);
        transfers.forEach(t => {
            console.log(`  ${t.fromType}:${t.fromId} -> ${t.toType}:${t.toId} | amount=${t.amount} | date=${t.date.toISOString()}`);
        });

    } catch (e) {
        console.error('HATA:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
