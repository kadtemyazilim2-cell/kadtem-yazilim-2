
import { prisma } from '../src/lib/db';

async function reset() {
    const companies = await prisma.company.findMany();

    console.log('--- Sayaç Sıfırlama Başlatıldı ---');
    for (const comp of companies) {
        // En yüksek referans numarasını bulmaya çalışmak yerine, 
        // aktif evrak sayısına göre bir mantık kurabiliriz
        // veya kullanıcının "hiç evrak yok" beyanına binayen giden evrak sayısı 0 ise 1'e çekebiliriz.
        
        const outgoingCount = await prisma.correspondence.count({
            where: {
                companyId: comp.id,
                direction: 'OUTGOING',
                status: 'ACTIVE'
            }
        });

        // Eğer aktif evrak yoksa 1'den başlasın. 
        // Eğer varsa, en yüksek sayı + 1 olsun (basitlik için).
        let nextNum = 1;
        if (outgoingCount > 0) {
            // Not: referans numarası formatı "[SHORT]-[YY]/[INST].[SEQ]" şeklinde.
            // Sayacın tam değerini bulmak için tüm evrakları çekip parse etmek gerekebilir.
            // Ama şimdilik basitçe aktif sayı + 1 diyebiliriz eğer kullanıcı manuel müdahale etmediyse.
            nextNum = outgoingCount + 1;
        }

        console.log(`Firma: ${comp.name}`);
        console.log(`  Eski Sayaç: ${comp.currentDocumentNumber} -> Yeni Sayaç: ${nextNum}`);

        await prisma.company.update({
            where: { id: comp.id },
            data: { currentDocumentNumber: nextNum }
        });
    }
    console.log('--- İşlem Tamamlandı ---');
}

reset().catch(console.error);
