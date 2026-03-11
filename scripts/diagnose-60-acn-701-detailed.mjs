import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkDetails() {
    try {
        const plate = '60 ACN 701';
        const v = await prisma.vehicle.findUnique({
            where: { plate },
            include: {
                assignedSite: true,
                assignedSites: true,
                assignmentHistory: {
                    include: { site: true },
                    orderBy: { startDate: 'desc' }
                },
                attendance: {
                    take: 20,
                    orderBy: { date: 'desc' },
                    include: { site: true }
                }
            }
        });

        if (!v) {
            console.log('Araç bulunamadı.');
            return;
        }

        console.log(`--- Araç Detayları: ${plate} ---`);
        console.log(`ID: ${v.id}`);
        console.log(`Birincil Şantiye (assignedSiteId): ${v.assignedSiteId} (${v.assignedSite?.name || 'Yok'})`);
        console.log(`İlişkili Şantiyeler (assignedSites):`, v.assignedSites.map(s => `${s.id} (${s.name})`));

        console.log(`\n--- Atama Geçmişi (AssignmentHistory) ---`);
        v.assignmentHistory.forEach(h => {
            console.log(`- Şantiye: ${h.site.name} | Başlangıç: ${h.startDate.toISOString()} | Bitiş: ${h.endDate?.toISOString() || 'Devam ediyor'}`);
        });

        console.log(`\n--- Son Puantaj Kayıtları ---`);
        v.attendance.forEach(a => {
            console.log(`- Tarih: ${a.date.toISOString().split('T')[0]} | Şantiye: ${a.site.name} | Durum: ${a.status}`);
        });

        console.log(`\n--- "Aydın" isimli tüm Şantiyeler ---`);
        const aydinSites = await prisma.site.findMany({
            where: { name: { contains: 'Aydın', mode: 'insensitive' } }
        });
        aydinSites.forEach(s => {
            console.log(`- ID: ${s.id} | İsim: ${s.name}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkDetails();
