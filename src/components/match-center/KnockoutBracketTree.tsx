import React from 'react';
import { Trophy, Crown, ArrowRight } from 'lucide-react';
import type { Match, TeamAffiliation } from './types';
import { BracketMatchCard, EmptyMatchCard } from './BracketMatchCard';
import { BracketFork } from './BracketConnectors';
import { BronzeMatchCard } from './BronzeMatchCard';

interface KnockoutBracketTreeProps {
  playoffs: {
    quarters: Match[];
    semis: Match[];
    finals: Match[];
    bronze: Match[];
  };
  searchQuery?: string;
  mobileStage: 'all' | 'quarters' | 'semis' | 'finals';
  setMobileStage: (stage: 'all' | 'quarters' | 'semis' | 'finals') => void;
  teamsMap?: Map<string, TeamAffiliation>;
  onNavigateMatch: (id: string) => void;
}

export const KnockoutBracketTree: React.FC<KnockoutBracketTreeProps> = ({
  playoffs,
  searchQuery = '',
  mobileStage,
  setMobileStage,
  teamsMap,
  onNavigateMatch
}) => {
  const { quarters, semis, finals, bronze } = playoffs;

  return (
    <div className="bg-slate-950 text-white border border-white/10 rounded-2xl md:rounded-[2.5rem] p-4 sm:p-6 md:p-8 shadow-2xl relative overflow-hidden">
      {/* Arena Title & Mode Badge */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-5">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 sm:size-5 text-orange-500" />
          <h3 className="font-black italic uppercase tracking-tight text-base sm:text-lg text-white">
            Knockout Bracket Arena
          </h3>
        </div>
        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/5 hidden sm:inline-block">
          Single Elimination Tree Format
        </span>
      </div>

      {/* Mobile Round Filter Pills */}
      <div className="md:hidden space-y-2 mb-4">
        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">
          <span>Round Filter</span>
          <span className="text-orange-500">Tap round or swipe bracket below</span>
        </div>
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-xl border border-white/10 overflow-x-auto scrollbar-hide">
          <button
            type="button"
            onClick={() => setMobileStage('all')}
            className={`flex-1 py-1.5 px-2.5 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
              mobileStage === 'all' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            All Rounds
          </button>
          {quarters.length > 0 && (
            <button
              type="button"
              onClick={() => setMobileStage('quarters')}
              className={`flex-1 py-1.5 px-2.5 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                mobileStage === 'quarters' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Quarters ({quarters.length})
            </button>
          )}
          {semis.length > 0 && (
            <button
              type="button"
              onClick={() => setMobileStage('semis')}
              className={`flex-1 py-1.5 px-2.5 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                mobileStage === 'semis' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Semis ({semis.length})
            </button>
          )}
          {finals.length > 0 && (
            <button
              type="button"
              onClick={() => setMobileStage('finals')}
              className={`flex-1 py-1.5 px-2.5 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer inline-flex items-center justify-center gap-1 ${
                mobileStage === 'finals' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Finals</span>
              <Crown className="size-3 text-yellow-400" />
            </button>
          )}
        </div>
      </div>

      {/* Mobile horizontal swipe indicator */}
      <div className="md:hidden flex items-center justify-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-4">
        <ArrowRight className="size-3 text-orange-500 animate-pulse" />
        <span>Swipe horizontally to view entire bracket tree</span>
      </div>

      {/* TREE BRACKET RENDERER */}
      <div className="overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-white/10">
        {/* Case 1: Full 8-Team Bracket (Quarters, Semis, Finals) */}
        {quarters.length >= 4 ? (
          <div className="flex items-start justify-between min-w-[840px] py-2 select-none">
            {/* Column 1: Quarterfinals */}
            {(mobileStage === 'all' || mobileStage === 'quarters') && (
              <div className="w-[270px] shrink-0">
                <div className="text-center font-black uppercase italic tracking-widest text-[11px] text-orange-500 pb-2.5 mb-3 border-b border-white/10 flex items-center justify-center gap-1.5">
                  <span>Quarter-Finals</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-orange-500/20 text-orange-400">4</span>
                </div>

                <div className="flex flex-col gap-6" style={{ height: '440px' }}>
                  {/* Pair 1 */}
                  <div className="flex flex-col gap-4">
                    <BracketMatchCard
                      match={quarters[0]}
                      searchQuery={searchQuery}
                      teamsMap={teamsMap}
                      onNavigate={() => onNavigateMatch(quarters[0].id)}
                    />
                    <BracketMatchCard
                      match={quarters[1]}
                      searchQuery={searchQuery}
                      teamsMap={teamsMap}
                      onNavigate={() => onNavigateMatch(quarters[1].id)}
                    />
                  </div>
                  {/* Pair 2 */}
                  <div className="flex flex-col gap-4">
                    <BracketMatchCard
                      match={quarters[2]}
                      searchQuery={searchQuery}
                      teamsMap={teamsMap}
                      onNavigate={() => onNavigateMatch(quarters[2].id)}
                    />
                    <BracketMatchCard
                      match={quarters[3]}
                      searchQuery={searchQuery}
                      teamsMap={teamsMap}
                      onNavigate={() => onNavigateMatch(quarters[3].id)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Connector Fork: Quarters to Semis */}
            {mobileStage === 'all' && (
              <div className="w-12 shrink-0 flex flex-col justify-between pt-[41px]" style={{ height: '481px' }}>
                {/* Fork for Pair 1 */}
                <BracketFork height={208} topY={48} bottomY={160} centerY={104} />
                {/* Fork for Pair 2 */}
                <BracketFork height={208} topY={48} bottomY={160} centerY={104} />
              </div>
            )}

            {/* Column 2: Semifinals */}
            {(mobileStage === 'all' || mobileStage === 'semis') && (
              <div className="w-[270px] shrink-0">
                <div className="text-center font-black uppercase italic tracking-widest text-[11px] text-orange-500 pb-2.5 mb-3 border-b border-white/10 flex items-center justify-center gap-1.5">
                  <span>Semi-Finals</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-orange-500/20 text-orange-400">2</span>
                </div>

                <div className="flex flex-col justify-between" style={{ height: '440px' }}>
                  <div style={{ paddingTop: '56px' }}>
                    {semis[0] ? (
                      <BracketMatchCard
                        match={semis[0]}
                        searchQuery={searchQuery}
                        teamsMap={teamsMap}
                        onNavigate={() => onNavigateMatch(semis[0].id)}
                      />
                    ) : (
                      <EmptyMatchCard label="Semi-Final 1" />
                    )}
                  </div>
                  <div style={{ paddingBottom: '56px' }}>
                    {semis[1] ? (
                      <BracketMatchCard
                        match={semis[1]}
                        searchQuery={searchQuery}
                        teamsMap={teamsMap}
                        onNavigate={() => onNavigateMatch(semis[1].id)}
                      />
                    ) : (
                      <EmptyMatchCard label="Semi-Final 2" />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Connector Fork: Semis to Finals */}
            {mobileStage === 'all' && (
              <div className="w-12 shrink-0 flex flex-col justify-center pt-[41px]" style={{ height: '481px' }}>
                <BracketFork height={440} topY={104} bottomY={336} centerY={220} />
              </div>
            )}

            {/* Column 3: Championship Final */}
            {(mobileStage === 'all' || mobileStage === 'finals') && (
              <div className="w-[270px] shrink-0">
                <div className="text-center font-black uppercase italic tracking-widest text-[11px] text-yellow-400 pb-2.5 mb-3 border-b border-yellow-400/30 flex items-center justify-center gap-1.5">
                  <Crown className="size-3.5 text-yellow-400" />
                  <span>Championship Final</span>
                </div>

                <div className="flex flex-col justify-center" style={{ height: '440px' }}>
                  {finals[0] ? (
                    <BracketMatchCard
                      match={finals[0]}
                      isFinals
                      searchQuery={searchQuery}
                      teamsMap={teamsMap}
                      onNavigate={() => onNavigateMatch(finals[0].id)}
                    />
                  ) : (
                    <EmptyMatchCard label="Championship Final" isFinals />
                  )}
                </div>
              </div>
            )}
          </div>
        ) : semis.length >= 2 || (semis.length > 0 && finals.length > 0) ? (
          /* Case 2: 4-Team Bracket (Semis and Finals only) */
          <div className="flex items-start justify-center gap-4 sm:gap-8 min-w-[580px] py-2 select-none">
            {/* Column 1: Semifinals */}
            {(mobileStage === 'all' || mobileStage === 'semis') && (
              <div className="w-[270px] shrink-0">
                <div className="text-center font-black uppercase italic tracking-widest text-[11px] text-orange-500 pb-2.5 mb-3 border-b border-white/10">
                  Semi-Finals
                </div>
                <div className="flex flex-col gap-4" style={{ height: '208px' }}>
                  {semis[0] ? (
                    <BracketMatchCard
                      match={semis[0]}
                      searchQuery={searchQuery}
                      teamsMap={teamsMap}
                      onNavigate={() => onNavigateMatch(semis[0].id)}
                    />
                  ) : (
                    <EmptyMatchCard label="Semi-Final 1" />
                  )}
                  {semis[1] ? (
                    <BracketMatchCard
                      match={semis[1]}
                      searchQuery={searchQuery}
                      teamsMap={teamsMap}
                      onNavigate={() => onNavigateMatch(semis[1].id)}
                    />
                  ) : (
                    <EmptyMatchCard label="Semi-Final 2" />
                  )}
                </div>
              </div>
            )}

            {/* Connector Fork: Semis to Finals */}
            {mobileStage === 'all' && (
              <div className="w-12 shrink-0 flex flex-col justify-center pt-[38px]" style={{ height: '246px' }}>
                <BracketFork height={208} topY={48} bottomY={160} centerY={104} />
              </div>
            )}

            {/* Column 2: Finals */}
            {(mobileStage === 'all' || mobileStage === 'finals') && (
              <div className="w-[270px] shrink-0">
                <div className="text-center font-black uppercase italic tracking-widest text-[11px] text-yellow-400 pb-2.5 mb-3 border-b border-yellow-400/30 flex items-center justify-center gap-1.5">
                  <Crown className="size-3.5 text-yellow-400" />
                  <span>Championship Final</span>
                </div>
                <div className="flex flex-col justify-center" style={{ height: '208px' }}>
                  {finals[0] ? (
                    <BracketMatchCard
                      match={finals[0]}
                      isFinals
                      searchQuery={searchQuery}
                      teamsMap={teamsMap}
                      onNavigate={() => onNavigateMatch(finals[0].id)}
                    />
                  ) : (
                    <EmptyMatchCard label="Championship Final" isFinals />
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Case 3: Finals only or fallback */
          <div className="flex flex-col items-center justify-center max-w-sm mx-auto py-4">
            <div className="text-center font-black uppercase italic tracking-widest text-[11px] text-yellow-400 pb-2.5 mb-3 border-b border-yellow-400/30 flex items-center justify-center gap-1.5 w-full">
              <Crown className="size-3.5 text-yellow-400" />
              <span>Championship Final</span>
            </div>
            {finals[0] ? (
              <BracketMatchCard
                match={finals[0]}
                isFinals
                searchQuery={searchQuery}
                teamsMap={teamsMap}
                onNavigate={() => onNavigateMatch(finals[0].id)}
              />
            ) : (
              <EmptyMatchCard label="Championship Final" isFinals />
            )}
          </div>
        )}
      </div>

      {/* DEDICATED UNDERSTATED 3RD PLACE / BRONZE MEDAL SECTION */}
      {bronze.length > 0 && (
        <BronzeMatchCard
          matches={bronze}
          searchQuery={searchQuery}
          teamsMap={teamsMap}
          onNavigateMatch={onNavigateMatch}
        />
      )}
    </div>
  );
};
