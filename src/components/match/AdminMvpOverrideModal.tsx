import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ShieldAlert, ArrowRightLeft, Trash2, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { toast } from 'sonner';
import { getFriendlyErrorMessage } from '@/lib/friendlyErrors';
import type { MvpCandidateOption } from './MvpCandidateSelect';

interface AdminMvpOverrideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  starId: string;
  matchId: string;
  tournamentId?: string;
  currentMvpName: string;
  currentMvpPlayerId?: string;
  candidates: MvpCandidateOption[];
  onSuccess: (newMvpName: string | null) => void;
}

export const AdminMvpOverrideModal: React.FC<AdminMvpOverrideModalProps> = ({
  open,
  onOpenChange,
  starId,
  currentMvpName,
  currentMvpPlayerId,
  candidates,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'reassign' | 'revoke'>('reassign');
  const [selectedReplacementId, setSelectedReplacementId] = useState<string>('');
  const [reassignReason, setReassignReason] = useState<string>('');
  const [revokeReason, setRevokeReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const currentCandidate = candidates.find((c) => c.playerId === currentMvpPlayerId);
  const replacementCandidate = candidates.find((c) => c.playerId === selectedReplacementId);

  const canSubmitReassign =
    Boolean(selectedReplacementId) &&
    selectedReplacementId !== currentMvpPlayerId &&
    reassignReason.trim().length >= 10 &&
    !isSubmitting;

  const canSubmitRevoke = revokeReason.trim().length >= 10 && !isSubmitting;

  const handleReassign = async () => {
    if (!canSubmitReassign || !replacementCandidate) return;
    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('player_stars')
        .update({
          player_id: replacementCandidate.playerId,
          override_reason: reassignReason.trim(),
          overridden_by: user?.id || null,
          overridden_at: new Date().toISOString(),
        })
        .eq('id', starId);

      if (error) throw error;

      await logAudit({
        action: 'OVERRIDE_STAR',
        entity_type: 'player_stars',
        entity_id: starId,
        details: `Admin reassigned MVP from ${currentMvpName} to ${replacementCandidate.name}. Reason: ${reassignReason.trim()}`,
      });

      toast.success(`MVP officially reassigned to ${replacementCandidate.name}`);
      onSuccess(replacementCandidate.name);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(getFriendlyErrorMessage(err, 'Failed to reassign MVP. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    if (!canSubmitRevoke) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('player_stars')
        .delete()
        .eq('id', starId);

      if (error) throw error;

      await logAudit({
        action: 'REVOKE_STAR',
        entity_type: 'player_stars',
        entity_id: starId,
        details: `Admin revoked MVP from ${currentMvpName}. Reason: ${revokeReason.trim()}`,
      });

      toast.success('MVP Star successfully revoked. Match returned to unawarded state.');
      onSuccess(null);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(getFriendlyErrorMessage(err, 'Failed to revoke MVP. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !isSubmitting && onOpenChange(val)}>
      <DialogContent 
        data-testid="admin-mvp-override-modal"
        className="max-w-xl bg-slate-950 border-slate-800 text-slate-100 p-6 rounded-2xl shadow-2xl"
      >
        <DialogHeader className="text-left space-y-1.5">
          <div className="flex items-center gap-2 text-amber-500">
            <ShieldAlert className="size-5" />
            <DialogTitle className="text-lg font-black uppercase italic tracking-tight text-white">
              Administrator MVP Governance
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-400">
            Override, reassign, or revoke post-match MVP awards in case of scorekeeper error or disputed selection.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'reassign' | 'revoke')} className="w-full">
          <TabsList className="grid grid-cols-2 bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <TabsTrigger 
              value="reassign" 
              data-testid="tab-reassign-mvp"
              className="text-xs font-bold uppercase gap-2 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950"
            >
              <ArrowRightLeft className="size-3.5" />
              Reassign MVP
            </TabsTrigger>
            <TabsTrigger 
              value="revoke" 
              data-testid="tab-revoke-mvp"
              className="text-xs font-bold uppercase gap-2 data-[state=active]:bg-red-500 data-[state=active]:text-white"
            >
              <Trash2 className="size-3.5" />
              Revoke Star
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: REASSIGN MVP */}
          <TabsContent value="reassign" className="space-y-4 pt-3">
            {/* Side-by-side comparison */}
            <div className="grid sm:grid-cols-2 gap-3">
              {/* Current MVP Card */}
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Current Award Holder
                </span>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-white truncate">{currentMvpName}</span>
                  <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-300 font-mono">
                    {currentCandidate?.points ?? '—'} PTS
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-500 truncate">
                  {currentCandidate?.teamName || 'Recorded Squad'}
                </p>
              </div>

              {/* Replacement Candidate Card */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block flex items-center gap-1">
                  <ArrowRight className="size-3" /> New Replacement MVP
                </span>
                {replacementCandidate ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white truncate">
                        {replacementCandidate.name}
                      </span>
                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] font-mono">
                        {replacementCandidate.points} PTS
                      </Badge>
                    </div>
                    <p className="text-[11px] text-amber-300/80 truncate">
                      {replacementCandidate.teamName}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-slate-500 italic pt-2">
                    Select a replacement athlete below
                  </p>
                )}
              </div>
            </div>

            {/* Select Replacement Athlete */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Select Replacement Athlete
              </label>
              <select
                data-testid="admin-mvp-replacement-select"
                value={selectedReplacementId}
                onChange={(e) => setSelectedReplacementId(e.target.value)}
                className="w-full h-11 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-amber-500/30"
              >
                <option value="">Select replacement player...</option>
                {candidates
                  .filter((c) => c.playerId !== currentMvpPlayerId)
                  .map((c) => (
                    <option key={c.playerId} value={c.playerId}>
                      #{c.jerseyNumber || '?'} {c.name} ({c.teamName}) — {c.points} PTS {c.isTopScorer ? '🔥 Top Scorer' : ''}
                    </option>
                  ))}
              </select>
            </div>

            {/* Required Administrative Justification */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Administrative Override Reason (Required)
              </label>
              <Textarea
                data-testid="admin-reassign-reason"
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
                placeholder="Document why this star is being reassigned (e.g., Scorekeeper mistaken input, stat verification, committee review)..."
                className="bg-slate-900 border-slate-700 text-white text-xs placeholder:text-slate-500 focus:ring-1 focus:ring-amber-500 min-h-[4rem]"
              />
              {reassignReason.trim().length > 0 && reassignReason.trim().length < 10 && (
                <p className="text-[10px] text-red-400">Minimum 10 characters required.</p>
              )}
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="text-slate-400 text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                data-testid="btn-confirm-reassign"
                onClick={handleReassign}
                disabled={!canSubmitReassign}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black uppercase text-xs tracking-wider gap-2 h-11 px-6 disabled:opacity-40"
              >
                <ArrowRightLeft className="size-4" />
                {isSubmitting ? 'Overriding...' : 'Confirm Reassignment & Audit'}
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* TAB 2: REVOKE STAR */}
          <TabsContent value="revoke" className="space-y-4 pt-3">
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-red-400">
                <Trash2 className="size-4" />
                <span>Confirm Accolade Revocation</span>
              </div>
              <p className="text-red-200/90 leading-relaxed text-[11px]">
                Revoking this Red Star will permanently remove the MVP accolade from <strong>{currentMvpName}</strong>. The match fixture will return to the unawarded state, enabling officiating officials or administrators to cast a fresh post-game award.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Revocation Justification (Required)
              </label>
              <Textarea
                data-testid="admin-revoke-reason"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="State the official reason for revoking this match accolade..."
                className="bg-slate-900 border-slate-700 text-white text-xs placeholder:text-slate-500 focus:ring-1 focus:ring-red-400 min-h-[4rem]"
              />
              {revokeReason.trim().length > 0 && revokeReason.trim().length < 10 && (
                <p className="text-[10px] text-red-400">Minimum 10 characters required.</p>
              )}
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="text-slate-400 text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                data-testid="btn-confirm-revoke"
                onClick={handleRevoke}
                disabled={!canSubmitRevoke}
                className="bg-red-600 hover:bg-red-700 text-white font-black uppercase text-xs tracking-wider gap-2 h-11 px-6 disabled:opacity-40"
              >
                <Trash2 className="size-4" />
                {isSubmitting ? 'Revoking...' : 'Revoke Star & Re-open Selection'}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
