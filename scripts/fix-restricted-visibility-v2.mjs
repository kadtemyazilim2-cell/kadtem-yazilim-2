import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAndFixAssignments() {
    const mappings = [
        { plate: '60 AEY 683', siteId: 'cmkmop5q5000fhgexroggue2m' }, // Aydın Nazilli
        { plate: '60 AFA 401', siteId: 'cmkmooxq1000jsjtfm8kfo5hp' }, // Zile Ovası
        { plate: '60 BP 844', siteId: 'cmkmop5q5000fhgexroggue2m' }   // Aydın Nazilli
    ];

    const startDate = new Date('2025-01-01T00:00:00Z');

    for (const m of mappings) {
        const vehicle = await prisma.vehicle.findFirst({
            where: { plate: m.plate },
            include: { assignmentHistory: { where: { siteId: m.siteId } } }
        });

        if (!vehicle) {
            console.log(`Araç bulunamadı: ${m.plate}`);
            continue;
        }

        console.log(`İşleniyor: ${m.plate}`);

        // 1. Update assignedSiteId
        await prisma.vehicle.update({
            where: { id: vehicle.id },
            data: { assignedSiteId: m.siteId }
        });
        console.log(`- assignedSiteId güncellendi: ${m.siteId}`);

        // 2. Create History if not exists (Note field omitted due to schema)
        if (vehicle.assignmentHistory.length === 0) {
            await prisma.vehicleAssignmentHistory.create({
                data: {
                    vehicleId: vehicle.id,
                    siteId: m.siteId,
                    startDate: startDate
                }
            });
            console.log(`- Atama geçmişi (assignmentHistory) oluşturuldu: ${startDate.toISOString().split('T')[0]}`);
        } else {
            console.log(`- Atama geçmişi zaten mevcut.`);
        }
    }
}

checkAndFixAssignments()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
