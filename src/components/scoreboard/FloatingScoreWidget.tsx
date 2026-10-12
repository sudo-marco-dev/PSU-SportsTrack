import { useState, createElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSportIcon } from '@/lib/sportIcons';
import {
  ChevronUp,
  X,
  Maximize2,
  Tv,
  PictureInPicture2
} from 'lucide-react';

type FloatingScoreWidgetProps = {
  sport?: string | null;
  round: string;
  status: string;
  teamAName: string;
  teamBName: string;
  teamAScore: number;
  teamBScore: number;
  pointUnit: string;
  matchId: string;
  isPipActive?: boolean;
  onTogglePip?: () => void;
};

export const FloatingScoreWidget = ({
  sport,
  round,
  status,
  teamAName,
  teamBName,
  teamAScore,
  teamBScore,
  pointUnit,
  matchId,
  isPipActive,
  onTogglePip,
}: FloatingScoreWidgetProps) => {
  const navigate = useNavigate();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (isDismissed) return null;

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openFocusView = () => {
    navigate(`/match/${matchId}/display`);
  };

  return (
    <div className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:w-[420px] z-50 animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-slate-950/95 backdrop-blur-md border-2 border-orange-500/40 rounded-2xl shadow-2xl p-3 text-white">
        {/* Top Mini Header */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-[10px] font-black uppercase tracking-wider text-slate-400">
          <div className="flex items-center gap-2">
            <span className="p-0.5 rounded bg-orange-500 text-slate-950">
              {createElement(getSportIcon(sport), { className: 'size-3' })}
            </span>
            <span className="text-orange-400 truncate max-w-[150px]">
              {sport || 'Match'} • {round}
            </span>
            <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
              <span className="size-1.5 rounded-full bg-red-500 animate-ping" />
              {status === 'Ongoing' ? 'LIVE' : status}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={scrollToTop}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Scroll to Scoreboard"
            >
              <ChevronUp className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title={isCollapsed ? 'Expand Widget' : 'Collapse Widget'}
            >
              {isCollapsed ? <Tv className="size-3.5" /> : <ChevronUp className="size-3.5 rotate-180" />}
            </button>
            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
              title="Dismiss Floating Scoreboard"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Score Row */}
        {!isCollapsed && (
          <div className="flex items-center justify-between gap-3 px-1 py-0.5">
            {/* Team A */}
            <div className="flex-1 text-center min-w-0">
              <span className="text-xs font-black uppercase tracking-tight text-slate-300 truncate block">
                {teamAName}
              </span>
              <div className="text-2xl sm:text-3xl font-black tabular-nums text-white leading-none mt-1">
                {teamAScore}
              </div>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                {pointUnit}
              </span>
            </div>

            {/* VS Pillar */}
            <div className="flex flex-col items-center justify-center shrink-0 px-1">
              <span className="text-[10px] font-black italic text-orange-500 bg-white/5 size-6 rounded-full flex items-center justify-center border border-white/10">
                VS
              </span>
            </div>

            {/* Team B */}
            <div className="flex-1 text-center min-w-0">
              <span className="text-xs font-black uppercase tracking-tight text-slate-300 truncate block">
                {teamBName}
              </span>
              <div className="text-2xl sm:text-3xl font-black tabular-nums text-white leading-none mt-1">
                {teamBScore}
              </div>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                {pointUnit}
              </span>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between gap-2">
          {onTogglePip && (
            <button
              type="button"
              onClick={onTogglePip}
              className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                isPipActive
                  ? 'bg-orange-500 text-slate-950 shadow-md font-black'
                  : 'bg-white/5 hover:bg-white/10 text-orange-400 border border-white/10'
              }`}
              title="Pop out into floating Picture-in-Picture window outside browser"
            >
              <PictureInPicture2 className="size-3" />
              <span>{isPipActive ? 'PiP Floating' : 'Float Outside'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={openFocusView}
            className="flex-1 py-1.5 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            title="Open distraction-free live Focus View in a new tab"
          >
            <Maximize2 className="size-3 text-orange-400" />
            <span>Focus View</span>
          </button>
        </div>
      </div>
    </div>
  );
};
