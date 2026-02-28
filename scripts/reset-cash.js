const { PrismaClient } = require('@prisma/client');

async function main() {
    const prisma = new PrismaClient();

    try {
        console.log('=== KASA DEFTERİ VERİLERİNİ SIFIRLAMA ===\n');

        // 1. Count existing records
        const count = await prisma.cashTransaction.count();
        console.log(`Mevcut kayıt sayısı: ${count}`);

        // 2. Delete all cash transactions
        const deleted = await prisma.cashTransaction.deleteMany({});
        console.log(`✅ ${deleted.count} adet CashTransaction silindi`);

        // 3. Find the 3 users
        const targetUsers = [
            { name: 'Asım', balance: 3278.31 },
            { name: 'Ali Başer', balance: 8138 },
            { name: 'Gülay', balance: -159.34 },
        ];

        const allUsers = await prisma.user.findMany({
            select: { id: true, name: true }
        });

        console.log('\n--- Kullanıcılar ---');

        // Find a default site for the opening balance transactions
        const defaultSite = await prisma.site.findFirst({
            where: { status: 'ACTIVE' },
            select: { id: true, name: true }
        });

        if (!defaultSite) {
            console.error('Aktif şantiye bulunamadı!');
            return;
        }

        // Find admin user for createdByUserId
        const adminUser = await prisma.user.findFirst({
            where: { role: 'ADMIN' },
            select: { id: true }
        });

        if (!adminUser) {
            console.error('Admin kullanıcı bulunamadı!');
            return;
        }

        for (const target of targetUsers) {
            const user = allUsers.find(u => u.name.toLowerCase().includes(target.name.toLowerCase()));
            if (!user) {
                console.log(`❌ "${target.name}" kullanıcısı bulunamadı!`);
                continue;
            }

            console.log(`  ${user.name} (ID: ${user.id}) -> Devreden Bakiye: ${target.balance} TL`);

            // Create an opening balance transaction
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
            console.log(`  ✅ Devreden bakiye kaydı oluşturuldu: ${target.balance} TL`);
        }

        // 4. Verify
        console.log('\n=== DOĞRULAMA ===');
        const remaining = await prisma.cashTransaction.findMany({
            select: {
                type: true,
                category: true,
                amount: true,
                description: true,
                responsibleUser: { select: { name: true } }
            }
        });

        remaining.forEach(r => {
            const sign = r.type === 'INCOME' ? '+' : '-';
            console.log(`  ${r.responsibleUser?.name || '-'}: ${sign}${r.amount} TL (${r.category})`);
        });

        console.log(`\nToplam kayıt: ${remaining.length}`);
        console.log('✅ Tamamlandı!');

    } catch (e) {
        console.error('HATA:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
