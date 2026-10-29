import React from 'react';
import { Clock, History, MapPin, ChevronRight, Crown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { type Match, type Tournament, type TeamAffiliation, getAffiliationBadge } from './types';
import { getSportIcon, SPORT_ICONS } from '@/lib/sportIcons';

interface MatchScheduleListProps {
  matches: Match[];
  isResultsMode?: boolean;
  tourMap: Map<string, Tournament>;
  teamsMap?: Map<string, TeamAffiliation>;
  onNavigateMatch: (id: string) => void;
}

const extractSportName = (match: Match, tourMap: Map<string, Tournament>): string => {
  const tour = tourMap.get(match.tournament_id);
  if (tour?.sport) return tour.sport;
  if (match.team_a?.sport) return match.team_a.sport;
  if (match.team_b?.sport) return match.team_b.sport;

  if (tour?.name) {
    for (const sportKey of Object.keys(SPORT_ICONS)) {
      if (tour.name.toLowerCase().includes(sportKey.toLowerCase())) {
        return sportKey;
      }
    }
  }
  return 'Basketball';
};

export const MatchScheduleList: React.FC<MatchScheduleListProps> = ({
  matches,
  isResultsMode = false,
  tourMap,
  teamsMap,
  onNavigateMatch
}) => {
  // Group matches by date
  const groupedMatches = React.useMemo(() => {
    const groups: { [key: string]: Match[] } = {};
    matches.forEach((m) => {
      let dateKey = 'To Be Announced';
      if (m.match_time) {
        try {
          const d = new Date(m.match_time);
          if (!isNaN(d.getTime())) {
            dateKey = d.toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            });
          }
        } catch {
          dateKey = 'To Be Announced';
        }
      }
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(m);
    });
    return groups;
  }, [matches]);

  if (matches.length === 0) {
    return (
      <Card className="border border-dashed border-slate-200 dark:border-white/10 py-12 px-6 text-center bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl">
        {isResultsMode ? (
          <History className="size-8 text-slate-400 mx-auto mb-2 opacity-50" />
        ) : (
          <Clock className="size-8 text-slate-400 mx-auto mb-2 opacity-50" />
        )}
        <p className="text-slate-500 dark:text-slate-400 font-medium italic text-xs sm:text-sm">
          {isResultsMode
            ? 'No completed match results found for this selection.'
            : 'No upcoming scheduled fixtures found for this selection.'}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Timeline Groups */}
      {Object.entries(groupedMatches).map(([date, dateMatches]) => (
        <div
          key={date}
          className="relative border-l-2 border-slate-200 dark:border-slate-800 pl-4 sm:pl-6 ml-2 sm:ml-3 mb-6 space-y-3"
        >
          <div
            className={`absolute -left-[9px] sm:-left-[11px] top-0 size-4 sm:size-5 rounded-full border-4 border-slate-50 dark:border-slate-950 flex items-center justify-center ${
              isResultsMode ? 'bg-slate-400' : 'bg-orange-500'
            }`}
          />
          <h4 className="text-xs sm:text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest pt-0.5 mb-3 flex items-center gap-2">
            {date}
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {dateMatches.map((match, idx) => {
              const sportName = extractSportName(match, tourMap);
              const SportIcon = getSportIcon(sportName);
              const affA = getAffiliationBadge(match.team_a_id, match.team_a?.name, teamsMap);
              const affB = getAffiliationBadge(match.team_b_id, match.team_b?.name, teamsMap);
              const isTeamAWinner = match.status === 'Completed' && (match.team_a_score ?? 0) > (match.team_b_score ?? 0);
              const isTeamBWinner = match.status === 'Completed' && (match.team_b_score ?? 0) > (match.team_a_score ?? 0);

              return (
                <div
                  key={match.id}
                  onClick={() => onNavigateMatch(match.id)}
                  role="button"
                  tabIndex={0}
                  style={{ animationDelay: `${Math.min(idx * 40, 240)}ms` }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onNavigateMatch(match.id);
                    }
                  }}
                  className={`bg-white dark:bg-slate-900 border rounded-xl sm:rounded-2xl p-4 hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer group space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both relative overflow-hidden ${
                    match.status === 'Ongoing'
                      ? 'border-orange-500 shadow-md shadow-orange-500/10 ring-1 ring-orange-500/30'
                      : 'border-slate-200 dark:border-white/10 hover:border-orange-500/50'
                  }`}
                >
                  {/* Subtle top indicator bar for live matches */}
                  {match.status === 'Ongoing' && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-rose-500 to-amber-500 animate-pulse" />
                  )}

                  {/* Top Bar: Prominent Sport Header and Match Status */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-white/5 pb-2.5">
                    {/* Sport Badge Header */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 text-[10px] font-black uppercase tracking-wider shrink-0">
                        <SportIcon className="size-3.5 text-orange-500 shrink-0" />
                        <span>{sportName}</span>
                      </span>
                      {match.round && (
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight truncate">
                          • {match.round}
                        </span>
                      )}
                    </div>

                    {/* Status Pill */}
                    {match.status === 'Ongoing' ? (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-500 border border-rose-500/30 text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0 shadow-xs">
                        <span className="relative flex size-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                          <span className="relative inline-flex rounded-full size-2 bg-rose-500" />
                        </span>
                        LIVE NOW
                      </span>
                    ) : match.status === 'Completed' ? (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-black tracking-wider shrink-0">
                        FINAL
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
                        <Clock className="size-3 text-slate-400" />
                        <span>
                          {match.match_time
                            ? new Date(match.match_time).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : 'TBD'}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* MOBILE: Top-Down Bracketing Matchup (sm:hidden) to prevent team name truncation */}
                  <div className="sm:hidden space-y-1.5 py-0.5">
                    {/* Team A Slot */}
                    <div
                      className={`flex items-center justify-between py-1.5 px-2.5 rounded-lg transition-colors ${
                        isTeamAWinner
                          ? 'bg-amber-500/15 dark:bg-amber-500/20 text-slate-900 dark:text-white font-black border border-amber-500/30'
                          : 'bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                        {affA && (
                          <span
                            className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-orange-500/15 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30 shrink-0 leading-none"
                            title={affA.fullName}
                          >
                            {affA.badge}
                          </span>
                        )}
                        <span className="font-black italic uppercase text-xs truncate pr-1.5">
                          {match.team_a?.name || 'TBD'}
                        </span>
                        {isTeamAWinner && <Crown className="size-3 text-amber-500 shrink-0" />}
                      </div>
                      <span
                        className={`text-sm font-black tabular-nums shrink-0 ${
                          isTeamAWinner
                            ? 'text-orange-600 dark:text-orange-400'
                            : match.status === 'Ongoing'
                            ? 'text-rose-500 font-black'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {match.status === 'Scheduled' ? '-' : (match.team_a_score ?? 0)}
                      </span>
                    </div>

                    {/* Team B Slot */}
                    <div
                      className={`flex items-center justify-between py-1.5 px-2.5 rounded-lg transition-colors ${
                        isTeamBWinner
                          ? 'bg-amber-500/15 dark:bg-amber-500/20 text-slate-900 dark:text-white font-black border border-amber-500/30'
                          : 'bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                        {affB && (
                          <span
                            className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-orange-500/15 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30 shrink-0 leading-none"
                            title={affB.fullName}
                          >
                            {affB.badge}
                          </span>
                        )}
                        <span className="font-black italic uppercase text-xs truncate pr-1.5">
                          {match.team_b?.name || 'TBD'}
                        </span>
                        {isTeamBWinner && <Crown className="size-3 text-amber-500 shrink-0" />}
                      </div>
                      <span
                        className={`text-sm font-black tabular-nums shrink-0 ${
                          isTeamBWinner
                            ? 'text-orange-600 dark:text-orange-400'
                            : match.status === 'Ongoing'
                            ? 'text-rose-500 font-black'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {match.status === 'Scheduled' ? '-' : (match.team_b_score ?? 0)}
                      </span>
                    </div>
                  </div>

                  {/* DESKTOP: Horizontal Matchup (hidden sm:flex) */}
                  <div className="hidden sm:flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="font-black italic uppercase text-xs sm:text-sm text-slate-900 dark:text-white truncate pr-1.5">
                        {match.team_a?.name || 'TBD'}
                      </span>
                      {affA && (
                        <span className="text-[8px] font-black uppercase px-1 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 shrink-0">
                          {affA.badge}
                        </span>
                      )}
                      {isTeamAWinner && <Crown className="size-3 text-amber-500 shrink-0" />}
                    </div>

                    <div className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-black tabular-nums text-xs shrink-0">
                      {match.team_a_score || 0} - {match.team_b_score || 0}
                    </div>

                    <div className="flex items-center justify-end gap-1.5 flex-1 min-w-0">
                      {isTeamBWinner && <Crown className="size-3 text-amber-500 shrink-0" />}
                      {affB && (
                        <span className="text-[8px] font-black uppercase px-1 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 shrink-0">
                          {affB.badge}
                        </span>
                      )}
                      <span className="font-black italic uppercase text-xs sm:text-sm text-slate-900 dark:text-white truncate text-right pr-1.5">
                        {match.team_b?.name || 'TBD'}
                      </span>
                    </div>
                  </div>

                  {/* Venue and Action */}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium pt-0.5">
                    <div className="flex items-center gap-1 truncate max-w-[200px]">
                      <MapPin className="size-3 text-slate-400 shrink-0" />
                      <span className="truncate">{match.venue || 'PSU Arena'}</span>
                    </div>
                    <span className="group-hover:text-orange-500 transition-colors inline-flex items-center gap-0.5 font-bold uppercase text-[9px]">
                      <span>Matchroom</span>
                      <ChevronRight className="size-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
