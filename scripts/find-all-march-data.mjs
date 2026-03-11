import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findAllMarchRecords() {
    const records = await prisma.vehicleAttendance.findMany({
        where: {
            date: {
                gte: new Date('2026-03-01T00:00:00Z'),
                lte: new Date('2026-03-31T23:59:59Z')
            }
        },
        include: { vehicle: true, site: true },
        orderBy: { date: 'asc' }
    });

    console.log(`Mart 2026 Toplam Kayıt Sayısı: ${records.length}`);

    const summary = {}; // site -> count
    records.forEach(r => {
        const siteName = r.site?.name || 'Bilinmeyen Şantiye';
        if (!summary[siteName]) summary[siteName] = 0;
        summary[siteName]++;
    });

    console.log('\nŞantiye bazlı kayıt özetleri:');
    Object.entries(summary).forEach(([name, count]) => console.log(`- ${name}: ${count} kayıt`));

    // List sample records for Aydın specifically if found
    const aydinSiteId = 'cmkmop5q5000fhgexroggue2m';
    const aydinRecords = records.filter(r => r.siteId === aydinSiteId);

    if (aydinRecords.length > 0) {
        console.log(`\nAydın Nazilli'deki bazı araçlar:`);
        const plates = [...new Set(aydinRecords.map(r => r.vehicle.plate))];
        plates.forEach(p => console.log(`- ${p}`));
    }
}

findAllMarchRecords()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
