import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- CHECKING SPECIFIC RECORD ---');
    const targetId = 'cmlgglqr1000bfadb5dpg95gx';
    console.log(`Looking for ID: ${targetId}`);

    const record = await prisma.vehicleAttendance.findUnique({
        where: { id: targetId }
    });

    if (record) {
        console.log('✅ Record FOUND:');
        console.log(JSON.stringify(record, null, 2));
    } else {
        console.log('❌ Record NOT FOUND. The write operation claimed success but data is missing.');
    }
    console.log('--- END ---');
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
