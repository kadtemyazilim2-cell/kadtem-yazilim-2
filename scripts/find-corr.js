const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Check DB connection info
    console.log('POSTGRES_PRISMA_URL set:', !!process.env.POSTGRES_PRISMA_URL);
    console.log('POSTGRES_URL_NON_POOLING set:', !!process.env.POSTGRES_URL_NON_POOLING);

    // Count ALL correspondences
    const total = await prisma.correspondence.count();
    console.log('Total correspondences in DB:', total);

    // Count by company
    const byCompany = await prisma.correspondence.groupBy({
        by: ['companyId'],
        _count: true
    });
    console.log('\nCorrespondences by company:');
    for (const g of byCompany) {
        const comp = await prisma.company.findUnique({ where: { id: g.companyId }, select: { name: true, shortName: true } });
        console.log(`  ${comp?.shortName || 'unknown'} (${g.companyId}): ${g._count}`);
    }

    // Get the absolute latest record (by createdAt)
    const latest = await prisma.correspondence.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { id: true, createdAt: true, referenceNumber: true, subject: true, companyId: true }
    });
    console.log('\nMost recent record:', JSON.stringify(latest));

    // Check if there's any unstable_cache issue - query directly 
    const ikikatDirect = await prisma.correspondence.findMany({
        where: { companyId: 'comp_ikikat' }
    });
    console.log('\nDirect query for comp_ikikat:', ikikatDirect.length, 'records');

    await prisma['$disconnect']();
}

main().catch(console.error);
