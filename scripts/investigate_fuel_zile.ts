
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SITE_NAME_PART = "Tokat Zile Ovası 1 Kısım";

async function main() {
    const site = await prisma.site.findFirst({
        where: { name: { contains: SITE_NAME_PART } },
        include: {
            fuelLogs: {
                include: {
                    vehicle: true
                }
            }
        }
    });

    if (!site) {
        console.error("Site not found!");
        return;
    }

    console.log(`Site: ${site.name} (${site.id})`);
    console.log(`Total Logs: ${site.fuelLogs.length}`);

    const totalLiters = site.fuelLogs.reduce((sum, log) => sum + log.liters, 0);
    console.log(`Total Liters: ${totalLiters.toFixed(2)}`);

    // Group by Vehicle
    const byVehicle: Record<string, { plate: string, liters: number, count: number }> = {};

    for (const log of site.fuelLogs) {
        const vid = log.vehicleId;
        if (!byVehicle[vid]) {
            byVehicle[vid] = {
                plate: log.vehicle.plate,
                liters: 0,
                count: 0
            };
        }
        byVehicle[vid].liters += log.liters;
        byVehicle[vid].count++;
    }

    console.log("\n--- By Vehicle ---");
    Object.values(byVehicle).forEach(v => {
        console.log(`${v.plate}: ${v.liters.toFixed(2)} liters (${v.count} logs)`);
    });

    // List all logs sorted by Date
    console.log("\n--- Detailed Logs ---");
    const allLogs = site.fuelLogs.sort((a, b) => a.date.getTime() - b.date.getTime());

    for (const log of allLogs) {
        console.log(`${log.date.toISOString()} | ${log.vehicle.plate} | ${log.liters} L | ${log.description || ''}`);
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
