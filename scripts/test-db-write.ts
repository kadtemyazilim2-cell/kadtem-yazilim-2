// Test: Can we write to VehicleAttendance table at all?
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('=== Test: Direct DB Write to VehicleAttendance ===\n');

    // Get any vehicle and site
    const vehicle = await prisma.vehicle.findFirst({ where: { status: 'ACTIVE' }, select: { id: true, plate: true } });
    const site = await prisma.site.findFirst({ where: { status: 'ACTIVE' }, select: { id: true, name: true } });

    if (!vehicle || !site) {
        console.error('No active vehicle/site');
        return;
    }

    console.log(`Vehicle: ${vehicle.plate} (${vehicle.id})`);
    console.log(`Site: ${site.name} (${site.id})`);

    // Try to create a test record for a date that shouldn't exist (Feb 28)
    const testDate = new Date(Date.UTC(2026, 1, 28, 12, 0, 0)); // Feb 28 noon UTC
    console.log(`Test date: ${testDate.toISOString()}`);

    // Check if it already exists
    const existing = await prisma.vehicleAttendance.findFirst({
        where: {
            vehicleId: vehicle.id,
            date: {
                gte: new Date(Date.UTC(2026, 1, 28, 0, 0, 0)),
                lte: new Date(Date.UTC(2026, 1, 28, 23, 59, 59))
            }
        }
    });

    if (existing) {
        console.log('Record already exists for this date, cleaning up first...');
        await prisma.vehicleAttendance.delete({ where: { id: existing.id } });
    }

    // Create
    try {
        const created = await prisma.vehicleAttendance.create({
            data: {
                vehicleId: vehicle.id,
                siteId: site.id,
                date: testDate,
                status: 'WORK',
                hours: 8,
            }
        });
        console.log('✅ CREATE SUCCESS:', created.id);
        console.log('   Date stored:', created.date.toISOString());

        // Verify read
        const read = await prisma.vehicleAttendance.findUnique({ where: { id: created.id } });
        console.log('✅ READ SUCCESS:', read?.id, read?.date.toISOString());

        // Clean up
        await prisma.vehicleAttendance.delete({ where: { id: created.id } });
        console.log('✅ CLEANUP done');
    } catch (error: any) {
        console.error('❌ WRITE FAILED:', error.message);
        console.error('Full error:', error);
    }

    // Also check: do we have any records with mismatched site IDs?
    console.log('\n=== Check: Records with different site IDs in Feb 2026 ===');
    const allSiteIds = await prisma.vehicleAttendance.groupBy({
        by: ['siteId'],
        where: {
            date: {
                gte: new Date('2026-02-01'),
                lte: new Date('2026-02-28')
            }
        },
        _count: true
    });
    console.log('Site ID distribution:');
    for (const s of allSiteIds) {
        const siteName = await prisma.site.findUnique({ where: { id: s.siteId }, select: { name: true } });
        console.log(`  ${siteName?.name || 'Unknown'} (${s.siteId}): ${s._count} records`);
    }
}

main()
    .catch(e => console.error('Script Error:', e))
    .finally(() => prisma.$disconnect());
