const { PrismaClient } = require('@prisma/client');

async function main() {
    const prisma = new PrismaClient();

    try {
        const TANK_ID = 'cmknxtc9p0001sufe6amae37c'; // Aydın Nazilli Yenipazar

        // 1. Get current tank data
        const tank = await prisma.fuelTank.findUnique({
            where: { id: TANK_ID },
            include: { site: { select: { name: true } } }
        });

        if (!tank) {
            console.error('Tank bulunamadı!');
            return;
        }

        console.log('=== MEVCUT DURUM ===');
        console.log(`Şantiye: ${tank.site?.name}`);
        console.log(`Depo: ${tank.name}`);
        console.log(`Mevcut Seviye: ${tank.currentLevel} Lt`);

        // Devir yakıtı = currentLevel + Σ(consumed) - Σ(purchased) - Σ(transferIn) + Σ(transferOut)
        // Şu anki devir yanlış, olması gereken 11905
        // Fark = mevcut_devir - 11905
        // currentLevel'ı da aynı fark kadar azaltmamız lazım
        // Çünkü devir = currentLevel + sabit_transactions_etkisi
        // Yani devir'i X kadar azaltmak = currentLevel'ı X kadar azaltmak

        // reset-fuel.js'de başlangıç seviyesi 12230 olarak ayarlanmıştı
        // Olması gereken 11905, fark = 12230 - 11905 = 325
        const FARK = 325; // 12230 - 11905

        const yeniSeviye = tank.currentLevel - FARK;

        console.log(`\n=== DÜZELTME ===`);
        console.log(`Eski başlangıç (devir): 12230`);
        console.log(`Doğru başlangıç (devir): 11905`);
        console.log(`Fark: ${FARK}`);
        console.log(`Mevcut currentLevel: ${tank.currentLevel}`);
        console.log(`Yeni currentLevel: ${yeniSeviye}`);

        // 2. Update
        const updated = await prisma.fuelTank.update({
            where: { id: TANK_ID },
            data: { currentLevel: yeniSeviye }
        });

        console.log(`\n✅ Güncellendi! Yeni seviye: ${updated.currentLevel} Lt`);
        console.log('Devir yakıtı artık 11905 olarak hesaplanacak.');

    } catch (e) {
        console.error('HATA:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
