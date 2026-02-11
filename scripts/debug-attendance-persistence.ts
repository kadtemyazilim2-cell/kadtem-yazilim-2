
import { addVehicleAttendance, getVehicleAttendanceList } from '@/actions/vehicle-attendance';
import { prisma } from '@/lib/db';

async function main() {
    console.log('--- Debugging Attendance Persistence ---');

    // 1. Get a test vehicle and site
    const vehicle = await prisma.vehicle.findFirst({ where: { status: 'ACTIVE' } });
    const site = await prisma.site.findFirst({ where: { status: 'ACTIVE' } });

    if (!vehicle || !site) {
        console.error('No active vehicle or site found.');
        return;
    }

    console.log(`Test Vehicle: ${vehicle.plate} (${vehicle.id})`);
    console.log(`Test Site: ${site.name} (${site.id})`);

    // 2. Define the Target Date (Feb 11, 2026)
    // Client logic: 
    // const [y, m, d] = "2026-02-11".split('-')
    // new Date(Date.UTC(y, m-1, d, 12, 0, 0))
    const y = 2026, m = 2, d = 11;
    const targetDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    console.log(`Target Date (Client generated UTC Noon): ${targetDate.toISOString()}`);

    // 3. Simulate Save
    console.log('\n--- Simulating Save ---');
    const saveRes = await addVehicleAttendance({
        vehicleId: vehicle.id,
        siteId: site.id,
        date: targetDate,
        status: 'WORK',
        hours: 8,
        note: 'Debug Test'
    });

    if (!saveRes.success) {
        console.error('Save failed:', saveRes.error);
        return;
    }
    console.log('Save successful. ID:', saveRes.data.id);
    console.log('Saved Date in DB:', saveRes.data.date);

    // 4. Simulate Fetch
    console.log('\n--- Simulating Fetch ---');
    // Client logic for range:
    // start = subDays(startOfMonth(selectedDate), 1)
    // end = addDays(endOfMonth(selectedDate), 1)

    // Feb 2026
    // Start: Jan 31 2026 Local -> ~Jan 30 21:00 UTC
    // End: Mar 2 2026 Local -> ~Mar 1 21:00 UTC

    const fetchStart = new Date('2026-01-31T00:00:00'); // Local approximation (Agent env might be UTC though)
    const fetchEnd = new Date('2026-03-02T00:00:00');

    console.log(`Fetch Range (Input): ${fetchStart.toISOString()} - ${fetchEnd.toISOString()}`);

    const fetchRes = await getVehicleAttendanceList(site.id, fetchStart, fetchEnd);

    if (!fetchRes.success || !fetchRes.data) {
        console.error('Fetch failed or no data:', fetchRes.error);
        return;
    }

    console.log(`Fetched ${fetchRes.data.length} records.`);

    const found = fetchRes.data.find((r: any) => r.id === saveRes.data.id);
    if (found) {
        console.log('✅ Success! Record found in fetch results.');
        console.log('Fetched Record Date:', found.date);
    } else {
        console.error('❌ FAILURE! Record NOT found in fetch results.');
        // Dump dates around target
        const nearby = fetchRes.data.filter((r: any) => r.vehicleId === vehicle.id);
        console.log('Nearby records for this vehicle:', nearby.map((r: any) => ({ id: r.id, date: r.date })));
    }

    // Cleanup
    console.log('\n--- Cleaning up ---');
    await prisma.vehicleAttendance.delete({ where: { id: saveRes.data.id } });
}

main();
