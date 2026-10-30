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
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-red-950/80 border border-red-500/50 text-white font-black uppercase tracking-wider text-xs select-none whitespace-nowrap shrink-0 ${className}`}
    >
      <Flame className="size-3.5 text-amber-400 shrink-0" />
      <span className="px-1.5 py-0.2 rounded bg-red-600 text-white font-mono font-black text-[11px] leading-tight">
        {run.points}-0 RUN
      </span>
      <span className="text-slate-200 text-xs font-bold truncate max-w-[130px] sm:max-w-[180px]">
        {run.teamName}
      </span>
    </div>
  );
};
