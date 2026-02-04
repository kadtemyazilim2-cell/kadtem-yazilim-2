
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const plate1 = '34-00-24-7675';
    const plate2 = '34-00-25-5586'; // 2025 T

    console.log(`Searching for vehicles: ${plate1} and ${plate2}`);

    const vehicle1 = await prisma.vehicle.findFirst({ where: { plate: plate1 } });
    const vehicle2 = await prisma.vehicle.findFirst({ where: { plate: plate2 } });

    if (!vehicle1) console.error(`Vehicle ${plate1} not found`);
    if (!vehicle2) console.error(`Vehicle ${plate2} not found`);

    if (!vehicle1 || !vehicle2) return;

    console.log(`1. ${vehicle1.plate} (${vehicle1.model}) - ID: ${vehicle1.id}`);
    console.log(`2. ${vehicle2.plate} (${vehicle2.model}) - ID: ${vehicle2.id}`);

    const start = new Date('2026-01-01');
    const end = new Date('2026-02-01');

    const logs = await prisma.fuelLog.findMany({
        where: {
            vehicleId: { in: [vehicle1.id, vehicle2.id] },
            date: { gte: start, lt: end }
        },
        orderBy: { date: 'asc' },
        include: { vehicle: true }
    });

    console.log('\n--- Fuel Logs (Jan 2026) ---');
    console.log('Date       | Liters | Vehicle         | Log ID');
    console.log('-----------|--------|-----------------|---------------------------');

    logs.forEach(log => {
        const d = log.date.toISOString().split('T')[0];
        const v = log.vehicle.plate === plate1 ? 'VEHICLE 1' : 'VEHICLE 2';
        console.log(`${d} | ${log.liters.toString().padEnd(6)} | ${log.vehicle.plate.padEnd(15)} | ${log.id}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
