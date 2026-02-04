
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- ANALYZING ZILE FUEL MOVEMENTS ---');

    // 1. Find Site
    const sites = await prisma.site.findMany(); // Get ALL sites to debug names

    // Filter in JS to avoid Prisma case sensitivity issues
    const allSites = sites;
    const zileSites = allSites.filter(s => s.name.toLocaleLowerCase('tr-TR').includes('zile'));

    if (zileSites.length === 0) {
        console.log('❌ Site not found! available sites:');
        allSites.forEach(s => console.log(`- ${s.name}`));
        return;
    }

    for (const site of zileSites) {
        console.log(`\nSITE: ${site.name} (ID: ${site.id})`);

        // 2. Tank Levels
        const tanks = await prisma.fuelTank.findMany({ where: { siteId: site.id } });
        console.log('--- TANKS ---');
        let totalTankLevel = 0;
        tanks.forEach(t => {
            console.log(`- ${t.name}: ${t.currentLevel} Liters (Capacity: ${t.capacity})`);
            totalTankLevel += t.currentLevel;
        });

        // 3. Incoming Transfers (TO this site)
        // FuelTransfer doesn't have siteId directly, usually linked via Tank or Vehicle.
        // But if it's "TO SITE", it usually means TO TANK related to site.
        const tankIds = tanks.map(t => t.id);

        const incomingTransfers = await prisma.fuelTransfer.findMany({
            where: {
                toType: 'TANK',
                toId: { in: tankIds }
            }
        });

        const outgoingTransfersToVehicles = await prisma.fuelTransfer.findMany({
            where: {
                fromType: 'TANK',
                fromId: { in: tankIds },
                toType: 'VEHICLE'
            }
        });

        const otherOutgoingTransfers = await prisma.fuelTransfer.findMany({
            where: {
                fromType: 'TANK',
                fromId: { in: tankIds },
                toType: { not: 'VEHICLE' }
            }
        });


        // 4. Fuel Logs (Consumption from Internal Tank)
        const fuelLogs = await prisma.fuelLog.findMany({
            where: {
                tankId: { in: tankIds }
            }
        });

        console.log('\n--- CALCULATIONS ---');
        const totalIncoming = incomingTransfers.reduce((sum, t) => sum + t.amount, 0);
        const totalOutgoingVehicle = outgoingTransfersToVehicles.reduce((sum, t) => sum + t.amount, 0);
        const totalOutgoingOther = otherOutgoingTransfers.reduce((sum, t) => sum + t.amount, 0);
        const totalFuelLog = fuelLogs.reduce((sum, l) => sum + l.liters, 0);

        console.log(`Total Initial (Assume 0 for now): 0`);
        console.log(`Total Incoming (Transfers In): +${totalIncoming}`);
        console.log(`Total Outgoing (Transfer to Vehicle): -${totalOutgoingVehicle}`);
        console.log(`Total Outgoing (Transfer Other): -${totalOutgoingOther}`);
        console.log(`Total Consumption (Direct Logs from Tank): -${totalFuelLog}`);

        const calculatedBalance = totalIncoming - totalOutgoingVehicle - totalOutgoingOther - totalFuelLog;
        // Note: Direct Logs and Transfer-to-Vehicle might double count if logic is duplicated. 
        // Usually, filling a vehicle from tank creates a FuelLog AND updates Tank. 
        // Or it creates a Transfer. System design check needed.
        // Current system: createFuelLog with tankId -> decreases Tank Level. (It's a Log, not a Transfer)
        // createFuelTransfer Tank->Vehicle -> decreases Tank Level.

        console.log(`\nCalculated Logical Balance: ${calculatedBalance}`);
        console.log(`Actual Tank Level Total: ${totalTankLevel}`);
        console.log(`Difference: ${totalTankLevel - calculatedBalance}`);

        console.log('\n--- DETAILS (Incoming) ---');
        incomingTransfers.forEach(t => console.log(`+ ${t.amount} L (${t.date.toISOString().split('T')[0]}) - Desc: ${t.description}`));

        console.log('\n--- DETAILS (Outgoing - Transfer) ---');
        outgoingTransfersToVehicles.forEach(t => console.log(`- ${t.amount} L (${t.date.toISOString().split('T')[0]}) -> Vehicle `));
        otherOutgoingTransfers.forEach(t => console.log(`- ${t.amount} L (${t.date.toISOString().split('T')[0]}) -> Other `));

        console.log('\n--- DETAILS (Outgoing - Logs) ---');
        // Group logs by vehicle for brevity if too many
        const logSum = fuelLogs.length;
        console.log(`Total ${logSum} logs consuming ${totalFuelLog} Liters.`);

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
