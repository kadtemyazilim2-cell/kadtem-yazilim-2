
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspectIntegrity() {
    console.log("--- VEHICLES with '7675' ---");
    const vehicles = await prisma.vehicle.findMany({
        where: { plate: { contains: '7675' } },
        include: {
            _count: { select: { fuelLogs: true } }
        }
    });
    vehicles.forEach(v => {
        console.log(`[${v.id}] Plate: ${v.plate}, Status: ${v.status}, FuelLogs: ${v._count.fuelLogs}`);
    });

    console.log("\n--- SITES with 'Zile' ---");
    const sites = await prisma.site.findMany({
        where: { name: { contains: 'Zile', mode: 'insensitive' } },
        include: {
            _count: { select: { fuelLogs: true } }
        }
    });
    sites.forEach(s => {
        console.log(`[${s.id}] Name: ${s.name}, Status: ${s.status}, FuelLogs: ${s._count.fuelLogs}`);
    });

    console.log("\n--- SITES with 'Tokat' ---");
    const tokatSites = await prisma.site.findMany({
        where: { name: { contains: 'Tokat', mode: 'insensitive' } },
        include: {
            _count: { select: { fuelLogs: true } }
        }
    });
    tokatSites.forEach(s => {
        // Avoid duplicate logging if caught by 'Zile'
        if (!s.name.toLowerCase().includes('zile')) {
            console.log(`[${s.id}] Name: ${s.name}, Status: ${s.status}, FuelLogs: ${s._count.fuelLogs}`);
        }
    });
}

inspectIntegrity()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
