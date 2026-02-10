import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- STARTING PERSISTENCE CHECK ---');

    // 1. Get a valid Vehicle and Site
    const vehicle = await prisma.vehicle.findFirst();
    const site = await prisma.site.findFirst();

    if (!vehicle || !site) {
        console.error('❌ No vehicle or site found to test with.');
        return;
    }

    console.log(`✅ Using Vehicle: ${vehicle.plate} (${vehicle.id})`);
    console.log(`✅ Using Site: ${site.name} (${site.id})`);

    // 2. Define "Today" (UTC Noon)
    const today = new Date();
    const utcDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0));
    console.log(`ℹ️ Target Date (UTC Noon): ${utcDate.toISOString()}`);

    // 3. Clean up existing ANY record for this day/vehicle to start fresh
    /*
    const deleteResult = await prisma.vehicleAttendance.deleteMany({
        where: {
            vehicleId: vehicle.id,
            date: {
                gte: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0)),
                lte: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59))
            }
        }
    });
    console.log(`🧹 Cleaned up ${deleteResult.count} existing records.`);
    */

    // 4. WRITE: Attempt manual Create
    console.log('📝 Attempting CREATE...');
    try {
        const newRecord = await prisma.vehicleAttendance.create({
            data: {
                vehicleId: vehicle.id,
                siteId: site.id,
                date: utcDate,
                status: 'WORK',
                hours: 8,
                note: 'TEST_PERSISTENCE_SCRIPT'
            }
        });
        console.log('✅ CREATE Success:', newRecord.id);
    } catch (e: any) {
        console.error('❌ CREATE Failed:', e.message);
        // If it failed due to unique constraint, try UPDATE
        if (e.code === 'P2002') {
            console.log('⚠️ Unique constraint hit. Attempting findFirst + update...');
            const existing = await prisma.vehicleAttendance.findFirst({
                where: {
                    vehicleId: vehicle.id,
                    date: utcDate
                }
            });
            if (existing) {
                const updated = await prisma.vehicleAttendance.update({
                    where: { id: existing.id },
                    data: { note: 'TEST_PERSISTENCE_SCRIPT_UPDATED' }
                });
                console.log('✅ UPDATE Success:', updated.id);
            }
        }
    }

    // 5. READ: Attempt simple findFirst
    console.log('🔍 Attempting READ (Direct findFirst)...');
    const readRecord = await prisma.vehicleAttendance.findFirst({
        where: {
            vehicleId: vehicle.id,
            date: utcDate
        }
    });

    if (readRecord) {
        console.log('✅ READ Success:', readRecord);
    } else {
        console.error('❌ READ Failed: Record not found matching exact date.');
    }

    // 6. READ: Attempt Range Query (Simulating getVehicleAttendanceList)
    console.log('🔍 Attempting READ (Range Query like Server Action)...');
    const startOfDay = new Date(utcDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(utcDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const rangeRecords = await prisma.vehicleAttendance.findMany({
        where: {
            vehicleId: vehicle.id,
            date: {
                gte: startOfDay,
                lte: endOfDay
            }
        }
    });

    console.log(`Results found in range ${startOfDay.toISOString()} - ${endOfDay.toISOString()}: ${rangeRecords.length}`);
    rangeRecords.forEach(r => console.log(` - ${r.date.toISOString()} | Status: ${r.status}`));

    console.log('--- END ---');
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
