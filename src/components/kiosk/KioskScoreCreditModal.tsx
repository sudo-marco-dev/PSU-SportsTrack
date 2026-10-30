import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Sparkles } from 'lucide-react';
import type { RosterPlayerItem } from './KioskSubstitutionModal';

interface KioskScoreCreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: 'a' | 'b';
  teamName: string;
  points: number;
  pointUnit: string;
  actionType: string;
  actionDesc?: string;
  activePlayers: RosterPlayerItem[];
  onConfirmScore: (playerId: string | null) => void;
  isSubmitting?: boolean;
}

export const KioskScoreCreditModal: React.FC<KioskScoreCreditModalProps> = ({
  isOpen,
  onClose,
  team,
  teamName,
  points,
  pointUnit,
  actionType,
  actionDesc,
  activePlayers,
  onConfirmScore,
  isSubmitting = false,
}) => {
  const resolvePlayerName = (p: RosterPlayerItem) => {
    if (!p.users) return `Player #${p.jersey_number ?? '--'}`;
    if (Array.isArray(p.users)) return p.users[0]?.full_name || `Player #${p.jersey_number ?? '--'}`;
    return p.users.full_name || `Player #${p.jersey_number ?? '--'}`;
  };

  const accentBorder = team === 'a' ? 'border-orange-500/40' : 'border-cyan-500/40';
  const accentBadge = team === 'a' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="max-w-md w-full bg-slate-950/95 backdrop-blur-xl border border-white/10 text-white p-5 rounded-3xl shadow-2xl z-50">
        <DialogHeader className="space-y-2 text-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className={`${accentBadge} text-[10px] font-black uppercase tracking-wider px-2 py-0.5`}>
                {teamName}
              </Badge>
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                Score Credit
              </span>
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-black px-2 py-0.5">
              +{points} {pointUnit}
            </Badge>
          </div>

          <DialogTitle className="text-xl sm:text-2xl font-black italic uppercase tracking-tight text-white flex items-center gap-2">
            <Sparkles className="size-5 text-orange-400 shrink-0" />
            <span>Who Scored This Point?</span>
          </DialogTitle>
          <DialogDescription className="text-xs font-bold text-slate-400">
            {actionDesc || actionType} for <strong className="text-slate-200">{teamName}</strong>. Tap the player to credit their match stats.
          </DialogDescription>
        </DialogHeader>

        {/* Active On-Court Players Grid */}
        <div className="mt-3 space-y-2">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>On-Court Active Roster ({activePlayers.length})</span>
            <span className="text-orange-400">Tap to Credit</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
            {activePlayers.map((player) => (
              <Button
                key={player.player_id}
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => onConfirmScore(player.player_id)}
                className={`h-auto py-2.5 px-3 flex items-center justify-start gap-2.5 rounded-xl bg-white/5 hover:bg-orange-500/20 border-white/10 hover:${accentBorder} transition-all text-left group`}
              >
                <div className="size-8 rounded-lg bg-orange-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  #{player.jersey_number ?? '--'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black text-white truncate group-hover:text-orange-400">
                    {resolvePlayerName(player)}
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 truncate">
                    {player.position || 'Player'}
                  </div>
                </div>
              </Button>
            ))}
          </div>

          {/* Team / Opponent Error / Uncredited Option */}
          <div className="pt-2 border-t border-white/10 mt-3 flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={isSubmitting}
              onClick={() => onConfirmScore(null)}
              className="w-full h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-black uppercase tracking-wider text-slate-300 hover:text-white flex items-center justify-center gap-2"
            >
              <Users className="size-4 text-slate-400" />
              <span>Team Point / Opponent Error (No Player Credit)</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
