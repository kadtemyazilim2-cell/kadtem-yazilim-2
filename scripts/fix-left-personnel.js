const { PrismaClient } = require('@prisma/client');

async function main() {
    const prisma = new PrismaClient();

    try {
        // Find all personnel who have EXIT attendance but status is still ACTIVE
        const personnelWithExitAttendance = await prisma.personnel.findMany({
            where: {
                status: 'ACTIVE',
                attendance: {
                    some: {
                        status: 'EXIT'
                    }
                }
            },
            select: {
                id: true,
                fullName: true,
                status: true,
                leftDate: true,
                attendance: {
                    where: { status: 'EXIT' },
                    orderBy: { date: 'desc' },
                    take: 1,
                    select: { date: true, status: true }
                }
            }
        });

        console.log(`Found ${personnelWithExitAttendance.length} personnel with EXIT attendance but ACTIVE status:`);

        for (const p of personnelWithExitAttendance) {
            const exitDate = p.attendance[0]?.date;
            console.log(`  - ${p.fullName} (ID: ${p.id}), EXIT date: ${exitDate?.toISOString().split('T')[0]}`);

            // Fix: Update status to LEFT and set leftDate
            const result = await prisma.personnel.update({
                where: { id: p.id },
                data: {
                    status: 'LEFT',
                    leftDate: exitDate
                }
            });
            console.log(`    -> Fixed: status=${result.status}, leftDate=${result.leftDate?.toISOString().split('T')[0]}`);
        }

        if (personnelWithExitAttendance.length === 0) {
            console.log('No mismatched personnel found.');
        } else {
            console.log(`\nFixed ${personnelWithExitAttendance.length} personnel records.`);
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
