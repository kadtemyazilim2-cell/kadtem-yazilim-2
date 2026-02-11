const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ log: ['error', 'warn'] });

// Simulate exactly what the server action does
async function testSaveInsurancePolicy() {
    const vehicleId = 'v_kt_6'; // 60 HN 887
    const mode = 'ADD';

    const newRecord = {
        id: 'test-' + Date.now(),
        type: 'TRAFFIC',
        company: 'AK SİGORTA',
        agency: 'ahmet can',
        startDate: '2024-02-22',
        endDate: '2025-02-22',
        cost: 11111111,
        active: true,
        attachments: [],
        definition: '',
        identificationNumber: '1',
        transactionDate: '2026-02-11',
        createdAt: new Date().toISOString()
    };

    const flatUpdates = {
        insuranceCompany: 'AK SİGORTA',
        insuranceAgency: 'ahmet can',
        insuranceStartDate: '2024-02-22',
        insuranceExpiry: '2025-02-22',
        insuranceCost: 11111111
    };

    console.log('Starting saveInsurancePolicy test...');
    console.log('flatUpdates:', JSON.stringify(flatUpdates));

    try {
        // Parse dates (from server action)
        const parseDate = (val) => {
            if (!val) return null;
            if (val instanceof Date) return val;
            if (typeof val === 'string') {
                let d = new Date(val);
                if (!isNaN(d.getTime())) return d;
                const parts = val.split('.');
                if (parts.length === 3) {
                    const day = parseInt(parts[0], 10);
                    const month = parseInt(parts[1], 10) - 1;
                    const year = parseInt(parts[2], 10);
                    d = new Date(year, month, day);
                    if (!isNaN(d.getTime())) return d;
                }
            }
            return null;
        };

        const dateFields = [
            'insuranceExpiry', 'kaskoExpiry', 'inspectionExpiry', 'vehicleCardExpiry',
            'insuranceStartDate', 'kaskoStartDate', 'rentalLastUpdate', 'lastInspectionDate'
        ];

        const cleanUpdates = { ...flatUpdates };

        dateFields.forEach(field => {
            const val = cleanUpdates[field];
            const parsed = parseDate(val);
            if (parsed) {
                cleanUpdates[field] = parsed;
            } else if (val === '' || val === null) {
                cleanUpdates[field] = null;
            } else if (val !== undefined) {
                console.warn(`Invalid date for ${field}: ${val}`);
                delete cleanUpdates[field];
            }
        });

        console.log('cleanUpdates after date parsing:', JSON.stringify(cleanUpdates, null, 2));

        await p.$transaction(async (tx) => {
            const vehicle = await tx.vehicle.findUnique({
                where: { id: vehicleId },
                select: { insuranceHistory: true }
            });

            if (!vehicle) throw new Error('Vehicle not found');

            let history = [];
            if (vehicle.insuranceHistory && Array.isArray(vehicle.insuranceHistory)) {
                history = [...vehicle.insuranceHistory];
            }

            if (mode === 'ADD') {
                history.push(newRecord);
            }

            console.log('About to update with', Object.keys(cleanUpdates), 'and history length:', history.length);

            await tx.vehicle.update({
                where: { id: vehicleId },
                data: {
                    ...cleanUpdates,
                    insuranceHistory: history
                }
            });

            console.log('Transaction OK!');
        });

        console.log('SUCCESS - Policy saved');
        return { success: true };
    } catch (error) {
        console.error('FAILED:', error.message);
        console.error('Full error:', error);
        return { success: false, error: error.message };
    } finally {
        await p.$disconnect();
    }
}

testSaveInsurancePolicy();
