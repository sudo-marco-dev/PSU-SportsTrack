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
      className={`animate-in fade-in duration-300 relative overflow-hidden rounded-xl bg-slate-900 border-2 border-orange-500 p-3.5 sm:p-4 text-white shadow-lg ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-9 sm:size-10 rounded-lg bg-orange-500 text-slate-950 flex items-center justify-center shrink-0">
            <Zap className="size-5 fill-current" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] text-orange-400">
                LEAD CHANGE
              </span>
              <span className="text-[10px] sm:text-xs font-mono font-bold text-slate-300 bg-black/50 px-2 py-0.5 rounded border border-white/10">
                {alert.scoreA} - {alert.scoreB}
              </span>
            </div>
            <h4 className="text-sm sm:text-base font-black uppercase italic tracking-tight text-white break-words line-clamp-2 leading-tight pr-2 mt-0.5">
              <span className="text-orange-400">{alert.teamName}</span> takes the lead!
            </h4>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="size-7 rounded-lg bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          title="Dismiss lead change banner"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
};
