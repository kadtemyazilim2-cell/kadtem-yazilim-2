
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const tanks = await prisma.fuelTank.findMany({
        include: {
            site: true,
            _count: {
                select: { logs: true, transfersIn: true, transfersOut: true }
            },
            transfersOut: {
                take: 5,
                orderBy: { date: 'desc' },
                select: { date: true, amount: true }
            }
        }
    });
    console.log('Fuel Tanks:', JSON.stringify(tanks, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
