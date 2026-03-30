const { PrismaClient } = require('@prisma/client');

async function main() {
    const prisma = new PrismaClient();
    try {
        const VEZIRKOPRU_ID = 'cmknxtqi50003sufe87nc7di2';
        const AYDIN_ID = 'cmknxtc9p0001sufe6amae37c';

        // Samsun Vezirköprü: 2905 -> 415. Diff = 2490.
        const vezirkopru = await prisma.fuelTank.findUnique({ where: { id: VEZIRKOPRU_ID } });
        if (vezirkopru) {
            const oldValue = vezirkopru.currentLevel;
            const newValue = oldValue - 2490;
            await prisma.fuelTank.update({
                where: { id: VEZIRKOPRU_ID },
                data: { currentLevel: newValue }
            });
            console.log(`✅ Samsun Vezirköprü: ${oldValue} -> ${newValue}`);
        }

        // Aydın Nazilli Yenipazar: 11906.5 -> 11905. Diff = 1.5.
        const aydin = await prisma.fuelTank.findUnique({ where: { id: AYDIN_ID } });
        if (aydin) {
            const oldValue = aydin.currentLevel;
            const newValue = oldValue - 1.5;
            await prisma.fuelTank.update({
                where: { id: AYDIN_ID },
                data: { currentLevel: newValue }
            });
            console.log(`✅ Aydın Nazilli Yenipazar: ${oldValue} -> ${newValue}`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
