import { NextResponse } from 'next/server';
import { logout } from '@/lib/whatsapp-client';

export async function POST() {
    try {
        await logout();
        return NextResponse.json({ success: true, message: 'Logged out successfully.' });
    } catch (error) {
        console.error("Failed to logout whatsapp client", error);
        return NextResponse.json({ success: false, message: 'Logout failed.' }, { status: 500 });
    }
}
