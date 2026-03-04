import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Count deleted correspondences
    const count = await prisma.correspondence.count({
        where: { status: 'DELETED' }
    });

    console.log(`Found ${count} deleted correspondences.`);

    if (count === 0) {
        console.log('No deleted correspondences to purge.');
        return;
    }

    // List them first
    const deleted = await prisma.correspondence.findMany({
        where: { status: 'DELETED' },
        select: {
            id: true,
            subject: true,
            date: true,
            direction: true,
            deletionReason: true,
            deletionDate: true
        }
    });

    console.log('\nDeleted correspondences:');
    deleted.forEach((c, i) => {
        console.log(`  ${i + 1}. [${c.direction}] ${c.subject} (${c.date.toISOString().split('T')[0]}) - Reason: ${c.deletionReason || 'N/A'}`);
    });

    // Permanently delete all
    const result = await prisma.correspondence.deleteMany({
        where: { status: 'DELETED' }
    });

    console.log(`\n✅ Permanently deleted ${result.count} correspondences.`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
