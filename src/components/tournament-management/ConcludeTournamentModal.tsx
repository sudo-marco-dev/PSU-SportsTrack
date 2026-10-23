import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trophy, CheckCircle2 } from 'lucide-react';
import { logAudit } from '@/lib/audit';
import type { Tournament } from './types';

interface ConcludeTournamentModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: Tournament | null;
  championName: string | null;
  onConcluded: () => void;
}

export const ConcludeTournamentModal: React.FC<ConcludeTournamentModalProps> = ({
  isOpen,
  onOpenChange,
  tournament,
  championName,
  onConcluded,
}) => {
  const [isConcluding, setIsConcluding] = useState(false);

  const handleConclude = async () => {
    if (!tournament) return;
    setIsConcluding(true);

    try {
      const { error } = await supabase
        .from('tournaments')
        .update({ status: 'Completed' })
        .eq('id', tournament.id);

      if (error) throw error;

      toast.success(`"${tournament.name}" is officially concluded!`, {
        description: championName ? `Crowned Champion: ${championName}` : 'Bracket locked and archived.'
      });

      await logAudit({
        action: 'CONCLUDE_TOURNAMENT',
        entity_type: 'tournaments',
        entity_id: tournament.id,
        details: `Officially concluded tournament: ${tournament.name} (${tournament.id}). Crowned Champion: ${championName || 'None'}`
      });

      onOpenChange(false);
      onConcluded();
    } catch (err: any) {
      toast.error('Failed to conclude tournament: ' + (err.message || 'Unknown error'));
    } finally {
      setIsConcluding(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-md max-w-[95vw] rounded-3xl border-emerald-500/20 p-6 shadow-2xl bg-white dark:bg-slate-950">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20">
              <Trophy className="size-5" />
            </div>
            <DialogTitle className="text-xl font-black italic uppercase tracking-tight text-slate-900 dark:text-white">
              Conclude <span className="text-emerald-600">Tournament</span>
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
            Officially conclude <strong className="text-slate-900 dark:text-white">{tournament?.name}</strong>?
            {championName && (
              <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-700 dark:text-amber-300 font-bold flex items-center gap-2">
                <Trophy className="size-4 text-amber-600 shrink-0" />
                <span>Crowned Champion: <strong className="font-black underline">{championName}</strong></span>
              </div>
            )}
            <span className="block mt-2 text-slate-600 dark:text-slate-300">
              This will set status to <strong>COMPLETED</strong>, lock the bracket tree to prevent accidental match wipes or re-seeding, and archive official tournament records.
            </span>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 pt-3 border-t border-slate-100 dark:border-white/5">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-10 rounded-xl font-black uppercase tracking-widest text-xs"
            disabled={isConcluding}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConclude}
            disabled={isConcluding}
            className="h-10 flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase italic tracking-wider text-xs shadow-md shadow-emerald-600/20 gap-2 transition-all active:scale-[0.98]"
          >
            {isConcluding ? (
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white" />
            ) : (
              <CheckCircle2 className="size-3.5" />
            )}
            {isConcluding ? 'Finalizing...' : 'Yes, Conclude Tournament'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
