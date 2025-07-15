
import { NextResponse } from 'next/server';
import { sendMessage } from '@/lib/whatsapp-client';

export async function POST(request: Request) {
  try {
    const { to, text } = await request.json();
    if (!to || !text) {
      return NextResponse.json({ success: false, message: 'Missing "to" or "text" field' }, { status: 400 });
    }
    const result = await sendMessage(to, text);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Failed to send message", error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to send message' }, { status: 500 });
  }
}
