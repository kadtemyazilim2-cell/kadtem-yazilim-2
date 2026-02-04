
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // IDs from previous diagnosis
    const log1Id = 'cml67wpw0000jwdsoxmpvckbh'; // Currently 34-00-24-7675 (106 lt)
    const log2Id = 'cml67wp3b000hwdsoy8i9wwxx'; // Currently 34-00-25-5586 (190 lt)

    const log1 = await prisma.fuelLog.findUnique({ where: { id: log1Id } });
    const log2 = await prisma.fuelLog.findUnique({ where: { id: log2Id } });

    if (!log1 || !log2) {
        console.error("Logs not found");
        return;
    }

    const vehicle1Id = log1.vehicleId;
    const vehicle2Id = log2.vehicleId;

    console.log(`Swapping assignments...`);
    console.log(`Log ${log1Id} (${log1.liters}lt): ${vehicle1Id} -> ${vehicle2Id}`);
    console.log(`Log ${log2Id} (${log2.liters}lt): ${vehicle2Id} -> ${vehicle1Id}`);

    // Swap
    await prisma.$transaction([
        prisma.fuelLog.update({
            where: { id: log1Id },
            data: { vehicleId: vehicle2Id }
        }),
        prisma.fuelLog.update({
            where: { id: log2Id },
            data: { vehicleId: vehicle1Id }
        })
    ]);

    console.log("Swap completed.");
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
