import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkBP844() {
    try {
        const plate = '60 BP 844';

        // 1. Check Vehicle
        const vehicle = await prisma.vehicle.findUnique({
            where: { plate },
            include: { assignedSites: { select: { name: true, id: true } } }
        });

        console.log('--- ARAÇ DURUMU (60 BP 844) ---');
        if (!vehicle) {
            console.log('Araç bulunamadı.');
        } else {
            console.log(`Plaka: ${vehicle.plate}`);
            console.log(`Durum: ${vehicle.status}`);
            console.log(`Atanan Şantiyeler:`, vehicle.assignedSites.map(s => s.name).join(', ') || 'YOK');
        }

        // 2. Check User (We'll look for a likely admin/manager)
        // Since we don't know the exact user, let's list users with lookback constraints
        const users = await prisma.user.findMany({
            where: { status: 'ACTIVE' },
            select: { id: true, name: true, role: true, editLookbackDays: true }
        });

        console.log('\n--- AKTİF KULLANICI KISITLAMALARI ---');
        users.forEach(u => {
            console.log(`Kullanıcı: ${u.name} | Rol: ${u.role} | Geriye Dönük Gün: ${u.editLookbackDays}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkBP844();
