import React from 'react';
import { Medal } from 'lucide-react';
import type { Match, TeamAffiliation } from './types';
import { BracketMatchCard } from './BracketMatchCard';

interface BronzeMatchCardProps {
  matches: Match[];
  searchQuery?: string;
  teamsMap?: Map<string, TeamAffiliation>;
  onNavigateMatch: (id: string) => void;
}

export const BronzeMatchCard: React.FC<BronzeMatchCardProps> = ({
  matches,
  searchQuery = '',
  teamsMap,
  onNavigateMatch
}) => {
  if (!matches || matches.length === 0) return null;

  return (
    <div className="mt-8 pt-6 border-t border-white/10">
      <div className="max-w-md mx-auto rounded-xl sm:rounded-2xl border border-white/5 bg-slate-900/40 p-3.5 sm:p-4 backdrop-blur-sm">
        {/* Understated, non-competing header */}
        <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-lg bg-amber-900/20 text-amber-500/80 flex items-center justify-center border border-amber-800/30">
              <Medal className="size-3.5" />
            </div>
            <div className="flex items-center gap-1.5">
              <h4 className="font-bold uppercase tracking-wider text-xs text-slate-300">
                3rd Place Playoff
              </h4>
              <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest hidden sm:inline">
                • Bronze Medal
              </span>
            </div>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
            Consolation
          </span>
        </div>

        {/* Compact Match Card */}
        <div className="space-y-2">
          {matches.map((match) => (
            <BracketMatchCard
              key={match.id}
              match={match}
              isBronze
              searchQuery={searchQuery}
              teamsMap={teamsMap}
              onNavigate={() => onNavigateMatch(match.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
