
import { prisma } from '../src/lib/db';

async function main() {
    const SITE_ID = 'cmkmop3t8000bhgexg0eg90pe';
    const TANK_ID = 'cml5n44fe000113hkmv7m9plf'; // Zile 1

    console.log(`--- FIXING ZILE FUEL DISCREPANCY ---`);
    console.log(`Site: ${SITE_ID}`);
    console.log(`Target Tank: ${TANK_ID}`);

    // 1. Find Phantom Logs
    const phantomLogs = await prisma.fuelLog.findMany({
        where: {
            siteId: SITE_ID,
            tankId: null
        }
    });
    console.log(`Found ${phantomLogs.length} phantom logs.`);

    if (phantomLogs.length > 0) {
        // 2. Update Phantom Logs
        const updateResult = await prisma.fuelLog.updateMany({
            where: {
                siteId: SITE_ID,
                tankId: null
            },
            data: {
                tankId: TANK_ID
            }
        });
        console.log(`Updated ${updateResult.count} logs. Assigned to tank.`);
    }

    // 3. Recalculate Tank Stock
    console.log('\n--- Recalculating Stock for Zile 1 ---');

    // Total In (Transfers To Tank)
    const transfersIn = await prisma.fuelTransfer.aggregate({
        where: { toTankId: TANK_ID },
        _sum: { amount: true }
    });
    const totalIn = transfersIn._sum.amount || 0;
    console.log(`Total IN: ${totalIn}`);

    // Total Out (Transfers From Tank)
    const transfersOut = await prisma.fuelTransfer.aggregate({
        where: { fromTankId: TANK_ID },
        _sum: { amount: true }
    });
    const totalOut = transfersOut._sum.amount || 0;
    console.log(`Total OUT: ${totalOut}`);

    // Total Consumed (Logs from Tank)
    const logs = await prisma.fuelLog.aggregate({
        where: { tankId: TANK_ID },
        _sum: { liters: true }
    });
    const totalConsumed = logs._sum.liters || 0;
    console.log(`Total CONSUMED: ${totalConsumed}`);

    // Calculate New Level
    // Assuming starting level was 0 or contained in transfers.
    // If there's an "Initial Stock" field, we'd add it, but usually Transfer IN covers it.
    const newLevel = totalIn - totalOut - totalConsumed;
    console.log(`Calculated New Level: ${newLevel}`);

    // 4. Update Tank
    await prisma.fuelTank.update({
        where: { id: TANK_ID },
        data: { currentLevel: newLevel }
    });
    console.log('Tank Level Updated.');

}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
