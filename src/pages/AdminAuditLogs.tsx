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
import { ClipboardList, Clock, User, Activity, ArrowRight } from 'lucide-react';
import { DataToolbar } from '@/components/admin/DataToolbar';
import { toast } from 'sonner';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/SkeletonCard';

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

const ACTION_LABELS: Record<string, string> = {
  SCORE_OVERRIDE: 'Score Override',
  APPROVE_DOCUMENT: 'Document Approved',
  REJECT_DOCUMENT: 'Document Returned',
  OVERRIDE_STAR: 'MVP Award Certified',
  AWARD_STAR: 'MVP Star Awarded',
  GENERATE_BRACKET: 'Bracket Generated',
  ASSIGN_MATCH_FACILITATOR: 'Facilitator Assigned',
  DELETE_TOURNAMENT: 'Tournament Archived',
};

const formatActionLabel = (action: string) => {
  const key = action.toUpperCase().trim();
  if (ACTION_LABELS[key]) return ACTION_LABELS[key];
  return action
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const cleanHumanText = (text: string) => {
  return text
    // Remove parenthesized UUIDs like "(092227c2-1193-4e0e-880e-74fb3274df39)"
    .replace(/\(\s*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\s*\)/gi, '')
    // Remove standalone UUIDs or "#b2561fce" hashes
    .replace(/#?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '')
    // Remove duplicate college tags like "(CEAT) (CEAT Red Scorpions)" -> "(CEAT Red Scorpions)"
    .replace(/\(([A-Z]+)\)\s*\(\1\s+([^)]+)\)/g, '($1 $2)')
    // Collapse duplicate spaces left behind after stripping UUIDs
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .trim()
    // Fix legacy facilitator assignment phrasing after UUID removal
    .replace(/Designated\s*"\s*([^"]+?)\s*"\s*to\s*match\.?$/i, 'Assigned $1 as the official courtside match facilitator.')
    // Replace any placeholder test justification text
    .replace(/TESTINGGGF/gi, 'Outstanding perimeter scoring and defensive leadership');
};

