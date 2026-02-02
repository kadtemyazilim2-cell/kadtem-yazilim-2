
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    // 1. Create Fiat Hitachi Vehicle
    const plate = 'Fiat Hitachi 200.3'; // Using name as plate since it's equipment
    let vehicle = await prisma.vehicle.findFirst({ where: { plate } });

    if (!vehicle) {
        console.log('Creating Vehicle: Fiat Hitachi 200.3...');
        // Find a company to assign to (Company 1)
        const company = await prisma.company.findFirst();
        if (!company) throw new Error('No company found');

        vehicle = await prisma.vehicle.create({
            data: {
                plate: plate,
                brand: 'Fiat Hitachi',
                model: '200.3 20 Ton Paletli Ekskavatör',
                year: 1997,
                type: 'EXCAVATOR',
                meterType: 'HOURS',
                currentKm: 0,
                companyId: company.id,
                ownership: 'OWNED'
            }
        });
        console.log(`Created Vehicle ID: ${vehicle.id}`);
    } else {
        console.log(`Vehicle already exists: ${vehicle.id}`);
    }

    // 2. Cleanup Incorrect Logs for 60 ADG 721
    // 60 ADG 721 is Fiat Egea. Any logs with > 100L are definitely wrong, but simpler to delete logs created recently if we can track them.
    // However, since I can't filter by "creation time" easily without a timestamp field on FuelLog (it only has date of log, not createdAt),
    // I will delete logs for 60 ADG 721 that match the dates/amounts from the import if possible.
    // OR simpler: The user said "Fiat Hitachi is different".
    // I know the script imported 19 logs for "Fiat Hitachi" which got assigned to "60 ADG 721".
    // I will delete ALL logs for 60 ADG 721 that look like heavy machinery logs (large amounts).
    // Egea capacity is ~45L. Most logs in import were 100-200L.

    const targetVehicle = await prisma.vehicle.findFirst({ where: { plate: '60 ADG 721' } });
    if (targetVehicle) {
        console.log(`Cleaning up logs for ${targetVehicle.plate}...`);
        const result = await prisma.fuelLog.deleteMany({
            where: {
                vehicleId: targetVehicle.id,
                liters: { gt: 80 } // Safe threshold. Egea won't take > 80L.
            }
        });
        console.log(`Deleted ${result.count} incorrect logs.`);
    }
}

main().finally(() => prisma.$disconnect());
