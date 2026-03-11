import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkVehicles() {
    const plates = ['60 AEY 683', '60 AFA 401'];

    for (const plate of plates) {
        const vehicle = await prisma.vehicle.findFirst({
            where: { plate },
            include: {
                assignedSites: { select: { id: true, name: true } }
            }
        });

        if (!vehicle) {
            console.log(`\n[${plate}] BULUNAMADI`);
            continue;
        }

        console.log(`\n[${plate}] Araç Bilgileri:`);
        console.log(`- ID: ${vehicle.id}`);
        console.log(`- Status: ${vehicle.status}`);
        console.log(`- assignedSiteId (Eski): ${vehicle.assignedSiteId || 'NULL'}`);
        console.log(`- assignedSites (Yeni): ${vehicle.assignedSites.map(s => s.name).join(', ') || 'HİÇBİRİ'}`);

        if (vehicle.assignedSiteId) {
            const isInList = vehicle.assignedSites.some(s => s.id === vehicle.assignedSiteId);
            console.log(`- Tutarsızlık Var mı?: ${isInList ? 'HAYIR' : 'EVET (Eski alan listede yok!)'}`);
        } else {
            console.log(`- Tutarsızlık Var mı?: HAYIR (Eski alan zaten boş)`);
        }
    }
}

checkVehicles()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
