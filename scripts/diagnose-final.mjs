import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkFinal() {
    try {
        const plate = '60 ACN 701';
        const v = await prisma.vehicle.findUnique({
            where: { plate },
            include: {
                assignedSite: { select: { id: true, name: true } },
                assignedSites: { select: { id: true, name: true } }
            }
        });

        if (!v) {
            console.log('Araç bulunamadı.');
            return;
        }

        console.log(`Araç Plakası: ${v.plate}`);
        console.log(`assignedSiteId (Singular): ${v.assignedSiteId} -> ${v.assignedSite?.name || 'YOK'}`);
        console.log(`assignedSites (Plural):`, v.assignedSites.map(s => `${s.id} -> ${s.name}`));

        // Also check if any other Aydın site mentions this vehicle in some way
        const allAydinSites = await prisma.site.findMany({
            where: { name: { contains: 'Aydın', mode: 'insensitive' } }
        });

        console.log('\n--- Aydın Şantiyeleri ve Bu Araçla İlişkileri ---');
        for (const s of allAydinSites) {
            const hasAttendance = await prisma.vehicleAttendance.count({
                where: { vehicleId: v.id, siteId: s.id }
            });
            console.log(`Şantiye: ${s.name} (${s.id})`);
            console.log(`  - Birincil atama mı? ${v.assignedSiteId === s.id}`);
            console.log(`  - Çoğul atama listesinde mi? ${v.assignedSites.some(as => as.id === s.id)}`);
            console.log(`  - Puantaj kaydı var mı? ${hasAttendance}`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkFinal();
