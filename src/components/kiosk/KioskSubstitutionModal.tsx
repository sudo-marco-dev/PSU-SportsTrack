import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeftRight, UserMinus, UserPlus, Check, X } from 'lucide-react';

export type RosterPlayerItem = {
  id: string;
  team_id: string;
  player_id: string;
  jersey_number?: number | null;
  position?: string | null;
  is_captain?: boolean;
  is_starter?: boolean;
  users?: {
    full_name: string;
  } | Array<{ full_name: string }> | null;
};

type KioskSubstitutionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  teamName: string;
  activePlayers: RosterPlayerItem[];
  benchPlayers: RosterPlayerItem[];
  onConfirmSub: (subOutPlayer: RosterPlayerItem, subInPlayer: RosterPlayerItem) => void;
  isSubmitting?: boolean;
};

export const KioskSubstitutionModal = ({
  isOpen,
  onClose,
  teamName,
  activePlayers,
  benchPlayers,
  onConfirmSub,
  isSubmitting = false,
}: KioskSubstitutionModalProps) => {
  const [selectedSubOutId, setSelectedSubOutId] = useState<string>('');
  const [selectedSubInId, setSelectedSubInId] = useState<string>('');

  const subOutPlayer = activePlayers.find((p) => p.player_id === selectedSubOutId);
  const subInPlayer = benchPlayers.find((p) => p.player_id === selectedSubInId);

  const getPlayerName = (player?: RosterPlayerItem) => {
    if (!player) return '';
    const users = player.users;
    return Array.isArray(users) ? users[0]?.full_name : users?.full_name || 'Player';
  };

  const getJersey = (player?: RosterPlayerItem) => {
    if (!player || player.jersey_number === null || player.jersey_number === undefined) return '#--';
    return `#${player.jersey_number}`;
  };

  const handleExecute = () => {
    if (!subOutPlayer || !subInPlayer) return;
    onConfirmSub(subOutPlayer, subInPlayer);
    setSelectedSubOutId('');
    setSelectedSubInId('');
    onClose();
  };

  const handleClose = () => {
    setSelectedSubOutId('');
    setSelectedSubInId('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent showCloseButton={false} className="max-w-2xl bg-slate-950 border border-white/10 text-white p-6 shadow-2xl rounded-2xl sm:rounded-3xl">
        <DialogHeader className="border-b border-white/10 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400">
                <ArrowLeftRight className="size-5" />
              </span>
              <div>
                <DialogTitle className="text-xl font-black uppercase italic tracking-tight text-white">
                  Quick Substitution • <span className="text-orange-400">{teamName}</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Select 1 player coming off court and 1 bench player coming in.
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="text-slate-400 hover:text-white rounded-lg size-8"
            >
              <X className="size-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Selected Swap Banner Preview */}
        <div className="my-2 p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex items-center gap-1 font-bold text-red-400 uppercase tracking-wider text-[11px]">
              <UserMinus className="size-3.5" /> Sub Out:
            </span>
            <span className="font-black text-white truncate">
              {subOutPlayer ? `${getJersey(subOutPlayer)} ${getPlayerName(subOutPlayer)}` : 'Select active player...'}
            </span>
          </div>
          <ArrowLeftRight className="size-4 text-orange-400 shrink-0 mx-2" />
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex items-center gap-1 font-bold text-emerald-400 uppercase tracking-wider text-[11px]">
              <UserPlus className="size-3.5" /> Sub In:
            </span>
            <span className="font-black text-white truncate">
              {subInPlayer ? `${getJersey(subInPlayer)} ${getPlayerName(subInPlayer)}` : 'Select bench player...'}
            </span>
          </div>
        </div>

        {/* Two-Column Selection: On Court vs Bench */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-2">
          {/* Active Players on Court (Sub Out) */}
          <div className="space-y-2 border border-white/10 rounded-xl p-3 bg-slate-900/40">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-[11px] font-black uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                <UserMinus className="size-3.5" /> 1. Select Player Off Court
              </span>
              <Badge variant="outline" className="text-[10px] border-white/10 text-slate-400">
                {activePlayers.length} Active
              </Badge>
            </div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {activePlayers.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No active players assigned.</p>
              ) : (
                activePlayers.map((player) => {
                  const isSelected = selectedSubOutId === player.player_id;
                  return (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => setSelectedSubOutId(player.player_id)}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-red-500/20 border-2 border-red-500 text-white font-black shadow-md'
                          : 'bg-white/5 hover:bg-white/10 border border-white/5 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-black text-xs px-1.5 py-0.5 rounded bg-slate-950 border border-white/10 text-orange-400 shrink-0">
                          {getJersey(player)}
                        </span>
                        <span className="text-xs truncate">{getPlayerName(player)}</span>
                      </div>
                      {isSelected && <Check className="size-4 text-red-400 shrink-0 ml-1" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Bench / Reserves (Sub In) */}
          <div className="space-y-2 border border-white/10 rounded-xl p-3 bg-slate-900/40">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <UserPlus className="size-3.5" /> 2. Select Bench Player In
              </span>
              <Badge variant="outline" className="text-[10px] border-white/10 text-slate-400">
                {benchPlayers.length} Available
              </Badge>
            </div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {benchPlayers.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No bench reserves remaining.</p>
              ) : (
                benchPlayers.map((player) => {
                  const isSelected = selectedSubInId === player.player_id;
                  return (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => setSelectedSubInId(player.player_id)}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-500/20 border-2 border-emerald-500 text-white font-black shadow-md'
                          : 'bg-white/5 hover:bg-white/10 border border-white/5 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-black text-xs px-1.5 py-0.5 rounded bg-slate-950 border border-white/10 text-orange-400 shrink-0">
                          {getJersey(player)}
                        </span>
                        <span className="text-xs truncate">{getPlayerName(player)}</span>
                      </div>
                      {isSelected && <Check className="size-4 text-emerald-400 shrink-0 ml-1" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Modal Action Controls */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            className="text-slate-400 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleExecute}
            disabled={!subOutPlayer || !subInPlayer || isSubmitting}
            className="bg-orange-500 hover:bg-orange-600 text-slate-950 font-black uppercase tracking-wider text-xs px-6 py-2 rounded-xl shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-all disabled:opacity-40 cursor-pointer"
          >
            <Check className="size-4 mr-1.5" />
            Confirm Substitution
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
