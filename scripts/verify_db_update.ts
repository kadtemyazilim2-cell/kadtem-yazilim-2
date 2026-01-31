import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Check specific vehicle that was updated in the logs
    const plate = "34 GF 3763";
    const vehicle = await prisma.vehicle.findUnique({
        where: { plate: plate }
    });

    if (vehicle) {
        console.log(`Verification for ${plate}:`);
        console.log(`  Insurance Expiry: ${vehicle.insuranceExpiry}`);
        console.log(`  Inspection Expiry: ${vehicle.inspectionExpiry}`);
        console.log(`  Vehicle Card Expiry: ${vehicle.vehicleCardExpiry}`);
    } else {
        console.log(`Vehicle ${plate} not found in DB.`);
    }

    // Check another one
    const plate2 = "60 AFA 401";
    const vehicle2 = await prisma.vehicle.findUnique({
        where: { plate: plate2 }
    });
    if (vehicle2) {
        console.log(`Verification for ${plate2}:`);
        console.log(`  Insurance Expiry: ${vehicle2.insuranceExpiry}`);
        console.log(`  Kasko Expiry: ${vehicle2.kaskoExpiry}`);
        console.log(`  Inspection Expiry: ${vehicle2.inspectionExpiry}`);
        console.log(`  Vehicle Card Expiry: ${vehicle2.vehicleCardExpiry}`);
    } else {
        console.log(`Vehicle ${plate2} not found in DB.`);
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
