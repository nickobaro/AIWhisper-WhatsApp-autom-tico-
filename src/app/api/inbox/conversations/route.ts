
import { NextResponse } from 'next/server';
import { getConversations } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const conversations = await getConversations();
    return NextResponse.json(conversations);
  } catch (error) {
    console.error('Failed to fetch conversations:', error);
    return NextResponse.json({ message: 'Failed to fetch conversations' }, { status: 500 });
  }
}
