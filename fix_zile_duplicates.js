
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- FIXING ZILE DUPLICATES (Fiat Hitachi 200.3 -> 34-00-25-5586) ---');

    // 1. Identify Vehicles
    const fiatHitachi = await prisma.vehicle.findFirst({
        where: {
            OR: [
                { plate: { contains: '200.3' } },
                { plate: { contains: 'Hitachi' } }
            ],
            NOT: { plate: { contains: '06 DGG 821' } } // Exclude target if names overlap
        }
    });

    // Target: 2025 T (34-00-25-5586)
    // Verify target with plate
    const targetVehicle = await prisma.vehicle.findFirst({
        where: { plate: { contains: '34-00-25-5586' } }
    });

    if (!fiatHitachi || !targetVehicle) {
        console.error('❌ Could not find source or target vehicle.');
        console.log('Source:', fiatHitachi);
        console.log('Target:', targetVehicle);
        return;
    }

    console.log(`Source: ${fiatHitachi.plate} (ID: ${fiatHitachi.id})`);
    console.log(`Target: ${targetVehicle.plate} (ID: ${targetVehicle.id})`);

    // 2. Fetch Logs
    const sourceLogs = await prisma.fuelLog.findMany({ where: { vehicleId: fiatHitachi.id } });
    const targetLogs = await prisma.fuelLog.findMany({ where: { vehicleId: targetVehicle.id } });

    console.log(`Source Logs: ${sourceLogs.length}`);
    console.log(`Target Logs: ${targetLogs.length}`);

    // 3. Find Conflicts (Same Date)
    const targetDates = new Set(targetLogs.map(l => l.date.toISOString().split('T')[0]));

    const logsToDelete = [];
    const logsToMove = [];

    for (const log of sourceLogs) {
        const dateStr = log.date.toISOString().split('T')[0];
        if (targetDates.has(dateStr)) {
            // Conflict! Target already has data for this day.
            // Mark source log for deletion to avoid double counting.
            logsToDelete.push(log);
        } else {
            // No conflict. This data is unique to source.
            // Move it to target.
            logsToMove.push(log);
        }
    }

    console.log(`\n--- ACTION PLAN ---`);
    console.log(`DELETE ${logsToDelete.length} duplicate logs from Source.`);
    logsToDelete.forEach(l => console.log(`   - Delete: ${l.date.toISOString().split('T')[0]} | ${l.liters}L`));

    console.log(`MOVE ${logsToMove.length} unique logs from Source to Target.`);
    // logsToMove.forEach(l => console.log(`   - Move: ${l.date.toISOString().split('T')[0]} | ${l.liters}L`));

    // 4. Execute
    if (logsToDelete.length > 0) {
        const deleteIds = logsToDelete.map(l => l.id);
        await prisma.fuelLog.deleteMany({ where: { id: { in: deleteIds } } });
        console.log('✅ Deleted duplicate logs.');
    }

    if (logsToMove.length > 0) {
        const moveIds = logsToMove.map(l => l.id);
        await prisma.fuelLog.updateMany({
            where: { id: { in: moveIds } },
            data: { vehicleId: targetVehicle.id }
        });
        console.log('✅ Moved unique logs to target vehicle.');
    }

    // Optional: Check if source vehicle should be deleted?
    // Only if it has no other relations.
    // For now, let's just clean the logs.
    const remainingLogs = await prisma.fuelLog.count({ where: { vehicleId: fiatHitachi.id } });
    console.log(`Remaining Logs on Source: ${remainingLogs}`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
