
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SOURCE_ID = "v_ik_2"; // No Plate, 85 Attendance
const TARGET_ID = "cml5mispb0001g8lo9sg6st7j"; // "Fiat Hitachi 200.3", 19 Fuel Logs

async function main() {
    console.log(`Merging ${SOURCE_ID} -> ${TARGET_ID}...`);

    // 1. Verify Source and Target exist
    const source = await prisma.vehicle.findUnique({ where: { id: SOURCE_ID }, include: { _count: true } });
    const target = await prisma.vehicle.findUnique({ where: { id: TARGET_ID }, include: { _count: true } });

    if (!source || !target) {
        console.error("Source or Target vehicle not found!");
        return;
    }

    console.log(`Source: ${source.plate} (${source.model}) - Attendance: ${source._count.attendance}`);
    console.log(`Target: ${target.plate} (${target.model}) - Logs: ${target._count.fuelLogs}`);

    // 2. Transfer Attendance
    const updateAttendance = await prisma.vehicleAttendance.updateMany({
        where: { vehicleId: SOURCE_ID },
        data: { vehicleId: TARGET_ID }
    });
    console.log(`Transferred ${updateAttendance.count} attendance records.`);

    // 3. Transfer Fuel Logs (if any)
    const updateFuel = await prisma.fuelLog.updateMany({
        where: { vehicleId: SOURCE_ID },
        data: { vehicleId: TARGET_ID }
    });
    console.log(`Transferred ${updateFuel.count} fuel logs.`);

    // 4. Transfer Assignments (if any)
    const updateAssignments = await prisma.vehicleAssignmentHistory.updateMany({
        where: { vehicleId: SOURCE_ID },
        data: { vehicleId: TARGET_ID }
    });
    console.log(`Transferred ${updateAssignments.count} assignment history records.`);

    // 5. Transfer Fuel Transfers (Incoming/Outgoing)
    const updateTransfersIn = await prisma.fuelTransfer.updateMany({
        where: { toVehicleId: SOURCE_ID },
        data: { toVehicleId: TARGET_ID }
    });
    console.log(`Transferred ${updateTransfersIn.count} incoming transfers.`);

    const updateTransfersOut = await prisma.fuelTransfer.updateMany({
        where: { fromVehicleId: SOURCE_ID },
        data: { fromVehicleId: TARGET_ID }
    });
    console.log(`Transferred ${updateTransfersOut.count} outgoing transfers.`);

    // 6. Delete Source Vehicle
    console.log(`Deleting source vehicle ${SOURCE_ID}...`);
    await prisma.vehicle.delete({
        where: { id: SOURCE_ID }
    });
    console.log("Source vehicle deleted successfully.");

}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
