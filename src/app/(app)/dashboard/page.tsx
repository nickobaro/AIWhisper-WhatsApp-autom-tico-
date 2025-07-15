
'use client';
import { useEffect, useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  CheckCircle,
  Bot,
  MessageSquare,
  AlertTriangle,
  XCircle,
  Loader2,
  ArrowUp,
  ArrowDown,
  Minus,
  TrendingUp,
  PieChart as PieChartIcon,
  AlertOctagon,
} from 'lucide-react';
import type { DashboardData, LogEntry } from '@/types';
import { format, formatDistanceToNow } from 'date-fns';

interface AccountInfo {
  id: string;
  name: string;
}

interface WhatsAppState {
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  account: AccountInfo | null;
  lastDisconnect: { reason: string; date: string } | null;
}

const chartConfig = {
  Sent: {
    label: 'Sent',
    color: 'hsl(var(--chart-1))',
  },
  Received: {
    label: 'Received',
    color: 'hsl(var(--chart-2))',
  },
};

export default function DashboardPage() {
  const [whatsAppState, setWhatsAppState] = useState<WhatsAppState | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);

  const totalErrors = useMemo(() => {
    if (!dashboardData) return 0;
    return dashboardData.errorBreakdown.reduce((acc, curr) => acc + curr.value, 0);
  }, [dashboardData]);


  useEffect(() => {
    const fetchWhatsAppStatus = async () => {
      try {
        const res = await fetch('/api/whatsapp/status');
        const data = await res.json();
        setWhatsAppState(data);
      } catch (error) {
        console.error('Failed to fetch WhatsApp status:', error);
        setWhatsAppState({
          status: 'error',
          account: null,
          lastDisconnect: null,
        });
      }
    };

    const fetchDashboardData = async () => {
      try {
        const res = await fetch('/api/dashboard/stats');
        const data = await res.json();
        setDashboardData(data);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      }
    };

    fetchWhatsAppStatus();
    fetchDashboardData();

    const statusInterval = setInterval(fetchWhatsAppStatus, 5000);
    const dataInterval = setInterval(fetchDashboardData, 15000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(dataInterval);
    };
  }, []);

  const renderStatusBadge = () => {
    if (!whatsAppState) {
      return (
        <Badge className="mt-2 border-yellow-600 bg-yellow-100 text-yellow-700 hover:bg-yellow-200">
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          Checking Status...
        </Badge>
      );
    }
    switch (whatsAppState.status) {
      case 'connected':
        return (
          <Badge className="mt-2 border-green-600 bg-green-100 text-green-700 hover:bg-green-200">
            <CheckCircle className="mr-1 h-3 w-3" />
            Connected
          </Badge>
        );
      case 'connecting':
        return (
          <Badge className="mt-2 border-blue-600 bg-blue-100 text-blue-700 hover:bg-blue-200">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Connecting...
          </Badge>
        );
      case 'disconnected':
        return (
          <Badge variant="destructive" className="mt-2">
            <XCircle className="mr-1 h-3 w-3" />
            Disconnected
          </Badge>
        );
      default:
        return (
          <Badge variant="destructive" className="mt-2">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Error
          </Badge>
        );
    }
  };

  const statCards = dashboardData ? [
    { title: 'Messages Sent', data: dashboardData.stats.sent, icon: MessageSquare },
    { title: 'Messages Received', data: dashboardData.stats.received, icon: MessageSquare },
    { title: 'Active Agents', data: dashboardData.stats.activeAgents, icon: Bot },
    { title: 'Errors', data: dashboardData.stats.errors, icon: AlertTriangle },
  ] : [];

  const ChangeIcon = ({ type }: { type: 'increase' | 'decrease' | 'neutral' }) => {
    if (type === 'increase') return <ArrowUp className="h-4 w-4 text-green-500" />;
    if (type === 'decrease') return <ArrowDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  if (!dashboardData) {
      return (
          <div className="flex h-full min-h-[50vh] items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
      )
  }

  return (
    <div className="space-y-6">
      <h1 className="font-headline text-3xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground">
        An overview of your WhatsApp automation performance and system health.
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.data.value}</div>
              {stat.data.change && (
                <div className="flex items-center text-xs text-muted-foreground">
                  <ChangeIcon type={stat.data.changeType} />
                  <span className="ml-1">{stat.data.change} from last week</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5"/>
                    Message Trends (Last 7 Days)
                </CardTitle>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <LineChart data={dashboardData.messageTrend}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                        <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Line dataKey="Sent" type="monotone" stroke="var(--color-Sent)" strokeWidth={2} dot={true}/>
                        <Line dataKey="Received" type="monotone" stroke="var(--color-Received)" strokeWidth={2} dot={true}/>
                    </LineChart>
                </ChartContainer>
            </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
              <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5"/>
                  Error Breakdown
              </CardTitle>
              <CardDescription>
                  A breakdown of system errors by category.
              </CardDescription>
          </CardHeader>
          <CardContent>
              {dashboardData.errorBreakdown.length > 0 && totalErrors > 0 ? (
                  <div className="flex flex-col items-center gap-6 md:flex-row">
                      <div className="w-full md:w-1/2">
                          <ChartContainer config={{}} className="mx-auto aspect-square h-full max-h-[200px]">
                              <PieChart>
                                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                                  <Pie data={dashboardData.errorBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={80} strokeWidth={2}>
                                  {dashboardData.errorBreakdown.map((entry) => (
                                          <Cell key={`cell-${entry.name}`} fill={entry.fill} className="stroke-background hover:opacity-80"/>
                                      ))}
                                  </Pie>
                                  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-2xl font-bold">
                                      {totalErrors.toLocaleString()}
                                  </text>
                                  <text x="50%" y="50%" dy="1.5em" textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-sm">
                                      Errors
                                  </text>
                              </PieChart>
                          </ChartContainer>
                      </div>
                      <div className="flex w-full flex-col gap-3 text-sm md:w-1/2">
                          {dashboardData.errorBreakdown
                              .sort((a,b) => b.value - a.value)
                              .map(error => (
                              <div key={error.name} className="flex items-center">
                                  <div className="flex items-center gap-2">
                                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: error.fill }} />
                                      <span className="truncate">{error.name}</span>
                                  </div>
                                  <div className="ml-auto text-right">
                                      <div className="font-semibold">{error.value}</div>
                                      <div className="text-xs text-muted-foreground">{`${((error.value / totalErrors) * 100).toFixed(0)}%`}</div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              ) : (
                  <div className="flex h-[250px] flex-col items-center justify-center space-y-2 text-center text-sm text-muted-foreground">
                       <CheckCircle className="h-10 w-10 text-green-500" />
                        <div>
                            <p className="font-semibold">No Errors!</p>
                            <p>Everything is running smoothly.</p>
                        </div>
                  </div>
              )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><AlertOctagon className="h-5 w-5 text-destructive"/> Recent Errors</CardTitle>
                <CardDescription>A log of the 5 most recent system errors.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Action</TableHead>
                            <TableHead className="hidden sm:table-cell">Details</TableHead>
                            <TableHead className="text-right">Time</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {dashboardData.recentErrors.length > 0 ? dashboardData.recentErrors.map((log: LogEntry) => (
                            <TableRow key={log.id}>
                                <TableCell className="font-medium">{log.action}</TableCell>
                                <TableCell className="hidden truncate text-muted-foreground sm:table-cell">{log.details}</TableCell>
                                <TableCell className="text-right text-muted-foreground">{formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}</TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center">No errors logged recently. Great job!</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Connection Status</CardTitle>
            <CardDescription>
              Your authenticated WhatsApp account details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
              <Avatar className="h-16 w-16">
                <AvatarImage
                  src={`https://ui-avatars.com/api/?name=${whatsAppState?.account?.name || '?'}&background=3F51B5&color=fff`}
                  alt={whatsAppState?.account?.name || ''}
                />
                <AvatarFallback>
                  {whatsAppState?.account ? whatsAppState.account.name.charAt(0) : '?'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xl font-semibold">
                  {whatsAppState?.account?.name || 'Not Connected'}
                </p>
                <p className="text-muted-foreground">
                  {whatsAppState?.account?.id.split(':')[0] || '---'}
                </p>
                {renderStatusBadge()}
              </div>
            </div>
            {whatsAppState?.lastDisconnect && (
                <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                    <p><strong>Last Disconnection:</strong> {format(new Date(whatsAppState.lastDisconnect.date), 'PPp')}</p>
                    <p className="truncate"><strong>Reason:</strong> {whatsAppState.lastDisconnect.reason}</p>
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
