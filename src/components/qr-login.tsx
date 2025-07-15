
'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type Status = 'connecting' | 'connected' | 'disconnected' | 'error';

export default function QRLogin() {
  const router = useRouter();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('connecting');
  const [message, setMessage] = useState('Initializing...');
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling(); // Ensure no multiple pollers are running
    
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/whatsapp/status', { cache: 'no-store' });
        if (!res.ok) throw new Error('Status check failed');
        const data = await res.json();
        
        setStatus(data.status);

        if (data.status === 'connected') {
          setMessage('Successfully connected! Redirecting...');
          stopPolling();
          setTimeout(() => router.push('/dashboard'), 1000);
        } else if (data.status === 'connecting') {
          if (data.qr) {
            setQrCode(data.qr);
            setMessage('Scan this QR code with the WhatsApp mobile app.');
          } else {
            setQrCode(null);
            setMessage('Generating QR code, please wait...');
          }
        } else { // disconnected or error
          setQrCode(null);
          setMessage(data.lastDisconnect?.reason || 'Connection failed. Please try again.');
          stopPolling();
        }

      } catch (error) {
        console.error('Failed to fetch WhatsApp status:', error);
        setStatus('error');
        setMessage('An error occurred while checking status.');
        stopPolling();
      }
    }, 2000);
  }, [stopPolling, router]);


  // Function for the "Try Again" button or initial load
  const startFreshConnection = useCallback(async () => {
    stopPolling();
    setStatus('connecting');
    setMessage('Requesting a new QR code...');
    setQrCode(null);

    try {
      // Force a full cleanup on the server before starting a new session.
      await fetch('/api/whatsapp/logout', { method: 'POST' });
      // Now initialize a brand new session.
      await fetch('/api/whatsapp/init', { method: 'POST' });
      // Start polling to get the QR code and subsequent statuses.
      startPolling();
    } catch (e) {
        setStatus('error');
        setMessage('Failed to contact server. Please check your internet connection.');
        stopPolling();
    }
  }, [startPolling, stopPolling]);

  // Initial effect to start the process
  useEffect(() => {
    startFreshConnection();
    return () => {
      stopPolling();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only on mount

  const showLoading = status === 'connecting' && !qrCode;
  const showQR = status === 'connecting' && qrCode;
  const showError = status === 'disconnected' || status === 'error';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mb-8 text-center">
        <h1 className="font-headline text-5xl font-bold text-primary">
          SocketScribe
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Your AI-Powered WhatsApp Hub
        </p>
      </div>
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-2xl">
            Link your WhatsApp
          </CardTitle>
          <CardDescription className="min-h-[40px] flex items-center justify-center px-4">
              {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
            <div className="relative flex h-64 w-64 items-center justify-center rounded-lg bg-white p-4">
              {showLoading && <Loader2 className="h-12 w-12 animate-spin text-primary" />}
              {showQR && (
                <Image
                  src={qrCode!}
                  alt="WhatsApp QR Code"
                  width={256}
                  height={256}
                  priority
                />
              )}
              {showError && (
                  <div className="flex flex-col items-center text-center text-destructive">
                      <AlertCircle className="h-12 w-12" />
                      <p className="mt-4 font-semibold">Connection Failed</p>
                  </div>
              )}
            </div>
          {showError && (
            <Alert variant="destructive" className="w-full">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error Details</AlertTitle>
              <AlertDescription className="break-words">
                {message}
              </AlertDescription>
              <Button onClick={startFreshConnection} className="mt-4 w-full">
                Try Again
              </Button>
            </Alert>
          )}
        </CardContent>
      </Card>
      <p className="mt-8 max-w-sm text-center text-sm text-muted-foreground">
        Open WhatsApp on your phone, go to Settings &gt; Linked Devices, and scan the code.
      </p>
    </div>
  );
}
