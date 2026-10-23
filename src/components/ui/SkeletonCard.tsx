import React from 'react';

interface SkeletonCardProps {
  variant?: 'card' | 'match' | 'row' | 'stat';
  count?: number;
  className?: string;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  variant = 'card',
  count = 1,
  className = ''
}) => {
  const items = Array.from({ length: count });

  if (variant === 'stat') {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
        {items.map((_, i) => (
          <div
            key={i}
            className="p-5 rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm animate-pulse space-y-3"
          >
            <div className="flex justify-between items-center">
              <div className="h-4 w-24 bg-muted rounded-md" />
              <div className="h-8 w-8 bg-muted rounded-lg" />
            </div>
            <div className="h-7 w-16 bg-muted/80 rounded-md" />
            <div className="h-3 w-32 bg-muted/60 rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'row') {
    return (
      <div className={`space-y-2.5 ${className}`}>
        {items.map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card/40 animate-pulse"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-muted" />
              <div className="space-y-1.5">
                <div className="h-4 w-36 bg-muted rounded-md" />
                <div className="h-3 w-24 bg-muted/60 rounded-md" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-6 w-16 bg-muted/70 rounded-full" />
              <div className="h-8 w-20 bg-muted rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'match') {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
        {items.map((_, i) => (
          <div
            key={i}
            className="p-5 rounded-2xl border border-border/60 bg-card/50 animate-pulse space-y-4"
          >
            <div className="flex justify-between items-center">
              <div className="h-3 w-20 bg-muted rounded-md" />
              <div className="h-5 w-14 bg-muted/80 rounded-full" />
            </div>
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <div className="h-4 w-28 bg-muted rounded-md" />
                <div className="h-5 w-6 bg-muted rounded-md" />
              </div>
              <div className="flex justify-between items-center">
                <div className="h-4 w-28 bg-muted rounded-md" />
                <div className="h-5 w-6 bg-muted rounded-md" />
              </div>
            </div>
            <div className="pt-2 border-t border-border/40 flex justify-between items-center">
              <div className="h-3 w-24 bg-muted/60 rounded-md" />
              <div className="h-3 w-16 bg-muted/60 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Default 'card' variant
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 ${className}`}>
      {items.map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-border/60 bg-card/50 p-6 animate-pulse space-y-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="h-6 w-20 rounded-full bg-muted" />
            <div className="h-5 w-16 rounded-md bg-muted/70" />
          </div>
          <div className="space-y-2">
            <div className="h-5 w-3/4 rounded-md bg-muted" />
            <div className="h-3 w-1/2 rounded-md bg-muted/60" />
          </div>
          <div className="pt-4 border-t border-border/40 flex items-center justify-between">
            <div className="h-3 w-24 rounded-md bg-muted/60" />
            <div className="h-8 w-24 rounded-lg bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
};
