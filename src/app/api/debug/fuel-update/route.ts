import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        console.log('[API DEBUG] Fuel Update Request Received');

        // Simulate work
        await new Promise(resolve => setTimeout(resolve, 1000));

        return NextResponse.json({
            success: true,
            message: 'API Mode Success',
            data: {
                id: 'mock-id',
                updatedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('[API DEBUG] Error:', error);
        return NextResponse.json({ success: false, error: 'API Error' }, { status: 500 });
    }
}
