const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    try {
        // Fetch the specific vehicle 60 HN 887 which is likely scraped
        const vehicle = await p.vehicle.findFirst({
            where: { plate: { contains: '60 HN 887' } }
        });

        if (!vehicle) {
            console.log('Vehicle 60 HN 887 not found.');
            return;
        }

        console.log('--- Vehicle Data ---');
        console.log('ID:', vehicle.id);
        console.log('Plate:', vehicle.plate);
        console.log('CompanyId:', vehicle.companyId);
        console.log('AssignedSiteId:', vehicle.assignedSiteId);
        console.log('InsuranceHistory (Raw):', JSON.stringify(vehicle.insuranceHistory, null, 2));

        // Check for any potential issues
        if (!vehicle.companyId) console.warn('WARNING: Missing companyId');

        // Check insurance history structure
        if (Array.isArray(vehicle.insuranceHistory)) {
            vehicle.insuranceHistory.forEach((rec, i) => {
                console.log(`History #${i}:`, rec);
                if (!rec.id) console.warn(`WARNING: History #${i} missing ID`);
            });
        } else {
            console.log('InsuranceHistory is not an array:', typeof vehicle.insuranceHistory);
        }

    } catch (e) {
        console.error('ERROR:', e);
    } finally {
        await p.$disconnect();
    }
}

main();
