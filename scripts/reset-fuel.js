const { PrismaClient } = require('@prisma/client');

async function main() {
    const prisma = new PrismaClient();

    try {
        console.log('=== MAZOT VERİLERİNİ SIFIRLAMA ===\n');

        // 1. Delete all FuelLogs
        const deletedLogs = await prisma.fuelLog.deleteMany({});
        console.log(`✅ ${deletedLogs.count} adet FuelLog silindi`);

        // 2. Delete all FuelTransfers
        const deletedTransfers = await prisma.fuelTransfer.deleteMany({});
        console.log(`✅ ${deletedTransfers.count} adet FuelTransfer silindi`);

        // 3. Set tank levels
        const tankUpdates = [
            { id: 'cmkpgizus000164i2nk9g2n8d', name: 'Doğanlı', level: 4936 },
            { id: 'cml27nh1j0001b27ecwyr6lkl', name: 'Zile 1', level: 16559 },
            { id: 'cmknxtc9p0001sufe6amae37c', name: 'Aydın Nazilli Yenipazar', level: 12230 },
            { id: 'cmknxtqi50003sufe87nc7di2', name: 'Samsun Vezirköprü', level: 2905 },
        ];

        console.log('\n--- Tank Seviyeleri Güncelleniyor ---');
        for (const tank of tankUpdates) {
            const result = await prisma.fuelTank.update({
                where: { id: tank.id },
                data: { currentLevel: tank.level }
            });
            console.log(`✅ ${tank.name}: ${result.currentLevel} Lt olarak ayarlandı`);
        }

        // 4. Verify
        console.log('\n=== DOĞRULAMA ===');
        const allTanks = await prisma.fuelTank.findMany({
            select: { name: true, currentLevel: true, capacity: true }
        });
        allTanks.forEach(t => {
            console.log(`  ${t.name}: ${t.currentLevel} / ${t.capacity} Lt`);
        });

        const remainingLogs = await prisma.fuelLog.count();
        const remainingTransfers = await prisma.fuelTransfer.count();
        console.log(`\nKalan FuelLog: ${remainingLogs}`);
        console.log(`Kalan FuelTransfer: ${remainingTransfers}`);

        console.log('\n✅ Tamamlandı!');

    } catch (e) {
        console.error('HATA:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
