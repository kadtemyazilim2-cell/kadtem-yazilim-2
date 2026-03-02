import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Temporary API to fix the 3 personnel who were marked as LEFT on UI but not in DB
// DELETE THIS FILE after use
export async function GET(req: NextRequest) {
    try {
        const fixes = [
            { id: 'cml7rrij300022hqjom5idvd5', name: 'Hamza KAYA', leftDate: '2026-02-28' },
            { id: 'cml7rrso7000k2hqje5u46315', name: 'Bünyamin BEDİR', leftDate: '2026-02-23' },
            { id: 'cml7rrr44000h2hqj77qaez4f', name: 'Salih KAYA', leftDate: '2026-02-24' },
        ];

        const results = [];

        for (const fix of fixes) {
            try {
                const updated = await prisma.personnel.update({
                    where: { id: fix.id },
                    data: {
                        status: 'LEFT',
                        leftDate: new Date(fix.leftDate),
                    }
                });
                results.push({ name: fix.name, status: 'OK', newStatus: updated.status, leftDate: updated.leftDate });
            } catch (err: any) {
                results.push({ name: fix.name, status: 'ERROR', error: err.message });
            }
        }

        return NextResponse.json({ success: true, results });
    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
