import React from 'react';
import { Globe, Trophy, RotateCcw, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SportItem {
  name: string;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
}

interface MatchCenterHeaderProps {
  selectedSport: string;
  onSelectSport: (sport: string) => void;
  allSports: SportItem[];
  totalMatchesCount: number;
  liveMatchesCount: number;
  selectedTournamentName?: string | null;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
}

export const MatchCenterHeader: React.FC<MatchCenterHeaderProps> = ({
  selectedSport,
  onSelectSport,
  allSports,
  totalMatchesCount,
  liveMatchesCount,
  selectedTournamentName,
  hasActiveFilters,
  onResetFilters
}) => {
  return (
    <div className="space-y-4 w-full min-w-0 max-w-full overflow-hidden">
      {/* Sleek Compact Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl md:rounded-[2rem] bg-slate-950 text-white py-3.5 sm:py-5 md:py-6 px-4 sm:px-6 md:px-8 shadow-xl border border-white/5">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 size-64 sm:size-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-1.5 sm:space-y-2.5">
          {/* Breadcrumb Trail */}
          <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-400">
            <button
              type="button"
              onClick={onResetFilters}
              className="hover:text-orange-400 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Globe className="size-3 sm:size-3.5 text-orange-500" />
              <span>Match Center</span>
            </button>
            <ChevronRight className="size-3 text-slate-600" />
            <span className={selectedSport !== 'all' ? 'text-slate-200' : 'text-slate-500'}>
              {selectedSport === 'all' ? 'All Disciplines' : selectedSport}
            </span>
            {selectedTournamentName && (
              <>
                <ChevronRight className="size-3 text-slate-600" />
                <span className="text-orange-500 font-black truncate max-w-[200px]">
                  {selectedTournamentName}
                </span>
              </>
            )}
          </div>

          {/* Main Title Row */}
          <div className="flex flex-row items-center md:items-end justify-between gap-2.5 sm:gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <h1 className="text-xl sm:text-3xl md:text-4xl font-black italic tracking-tighter uppercase leading-none">
                  MATCH <span className="text-orange-500">CENTER</span>
                </h1>
                {liveMatchesCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0">
                    <span className="size-1.5 rounded-full bg-rose-400 animate-ping" />
                    {liveMatchesCount} LIVE
                  </span>
                )}
              </div>
              <p className="hidden sm:block text-slate-400 font-medium text-xs md:text-sm tracking-wide max-w-2xl opacity-90 leading-relaxed mt-1">
                Palawan State University official athletic tournament hub. Select your sport discipline to follow fixtures, real-time courtside scores, and knockout playoff brackets.
              </p>
            </div>

            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={onResetFilters}
                className="self-center md:self-auto bg-white/5 border-white/10 hover:bg-orange-500 hover:border-orange-500 text-white font-bold uppercase text-[10px] tracking-widest h-8 sm:h-9 px-3 rounded-xl transition-all cursor-pointer shrink-0"
              >
                <RotateCcw className="size-3.5 mr-1" />
                Reset
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* PRIMARY NAVIGATION: SPORT DISCIPLINE RAIL */}
      <div className="bg-slate-900/5 dark:bg-slate-950/60 border border-slate-300 dark:border-white/15 p-2.5 sm:p-3.5 rounded-2xl md:rounded-[2rem] shadow-sm w-full min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 mb-2.5 px-1">
          <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 min-w-0">
            <Trophy className="size-3.5 text-orange-500 shrink-0" />
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 whitespace-nowrap">
              Sport Disciplines
            </span>
            <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
              ({allSports.length} Available)
            </span>
          </div>
          {selectedSport !== 'all' && (
            <button
              type="button"
              onClick={() => onSelectSport('all')}
              className="text-[10px] font-bold text-orange-500 hover:text-orange-600 uppercase tracking-widest cursor-pointer transition-colors whitespace-nowrap shrink-0"
            >
              Show All Sports
            </button>
          )}
        </div>

        {/* Scrollable Sport Discipline Pills - Mobile-First Expandable Rail */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1.5 pt-0.5 px-0.5 scrollbar-hide w-full min-w-0">
          {/* All Sports Pill */}
          <button
            type="button"
            onClick={() => onSelectSport('all')}
            title={`All Sports (${totalMatchesCount} matches)`}
            aria-label="All Sports"
            className={`px-2.5 py-1.5 sm:px-4 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-black uppercase italic tracking-tight transition-all duration-150 cursor-pointer active:scale-95 flex items-center gap-1.5 shrink-0 border ${
              selectedSport === 'all'
                ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20 ring-1 ring-orange-400 relative z-10'
                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:border-orange-500/40'
            }`}
          >
            <Globe className="size-3.5 shrink-0" />
            <span className={selectedSport === 'all' ? 'inline' : 'hidden sm:inline'}>All Sports</span>
            <span className={selectedSport === 'all' ? 'hidden' : 'sm:hidden'}>All</span>
            <span
              className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
                selectedSport === 'all'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {totalMatchesCount}
            </span>
          </button>

          {/* Individual Sports Pills */}
          {allSports.map((sport) => {
            const isSelected = selectedSport.toLowerCase() === sport.name.toLowerCase();
            const SportIcon = sport.icon;
            return (
              <button
                key={sport.name}
                type="button"
                onClick={() => onSelectSport(sport.name)}
                title={`${sport.name} (${sport.count} matches)`}
                aria-label={sport.name}
                className={`px-2.5 py-1.5 sm:px-4 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-black uppercase italic tracking-tight transition-all duration-150 cursor-pointer active:scale-95 flex items-center gap-1.5 shrink-0 border ${
                  isSelected
                    ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20 ring-1 ring-orange-400 relative z-10'
                    : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:border-orange-500/40'
                }`}
              >
                <SportIcon className="size-3.5 shrink-0" />
                <span className={isSelected ? 'inline' : 'hidden sm:inline'}>{sport.name}</span>
                <span
                  className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {sport.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
