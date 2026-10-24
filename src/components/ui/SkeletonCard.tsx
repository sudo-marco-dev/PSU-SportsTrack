import React from 'react';

interface SkeletonCardProps {
  variant?: 'card' | 'match' | 'row' | 'stat' | 'match-center' | 'athlete-grid' | 'podium' | 'scoreboard' | 'kiosk';
  count?: number;
  className?: string;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  variant = 'card',
  count = 1,
  className = ''
}) => {
  const items = Array.from({ length: count });

  // 1. Match Center Explorer Skeleton (Sports Rail + Symmetric Toolbar + Stacked Match Cards)
  if (variant === 'match-center') {
    return (
      <div className={`space-y-6 animate-in fade-in duration-300 ${className}`}>
        {/* Showcase Banner Skeleton */}
        <div className="relative rounded-[2rem] bg-slate-900 border border-white/5 p-6 sm:p-8 animate-shimmer space-y-3">
          <div className="h-4 w-32 bg-slate-800 rounded-md" />
          <div className="h-9 sm:h-12 w-64 bg-slate-800 rounded-xl" />
          <div className="h-4 w-80 max-w-full bg-slate-800/60 rounded-md" />
        </div>

        {/* Sports Navigation Rail Skeleton */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <div className="h-10 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl shrink-0 animate-shimmer" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 w-32 bg-slate-200 dark:bg-slate-800 rounded-xl shrink-0 animate-shimmer" />
          ))}
        </div>

        {/* Unified Elimination Toolbar Skeleton */}
        <div className="rounded-2xl md:rounded-[2rem] border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-2.5 sm:p-3 shadow-sm animate-shimmer">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="flex gap-1.5 h-10">
              <div className="h-10 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
              <div className="h-10 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            </div>
            <div className="h-10 w-44 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          </div>
        </div>

        {/* Stacked Vertical Match Cards (No Horizontal Truncation) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm space-y-4 animate-shimmer"
            >
              <div className="flex items-center justify-between">
                <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded-md" />
                <div className="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded-full" />
              </div>

              {/* Team A on top */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-2.5">
                  <div className="size-7 rounded-lg bg-slate-200 dark:bg-slate-700" />
                  <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded-md" />
                </div>
                <div className="h-6 w-8 bg-slate-200 dark:bg-slate-700 rounded-md" />
              </div>

              {/* Team B on bottom */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-2.5">
                  <div className="size-7 rounded-lg bg-slate-200 dark:bg-slate-700" />
                  <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded-md" />
                </div>
                <div className="h-6 w-8 bg-slate-200 dark:bg-slate-700 rounded-md" />
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                <div className="h-3 w-28 bg-slate-200 dark:bg-slate-800 rounded-md" />
                <div className="h-7 w-20 bg-slate-200 dark:bg-slate-800 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. Athlete Grid Skeleton (Scouting Hub & Team Management)
  if (variant === 'athlete-grid') {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
        {items.map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm animate-shimmer"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-2xl bg-slate-200 dark:bg-slate-800" />
                <div className="space-y-1.5">
                  <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded-md" />
                  <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800/60 rounded-md" />
                </div>
              </div>
              <div className="h-6 w-14 bg-slate-200 dark:bg-slate-800 rounded-full" />
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              <div className="h-5 w-20 bg-slate-100 dark:bg-slate-800 rounded-md" />
              <div className="h-5 w-16 bg-slate-100 dark:bg-slate-800 rounded-md" />
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
              <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800/60 rounded-md" />
              <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 3. Podium Skeleton (Ranking Page & Champions Crown)
  if (variant === 'podium') {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-8 ${className}`}>
        {/* Silver #2 */}
        <div className="h-64 rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 flex flex-col justify-end items-center space-y-3 animate-shimmer order-2 md:order-1">
          <div className="size-16 rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="h-5 w-28 bg-slate-200 dark:bg-slate-800 rounded-md" />
          <div className="h-4 w-16 bg-slate-200 dark:bg-slate-800/70 rounded-full" />
          <div className="h-10 w-full bg-slate-100 dark:bg-slate-800/40 rounded-xl" />
        </div>

        {/* Gold #1 (Tallest) */}
        <div className="h-80 rounded-3xl border border-orange-500/20 bg-white dark:bg-slate-900 p-6 flex flex-col justify-end items-center space-y-3 animate-shimmer order-1 md:order-2 shadow-lg shadow-orange-500/5">
          <div className="size-20 rounded-full bg-orange-500/20" />
          <div className="h-6 w-36 bg-slate-200 dark:bg-slate-800 rounded-md" />
          <div className="h-4 w-20 bg-orange-500/20 rounded-full" />
          <div className="h-12 w-full bg-orange-500/10 rounded-xl" />
        </div>

        {/* Bronze #3 */}
        <div className="h-56 rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 flex flex-col justify-end items-center space-y-3 animate-shimmer order-3">
          <div className="size-14 rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="h-5 w-24 bg-slate-200 dark:bg-slate-800 rounded-md" />
          <div className="h-4 w-16 bg-slate-200 dark:bg-slate-800/70 rounded-full" />
          <div className="h-8 w-full bg-slate-100 dark:bg-slate-800/40 rounded-xl" />
        </div>
      </div>
    );
  }

  // 4. Scoreboard Skeleton (Live Match Page)
  if (variant === 'scoreboard') {
    return (
      <div className={`space-y-6 max-w-5xl mx-auto ${className}`}>
        <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6 animate-shimmer shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4">
            <div className="h-5 w-28 bg-slate-200 dark:bg-slate-800 rounded-md" />
            <div className="h-6 w-20 bg-orange-500/20 rounded-full" />
          </div>

          <div className="grid grid-cols-3 items-center gap-4 py-6">
            <div className="space-y-3 text-left">
              <div className="size-14 sm:size-20 rounded-2xl bg-slate-200 dark:bg-slate-800 mx-auto sm:mx-0" />
              <div className="h-5 w-32 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-10 sm:h-14 w-16 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            </div>

            <div className="text-center space-y-2">
              <div className="h-8 w-20 bg-slate-200 dark:bg-slate-800 rounded-xl mx-auto" />
              <div className="h-4 w-12 bg-slate-200 dark:bg-slate-800/60 rounded-md mx-auto" />
            </div>

            <div className="space-y-3 text-right flex flex-col items-end">
              <div className="size-14 sm:size-20 rounded-2xl bg-slate-200 dark:bg-slate-800" />
              <div className="h-5 w-32 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-10 sm:h-14 w-16 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
            <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded-md" />
            <div className="h-8 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // 5. Kiosk Skeleton (Facilitator Kiosk)
  if (variant === 'kiosk') {
    return (
      <div className={`min-h-screen p-4 sm:p-6 bg-slate-950 flex flex-col justify-between space-y-6 ${className}`}>
        <div className="flex items-center justify-between border-b border-white/10 pb-4 animate-shimmer">
          <div className="h-6 w-36 bg-slate-800 rounded-lg" />
          <div className="h-8 w-28 bg-orange-500/20 rounded-xl" />
          <div className="h-6 w-24 bg-slate-800 rounded-lg" />
        </div>

        <div className="grid grid-cols-2 gap-4 flex-1">
          <div className="rounded-3xl border border-white/10 bg-slate-900 p-6 flex flex-col justify-between animate-shimmer">
            <div className="h-6 w-32 bg-slate-800 rounded-md" />
            <div className="h-20 w-32 bg-slate-800 rounded-2xl mx-auto my-4" />
            <div className="grid grid-cols-3 gap-2">
              <div className="h-12 bg-slate-800 rounded-xl" />
              <div className="h-12 bg-slate-800 rounded-xl" />
              <div className="h-12 bg-slate-800 rounded-xl" />
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900 p-6 flex flex-col justify-between animate-shimmer">
            <div className="h-6 w-32 bg-slate-800 rounded-md" />
            <div className="h-20 w-32 bg-slate-800 rounded-2xl mx-auto my-4" />
            <div className="grid grid-cols-3 gap-2">
              <div className="h-12 bg-slate-800 rounded-xl" />
              <div className="h-12 bg-slate-800 rounded-xl" />
              <div className="h-12 bg-slate-800 rounded-xl" />
            </div>
          </div>
        </div>

        <div className="h-12 rounded-2xl bg-slate-900 border border-white/10 animate-shimmer" />
      </div>
    );
  }

  // 6. Stat Skeleton
  if (variant === 'stat') {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
        {items.map((_, i) => (
          <div
            key={i}
            className="p-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 animate-shimmer space-y-3"
          >
            <div className="flex justify-between items-center">
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-8 w-8 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            </div>
            <div className="h-7 w-16 bg-slate-200 dark:bg-slate-800/80 rounded-md" />
            <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800/60 rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  // 7. Table Row Skeleton
  if (variant === 'row') {
    return (
      <div className={`space-y-2.5 ${className}`}>
        {items.map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 animate-shimmer"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-800" />
              <div className="space-y-1.5">
                <div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded-md" />
                <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800/60 rounded-md" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-6 w-16 bg-slate-200 dark:bg-slate-800/70 rounded-full" />
              <div className="h-8 w-20 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 8. Match Grid Skeleton
  if (variant === 'match') {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
        {items.map((_, i) => (
          <div
            key={i}
            className="p-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 animate-shimmer space-y-4"
          >
            <div className="flex justify-between items-center">
              <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-5 w-14 bg-slate-200 dark:bg-slate-800/80 rounded-full" />
            </div>
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded-md" />
                <div className="h-5 w-6 bg-slate-200 dark:bg-slate-800 rounded-md" />
              </div>
              <div className="flex justify-between items-center">
                <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded-md" />
                <div className="h-5 w-6 bg-slate-200 dark:bg-slate-800 rounded-md" />
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex justify-between items-center">
              <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800/60 rounded-md" />
              <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800/60 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 9. Default 'card' variant
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 ${className}`}>
      {items.map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 animate-shimmer space-y-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="h-6 w-20 rounded-full bg-slate-200 dark:bg-slate-800" />
            <div className="h-5 w-16 rounded-md bg-slate-200 dark:bg-slate-800/70" />
          </div>
          <div className="space-y-2">
            <div className="h-5 w-3/4 rounded-md bg-slate-200 dark:bg-slate-800" />
            <div className="h-3 w-1/2 rounded-md bg-slate-200 dark:bg-slate-800/60" />
          </div>
          <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
            <div className="h-3 w-24 rounded-md bg-slate-200 dark:bg-slate-800/60" />
            <div className="h-8 w-24 rounded-lg bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
      ))}
    </div>
  );
};
