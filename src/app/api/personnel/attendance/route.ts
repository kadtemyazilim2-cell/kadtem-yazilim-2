import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';

// [NEW] API Route for Attendance Upsert
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { personnelId, date, data } = body;

        console.log(`[API] Upsert Request: ${personnelId}, ${date}`);

        if (!personnelId || !date || !data) {
            return NextResponse.json({ success: false, error: 'Eksik parametreler.' }, { status: 400 });
        }


        // [SECURE] Auth Check
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: 'Oturum bulunamadı.' }, { status: 401 });
        }

        const dbUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true, status: true, editLookbackDays: true }
        });

        if (!dbUser || dbUser.status !== 'ACTIVE') {
            return NextResponse.json({ success: false, error: 'Hesabınız aktif değil.' }, { status: 403 });
        }

        // [FIX] Valid SiteId Check
        let targetSiteId = data.siteId;
        if (!targetSiteId || targetSiteId.trim() === '') {
            const person = await prisma.personnel.findUnique({
                where: { id: personnelId },
                select: { siteId: true, assignedSites: { take: 1, select: { id: true } } }
            });

            if (person) {
                if (person.siteId) {
                    targetSiteId = person.siteId;
                } else if (person.assignedSites.length > 0) {
                    targetSiteId = person.assignedSites[0].id;
                }
            }
        }

        if (!targetSiteId) {
            return NextResponse.json({ success: false, error: 'Puantaj girişi için personelin bir şantiyesi olmalıdır.' }, { status: 400 });
        }

        // Date Normalization (UTC Midnight)
        const [y, m, d] = date.split('-').map(Number);
        const dateObj = new Date(Date.UTC(y, m - 1, d));
        const startOfDay = new Date(Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate()));
        const endOfDay = new Date(startOfDay);
        endOfDay.setDate(endOfDay.getDate() + 1);

        // Permission Check (Date Limit)
        if (dbUser.role !== 'ADMIN') {
            const limit = dbUser.editLookbackDays ?? 3;
            const today = new Date();
            today.setHours(12, 0, 0, 0); // Normalize today
            const target = new Date(startOfDay);
            target.setHours(12, 0, 0, 0); // Normalize target

            const diffTime = today.getTime() - target.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Allow future edits (negative diff) or within limit
            if (diffDays > limit) {
                return NextResponse.json({ success: false, error: `Geriye dönük en fazla ${limit} gün işlem yapabilirsiniz.` }, { status: 403 });
            }
        }

        // Manual Upsert to avoid "Invalid invocation" due to missing @@unique constraint
        let result;
        const existing = await prisma.personnelAttendance.findFirst({
            where: {
                personnelId,
                date: {
                    gte: startOfDay,
                    lt: endOfDay
                }
            }
        });

        if (existing) {
            result = await prisma.personnelAttendance.update({
                where: { id: existing.id },
                data: {
                    status: data.status,
                    hours: data.hours,
                    overtime: data.overtime,
                    note: data.note,
                    siteId: targetSiteId,
                    createdByUserId: session.user.id
                }
            });
        } else {
            result = await prisma.personnelAttendance.create({
                data: {
                    personnelId: personnelId,
                    date: startOfDay,
                    status: data.status,
                    hours: data.hours,
                    overtime: data.overtime,
                    note: data.note,
                    siteId: targetSiteId,
                    createdByUserId: session.user.id
                }
            });
        }

        // Trigger Revalidation
        revalidatePath('/dashboard/new-tab');

        return NextResponse.json({ success: true, recordId: result.id, date: result.date.toISOString() });

    } catch (error: any) {
        console.error('[API] Upsert Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
