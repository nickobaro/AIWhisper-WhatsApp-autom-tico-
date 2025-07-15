
'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Bot, FileText, Trash2, Loader2, List } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { LogEntry } from '@/types';
import { useToast } from '@/hooks/use-toast';

export default function ActivityFeed() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch('/api/logs');
        if (!res.ok) throw new Error('Failed to fetch activity logs.');
        const data = await res.json();
        setLogs(data);
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
    
    const interval = setInterval(fetchLogs, 10000); // Poll for new logs
    return () => clearInterval(interval);
  }, [toast]);

  const getIcon = (action: string) => {
    if (action.includes('Agent')) return <Bot className="h-5 w-5" />;
    if (action.includes('Uploaded')) return <FileText className="h-5 w-5" />;
    if (action.includes('Deleted')) return <Trash2 className="h-5 w-5 text-destructive" />;
    return <List className="h-5 w-5" />;
  };

  const getBadgeVariant = (type: LogEntry['type']) => {
      switch(type) {
          case 'success': return 'default';
          case 'error': return 'destructive';
          case 'warning': return 'outline';
          case 'info': return 'secondary';
          default: return 'secondary';
      }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-center text-muted-foreground">No recent activity.</p>
        ) : (
          <div className="space-y-6">
            {logs.map(log => (
              <div key={log.id} className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    {getIcon(log.action)}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{log.action}</p>
                  <p className="text-sm text-muted-foreground">{log.details}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>by {log.user}</span>
                    <span>&bull;</span>
                    <span>{formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}</span>
                    <Badge variant={getBadgeVariant(log.type)} className="ml-auto capitalize">{log.type}</Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
