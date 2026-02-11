
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Testing saveCalculation directly...');

    const mockData = {
        tenderName: 'Test İhale',
        tenderRegisterNo: '2024/123456',
        administration: 'Test İdare',
        tenderDate: new Date(),
        approxCost: 1000000,
        nCoefficient: 1.20,
        limitValue: 800000,
        likelyWinner: 'Test Firma',
        likelyWinnerDiscount: 15.5,
        fullResultData: { test: true }
    };

    try {
        const result = await prisma.limitValueCalculation.create({
            data: mockData
        });
        console.log('Success:', result);
    } catch (e) {
        console.error('Error:', e);
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
