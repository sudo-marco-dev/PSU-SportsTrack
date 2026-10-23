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
      <Card className="rounded-[2.5rem] border-2 border-slate-100 dark:border-white/5 overflow-hidden shadow-2xl bg-white dark:bg-slate-900">
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
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {teams.map((team, idx) => (
        <Card key={team.id} className="group hover:border-orange-500/50 transition-all duration-500 shadow-sm hover:shadow-2xl rounded-3xl overflow-hidden border-2 border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${idx * 50}ms` }}>
          <CardHeader className="p-8 pb-4">
            <div className="flex justify-between items-start mb-4">
              <div className="size-12 rounded-2xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center">
                <Users className="size-6 text-orange-500" />
              </div>
              <Badge className="bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest py-1 px-3 rounded-full border-none shadow-none">
                Pending
              </Badge>
            </div>
            <CardTitle className="text-2xl font-black italic uppercase tracking-tighter group-hover:text-orange-500 transition-colors">{team.name}</CardTitle>
            <CardDescription className="font-bold text-slate-500 uppercase text-[10px] tracking-widest mt-1">
              {Array.isArray(team.tournaments) ? team.tournaments[0]?.name : team.tournaments?.name || 'N/A'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-4">
            <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl mb-8">
              <div className="size-10 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-xs font-black text-orange-500 border border-slate-100 dark:border-white/5">
                {((Array.isArray(team.users) ? team.users[0]?.full_name : team.users?.full_name) || 'NA')[0]}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Team Coach</span>
                <span className="font-black text-sm uppercase italic tracking-tighter">
                  {Array.isArray(team.users) ? team.users[0]?.full_name : team.users?.full_name || 'N/A'}
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button 
                className="flex-1 h-12 bg-slate-900 hover:bg-green-600 text-white font-black uppercase italic tracking-widest text-[10px] rounded-xl shadow-lg transition-all cursor-pointer"
                onClick={() => onApprove(team.id)}
              >
                Approve
              </Button>
              <Button 
                variant="ghost"
                className="h-12 px-5 text-destructive font-black uppercase italic tracking-widest text-[10px] rounded-xl hover:bg-destructive/10 cursor-pointer"
                onClick={() => onReject(team.id)}
              >
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
