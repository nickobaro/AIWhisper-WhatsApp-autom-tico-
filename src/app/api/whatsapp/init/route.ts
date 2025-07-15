import { NextResponse } from 'next/server';
import { init } from '@/lib/whatsapp-client';

export async function POST() {
    try {
        await init();
        return NextResponse.json({ success: true, message: 'WhatsApp client initialization started.' });
    } catch (error) {
        console.error("Failed to init whatsapp client", error);
        return NextResponse.json({ success: false, message: 'Failed to initialize WhatsApp client.' }, { status: 500 });
    }
}
