
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Searching for vehicles...");

    const vehicles = await prisma.vehicle.findMany({
        where: {
            OR: [
                { plate: { contains: '34' } },
                { plate: { contains: '2025' } },
                { brand: { contains: 'Hidromek' } },
                { model: { contains: 'Hidromek' } },
                { type: { equals: 'EXCAVATOR' } } // Enum match might require equals or just remove if string
            ]
        },
        select: {
            id: true,
            plate: true,
            brand: true,
            model: true,
            type: true
        }
    });

    console.log("Found vehicles:", JSON.stringify(vehicles, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
