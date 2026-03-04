const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    const count = await p.correspondence.count({ where: { status: 'DELETED' } });
    console.log('Deleted correspondences found:', count);

    if (count === 0) {
        console.log('Nothing to delete.');
        return;
    }

    var deleted = await p.correspondence.findMany({
        where: { status: 'DELETED' },
        select: { id: true, subject: true, date: true, direction: true }
    });

    for (var i = 0; i < deleted.length; i++) {
        var x = deleted[i];
        console.log('  ' + (i + 1) + '. [' + x.direction + '] ' + x.subject + ' (' + x.date.toISOString().split('T')[0] + ')');
    }

    var result = await p.correspondence.deleteMany({ where: { status: 'DELETED' } });
    console.log('Permanently deleted:', result.count);
}

main()
    .catch(console.error)
    .finally(function () { return p.$disconnect(); });
