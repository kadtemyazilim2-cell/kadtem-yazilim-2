
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CORRECTIONS = [
    {
        wrongName: "Aydın Kemer Barajı Yan Dereleri Siltasyondan Koruma Iıı. Kısım İnşaatı Yapım İşi",
        correctName: "Aydın Nazilli-Yenipazar Tarla İçi Kapalı (Borulu) Drenaj Ve Tigh Projesi"
    },
    {
        wrongName: "Vezirköprü Adatepe Gölet Sulama Derivasyon Kanalı İnşaatı",
        correctName: "Samsun Vezirköprü Arazi Toplulaştırma Ve Tarla İçi Geliştirme Hizmetleri İşi"
    },
    {
        // Using partial match for the wrong one as it might have weird chars
        wrongName: "Tokat Zile Özyurt Ve Almus Çevreli A.T. Ve Sulama Sistemleri Projesi Yapım İşi Avııı",
        correctName: "Tokat Zile Ovası 1 Kısım Arazi Toplulaştırma Ve Tarla İçi Geliştirme Hizmetleri Yapım İşi"
    }
];

async function main() {
    console.log("Starting Cash Book Correction...");

    const user = await prisma.user.findFirst({
        where: { name: { contains: "Ali Başer", mode: 'insensitive' } }
    });

    if (!user) {
        console.error("User Ali Başer not found!");
        return;
    }
    console.log(`Found User: ${user.name}`);

    for (const item of CORRECTIONS) {
        console.log(`\nProcessing: ${item.wrongName} -> ${item.correctName}`);

        // Find Wrong Site
        const wrongSite = await prisma.site.findFirst({
            where: { name: { contains: item.wrongName, mode: 'insensitive' } }
        });

        // Find Correct Site
        const correctSite = await prisma.site.findFirst({
            where: { name: { contains: item.correctName, mode: 'insensitive' } }
        });

        if (!wrongSite) {
            console.warn(`Could not find Wrong Site: ${item.wrongName}`);
            continue;
        }
        if (!correctSite) {
            console.warn(`Could not find Correct Site: ${item.correctName}`);
            continue;
        }

        // Update Transactions
        // We filter by `responsibleUserId` OR `createdByUserId` to be safe, but mostly check matches
        const updateResult = await prisma.cashTransaction.updateMany({
            where: {
                siteId: wrongSite.id,
                // Ensure we only touch Ali's imported data.
                // The import script set both responsible and createdBy to Ali.
                responsibleUserId: user.id
            },
            data: {
                siteId: correctSite.id
            }
        });

        console.log(`Moved ${updateResult.count} transactions from '${wrongSite.name}' to '${correctSite.name}'.`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
