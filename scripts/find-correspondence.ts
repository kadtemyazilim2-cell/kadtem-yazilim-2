import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Find outgoing correspondences on 2026-02-23
    const startOfDay = new Date('2026-02-23T00:00:00.000Z');
    const endOfDay = new Date('2026-02-23T23:59:59.999Z');

    const correspondences = await prisma.correspondence.findMany({
        where: {
            direction: 'OUTGOING',
            date: {
                gte: startOfDay,
                lte: endOfDay
            }
        },
        include: {
            company: { select: { name: true, shortName: true } },
            site: { select: { name: true } },
            createdByUser: { select: { name: true } }
        },
        orderBy: { date: 'asc' }
    });

    console.log(`Found ${correspondences.length} outgoing correspondences on 2026-02-23:`);
    for (const c of correspondences) {
        console.log('---');
        console.log('ID:', c.id);
        console.log('Date:', c.date.toISOString());
        console.log('Direction:', c.direction);
        console.log('Type:', c.type);
        console.log('Subject:', c.subject);
        console.log('Description:', c.description);
        console.log('Reference Number:', c.referenceNumber);
        console.log('Registration Number:', c.registrationNumber);
        console.log('Sender/Receiver:', c.senderReceiver);
        console.log('SenderReceiverAlignment:', c.senderReceiverAlignment);
        console.log('Interest:', JSON.stringify(c.interest));
        console.log('Appendices:', JSON.stringify(c.appendices));
        console.log('Company:', c.company?.name, '/', c.company?.shortName);
        console.log('Site:', c.site?.name);
        console.log('Created By:', c.createdByUser?.name);
        console.log('Include Stamp:', c.includeStamp);
        console.log('Status:', c.status);
        console.log('CreatedAt:', c.createdAt.toISOString());
        console.log('UpdatedAt:', c.updatedAt.toISOString());
        console.log('Attachment URLs:', JSON.stringify(c.attachmentUrls));
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
