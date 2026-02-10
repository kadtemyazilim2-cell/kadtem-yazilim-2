import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // The ID we verified exists earlier
    const id = 'cmlgglqr1000bfadb5dpg95gx';

    console.log(`Checking Record ID: ${id}`);

    const record = await prisma.vehicleAttendance.findUnique({
        where: { id },
        include: {
            vehicle: true,
            site: true
        }
    });

    if (!record) {
        console.log('❌ Record NOT found!');
        return;
    }

    console.log('✅ Record Found:');
    console.log(`- Date: ${record.date.toISOString()} (Local: ${record.date.toLocaleString()})`);
    console.log(`- Vehicle: ${record.vehicle.plate}`);
    console.log(`- Site ID: ${record.siteId}`);
    console.log(`- Site Name: ${record.site?.name}`);
    console.log(`- Status: ${record.status}`);

    // Also list all sites to compare
    console.log('\n--- All Available Sites ---');
    const sites = await prisma.site.findMany();
    sites.forEach(s => {
        console.log(`[${s.id}] ${s.name} (Status: ${s.status})`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