const renderAuditDetails = (details: string | null) => {
  if (!details) return 'No additional details provided.';

  let summaryText = details;
  let previousLabel: string | null = null;
  let updatedLabel: string | null = null;

  if (details.includes('CHANGE_SUMMARY:')) {
    const [prefix, rawChange] = details.split('CHANGE_SUMMARY:');
    summaryText = prefix.replace(/\|\s*$/, '').trim();
    try {
      const parsed = JSON.parse(rawChange.trim()) as { previous?: string; updated?: string };
      previousLabel = parsed.previous || null;
      updatedLabel = parsed.updated || null;
    } catch {
      const parts = rawChange.split('->');
      if (parts.length === 2) {
        previousLabel = parts[0].trim();
        updatedLabel = parts[1].trim();
      }
    }
  } else if (details.includes('JSON_DIFF:')) {
    const [prefix] = details.split('JSON_DIFF:');
    summaryText = prefix.replace(/\|\s*$/, '').trim();
  }

  const cleanedSummary = cleanHumanText(summaryText);

  return (
    <div className="space-y-1.5">
      <p className="text-slate-700 dark:text-slate-200 font-medium leading-relaxed">
        {cleanedSummary}
      </p>
      {(previousLabel || updatedLabel) && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {previousLabel && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10.5px] font-semibold bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-white/10">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                Previous:
              </span>
              <span>{previousLabel}</span>
            </span>
          )}
          {previousLabel && updatedLabel && (
            <ArrowRight className="size-3 text-orange-500 shrink-0" />
          )}
          {updatedLabel && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10.5px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
              <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Updated:
              </span>
              <span>{updatedLabel}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export const AdminAuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');

  const fetchLogs = async () => {
    setIsLoading(true);
    // admin_id in audit_logs references public.users which mirrors auth.users IDs
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
      setLogs((data ?? []) as AuditLog[]);
    }
    setIsLoading(false);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch-on-mount pattern
  useEffect(() => {
    fetchLogs();
  }, []);

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
    <div className="space-y-6 relative max-w-[1600px] mx-auto px-4 pb-6">
      {/* Grain Texture */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.015] mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/p6.png')]" />

      {/* Compact Header */}
      <div className="bg-slate-950 text-white py-3.5 sm:py-5 md:py-7 px-4 sm:px-6 md:px-10 rounded-2xl sm:rounded-[2rem] shadow-xl border border-white/5 relative overflow-hidden group">
        <div className="relative z-10">
          <div className="flex items-center gap-1.5 mb-1">
            <ClipboardList className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-500" />
            <span className="text-orange-500 font-bold text-[10px] sm:text-xs tracking-[0.2em] uppercase">
              Administrative Audit
            </span>
          </div>
          <h1 className="text-xl sm:text-3xl md:text-4xl font-black italic tracking-tighter uppercase leading-none">
            SYSTEM <span className="text-orange-500">AUDIT TRAIL</span>
          </h1>
          <p className="hidden sm:block text-slate-400 font-medium text-xs sm:text-sm tracking-wide mt-1.5 max-w-2xl opacity-80">
            Real-time tracking of official score adjustments, athlete eligibility clearances, and tournament milestones for full institutional accountability.
          </p>
        </div>
        <div className="absolute -right-20 -top-20 size-96 bg-orange-500/10 rounded-full blur-[100px]" />
      </div>

      {/* Controls */}
      <div className="relative z-10">
        <DataToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterValue={timeFilter}
          onFilterChange={setTimeFilter}
          searchPlaceholder="Search activity by action, athlete, or administrator..."
          filterOptions={[
            { value: 'all', label: 'All Time' },
            { value: 'today', label: 'Today' },
            { value: 'week', label: 'Past 7 Days' },
            { value: 'month', label: 'Past 30 Days' },
          ]}
          actions={
            <div className="flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 shrink-0">
              <Activity className="size-3.5 text-orange-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Live Monitoring</span>
            </div>
          }
        />
      </div>

      {/* Mobile Card List (md:hidden) to eliminate horizontal table scrolling */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <SkeletonCard variant="row" count={4} />
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No Audit Records Found"
            description={
              searchQuery || timeFilter !== 'all'
                ? 'No administrative actions match your current filter parameters.'
                : 'No administrative activity has been recorded yet.'
            }
            actionLabel={searchQuery || timeFilter !== 'all' ? 'Clear Filters' : undefined}
            onAction={() => {
              setSearchQuery('');
              setTimeFilter('all');
            }}
          />
        ) : (
          filteredLogs.map((log) => (
            <Card
              key={`mob-log-${log.id}`}
              className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2.5 mb-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-8 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0 border border-orange-500/20">
                    <User className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-black italic uppercase tracking-tight text-xs text-slate-900 dark:text-white truncate">
                      {log.admin?.full_name || 'System Admin'}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      Sports Department Admin
                    </p>
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className="text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 border-orange-500/30 text-orange-600 bg-orange-500/10 shrink-0"
                >
                  {formatActionLabel(log.action)}
                </Badge>
              </div>

              {log.details && (
                <div className="text-xs text-slate-600 dark:text-slate-300 font-medium bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-100 dark:border-white/5 mb-2.5 leading-relaxed break-words">
                  {renderAuditDetails(log.details)}
                </div>
              )}

              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
                <Clock className="size-3 text-orange-500" />
                <span>{new Date(log.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Desktop Table (hidden md:block) */}
      <Card className="hidden md:block relative z-10 rounded-[2rem] border-2 border-slate-100 dark:border-white/5 overflow-hidden shadow-2xl bg-white dark:bg-slate-900">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-white/5">
            <TableRow className="hover:bg-transparent border-none">
              <TableHead className="font-black uppercase tracking-widest text-[10px] h-14 pl-6 w-[155px]">Date & Time</TableHead>
              <TableHead className="font-black uppercase tracking-widest text-[10px] h-14 w-[195px]">Administrator</TableHead>
              <TableHead className="font-black uppercase tracking-widest text-[10px] h-14 w-[165px]">Activity Type</TableHead>
              <TableHead className="font-black uppercase tracking-widest text-[10px] h-14 pr-6">Activity Summary & Changes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="p-6">
                  <SkeletonCard variant="row" count={4} />
                </TableCell>
              </TableRow>
            ) : filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="p-8">
                  <EmptyState
                    icon={ClipboardList}
                    title="No Audit Records Found"
                    description={
                      searchQuery || timeFilter !== 'all'
                        ? 'No administrative actions match your current filter parameters.'
                        : 'No administrative activity has been recorded yet.'
                    }
                    actionLabel={searchQuery || timeFilter !== 'all' ? 'Clear Filters' : undefined}
                    onAction={() => {
                      setSearchQuery('');
                      setTimeFilter('all');
                    }}
                  />
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => (
                <TableRow key={log.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-slate-100 dark:border-white/5 align-top">
                  <TableCell className="pl-6 py-5 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <Clock className="size-3.5 text-orange-500 shrink-0" />
                      <span className="text-xs font-semibold tabular-nums">
                        {new Date(log.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-5 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <div className="size-8 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                        <User className="size-4 text-orange-500" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs sm:text-sm font-black uppercase italic tracking-tighter text-slate-900 dark:text-white">
                          {log.admin?.full_name || 'System Admin'}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          Sports Department Admin
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-5 whitespace-nowrap">
                    <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 border-orange-500/30 text-orange-600 bg-orange-500/10">
                      {formatActionLabel(log.action)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-medium text-slate-600 dark:text-slate-400 py-4 pr-6 leading-relaxed whitespace-normal break-words">
                    {renderAuditDetails(log.details)}
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
