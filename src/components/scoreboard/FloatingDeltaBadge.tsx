import type { FloatingDelta } from '@/lib/scoreboardAnimations';

type FloatingDeltaBadgeProps = {
  deltas: FloatingDelta[];
};

export const FloatingDeltaBadge = ({ deltas }: FloatingDeltaBadgeProps) => {
  if (deltas.length === 0) return null;

  return (
    <div className="absolute inset-x-0 -top-8 flex flex-col items-center pointer-events-none z-30">
      {deltas.map((d) => (
        <div
          key={d.id}
          className={`animate-float-delta absolute left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-lg text-base sm:text-lg md:text-xl font-mono font-black italic tracking-wider flex items-center gap-1 shadow-md ${
            d.isPositive
              ? 'bg-emerald-500 text-slate-950 border border-emerald-300'
              : 'bg-red-600 text-white border border-red-400'
          }`}
        >
          <span>{d.delta}</span>
        </div>
      ))}
    </div>
  );
};
