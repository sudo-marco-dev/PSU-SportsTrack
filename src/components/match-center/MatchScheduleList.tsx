import React from 'react';
import { Clock, History, MapPin, ChevronRight, Filter } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type Match, type Tournament, type TeamAffiliation, getAffiliationBadge } from './types';
import { getSportIcon, SPORT_ICONS } from '@/lib/sportIcons';

interface MatchScheduleListProps {
  matches: Match[];
  isResultsMode?: boolean;
  tourMap: Map<string, Tournament>;
  teamsMap?: Map<string, TeamAffiliation>;
  availableRounds: string[];
  selectedRound: string;
  onSelectRound: (round: string) => void;
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
  return 'General Sports';
};

export const MatchScheduleList: React.FC<MatchScheduleListProps> = ({
  matches,
  isResultsMode = false,
  tourMap,
  teamsMap,
  availableRounds,
  selectedRound,
  onSelectRound,
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
      {/* Optional Round / Stage Filter */}
      {availableRounds.length > 0 && (
        <div className="flex items-center gap-2 px-1">
          <Filter className="size-3.5 text-slate-400" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Stage Filter:
          </span>
          <div className="w-52">
            <Select
              value={selectedRound}
              onValueChange={(val: string | null) => onSelectRound(val || 'all')}
            >
              <SelectTrigger className="h-8 rounded-lg border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 font-bold text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-200">
                <SelectValue placeholder="All Stages" />
              </SelectTrigger>
              <SelectContent className="rounded-xl font-bold uppercase text-xs">
                <SelectItem value="all">All Stages</SelectItem>
                {availableRounds.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

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
            {dateMatches.map((match) => {
              const sportName = extractSportName(match, tourMap);
              const SportIcon = getSportIcon(sportName);
              const affA = getAffiliationBadge(match.team_a_id, match.team_a?.name, teamsMap);
              const affB = getAffiliationBadge(match.team_b_id, match.team_b?.name, teamsMap);

              return (
                <div
                  key={match.id}
                  onClick={() => onNavigateMatch(match.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onNavigateMatch(match.id);
                    }
                  }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl sm:rounded-2xl p-4 hover:shadow-md hover:border-orange-500/50 transition-all cursor-pointer group space-y-3"
                >
                  {/* Top Bar: Sport and Match Status */}
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-white/5 pb-2">
                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                      <SportIcon className="size-3 text-orange-500" />
                      <span>{sportName}</span>
                      {match.round && (
                        <span className="text-slate-400 font-medium lowercase">
                          • {match.round}
                        </span>
                      )}
                    </span>
                    {match.status === 'Ongoing' ? (
                      <span className="text-rose-500 font-black flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-rose-500 animate-ping" />
                        LIVE
                      </span>
                    ) : match.status === 'Completed' ? (
                      <span className="text-emerald-500 font-black">FINAL</span>
                    ) : (
                      <span className="text-slate-400 font-medium">
                        {match.match_time
                          ? new Date(match.match_time).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'TBD'}
                      </span>
                    )}
                  </div>

                  {/* Teams & Score */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="font-black italic uppercase text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                        {match.team_a?.name || 'TBD'}
                      </span>
                      {affA && (
                        <span className="text-[8px] font-black uppercase px-1 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 shrink-0">
                          {affA.badge}
                        </span>
                      )}
                    </div>

                    <div className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-black tabular-nums text-xs shrink-0">
                      {match.team_a_score || 0} - {match.team_b_score || 0}
                    </div>

                    <div className="flex items-center justify-end gap-1.5 flex-1 min-w-0">
                      {affB && (
                        <span className="text-[8px] font-black uppercase px-1 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 shrink-0">
                          {affB.badge}
                        </span>
                      )}
                      <span className="font-black italic uppercase text-xs sm:text-sm text-slate-900 dark:text-white truncate text-right">
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
