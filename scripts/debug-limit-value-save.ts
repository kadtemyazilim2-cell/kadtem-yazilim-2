
import { saveCalculation } from '@/actions/limit-value';

async function main() {
    console.log('Testing saveCalculation...');

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

    const result = await saveCalculation(mockData);
    console.log('Result:', result);
}

main().catch(console.error);
