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
          className="w-full h-auto min-h-[3rem] py-2 px-3.5 bg-slate-900 border-slate-700/80 text-white rounded-xl focus:ring-2 focus:ring-amber-500/30"
        >
          <SelectValue placeholder="Select candidate athlete...">
            {selectedCandidate ? (
              <div className="flex items-center justify-between w-full pr-2 text-left gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                    {selectedCandidate.jerseyNumber ? `#${selectedCandidate.jerseyNumber}` : '—'}
                  </span>
                  <span className="font-bold text-sm text-slate-100 truncate">
                    {selectedCandidate.name}
                  </span>
                  <span className="text-xs text-slate-400 hidden sm:inline">
                    ({selectedCandidate.teamName})
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {selectedCandidate.isTopScorer && (
                    <Badge className="bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[10px] font-black uppercase tracking-wider gap-1">
                      <Flame className="size-3 text-orange-400" />
                      Top Scorer
                    </Badge>
                  )}
                  <Badge className="bg-slate-800 text-slate-200 border-slate-700 text-[11px] font-mono font-bold">
                    {selectedCandidate.points} PTS
                  </Badge>
                </div>
              </div>
            ) : (
              <span className="text-slate-400 text-sm font-medium">Select match standout player...</span>
            )}
          </SelectValue>
        </SelectTrigger>

        <SelectContent className="max-h-80 bg-slate-950 border-slate-800 text-slate-100 shadow-2xl rounded-xl">
          {/* Winning Squad Section */}
          {winningTeamCandidates.length > 0 && (
            <div className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5 border-b border-slate-800 bg-slate-900/60 sticky top-0 z-10">
              <Trophy className="size-3 text-emerald-400" />
              <span>{winningTeamCandidates[0]?.teamName || 'Team'} • Winning Squad</span>
            </div>
          )}
          {winningTeamCandidates.map((c) => (
            <SelectItem 
              key={c.playerId} 
              value={c.playerId}
              className="py-2.5 px-3 focus:bg-slate-800/80 cursor-pointer text-xs"
            >
              <div className="flex items-center justify-between w-full gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs font-bold text-amber-400/90 w-7">
                    {c.jerseyNumber ? `#${c.jerseyNumber}` : '—'}
                  </span>
                  <span className="font-bold text-slate-100 truncate">{c.name}</span>
                  {c.position && (
                    <span className="text-[10px] text-slate-400 hidden md:inline">
                      • {c.position}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {c.isTopScorer && (
                    <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 text-[9px] font-black uppercase tracking-wider flex items-center gap-0.5 border border-orange-500/30">
                      <Flame className="size-2.5 text-orange-400" /> High Scorer
                    </span>
                  )}
                  <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                    {c.points} PTS
                  </span>
                </div>
              </div>
            </SelectItem>
          ))}

          {/* Opponent Squad Section */}
          {otherTeamCandidates.length > 0 && (
            <div className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 border-t border-b border-slate-800 bg-slate-900/60 sticky top-0 z-10 mt-1">
              <Award className="size-3 text-slate-400" />
              <span>{otherTeamCandidates[0]?.teamName || 'Opposing Squad'}</span>
            </div>
          )}
          {otherTeamCandidates.map((c) => (
            <SelectItem 
              key={c.playerId} 
              value={c.playerId}
              className="py-2.5 px-3 focus:bg-slate-800/80 cursor-pointer text-xs"
            >
              <div className="flex items-center justify-between w-full gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs font-bold text-slate-400 w-7">
                    {c.jerseyNumber ? `#${c.jerseyNumber}` : '—'}
                  </span>
                  <span className="font-medium text-slate-200 truncate">{c.name}</span>
                  {c.position && (
                    <span className="text-[10px] text-slate-500 hidden md:inline">
                      • {c.position}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {c.isTopScorer && (
                    <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 text-[9px] font-black uppercase tracking-wider flex items-center gap-0.5 border border-orange-500/30">
                      <Flame className="size-2.5 text-orange-400" /> High Scorer
                    </span>
                  )}
                  <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
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
