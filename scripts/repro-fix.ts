
import { addVehicleAttendance, getVehicleAttendanceList } from '../src/actions/vehicle-attendance';
import { prisma } from '../src/lib/db';

async function main() {
    console.log('--- Starting Reproduction Script ---');

    // MOCK DATA
    const MOCK_SITE_ID = 'cmkmop5q5000fhgexroggue2m'; // Use a known site ID (from previous Logs)
    const MOCK_VEHICLE_ID = 'cmkpf4tbt000zln7f02vc9cg2'; // Use a known vehicle ID
    const TARGET_DATE_STR = '2026-02-11'; // A future date or specific date to test

    console.log(`Target Date String: ${TARGET_DATE_STR}`);

    // 1. Simulate Client Logic (Date Construction)
    const [y, m, d] = TARGET_DATE_STR.split('-').map(Number);
    // Create UTC Noon Date to ensure server receives correct day
    const utcDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    console.log(`Constructed UTC Date (Client Payload): ${utcDate.toISOString()}`);

    const payload = {
        vehicleId: MOCK_VEHICLE_ID,
        siteId: MOCK_SITE_ID,
        date: utcDate,
        status: 'WORK' as const,
        hours: 8,
        createdByUserId: 'mock-user'
    };

    // 2. Call Server Action to ADD
    console.log('Calling addVehicleAttendance...');
    const addResult = await addVehicleAttendance(payload);
    console.log('Add Result:', addResult);

    // 3. Verify DB Direct
    console.log('Checking DB directly...');
    const dbRecord = await prisma.vehicleAttendance.findFirst({
        where: {
            vehicleId: MOCK_VEHICLE_ID,
            siteId: MOCK_SITE_ID,
            date: utcDate
        }
    });
    console.log('DB Direct Record:', dbRecord);


    // 4. Call Server Action to GET (Simulate Component Fetch)
    // Simulate startOfMonth / endOfMonth
    const startOfMonth = new Date('2026-02-01T00:00:00Z');
    const endOfMonth = new Date('2026-02-28T23:59:59Z');

    console.log(`Fetching List for Range: ${startOfMonth.toISOString()} - ${endOfMonth.toISOString()}`);

    const getResult = await getVehicleAttendanceList(MOCK_SITE_ID, startOfMonth, endOfMonth);

    if (getResult.success && getResult.data) {
        const found = getResult.data.find(r => r.vehicleId === MOCK_VEHICLE_ID && r.date.includes(TARGET_DATE_STR) || new Date(r.date).toISOString() === utcDate.toISOString());
        console.log('Found in getVehicleAttendanceList?', !!found);
        if (found) console.log('Found Record:', found);
    } else {
        console.log('Get Failed:', getResult);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
