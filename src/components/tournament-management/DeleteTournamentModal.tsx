import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RotateCcw, CheckCircle2 } from 'lucide-react';
import { logAudit } from '@/lib/audit';
import type { Tournament } from './types';

interface DeleteTournamentModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: Tournament | null;
  onDeleted: () => void;
}

export const DeleteTournamentModal: React.FC<DeleteTournamentModalProps> = ({
  isOpen,
  onOpenChange,
  tournament,
  onDeleted,
}) => {
  const { user } = useAuth();
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [isDeletingTournament, setIsDeletingTournament] = useState(false);

  const handleRestoreTournament = async (tournamentId: string, tournamentName?: string) => {
    try {
      const { error } = await supabase
        .from('tournaments')
        .update({
          is_deleted: false,
          deleted_at: null,
          deleted_by: null
        })
        .eq('id', tournamentId);

      if (error) throw error;

      toast.success(`"${tournamentName || 'Tournament'}" restored successfully!`, {
        description: 'Tournament is live and visible across all public brackets and athlete hubs.'
      });

      await logAudit({
        action: 'RESTORE_TOURNAMENT',
        entity_type: 'tournaments',
        entity_id: tournamentId,
        details: `Restored soft-deleted tournament: ${tournamentName || tournamentId}`
      });

      onDeleted();
    } catch (err: any) {
      toast.error('Failed to restore tournament: ' + err.message);
    }
  };

  const handleDelete = async () => {
    if (!tournament) return;
    setIsDeletingTournament(true);

    try {
      const tournamentId = tournament.id;
      const tournamentName = tournament.name;
      const adminId = user?.id || (await supabase.auth.getUser()).data.user?.id || null;

      const { error } = await supabase
        .from('tournaments')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: adminId
        })
        .eq('id', tournamentId);

      if (error) throw error;

      toast.success(`"${tournamentName}" moved to Recovery Vault.`, {
        description: 'Hidden from public brackets. You can undo or restore it anytime in the Recovery Center.',
        action: {
          label: 'Undo',
          onClick: () => handleRestoreTournament(tournamentId, tournamentName)
        }
      });

      await logAudit({
        action: 'DELETE_TOURNAMENT',
        entity_type: 'tournaments',
        entity_id: tournamentId,
        details: `Soft-deleted tournament: ${tournamentName} (recoverable in Recovery Center)`
      });

      onOpenChange(false);
      setDeleteConfirmationInput('');
      onDeleted();
    } catch (err: any) {
      toast.error('Failed to move tournament to recovery: ' + err.message);
    } finally {
      setIsDeletingTournament(false);
    }
  };

  const isConfirmed =
    deleteConfirmationInput.trim().toUpperCase() === 'DELETE' ||
    deleteConfirmationInput.trim().toUpperCase() === 'ARCHIVE';

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) setDeleteConfirmationInput('');
      }}
    >
      <DialogContent className="w-full sm:max-w-md max-w-[95vw] max-h-[88dvh] overflow-y-auto rounded-3xl border-orange-500/20 p-6 shadow-2xl bg-white dark:bg-slate-950">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-xl border border-orange-500/20">
              <RotateCcw className="size-5" />
            </div>
            <DialogTitle className="text-xl font-black italic uppercase tracking-tight text-slate-900 dark:text-white">
              Move to <span className="text-orange-500">Recovery Vault</span>
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
            Moving <strong className="text-slate-900 dark:text-white font-bold">{tournament?.name}</strong> to the Recovery Vault will immediately hide it from public brackets, live match explorers, and rankings.
            <span className="flex items-start gap-1.5 mt-2 text-emerald-600 dark:text-emerald-400 font-bold">
              <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
              <span>Soft-Delete Safeguard: All registered squads, brackets, matches, and player ratings remain 100% preserved and can be restored anytime in the Recovery Center.</span>
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 p-3 bg-orange-500/5 rounded-2xl border border-orange-500/15 space-y-2">
          <p className="text-[11px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
            Type <span className="font-mono font-black text-orange-700 dark:text-orange-300">DELETE</span> to confirm:
          </p>
          <Input
            placeholder="DELETE"
            value={deleteConfirmationInput}
            onChange={(e) => setDeleteConfirmationInput(e.target.value)}
            className="h-10 bg-white dark:bg-slate-900 border-orange-200 dark:border-orange-500/30 rounded-xl font-mono font-bold text-xs uppercase tracking-widest text-slate-900 dark:text-white focus:ring-orange-500"
          />
        </div>

        <DialogFooter className="gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-10 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-slate-100 dark:hover:bg-white/5"
            disabled={isDeletingTournament}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            disabled={!isConfirmed || isDeletingTournament}
            className="h-10 flex-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-xl font-black uppercase italic tracking-wider text-xs shadow-md shadow-orange-600/20 gap-2 transition-all active:scale-[0.98]"
          >
            {isDeletingTournament ? (
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white" />
            ) : (
              <RotateCcw className="size-3.5" />
            )}
            {isDeletingTournament ? 'Moving to Vault...' : 'Move to Recovery Vault'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
