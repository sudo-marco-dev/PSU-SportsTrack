import React from 'react';
import { Search, Trophy, Layers, X, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Tournament } from './types';

export type MatchCenterPhase = 'elimination' | 'playoffs';

interface MatchCenterToolbarProps {
  tournaments: Tournament[];
  selectedTournamentId: string;
  onSelectTournament: (tourId: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activePhase: MatchCenterPhase;
  setActivePhase: (phase: MatchCenterPhase) => void;
  hasPlayoffs: boolean;
  isEliminationComplete: boolean;
  elimMatchesCount: number;
  playoffMatchesCount: number;
  categoryFilter?: string;
  onCategoryFilterChange?: (category: string) => void;
}

export const MatchCenterToolbar: React.FC<MatchCenterToolbarProps> = ({
  tournaments,
  selectedTournamentId,
  onSelectTournament,
  searchQuery,
  setSearchQuery,
  activePhase,
  setActivePhase,
  hasPlayoffs,
  isEliminationComplete,
  elimMatchesCount,
  playoffMatchesCount,
  categoryFilter,
  onCategoryFilterChange
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-2xl md:rounded-[2rem] p-2.5 xs:p-3 sm:p-4 shadow-sm space-y-3 w-full min-w-0 max-w-full overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3 min-w-0">
        {/* Left: Division Filter + Tournament Dropdown + Search Input */}
        <div className="flex flex-wrap md:flex-nowrap items-center gap-2 sm:gap-2.5 flex-1 min-w-0">
          {/* Division Selector */}
          {onCategoryFilterChange && (
            <div className="w-full xs:w-[calc(50%-0.25rem)] sm:w-44 md:w-44 shrink-0 min-w-0">
              <Select
                value={categoryFilter || 'all'}
                onValueChange={(val: string | null) => onCategoryFilterChange(val || 'all')}
              >
                <SelectTrigger className="h-10 sm:h-11 rounded-xl border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-slate-800/90 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  <SelectValue placeholder="All Divisions">
                    {categoryFilter === 'friendly'
                      ? 'Friendly Games'
                      : categoryFilter === 'binturungan'
                      ? 'Binturungan'
                      : categoryFilter === 'collegiate'
                      ? 'Inter-Collegiate'
                      : 'All Divisions'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-xl font-bold uppercase text-xs">
                  <SelectItem value="all">All Divisions</SelectItem>
                  <SelectItem value="friendly">Friendly Games</SelectItem>
                  <SelectItem value="binturungan">Binturungan</SelectItem>
                  <SelectItem value="collegiate">Inter-Collegiate</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Tournament Selector */}
          <div className="w-full xs:w-[calc(50%-0.25rem)] sm:w-60 md:w-64 shrink-0 min-w-0">
            <Select
              value={selectedTournamentId}
              onValueChange={(val: string | null) => onSelectTournament(val || 'all')}
            >
              <SelectTrigger className="h-10 sm:h-11 rounded-xl border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-slate-800/90 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200">
                <SelectValue placeholder="All Tournaments">
                  {selectedTournamentId === 'all'
                    ? `All Tournaments (${tournaments.length})`
                    : tournaments.find((t) => t.id === selectedTournamentId)?.name || 'Tournament'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl font-bold uppercase text-xs">
                <SelectItem value="all">
                  All Tournaments ({tournaments.length})
                </SelectItem>
                {tournaments.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} {t.type ? `(${t.type})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quick Search Input */}
          <div className="relative flex-1 w-full min-w-[180px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Search squads, colleges, court venue..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-9 h-10 sm:h-11 rounded-xl bg-slate-50 dark:bg-slate-800/90 border-slate-300 dark:border-white/15 font-medium text-xs text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-800 transition-all w-full"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 size-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors cursor-pointer"
                title="Clear search"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Explicit Phase Switcher (Phase 1 Elimination vs Phase 2 Playoff Bracket) */}
        <div
          role="tablist"
          aria-label="Tournament Phase Selector"
          className="grid grid-cols-2 lg:flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 bg-slate-950 text-white rounded-xl border border-white/15 shadow-md w-full lg:w-auto min-w-0"
        >
          {/* Phase 1: Elimination Stage */}
          <button
            type="button"
            role="tab"
            aria-selected={activePhase === 'elimination'}
            aria-label="Phase 1 Elimination Stage"
            onClick={() => setActivePhase('elimination')}
            className={`py-2 sm:py-2.5 px-1.5 xs:px-2.5 sm:px-3.5 rounded-lg font-black uppercase italic tracking-tight text-[10px] xs:text-[11px] sm:text-xs transition-all duration-150 cursor-pointer active:scale-95 flex items-center justify-center gap-1 sm:gap-1.5 min-w-0 w-full lg:w-auto ${
              activePhase === 'elimination'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers className="size-3.5 shrink-0" />
            <span className="min-w-0 whitespace-nowrap sm:hidden">Phase 1</span>
            <span className="min-w-0 whitespace-nowrap hidden sm:inline">Phase 1 • Elimination</span>
            <span
              className={`px-1 xs:px-1.5 py-0.5 rounded text-[8px] xs:text-[9px] font-bold shrink-0 leading-none ${
                activePhase === 'elimination' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {elimMatchesCount}
            </span>
            {isEliminationComplete && (
              <span className="hidden sm:inline px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[8px] font-black uppercase border border-emerald-500/30 shrink-0 leading-none">
                Done
              </span>
            )}
          </button>

          {/* Phase 2: Playoff Bracket */}
          <button
            type="button"
            role="tab"
            aria-selected={activePhase === 'playoffs'}
            aria-label="Phase 2 Playoff Bracket"
            onClick={() => setActivePhase('playoffs')}
            className={`py-2 sm:py-2.5 px-1.5 xs:px-2.5 sm:px-3.5 rounded-lg font-black uppercase italic tracking-tight text-[10px] xs:text-[11px] sm:text-xs transition-all duration-150 cursor-pointer active:scale-95 flex items-center justify-center gap-1 sm:gap-1.5 min-w-0 w-full lg:w-auto ${
              activePhase === 'playoffs'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {hasPlayoffs ? (
              <Trophy className="size-3.5 text-yellow-400 shrink-0" />
            ) : (
              <Lock className="size-3.5 text-slate-500 shrink-0" />
            )}
            <span className="min-w-0 whitespace-nowrap sm:hidden">Playoffs</span>
            <span className="min-w-0 whitespace-nowrap hidden sm:inline">Phase 2 • Playoff Bracket</span>
            {hasPlayoffs ? (
              <span
                className={`px-1 xs:px-1.5 py-0.5 rounded text-[8px] xs:text-[9px] font-bold shrink-0 leading-none ${
                  activePhase === 'playoffs' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {playoffMatchesCount}
              </span>
            ) : (
              <span className="px-1 xs:px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[8px] font-black uppercase border border-slate-700 shrink-0 leading-none">
                Locked
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
