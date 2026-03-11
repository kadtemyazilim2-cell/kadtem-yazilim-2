import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function finalDeepClean() {
    const vehicles = await prisma.vehicle.findMany({ select: { id: true, plate: true } });
    const aydinSiteId = 'cmkmop5q5000fhgexroggue2m';
    let totalDeleted = 0;

    for (const v of vehicles) {
        const attendance = await prisma.vehicleAttendance.findMany({
            where: { vehicleId: v.id },
            orderBy: { date: 'asc' }
        });

        const dayGroups = {};
        attendance.forEach(a => {
            const day = a.date.toISOString().split('T')[0];
            if (!dayGroups[day]) dayGroups[day] = [];
            dayGroups[day].push(a);
        });

        for (const [day, records] of Object.entries(dayGroups)) {
            if (records.length > 1) {
                console.log(`Cleaning ${v.plate} on ${day} (${records.length} records)...`);

                // Sort records: Prefer NOT Aydın, or prefer having a note
                const sorted = records.sort((a, b) => {
                    // Logic: Record with note > Record without note
                    // Logic: Non-Aydın > Aydın (if user complained about erroneous Aydın entries)
                    if (a.siteId !== aydinSiteId && b.siteId === aydinSiteId) return -1;
                    if (a.siteId === aydinSiteId && b.siteId !== aydinSiteId) return 1;
                    if (a.note && !b.note) return -1;
                    if (!a.note && b.note) return 1;
                    return 0;
                });

                const best = sorted[0];
                const others = sorted.slice(1);

                for (const other of others) {
                    await prisma.vehicleAttendance.delete({ where: { id: other.id } });
                    totalDeleted++;
                }
            }
        }
    }

    console.log(`\nNihai temizlik tamamlandı. Toplam ${totalDeleted} kayıt silindi.`);
}

finalDeepClean()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
