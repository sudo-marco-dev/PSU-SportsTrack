import React, { useMemo } from 'react';
import { Pause, AlertTriangle, Timer } from 'lucide-react';

interface StadiumGameClockProps {
  gameTimeSeconds: number;
  isClockRunning: boolean;
  currentPeriod: string;
  isClockEnabled: boolean;
  isTimeoutActive?: boolean;
}

export const StadiumGameClock: React.FC<StadiumGameClockProps> = ({
  gameTimeSeconds,
  isClockRunning,
  currentPeriod,
  isClockEnabled,
  isTimeoutActive = false,
}) => {
  const formattedTime = useMemo(() => {
    const mins = Math.floor(Math.max(0, gameTimeSeconds) / 60);
    const secs = Math.max(0, gameTimeSeconds) % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [gameTimeSeconds]);

  const isZero = gameTimeSeconds <= 0;

  if (!isClockEnabled) {
    return (
      <div className="flex flex-col items-center justify-center py-2 px-3 rounded-2xl bg-white/5 border border-white/10">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          MATCH PERIOD
        </span>
        <span className="text-sm font-black uppercase text-white mt-0.5">
          {currentPeriod}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-3xl border-2 transition-all duration-300 relative overflow-hidden shadow-2xl bg-slate-900/95 ${
        isTimeoutActive
          ? 'border-cyan-500/70 shadow-[0_0_40px_rgba(6,182,212,0.35)]'
          : isZero
          ? 'border-red-500/70 shadow-[0_0_40px_rgba(239,68,68,0.35)]'
          : isClockRunning
          ? 'border-emerald-500/60 shadow-[0_0_40px_rgba(16,185,129,0.25)]'
          : 'border-white/15'
      }`}
    >
      {/* Top Period Badge */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/10 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-orange-400">
          {currentPeriod}
        </span>
      </div>

      {/* Main Clock LED Readout */}
      <div className="relative my-0.5 flex items-center justify-center">
        <span
          className={`font-mono text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight tabular-nums transition-colors ${
            isZero
              ? 'text-red-400 animate-pulse'
              : isTimeoutActive
              ? 'text-cyan-300'
              : isClockRunning
              ? 'text-white drop-shadow-[0_0_20px_rgba(16,185,129,0.3)]'
              : 'text-slate-200'
          }`}
        >
          {formattedTime}
        </span>
      </div>

      {/* Status Pill Indicator */}
      <div className="mt-1 flex items-center gap-1.5">
        {isTimeoutActive ? (
          <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-cyan-400 bg-cyan-500/20 px-2 py-0.5 rounded-full border border-cyan-500/40 animate-pulse">
            <Timer className="size-2.5 sm:size-3" />
            <span>TIMEOUT</span>
          </span>
        ) : isZero ? (
          <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-red-400 bg-red-500/20 px-2 py-0.5 rounded-full border border-red-500/40 animate-pulse">
            <AlertTriangle className="size-2.5 sm:size-3" />
            <span>PERIOD OVER</span>
          </span>
        ) : isClockRunning ? (
          <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/40">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
            </span>
            <span>RUNNING</span>
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/40">
            <Pause className="size-2.5 sm:size-3" />
            <span>PAUSED</span>
          </span>
        )}
      </div>
    </div>
  );
};
