
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Searching for '200.3' vehicles...");

    const vehicles = await prisma.vehicle.findMany({
        where: {
            OR: [
                { plate: { contains: "200.3", mode: 'insensitive' } },
                { brand: { contains: "200.3", mode: 'insensitive' } },
                { model: { contains: "200.3", mode: 'insensitive' } },
                // Also search for the specific names user mentioned if they are stored in brand/model
                { plate: { contains: "Fiat Hitachi", mode: 'insensitive' } }
            ]
        },
        include: {
            _count: {
                select: {
                    fuelLogs: true,
                    attendance: true,
                    assignmentHistory: true
                }
            }
        }
    });

    for (const v of vehicles) {
        console.log(`ID: ${v.id} | Plate: ${v.plate} | Brand: ${v.brand} | Model: ${v.model}`);
        console.log(`  Logs: ${v._count.fuelLogs} | Attendance: ${v._count.attendance} | Assigns: ${v._count.assignmentHistory}`);
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
