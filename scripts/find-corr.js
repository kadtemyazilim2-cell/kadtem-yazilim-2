const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Find ALL correspondences for IKIKAT company (comp_ikikat)
    const ikiCorr = await prisma.correspondence.findMany({
        where: { companyId: 'comp_ikikat' },
        include: {
            company: { select: { name: true, shortName: true } },
            site: { select: { name: true } },
            createdByUser: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
    });
    console.log('IKI company correspondences count:', ikiCorr.length);
    for (const c of ikiCorr) {
        console.log('---');
        console.log('ID:', c.id);
        console.log('Date:', c.date?.toISOString());
        console.log('CreatedAt:', c.createdAt?.toISOString());
        console.log('Direction:', c.direction);
        console.log('Company:', c.company?.shortName);
        console.log('Sayı (refNum):', JSON.stringify(c.referenceNumber));
        console.log('Konu (subject):', JSON.stringify(c.subject));
        console.log('Description (first 500):', JSON.stringify(c.description?.substring(0, 500)));
        console.log('SenderReceiver:', JSON.stringify(c.senderReceiver));
        console.log('Interest:', JSON.stringify(c.interest));
        console.log('Appendices:', JSON.stringify(c.appendices));
        console.log('IncludeStamp:', c.includeStamp);
    }

    // Also try searching description for TOKAT
    const tokatCorr = await prisma.correspondence.findMany({
        where: {
            OR: [
                { subject: { contains: 'TOKAT', mode: 'insensitive' } },
                { senderReceiver: { contains: 'TOKAT', mode: 'insensitive' } },
                { description: { contains: 'Sosyal Güvenlik', mode: 'insensitive' } }
            ]
        },
        include: {
            company: { select: { name: true, shortName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5
    });
    console.log('\n\nCorrespondences mentioning TOKAT or Sosyal Güvenlik:');
    for (const c of tokatCorr) {
        console.log('---');
        console.log('ID:', c.id);
        console.log('Date:', c.date?.toISOString());
        console.log('Company:', c.company?.shortName);
        console.log('Direction:', c.direction);
        console.log('Sayı (refNum):', JSON.stringify(c.referenceNumber));
        console.log('Konu (subject):', JSON.stringify(c.subject));
        console.log('Description (first 500):', JSON.stringify(c.description?.substring(0, 500)));
        console.log('SenderReceiver:', JSON.stringify(c.senderReceiver));
        console.log('Interest:', JSON.stringify(c.interest));
    }

    await prisma['$disconnect']();
}

main().catch(console.error);
