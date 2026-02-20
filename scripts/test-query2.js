const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
    const siteId = 'cmkmop5q5000fhgexroggue2m'; // Aydın Nazilli
    const md = new Date('2026-02-01');

    const dc = await p.personnel.count({ where: { siteId, status: 'ACTIVE' } });
    console.log('Direct assigned + ACTIVE:', dc);

    const allAt = await p.personnel.count({ where: { siteId } });
    console.log('Direct assigned (any status):', allAt);

    const r = await p.personnel.findMany({
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
        select: { id: true, fullName: true, siteId: true, status: true }
    });
    console.log('Full query result:', r.length);
    r.slice(0, 10).forEach(x => console.log(' ', x.fullName, '|', x.status, '|', x.siteId));

    await p.$disconnect();
})();
