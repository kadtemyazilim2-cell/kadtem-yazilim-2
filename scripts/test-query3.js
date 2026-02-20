const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
    const siteId = 'cmkmop5q5000fhgexroggue2m'; // Aydın Nazilli
    const md = new Date('2026-02-01');

    console.time('Query');
    const result = await p.personnel.findMany({
        where: {
            AND: [
                {
                    OR: [
                        { status: 'ACTIVE' },
                        { leftDate: { gte: new Date(md.getFullYear(), md.getMonth(), 1) } },
                        { attendance: { some: { date: { gte: new Date(md.getFullYear(), md.getMonth(), 1), lte: new Date(md.getFullYear(), md.getMonth() + 1, 0) } } } }
                    ]
                },
                {
                    OR: [
                        { siteId },
                        { assignedSites: { some: { id: siteId } } },
                        { attendance: { some: { siteId, date: { gte: new Date(md.getFullYear(), md.getMonth(), 1), lte: new Date(md.getFullYear(), md.getMonth() + 1, 0) } } } }
                    ]
                }
            ]
        },
        include: {
            attendance: {
                where: {
                    date: {
                        gte: new Date(Date.UTC(md.getFullYear(), md.getMonth(), 1)),
                        lte: new Date(Date.UTC(md.getFullYear(), md.getMonth() + 1, 0, 23, 59, 59, 999))
                    }
                }
            },
            salaryAdjustments: {
                where: {
                    year: md.getFullYear(),
                    month: md.getMonth() + 1
                }
            }
        },
        orderBy: { fullName: 'asc' }
    });
    console.timeEnd('Query');

    console.log('Count:', result.length);

    // Check data size
    const jsonStr = JSON.stringify(result);
    console.log('JSON size:', (jsonStr.length / 1024).toFixed(1), 'KB');

    // Check for problematic fields
    let totalAttendance = 0;
    result.forEach(r => {
        totalAttendance += r.attendance.length;
        if (r.salaryHistory && typeof r.salaryHistory !== 'string') {
            try {
                JSON.stringify(r.salaryHistory);
            } catch (e) {
                console.error('salaryHistory serialization error for', r.fullName, e.message);
            }
        }
    });
    console.log('Total attendance records:', totalAttendance);

    // Show sample
    const sample = result[0];
    if (sample) {
        console.log('\nSample:', sample.fullName);
        console.log('  attendance:', sample.attendance.length);
        console.log('  salaryHistory type:', typeof sample.salaryHistory);
        console.log('  salaryHistory:', JSON.stringify(sample.salaryHistory)?.substring(0, 200));
    }

    await p.$disconnect();
})();
