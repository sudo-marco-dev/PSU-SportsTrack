import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Trophy, 
  CalendarDays, 
  LayoutGrid, 
  Eye, 
  Trash2, 
  ChevronRight, 
  CheckCircle2 
} from 'lucide-react';
import { getSportIcon } from '@/lib/sportIcons';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import type { Tournament } from './types';

interface TournamentListTabProps {
  tournaments: Tournament[];
  isLoading: boolean;
  viewMode: 'grid' | 'list';
  onOpenWizard: (tournament: Tournament) => void;
  onPromptDelete: (tournament: Tournament) => void;
  onClearFilters: () => void;
  onToggleCoi?: (tournament: Tournament) => void;
}

export const TournamentListTab: React.FC<TournamentListTabProps> = ({
  tournaments,
  isLoading,
  viewMode,
  onOpenWizard,
  onPromptDelete,
  onClearFilters,
  onToggleCoi,
}) => {
  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <SkeletonCard count={3} />
      </div>
    );
  }

  if (tournaments.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="No tournaments found"
        description="No institutional ballgame competitions match the current filter and search parameters."
        actionLabel="Reset Search Criteria"
        onAction={onClearFilters}
      />
    );
  }

  if (viewMode === 'grid') {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {tournaments.map((t, idx) => {
          const SportIcon = (getSportIcon(t.sport || t.name)) as any;
          return (
            <Card
              key={t.id}
              className="group hover:border-orange-500/50 transition-all duration-500 shadow-sm hover:shadow-2xl rounded-3xl overflow-hidden border-2 border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 animate-in fade-in slide-in-from-bottom-4"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className="h-2 bg-slate-100 dark:bg-white/5 w-full overflow-hidden">
                <div className="h-full bg-orange-500 transition-all duration-1000 delay-300 w-0 group-hover:w-full" />
              </div>
              <CardHeader className="p-8 pb-4">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2.5 bg-slate-50 dark:bg-white/5 rounded-xl group-hover:bg-orange-500 transition-colors duration-500">
                    <SportIcon className="size-5 text-slate-400 group-hover:text-white transition-colors duration-500" />
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    <button
                      type="button"
                      onClick={() => onToggleCoi && onToggleCoi(t)}
                      title="Click to toggle Conflict of Interest enforcement (Shortage Policy)"
                      className={`text-[9px] font-black uppercase tracking-wider py-1 px-2.5 rounded-full border transition-all cursor-pointer ${
                        t.enforce_conflict_of_interest === false
                          ? 'bg-amber-500/15 text-amber-500 border-amber-500/30 hover:bg-amber-500/25'
                          : 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/25'
                      }`}
                    >
                      {t.enforce_conflict_of_interest === false ? 'Shortage (COI Open)' : 'COI Enforced'}
                    </button>
                    <Badge
                      className={`${
                        t.status === 'Completed'
                          ? 'bg-emerald-600 text-white shadow-emerald-500/10'
                          : t.status === 'Active'
                          ? 'bg-orange-500 text-white shadow-orange-500/10'
                          : 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                      } text-[10px] font-black uppercase tracking-widest py-1 px-3 rounded-full shadow-lg`}
                    >
                      {t.status === 'Completed' && <CheckCircle2 className="size-3 mr-1 inline" />}
                      {t.status}
                    </Badge>
                  </div>
                </div>
                <CardTitle className="text-2xl font-black italic uppercase tracking-tighter group-hover:text-orange-500 transition-colors">
                  {t.name}
                </CardTitle>
                <CardDescription className="font-bold text-slate-500 uppercase text-[10px] tracking-widest mt-1">
                  {t.sport} • {t.type}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-8 pt-4">
                <div className="flex items-center gap-3 text-slate-400 dark:text-slate-500 mb-8 font-bold text-xs">
                  <CalendarDays className="size-4 text-orange-500" />
                  {new Date(t.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} -{' '}
                  {new Date(t.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    className="flex-1 h-14 flex items-center justify-center gap-3 bg-slate-900 hover:bg-orange-500 text-white font-black uppercase italic tracking-[0.1em] rounded-2xl shadow-xl transition-all duration-300 group-hover:shadow-orange-500/20 cursor-pointer"
                    onClick={() => onOpenWizard(t)}
                  >
                    {t.status === 'Draft' ? (
                      <LayoutGrid className="size-5" />
                    ) : t.status === 'Completed' ? (
                      <Trophy className="size-5 text-amber-400" />
                    ) : (
                      <Eye className="size-5 text-orange-400" />
                    )}
                    {t.status === 'Draft' ? 'Setup Bracket' : t.status === 'Completed' ? 'View Results' : 'Bracket Preview'}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-14 w-14 rounded-2xl border-2 border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500 text-slate-400 flex items-center justify-center shrink-0 transition-all shadow-sm cursor-pointer"
                    title="Terminate Tournament"
                    onClick={() => onPromptDelete(t)}
                  >
                    <Trash2 className="size-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Mobile Card List (md:hidden) - Zero horizontal scroll */}
      <div className="md:hidden space-y-3">
        {tournaments.map((t) => {
          const SportIcon = (getSportIcon(t.sport || t.name)) as any;
          return (
            <Card
              key={`mob-${t.id}`}
              className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-500 shrink-0 border border-orange-500/20">
                    <SportIcon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black italic uppercase tracking-tight text-sm text-slate-900 dark:text-white truncate">
                      {t.name}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {t.sport}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge
                    className={`${
                      t.status === 'Completed'
                        ? 'bg-emerald-600 text-white'
                        : t.status === 'Active'
                        ? 'bg-orange-500 text-white'
                        : 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                    } text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md`}
                  >
                    {t.status === 'Completed' && <CheckCircle2 className="size-2.5 mr-1 inline" />}
                    {t.status}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => onToggleCoi && onToggleCoi(t)}
                    title="Toggle Conflict of Interest policy"
                    className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border transition-all cursor-pointer ${
                      t.enforce_conflict_of_interest === false
                        ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    }`}
                  >
                    {t.enforce_conflict_of_interest === false ? 'COI: Shortage' : 'COI: Enforced'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-2.5 border-t border-slate-100 dark:border-white/5">
                <span className="text-[11px] font-bold text-slate-400">
                  Kickoff: <span className="text-slate-700 dark:text-slate-200">{new Date(t.start_date).toLocaleDateString()}</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-[10px] font-black uppercase italic text-orange-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg cursor-pointer"
                    onClick={() => onOpenWizard(t)}
                  >
                    Manage <ChevronRight className="size-3 ml-0.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-8 p-0 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg cursor-pointer"
                    title="Terminate Tournament"
                    onClick={() => onPromptDelete(t)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Desktop Table View (hidden md:block) */}
      <Card className="hidden md:block rounded-[2rem] border-2 border-slate-100 dark:border-white/5 overflow-x-auto shadow-2xl bg-white dark:bg-slate-900">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-white/5">
            <TableRow className="hover:bg-transparent border-none">
              <TableHead className="font-black uppercase tracking-widest text-[10px] h-14 pl-8">Event Name</TableHead>
              <TableHead className="font-black uppercase tracking-widest text-[10px] h-14">Category</TableHead>
              <TableHead className="font-black uppercase tracking-widest text-[10px] h-14">Status</TableHead>
              <TableHead className="font-black uppercase tracking-widest text-[10px] h-14">Kickoff</TableHead>
              <TableHead className="font-black uppercase tracking-widest text-[10px] h-14 text-right pr-8">Control</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tournaments.map((t, idx) => {
              const SportIcon = (getSportIcon(t.sport || t.name)) as any;
              return (
                <TableRow 
                  key={t.id} 
                  className="hover:bg-orange-50/30 dark:hover:bg-orange-500/5 transition-colors border-slate-100 dark:border-white/5 group animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <TableCell className="font-black italic uppercase tracking-tighter text-lg pl-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                        <SportIcon className="size-4" />
                      </div>
                      <span>{t.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-bold text-slate-500 uppercase text-[10px] tracking-widest">{t.sport}</TableCell>
                  <TableCell>
                    <Badge 
                      className={`${
                        t.status === 'Completed' 
                          ? 'bg-emerald-600 text-white' 
                          : t.status === 'Active' 
                          ? 'bg-orange-500 text-white' 
                          : 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                      } text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full`}
                    >
                      {t.status === 'Completed' && <CheckCircle2 className="size-2.5 mr-1 inline" />}
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-bold text-xs text-slate-400">{new Date(t.start_date).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right pr-8">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="font-black uppercase italic tracking-widest text-[10px] text-orange-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/10 cursor-pointer"
                        onClick={() => onOpenWizard(t)}
                      >
                        Manage <ChevronRight className="size-3 ml-1" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
                        title="Terminate Tournament"
                        onClick={() => onPromptDelete(t)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};
