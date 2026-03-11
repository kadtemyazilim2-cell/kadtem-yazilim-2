import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkDates() {
    try {
        const plate = '60 ACN 701';
        const v = await prisma.vehicle.findUnique({ where: { plate } });
        if (!v) return;

        const attendance = await prisma.vehicleAttendance.findMany({
            where: { vehicleId: v.id },
            include: { vehicle: true },
            orderBy: { date: 'desc' }
        });

        console.log(`--- ${plate} için tüm puantaj kayıtları ---`);
        for (const a of attendance) {
            const site = await prisma.site.findUnique({ where: { id: a.siteId } });
            console.log(`Tarih: ${a.date.toISOString().split('T')[0]} | Şantiye: ${site?.name} | Durum: ${a.status}`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkDates();
