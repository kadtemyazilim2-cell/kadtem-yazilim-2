// Standalone Prisma script - no Next.js imports
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('=== DB Direct Check: Vehicle Attendance Records for Feb 2026 ===\n');

    // 1. Count total records
    const totalCount = await prisma.vehicleAttendance.count();
    console.log(`Total VehicleAttendance records in DB: ${totalCount}`);

    // 2. Get Feb 2026 records
    const febRecords = await prisma.vehicleAttendance.findMany({
        where: {
            date: {
                gte: new Date('2026-02-01T00:00:00.000Z'),
                lte: new Date('2026-02-28T23:59:59.999Z')
            }
        },
        include: { vehicle: { select: { plate: true } } },
        orderBy: [{ date: 'asc' }]
    });

    console.log(`Feb 2026 records: ${febRecords.length}\n`);

    if (febRecords.length === 0) {
        console.log('❌ NO RECORDS FOUND FOR FEB 2026! Data is NOT being saved.');

        // Check last 10 records regardless of date
        const lastRecords = await prisma.vehicleAttendance.findMany({
            take: 10,
            orderBy: { date: 'desc' },
            include: { vehicle: { select: { plate: true } } }
        });

        if (lastRecords.length > 0) {
            console.log('\nLast 10 records in DB (any date):');
            lastRecords.forEach(r => {
                console.log(`  ${r.vehicle.plate} | ${r.date.toISOString()} | ${r.status} | siteId: ${r.siteId}`);
            });
        } else {
            console.log('The VehicleAttendance table is COMPLETELY EMPTY.');
        }
        return;
    }

    // 3. Group by vehicle plate and show
    const grouped: Record<string, typeof febRecords> = {};
    for (const r of febRecords) {
        const plate = r.vehicle.plate;
        if (!grouped[plate]) grouped[plate] = [];
        grouped[plate].push(r);
    }

    for (const [plate, records] of Object.entries(grouped)) {
        console.log(`--- ${plate} (${records.length} records) ---`);
        for (const r of records) {
            const d = r.date;
            console.log(`  Day ${d.getUTCDate().toString().padStart(2, '0')} | ${d.toISOString()} | Status: ${r.status} | Site: ${r.siteId}`);
        }
        console.log('');
    }

    // 4. Check for duplicate dates (same vehicle, same day, different times)
    console.log('\n=== Checking for Duplicate Day Entries ===');
    let dupeCount = 0;
    for (const [plate, records] of Object.entries(grouped)) {
        const dayMap = new Map<number, typeof febRecords>();
        for (const r of records) {
            const day = r.date.getUTCDate();
            if (!dayMap.has(day)) dayMap.set(day, []);
            dayMap.get(day)!.push(r);
        }
        for (const [day, recs] of dayMap.entries()) {
            if (recs.length > 1) {
                dupeCount++;
                console.log(`⚠️ DUPLICATE: ${plate} Day ${day} has ${recs.length} records:`);
                recs.forEach(r => console.log(`    ${r.date.toISOString()} | ${r.status} | ID: ${r.id}`));
            }
        }
    }
    if (dupeCount === 0) {
        console.log('✅ No duplicate day entries found.');
    }

    // 5. Check today specifically (Feb 11)
    console.log('\n=== Today (Feb 11) Records ===');
    const todayRecords = febRecords.filter(r => r.date.getUTCDate() === 11);
    if (todayRecords.length === 0) {
        console.log('❌ No records for today (Feb 11).');
    } else {
        todayRecords.forEach(r => {
            console.log(`  ${r.vehicle.plate} | ${r.date.toISOString()} | ${r.status}`);
        });
    }
}

main()
    .catch(e => console.error('Script Error:', e))
    .finally(() => prisma.$disconnect());
