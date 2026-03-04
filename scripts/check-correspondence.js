const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log('=== Bugünkü Yazışmalar ===');
    const todayCorr = await prisma.correspondence.findMany({
        where: {
            date: { gte: today, lt: tomorrow }
        },
        orderBy: { createdAt: 'desc' }
    });
    console.log(`Bugün ${todayCorr.length} adet yazışma bulundu:`);
    todayCorr.forEach(c => {
        console.log(`  ID: ${c.id}`);
        console.log(`  Konu: ${c.subject}`);
        console.log(`  Yön: ${c.direction}`);
        console.log(`  Durum: ${c.status}`);
        console.log(`  Tarih: ${c.date}`);
        console.log(`  Oluşturulma: ${c.createdAt}`);
        console.log(`  SiteId: ${c.siteId || 'YOK'}`);
        console.log('  ---');
    });

    console.log('\n=== Son 10 Yazışma (Tüm zamanlar) ===');
    const recent = await prisma.correspondence.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10
    });
    recent.forEach(c => {
        console.log(`  [${c.status}] ${c.direction} | ${c.date.toISOString().split('T')[0]} | ${c.subject?.substring(0, 50)} | siteId: ${c.siteId || 'NULL'}`);
    });

    console.log('\n=== OUTGOING + DELETED olanlar (bugün) ===');
    const deleted = await prisma.correspondence.findMany({
        where: {
            status: 'DELETED',
            createdAt: { gte: today }
        }
    });
    console.log(`Bugün silinen: ${deleted.length}`);
    deleted.forEach(c => {
        console.log(`  ID: ${c.id} | ${c.subject} | Silme nedeni: ${c.deletionReason}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
