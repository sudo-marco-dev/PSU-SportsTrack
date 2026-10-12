import { Flame } from 'lucide-react';
import type { MomentumRun } from '@/lib/scoreboardAnimations';

type MomentumRunBadgeProps = {
  run: MomentumRun | null;
  className?: string;
};

export const MomentumRunBadge = ({ run, className = '' }: MomentumRunBadgeProps) => {
  if (!run) return null;

  return (
    <div
      className={`animate-flame-pulse inline-flex items-center gap-2 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full bg-gradient-to-r from-red-600/90 via-orange-600/90 to-amber-600/90 text-white font-black uppercase tracking-wider text-xs sm:text-sm shadow-xl border border-orange-400/50 shadow-orange-600/40 select-none whitespace-nowrap shrink-0 ${className}`}
    >
      <Flame className="size-3.5 sm:size-4 text-yellow-300 fill-current animate-pulse shrink-0" />
      <span className="drop-shadow whitespace-nowrap flex items-center">
        <span className="text-yellow-200 font-mono">{run.points}-0 RUN</span>
        <span className="mx-1.5 opacity-60">•</span>
        <span className="truncate max-w-[120px] sm:max-w-[180px] inline-block">{run.teamName}</span>
      </span>
    </div>
  );
};
