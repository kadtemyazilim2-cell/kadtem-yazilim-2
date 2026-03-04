const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    // Find PASSIVE agencies that still show up
    var passive = await p.institution.findMany({
        where: {
            status: 'PASSIVE',
            category: { in: ['INSURANCE_AGENCY', 'INSURANCE_COMPANY'] }
        }
    });
    console.log('PASSIVE insurance institutions:', passive.length);
    passive.forEach(function (x) { console.log('  -', x.id, '|', x.name, '|', x.category, '|', x.status); });

    // Find any with empty/blank names
    var all = await p.institution.findMany({
        where: {
            category: { in: ['INSURANCE_AGENCY', 'INSURANCE_COMPANY'] }
        }
    });
    var empty = all.filter(function (x) { return !x.name || x.name.trim() === ''; });
    console.log('\nEmpty-name insurance institutions:', empty.length);
    empty.forEach(function (x) { console.log('  -', x.id, '|', JSON.stringify(x.name), '|', x.category, '|', x.status); });

    await p.$disconnect();
}

main().catch(console.error);
