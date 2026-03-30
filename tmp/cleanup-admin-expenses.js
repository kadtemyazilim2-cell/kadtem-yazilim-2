const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('Cleaning up System Admin buggy transactions...');

    const idsToDelete = [
        'cmna0a279000939bdf1kzz811', // 550 TL Zile büro yemek
        'cmna0n3ck000rns8lfxiuqaml'  // 600 TL 140G Greyder hava tahliyesi
    ];

    const deleteResult = await prisma.cashTransaction.deleteMany({
        where: {
            id: { in: idsToDelete }
        }
    });

    console.log(`Deleted ${deleteResult.count} expense records.`);

    // Check for any other records for Sistem Yöneticisi
    const admin = await prisma.user.findFirst({
        where: { name: { contains: 'Sistem Yöneticisi' } }
    });

    if (admin) {
        const remaining = await prisma.cashTransaction.findMany({
            where: { responsibleUserId: admin.id }
        });
        console.log(`Remaining records for Admin: ${remaining.length}`);
        
        if (remaining.length > 0) {
            const deleteRemaining = await prisma.cashTransaction.deleteMany({
                where: { responsibleUserId: admin.id }
            });
            console.log(`Deleted ${deleteRemaining.count} additional records for Admin.`);
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
