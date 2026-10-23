import React from 'react';
import { cn } from '@/lib/utils';

export interface ExpandableTabItem {
  id: string;
  label: string;
  shortLabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number | null;
  count?: string | number | null;
  badgeVariant?: 'default' | 'orange' | 'emerald' | 'amber';
  badgeTone?: 'primary' | 'muted' | 'danger' | 'warning' | 'emerald';
}

interface ExpandableIconTabsProps {
  tabs: ExpandableTabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  fullWidthOnMobile?: boolean;
  centered?: boolean;
  ariaLabel?: string;
}

export const ExpandableIconTabs: React.FC<ExpandableIconTabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className,
  size = 'md',
  fullWidthOnMobile = true,
  centered = true,
  ariaLabel,
}) => {
  const containerHeightClass = size === 'sm' ? 'h-9' : size === 'lg' ? 'h-13' : 'h-11 sm:h-12';
  const iconSizeClass = size === 'sm' ? 'size-3.5' : size === 'lg' ? 'size-5' : 'size-4';
  const textSizeClass = size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-xs sm:text-sm' : 'text-[11px] sm:text-xs';

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-1 p-1 bg-slate-950/5 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-2xl max-w-full overflow-x-auto scrollbar-hide',
        fullWidthOnMobile ? 'w-full sm:w-fit' : 'w-auto',
        centered && 'sm:mx-auto sm:self-center',
        containerHeightClass,
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onChange(tab.id)}
            title={tab.label}
            className={cn(
              'relative rounded-xl font-black uppercase italic tracking-tight transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0 select-none outline-none focus-visible:ring-2 focus-visible:ring-orange-500 h-full',
              isActive
                ? cn(
                    'bg-orange-500 text-white shadow-sm shadow-orange-500/25 px-3 sm:px-4 gap-1.5',
                    fullWidthOnMobile ? 'flex-1 sm:flex-initial' : 'flex-initial'
                  )
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5 px-2.5 sm:px-3 gap-1'
            )}
          >
            <Icon className={cn(iconSizeClass, 'shrink-0', isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400')} />

            {/* Expanded Label: Visible when Active on Mobile, and Always on Desktop (md+) if space permits */}
            <span
              className={cn(
                textSizeClass,
                'truncate font-black whitespace-nowrap transition-all duration-200 pr-0.5',
                isActive ? 'inline-block' : 'hidden md:inline-block'
              )}
            >
              {tab.shortLabel && !isActive ? tab.shortLabel : tab.label}
            </span>

            {/* Badge Indicator */}
            {(() => {
              const badgeVal = tab.badge ?? tab.count;
              if (badgeVal === undefined || badgeVal === null || badgeVal === '') return null;
              return (
                <span
                  className={cn(
                    'text-[9px] font-mono font-black px-1.5 py-0.5 rounded-md shrink-0 inline-flex items-center justify-center leading-none transition-colors',
                    isActive
                      ? 'bg-white/20 text-white'
                      : tab.badgeTone === 'warning' || tab.badgeVariant === 'amber'
                      ? 'bg-amber-500/20 text-amber-500'
                      : tab.badgeTone === 'emerald' || tab.badgeVariant === 'emerald'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  )}
                >
                  {badgeVal}
                </span>
              );
            })()}
          </button>
        );
      })}
    </div>
  );
};
