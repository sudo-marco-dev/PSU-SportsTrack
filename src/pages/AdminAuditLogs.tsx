import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, Search, Clock, User, Activity, Calendar as CalendarIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

type AuditLog = {
  id: string;
  action: string;
  entity_type: string;
  details: string;
  created_at: string;
  admin: {
    full_name: string;
    email: string;
  } | null;
};

export const AdminAuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setIsLoading(true);
    // Joining with users table to get admin names
    // Note: in audit_logs admin_id references auth.users. 
    // We assume there's a public.users table with the same IDs.
    const { data, error } = await supabase
      .from('audit_logs')
      .select(`
        *,
        admin:admin_id (
          full_name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to fetch audit logs: ' + error.message);
    } else {
      setLogs(data as any);
    }
    setIsLoading(false);
  };

  const filteredLogs = logs.filter(log => {
    // 1. Text Search Filter
    const matchesSearch = 
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.admin?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());

    // 2. Time Filter
    let matchesTime = true;
    if (timeFilter !== 'all') {
      const logDate = new Date(log.created_at);
      const now = new Date();
      
      if (timeFilter === 'today') {
        matchesTime = logDate.toDateString() === now.toDateString();
      } else if (timeFilter === 'week') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 7);
        matchesTime = logDate >= oneWeekAgo;
      } else if (timeFilter === 'month') {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(now.getMonth() - 1);
        matchesTime = logDate >= oneMonthAgo;
      }
    }

    return matchesSearch && matchesTime;
  });

  return (
    <div className="space-y-6 relative min-h-screen max-w-[1600px] mx-auto px-4">
      {/* Grain Texture */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.015] mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/p6.png')]" />

      {/* Header */}
      <div className="bg-slate-950 text-white py-6 md:py-8 px-6 md:px-10 rounded-[2rem] shadow-2xl border border-white/5 relative overflow-hidden group">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList className="w-5 h-5 text-orange-500" />
            <span className="text-orange-500 font-bold text-xs tracking-[0.2em] uppercase">
              Administrative Audit
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-sans font-black tracking-tight uppercase leading-tight">
            SYSTEM <span className="text-orange-500">AUDIT TRAIL</span>
          </h1>
          <p className="text-slate-400 font-sans font-medium text-sm tracking-wide mt-2 max-w-2xl opacity-80">
            Real-time tracking of administrative actions, entity modifications, and security events for full institutional accountability.
          </p>
        </div>
        <div className="absolute -right-20 -top-20 size-96 bg-orange-500/10 rounded-full blur-[100px]" />
      </div>

      {/* Controls */}
      <div className="relative z-10 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input 
            placeholder="Search logs by action or admin..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11 h-12 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/5 rounded-xl font-bold"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <div className="w-full sm:w-48">
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="h-12 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/5 rounded-xl font-bold text-xs">
                <div className="flex items-center gap-2 text-slate-500">
                  <CalendarIcon className="size-4" />
                  <SelectValue placeholder="Filter by Time" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-100 dark:border-white/5">
                <SelectItem value="all" className="font-bold text-xs">All Time</SelectItem>
                <SelectItem value="today" className="font-bold text-xs">Today</SelectItem>
                <SelectItem value="week" className="font-bold text-xs">Past 7 Days</SelectItem>
                <SelectItem value="month" className="font-bold text-xs">Past 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3 bg-slate-100 dark:bg-white/5 px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 shrink-0">
            <Activity className="size-4 text-orange-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Live Monitoring</span>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <Card className="relative z-10 rounded-[2rem] border-2 border-slate-100 dark:border-white/5 overflow-hidden shadow-2xl bg-white dark:bg-slate-900">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-white/5">
            <TableRow className="hover:bg-transparent border-none">
              <TableHead className="font-black uppercase tracking-widest text-[10px] h-14 pl-8 w-[200px]">Timestamp</TableHead>
              <TableHead className="font-black uppercase tracking-widest text-[10px] h-14">Administrator</TableHead>
              <TableHead className="font-black uppercase tracking-widest text-[10px] h-14">Action</TableHead>
              <TableHead className="font-black uppercase tracking-widest text-[10px] h-14">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-64 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-orange-500"></div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Retrieving Audit Records...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-64 text-center">
                  <p className="text-slate-400 font-bold italic">No audit records found.</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => (
                <TableRow key={log.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-slate-100 dark:border-white/5">
                  <TableCell className="pl-8 py-5">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Clock className="size-3" />
                      <span className="text-[11px] font-bold">
                        {new Date(log.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                        <User className="size-4 text-orange-500" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-black uppercase italic tracking-tighter text-slate-900 dark:text-white">
                          {log.admin?.full_name || 'System Admin'}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          System Administrator
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-orange-500/20 text-orange-600 bg-orange-500/5">
                      {log.action.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-medium text-slate-600 dark:text-slate-400 max-w-md truncate">
                    {log.details || 'No additional details provided.'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};
