import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Calendar,
  MapPin,
  Loader2,
  ExternalLink,
  Activity,
  Zap,
} from 'lucide-react';
import {
  fetchMatchBoxScore,
  type MatchBoxScoreData,
  type BoxScorePlayerRow,
} from '@/lib/playerStatsEngine';

type MatchBoxScoreModalProps = {
  matchId: string | null;
  onClose: () => void;
  onSelectPlayer?: (playerId: string) => void;
};

export const MatchBoxScoreModal = ({
  matchId,
  onClose,
  onSelectPlayer,
}: MatchBoxScoreModalProps) => {
  const navigate = useNavigate();
  const [boxData, setBoxData] = useState<MatchBoxScoreData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!matchId) {
      setBoxData(null);
      return;
    }
    let mounted = true;
    setIsLoading(true);
    fetchMatchBoxScore(matchId)
      .then((res) => {
        if (mounted) setBoxData(res);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [matchId]);

  const sportLower = (boxData?.match.sport || 'basketball').toLowerCase();
  const isBasketball = sportLower.includes('basket');
  const isVolleyOrTakraw = sportLower.includes('volley') || sportLower.includes('takraw');
  const isSoccer = sportLower.includes('soccer') || sportLower.includes('football') || sportLower.includes('futsal');
  const isBaseball = sportLower.includes('baseball') || sportLower.includes('softball');

  const renderTeamTable = (teamName: string, score: number, isWinner: boolean, players: BoxScorePlayerRow[]) => (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] overflow-hidden">
      <div className="px-4 py-3 bg-slate-100/80 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-black italic uppercase tracking-tight text-sm sm:text-base text-slate-900 dark:text-white truncate">
            {teamName}
          </span>
          {isWinner && (
            <Badge className="bg-emerald-500 text-white text-[9px] font-black uppercase px-2 py-0 shrink-0">
              Winner
            </Badge>
          )}
        </div>
        <span className="font-black text-lg tabular-nums text-orange-500 shrink-0">{score}</span>
      </div>

      {players.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-400 font-bold uppercase tracking-wider">
          No individual player box score recorded for this squad.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200/70 dark:border-white/5 text-[9px] font-black uppercase tracking-widest text-slate-400">
              <tr>
                <th className="py-2.5 px-3">Athlete</th>
                {isBasketball && (
                  <>
                    <th className="py-2.5 px-2 text-center" title="3-Pointers Made">3PM</th>
                    <th className="py-2.5 px-2 text-center" title="2-Point Field Goals Made">2PM</th>
                    <th className="py-2.5 px-2 text-center" title="Free Throws Made">FTM</th>
                  </>
                )}
                {isVolleyOrTakraw && (
                  <>
                    <th className="py-2.5 px-2 text-center">Kills</th>
                    <th className="py-2.5 px-2 text-center">Aces</th>
                    <th className="py-2.5 px-2 text-center">BLK</th>
                  </>
                )}
                {isSoccer && (
                  <>
                    <th className="py-2.5 px-2 text-center">Goals</th>
                    <th className="py-2.5 px-2 text-center">Pen</th>
                  </>
                )}
                {isBaseball && (
                  <>
                    <th className="py-2.5 px-2 text-center">Runs</th>
                    <th className="py-2.5 px-2 text-center">HR</th>
                  </>
                )}
                <th className="py-2.5 px-3 text-right">PTS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {players.map((p, idx) => (
                <tr
                  key={p.playerId || idx}
                  className="hover:bg-orange-500/5 transition-colors"
                >
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {p.jerseyNumber && (
                        <span className="font-mono text-[10px] font-black text-orange-500 shrink-0">
                          #{p.jerseyNumber}
                        </span>
                      )}
                      {p.playerId && onSelectPlayer ? (
                        <button
                          type="button"
                          onClick={() => onSelectPlayer(p.playerId!)}
                          className="font-bold text-slate-900 dark:text-white hover:text-orange-500 underline-offset-2 hover:underline truncate text-left cursor-pointer"
                        >
                          {p.playerName}
                        </button>
                      ) : (
                        <span className="font-bold text-slate-900 dark:text-white truncate">
                          {p.playerName}
                        </span>
                      )}
                      {p.isStarter && (
                        <span title="Starter" className="text-emerald-500 shrink-0">
                          <Zap className="size-3 fill-emerald-500" />
                        </span>
                      )}
                      {p.isMvp && (
                        <Badge className="bg-red-500 text-white text-[8px] font-black uppercase px-1.5 py-0 gap-0.5 shrink-0">
                          <Star className="size-2.5 fill-white" /> MVP
                        </Badge>
                      )}
                    </div>
                  </td>
                  {isBasketball && (
                    <>
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-600 dark:text-slate-300">
                        {p.threePointers}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-600 dark:text-slate-300">
                        {p.twoPointers}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-600 dark:text-slate-300">
                        {p.freeThrows}
                      </td>
                    </>
                  )}
                  {isVolleyOrTakraw && (
                    <>
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-600 dark:text-slate-300">
                        {p.kills}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-600 dark:text-slate-300">
                        {p.aces}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-600 dark:text-slate-300">
                        {p.blocks}
                      </td>
                    </>
                  )}
                  {isSoccer && (
                    <>
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-600 dark:text-slate-300">
                        {p.goals}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-600 dark:text-slate-300">
                        {p.penalties}
                      </td>
                    </>
                  )}
                  {isBaseball && (
                    <>
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-600 dark:text-slate-300">
                        {p.runs}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-600 dark:text-slate-300">
                        {p.homeRuns}
                      </td>
                    </>
                  )}
                  <td className="py-2.5 px-3 text-right font-black tabular-nums text-slate-900 dark:text-white">
                    {p.totalPoints}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={!!matchId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full sm:max-w-4xl max-w-[96vw] max-h-[90dvh] overflow-hidden rounded-3xl p-5 sm:p-7 flex flex-col bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
        <DialogHeader className="shrink-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 font-black uppercase text-[10px]">
                {boxData?.match.sport || 'Official Match'}
              </Badge>
              <Badge variant="outline" className="text-[10px] font-bold uppercase">
                {boxData?.match.round || 'Match Box Score'}
              </Badge>
              {boxData?.match.status && (
                <Badge
                  className={
                    boxData.match.status === 'Completed'
                      ? 'bg-emerald-500 text-white text-[10px] font-black uppercase'
                      : 'bg-amber-500 text-white text-[10px] font-black uppercase'
                  }
                >
                  {boxData.match.status}
                </Badge>
              )}
            </div>
            {boxData?.match.id && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onClose();
                  navigate(`/match/${boxData.match.id}`);
                }}
                className="h-8 rounded-xl text-xs font-bold gap-1.5"
              >
                <span>Open Match Console</span>
                <ExternalLink className="size-3.5" />
              </Button>
            )}
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-black italic uppercase tracking-tight text-slate-900 dark:text-white mt-1">
            {boxData?.match.tournament_name || 'Match Box Score & Telemetry'}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {boxData?.match.match_time && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="size-3.5 text-orange-500" />
                {new Date(boxData.match.match_time).toLocaleString()}
              </span>
            )}
            {boxData?.match.venue && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5 text-orange-500" />
                {boxData.match.venue}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1 py-3 scrollbar-hide">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="size-8 text-orange-500 animate-spin" />
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Loading Official Box Score...
              </p>
            </div>
          ) : !boxData ? (
            <div className="text-center py-12 text-slate-400 font-bold uppercase text-xs">
              Match telemetry could not be loaded.
            </div>
          ) : (
            <>
              {/* Scoreboard Banner */}
              <div className="bg-slate-950 text-white rounded-2xl p-4 sm:p-5 border border-white/10 grid grid-cols-3 items-center gap-2 text-center shadow-lg">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs sm:text-base font-black uppercase italic truncate">
                    {boxData.match.team_a_name}
                  </p>
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Team A</p>
                </div>
                <div className="flex items-center justify-center gap-3 sm:gap-5">
                  <span className="text-3xl sm:text-5xl font-black tabular-nums text-orange-400">
                    {boxData.match.team_a_score}
                  </span>
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">FINAL</span>
                  <span className="text-3xl sm:text-5xl font-black tabular-nums text-cyan-400">
                    {boxData.match.team_b_score}
                  </span>
                </div>
                <div className="space-y-1 min-w-0">
                  <p className="text-xs sm:text-base font-black uppercase italic truncate">
                    {boxData.match.team_b_name}
                  </p>
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Team B</p>
                </div>
              </div>

              {/* Dual Box Score Tables */}
              <div className="grid gap-4 lg:grid-cols-2">
                {renderTeamTable(
                  boxData.match.team_a_name,
                  boxData.match.team_a_score,
                  boxData.match.winner_team_id === boxData.match.team_a_id ||
                    (boxData.match.status === 'Completed' &&
                      boxData.match.team_a_score > boxData.match.team_b_score),
                  boxData.teamABox
                )}
                {renderTeamTable(
                  boxData.match.team_b_name,
                  boxData.match.team_b_score,
                  boxData.match.winner_team_id === boxData.match.team_b_id ||
                    (boxData.match.status === 'Completed' &&
                      boxData.match.team_b_score > boxData.match.team_a_score),
                  boxData.teamBBox
                )}
              </div>

              {/* Play-by-Play Log */}
              {boxData.events.length > 0 && (
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4 space-y-2.5 bg-slate-50/40 dark:bg-white/[0.01]">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Activity className="size-3.5 text-orange-500" /> Official Play-by-Play Timeline ({boxData.events.length})
                  </h4>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {boxData.events.map((ev) => (
                      <div
                        key={ev.id}
                        className="text-xs py-1.5 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 flex items-center justify-between gap-3"
                      >
                        <span className="font-medium text-slate-700 dark:text-slate-300">{ev.description}</span>
                        {ev.created_at && (
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
