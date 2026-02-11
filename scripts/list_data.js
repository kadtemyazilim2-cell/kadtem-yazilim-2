
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- SITES ---');
    const sites = await prisma.site.findMany({ take: 5, select: { id: true, name: true } });
    sites.forEach(s => console.log(`${s.name}: ${s.id}`));

    console.log('\n--- VEHICLES (with Assignments) ---');
    const vehicles = await prisma.vehicle.findMany({
        take: 5,
        select: { id: true, plate: true, assignedSiteId: true, assignedSites: { select: { id: true, name: true } } }
    });
    vehicles.forEach(v => {
        console.log(`${v.plate} (${v.id})`);
        console.log(`  Legacy: ${v.assignedSiteId}`);
        console.log(`  Relation: ${v.assignedSites.map(s => s.name).join(', ')}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
