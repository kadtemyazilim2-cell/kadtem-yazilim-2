
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const sites = await prisma.site.findMany({
        select: {
            id: true,
            name: true,
            status: true,
            isWarehouse: true,
            location: true,
            company: { select: { name: true } }
        }
    });
    console.log(JSON.stringify(sites, null, 2));
}

main()
    .catch(e => {
        throw e
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
