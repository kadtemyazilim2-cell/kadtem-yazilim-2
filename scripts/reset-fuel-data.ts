
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Resetting Fuel Data ---');

    // 1. Delete Fuel Logs
    const logs = await prisma.fuelLog.deleteMany();
    console.log(`Deleted ${logs.count} Fuel Logs.`);

    // 2. Delete Fuel Transfers
    const transfers = await prisma.fuelTransfer.deleteMany();
    console.log(`Deleted ${transfers.count} Fuel Transfers.`);

    // 3. Reset Fuel Tanks
    const tanks = await prisma.fuelTank.updateMany({
        data: { currentLevel: 0 }
    });
    console.log(`Reset ${tanks.count} Fuel Tanks to 0 level.`);

    // 4. Reset Vehicle KMs? 
    // The user said "Fuel Data". Resetting Vehicle KM might be destructive if they had manual entries.
    // However, the import script updated KMs. 
    // Ideally we shouldn't revert KMs automatically as we don't know the "before" state easily without snapshots.
    // I will skip resetting Vehicle KMs unless explicitly asked, as that's "Vehicle Data" more than "Fuel Data".
    console.log('--- Reset Complete ---');
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
