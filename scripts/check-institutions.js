const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    try {
        const institutions = await p.institution.findMany();
        console.log(`Found ${institutions.length} institutions.`);

        const akSigorta = institutions.find(i => i.name === 'AK SİGORTA' || i.name === 'AK SIGORTA');
        const ahmetCan = institutions.find(i => i.name === 'ahmet can' || i.name === 'Ahmet Can');

        console.log('AK SİGORTA found:', akSigorta ? 'YES' : 'NO');
        console.log('ahmet can found:', ahmetCan ? 'YES' : 'NO');

        if (akSigorta) console.log('AK Sigorta Category:', akSigorta.category);
        if (ahmetCan) console.log('Ahmet Can Category:', ahmetCan.category);

        // List all insurance companies
        console.log('\n--- Insurance Companies ---');
        institutions.filter(i => i.category === 'INSURANCE_COMPANY').forEach(i => console.log(i.name));

        console.log('\n--- Insurance Agencies ---');
        institutions.filter(i => i.category === 'INSURANCE_AGENCY').forEach(i => console.log(i.name));

    } catch (e) {
        console.error('ERROR:', e);
    } finally {
        await p.$disconnect();
    }
}

main();
