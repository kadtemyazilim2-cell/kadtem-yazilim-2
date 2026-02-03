
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const sites = await prisma.site.findMany();
    console.log(JSON.stringify(sites.map(s => s.name), null, 2));
}
main().finally(() => prisma.$disconnect());
