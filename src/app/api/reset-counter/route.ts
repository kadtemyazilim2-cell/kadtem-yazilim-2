import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

// TEMPORARY: Reset document number counters for all companies
// Remove this file after running once!
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (key !== 'reset-counter-2026') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Get current state
        const companies = await prisma.company.findMany({
            select: { id: true, name: true, currentDocumentNumber: true }
        });

        const before = companies.map(c => ({ name: c.name, currentNumber: c.currentDocumentNumber }));

        // Reset all to 1
        const result = await prisma.company.updateMany({
            data: { currentDocumentNumber: 1 }
        });

        return NextResponse.json({
            message: `Reset ${result.count} companies to document number 1.`,
            before,
            count: result.count
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
