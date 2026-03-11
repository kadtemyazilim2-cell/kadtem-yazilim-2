import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkHistory() {
    const plates = ['60 AEY 683', '60 AFA 401'];

    for (const plate of plates) {
        const vehicle = await prisma.vehicle.findFirst({
            where: { plate },
            include: {
                assignmentHistory: {
                    include: { site: { select: { name: true } } },
                    orderBy: { startDate: 'desc' }
                }
            }
        });

        if (!vehicle) continue;

        console.log(`\n[${plate}] Atama Geçmişi:`);
        if (vehicle.assignmentHistory.length === 0) {
            console.log('- Geçmiş kaydı bulunamadı.');
        } else {
            vehicle.assignmentHistory.forEach(h => {
                console.log(`- Şantiye: ${h.site?.name || 'Bilinmiyor'}, Başlangıç: ${h.startDate?.toISOString().split('T')[0]}, Bitiş: ${h.endDate?.toISOString().split('T')[0] || 'GÜNCEL'}`);
            });
        }
    }
}

checkHistory()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
