
import { prisma } from '../src/lib/db';

async function main() {
    const plates = ['34-00-25-5586', '34-00-24-7675'];

    console.log('--- Warning: 3331.6 lt might be a Consumption Calculation Error ---');

    const vehicles = await prisma.vehicle.findMany({
        where: { plate: { in: plates } },
        include: {
            fuelLogs: {
                where: {
                    // match Zile site if possible, or all
                }
            }
        }
    });

    for (const v of vehicles) {
        console.log(`\nVEHICLE: ${v.plate} (Type: ${v.type}, Meter: ${v.meterType})`);

        let totalLiters = 0;
        let totalDist = 0; // Hours or Km

        // Look at logs to calculate stats
        // We need to sort logs to calc distance delta
        const sortedLogs = v.fuelLogs.sort((a, b) => a.date.getTime() - b.date.getTime());

        if (sortedLogs.length < 2) {
            console.log('Not enough logs for Delta calculation.');
            continue;
        }

        // Simple Delta Sum
        const first = sortedLogs[0];
        const last = sortedLogs[sortedLogs.length - 1];
        const dist = last.mileage - first.mileage;
        const liters = sortedLogs.reduce((acc, l) => acc + l.liters, 0);

        console.log(`Total Liters: ${liters}`);
        console.log(`Total Distance/Hours: ${dist}`);

        if (dist > 0) {
            const rawAvg = liters / dist;
            console.log(`Raw Average (Lt/Unit): ${rawAvg.toFixed(2)}`);

            const wrongAvg = rawAvg * 100;
            console.log(`If treated as KM (x100): ${wrongAvg.toFixed(2)}`);

            // Check fit for 3331.6
            // If the error quantity is 3331.6
            // Maybe Total Excess = (WrongAvg - TrueAvg) * SomeFactor? 
            // No, usually report shows Average.

            // What if 3331.6 IS the total liters consumed?
            // 45 phantom logs sum to 6124.

            // Let's check matching liters
            if (Math.abs(liters - 3331.6) < 100) console.log('>>> MATCH: Total Liters close to 3331.6');
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
