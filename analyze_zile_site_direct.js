
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- ANALYZING ZILE FUEL (DIRECT SITE) ---');

    // 1. Find Site
    const allSites = await prisma.site.findMany();
    const zileSites = allSites.filter(s => s.name.toLocaleLowerCase('tr-TR').includes('zile'));

    if (zileSites.length === 0) {
        console.log('❌ Site not found!');
        return;
    }

    for (const site of zileSites) {
        console.log(`\nSITE: ${site.name} (ID: ${site.id})`);

        // 2. Direct Fuel Logs (Consumed AT this site, regardless of tank)
        const fuelLogs = await prisma.fuelLog.findMany({
            where: { siteId: site.id },
            include: { vehicle: true }
        });

        // 3. Transfers (Check if any transfer is conceptually LINKED to this site)
        // This is harder because Transfers don't have siteId. 
        // But we can check TANK transfers where Tank belongs to site.
        const tanks = await prisma.fuelTank.findMany({ where: { siteId: site.id } });
        const tankIds = tanks.map(t => t.id);

        let incomingToTank = [];
        let outgoingFromTank = [];

        if (tankIds.length > 0) {
            incomingToTank = await prisma.fuelTransfer.findMany({
                where: { toType: 'TANK', toId: { in: tankIds } }
            });
            outgoingFromTank = await prisma.fuelTransfer.findMany({
                where: { fromType: 'TANK', fromId: { in: tankIds }, toType: 'VEHICLE' }
            });
        }

        console.log('\n--- DATA ---');
        const totalLogs = fuelLogs.reduce((acc, l) => acc + l.liters, 0);
        console.log(`Total Fuel Consumed (Logs with siteId): ${totalLogs.toFixed(2)} L`);

        const totalIncoming = incomingToTank.reduce((acc, t) => acc + t.amount, 0);
        console.log(`Total Incoming to Tank: ${totalIncoming.toFixed(2)} L`);

        const totalOutgoing = outgoingFromTank.reduce((acc, t) => acc + t.amount, 0);
        console.log(`Total Outgoing from Tank: ${totalOutgoing.toFixed(2)} L`);

        const tankLevel = tanks.reduce((acc, t) => acc + t.currentLevel, 0);
        console.log(`Current Tank Level: ${tankLevel} L`);

        // Discrepancy Logic
        // Balance = Incoming - Outgoing - (Logs FROM TANK)
        // Note: logs from tank are ones where log.tankId is in tankIds
        const logsFromTank = fuelLogs.filter(l => l.tankId && tankIds.includes(l.tankId));
        const totalLogsFromTank = logsFromTank.reduce((acc, l) => acc + l.liters, 0);

        console.log(`Logs specifically from Site Tanks: ${totalLogsFromTank.toFixed(2)} L`);

        const calculatedBalance = totalIncoming - totalOutgoing - totalLogsFromTank;
        const diff = tankLevel - calculatedBalance;

        console.log(`\nStart Balance: 0`);
        console.log(`+ In: ${totalIncoming}`);
        console.log(`- Out (Transfer): ${totalOutgoing}`);
        console.log(`- Out (Consumption): ${totalLogsFromTank}`);
        console.log(`= Calc Balance: ${calculatedBalance}`);
        console.log(`ACTUAL Level: ${tankLevel}`);
        console.log(`DIFFERENCE: ${diff.toFixed(2)}`);

        if (Math.abs(diff) > 1) {
            console.log('⚠️ SIGNIFICANT DISCREPANCY DETECTED');
        }

        // List Logs for Detail
        // console.log('Logs:', fuelLogs.map(l => `${l.liters}L (${l.vehicle?.plate})`));
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
