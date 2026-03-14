
import { prisma } from '../src/lib/db';

async function check() {
    const companies = await prisma.company.findMany({
        select: {
            id: true,
            name: true,
            currentDocumentNumber: true
        }
    });

    console.log('--- Şirket Sayaç Durumları ---');
    for (const comp of companies) {
        const count = await prisma.correspondence.count({
            where: {
                companyId: comp.id,
                direction: 'OUTGOING',
                status: 'ACTIVE'
            }
        });
        const deletedCount = await prisma.correspondence.count({
            where: {
                companyId: comp.id,
                direction: 'OUTGOING',
                status: 'DELETED'
            }
        });
        console.log(`Şirket: ${comp.name}`);
        console.log(`  Mevcut Sayaç (Next Num): ${comp.currentDocumentNumber}`);
        console.log(`  Aktif Giden Evrak Sayısı: ${count}`);
        console.log(`  Silinmiş Giden Evrak Sayısı: ${deletedCount}`);
    }
}

check().catch(console.error);
