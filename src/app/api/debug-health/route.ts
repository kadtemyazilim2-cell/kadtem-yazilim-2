import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({ status: 'ok', message: 'API Route is working!', time: new Date().toISOString() });
}
