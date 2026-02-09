import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({ message: 'API Pong', timestamp: Date.now() }, { status: 200 });
}
