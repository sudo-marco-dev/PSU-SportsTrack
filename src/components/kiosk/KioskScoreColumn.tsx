import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Minus,
  Sparkles,
  ArrowLeftRight,
  ShieldAlert,
  Timer,
} from 'lucide-react';
import type { SportScoringAction } from '@/lib/sportScoringRules';
import type { FloatingDelta } from '@/lib/scoreboardAnimations';
import { FloatingDeltaBadge } from '@/components/scoreboard/FloatingDeltaBadge';
import type { RosterPlayerItem } from './KioskSubstitutionModal';

type KioskScoreColumnProps = {
  team: 'a' | 'b';
  teamName: string;
  score: number;
  pointUnit: string;
  actions: SportScoringAction[];
  onScore: (team: 'a' | 'b', points: number, actionType: string, description?: string) => void;
  onDeduct: (team: 'a' | 'b') => void;
  fouls: number;
  onAddFoul: (team: 'a' | 'b') => void;
  foulBonusThreshold?: number;
  timeoutsRemaining: number;
  totalTimeouts: number;
  onCallTimeout: (team: 'a' | 'b') => void;
  activePlayers: RosterPlayerItem[];
  onOpenSubModal: (team: 'a' | 'b') => void;
  isLeading?: boolean;
  isAuthorized?: boolean;
  deltas: FloatingDelta[];
  isPopping?: boolean;
  accentColor?: 'orange' | 'cyan';
  compact?: boolean;
};

