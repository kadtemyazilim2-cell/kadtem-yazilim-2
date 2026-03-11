import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAttendance() {
    const plates = ['60 AEY 683'];

    for (const plate of plates) {
        const vehicle = await prisma.vehicle.findFirst({
            where: { plate }
        });

        if (!vehicle) continue;

        const attendance = await prisma.vehicleAttendance.findMany({
            where: { vehicleId: vehicle.id },
            orderBy: { date: 'desc' },
            take: 5
        });

        console.log(`\n[${plate}] Son Puantaj Kayıtları:`);
        if (attendance.length === 0) {
            console.log('- Kayıt bulunamadı.');
        } else {
            for (const a of attendance) {
                const site = await prisma.site.findUnique({
                    where: { id: a.siteId },
                    select: { name: true }
                });
                console.log(`- Tarih: ${a.date.toISOString().split('T')[0]}, SiteId: ${a.siteId} (${site?.name || 'Bilinmiyor'}), Durum: ${a.status}`);
            }
        }
    }
}

checkAttendance()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
