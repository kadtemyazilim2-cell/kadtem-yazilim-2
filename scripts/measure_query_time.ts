
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function measure(name: string, fn: () => Promise<any>) {
    const start = performance.now();
    try {
        const res = await fn();
        const end = performance.now();
        const count = Array.isArray(res) ? res.length : (res && Array.isArray(res.data) ? res.data.length : 'N/A');
        console.log(`${name}: ${(end - start).toFixed(2)}ms (Count: ${count})`);
        return end - start;
    } catch (e) {
        console.error(`${name} Failed:`, e);
        return 0;
    }
}

async function main() {
    console.log('--- Measuring Data Fetching Times ---');
    const startTotal = performance.now();

    // Mock functions based on actions (simplified queries)
    // We can't import actions easily due to 'auth' dependency, so we replicate queries approx.

    // 1. Companies
    await measure('getCompanies', () => prisma.company.findMany());

    // 2. Sites
    await measure('getSites', () => prisma.site.findMany());

    // 3. Vehicles (Heavy?)
    await measure('getVehicles', () => prisma.vehicle.findMany({
        include: { assignedSites: true, assignedSite: true }
    }));

    // 4. Personnel
    await measure('getPersonnel', () => prisma.personnel.findMany());

    // 5. Users
    await measure('getUsers', () => prisma.user.findMany());

    // 6. Correspondence
    await measure('getCorrespondenceList', () => prisma.correspondence.findMany());

    // 7. Institutions
    await measure('getInstitutions', () => prisma.institution.findMany());

    // 8. Fuel Tanks
    await measure('getFuelTanks', () => prisma.fuelTank.findMany());

    // 9. Fuel Logs (Potential Heavy)
    await measure('getFuelLogs', () => prisma.fuelLog.findMany({ take: 1000 })); // Approx

    // 10. Fuel Transfers
    await measure('getFuelTransfers', () => prisma.fuelTransfer.findMany());

    // 11. Site Logs (Likely Heavy)
    await measure('getSiteLogEntries', () => prisma.siteLogEntry.findMany({ take: 1000 }));




    // 13. Yi-UFE
    await measure('getYiUfeRates', () => prisma.yiUfeRate.findMany());

    // 14. Vehicle Attendance
    await measure('getVehicleAttendanceList', () => prisma.vehicleAttendance.findMany({ take: 1000 }));

    const endTotal = performance.now();
    console.log(`--- Total Sequential Time: ${(endTotal - startTotal).toFixed(2)}ms ---`);
    console.log(`(Note: Promise.all runs them in parallel, so actual time is roughly max(individual_times) + overhead, but DB connection pool prevents true parallelism if limited)`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
