
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const sites = await prisma.site.findMany({
        where: { name: { contains: 'Zile' } }
    });
    console.log(JSON.stringify(sites, null, 2));
}
main().finally(() => prisma.$disconnect());
