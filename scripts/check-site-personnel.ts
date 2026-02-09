
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const siteId = 'cmkmop5q5000fhgexroggue2m';

    // Simulating Feb 2026
    const monthDate = new Date(2026, 1, 1); // 0-indexed month, so 1 is Feb
    const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const endOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

    console.log(`Checking personnel for site: ${siteId}`);
    console.log(`Date Range: ${startOfMonth.toISOString()} - ${endOfMonth.toISOString()}`);

    try {
        // Check Status Only
        const all = await prisma.personnel.findMany({
            where: {
                OR: [
                    { siteId },
                    { assignedSites: { some: { id: siteId } } }
                ]
            },
            select: { id: true, fullName: true, status: true, leftDate: true }
        });
        console.log(`Total Linked Personnel (Without Filters): ${all.length}`);
        all.forEach(p => console.log(`- ${p.fullName} [${p.status}] (Left: ${p.leftDate})`));

        // Check with Action Logic
        const filtered = await prisma.personnel.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            { status: 'ACTIVE' },
                            { leftDate: { gte: startOfMonth } },
                            {
                                attendance: {
                                    some: {
                                        date: {
                                            gte: startOfMonth,
                                            lte: endOfMonth
                                        }
                                    }
                                }
                            }
                        ]
                    },
                    {
                        OR: [
                            { siteId },
                            { assignedSites: { some: { id: siteId } } }
                        ]
                    }
                ]
            },
            select: { id: true, fullName: true, status: true }
        });

        console.log('--- Combined Logic Result (With Action Filters) ---');
        console.log(`Total Found: ${filtered.length}`);
        filtered.forEach(p => {
            console.log(`- ${p.fullName}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
