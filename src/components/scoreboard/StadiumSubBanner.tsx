import React, { useEffect, useState, useRef } from 'react';
import { ArrowLeftRight, ArrowDownRight, ArrowUpRight, X } from 'lucide-react';

export interface SubstitutionAlertData {
  id: string;
  team: 'a' | 'b';
  teamName: string;
  outPlayer: string;
  inPlayer: string;
  outJersey?: string;
  inJersey?: string;
  timestamp: number;
}

interface StadiumSubBannerProps {
  alert: SubstitutionAlertData | null;
  onDismiss: () => void;
  durationMs?: number;
}

export const StadiumSubBanner: React.FC<StadiumSubBannerProps> = ({
  alert,
  onDismiss,
  durationMs = 6000,
}) => {
  const [progress, setProgress] = useState(100);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!alert) {
      setProgress(100);
      return;
    }

    setProgress(100);
    // Use local browser clock anchored to alert arrival so parent re-renders never reset countdown
    startTimeRef.current = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, 100 - (elapsed / durationMs) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onDismissRef.current();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [alert?.id, durationMs]);

  if (!alert) return null;

  return (
    <aside
      aria-label="Courtside Player Substitution Alert"
      className="fixed bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-40 w-[92vw] max-w-2xl bg-slate-950/95 border-2 border-orange-500/50 rounded-2xl p-4 sm:p-5 shadow-[0_10px_40px_rgba(249,115,22,0.35)] backdrop-blur-md animate-in slide-in-from-bottom-8 duration-500 overflow-hidden"
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-3 mb-3 border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-orange-500 text-slate-950 animate-pulse">
            <ArrowLeftRight className="size-4" />
          </span>
          <span className="text-xs sm:text-sm font-black uppercase tracking-[0.2em] text-orange-400">
            PLAYER SUBSTITUTION
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-white line-clamp-1 break-words pr-1.5 max-w-[280px] sm:max-w-md">
            {alert.teamName}
          </span>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="size-7 rounded-lg bg-white/5 hover:bg-white/15 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Dismiss Alert"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Players Row: Out vs In */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 items-center">
        {/* Out Player */}
        <div className="flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl bg-red-950/40 border border-red-500/30">
          <div className="size-8 sm:size-9 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
            <ArrowDownRight className="size-4 sm:size-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-red-400 block leading-tight">
              SUB OUT
            </span>
            <div className="flex items-center gap-1.5 truncate mt-0.5">
              {alert.outJersey && (
                <span className="font-mono text-xs sm:text-sm font-black text-red-300">
                  #{alert.outJersey}
                </span>
              )}
              <span className="text-xs sm:text-sm font-bold text-slate-100 truncate">
                {alert.outPlayer}
              </span>
            </div>
          </div>
        </div>

        {/* In Player */}
        <div className="flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
          <div className="size-8 sm:size-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <ArrowUpRight className="size-4 sm:size-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block leading-tight">
              SUB IN
            </span>
            <div className="flex items-center gap-1.5 truncate mt-0.5">
              {alert.inJersey && (
                <span className="font-mono text-xs sm:text-sm font-black text-emerald-300">
                  #{alert.inJersey}
                </span>
              )}
              <span className="text-xs sm:text-sm font-bold text-slate-100 truncate">
                {alert.inPlayer}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Depleting neon progress bar */}
      <div className="absolute bottom-0 inset-x-0 h-1 bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-75"
          style={{ width: `${progress}%` }}
        />
      </div>
    </aside>
  );
};
