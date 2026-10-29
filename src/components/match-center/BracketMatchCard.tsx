import React, { useMemo } from 'react';
import { Crown } from 'lucide-react';
import { type Match, type TeamAffiliation, getAffiliationBadge } from './types';

interface BracketMatchCardProps {
  match: Match;
  isFinals?: boolean;
  isBronze?: boolean;
  searchQuery?: string;
  teamsMap?: Map<string, TeamAffiliation>;
  onNavigate: () => void;
}

export const BracketMatchCard: React.FC<BracketMatchCardProps> = ({
  match,
  isFinals = false,
  isBronze = false,
  searchQuery = '',
  teamsMap,
  onNavigate
}) => {
  const isTeamAWinner = match.status === 'Completed' && match.team_a_score > match.team_b_score;
  const isTeamBWinner = match.status === 'Completed' && match.team_b_score > match.team_a_score;

  const affA = getAffiliationBadge(match.team_a_id, match.team_a?.name, teamsMap);
  const affB = getAffiliationBadge(match.team_b_id, match.team_b?.name, teamsMap);

  // Search query highlighting / dimming
  const isSearchMatch = useMemo(() => {
    if (!searchQuery.trim()) return false;
    const q = searchQuery.toLowerCase();
    const teamA = match.team_a?.name?.toLowerCase() || '';
    const teamB = match.team_b?.name?.toLowerCase() || '';
    const venue = match.venue?.toLowerCase() || '';
    return teamA.includes(q) || teamB.includes(q) || venue.includes(q);
  }, [searchQuery, match]);

  const isDimmed = searchQuery.trim() !== '' && !isSearchMatch;

  // Format scheduled time if available
  const matchTimeStr = useMemo(() => {
    if (!match.match_time) return null;
    try {
      const d = new Date(match.match_time);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch {
      return null;
    }
  }, [match.match_time]);

  return (
    <div
      onClick={onNavigate}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onNavigate();
        }
      }}
      className={`h-[96px] w-full rounded-xl sm:rounded-2xl border transition-all duration-200 p-2.5 sm:p-3 cursor-pointer select-none relative group flex flex-col justify-between active:scale-[0.99] ${
        isSearchMatch
          ? 'ring-2 ring-orange-500 shadow-xl shadow-orange-500/20 scale-[1.02] bg-slate-900 border-orange-500 z-10'
          : isDimmed
          ? 'opacity-30 grayscale'
          : isFinals
          ? 'bg-slate-900/95 border-amber-500/50 shadow-xl shadow-amber-500/10 hover:border-amber-400 hover:shadow-amber-500/20'
          : isBronze
          ? 'bg-slate-900/95 border-amber-900/40 shadow-md shadow-black/40 hover:border-amber-700/50'
          : 'bg-slate-900/95 border-white/10 hover:border-orange-500/50 hover:bg-slate-800/90 shadow-md'
      }`}
    >
      {/* Sleek status bar: Live pulse, Final status, or scheduled time */}
      <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-400">
        <span className="text-slate-400 text-[9px] tracking-widest font-bold">
          {match.status === 'Ongoing' ? (
            <span className="text-rose-400 font-black flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-rose-400 animate-ping" />
              LIVE
            </span>
          ) : match.status === 'Completed' ? (
            <span className="text-emerald-400 font-bold">FINAL</span>
          ) : (
            <span className="text-slate-400 font-semibold">{matchTimeStr || 'UPCOMING'}</span>
          )}
        </span>

        {/* Discreet details affordance on hover */}
        <span className="text-[9px] font-semibold text-slate-500 group-hover:text-orange-400 transition-colors opacity-0 group-hover:opacity-100 hidden sm:inline-block">
          Tap for room →
        </span>
      </div>

      {/* Team A Slot */}
      <div
        className={`flex items-center justify-between py-1 px-2 rounded-lg transition-colors ${
          isTeamAWinner
            ? 'bg-amber-500/20 text-white font-black border border-amber-500/30'
            : 'bg-white/5 text-slate-300'
        }`}
      >
        <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-2">
          {isTeamAWinner && <Crown className="size-3 text-yellow-400 shrink-0" />}
          <span className="text-[11px] sm:text-xs uppercase italic font-black line-clamp-1 break-words pr-1.5">
            {match.team_a?.name || 'TBD'}
          </span>
          {affA && (
            <span
              className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 shrink-0"
              title={affA.fullName}
            >
              {affA.badge}
            </span>
          )}
        </div>
        <span
          className={`text-xs sm:text-sm font-black tabular-nums shrink-0 ${
            isTeamAWinner ? 'text-amber-400' : 'text-slate-400'
          }`}
        >
          {match.team_a_score || 0}
        </span>
      </div>

      {/* Team B Slot */}
      <div
        className={`flex items-center justify-between py-1 px-2 rounded-lg transition-colors ${
          isTeamBWinner
            ? 'bg-amber-500/20 text-white font-black border border-amber-500/30'
            : 'bg-white/5 text-slate-300'
        }`}
      >
        <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-2">
          {isTeamBWinner && <Crown className="size-3 text-yellow-400 shrink-0" />}
          <span className="text-[11px] sm:text-xs uppercase italic font-black line-clamp-1 break-words pr-1.5">
            {match.team_b?.name || 'TBD'}
          </span>
          {affB && (
            <span
              className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 shrink-0"
              title={affB.fullName}
            >
              {affB.badge}
            </span>
          )}
        </div>
        <span
          className={`text-xs sm:text-sm font-black tabular-nums shrink-0 ${
            isTeamBWinner ? 'text-amber-400' : 'text-slate-400'
          }`}
        >
          {match.team_b_score || 0}
        </span>
      </div>
    </div>
  );
};

// Placeholder Card when slot is awaiting match progression
export const EmptyMatchCard: React.FC<{ label: string; isFinals?: boolean }> = ({
  label,
  isFinals = false
}) => {
  return (
    <div
      className={`h-[96px] w-full rounded-xl sm:rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-3 text-center select-none ${
        isFinals ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/10 bg-white/[0.02]'
      }`}
    >
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
        {label}
      </span>
      <span className="text-[9px] text-slate-600 mt-1">Awaiting Match Progression</span>
    </div>
  );
};
