
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const sites = await prisma.site.findMany();
    console.log(JSON.stringify(sites, null, 2));
}

main()
    .catch(e => {
        throw e
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
