
import { prisma } from '@/lib/db';

async function main() {
    console.log('--- Checking Attendance Records ---');

    // 1. Get a active personnel
    const personnel = await prisma.personnel.findMany({
        where: { status: 'ACTIVE' },
        take: 5
    });

    console.log(`Found ${personnel.length} active personnel.`);

    const targetDate = new Date('2026-02-09');
    const startOfDay = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()));
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    console.log(`Checking for date range: ${startOfDay.toISOString()} - ${endOfDay.toISOString()}`);

    for (const p of personnel) {
        const record = await prisma.personnelAttendance.findFirst({
            where: {
                personnelId: p.id,
                date: {
                    gte: startOfDay,
                    lt: endOfDay
                }
            }
        });

        if (record) {
            console.log(`[FOUND] ${p.fullName}: Status=${record.status}, Hours=${record.hours}`);
        } else {
            console.log(`[MISSING] ${p.fullName}`);
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
