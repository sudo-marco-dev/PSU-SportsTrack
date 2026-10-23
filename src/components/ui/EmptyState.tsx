import React from 'react';
import { Trophy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from './button';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  actionNode?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon: Icon = Trophy,
  actionLabel,
  onAction,
  actionNode,
  className = ''
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center p-8 md:p-12 text-center rounded-2xl border border-dashed border-border/80 bg-card/40 backdrop-blur-sm transition-all duration-300 animate-in fade-in zoom-in-95 ${className}`}
    >
      <div className="relative mb-4 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl animate-pulse" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/80 border border-border/60 shadow-inner">
          <Icon className="h-8 w-8 text-primary" strokeWidth={1.75} />
        </div>
      </div>

      <h3 className="text-lg font-bold tracking-tight text-foreground font-serif">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>

      {actionLabel && onAction && (
        <div className="mt-6">
          <Button
            onClick={onAction}
            className="shadow-sm font-semibold tracking-wide hover:shadow-primary/20 transition-all duration-200"
          >
            {actionLabel}
          </Button>
        </div>
      )}

      {actionNode && <div className="mt-6">{actionNode}</div>}
    </div>
  );
};