export const KioskScoreColumn = ({
  team,
  teamName,
  score,
  pointUnit,
  actions,
  onScore,
  onDeduct,
  fouls,
  onAddFoul,
  foulBonusThreshold = 5,
  timeoutsRemaining,
  totalTimeouts,
  onCallTimeout,
  activePlayers,
  onOpenSubModal,
  isLeading = false,
  isAuthorized = true,
  deltas,
  isPopping = false,
  accentColor = 'orange',
  compact = false,
}: KioskScoreColumnProps) => {
  const isBonusActive = foulBonusThreshold > 0 && fouls >= foulBonusThreshold;

  const getPlayerName = (player: RosterPlayerItem) => {
    const users = player.users;
    return Array.isArray(users) ? users[0]?.full_name : users?.full_name || 'Player';
  };

  const getJersey = (player: RosterPlayerItem) => {
    if (player.jersey_number === null || player.jersey_number === undefined) return '#--';
    return `#${player.jersey_number}`;
  };

  const colorStyles =
    accentColor === 'cyan'
      ? {
          border: isLeading ? 'border-cyan-500/70 shadow-[0_0_35px_rgba(6,182,212,0.25)]' : 'border-white/10',
          bg: isLeading ? 'bg-slate-900/90' : 'bg-slate-900/60',
          badge: 'bg-cyan-500 text-slate-950',
          text: 'text-cyan-400',
          btnHover: 'hover:border-cyan-500/50 hover:bg-cyan-500/10 active:border-cyan-400',
        }
      : {
          border: isLeading ? 'border-orange-500/70 shadow-[0_0_35px_rgba(249,115,22,0.25)]' : 'border-white/10',
          bg: isLeading ? 'bg-slate-900/90' : 'bg-slate-900/60',
          badge: 'bg-orange-500 text-slate-950',
          text: 'text-orange-400',
          btnHover: 'hover:border-orange-500/50 hover:bg-orange-500/10 active:border-orange-400',
        };

  return (
    <div
      className={`flex flex-col justify-between ${
        compact ? 'p-2 sm:p-2.5 rounded-2xl' : 'p-4 sm:p-6 rounded-3xl'
      } border-2 transition-all duration-300 relative overflow-hidden ${colorStyles.bg} ${colorStyles.border} select-none h-full`}
    >
      {/* Column Header & Team Identity */}
      <div className={`flex items-center justify-between ${compact ? 'pb-1.5' : 'pb-3'} border-b border-white/10 gap-2 shrink-0`}>
        <div className="min-w-0">
          <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] ${colorStyles.text} block`}>
            TEAM {team.toUpperCase()}
          </span>
          <h2 className={`${compact ? 'text-sm sm:text-base md:text-lg' : 'text-xl sm:text-2xl md:text-3xl'} font-black uppercase italic tracking-tighter text-white truncate drop-shadow-sm`}>
            {teamName}
          </h2>
        </div>
        {isLeading && (
          <Badge className={`${colorStyles.badge} font-black ${compact ? 'text-[9px] px-1.5 py-0.2' : 'text-[10px] px-2.5 py-0.5'} uppercase tracking-wider shrink-0 shadow-md`}>
            <Sparkles className="size-2.5 sm:size-3 mr-1" /> Leading
          </Badge>
        )}
      </div>

      {/* Center Tabular Score Display */}
      <div className={`${compact ? 'my-0.5 sm:my-1' : 'my-3 sm:my-5'} flex flex-col items-center justify-center relative shrink-0`}>
        <FloatingDeltaBadge deltas={deltas} />
        <span
          className={`${
            compact ? 'text-3xl sm:text-4xl' : 'text-7xl sm:text-8xl md:text-9xl'
          } font-black tabular-nums tracking-tighter text-white leading-none block transition-transform ${
            isPopping ? 'animate-score-pop' : ''
          }`}
        >
          {score}
        </span>
        <span className={`${compact ? 'text-[8px]' : 'text-[11px] sm:text-xs'} font-black uppercase tracking-[0.2em] text-slate-400 block`}>
          {pointUnit}
        </span>
      </div>

      {/* Tactical Quick Action Deck: Giant Point Buttons */}
      <div className={`${compact ? 'space-y-1' : 'space-y-3'} shrink-0`}>
        <div
          className={`grid gap-1 sm:gap-2 ${
            actions.length <= 2
              ? 'grid-cols-2'
              : actions.length === 3
              ? 'grid-cols-3'
              : 'grid-cols-2 sm:grid-cols-4'
          }`}
        >
          {actions.map((act, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onScore(team, act.points, act.actionType, act.description)}
              className={`flex flex-col items-center justify-center ${
                compact
                  ? 'p-1 min-h-[40px] sm:min-h-[46px] rounded-lg'
                  : 'p-3 sm:p-4 min-h-[68px] sm:min-h-[76px] rounded-2xl'
              } bg-white/5 border border-white/10 active:scale-95 transition-all cursor-pointer ${
                !isAuthorized ? 'opacity-85 hover:opacity-100' : colorStyles.btnHover
              } shadow-sm`}
              title={!isAuthorized ? 'Click to log in and claim scoring console' : undefined}
            >
              <span className={`${compact ? 'text-lg sm:text-xl' : 'text-2xl sm:text-3xl'} font-black tracking-tight text-white leading-none`}>
                {act.label}
              </span>
              <span className={`${compact ? 'text-[7px] sm:text-[8px]' : 'text-[9px] sm:text-[10px]'} uppercase font-bold text-slate-300 mt-0.5 truncate max-w-full px-0.5`}>
                {act.sublabel}
              </span>
            </button>
          ))}
        </div>

        {/* Score Correction / Minus Button */}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            disabled={!isAuthorized || score <= 0}
            onClick={() => onDeduct(team)}
            className={`w-full ${
              compact ? 'h-5 sm:h-6 text-[9px] rounded-lg' : 'h-8 sm:h-9 text-xs rounded-xl'
            } font-bold border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 gap-1 transition-colors disabled:opacity-30`}
          >
            <Minus className="size-2.5" />
            <span>Score Correction / Deduct</span>
          </Button>
        </div>
      </div>

      {/* Courtside Metrics: Fouls, Timeouts & Roster Subs */}
      {compact ? (
        <div className="grid grid-cols-2 gap-1 mt-1 pt-1 border-t border-white/10 shrink-0">
          {/* Compact Team Fouls */}
          <div className="p-1 rounded-lg bg-slate-950/70 border border-white/10 flex items-center justify-between min-w-0">
            <div className="flex items-center gap-0.5 min-w-0">
              <ShieldAlert className="size-2.5 text-amber-400 shrink-0" />
              <span className="text-[9px] font-bold text-slate-400">F:</span>
              <strong className="text-white text-[11px] font-mono font-black">{fouls}</strong>
              {isBonusActive && (
                <span className="px-1 py-0.2 rounded bg-red-500 text-[7px] font-black text-slate-950">BONUS</span>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onAddFoul(team)}
              className="h-4.5 px-1 text-[8px] font-bold border-amber-500/40 text-amber-400 hover:bg-amber-500/10 rounded"
            >
              +1
            </Button>
          </div>

          {/* Compact Timeouts */}
          <div className="p-1 rounded-lg bg-slate-950/70 border border-white/10 flex items-center justify-between min-w-0">
            <div className="flex items-center gap-0.5 min-w-0">
              <Timer className="size-2.5 text-cyan-400 shrink-0" />
              <span className="text-[9px] font-bold text-slate-400">TO:</span>
              <strong className="text-white text-[11px] font-black">{timeoutsRemaining}</strong>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={timeoutsRemaining <= 0}
              onClick={() => onCallTimeout(team)}
              className="h-4.5 px-1 text-[8px] font-bold border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10 rounded disabled:opacity-30"
            >
              Call
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-4 pt-4 border-t border-white/10">
          {/* Team Fouls Card */}
          <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-950/60 border border-white/10 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <ShieldAlert className="size-3 text-amber-400" /> Fouls
              </span>
              {isBonusActive && (
                <span className="px-1.5 py-0.5 rounded bg-red-500 text-slate-950 font-black text-[9px] uppercase tracking-widest animate-pulse">
                  BONUS
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-2xl sm:text-3xl font-black font-mono text-white leading-none">
                {fouls}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onAddFoul(team)}
                className="h-7 px-2.5 text-xs font-bold border-amber-500/40 text-amber-400 hover:bg-amber-500/10 rounded-lg active:scale-95"
              >
                + Foul
              </Button>
            </div>
          </div>

          {/* Timeouts Card */}
          <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-950/60 border border-white/10 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Timer className="size-3 text-cyan-400" /> Timeouts
              </span>
              {/* Visual Light Pips */}
              <div className="flex items-center gap-1">
                {Array.from({ length: totalTimeouts || 3 }).map((_, pipIdx) => {
                  const isActive = pipIdx < timeoutsRemaining;
                  return (
                    <span
                      key={pipIdx}
                      className={`size-2 rounded-full transition-all ${
                        isActive ? 'bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]' : 'bg-slate-700'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">
                <strong className="text-white text-base sm:text-lg">{timeoutsRemaining}</strong> / {totalTimeouts || 3}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={timeoutsRemaining <= 0}
                onClick={() => onCallTimeout(team)}
                className="h-7 px-2 text-xs font-bold border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10 rounded-lg active:scale-95 disabled:opacity-30"
              >
                Call TO
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Active On-Court Roster & Substitution Bar */}
      {compact ? (
        <div className="mt-1.5 p-1.5 rounded-xl bg-slate-950/80 border border-white/10 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
            On-Court ({activePlayers.length})
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onOpenSubModal(team)}
            className="h-5 px-2 text-[10px] font-bold text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 gap-1 rounded"
          >
            <ArrowLeftRight className="size-2.5" />
            <span>Sub</span>
          </Button>
        </div>
      ) : (
        <div className="mt-3 p-3 rounded-2xl bg-slate-950/80 border border-white/10">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-300">
                Active On-Court ({activePlayers.length})
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onOpenSubModal(team)}
              className="h-6 px-2 text-[10px] font-bold text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 gap-1 rounded-md"
            >
              <ArrowLeftRight className="size-3" />
              <span>Sub Player</span>
            </Button>
          </div>

          {/* Horizontal Scrollable Active Player Badges */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {activePlayers.length === 0 ? (
              <span className="text-[11px] text-slate-500 italic py-1">No active players assigned</span>
            ) : (
              activePlayers.slice(0, 7).map((p) => (
                <span
                  key={p.id}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] font-bold text-slate-200 shrink-0"
                  title={getPlayerName(p)}
                >
                  <span className="font-mono text-orange-400 text-[10px]">{getJersey(p)}</span>
                  <span className="truncate max-w-[80px]">{getPlayerName(p)}</span>
                </span>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
