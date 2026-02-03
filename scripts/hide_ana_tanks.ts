
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Hiding 'Ana Tank' records...");

    const result = await prisma.fuelTank.updateMany({
        where: { name: 'Ana Tank' },
        data: { status: 'PASSIVE' }
    });

    console.log(`Updated ${result.count} tanks to PASSIVE status.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
