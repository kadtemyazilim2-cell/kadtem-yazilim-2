
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const vehicles = await prisma.vehicle.findMany({
        orderBy: { plate: 'asc' }
    });
    console.log(JSON.stringify(vehicles.map(v => ({
        id: v.id,
        plate: v.plate,
        brand: v.brand,
        model: v.model
    })), null, 2));
}
main().finally(() => prisma.$disconnect());
