
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Swapping logos...');

    const c1 = await prisma.company.findFirst({ where: { name: { contains: 'İKİKAT', mode: 'insensitive', not: { name: { contains: 'KENAN' } } } } }); // Real Ikikat
    const c2 = await prisma.company.findFirst({ where: { name: { contains: 'KENAN', mode: 'insensitive' } } }); // Kenan

    if (!c1 || !c2) {
        console.error('Could not find both companies.');
        return;
    }

    const logo1 = c1.letterhead;
    const logo2 = c2.letterhead;

    console.log(`Ikikat (${c1.name}) Logo Size: ${logo1?.length}`);
    console.log(`Kenan (${c2.name}) Logo Size: ${logo2?.length}`);

    // Swap
    await prisma.company.update({ where: { id: c1.id }, data: { letterhead: logo2 } });
    await prisma.company.update({ where: { id: c2.id }, data: { letterhead: logo1 } });

    console.log('Logos SWAPPED. Please verify.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
