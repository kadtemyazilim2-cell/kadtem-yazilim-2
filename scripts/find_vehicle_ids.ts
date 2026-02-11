
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const v1 = await prisma.vehicle.findUnique({ where: { plate: '06 ADV 304' } });
    const v2 = await prisma.vehicle.findUnique({ where: { plate: '01 C 9569' } });

    console.log('06 ADV 304:', v1);
    console.log('01 C 9569:', v2);

    // Also find the site "Aydın Nazilli..."
    const site = await prisma.site.findFirst({
        where: { name: { contains: 'Aydın Nazilli' } }
    });
    console.log('Site:', site);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
