
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TARGET_IDENTIFIERS = [
    '200.3 20 Ton Paletli Ekskavator'
];

async function main() {
    console.log("Starting targeted fuel deletion...");

    const allVehicles = await prisma.vehicle.findMany();

    for (const identifier of TARGET_IDENTIFIERS) {
        console.log(`Searching for vehicle matching: '${identifier}'...`);

        // 1. Try Exact Plate
        let vehicle = allVehicles.find(v => v.plate === identifier);

        // 2. Try Model (contains)
        if (!vehicle) {
            vehicle = allVehicles.find(v => v.model && v.model.toLowerCase().includes(identifier.toLowerCase()));
        }

        // 3. Try Definition/Type match (if needed, but simple string match is usually enough for Model)
        // Let's also try checking if the identifier is part of the plate
        if (!vehicle) {
            vehicle = allVehicles.find(v => v.plate.toLowerCase().includes(identifier.toLowerCase()));
        }

        // Special case for the "200.3" part if strictly needed
        if (!vehicle && identifier.includes('200.3')) {
            vehicle = allVehicles.find(v => v.model && v.model.includes('200.3'));
        }

        if (!vehicle) {
            console.warn(`❌ Vehicle matching '${identifier}' not found!`);
            continue;
        }

        console.log(`✅ Found vehicle: ${vehicle.plate} (Model: ${vehicle.model}) (ID: ${vehicle.id})`);

        const deleteResult = await prisma.fuelLog.deleteMany({
            where: {
                vehicleId: vehicle.id
            }
        });

        console.log(`🗑️ Deleted ${deleteResult.count} fuel logs for ${vehicle.plate}.`);
    }

    console.log("Deletion process completed.");
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
