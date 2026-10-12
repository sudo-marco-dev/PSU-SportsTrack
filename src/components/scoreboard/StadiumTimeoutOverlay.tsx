import React from 'react';
import { Timer, X, ShieldAlert } from 'lucide-react';

interface StadiumTimeoutOverlayProps {
  active: boolean;
  team: 'a' | 'b' | null;
  teamName: string;
  secondsRemaining: number;
  initialSeconds?: number;
  onDismiss?: () => void;
}

export const StadiumTimeoutOverlay: React.FC<StadiumTimeoutOverlayProps> = ({
  active,
  team,
  teamName,
  secondsRemaining,
  initialSeconds = 60,
  onDismiss,
}) => {
  if (!active || secondsRemaining <= 0) return null;

  const pct = Math.max(0, Math.min(100, (secondsRemaining / initialSeconds) * 100));
  const isUrgent = secondsRemaining <= 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in zoom-in-95 duration-300">
      {/* Ambient Pulsating Glow */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ${
          isUrgent ? 'bg-red-500/10 animate-pulse' : 'bg-cyan-500/10'
        }`}
      />

      <div className="relative w-full max-w-xl bg-slate-900/95 border-2 border-cyan-500/50 rounded-3xl p-6 sm:p-10 shadow-[0_0_80px_rgba(6,182,212,0.35)] flex flex-col items-center text-center overflow-hidden">
        {/* Top Dismiss Button */}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="absolute top-4 right-4 size-9 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
            title="Dismiss Overlay"
          >
            <X className="size-4" />
          </button>
        )}

        {/* Top Header Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-xs sm:text-sm font-black uppercase tracking-[0.25em] mb-4 shadow-sm animate-pulse">
          <Timer className="size-4 text-cyan-400" />
          <span>OFFICIAL TIMEOUT</span>
        </div>

        {/* Team Banner */}
        <div className="mb-6">
          <span className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] text-slate-400 block mb-1">
            Called By
          </span>
          <h2 className="text-3xl sm:text-5xl font-black uppercase italic tracking-tight text-white drop-shadow-[0_2px_15px_rgba(6,182,212,0.4)]">
            {teamName}
          </h2>
          {team && (
            <span className="inline-block mt-1 text-[10px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-950/60 px-2.5 py-0.5 rounded-full border border-cyan-500/30">
              Team {team.toUpperCase()}
            </span>
          )}
        </div>

        {/* Giant Circular / Digital Countdown Readout */}
        <div className="relative size-44 sm:size-52 flex items-center justify-center my-2">
          {/* SVG Circular Progress Track */}
          <svg className="size-full -rotate-90" viewBox="0 0 160 160">
            <circle
              cx="80"
              cy="80"
              r="68"
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="10"
            />
            <circle
              cx="80"
              cy="80"
              r="68"
              fill="none"
              stroke={isUrgent ? '#ef4444' : '#06b6d4'}
              strokeWidth="10"
              strokeDasharray={427.26}
              strokeDashoffset={427.26 - (427.26 * pct) / 100}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-linear"
            />
          </svg>

          {/* Central Digits */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className={`font-mono text-5xl sm:text-6xl font-black tracking-tight tabular-nums ${
                isUrgent ? 'text-red-400 animate-pulse' : 'text-white'
              }`}
            >
              00:{String(secondsRemaining).padStart(2, '0')}
            </span>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-slate-400 mt-1">
              Time Remaining
            </span>
          </div>
        </div>

        {/* Auto-Paused Clock Indicator */}
        <div className="mt-6 flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
          <ShieldAlert className="size-4 text-amber-400 shrink-0" />
          <span>Game Clock auto-paused • Play suspended courtside</span>
        </div>
      </div>
    </div>
  );
};
