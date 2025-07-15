
import { NextResponse } from 'next/server';
import { getLogs } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const logs = await getLogs();
    return NextResponse.json(logs);
  } catch (error) {
    console.error('Failed to fetch logs:', error);
    return NextResponse.json({ message: 'Failed to fetch logs' }, { status: 500 });
  }
}
