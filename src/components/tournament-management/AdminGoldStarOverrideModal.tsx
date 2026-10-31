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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldAlert, ArrowRightLeft, Trash2, ArrowRight, Trophy, Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { toast } from 'sonner';
import { getFriendlyErrorMessage } from '@/lib/friendlyErrors';
import type { TournamentGoldStarCandidate } from './TournamentGoldStarModal';

interface AdminGoldStarOverrideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  starId: string;
  tournamentId: string;
  tournamentName: string;
  currentWinnerName: string;
  currentWinnerPlayerId?: string;
  currentWinnerJustification?: string | null;
  candidates: TournamentGoldStarCandidate[];
  onSuccess: (result: { reassignedPlayerName?: string; revoked?: boolean }) => void;
}

export const AdminGoldStarOverrideModal: React.FC<AdminGoldStarOverrideModalProps> = ({
  open,
  onOpenChange,
  starId,
  tournamentId: _tournamentId,
  tournamentName,
  currentWinnerName,
  currentWinnerPlayerId,
  candidates,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'reassign' | 'revoke'>('reassign');
  const [selectedReplacementId, setSelectedReplacementId] = useState<string>('');
  const [reassignReason, setReassignReason] = useState<string>('');
  const [revokeReason, setRevokeReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const availableReplacements = candidates.filter(
    (c) => c.playerId !== currentWinnerPlayerId
  );
  const currentCandidate = candidates.find((c) => c.playerId === currentWinnerPlayerId);
  const replacementCandidate = candidates.find((c) => c.playerId === selectedReplacementId);

  const canSubmitReassign =
    Boolean(selectedReplacementId) &&
    reassignReason.trim().length >= 10 &&
    !isSubmitting;

  const canSubmitRevoke = revokeReason.trim().length >= 10 && !isSubmitting;

  const handleReassign = async () => {
    if (!canSubmitReassign || !replacementCandidate) return;
    setIsSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

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
        details: `Admin reassigned Tournament Gold Star in "${tournamentName}" from ${currentWinnerName} to ${replacementCandidate.name}. Reason: ${reassignReason.trim()}`,
      });

      toast.success(`Tournament MVP Gold Star successfully reassigned to ${replacementCandidate.name}`);
      onSuccess({ reassignedPlayerName: replacementCandidate.name });
      onOpenChange(false);
      setReassignReason('');
      setSelectedReplacementId('');
    } catch (err: any) {
      toast.error(getFriendlyErrorMessage(err, 'Failed to reassign Tournament MVP. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    if (!canSubmitRevoke) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('player_stars').delete().eq('id', starId);
      if (error) throw error;

      await logAudit({
        action: 'REVOKE_STAR',
        entity_type: 'player_stars',
        entity_id: starId,
        details: `Admin revoked Tournament MVP Gold Star from ${currentWinnerName} in "${tournamentName}". Reason: ${revokeReason.trim()}`,
      });

      toast.success(`Gold Star revoked. Tournament "${tournamentName}" returned to Pending MVP queue.`);
      onSuccess({ revoked: true });
      onOpenChange(false);
      setRevokeReason('');
    } catch (err: any) {
      toast.error(getFriendlyErrorMessage(err, 'Failed to revoke Gold Star. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !isSubmitting && onOpenChange(val)}>
      <DialogContent
        data-testid="admin-gold-star-override-modal"
        className="max-w-xl bg-slate-950 border-slate-800 text-slate-100 p-6 rounded-3xl shadow-2xl"
      >
        <DialogHeader className="text-left space-y-2">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
              <ShieldAlert className="size-6 text-amber-400" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black uppercase italic tracking-tight text-white flex items-center gap-2">
                Admin Gold Star Governance
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Official Hall of Fame override controls for <span className="text-slate-300 font-semibold">{tournamentName}</span>.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="w-full">
          <TabsList className="grid grid-cols-2 bg-slate-900 border border-slate-800 p-1 rounded-2xl">
            <TabsTrigger
              value="reassign"
              className="text-xs font-black uppercase tracking-wider rounded-xl data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 cursor-pointer"
            >
              <ArrowRightLeft className="size-3.5 mr-1.5" />
              Reassign MVP
            </TabsTrigger>
            <TabsTrigger
              value="revoke"
              className="text-xs font-black uppercase tracking-wider rounded-xl data-[state=active]:bg-red-500 data-[state=active]:text-white cursor-pointer"
            >
              <Trash2 className="size-3.5 mr-1.5" />
              Revoke Star
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: REASSIGN */}
          <TabsContent value="reassign" className="space-y-4 pt-3">
            {/* Current vs Replacement Comparison */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Current Holder */}
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Current Inductee
                </div>
                <div className="font-bold text-white text-sm flex items-center gap-1.5">
                  <Trophy className="size-4 text-amber-400 shrink-0" />
                  <span className="truncate">{currentWinnerName}</span>
                </div>
                {currentCandidate && (
                  <div className="text-[11px] text-slate-400 flex items-center gap-2">
                    <span>{currentCandidate.teamName}</span>
                    <span>•</span>
                    <span className="font-mono text-amber-400">{currentCandidate.points} PTS</span>
                  </div>
                )}
              </div>

              {/* New Candidate */}
              <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center justify-between">
                  <span>New MVP Candidate</span>
                  <ArrowRight className="size-3 text-amber-400" />
                </div>
                {replacementCandidate ? (
                  <>
                    <div className="font-bold text-amber-300 text-sm flex items-center gap-1.5">
                      <Star className="size-4 fill-amber-400 text-amber-400 shrink-0" />
                      <span className="truncate">{replacementCandidate.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-300 flex items-center gap-2">
                      <span>{replacementCandidate.teamName}</span>
                      <span>•</span>
                      <span className="font-mono text-amber-400">{replacementCandidate.points} PTS</span>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-slate-500 italic py-1">Select candidate below</div>
                )}
              </div>
            </div>

            {/* Candidate Selector */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Select Replacement Athlete
              </label>
              <Select value={selectedReplacementId} onValueChange={(val) => setSelectedReplacementId(val ?? '')}>
                <SelectTrigger
                  data-testid="reassign-candidate-select"
                  className="w-full bg-slate-900 border-slate-800 text-white rounded-xl h-12 text-xs"
                >
                  <SelectValue placeholder="Choose replacement contender..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-950 border-slate-800 text-slate-100 max-h-56">
                  {availableReplacements.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 italic">No alternative candidates found</div>
                  ) : (
                    availableReplacements.map((cand) => (
                      <SelectItem
                        key={cand.playerId}
                        value={cand.playerId}
                        className="text-xs cursor-pointer focus:bg-slate-900"
                      >
                        <div className="flex items-center justify-between gap-3 w-full">
                          <span className="font-bold text-white">
                            {cand.jerseyNumber ? `#${cand.jerseyNumber} ` : ''}
                            {cand.name}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {cand.teamName} • {cand.points} PTS {cand.redStarsCount > 0 ? `• ⭐ ${cand.redStarsCount}x` : ''}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Administrative Override Justification */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Administrative Override Justification (Min 10 Chars)</span>
                <span className={reassignReason.trim().length >= 10 ? 'text-emerald-400' : 'text-amber-400 font-mono text-[10px]'}>
                  {reassignReason.trim().length} / 10
                </span>
              </label>
              <Textarea
                data-testid="reassign-reason-input"
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
                placeholder="State the administrative or statistical rationale for reassigning this Tournament MVP Gold Star..."
                className="bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-500 text-xs resize-none rounded-xl h-20 focus-visible:ring-amber-500"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="button"
                data-testid="confirm-reassign-btn"
                onClick={handleReassign}
                disabled={!canSubmitReassign}
                className="text-xs font-black uppercase tracking-wider bg-amber-500 hover:bg-amber-600 text-slate-950 h-10 px-5 rounded-xl shadow-lg shadow-amber-500/20 disabled:opacity-40 cursor-pointer"
              >
                {isSubmitting ? 'Overriding...' : 'Confirm Reassignment'}
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* TAB 2: REVOKE */}
          <TabsContent value="revoke" className="space-y-4 pt-3">
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-200 space-y-2">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-red-400">
                <Trash2 className="size-4 shrink-0" />
                Permanent Gold Star Revocation
              </div>
              <p className="text-xs leading-relaxed text-red-200/90">
                Revoking this Gold Star will strip the accolade from <strong className="text-white">{currentWinnerName}</strong> and reset tournament <strong className="text-white">"{tournamentName}"</strong> to <span className="font-bold underline text-amber-400">Pending MVP</span> in the rapid queue.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Reason for Revocation (Min 10 Chars)</span>
                <span className={revokeReason.trim().length >= 10 ? 'text-emerald-400' : 'text-amber-400 font-mono text-[10px]'}>
                  {revokeReason.trim().length} / 10
                </span>
              </label>
              <Textarea
                data-testid="revoke-reason-input"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="State the reason for revoking this Gold Star (e.g. Disqualification, stat correction, clerical error)..."
                className="bg-slate-900 border-red-500/20 text-slate-100 placeholder:text-slate-500 text-xs resize-none rounded-xl h-20 focus-visible:ring-red-500"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="button"
                data-testid="confirm-revoke-btn"
                onClick={handleRevoke}
                disabled={!canSubmitRevoke}
                className="text-xs font-black uppercase tracking-wider bg-red-600 hover:bg-red-700 text-white h-10 px-5 rounded-xl shadow-lg shadow-red-600/20 disabled:opacity-40 cursor-pointer"
              >
                {isSubmitting ? 'Revoking...' : 'Revoke Star & Return to Queue'}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
