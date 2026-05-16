import React from 'react';
import { Search, Filter } from 'lucide-react';
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
  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-4 w-full bg-white/40 dark:bg-slate-950/40 backdrop-blur-2xl p-3 md:p-4 rounded-[2rem] border border-white/20 dark:border-white/10 sticky top-4 z-20 shadow-2xl shadow-slate-900/5 dark:shadow-black/20 animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1">
        <div className="relative w-full sm:max-w-md group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 size-4 text-slate-400 group-focus-within:text-orange-500 transition-colors duration-300" />
          <Input
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-12 h-14 bg-white/80 dark:bg-slate-900/80 border-slate-100 dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-inner text-sm font-medium placeholder:text-slate-400 placeholder:font-bold placeholder:uppercase placeholder:tracking-widest placeholder:text-[10px]"
          />
        </div>
        
        <Select value={filterValue} onValueChange={(val) => onFilterChange(val || '')}>
          <SelectTrigger className="w-full sm:w-[220px] h-14 bg-white/80 dark:bg-slate-900/80 border-slate-100 dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-bold text-xs uppercase tracking-widest text-slate-600">
            <div className="flex items-center gap-3">
              <Filter className="size-4 text-orange-500" />
              <SelectValue placeholder="Filter Hub" />
            </div>
          </SelectTrigger>
          <SelectContent className="rounded-2xl border-slate-200 dark:border-white/10 backdrop-blur-3xl bg-white/95 dark:bg-slate-950/95">
            {filterOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="rounded-xl focus:bg-orange-50 dark:focus:bg-orange-500/10 font-bold text-[11px] uppercase tracking-widest py-3 cursor-pointer">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-4 w-full md:w-auto justify-end px-2">
        {children}
        {actions && (
          <div className="flex items-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
