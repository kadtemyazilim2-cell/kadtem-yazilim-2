import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const tanks = await prisma.fuelTank.findMany({
        include: {
            site: true,
        }
    });

    console.log('Fuel Tanks:');
    tanks.forEach(t => {
        console.log(`- ID: ${t.id}, Name: ${t.name}, Site: ${t.site.name}, Status: ${t.status}, Liters: ${t.currentLiters}`);
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
