import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function bulkFix() {
    try {
        console.log('--- Toplu Araç Atama Temizliği Başlatılıyor ---\n');

        const allVehicles = await prisma.vehicle.findMany({
            include: { assignedSites: true }
        });

        let fixCount = 0;
        for (const v of allVehicles) {
            if (v.assignedSiteId) {
                const isInPlural = v.assignedSites.some(s => s.id === v.assignedSiteId);

                // Eğer tekil şantiye ID'si var ama bu şantiye yeni (çoğul) sistemde kayıtlı değilse temizle
                if (!isInPlural) {
                    fixCount++;
                    console.log(`Düzeltiliyor: [${v.plate}] | Birincil şantiye ID: ${v.assignedSiteId} temizleniyor.`);
                    await prisma.vehicle.update({
                        where: { id: v.id },
                        data: { assignedSiteId: null }
                    });
                }
            }
        }

        console.log(`\nİşlem Tamamlandı. Toplam ${fixCount} araç güncellendi.`);

    } catch (e) {
        console.error('HATA:', e);
    } finally {
        await prisma.$disconnect();
    }
}

bulkFix();
