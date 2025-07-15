import { NextResponse } from 'next/server';
import { getLogs, getStats, getAgents, getMessages } from '@/lib/db';
import type {
  DashboardData,
  TimeSeriesDataPoint,
  ErrorBreakdownPoint,
  LogEntry,
} from '@/types';
import { subDays, format, startOfDay } from 'date-fns';

export const dynamic = 'force-dynamic';

function categorizeError(log: LogEntry): string {
  const action = log.action.toLowerCase();
  const details = log.details.toLowerCase();

  if (action.includes('disconnected') || details.includes('auth')) return 'Connection';
  if (action.includes('send') || details.includes('delivery')) return 'Delivery';
  if (action.includes('agent')) return 'Agent Logic';
  if (action.includes('document') || action.includes('upload') || action.includes('parse')) return 'System';
  
  return 'Other';
}

export async function GET() {
  try {
    const [stats, logs, agents, messages] = await Promise.all([
        getStats(),
        getLogs(),
        getAgents(),
        getMessages()
    ]);
    
    // --- Time Series Data ---
    const today = startOfDay(new Date());
    const timeSeriesData: TimeSeriesDataPoint[] = [];

    for (let i = 6; i >= 0; i--) {
        const date = subDays(today, i);
        const dateKey = format(date, 'yyyy-MM-dd');
        
        const sentOnDay = messages.filter(m => m.fromMe && format(new Date(m.timestamp), 'yyyy-MM-dd') === dateKey).length;
        const receivedOnDay = messages.filter(m => !m.fromMe && format(new Date(m.timestamp), 'yyyy-MM-dd') === dateKey).length;
        
        timeSeriesData.push({
            date: format(date, 'MMM d'),
            Sent: sentOnDay,
            Received: receivedOnDay,
        });
    }

    // --- Error Breakdown ---
    const recentErrors = logs.filter((l) => l.type === 'error');
    const errorBreakdownMap = recentErrors.reduce((acc, log) => {
      const category = categorizeError(log);
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const errorBreakdown: ErrorBreakdownPoint[] = Object.entries(
      errorBreakdownMap
    ).map(([name, value], index) => ({
      name,
      value,
      fill: `var(--chart-${(index % 5) + 1})`,
    }));
    
    // NOTE: Change data is not implemented as there's no historical data to compare.
    const neutralChange = {
        change: '', // Empty string to hide the change text
        changeType: 'neutral' as 'neutral',
    };

    const dashboardData: DashboardData = {
      stats: {
        sent: { value: stats.sent, ...neutralChange },
        received: { value: stats.received, ...neutralChange },
        activeAgents: {
          value: agents.length,
          ...neutralChange,
        },
        errors: { value: stats.errors, ...neutralChange },
      },
      messageTrend: timeSeriesData,
      errorBreakdown: errorBreakdown,
      recentErrors: recentErrors.slice(0, 5),
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error('Failed to fetch dashboard data:', error);
    return NextResponse.json(
      { message: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
