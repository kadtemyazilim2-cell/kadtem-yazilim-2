
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- STARTING DATA SYNC ---');

    // 1. Fix 60 AJ 433
    console.log('\n1. Updating 60 AJ 433...');
    try {
        const vehicle = await prisma.vehicle.findFirst({ where: { plate: '60 AJ 433' } });
        if (vehicle) {
            await prisma.vehicle.update({
                where: { id: vehicle.id },
                data: {
                    ownership: 'RENTAL',
                    rentalCompanyName: 'KADIOĞLU İNŞAAT',
                    // Reset fields relevant to OWNED if necessary, but keep it safe
                }
            });
            console.log('✅ Updated 60 AJ 433 to RENTAL - KADIOĞLU İNŞAAT');
        } else {
            console.log('❌ Vehicle 60 AJ 433 not found!');
        }
    } catch (e) {
        console.error('Error fixing vehicle:', e);
    }

    // 2. Sync KMs from Fuel Logs
    console.log('\n2. Syncing Vehicle KMs from Fuel Logs...');
    const vehicles = await prisma.vehicle.findMany();
    let updatedCount = 0;

    for (const v of vehicles) {
        // Find latest log with mileage
        const latestLog = await prisma.fuelLog.findFirst({
            where: {
                vehicleId: v.id,
                mileage: { gt: 0 }
            },
            orderBy: { date: 'desc' }, // Get most recent log
            take: 1
        });

        if (latestLog && latestLog.mileage) {
            // Logic: Update if fuel log KM is known and usually we want the latest info.
            // Safest constraint: Only update if it's INCREASING the value (assuming cars don't drive backwards)
            // Or if previous value was 0/null.
            const current = v.currentKm || 0;

            if (latestLog.mileage > current) {
                await prisma.vehicle.update({
                    where: { id: v.id },
                    data: { currentKm: latestLog.mileage }
                });
                console.log(`✅ ${v.plate}: Updated ${current} -> ${latestLog.mileage} (Log Date: ${latestLog.date.toISOString().split('T')[0]})`);
                updatedCount++;
            } else {
                // Optional: log if current is higher (maybe manual update was newer)
                // console.log(`Skipping ${v.plate}: Current (${current}) >= Log (${latestLog.mileage})`);
            }
        }
    }

    console.log(`\n--- COMPLETE: ${updatedCount} vehicles updated ---`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
