
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Checking Companies...');
    const companies = await prisma.company.findMany({
        where: {
            name: { in: ['Doğanlı Çiftliği', 'KAD-TEM A.Ş.', 'KAD-TEM A.Ş'] } // Checking variations
        },
        include: {
            _count: {
                select: { sites: true, vehicles: true, users: true }
            }
        }
    });
    console.log('Companies found:', JSON.stringify(companies, null, 2));

    if (companies.length > 0) {
        const companyIds = companies.map(c => c.id);
        console.log('Checking Sites under these companies...');
        const sites = await prisma.site.findMany({
            where: {
                companyId: { in: companyIds }
            }
        });
        console.log('Sites found:', JSON.stringify(sites, null, 2));
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
