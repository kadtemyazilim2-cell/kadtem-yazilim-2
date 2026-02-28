import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

// TEMPORARY: Secret-protected endpoint to reset cash + fuel data on production
// DELETE this file after use
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    if (secret !== 'kadtem-reset-2026') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: string[] = [];

    try {
        // ==========================================
        // 1. RESET CASH TRANSACTIONS
        // ==========================================
        results.push('=== KASA DEFTERİ SIFIRLAMA ===');

        const cashCount = await prisma.cashTransaction.count();
        results.push(`Mevcut kasa kayıt sayısı: ${cashCount}`);

        const deletedCash = await prisma.cashTransaction.deleteMany({});
        results.push(`✅ ${deletedCash.count} kasa kaydı silindi`);

        // Find users
        const allUsers = await prisma.user.findMany({ select: { id: true, name: true } });
        const defaultSite = await prisma.site.findFirst({ where: { status: 'ACTIVE' }, select: { id: true } });
        const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });

        if (!defaultSite || !adminUser) {
            return NextResponse.json({ error: 'Site veya admin bulunamadı', results });
        }

        const cashTargets = [
            { name: 'Asım', balance: 3278.31 },
            { name: 'Ali Başer', balance: 8138 },
            { name: 'Gülay', balance: -159.34 },
        ];

        for (const target of cashTargets) {
            const user = allUsers.find(u => u.name.toLowerCase().includes(target.name.toLowerCase()));
            if (!user) {
                results.push(`❌ "${target.name}" bulunamadı`);
                continue;
            }

            const isIncome = target.balance >= 0;
            await prisma.cashTransaction.create({
                data: {
                    siteId: defaultSite.id,
                    date: new Date('2026-01-01'),
                    type: isIncome ? 'INCOME' : 'EXPENSE',
                    category: 'Devreden Bakiye',
                    amount: Math.abs(target.balance),
                    description: 'Devreden bakiye - Sistem tarafından oluşturuldu',
                    paymentMethod: 'CASH',
                    responsibleUserId: user.id,
                    createdByUserId: adminUser.id
                }
            });
            results.push(`✅ ${user.name}: ${target.balance} TL devir oluşturuldu`);
        }

        // ==========================================
        // 2. RESET FUEL DATA
        // ==========================================
        results.push('');
        results.push('=== YAKIT VERİLERİ SIFIRLAMA ===');

        // Delete all fuel logs
        const fuelLogCount = await prisma.fuelLog.count();
        const deletedFuelLogs = await prisma.fuelLog.deleteMany({});
        results.push(`✅ ${deletedFuelLogs.count} yakıt kaydı silindi`);

        // Delete all fuel transfers
        const fuelTransferCount = await prisma.fuelTransfer.count();
        const deletedFuelTransfers = await prisma.fuelTransfer.deleteMany({});
        results.push(`✅ ${deletedFuelTransfers.count} yakıt transfer kaydı silindi`);

        // Set initial tank levels (devir)
        // Doğanlı: 4936, Zile 1: 16559, Aydın Nazilli: 12230, Samsun Vezirköprü: 2905
        const tankUpdates = [
            { siteName: 'Doğanlı', level: 4936 },
            { siteName: 'Zile', level: 16559 },
            { siteName: 'Nazilli', level: 12230 },
            { siteName: 'Vezirköprü', level: 2905 },
        ];

        const allTanks = await prisma.fuelTank.findMany({
            include: { site: { select: { name: true } } }
        });

        results.push(`Toplam tank sayısı: ${allTanks.length}`);

        for (const update of tankUpdates) {
            const tank = allTanks.find(t => t.site?.name?.toLowerCase().includes(update.siteName.toLowerCase()));
            if (!tank) {
                results.push(`❌ "${update.siteName}" tankı bulunamadı`);
                continue;
            }

            await prisma.fuelTank.update({
                where: { id: tank.id },
                data: { currentLevel: update.level }
            });
            results.push(`✅ ${tank.site?.name} tankı: ${update.level} Lt olarak güncellendi`);
        }

        // ==========================================
        // 3. REVALIDATE CACHE
        // ==========================================
        results.push('');
        results.push('=== CACHE TEMİZLEME ===');
        revalidatePath('/dashboard');
        revalidatePath('/dashboard/cash-book');
        revalidatePath('/dashboard/fuel');
        results.push('✅ Dashboard, Kasa Defteri ve Yakıt sayfaları revalidate edildi');

        // ==========================================
        // 4. VERIFY
        // ==========================================
        results.push('');
        results.push('=== DOĞRULAMA ===');

        const cashVerify = await prisma.cashTransaction.findMany({
            include: { responsibleUser: { select: { name: true } } }
        });
        cashVerify.forEach(t => {
            const sign = t.type === 'INCOME' ? '+' : '-';
            results.push(`  Kasa: ${t.responsibleUser?.name}: ${sign}${t.amount} TL`);
        });

        const fuelLogVerify = await prisma.fuelLog.count();
        const fuelTransferVerify = await prisma.fuelTransfer.count();
        results.push(`  Yakıt kayıt: ${fuelLogVerify}, Transfer: ${fuelTransferVerify}`);

        const tanksVerify = await prisma.fuelTank.findMany({
            include: { site: { select: { name: true } } }
        });
        tanksVerify.forEach(t => {
            results.push(`  Tank: ${t.site?.name}: ${t.currentLevel} Lt`);
        });

        return NextResponse.json({ success: true, results });

    } catch (error: any) {
        results.push(`❌ HATA: ${error.message}`);
        return NextResponse.json({ success: false, error: error.message, results }, { status: 500 });
    }
}
