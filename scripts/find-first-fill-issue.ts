/**
 * Script: Find vehicles where a 0 km (or very low mileage) fuel log
 * acts as a false anchor in Full-to-Full consumption calculation.
 * 
 * This identifies vehicles affected by the "first fill-up included in average" bug.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Get all fuel logs with their vehicle info, sorted by vehicle then mileage desc
    const logs = await prisma.fuelLog.findMany({
        include: {
            vehicle: {
                select: { id: true, plate: true, brand: true, model: true, meterType: true }
            }
        },
        orderBy: [
            { vehicleId: 'asc' },
            { mileage: 'desc' }
        ]
    });

    // Group by vehicle
    const grouped: Record<string, typeof logs> = {};
    for (const log of logs) {
        if (!grouped[log.vehicleId]) grouped[log.vehicleId] = [];
        grouped[log.vehicleId].push(log);
    }

    console.log('=== İlk Yakıt Dolumu Ortalamaya Dahil Olan Araçlar ===\n');

    let affectedCount = 0;

    for (const [vehicleId, vLogs] of Object.entries(grouped)) {
        if (vLogs.length < 2) continue; // Need at least 2 logs

        const vehicle = vLogs[0].vehicle;

        // Logs are sorted by mileage desc. Last entry = lowest mileage
        const lowestMileageLog = vLogs[vLogs.length - 1];
        const secondLowest = vLogs[vLogs.length - 2];

        // Check if the lowest mileage log has mileage 0 or very low
        // AND the second lowest has a significantly higher mileage
        if (lowestMileageLog.mileage === 0) {
            // This is the exact JCB scenario: 0 km anchor record
            const diff = secondLowest.mileage - lowestMileageLog.mileage;
            affectedCount++;
            console.log(`🔴 ${vehicle.plate} (${vehicle.brand || ''} ${vehicle.model || ''})`);
            console.log(`   Kayıt sayısı: ${vLogs.length}`);
            console.log(`   0 Km kayıt tarihi: ${lowestMileageLog.date.toLocaleDateString('tr-TR')}`);
            console.log(`   0 Km kayıt litre: ${lowestMileageLog.liters} Lt`);
            console.log(`   0 Km kayıt fullTank: ${lowestMileageLog.fullTank}`);
            console.log(`   İlk gerçek kayıt: ${secondLowest.mileage} Km - ${secondLowest.date.toLocaleDateString('tr-TR')} - ${secondLowest.liters} Lt`);
            console.log(`   Fark (sahte mesafe): ${diff} Km`);
            console.log('');
        }
    }

    // Also check for cases where the FIRST real fill-up is the oldest full-tank
    // and there's no 0 km record, but the consumption from first fill should still be excluded
    console.log('\n=== İlk Dolumun Anchor Olarak Kullanıldığı Araçlar (0 km olmadan) ===\n');

    let potentialCount = 0;

    for (const [vehicleId, vLogs] of Object.entries(grouped)) {
        if (vLogs.length < 3) continue; // Need at least 3 for meaningful check

        const vehicle = vLogs[0].vehicle;

        // Find full-tank logs (sorted by mileage desc)
        const fullTankLogs = vLogs.filter(l => l.fullTank);
        if (fullTankLogs.length < 2) continue;

        // The OLDEST full tank log (last in desc-sorted array)
        const oldestFull = fullTankLogs[fullTankLogs.length - 1];
        const secondOldestFull = fullTankLogs[fullTankLogs.length - 2];

        // If the oldest full tank has mileage > 0 but the distance to second oldest is very large
        // relative to normal distances, it might be a "first fill" that shouldn't count
        if (oldestFull.mileage > 0) {
            const firstDist = secondOldestFull.mileage - oldestFull.mileage;

            // Calculate average distance for other full-to-full pairs
            let normalDistances: number[] = [];
            for (let i = 0; i < fullTankLogs.length - 2; i++) {
                const d = fullTankLogs[i].mileage - fullTankLogs[i + 1].mileage;
                if (d > 0) normalDistances.push(d);
            }

            if (normalDistances.length > 0) {
                const avgNormalDist = normalDistances.reduce((a, b) => a + b, 0) / normalDistances.length;

                // If first distance is more than 5x the average, flag it
                if (firstDist > avgNormalDist * 5 && firstDist > 500) {
                    potentialCount++;
                    console.log(`🟡 ${vehicle.plate} (${vehicle.brand || ''} ${vehicle.model || ''})`);
                    console.log(`   İlk dolum mesafesi: ${firstDist} Km (Ort. mesafe: ${avgNormalDist.toFixed(0)} Km)`);
                    console.log(`   İlk dolum tarihi: ${oldestFull.date.toLocaleDateString('tr-TR')} - ${oldestFull.mileage} Km`);
                    console.log(`   2. dolum: ${secondOldestFull.date.toLocaleDateString('tr-TR')} - ${secondOldestFull.mileage} Km`);
                    console.log('');
                }
            }
        }
    }

    console.log(`\n=== ÖZET ===`);
    console.log(`🔴 0 Km kayıt olan araç: ${affectedCount}`);
    console.log(`🟡 İlk dolum mesafesi çok yüksek: ${potentialCount}`);
    console.log(`Toplam araç: ${Object.keys(grouped).length}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
