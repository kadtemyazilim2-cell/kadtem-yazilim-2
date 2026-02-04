
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const targetPlate = '34-00-25-5586';
    // Find the ghost vehicle. User said plate " - " or model "200.3..."
    // Let's search loosely first

    const targetVehicle = await prisma.vehicle.findFirst({
        where: { plate: targetPlate }
    });

    if (!targetVehicle) {
        console.error(`Target vehicle ${targetPlate} not found!`);
        return;
    }
    console.log(`Target: ${targetVehicle.plate} (${targetVehicle.model}) - ID: ${targetVehicle.id}`);

    // Find Ghost
    // Look for vehicles with special characters in plate or generic model
    const ghostVehicle = await prisma.vehicle.findFirst({
        where: {
            OR: [
                { plate: '-' },
                { plate: { contains: '200.3', mode: 'insensitive' } }, // Searching by plate just in case
                { model: { contains: '200.3', mode: 'insensitive' } }
            ],
            NOT: {
                id: targetVehicle.id
            }
        }
    });

    if (!ghostVehicle) {
        console.error("Ghost vehicle not found (searched for plate '-' or model '200.3')");
        // List potential candidates?
        return;
    }
    console.log(`Ghost Found: ${ghostVehicle.plate} (${ghostVehicle.model}) - ID: ${ghostVehicle.id}`);

    // 1. Move Fuel Logs
    const fuelLogs = await prisma.fuelLog.findMany({
        where: { vehicleId: ghostVehicle.id }
    });
    console.log(`Found ${fuelLogs.length} fuel logs on ghost.`);

    if (fuelLogs.length > 0) {
        console.log("Moving fuel logs...");
        await prisma.fuelLog.updateMany({
            where: { vehicleId: ghostVehicle.id },
            data: { vehicleId: targetVehicle.id }
        });
        console.log("Fuel logs moved.");
    }

    // 2. Move Attendance
    const ghostAttendance = await prisma.vehicleAttendance.findMany({
        where: { vehicleId: ghostVehicle.id }
    });
    console.log(`Found ${ghostAttendance.length} attendance records on ghost.`);

    for (const record of ghostAttendance) {
        // Check conflict
        const existing = await prisma.vehicleAttendance.findFirst({
            where: {
                vehicleId: targetVehicle.id,
                date: record.date,
                siteId: record.siteId
            }
        });

        if (existing) {
            console.log(`Conflict on ${record.date.toISOString().split('T')[0]}: Target has record. Deleting ghost record.`);
            await prisma.vehicleAttendance.delete({ where: { id: record.id } });
        } else {
            console.log(`Moving attendance record for ${record.date.toISOString().split('T')[0]}...`);
            await prisma.vehicleAttendance.update({
                where: { id: record.id },
                data: { vehicleId: targetVehicle.id }
            });
        }
    }

    console.log("Merge completed.");
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
