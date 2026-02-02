
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting data wipe checking...');

    // 1. Wipe Fuel Data
    console.log('Deleting Fuel Transfers...');
    await prisma.fuelTransfer.deleteMany({});

    console.log('Deleting Fuel Logs...');
    await prisma.fuelLog.deleteMany({});

    console.log('Resetting Fuel Tank Levels...');
    await prisma.fuelTank.updateMany({
        data: { currentLevel: 0 }
    });

    // 2. Wipe Personnel Data
    console.log('Deleting Personnel Attendance...');
    await prisma.personnelAttendance.deleteMany({}); // Delete children first

    console.log('Deleting Personnel...');
    await prisma.personnel.deleteMany({}); // Delete parents

    console.log('Resetting Fuel Tank Levels...');
    await prisma.fuelTank.updateMany({
        data: { currentLevel: 0 }
    });

    // 3. Wipe Correspondence Data
    console.log('Deleting Correspondence...');
    await prisma.correspondence.deleteMany({});

    console.log('✅ Data wipe completed successfully.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
