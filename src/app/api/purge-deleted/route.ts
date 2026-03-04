import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

// TEMPORARY: One-time purge of all DELETED correspondences
// Remove this file after running once!
export async function GET(request: Request) {
    // Simple auth check via query parameter
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (key !== 'purge-deleted-2026') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const count = await prisma.correspondence.count({
            where: { status: 'DELETED' }
        });

        if (count === 0) {
            return NextResponse.json({ message: 'No deleted correspondences found.', count: 0 });
        }

        const result = await prisma.correspondence.deleteMany({
            where: { status: 'DELETED' }
        });

        return NextResponse.json({
            message: `Permanently deleted ${result.count} correspondences.`,
            count: result.count
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
