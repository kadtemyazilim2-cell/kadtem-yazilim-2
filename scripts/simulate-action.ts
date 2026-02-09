
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getPersonnelWithAttendance(month: Date | string, siteId?: string) {
    try {
        const monthDate = new Date(month);
        // Replicating logic from src/actions/personnel.ts lines 93-94
        const startOfMonth = new Date(Date.UTC(monthDate.getFullYear(), monthDate.getMonth(), 1));
        const endOfMonth = new Date(Date.UTC(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999));

        console.log(`[SIMULATION] Input Month: ${month}`);
        console.log(`[SIMULATION] monthDate: ${monthDate.toISOString()}`);
        console.log(`[SIMULATION] Queries: ${startOfMonth.toISOString()} - ${endOfMonth.toISOString()}`);

        const stablePersonnel = await prisma.personnel.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            { status: 'ACTIVE' },
                            // Replicating lines 104
                            { leftDate: { gte: new Date(monthDate.getFullYear(), monthDate.getMonth(), 1) } },
                            {
                                attendance: {
                                    some: {
                                        date: {
                                            gte: new Date(monthDate.getFullYear(), monthDate.getMonth(), 1),
                                            lte: new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
                                        }
                                    }
                                }
                            }
                        ]
                    },
                    (siteId && siteId !== 'all') ? {
                        OR: [
                            { siteId: siteId },
                            { assignedSites: { some: { id: siteId } } }
                        ]
                    } : {}
                ]
            },
            // Omitted include/orderBy for brevity as we just want count
        });

        console.log(`[SIMULATION] Found Count: ${stablePersonnel.length}`);
        return { success: true, data: stablePersonnel };
    } catch (error) {
        console.error('getPersonnelWithAttendance Error:', error);
        return { success: false, error: 'Veri alınamadı.' };
    }
}

async function main() {
    const siteId = 'cmkmop5q5000fhgexroggue2m';
    const dateStr = '2026-02-01'; // Simulated input from client

    await getPersonnelWithAttendance(dateStr, siteId);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
