import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// API Route for marking a personnel as LEFT (İşten Ayrıldı)
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { personnelId, leftDate } = body;

        if (!personnelId) {
            return NextResponse.json({ success: false, error: 'personnelId is required' }, { status: 400 });
        }

        const dateValue = leftDate ? new Date(leftDate) : new Date();

        const updated = await prisma.personnel.update({
            where: { id: personnelId },
            data: {
                status: 'LEFT',
                leftDate: dateValue,
            }
        });

        console.log(`[API/personnel/mark-left] Personel LEFT olarak güncellendi: ${updated.fullName} (${personnelId}), leftDate: ${dateValue.toISOString()}`);

        return NextResponse.json({
            success: true,
            data: {
                id: updated.id,
                fullName: updated.fullName,
                status: updated.status,
                leftDate: updated.leftDate
            }
        });
    } catch (error) {
        console.error('[API/personnel/mark-left] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown Error'
        }, { status: 500 });
    }
}
