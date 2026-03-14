
import { prisma } from '../src/lib/db';

async function reset() {
    const companies = await prisma.company.findMany();

    console.log('--- Sayaç Sıfırlama Başlatıldı (Giden, Gelen, Banka) ---');
    for (const comp of companies) {
        // 1. Giden Evrak (OUTGOING && type != BANK)
        const outgoingCount = await prisma.correspondence.count({
            where: {
                companyId: comp.id,
                direction: 'OUTGOING',
                type: { not: 'BANK' },
                status: 'ACTIVE'
            }
        });

        // 2. Gelen Evrak (INCOMING && type != BANK)
        const incomingCount = await prisma.correspondence.count({
            where: {
                companyId: comp.id,
                direction: 'INCOMING',
                type: { not: 'BANK' },
                status: 'ACTIVE'
            }
        });

        // 3. Banka (type == BANK)
        const bankCount = await prisma.correspondence.count({
            where: {
                companyId: comp.id,
                type: 'BANK',
                status: 'ACTIVE'
            }
        });

        console.log(`Firma: ${comp.name}`);
        console.log(`  Giden Sayaç: ${(comp as any).currentDocumentNumber} -> ${outgoingCount + 1}`);
        console.log(`  Gelen Sayaç: ${(comp as any).currentIncomingNumber} -> ${incomingCount + 1}`);
        console.log(`  Banka Sayaç: ${(comp as any).currentBankNumber} -> ${bankCount + 1}`);

        await prisma.company.update({
            where: { id: comp.id },
            data: { 
                currentDocumentNumber: outgoingCount + 1,
                currentIncomingNumber: incomingCount + 1,
                currentBankNumber: bankCount + 1
            } as any
        });
    }
    console.log('--- İşlem Tamamlandı ---');
}

reset().catch(console.error);
