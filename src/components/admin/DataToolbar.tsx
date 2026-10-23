import React from 'react';
import { Search, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DataToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filterValue: string;
  onFilterChange: (value: string) => void;
  filterOptions: { label: string; value: string }[];
  searchPlaceholder?: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}

export const DataToolbar = ({
  searchQuery,
  onSearchChange,
  filterValue,
  onFilterChange,
  filterOptions,
  searchPlaceholder = "Search...",
  children,
  actions
}: DataToolbarProps) => {
  const hasFilter = Boolean(filterOptions && filterOptions.length > 0);

  return (
    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 sm:gap-4 w-full bg-white/70 dark:bg-slate-950/60 backdrop-blur-2xl p-2.5 sm:p-3 md:p-4 rounded-2xl sm:rounded-[2rem] border border-slate-200/80 dark:border-white/10 sticky top-4 z-20 shadow-xl shadow-slate-900/5 dark:shadow-black/20 animate-in fade-in slide-in-from-top-4 duration-700 min-w-0">
      {/* Search Input */}
      <div className="flex-1 min-w-0">
        <div className="relative w-full group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400 group-focus-within:text-orange-500 transition-colors duration-300 pointer-events-none" />
          <Input
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-11 pr-10 h-11 sm:h-12 bg-white/90 dark:bg-slate-900/90 border-slate-200 dark:border-white/10 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-xs sm:text-sm font-medium placeholder:text-slate-400 placeholder:font-bold placeholder:uppercase placeholder:tracking-widest placeholder:text-[10px]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 size-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* Filter and Actions Bar: On mobile, side-by-side on Row 2; On desktop, inline with search */}
      {(hasFilter || actions || children) && (
        <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto shrink-0 justify-between sm:justify-end min-w-0">
          {hasFilter && (
            <div className="flex items-center gap-1.5 flex-1 md:w-auto md:flex-initial min-w-0">
              <div className="flex-1 md:w-[220px] min-w-0">
                <Select value={filterValue} onValueChange={(val) => onFilterChange(val || '')}>
                  <SelectTrigger className="w-full h-11 sm:h-12 bg-white/90 dark:bg-slate-900/90 border-slate-200 dark:border-white/10 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-bold text-[11px] sm:text-xs uppercase tracking-widest text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2 truncate">
                      <Filter className="size-3.5 text-orange-500 shrink-0" />
                      <SelectValue placeholder="Filter Hub">
                        {filterOptions.find((opt) => opt.value === filterValue)?.label}
                      </SelectValue>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-200 dark:border-white/10 backdrop-blur-3xl bg-white/95 dark:bg-slate-950/95">
                    {filterOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="rounded-xl focus:bg-orange-50 dark:focus:bg-orange-500/10 font-bold text-[11px] uppercase tracking-widest py-2.5 cursor-pointer">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {filterValue && filterValue !== 'all' && filterOptions.some((o) => o.value === 'all') && (
                <button
                  type="button"
                  onClick={() => onFilterChange('all')}
                  className="size-11 sm:size-12 rounded-xl sm:rounded-2xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  title="Clear filter"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          )}

          {children}

          {actions && (
            <div className="shrink-0 flex items-center">
              {actions}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
