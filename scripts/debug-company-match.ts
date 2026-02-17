import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const companies = await prisma.company.findMany();
    console.log('Companies:', JSON.stringify(companies, null, 2));

    const bidderName = "ÖZ PEHLİVAN İNŞ., ELEK., HAYVANCILIK, GID., NAKLİYE SAN. VE TİC. LTD. ŞTİ., KADİR DİNÇER KOZAN";
    const normalizedBidder = bidderName.toLocaleLowerCase('tr');

    console.log('\nChecking matches for:', bidderName);
    console.log('Normalized:', normalizedBidder);

    companies.forEach(c => {
        const cName = c.name.toLocaleLowerCase('tr');
        const cShort = c.shortName?.toLocaleLowerCase('tr');

        console.log(`\nChecking against Company: ${c.name} (Short: ${c.shortName})`);

        if (normalizedBidder.includes(cName)) {
            console.log(`MATCH via Name: "${cName}" found in bidder string.`);
        }

        if (cShort && normalizedBidder.includes(cShort)) {
            console.log(`MATCH via ShortName: "${cShort}" found in bidder string.`);
        }
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
