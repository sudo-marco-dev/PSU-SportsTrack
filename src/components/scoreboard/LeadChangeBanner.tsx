import { Zap, X } from 'lucide-react';
import type { LeadChangeAlert } from '@/lib/scoreboardAnimations';

type LeadChangeBannerProps = {
  alert: LeadChangeAlert | null;
  onDismiss: () => void;
  className?: string;
};

export const LeadChangeBanner = ({ alert, onDismiss, className = '' }: LeadChangeBannerProps) => {
  if (!alert) return null;

  return (
    <div
      className={`animate-in fade-in zoom-in-95 duration-300 relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/25 via-orange-500/35 to-amber-500/25 border-2 border-orange-500/70 p-3.5 sm:p-4 text-white shadow-2xl animate-lead-glow ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-9 sm:size-10 rounded-xl bg-orange-500 text-slate-950 flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/40">
            <Zap className="size-5 sm:size-6 fill-current animate-bounce" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] text-orange-400">
                LEAD CHANGE
              </span>
              <span className="text-[10px] sm:text-xs font-mono font-bold text-slate-300 bg-black/40 px-2 py-0.5 rounded-full border border-white/10">
                {alert.scoreA} - {alert.scoreB}
              </span>
            </div>
            <h4 className="text-sm sm:text-base md:text-lg font-black uppercase italic tracking-tight text-white break-words line-clamp-2 leading-tight pr-2 drop-shadow-sm">
              <span className="text-orange-300">{alert.teamName}</span> takes the lead!
            </h4>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="size-7 rounded-lg bg-black/20 hover:bg-black/40 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          title="Dismiss lead change banner"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
};
