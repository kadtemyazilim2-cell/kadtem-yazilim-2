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
        include: {
            vehicle: {
                select: { plate: true, id: true }
            }
        },
        orderBy: { date: 'asc' }
    });

    console.log(`Mart 2026 Toplam Kayıt Sayısı: ${records.length}`);

    // Fetch all sites to map siteId to name
    const sites = await prisma.site.findMany({ select: { id: true, name: true } });
    const siteMap = Object.fromEntries(sites.map(s => [s.id, s.name]));

    const summary = {}; // site -> count
    records.forEach(r => {
        const siteName = siteMap[r.siteId] || `Bilinmeyen Şantiye (${r.siteId})`;
        if (!summary[siteName]) summary[siteName] = 0;
        summary[siteName]++;
    });

    console.log('\nŞantiye bazlı kayıt özetleri:');
    Object.entries(summary).forEach(([name, count]) => console.log(`- ${name}: ${count} kayıt`));

    // Aydın Nazilli specifics
    const aydinSiteId = 'cmkmop5q5000fhgexroggue2m';
    const aydinRecords = records.filter(r => r.siteId === aydinSiteId);

    if (aydinRecords.length > 0) {
        console.log(`\nAydın Nazilli'deki Araçlar ve Kayıt Sayıları:`);
        const vehicleCounts = {};
        aydinRecords.forEach(r => {
            const plate = r.vehicle.plate;
            if (!vehicleCounts[plate]) vehicleCounts[plate] = 0;
            vehicleCounts[plate]++;
        });
        Object.entries(vehicleCounts).forEach(([plate, count]) => console.log(`- ${plate}: ${count} kayıt`));
    } else {
        console.log('\nAydın Nazilli için Mart ayında puantaj kaydı bulunamadı.');
    }
}

findAllMarchRecords()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
