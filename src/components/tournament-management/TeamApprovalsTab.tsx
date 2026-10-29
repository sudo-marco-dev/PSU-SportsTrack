import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, CheckCircle2, XCircle } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import type { PendingTeam } from './types';

interface TeamApprovalsTabProps {
  teams: PendingTeam[];
  isLoading: boolean;
  viewMode: 'grid' | 'list';
  onApprove: (teamId: string) => void;
  onReject: (teamId: string) => void;
  onClearSearch: () => void;
}

export const TeamApprovalsTab: React.FC<TeamApprovalsTabProps> = ({
  teams,
  isLoading,
  viewMode,
  onApprove,
  onReject,
  onClearSearch,
}) => {
  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <SkeletonCard count={3} />
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No pending squad applications"
        description="All submitted team rosters and coach applications have been processed or none match the active filters."
        actionLabel="Clear Filter Criteria"
        onAction={onClearSearch}
      />
    );
  }

  if (viewMode === 'list') {
    return (
      <div className="space-y-3">
        {/* Mobile View: Dedicated cards (md:hidden) to avoid horizontal table scrolling */}
        <div className="md:hidden space-y-3">
          {teams.map((team) => (
            <Card
              key={`mob-approval-${team.id}`}
              className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3 mb-2.5">
                <div className="min-w-0">
                  <h3 className="font-black italic uppercase tracking-tight text-base text-slate-900 dark:text-white truncate">
                    {team.name}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    ID: {team.id.slice(0, 8)}
                  </p>
                </div>
                <Badge variant="outline" className="text-[9px] font-bold uppercase shrink-0 border-orange-500/30 text-orange-600 bg-orange-500/10">
                  {Array.isArray(team.tournaments) ? team.tournaments[0]?.name : team.tournaments?.name || 'N/A'}
                </Badge>
              </div>

              <div className="flex items-center gap-2.5 py-2 px-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 mb-3">
                <div className="size-7 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center text-[10px] font-black shrink-0">
                  {((Array.isArray(team.users) ? team.users[0]?.full_name : team.users?.full_name) || 'NA')[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Coach</p>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    {Array.isArray(team.users) ? team.users[0]?.full_name : team.users?.full_name || 'N/A'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase italic tracking-wider text-[10px] rounded-xl shadow-sm gap-1 cursor-pointer"
                  onClick={() => onApprove(team.id)}
                >
                  <CheckCircle2 className="size-3.5" /> Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 font-black uppercase italic tracking-wider text-[10px] rounded-xl text-red-500 border-red-500/30 hover:bg-red-500/10 gap-1 cursor-pointer"
                  onClick={() => onReject(team.id)}
                >
                  <XCircle className="size-3.5" /> Reject
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Desktop View: Preserved Table (hidden md:block) */}
        <Card className="hidden md:block rounded-[2.5rem] border-2 border-slate-100 dark:border-white/5 overflow-hidden shadow-2xl bg-white dark:bg-slate-900">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-white/5">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="font-black uppercase tracking-widest text-[10px] h-16 pl-10">Team Identity</TableHead>
                <TableHead className="font-black uppercase tracking-widest text-[10px] h-16">Lead Coach</TableHead>
                <TableHead className="font-black uppercase tracking-widest text-[10px] h-16">Target Event</TableHead>
                <TableHead className="font-black uppercase tracking-widest text-[10px] h-16 text-right pr-10">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((team, idx) => (
                <TableRow 
                  key={team.id} 
                  className="hover:bg-orange-50/30 dark:hover:bg-orange-500/5 transition-colors border-slate-100 dark:border-white/5 group animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <TableCell className="pl-10 py-6">
                    <div className="flex flex-col">
                      <span className="font-black italic uppercase tracking-tighter text-xl group-hover:text-orange-500 transition-colors">{team.name}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: {team.id.slice(0, 8)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-[10px] font-black text-slate-500 uppercase">
                        {((Array.isArray(team.users) ? team.users[0]?.full_name : team.users?.full_name) || 'NA')[0]}
                      </div>
                      <span className="font-bold text-sm text-slate-700 dark:text-slate-300">
                        {Array.isArray(team.users) ? team.users[0]?.full_name : team.users?.full_name || 'N/A'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-bold text-[10px] uppercase tracking-tighter border-slate-200 dark:border-white/10 px-3 py-1 bg-white dark:bg-slate-950">
                      {Array.isArray(team.tournaments) ? team.tournaments[0]?.name : team.tournaments?.name || 'N/A'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right pr-10">
                    <div className="flex justify-end gap-3">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-10 px-4 rounded-xl font-black uppercase tracking-widest text-[10px] text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-500/10 cursor-pointer"
                        onClick={() => onApprove(team.id)}
                      >
                        <CheckCircle2 className="size-4 mr-2" /> Approve
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-10 px-4 rounded-xl font-black uppercase tracking-widest text-[10px] text-destructive hover:bg-destructive/10 cursor-pointer"
                        onClick={() => onReject(team.id)}
                      >
                        <XCircle className="size-4 mr-2" /> Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {teams.map((team, idx) => (
        <Card key={team.id} className="group hover:border-orange-500/50 transition-all duration-300 shadow-sm hover:shadow-xl rounded-2xl md:rounded-3xl overflow-hidden border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900 animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${idx * 50}ms` }}>
          <CardHeader className="p-5 pb-3">
            <div className="flex justify-between items-start mb-3">
              <div className="size-10 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center">
                <Users className="size-5 text-orange-500" />
              </div>
              <Badge className="bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest py-0.5 px-2.5 rounded-full border-none shadow-none">
                Pending
              </Badge>
            </div>
            <CardTitle className="text-xl font-black italic uppercase tracking-tighter group-hover:text-orange-500 transition-colors">{team.name}</CardTitle>
            <CardDescription className="font-bold text-slate-500 uppercase text-[10px] tracking-widest mt-0.5">
              {Array.isArray(team.tournaments) ? team.tournaments[0]?.name : team.tournaments?.name || 'N/A'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-4">
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
              <div className="size-8 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-xs font-black text-orange-500 border border-slate-100 dark:border-white/5 shrink-0">
                {((Array.isArray(team.users) ? team.users[0]?.full_name : team.users?.full_name) || 'NA')[0]}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Team Coach</span>
                <span className="font-black text-xs uppercase italic tracking-tighter truncate text-slate-800 dark:text-slate-200">
                  {Array.isArray(team.users) ? team.users[0]?.full_name : team.users?.full_name || 'N/A'}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-white/5">
              <Button 
                size="sm"
                className="h-9 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black uppercase italic tracking-wider text-[10px] rounded-xl shadow-xs gap-1.5 cursor-pointer transition-all"
                onClick={() => onApprove(team.id)}
              >
                <CheckCircle2 className="size-3.5" /> Approve
              </Button>
              <Button 
                variant="outline"
                size="sm"
                className="h-9 font-black uppercase italic tracking-wider text-[10px] rounded-xl text-red-500 border-red-500/30 hover:bg-red-500/10 active:scale-95 gap-1.5 cursor-pointer transition-all"
                onClick={() => onReject(team.id)}
              >
                <XCircle className="size-3.5" /> Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
