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
          className={`animate-float-delta absolute left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-base sm:text-lg md:text-xl font-black italic tracking-wider shadow-xl flex items-center gap-1 border ${
            d.isPositive
              ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-slate-950 border-emerald-300 shadow-emerald-500/50'
              : 'bg-gradient-to-r from-red-600 to-rose-700 text-white border-red-400 shadow-red-500/50'
          }`}
        >
          <span>{d.delta}</span>
        </div>
      ))}
    </div>
  );
};
