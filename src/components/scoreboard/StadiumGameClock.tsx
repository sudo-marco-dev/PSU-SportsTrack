import React, { useMemo } from 'react';
import { Pause, AlertTriangle, Timer, CheckCircle2 } from 'lucide-react';

interface StadiumGameClockProps {
  gameTimeSeconds: number;
  isClockRunning: boolean;
  currentPeriod: string;
  isClockEnabled: boolean;
  isTimeoutActive?: boolean;
  isCompleted?: boolean;
}

export const StadiumGameClock: React.FC<StadiumGameClockProps> = ({
  gameTimeSeconds,
  isClockRunning,
  currentPeriod,
  isClockEnabled,
  isTimeoutActive = false,
  isCompleted = false,
}) => {
  const formattedTime = useMemo(() => {
    const mins = Math.floor(Math.max(0, gameTimeSeconds) / 60);
    const secs = Math.max(0, gameTimeSeconds) % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [gameTimeSeconds]);

  const isZero = gameTimeSeconds <= 0;

  if (isCompleted) {
    return (
      <div className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl border-2 border-amber-500 transition-colors duration-200 relative overflow-hidden bg-slate-900">
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-amber-400">
            OFFICIAL FINAL
          </span>
        </div>
        <div className="relative my-0.5 flex items-center justify-center">
          <span className="font-mono text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-amber-400">
            FINAL
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/50">
            <CheckCircle2 className="size-2.5 sm:size-3 text-emerald-400" />
            <span>CONCLUDED</span>
          </span>
        </div>
      </div>
    );
  }

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
      className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl border-2 transition-colors duration-200 relative overflow-hidden bg-slate-900 ${
        isTimeoutActive
          ? 'border-cyan-500'
          : isZero
          ? 'border-red-500'
          : isClockRunning
          ? 'border-emerald-500'
          : 'border-slate-800'
      }`}
    >
      {/* Top Period Badge */}
      <div className="flex items-center gap-2 mb-1">
        <span className="px-2.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-orange-400">
          {currentPeriod}
        </span>
      </div>

      {/* Main Clock LED Readout */}
      <div className="relative my-0.5 flex items-center justify-center">
        <span
          className={`font-mono text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight tabular-nums ${
            isZero
              ? 'text-red-400'
              : isTimeoutActive
              ? 'text-cyan-300'
              : isClockRunning
              ? 'text-white'
              : 'text-slate-300'
          }`}
        >
          {formattedTime}
        </span>
      </div>

      {/* Status Pill Indicator */}
      <div className="mt-1 flex items-center gap-1.5">
        {isTimeoutActive ? (
          <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-500/50">
            <Timer className="size-2.5 sm:size-3" />
            <span>TIMEOUT</span>
          </span>
        ) : isZero ? (
          <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-red-300 bg-red-950 px-2 py-0.5 rounded border border-red-500/50">
            <AlertTriangle className="size-2.5 sm:size-3" />
            <span>PERIOD OVER</span>
          </span>
        ) : isClockRunning ? (
          <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/50">
            <span className="relative flex size-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full size-1.5 bg-emerald-500" />
            </span>
            <span>RUNNING</span>
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-950 px-2 py-0.5 rounded border border-amber-500/50">
            <Pause className="size-2.5 sm:size-3" />
            <span>PAUSED</span>
          </span>
        )}
      </div>
    </div>
  );
};
