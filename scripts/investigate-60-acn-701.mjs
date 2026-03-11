import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function investigate() {
    try {
        console.log('--- SITE INVESTIGATION ---');
        const sites = await prisma.site.findMany({
            where: { name: { contains: 'Aydın', mode: 'insensitive' } }
        });
        console.log('Sites matching "Aydın":', sites.map(s => ({ id: s.id, name: s.name })));

        if (sites.length === 0) {
            console.log('No site found with "Aydın" in name.');
            return;
        }

        const aydinSiteId = sites[0].id; // Assuming the first one is the intended one

        console.log('\n--- VEHICLE INVESTIGATION (60 ACN 701) ---');
        const vehicle = await prisma.vehicle.findUnique({
            where: { plate: '60 ACN 701' },
            include: {
                assignedSite: true,
                assignedSites: true
            }
        });

        if (!vehicle) {
            console.log('Vehicle "60 ACN 701" not found.');
            return;
        }

        console.log('Vehicle ID:', vehicle.id);
        console.log('Current Primary Site:', vehicle.assignedSite?.name || 'None');
        console.log('Assigned Sites:', vehicle.assignedSites.map(s => s.name).join(', ') || 'None');

        console.log('\n--- ATTENDANCE RECORDS FOR VEHICLE IN AYDIN ---');
        const attendance = await prisma.vehicleAttendance.findMany({
            where: {
                vehicleId: vehicle.id,
                siteId: aydinSiteId
            },
            orderBy: { date: 'desc' },
            take: 10
        });

        if (attendance.length > 0) {
            console.log(`Found ${attendance.length} attendance records for this vehicle in Aydın site.`);
            attendance.forEach(a => {
                console.log(`  - Date: ${a.date.toISOString().split('T')[0]}, Status: ${a.status}, Hours: ${a.hours}`);
            });
        } else {
            console.log('No attendance records found for this vehicle in Aydın site.');
        }

    } catch (e) {
        console.error('ERROR:', e);
    } finally {
        await prisma.$disconnect();
    }
}

investigate();
