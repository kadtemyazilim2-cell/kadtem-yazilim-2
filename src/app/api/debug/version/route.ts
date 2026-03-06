import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        version: '2026-03-06-v2',
        deployedAt: new Date().toISOString(),
        features: ['RAINY_STATUS', 'HOLIDAY_STATUS', 'CORRESPONDENCE_FIX']
    });
}
