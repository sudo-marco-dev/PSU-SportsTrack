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
import { Trophy, Star, AlertTriangle, ShieldCheck, Medal } from 'lucide-react';

export interface TournamentGoldStarCandidate {
  playerId: string;
  name: string;
  jerseyNumber?: number | string | null;
  position?: string | null;
  teamId?: string;
  teamName: string;
  collegeName?: string | null;
  points: number;
  gamesPlayed: number;
  ppg: number;
  redStarsCount: number;
  isChampion: boolean;
  squadFinish?: string;
}

interface TournamentGoldStarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentName: string;
  candidate: TournamentGoldStarCandidate | null;
  isSubmitting: boolean;
  onConfirmAward: (justification?: string) => Promise<void>;
}

export const TournamentGoldStarModal: React.FC<TournamentGoldStarModalProps> = ({
  open,
  onOpenChange,
  tournamentName,
  candidate,
  isSubmitting,
  onConfirmAward,
}) => {
  const [justification, setJustification] = useState('');
  const [hasAttested, setHasAttested] = useState(false);

  if (!candidate) return null;

  const requiresJustification = !candidate.isChampion || candidate.points === 0;
  const isJustificationValid = !requiresJustification || justification.trim().length >= 10;
  const canSubmit = hasAttested && isJustificationValid && !isSubmitting;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    await onConfirmAward(justification.trim() || undefined);
    setJustification('');
    setHasAttested(false);
  };

  const handleOpenChange = (val: boolean) => {
    if (isSubmitting) return;
    onOpenChange(val);
    if (!val) {
      setJustification('');
      setHasAttested(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        data-testid="tournament-gold-star-modal"
        className="max-w-lg bg-slate-950 border-slate-800 text-slate-100 p-6 rounded-3xl shadow-2xl"
      >
        <DialogHeader className="text-left space-y-2">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
              <Trophy className="size-6 text-amber-400" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black uppercase italic tracking-tight text-white flex items-center gap-2">
                Tournament MVP Gold Star
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Induct candidate into the official PSU Hall of Fame for <span className="font-semibold text-slate-300">{tournamentName}</span>.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Selected Candidate Athlete Pedigree Card */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
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
            <div>
              {candidate.isChampion ? (
                <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider px-2.5 py-1">
                  🏆 Champion Squad
                </Badge>
              ) : (
                <Badge className="bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-black uppercase tracking-wider px-2.5 py-1">
                  <Medal className="size-3 mr-1 text-slate-400" />
                  {candidate.squadFinish || 'Podium Contender'}
                </Badge>
              )}
            </div>
          </div>

          {/* Tournament Pedigree Stats */}
          <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-800/80">
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60 text-center">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Points</div>
              <div className="text-base font-black text-white">{candidate.points}</div>
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60 text-center">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">PPG</div>
              <div className="text-base font-black text-amber-400">{candidate.ppg}</div>
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60 text-center">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Red Stars</div>
              <div className="text-base font-black text-red-400 flex items-center justify-center gap-1">
                <Star className="size-3 fill-red-500 text-red-500" />
                {candidate.redStarsCount}x
              </div>
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60 text-center">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Games</div>
              <div className="text-base font-black text-white">{candidate.gamesPlayed}</div>
            </div>
          </div>
        </div>

        {/* Non-Champion or 0-PTS Justification Alert */}
        {requiresJustification && (
          <div
            data-testid="gold-star-justification-alert"
            className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-2"
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
              <AlertTriangle className="size-4 shrink-0 text-amber-400" />
              <span>Non-Champion Contender Justification Required</span>
            </div>
            <p className="text-xs text-amber-200/90 leading-relaxed">
              This candidate is not on the championship squad. A documented administrative justification note (min. 10 characters) is required for institutional audit.
            </p>
            <Textarea
              data-testid="gold-star-justification-input"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Detail the extraordinary individual performance, sportsmanship, or statistical leadership justifying this award..."
              className="bg-slate-950 border-amber-500/30 text-slate-100 placeholder:text-slate-500 text-xs resize-none rounded-xl h-20 focus-visible:ring-amber-500"
            />
            <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
              <span>Required for audit trail</span>
              <span className={justification.trim().length >= 10 ? 'text-emerald-400' : 'text-amber-400'}>
                {justification.trim().length} / 10 chars min
              </span>
            </div>
          </div>
        )}

        {/* Official Certification Checkbox */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              data-testid="gold-star-attestation-checkbox"
              checked={hasAttested}
              onCheckedChange={(val) => setHasAttested(Boolean(val))}
              className="mt-0.5 border-slate-600 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
            />
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white uppercase tracking-wider">
                <ShieldCheck className="size-3.5 text-amber-400" />
                Tournament MVP Certification
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                I certify that this Gold Star accolade recognizes genuine athletic excellence, peak sportsmanship, and tournament dominance under official PSU standards.
              </p>
            </div>
          </label>
        </div>

        <DialogFooter className="flex flex-row justify-end gap-2.5 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
            className="text-xs text-slate-400 hover:text-white hover:bg-slate-900 h-10 px-4 rounded-xl cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            data-testid="confirm-gold-star-btn"
            onClick={handleConfirm}
            disabled={!canSubmit}
            className="text-xs font-black uppercase tracking-wider bg-amber-500 hover:bg-amber-600 text-slate-950 h-10 px-5 rounded-xl shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            <Star className={`size-4 mr-1.5 fill-slate-950 ${isSubmitting ? 'animate-spin' : ''}`} />
            {isSubmitting ? 'Crowning...' : 'Crown & Advance to Next'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
