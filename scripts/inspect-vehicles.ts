
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Inspecting vehicles...');

    const vehicles = await prisma.vehicle.findMany({
        where: {
            OR: [
                { brand: { contains: 'Jcb', mode: 'insensitive' } },
                { plate: { contains: 'Jcb', mode: 'insensitive' } },
                { model: { contains: 'Jcb', mode: 'insensitive' } },
                { brand: { contains: 'Tumosan', mode: 'insensitive' } },
                { plate: { contains: 'Tumosan', mode: 'insensitive' } },
                { brand: { contains: 'Tümosan', mode: 'insensitive' } }, // Handle Turkish char
                { plate: { contains: 'TRAKTÖR', mode: 'insensitive' } },
            ]
        }
    });

    console.log('Found Vehicles:');
    vehicles.forEach(v => {
        console.log(`[${v.id}] Plate: "${v.plate}", Brand: "${v.brand}", Model: "${v.model}", Company: "${v.companyId}"`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
