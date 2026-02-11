const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    try {
        const vehicles = await p.vehicle.findMany();
        console.log(`Checking ${vehicles.length} vehicles...`);

        let errorCount = 0;

        vehicles.forEach(v => {
            const dateFields = [
                'insuranceExpiry', 'kaskoExpiry', 'inspectionExpiry', 'vehicleCardExpiry',
                'insuranceStartDate', 'kaskoStartDate', 'rentalLastUpdate', 'lastInspectionDate'
            ];

            dateFields.forEach(field => {
                if (v[field] && isNaN(new Date(v[field]).getTime())) {
                    console.error(`Vehicle ${v.plate} has invalid date in ${field}:`, v[field]);
                    errorCount++;
                }
            });

            // Check if insuranceHistory is valid JSON
            if (v.insuranceHistory && typeof v.insuranceHistory !== 'object') {
                console.error(`Vehicle ${v.plate} has invalid insuranceHistory type:`, typeof v.insuranceHistory);
                errorCount++;
            }
        });

        if (errorCount === 0) {
            console.log('All vehicles have valid date fields and JSON history.');
        } else {
            console.log(`Found ${errorCount} issues.`);
        }

    } catch (e) {
        console.error('ERROR:', e);
    } finally {
        await p.$disconnect();
    }
}

main();
