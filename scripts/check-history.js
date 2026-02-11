
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const vId = 'cmkpf4kbu0001ln7f575rdar1'; // 20 AOF 266
    const sId = 'cmkmop5q5000fhgexroggue2m'; // Site

    console.log('--- Checking Vehicle ---');
    const v = await prisma.vehicle.findUnique({
        where: { id: vId },
        include: { assignedSites: true }
    });
    console.log(v);

    console.log('\n--- Checking History ---');
    const history = await prisma.vehicleAssignmentHistory.findMany({
        where: { vehicleId: vId, siteId: sId }
    });
    console.log(history);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
