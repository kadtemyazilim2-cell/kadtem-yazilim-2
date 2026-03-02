import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// [NEW] API Route for fetching personnel with attendance data
// Replaces the server action getPersonnelWithAttendance which hangs in Next.js
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const month = searchParams.get('month');
        const siteId = searchParams.get('siteId');

        if (!month) {
            return NextResponse.json({ success: false, error: 'month parameter required' }, { status: 400 });
        }

        const monthDate = new Date(month);
        const startOfMonth = new Date(Date.UTC(monthDate.getFullYear(), monthDate.getMonth(), 1));
        const endOfMonth = new Date(Date.UTC(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999));

        console.log(`[API/personnel/attendance/list] Month: ${month}, Site: ${siteId}, Range: ${startOfMonth.toISOString()} - ${endOfMonth.toISOString()}`);

        const stablePersonnel = await prisma.personnel.findMany({
            where: {
                AND: [
                    // İşten ayrılan ve leftDate bu aydan önce olan veya leftDate olmayan personeli hariç tut
                    {
                        NOT: {
                            AND: [
                                { status: 'LEFT' },
                                {
                                    OR: [
                                        { leftDate: { lt: new Date(monthDate.getFullYear(), monthDate.getMonth(), 1) } },
                                        { leftDate: null }
                                    ]
                                }
                            ]
                        }
                    },
                    {
                        OR: [
                            { status: 'ACTIVE' },
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
                            { siteId },
                            { assignedSites: { some: { id: siteId } } },
                            // Include personnel who have attendance at this site (transferred-out personnel)
                            {
                                attendance: {
                                    some: {
                                        siteId,
                                        date: {
                                            gte: new Date(monthDate.getFullYear(), monthDate.getMonth(), 1),
                                            lte: new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
                                        }
                                    }
                                }
                            }
                        ]
                    } : {}
                ]
            },
            include: {
                attendance: {
                    where: {
                        date: {
                            gte: new Date(Date.UTC(monthDate.getFullYear(), monthDate.getMonth(), 1)),
                            lte: new Date(Date.UTC(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999))
                        }
                    }
                },
                salaryAdjustments: {
                    where: {
                        year: monthDate.getFullYear(),
                        month: monthDate.getMonth() + 1
                    }
                }
            },
            orderBy: { fullName: 'asc' }
        });

        console.log(`[API/personnel/attendance/list] Found ${stablePersonnel.length} personnel`);

        return NextResponse.json({
            success: true,
            data: stablePersonnel,
            queryDebug: {
                receivedMonth: month,
                start: startOfMonth.toISOString(),
                end: endOfMonth.toISOString(),
                siteId: siteId,
                count: stablePersonnel.length
            }
        });
    } catch (error) {
        console.error('[API/personnel/attendance/list] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown Error'
        }, { status: 500 });
    }
}
