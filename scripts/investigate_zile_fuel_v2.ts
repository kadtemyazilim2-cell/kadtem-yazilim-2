
import { prisma } from '../src/lib/db';

async function main() {
    const SITE_ID = 'cmkmop3t8000bhgexg0eg90pe';
    const site = await prisma.site.findUnique({
        where: { id: SITE_ID },
        include: { fuelTanks: true }
    });

    if (!site) return;
    const tankIds = site.fuelTanks.map(t => t.id);
    console.log(`Tanks: ${tankIds.join(', ')}`);

    // Consumption by Site ID
    const consumptionBySite = await prisma.fuelLog.aggregate({
        where: { siteId: SITE_ID },
        _sum: { liters: true }
    });
    console.log(`Consumption (SiteId match): ${consumptionBySite._sum.liters}`);

    // Consumption by Tank ID
    if (tankIds.length > 0) {
        const consumptionByTank = await prisma.fuelLog.aggregate({
            where: { tankId: { in: tankIds } },
            _sum: { liters: true }
        });
        console.log(`Consumption (TankId match): ${consumptionByTank._sum.liters}`);

        const siteTotal = consumptionBySite._sum.liters || 0;
        const tankTotal = consumptionByTank._sum.liters || 0;

        if (Math.abs(siteTotal - tankTotal) > 0.1) {
            console.log(`MISMATCH DETECTED: Diff = ${siteTotal - tankTotal}`);

            // Find logs that are in Site but NOT in Tank list (or vice versa)
            // Usually means tankId is null or different
            const phantomLogs = await prisma.fuelLog.findMany({
                where: {
                    siteId: SITE_ID,
                    OR: [
                        { tankId: null },
                        { tankId: { notIn: tankIds } }
                    ]
                },
                include: { vehicle: true }
            });
            console.log(`Logs with Mismatched Tank ID (${phantomLogs.length}):`);
            phantomLogs.forEach(l => console.log(`- [${l.date.toISOString().split('T')[0]}] ${l.liters} lt - ${l.vehicle?.plate} (Tank: ${l.tankId})`));
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
