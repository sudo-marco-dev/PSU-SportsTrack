import { LayoutGrid, List } from 'lucide-react';

interface ViewToggleProps {
  view: 'grid' | 'list';
  onViewChange: (view: 'grid' | 'list') => void;
}

export const ViewToggle = ({ view, onViewChange }: ViewToggleProps) => {
  return (
    <div className="flex items-center bg-slate-100/50 dark:bg-white/5 p-1 rounded-full border border-slate-200 dark:border-white/10 backdrop-blur-sm">
      <button
        onClick={() => onViewChange('grid')}
        className={`relative flex items-center justify-center size-9 rounded-full transition-all duration-300 ${
          view === 'grid' 
            ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' 
            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
        }`}
        title="Grid View"
      >
        <LayoutGrid className="size-4" />
      </button>
      <button
        onClick={() => onViewChange('list')}
        className={`relative flex items-center justify-center size-9 rounded-full transition-all duration-300 ${
          view === 'list' 
            ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' 
            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
        }`}
        title="List View"
      >
        <List className="size-4" />
      </button>
    </div>
  );
};
