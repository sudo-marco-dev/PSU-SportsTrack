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
import { Checkbox } from '@/components/ui/checkbox';
import { Star, AlertTriangle, ShieldCheck, Trophy, Sparkles } from 'lucide-react';
import type { MvpCandidateOption } from './MvpCandidateSelect';

interface MvpAttestationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: MvpCandidateOption | null;
  hasConflict: boolean;
  conflictCollegeName?: string | null;
  isLosingTeamOrZeroStats: boolean;
  onConfirmAward: (justification?: string) => Promise<void>;
  isSubmitting: boolean;
}

export const MvpAttestationModal: React.FC<MvpAttestationModalProps> = ({
  open,
  onOpenChange,
  candidate,
  hasConflict,
  conflictCollegeName,
  isLosingTeamOrZeroStats,
  onConfirmAward,
  isSubmitting,
}) => {
  const [justification, setJustification] = useState('');
  const [hasAttested, setHasAttested] = useState(false);

  if (!candidate) return null;

  const isJustificationValid = !isLosingTeamOrZeroStats || justification.trim().length >= 10;
  const canSubmit = hasAttested && isJustificationValid && !isSubmitting;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    await onConfirmAward(justification.trim() || undefined);
    setJustification('');
    setHasAttested(false);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!isSubmitting) {
        onOpenChange(val);
        if (!val) {
          setJustification('');
          setHasAttested(false);
        }
      }
    }}>
      <DialogContent 
        data-testid="mvp-attestation-modal"
        className="max-w-lg bg-slate-950 border-slate-800 text-slate-100 p-6 rounded-2xl shadow-2xl"
      >
        <DialogHeader className="text-left space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
              <Star className="size-5 fill-red-500" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black uppercase italic tracking-tight text-white flex items-center gap-2">
                Post-Game MVP Certification
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Official accreditation and fair-play attestation for Red Star award.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Selected Candidate Athlete Card */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                  {candidate.jerseyNumber ? `#${candidate.jerseyNumber}` : '—'}
                </span>
                <h4 className="font-black text-base text-white tracking-tight">
                  {candidate.name}
                </h4>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {candidate.teamName} {candidate.position ? `• ${candidate.position}` : ''}
              </p>
            </div>
            <div className="text-right shrink-0">
              <Badge className="bg-slate-800 text-amber-400 border border-amber-500/30 font-mono font-bold text-xs px-2.5 py-1">
                {candidate.points} PTS
              </Badge>
              {candidate.isWinningTeam ? (
                <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1 justify-end mt-1">
                  <Trophy className="size-3 text-emerald-400" /> Winning Squad
                </div>
              ) : (
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-1">
                  Opposing Squad
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Conflict of Interest Warning Banner */}
        {hasConflict && (
          <div 
            data-testid="mvp-coi-warning"
            className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1.5 animate-in fade-in"
          >
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <AlertTriangle className="size-4 shrink-0 text-amber-400" />
              <span>Collegiate Affiliation Notice (Conflict of Interest)</span>
            </div>
            <p className="text-amber-200/90 text-[11px] leading-relaxed">
              You are officially registered under <strong className="text-white underline">{conflictCollegeName || 'the same college'}</strong> as this candidate. Palawan State University officiating governance mandates strict neutrality. Your official ID will be permanently recorded with this star in the institutional audit ledger.
            </p>
          </div>
        )}

        {/* Mandatory Justification for Low-Stat / Losing Team Athletes */}
        {isLosingTeamOrZeroStats && (
          <div 
            data-testid="mvp-justification-section"
            className="p-3.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-200 text-xs space-y-2 animate-in fade-in"
          >
            <div className="flex items-center gap-2 font-bold text-orange-300">
              <Sparkles className="size-4 shrink-0 text-orange-400" />
              <span>Performance Justification Required</span>
            </div>
            <p className="text-orange-200/90 text-[11px] leading-relaxed">
              This athlete scored <strong>{candidate.points} PTS</strong> {!candidate.isWinningTeam ? 'for the non-winning squad' : 'with zero recorded offensive scoring'}. Anti-bias regulations require explaining why this player is awarded MVP over the winning team&apos;s top scorers (e.g. defensive stops, leadership, clutch playmaking).
            </p>
            <Textarea
              data-testid="mvp-justification-input"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Explain the standout performance justifying this MVP selection (minimum 10 characters)..."
              className="bg-slate-950 border-slate-700/80 text-white text-xs placeholder:text-slate-500 focus:ring-1 focus:ring-orange-400 min-h-[4rem]"
            />
            {justification.trim().length > 0 && justification.trim().length < 10 && (
              <p className="text-[10px] text-red-400 font-medium">
                Please enter at least 10 characters ({10 - justification.trim().length} more needed).
              </p>
            )}
          </div>
        )}

        {/* Fair Play & Neutrality Attestation Checkbox */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-3">
          <Checkbox
            id="mvp-fair-play-checkbox"
            data-testid="mvp-attestation-checkbox"
            checked={hasAttested}
            onCheckedChange={(checked) => setHasAttested(Boolean(checked))}
            className="mt-0.5 border-slate-600 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
          />
          <label 
            htmlFor="mvp-fair-play-checkbox" 
            className="text-xs text-slate-300 leading-snug cursor-pointer select-none space-y-0.5 block"
          >
            <span className="font-bold text-white block flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-emerald-400" />
              Official Fair Play & Neutrality Attestation
            </span>
            <span className="text-[11px] text-slate-400 block">
              I officially certify that this MVP recognition is based strictly on fair play, objective match performance, and sportsmanship, free from favoritism or collegiate bias.
            </span>
          </label>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-bold"
          >
            Cancel
          </Button>
          <Button
            type="button"
            data-testid="mvp-confirm-award-button"
            onClick={handleConfirm}
            disabled={!canSubmit}
            className="bg-red-500 hover:bg-red-600 text-white font-black uppercase text-xs tracking-wider gap-2 h-11 px-6 shadow-lg shadow-red-500/20 disabled:opacity-40"
          >
            <Star className="size-4 fill-white" />
            {isSubmitting ? 'Certifying Award...' : 'Confirm & Award Red Star'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
