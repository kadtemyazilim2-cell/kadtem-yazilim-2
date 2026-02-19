import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { auth as getSession } from '@/auth';
import { revalidateTag } from 'next/cache';

export async function POST(request: Request) {
    try {
        const data = await request.json();

        console.log('[API] vehicle-attendance/save called with:', JSON.stringify(data));

        const session = await getSession();
        let finalUserId = session?.user?.id;
        if (data.createdByUserId) finalUserId = data.createdByUserId;

        if (!data.vehicleId || !data.date) {
            return NextResponse.json({ success: false, error: 'Eksik veri: Araç veya Tarih yok.' }, { status: 400 });
        }

        const inputDate = new Date(data.date);

        // Day range for smart search
        const startOfDay = new Date(inputDate);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(inputDate);
        endOfDay.setUTCHours(23, 59, 59, 999);

        // Standardize to noon UTC
        const targetDateNoon = new Date(inputDate);
        targetDateNoon.setUTCHours(12, 0, 0, 0);

        // Check for existing record
        const existingRecord = await prisma.vehicleAttendance.findFirst({
            where: {
                vehicleId: data.vehicleId,
                date: { gte: startOfDay, lte: endOfDay }
            }
        });

        let result;
        if (existingRecord) {
            // [FIX] If not explicitly updating, prevent overwrite
            if (!data.forceUpdate) {
                return NextResponse.json({
                    success: false,
                    error: 'Bu araç için bu tarihte zaten bir puantaj kaydı mevcut. Mevcut kaydı değiştirmek istiyorsanız üzerine tıklayarak düzenleyebilirsiniz.'
                }, { status: 409 });
            }
            result = await prisma.vehicleAttendance.update({
                where: { id: existingRecord.id },
                data: {
                    date: targetDateNoon,
                    status: data.status,
                    siteId: data.siteId,
                    hours: parseFloat(data.hours?.toString() || '0'),
                    note: data.note,
                    createdByUserId: finalUserId,
                }
            });
            console.log('[API] Updated:', result.id);
        } else {
            result = await prisma.vehicleAttendance.create({
                data: {
                    vehicleId: data.vehicleId,
                    siteId: data.siteId,
                    date: targetDateNoon,
                    status: data.status || 'WORK',
                    hours: parseFloat(data.hours?.toString() || '0'),
                    note: data.note,
                    createdByUserId: finalUserId,
                }
            });
            console.log('[API] Created:', result.id);
        }

        const plainResult = {
            id: result.id,
            vehicleId: result.vehicleId,
            siteId: result.siteId || '',
            date: result.date.toISOString(),
            status: result.status,
            hours: Number(result.hours),
            note: result.note || null,
            createdByUserId: result.createdByUserId || null,
        };

        console.log('[API] Returning:', JSON.stringify(plainResult));
        // [FIX] Cache invalidation — without this, page refresh shows stale cached data
        revalidateTag('vehicle-attendance');
        return NextResponse.json({ success: true, data: plainResult });

    } catch (error: any) {
        console.error('[API] Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
