import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUnassignedWithData() {
    const aydinSiteId = 'cmkmop5q5000fhgexroggue2m';

    // Find attendance for March 2026 in Aydın
    const attendance = await prisma.vehicleAttendance.findMany({
        where: {
            siteId: aydinSiteId,
            date: {
                gte: new Date('2026-03-01'),
                lte: new Date('2026-03-31')
            }
        },
        include: { vehicle: true }
    });

    const uniqueVehicles = [...new Set(attendance.map(a => a.vehicle.plate))];
    console.log(`Mart 2026 Aydın Puantajı Olan Araçlar (${uniqueVehicles.length} adet):`);

    for (const plate of uniqueVehicles) {
        const v = await prisma.vehicle.findFirst({
            where: { plate },
            include: {
                assignedSites: true,
                assignmentHistory: { where: { siteId: aydinSiteId } }
            }
        });

        console.log(`\nAraç: ${v.plate} (ID: ${v.id})`);
        console.log(`- Atandığı Şantiyeler: ${v.assignedSites.map(s => s.name).join(', ') || 'HİÇBİRİ'}`);
        console.log(`- Atama Geçmişi (Aydın): ${v.assignmentHistory.length} kayıt`);
        if (v.assignmentHistory.length > 0) {
            v.assignmentHistory.forEach(h => {
                console.log(`  - ${h.startDate?.toISOString().split('T')[0]} / ${h.endDate?.toISOString().split('T')[0] || 'GÜNCEL'}`);
            });
        }
    }
}

checkUnassignedWithData()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
