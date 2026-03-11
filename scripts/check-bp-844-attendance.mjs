import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkBP844Attendance() {
    try {
        const plate = '60 BP 844';
        const v = await prisma.vehicle.findUnique({ where: { plate } });
        if (!v) return;

        const attendance = await prisma.vehicleAttendance.findMany({
            where: { vehicleId: v.id },
            orderBy: { date: 'desc' },
            take: 10
        });

        console.log(`--- ${plate} için son puantaj kayıtları ---`);
        for (const a of attendance) {
            const site = await prisma.site.findUnique({ where: { id: a.siteId } });
            console.log(`Tarih: ${a.date.toISOString().split('T')[0]} | Şantiye: ${site?.name || 'Bilinmiyor'} | Durum: ${a.status}`);
        }

        // Check if it's in any assignment history
        const history = await prisma.vehicleAssignmentHistory.findMany({
            where: { vehicleId: v.id },
            include: { site: true },
            orderBy: { startDate: 'desc' }
        });

        console.log(`\n--- ${plate} Atama Geçmişi ---`);
        for (const h of history) {
            console.log(`Şantiye: ${h.site.name} | Başlangıç: ${h.startDate.toISOString().split('T')[0]} | Bitiş: ${h.endDate?.toISOString().split('T')[0] || 'Devam ediyor'}`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkBP844Attendance();
