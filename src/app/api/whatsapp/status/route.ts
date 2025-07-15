import { NextResponse } from 'next/server';
import { getClientState } from '@/lib/whatsapp-client';

export const dynamic = 'force-dynamic';

export async function GET() {
    const state = getClientState();
    return NextResponse.json(state);
}
