
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SITE_NAME_PART = "Tokat Zile Ovası 1 Kısım";

async function main() {
    // 1. Find Site and its FuelTanks
    const site = await prisma.site.findFirst({
        where: { name: { contains: SITE_NAME_PART } },
        include: {
            fuelTanks: {
                include: {
                    transfersIn: {
                        include: {
                            fromTank: { include: { site: true } },
                            fromVehicle: true
                        }
                    },
                    transfersOut: {
                        include: {
                            toTank: { include: { site: true } },
                            toVehicle: true
                        }
                    }
                }
            },
            fuelLogs: { include: { vehicle: true } }
        }
    });

    if (!site) {
        console.error("Site not found!");
        return;
    }

    console.log(`Site: ${site.name} (${site.id})`);

    // Flatten Transfers
    const incoming: any[] = [];
    const outgoing: any[] = [];

    // Since we already included transfersIn/Out in the site query, we can use them directly?
    // Wait, the nested include structure was: site -> fuelTanks -> transfersIn/Out
    // BUT, Prisma might not effectively load ALL transfers if we just rely on include for complex conditions.
    // However, for debugging this site, it should be fine.

    // Let's use the loaded data first.
    for (const tank of site.fuelTanks) {
        // We need to re-fetch if we want to be 100% sure, or trust the include.
        // Trust the include for now.
        if (tank.transfersIn) incoming.push(...tank.transfersIn);
        if (tank.transfersOut) outgoing.push(...tank.transfersOut);
    }

    // Also fetch transfers where this site MIGHT be involved but not via Tank? 
    // No, transfers are tank-to-tank or vehicle-to-tank.

    console.log(`\n--- Incoming Transfers (+) ---`);
    let totalIncoming = 0;
    for (const t of incoming.sort((a, b) => a.date - b.date)) {
        totalIncoming += t.amount;
        let sourceName = "Unknown";
        if (t.fromTank) sourceName = `Tank: ${t.fromTank.name} (${t.fromTank.site?.name})`;
        else if (t.fromVehicle) sourceName = `Vehicle: ${t.fromVehicle.plate}`;
        else if (t.fromType === 'EXTERNAL') sourceName = "External/Station";
        else sourceName = `${t.fromType} ${t.fromId || ''}`;

        console.log(`${t.date.toISOString().slice(0, 16)} | +${t.amount.toFixed(2)} | From: ${sourceName} | ${t.description || ''}`);
    }
    console.log(`Total Incoming: ${totalIncoming.toFixed(2)}`);

    console.log(`\n--- Outgoing Transfers (-) ---`);
    let totalOutgoing = 0;
    for (const t of outgoing.sort((a, b) => a.date - b.date)) {
        totalOutgoing += t.amount;
        let targetName = "Unknown";
        if (t.toTank) targetName = `Tank: ${t.toTank.name} (${t.toTank.site?.name})`;
        else if (t.toVehicle) targetName = `Vehicle: ${t.toVehicle.plate}`;
        else targetName = `${t.toType} ${t.toId || ''}`;

        console.log(`${t.date.toISOString().slice(0, 16)} | -${t.amount.toFixed(2)} | To: ${targetName} | ${t.description || ''}`);
    }
    console.log(`Total Outgoing: ${totalOutgoing.toFixed(2)}`);

    // Consumption
    console.log(`\n--- Consumption (Logs) ---`);
    let totalConsumption = 0;
    for (const log of site.fuelLogs.sort((a, b) => a.date.getTime() - b.date.getTime())) {
        totalConsumption += log.liters;
        // console.log(`${log.date.toISOString().slice(0, 16)} | -${log.liters} | ${log.vehicle.plate}`);
    }
    console.log(`Total Consumption: ${totalConsumption.toFixed(2)}`);

    // Balance
    const balance = totalIncoming - totalOutgoing - totalConsumption;
    console.log(`\n--- Balance Calculation ---`);
    console.log(`Incoming (${totalIncoming.toFixed(2)}) - Outgoing (${totalOutgoing.toFixed(2)}) - Consumption (${totalConsumption.toFixed(2)})`);
    console.log(`Calculated Stock: ${balance.toFixed(2)}`);

    // Specific check for user mentioned transfer
    console.log(`\nChecking specific transfer: 11,070.8 Lt`);
    const found11k = incoming.find(t => Math.abs(t.amount - 11070.8) < 1);
    if (found11k) {
        console.log(`MATCH FOUND: 11070.8 Lt on ${found11k.date.toISOString()}`);
    } else {
        console.log(`MATCH NOT FOUND for 11070.8 Lt.`);
    }

    // Checking excess difference
    const TARGET_EXCESS = 3331.6;
    console.log(`Checking excess: ${TARGET_EXCESS}`);
    console.log(`Diff if we remove 11070.8: ${(balance - 11070.8).toFixed(2)}`);
    console.log(`Current Balance - Excess = ${(balance - TARGET_EXCESS).toFixed(2)}`);

}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
