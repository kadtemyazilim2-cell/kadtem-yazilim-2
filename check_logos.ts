
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking Company Logos...');

    const companies = await prisma.company.findMany({
        select: {
            id: true,
            name: true,
            logoUrl: true,
            letterhead: true
        }
    });

    console.log(`Found ${companies.length} companies.`);
    console.log('---------------------------------------------------');
    console.log('| Name | Has LogoUrl | Has Letterhead | Letterhead Size |');
    console.log('---------------------------------------------------');

    for (const c of companies) {
        const hasLogoUrl = !!c.logoUrl;
        const hasLetterhead = !!c.letterhead;
        const lhSize = c.letterhead ? c.letterhead.length : 0;

        // Print preview of start of letterhead to see if they match
        const lhPreview = c.letterhead ? c.letterhead.substring(0, 20) + '...' : '-';

        console.log(`| ${c.name.padEnd(30)} | ${hasLogoUrl} | ${hasLetterhead} | ${lhSize} bytes | ${lhPreview}`);
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
