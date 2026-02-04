
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const start = new Date('2026-01-19T00:00:00.000Z');
    const end = new Date('2026-01-19T23:59:59.999Z');

    const logId = 'cml67wpw0000jwdsoxmpvckbh'; // 106 lt log
    const targetPlate = '34-00-24-7675';

    const log = await prisma.fuelLog.findUnique({
        where: { id: logId }
    });

    const targetVehicle = await prisma.vehicle.findFirst({
        where: { plate: targetPlate }
    });

    if (log && targetVehicle) {
        console.log(`Moving Log ${logId} from Vehicle ${log.vehicleId} to ${targetVehicle.plate} (${targetVehicle.id})...`);
        await prisma.fuelLog.update({
            where: { id: logId },
            data: { vehicleId: targetVehicle.id }
        });
        console.log("Success.");
    } else {
        console.error("Log or Target Vehicle not found.");
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
