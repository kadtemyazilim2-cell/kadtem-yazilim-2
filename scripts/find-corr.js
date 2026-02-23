const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Total count
    const total = await prisma.correspondence.count();
    console.log('Total correspondences:', total);

    // By company
    const byCompany = await prisma.correspondence.groupBy({
        by: ['companyId'],
        _count: true
    });
    console.log('\nBy company:');
    for (const g of byCompany) {
        const comp = await prisma.company.findUnique({ where: { id: g.companyId }, select: { name: true, shortName: true } });
        console.log(`  ${comp?.shortName} (${g.companyId}): ${g._count}`);
    }

    // Most recent 5
    const recent = await prisma.correspondence.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
            company: { select: { name: true, shortName: true } }
        }
    });
    console.log('\nMost recent 5:');
    for (const c of recent) {
        console.log('---');
        console.log('ID:', c.id);
        console.log('CreatedAt:', c.createdAt?.toISOString());
        console.log('Date:', c.date?.toISOString());
        console.log('Company:', c.company?.shortName, '/', c.company?.name);
        console.log('Direction:', c.direction);
        console.log('RefNum:', JSON.stringify(c.referenceNumber));
        console.log('Subject:', JSON.stringify(c.subject));
    }

    // Specifically IKIKAT
    const ikikat = await prisma.correspondence.findMany({
        where: { companyId: 'comp_ikikat' },
        include: { company: { select: { name: true } } }
    });
    console.log('\n\nIKIKAT (comp_ikikat) correspondences:', ikikat.length);

    // Also try ALL companies with IKI in name
    const ikiCompanies = await prisma.company.findMany({
        where: { name: { contains: 'IKI', mode: 'insensitive' } },
        select: { id: true, name: true, shortName: true }
    });
    console.log('\nCompanies with IKI in name:');
    ikiCompanies.forEach(c => console.log(`  ${c.id} | ${c.shortName} | ${c.name}`));

    // Check for any correspondence created in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCreated = await prisma.correspondence.findMany({
        where: { createdAt: { gte: oneHourAgo } },
        include: { company: { select: { name: true, shortName: true } } }
    });
    console.log('\nCreated in last hour:', recentCreated.length);
    for (const c of recentCreated) {
        console.log('  ', c.id, c.company?.shortName, c.createdAt?.toISOString());
    }

    await prisma['$disconnect']();
}

main().catch(console.error);
