
import { prisma } from '../src/lib/db';

async function list() {
    const companies = await prisma.company.findMany();

    console.log('--- Kayıt Detayları ---');
    for (const comp of companies) {
        const activeDocs = await prisma.correspondence.findMany({
            where: {
                companyId: comp.id,
                direction: 'OUTGOING',
                status: 'ACTIVE'
            },
            select: {
                referenceNumber: true,
                subject: true
            }
        });

        console.log(`Firma: ${comp.name} (Sayaç: ${comp.currentDocumentNumber})`);
        if (activeDocs.length === 0) {
            console.log('  Aktif giden evrak yok.');
        } else {
            console.log(`  Aktif giden evraklar (${activeDocs.length}):`);
            activeDocs.forEach(d => console.log(`    - ${d.referenceNumber} | Konu: ${d.subject}`));
        }
    }
}

list().catch(console.error);
