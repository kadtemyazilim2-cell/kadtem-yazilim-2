import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findDuplicates() {
    const allAttendance = await prisma.vehicleAttendance.findMany({
        orderBy: [{ vehicleId: 'asc' }, { date: 'asc' }]
    });

    let duplicatesFound = 0;
    for (let i = 0; i < allAttendance.length - 1; i++) {
        const current = allAttendance[i];
        const next = allAttendance[i + 1];

        if (current.vehicleId === next.vehicleId &&
            current.date.toISOString().split('T')[0] === next.date.toISOString().split('T')[0]) {
            console.log(`Duplicate found for vehicle ${current.vehicleId} on ${current.date.toISOString().split('T')[0]}`);
            duplicatesFound++;
        }
    }
    console.log(`\nToplam ${duplicatesFound} mükerrer (aynı gün) kayıt grubu bulundu.`);
}

findDuplicates()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
