import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function finalVerification() {
    const plates = ['60 ACN 701', '60 AEY 683', '60 AFA 401', '60 BP 844'];

    for (const plate of plates) {
        const vehicle = await prisma.vehicle.findFirst({
            where: { plate },
            include: { assignedSites: { select: { name: true } } }
        });

        if (!vehicle) continue;

        const attendance = await prisma.vehicleAttendance.findMany({
            where: { vehicleId: vehicle.id },
            orderBy: { date: 'desc' },
            take: 3
        });

        console.log(`\n[${plate}]`);
        console.log(`- Atanmış Şantiyeler: ${vehicle.assignedSites.map(s => s.name).join(', ') || 'YOK'}`);
        console.log(`- Son 3 Puantaj:`);
        attendance.forEach(a => {
            console.log(`  - ${a.date.toISOString().split('T')[0]} (SiteId: ${a.siteId.substring(0, 8)}...)`);
        });
    }
}

finalVerification()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
