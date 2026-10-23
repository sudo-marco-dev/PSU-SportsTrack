import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Star,
  GraduationCap,
  Loader2,
  Target,
  Activity,
  UserPlus,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  fetchPlayerTelemetry,
  getSportScoringActionCards,
  type PlayerTelemetry,
} from '@/lib/playerStatsEngine';
import { getSportIcon } from '@/lib/sportIcons';
import { getSportScoringProfile } from '@/lib/sportScoringRules';

type PlayerDossierModalProps = {
  playerId: string | null;
  onClose: () => void;
  onOpenMatchBoxScore?: (matchId: string) => void;
  onRecruitPlayer?: (playerId: string) => void;
  eligibilityBadge?: {
    eligible: boolean;
    badgeLabel: string;
    reason: string;
  } | null;
};

type PlayerProfileInfo = {
  id: string;
  full_name: string;
  role: string;
  is_verified: boolean;
  program: string | null;
  year_level: string | null;
  age: number | null;
  preferred_sports: string[] | null;
  primary_position: string | null;
  colleges: { college_name: string } | null;
};

export const PlayerDossierModal = ({
  playerId,
  onClose,
  onOpenMatchBoxScore,
  onRecruitPlayer,
  eligibilityBadge,
}: PlayerDossierModalProps) => {
  const [playerInfo, setPlayerInfo] = useState<PlayerProfileInfo | null>(null);
  const [telemetry, setTelemetry] = useState<PlayerTelemetry | null>(null);
  const [selectedSport, setSelectedSport] = useState<string>('All');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!playerId) {
      setPlayerInfo(null);
      setTelemetry(null);
      setSelectedSport('All');
      return;
    }
    let mounted = true;
    setIsLoading(true);

    Promise.all([
      supabase
        .from('users')
        .select('id, full_name, role, is_verified, program, year_level, age, preferred_sports, primary_position, colleges(college_name)')
        .eq('id', playerId)
        .maybeSingle(),
      fetchPlayerTelemetry(playerId),
    ])
      .then(([userRes, teleRes]) => {
        if (!mounted) return;
        if (userRes.data) {
          const d: any = userRes.data;
          const col = Array.isArray(d.colleges) ? d.colleges[0] : d.colleges;
          setPlayerInfo({
            ...d,
            colleges: col || null,
          });
        }
        setTelemetry(teleRes);
        if (teleRes.sortedSports && teleRes.sortedSports.length > 0 && teleRes.sortedSports[0].gamesPlayed > 0) {
          setSelectedSport(teleRes.sortedSports[0].sport);
        } else {
          setSelectedSport('All');
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [playerId]);

  return (
    <Dialog open={!!playerId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full sm:max-w-4xl max-w-[96vw] max-h-[90dvh] overflow-hidden rounded-3xl p-5 sm:p-7 flex flex-col bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
        <DialogHeader className="shrink-0 pb-2 border-b border-slate-100 dark:border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="size-12 sm:size-14 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 text-white font-black text-xl flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/20">
                {playerInfo?.full_name?.charAt(0) || 'A'}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <Badge className="bg-orange-500/15 text-orange-500 border-orange-500/30 text-[9px] font-black uppercase">
                    {playerInfo?.role === 'player_faculty' ? 'Faculty Athlete' : 'Student Athlete'}
                  </Badge>
                  {playerInfo?.is_verified && (
                    <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-[9px] font-black uppercase gap-1">
                      <CheckCircle2 className="size-2.5" /> Verified
                    </Badge>
                  )}
                  {playerInfo?.primary_position && (
                    <Badge variant="outline" className="text-[9px] font-black uppercase border-slate-300 dark:border-white/20">
                      {playerInfo.primary_position}
                    </Badge>
                  )}
                  {eligibilityBadge && (
                    <Badge
                      className={
                        eligibilityBadge.eligible
                          ? 'bg-emerald-500 text-white text-[9px] font-black uppercase'
                          : 'bg-red-500/15 text-red-500 border-red-500/30 text-[9px] font-black uppercase'
                      }
                      title={eligibilityBadge.reason}
                    >
                      {eligibilityBadge.badgeLabel}
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-xl sm:text-2xl font-black italic uppercase tracking-tight text-slate-900 dark:text-white truncate">
                  {playerInfo?.full_name || 'Athlete Scouting Dossier'}
                </DialogTitle>
                <DialogDescription className="text-xs font-bold text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                  <span className="inline-flex items-center gap-1">
                    <GraduationCap className="size-3.5 text-orange-500" />
                    {playerInfo?.colleges?.college_name || 'Unassigned College'}
                  </span>
                  {playerInfo?.program && (
                    <span>• {playerInfo.program}</span>
                  )}
                  {playerInfo?.year_level && (
                    <span>({playerInfo.year_level})</span>
                  )}
                </DialogDescription>
              </div>
            </div>

            {onRecruitPlayer && playerId && (
              <Button
                onClick={() => {
                  onClose();
                  onRecruitPlayer(playerId);
                }}
                className="bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic tracking-wider text-xs h-10 px-4 rounded-xl shadow-md shadow-orange-500/20 shrink-0 gap-1.5"
              >
                <UserPlus className="size-4" />
                <span>Recruit Athlete</span>
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1 py-3 scrollbar-hide">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="size-8 text-orange-500 animate-spin" />
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Compiling Athlete Telemetry...
              </p>
            </div>
          ) : !telemetry ? (
            <div className="text-center py-12 text-slate-400 font-bold uppercase text-xs">
              No telemetry available.
            </div>
          ) : (() => {
            const prefList = playerInfo?.preferred_sports || [];
            const orderedSports = [...(telemetry.sortedSports || [])].sort((a, b) => {
              if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
              if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
              if (b.activeSquadCount !== a.activeSquadCount) return b.activeSquadCount - a.activeSquadCount;
              const aPref = prefList.includes(a.sport) ? 1 : 0;
              const bPref = prefList.includes(b.sport) ? 1 : 0;
              if (bPref !== aPref) return bPref - aPref;
              return a.sport.localeCompare(b.sport);
            });

            const activeSportData =
              selectedSport !== 'All' && telemetry.perSportTelemetry?.[selectedSport]
                ? telemetry.perSportTelemetry[selectedSport]
                : null;

            const displayGamesPlayed = activeSportData ? activeSportData.gamesPlayed : telemetry.gamesPlayed;
            const displayWins = activeSportData ? activeSportData.wins : telemetry.wins;
            const displayLosses = activeSportData ? activeSportData.losses : telemetry.losses;
            const displayWinRate = activeSportData ? activeSportData.winRate : telemetry.winRate;
            const displayTotalPoints = activeSportData ? activeSportData.totalPoints : telemetry.totalPoints;
            const displayPpg = activeSportData ? activeSportData.ppg : telemetry.ppg;

            const effectiveSportForRules =
              selectedSport !== 'All'
                ? selectedSport
                : orderedSports[0]?.gamesPlayed > 0
                ? orderedSports[0].sport
                : prefList[0] || 'Basketball';

            const sportProfile = getSportScoringProfile(effectiveSportForRules);
            const pointUnitLabel = selectedSport !== 'All' ? sportProfile.pointUnit : 'PTS';

            const actionCards = getSportScoringActionCards(
              selectedSport,
              activeSportData ? activeSportData.actionCounts : telemetry.actionCounts,
              activeSportData ? activeSportData.actionBreakdown : telemetry.actionBreakdown
            );

            const topHighlightAction =
              [...actionCards].sort((a, b) => b.totalPoints - a.totalPoints || b.count - a.count)[0] ||
              actionCards[0] || {
                label: 'Primary Action',
                count: 0,
                totalPoints: 0,
              };

            const filteredGames = telemetry.recordedGames.filter(
              (g) => selectedSport === 'All' || g.sport.toLowerCase() === selectedSport.toLowerCase()
            );

            const formatGameActionSummary = (g: any) => {
              const sp = (g.sport || '').toLowerCase();
              if (sp.includes('volleyball') || sp.includes('takraw')) {
                return `${g.kills} Kills • ${g.aces} Aces • ${g.blocks} Blk`;
              }
              if (sp.includes('soccer') || sp.includes('futsal') || sp.includes('football')) {
                return `${g.goals} Goals • ${g.penalties || 0} PK`;
              }
              if (sp.includes('baseball') || sp.includes('softball')) {
                return `${g.runs || 0} Runs • ${g.homeRuns} HR`;
              }
              if (sp.includes('pickleball') || sp.includes('table tennis')) {
                return `${g.rallyPoints || g.playerPoints} Rally Pts`;
              }
              return `${g.threePointers} 3PM • ${g.twoPointers} 2PM • ${g.freeThrows} FT`;
            };

            return (
              <>
                {/* Preferred Sports & Active Squads Pills */}
                {(prefList.length > 0 || telemetry.activeSquads.length > 0) && (
                  <div className="flex flex-wrap items-center gap-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/10">
                    {prefList.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mr-3">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Preferred Sports:
                        </span>
                        {prefList.map((sp) => (
                          <Badge
                            key={sp}
                            className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 text-[10px] font-black uppercase"
                          >
                            {sp}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {telemetry.activeSquads.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Squads:
                        </span>
                        {telemetry.activeSquads.map((sq) => (
                          <Badge
                            key={sq.rosterId}
                            variant="outline"
                            className="text-[10px] font-bold uppercase border-slate-300 dark:border-white/15"
                          >
                            {sq.teamName} ({sq.sport}) {sq.jerseyNumber !== null ? `#${sq.jerseyNumber}` : ''}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Sport Filter Bar: Expandable Sport Icon Rail */}
                <div className="p-3 sm:p-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Target className="size-3.5 text-orange-500" />
                      Filter by Sport
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar w-full min-w-0">
                    <button
                      type="button"
                      onClick={() => setSelectedSport('All')}
                      className={`min-h-[34px] px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                        selectedSport === 'All'
                          ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                          : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-orange-500/40'
                      }`}
                    >
                      <span className={selectedSport === 'All' ? 'inline' : 'hidden sm:inline'}>All Sports</span>
                      <span className="font-mono text-[9px] opacity-80">({telemetry.gamesPlayed})</span>
                    </button>

                    {orderedSports.map((spItem) => {
                      const SportIcon = getSportIcon(spItem.sport);
                      const isSelected = selectedSport === spItem.sport;
                      const hasPlayed = spItem.gamesPlayed > 0;
                      return (
                        <button
                          key={spItem.sport}
                          type="button"
                          onClick={() => setSelectedSport(spItem.sport)}
                          title={`${spItem.sport} (${spItem.gamesPlayed} GP)`}
                          className={`min-h-[34px] px-2 sm:px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                            isSelected
                              ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                              : hasPlayed
                              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-orange-500/30 hover:border-orange-500'
                              : 'bg-slate-50/70 dark:bg-white/[0.03] text-slate-400 dark:text-slate-500 border-slate-200/70 dark:border-white/5'
                          }`}
                        >
                          <SportIcon className="size-3 shrink-0" />
                          <span className={isSelected ? 'inline' : 'hidden sm:inline'}>{spItem.sport}</span>
                          <span className="font-mono text-[9px] opacity-80">({spItem.gamesPlayed})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Mobile Telemetry Ribbon (< sm) */}
                <div className="sm:hidden grid grid-cols-5 divide-x divide-white/10 bg-slate-950 text-white rounded-2xl p-2 border border-white/10">
                  <div className="text-center px-1">
                    <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">GP</p>
                    <p className="text-base font-black tabular-nums mt-0.5">{displayGamesPlayed}</p>
                    <p className="text-[8px] font-bold text-emerald-400 truncate mt-0.5">{displayWins}W-{displayLosses}L</p>
                  </div>
                  <div className="text-center px-1">
                    <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">{pointUnitLabel}</p>
                    <p className="text-base font-black tabular-nums text-orange-400 mt-0.5">{displayTotalPoints}</p>
                    <p className="text-[8px] font-bold text-slate-400 truncate mt-0.5">Total</p>
                  </div>
                  <div className="text-center px-1">
                    <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">AVG</p>
                    <p className="text-base font-black tabular-nums text-cyan-400 mt-0.5">{displayPpg}</p>
                    <p className="text-[8px] font-bold text-slate-400 truncate mt-0.5">/ Game</p>
                  </div>
                  <div className="text-center px-1">
                    <p className="text-[8px] font-black uppercase tracking-wider text-slate-400 truncate" title={topHighlightAction.label}>
                      {topHighlightAction.label.split(' ')[0]}
                    </p>
                    <p className="text-base font-black tabular-nums text-amber-400 mt-0.5">{topHighlightAction.count}</p>
                    <p className="text-[8px] font-bold text-slate-400 truncate mt-0.5">+{topHighlightAction.totalPoints}</p>
                  </div>
                  <div className="text-center px-1">
                    <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">MVP</p>
                    <p className="text-base font-black tabular-nums text-yellow-400 mt-0.5">
                      {telemetry.redStars + telemetry.goldStars}
                    </p>
                    <p className="text-[8px] font-bold text-slate-400 truncate mt-0.5">Honors</p>
                  </div>
                </div>

                {/* Desktop Top-Level Career Stat Cards (>= sm) */}
                <div className="hidden sm:grid sm:grid-cols-5 gap-2.5 sm:gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-950 text-white border border-white/10 min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 truncate">
                      {selectedSport === 'All' ? 'Games Played' : `${selectedSport} GP`}
                    </p>
                    <p className="text-2xl font-black tabular-nums mt-0.5">{displayGamesPlayed}</p>
                    <p className="text-[10px] font-bold text-emerald-400 mt-0.5 truncate">
                      {displayWins}W - {displayLosses}L ({displayWinRate}%)
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-950 text-white border border-white/10 min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 truncate">
                      Total {pointUnitLabel}
                    </p>
                    <p className="text-2xl font-black tabular-nums text-orange-400 mt-0.5">{displayTotalPoints}</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5 truncate">
                      {selectedSport === 'All' ? 'Career Total' : selectedSport}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-950 text-white border border-white/10 min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 truncate">
                      Scoring Avg
                    </p>
                    <p className="text-2xl font-black tabular-nums text-cyan-400 mt-0.5">{displayPpg}</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5 truncate">{pointUnitLabel} Per Game</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-950 text-white border border-white/10 min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 truncate">
                      {topHighlightAction.label}
                    </p>
                    <p className="text-2xl font-black tabular-nums text-amber-400 mt-0.5">
                      {topHighlightAction.count}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5 truncate">
                      +{topHighlightAction.totalPoints} {pointUnitLabel}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-950 text-white border border-white/10 min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 truncate">MVP Honors</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Star className="size-5 text-orange-500 fill-orange-500 shrink-0" />
                      <span className="text-2xl font-black tabular-nums">
                        {telemetry.redStars + telemetry.goldStars}
                      </span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5 truncate">
                      {telemetry.redStars} Match • {telemetry.goldStars} Tourney
                    </p>
                  </div>
                </div>

                {/* Dynamic Sport-Specific Scoring Breakdown */}
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-3.5 sm:p-5 bg-white dark:bg-slate-900 space-y-3">
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Target className="size-4 text-orange-500 shrink-0" />
                      <span>
                        {selectedSport === 'All'
                          ? 'Multi-Sport Scoring Action Breakdown'
                          : `${selectedSport} Scoring Action Breakdown`}
                      </span>
                    </h4>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Granular Telemetry from Official Match Score Events
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5">
                    {actionCards.map((item, idx) => {
                      const tone =
                        idx % 3 === 0
                          ? 'bg-orange-500/5 border-orange-500/20 text-orange-600 dark:text-orange-400'
                          : idx % 3 === 1
                          ? 'bg-cyan-500/5 border-cyan-500/20 text-cyan-600 dark:text-cyan-400'
                          : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400';
                      return (
                        <div key={`${item.actionType}-${idx}`} className={`p-2.5 sm:p-3 rounded-xl border ${tone}`}>
                          <span className="text-[9px] font-black uppercase tracking-wider block truncate">
                            {item.label}
                          </span>
                          <div className="flex items-baseline justify-between mt-1">
                            <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tabular-nums">
                              {item.count}
                            </span>
                            <span className="text-[11px] sm:text-xs font-black">
                              +{item.totalPoints} {pointUnitLabel}
                            </span>
                          </div>
                          <p className="text-[9px] sm:text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {item.sublabel}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Recorded Games Log (Mobile Card Stack + Desktop Table) */}
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden bg-white dark:bg-slate-900">
                  <div className="px-4 py-3 bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-2 flex-wrap">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Activity className="size-4 text-orange-500 shrink-0" />
                      <span>
                        {selectedSport === 'All' ? 'Recorded Games' : `${selectedSport} Games`} ({filteredGames.length})
                      </span>
                    </h4>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      Tap any match for full box score
                    </span>
                  </div>

                  {filteredGames.length === 0 ? (
                    <div className="p-8 text-center text-xs font-bold uppercase tracking-wider text-slate-400">
                      No recorded {selectedSport !== 'All' ? selectedSport : ''} games found for this athlete yet.
                    </div>
                  ) : (
                    <>
                      {/* Mobile Cards */}
                      <div className="md:hidden divide-y divide-slate-100 dark:divide-white/5">
                        {filteredGames.map((g) => (
                          <div
                            key={g.matchId}
                            onClick={() => onOpenMatchBoxScore && onOpenMatchBoxScore(g.matchId)}
                            className={`p-3.5 space-y-1.5 ${
                              onOpenMatchBoxScore ? 'hover:bg-orange-500/5 cursor-pointer' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 text-[9px] font-black uppercase px-1.5 py-0">
                                    {g.sport}
                                  </Badge>
                                  {g.isMatchMvp && (
                                    <Badge className="bg-red-500 text-white text-[8px] font-black uppercase px-1.5 py-0">
                                      MVP
                                    </Badge>
                                  )}
                                </div>
                                <p className="font-black text-xs text-slate-900 dark:text-white uppercase mt-1 break-words">
                                  {g.myTeamName} vs {g.opponentTeamName}
                                </p>
                                <p className="text-[10px] font-bold text-slate-400 truncate">
                                  {g.tournamentName} ({g.round})
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="font-black text-base tabular-nums text-orange-500 block leading-none">
                                  {g.playerPoints}
                                </span>
                                <span className="text-[9px] font-bold uppercase text-slate-400">
                                  {getSportScoringProfile(g.sport).pointUnit}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-2 pt-1">
                              <Badge
                                className={
                                  g.result === 'W'
                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-black text-[10px]'
                                    : g.result === 'L'
                                    ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 font-black text-[10px]'
                                    : 'bg-amber-500/15 text-amber-600 font-black text-[10px]'
                                }
                              >
                                {g.result} ({g.myTeamScore}-{g.opponentTeamScore})
                              </Badge>
                              <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 truncate">
                                {formatGameActionSummary(g)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop Table */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-slate-100 dark:border-white/5 text-[9px] font-black uppercase tracking-widest text-slate-400">
                            <tr>
                              <th className="py-2.5 px-4">Matchup &amp; Event</th>
                              <th className="py-2.5 px-2 text-center">Sport</th>
                              <th className="py-2.5 px-2 text-center">Result</th>
                              <th className="py-2.5 px-2 text-center">Action Breakdown</th>
                              <th className="py-2.5 px-4 text-right">Score</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {filteredGames.map((g) => (
                              <tr
                                key={g.matchId}
                                onClick={() => onOpenMatchBoxScore && onOpenMatchBoxScore(g.matchId)}
                                className={`transition-colors ${
                                  onOpenMatchBoxScore ? 'hover:bg-orange-500/5 cursor-pointer' : ''
                                }`}
                              >
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <span className="font-black text-slate-900 dark:text-white uppercase">
                                      {g.myTeamName} vs {g.opponentTeamName}
                                    </span>
                                    {g.isMatchMvp && (
                                      <Badge className="bg-red-500 text-white text-[8px] font-black uppercase px-1.5 py-0">
                                        MVP
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-[10px] font-bold text-slate-400 flex items-center gap-2 mt-0.5">
                                    <span>{g.tournamentName} ({g.round})</span>
                                    {g.matchTime && (
                                      <span className="inline-flex items-center gap-0.5">
                                        <Calendar className="size-2.5" />
                                        {new Date(g.matchTime).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-2 text-center">
                                  <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 text-[9px] font-black uppercase">
                                    {g.sport}
                                  </Badge>
                                </td>
                                <td className="py-3 px-2 text-center">
                                  <Badge
                                    className={
                                      g.result === 'W'
                                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-black text-[10px]'
                                        : g.result === 'L'
                                        ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 font-black text-[10px]'
                                        : 'bg-amber-500/15 text-amber-600 font-black text-[10px]'
                                    }
                                  >
                                    {g.result} ({g.myTeamScore}-{g.opponentTeamScore})
                                  </Badge>
                                </td>
                                <td className="py-3 px-2 text-center font-mono font-bold text-slate-600 dark:text-slate-300">
                                  {formatGameActionSummary(g)}
                                </td>
                                <td className="py-3 px-4 text-right font-black text-sm tabular-nums text-orange-500">
                                  {g.playerPoints}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      </DialogContent>
    </Dialog>
  );
};
