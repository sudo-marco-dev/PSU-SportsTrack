import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Flame, Trophy, Award } from 'lucide-react';

export interface MvpCandidateOption {
  playerId: string;
  name: string;
  jerseyNumber?: number | string | null;
  position?: string | null;
  teamId: string;
  teamName: string;
  isWinningTeam: boolean;
  points: number;
  isTopScorer: boolean;
  isStarter?: boolean;
  collegeId?: string | null;
}

interface MvpCandidateSelectProps {
  candidates: MvpCandidateOption[];
  selectedPlayerId: string;
  onSelectPlayer: (playerId: string) => void;
  disabled?: boolean;
}

export const MvpCandidateSelect: React.FC<MvpCandidateSelectProps> = ({
  candidates,
  selectedPlayerId,
  onSelectPlayer,
  disabled = false,
}) => {
  const selectedCandidate = candidates.find((c) => c.playerId === selectedPlayerId);

  // Group candidates: Winning Team first, then Opponent Team
  const winningTeamCandidates = candidates.filter((c) => c.isWinningTeam);
  const otherTeamCandidates = candidates.filter((c) => !c.isWinningTeam);

  return (
    <div className="w-full space-y-1.5">
      <Select value={selectedPlayerId} onValueChange={(val) => onSelectPlayer(val || '')} disabled={disabled}>
        <SelectTrigger 
          data-testid="mvp-candidate-trigger"
          className="w-full h-auto min-h-[3.75rem] py-2.5 px-3 sm:px-4 bg-slate-900 border-slate-700/80 text-white rounded-xl focus:ring-2 focus:ring-amber-500/30 transition-all text-left"
        >
          <SelectValue placeholder="Select candidate athlete...">
            {selectedCandidate ? (
              <div className="flex items-center justify-between w-full pr-2 text-left gap-2.5">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <span className="font-mono text-xs font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20 shrink-0 mt-0.5">
                    {selectedCandidate.jerseyNumber ? `#${selectedCandidate.jerseyNumber}` : '—'}
                  </span>
                  <div className="min-w-0 flex-1 text-left">
                    <span className="font-black text-xs sm:text-sm text-slate-100 block break-words leading-snug">
                      {selectedCandidate.name}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-slate-400 block leading-tight mt-0.5 break-words">
                      {selectedCandidate.teamName} {selectedCandidate.position ? `• ${selectedCandidate.position}` : ''}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 shrink-0">
                  {selectedCandidate.isTopScorer && (
                    <Badge className="bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[9px] font-black uppercase tracking-wider gap-0.5 px-1.5 py-0.5 whitespace-nowrap">
                      <Flame className="size-2.5 text-orange-400 shrink-0" />
                      <span>High Scorer</span>
                    </Badge>
                  )}
                  <Badge className="bg-slate-800 text-slate-200 border-slate-700 text-[11px] font-mono font-bold whitespace-nowrap px-2 py-0.5">
                    {selectedCandidate.points} PTS
                  </Badge>
                </div>
              </div>
            ) : (
              <span className="text-slate-400 text-xs sm:text-sm font-medium">Select match standout player...</span>
            )}
          </SelectValue>
        </SelectTrigger>

        <SelectContent 
          className="max-h-[60vh] sm:max-h-96 w-[var(--radix-select-trigger-width)] min-w-[310px] sm:min-w-[460px] max-w-[calc(100vw-1.5rem)] bg-slate-950 border-slate-800 text-slate-100 shadow-2xl rounded-2xl p-1.5 overflow-x-hidden"
        >
          {/* Winning Squad Section Header */}
          {winningTeamCandidates.length > 0 && (
            <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5 border-b border-slate-800 bg-slate-900/90 sticky top-0 z-10 rounded-t-xl backdrop-blur-sm">
              <Trophy className="size-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">{winningTeamCandidates[0]?.teamName || 'Team'} • Winning Squad</span>
            </div>
          )}
          {winningTeamCandidates.map((c) => (
            <SelectItem 
              key={c.playerId} 
              value={c.playerId}
              className="py-2.5 px-3 focus:bg-slate-800/90 focus:text-white cursor-pointer rounded-xl my-0.5 transition-colors"
            >
              <div className="flex items-center justify-between w-full gap-2.5 text-left">
                {/* Left Column: Jersey, Name, and Squad Details */}
                <div className="flex items-start gap-2.5 min-w-0 flex-1 text-left">
                  <span className="font-mono text-xs font-bold text-amber-400/90 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20 shrink-0 mt-0.5">
                    {c.jerseyNumber ? `#${c.jerseyNumber}` : '—'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-100 text-xs sm:text-sm break-words leading-tight">
                      {c.name}
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 leading-tight mt-0.5 break-words">
                      {c.position || 'Player'}
                    </p>
                  </div>
                </div>

                {/* Right Column: High Scorer & Points Badges */}
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 shrink-0">
                  {c.isTopScorer && (
                    <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 text-[9px] font-black uppercase tracking-wider flex items-center gap-0.5 border border-orange-500/30 whitespace-nowrap">
                      <Flame className="size-2.5 text-orange-400 shrink-0" />
                      <span>High Scorer</span>
                    </span>
                  )}
                  <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 whitespace-nowrap">
                    {c.points} PTS
                  </span>
                </div>
              </div>
            </SelectItem>
          ))}

          {/* Opponent Squad Section Header */}
          {otherTeamCandidates.length > 0 && (
            <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 border-t border-b border-slate-800 bg-slate-900/90 sticky top-0 z-10 mt-2 backdrop-blur-sm">
              <Award className="size-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{otherTeamCandidates[0]?.teamName || 'Opposing Squad'}</span>
            </div>
          )}
          {otherTeamCandidates.map((c) => (
            <SelectItem 
              key={c.playerId} 
              value={c.playerId}
              className="py-2.5 px-3 focus:bg-slate-800/90 focus:text-white cursor-pointer rounded-xl my-0.5 transition-colors"
            >
              <div className="flex items-center justify-between w-full gap-2.5 text-left">
                {/* Left Column: Jersey, Name, and Squad Details */}
                <div className="flex items-start gap-2.5 min-w-0 flex-1 text-left">
                  <span className="font-mono text-xs font-bold text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700 shrink-0 mt-0.5">
                    {c.jerseyNumber ? `#${c.jerseyNumber}` : '—'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-200 text-xs sm:text-sm break-words leading-tight">
                      {c.name}
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-slate-500 leading-tight mt-0.5 break-words">
                      {c.position || 'Player'}
                    </p>
                  </div>
                </div>

                {/* Right Column: High Scorer & Points Badges */}
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 shrink-0">
                  {c.isTopScorer && (
                    <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 text-[9px] font-black uppercase tracking-wider flex items-center gap-0.5 border border-orange-500/30 whitespace-nowrap">
                      <Flame className="size-2.5 text-orange-400 shrink-0" />
                      <span>High Scorer</span>
                    </span>
                  )}
                  <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 whitespace-nowrap">
                    {c.points} PTS
                  </span>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
