import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { BookOpen, Trophy, Shield, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SportsLegendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SportsLegendModal: React.FC<SportsLegendModalProps> = ({ isOpen, onClose }) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full sm:max-w-2xl max-w-[95vw] max-h-[88dvh] overflow-y-auto rounded-3xl border-slate-200 dark:border-white/10 p-5 sm:p-7 shadow-2xl bg-white dark:bg-slate-950">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-orange-500 rounded-xl text-white shadow-md shadow-orange-500/20">
              <BookOpen className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-xl sm:text-2xl font-black italic uppercase tracking-tight text-slate-900 dark:text-white">
                Sports Metrics <span className="text-orange-500">&amp; Legends</span>
              </DialogTitle>
              <DialogDescription className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Official guide to abbreviations, scoring terms, and rankings calculations across PSU SportsTrack
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-3 text-slate-700 dark:text-slate-200 text-xs sm:text-sm">
          {/* 1. Standings & Leaderboard Abbreviations */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <Trophy className="size-4 text-orange-500" />
              <h3 className="font-black uppercase tracking-wider text-xs sm:text-sm text-slate-900 dark:text-white">
                Leaderboard &amp; Standings Abbreviations
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Badge className="bg-orange-500 text-white font-mono text-[10px] font-black">PF</Badge>
                  <span className="font-black text-slate-900 dark:text-white text-xs">Points For</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Total points, goals, or runs scored by a team across all completed tournament matches.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Badge className="bg-slate-700 text-white font-mono text-[10px] font-black">PA</Badge>
                  <span className="font-black text-slate-900 dark:text-white text-xs">Points Against</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Total points, goals, or runs allowed / surrendered to opposing squads.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Badge className="bg-emerald-600 text-white font-mono text-[10px] font-black">DIFF</Badge>
                  <span className="font-black text-slate-900 dark:text-white text-xs">Point Differential</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Net scoring margin computed as <strong className="font-mono text-emerald-500">PF − PA</strong>. Used as the premier tiebreaker in pool standings.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Badge className="bg-blue-600 text-white font-mono text-[10px] font-black">GP</Badge>
                  <span className="font-black text-slate-900 dark:text-white text-xs">Games Played</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Total count of scheduled fixtures where the team or athlete actively participated.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Badge className="bg-amber-500 text-slate-950 font-mono text-[10px] font-black">W - L</Badge>
                  <span className="font-black text-slate-900 dark:text-white text-xs">Win-Loss Record</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Total head-to-head victories and defeats. Win rate is calculated as <strong className="font-mono text-amber-500">(W / GP) × 100%</strong>.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Badge className="bg-purple-600 text-white font-mono text-[10px] font-black">PPG</Badge>
                  <span className="font-black text-slate-900 dark:text-white text-xs">Points Per Game</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Individual athlete scoring efficiency, calculated as <strong className="font-mono text-purple-500">Total Points / Games Played</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* 2. Official 9 Ballgames & Scoring Units */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <Activity className="size-4 text-orange-500" />
              <h3 className="font-black uppercase tracking-wider text-xs sm:text-sm text-slate-900 dark:text-white">
                Official 9 Ballgame Scoring Units
              </h3>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px]">
                <div>
                  <span className="font-black text-orange-500 block">Basketball:</span>
                  <span className="text-slate-500 dark:text-slate-400">Points (PTS) • 1FT, 2PT, 3PT</span>
                </div>
                <div>
                  <span className="font-black text-orange-500 block">Volleyball:</span>
                  <span className="text-slate-500 dark:text-slate-400">Sets &amp; Points • Rally Scoring</span>
                </div>
                <div>
                  <span className="font-black text-orange-500 block">Soccer:</span>
                  <span className="text-slate-500 dark:text-slate-400">Goals • Regular, Extra Time, PK</span>
                </div>
                <div>
                  <span className="font-black text-orange-500 block">Futsal:</span>
                  <span className="text-slate-500 dark:text-slate-400">Goals • Accumulated Foul Penalty</span>
                </div>
                <div>
                  <span className="font-black text-orange-500 block">Sepak Takraw:</span>
                  <span className="text-slate-500 dark:text-slate-400">Regu Sets &amp; Points (21 pts)</span>
                </div>
                <div>
                  <span className="font-black text-orange-500 block">Baseball:</span>
                  <span className="text-slate-500 dark:text-slate-400">Runs (RBI, 2-Run, Grand Slam)</span>
                </div>
                <div>
                  <span className="font-black text-orange-500 block">Softball:</span>
                  <span className="text-slate-500 dark:text-slate-400">Runs • 7-Inning Format</span>
                </div>
                <div>
                  <span className="font-black text-orange-500 block">Table Tennis:</span>
                  <span className="text-slate-500 dark:text-slate-400">Games &amp; Points (11-pt win by 2)</span>
                </div>
                <div>
                  <span className="font-black text-orange-500 block">Pickleball:</span>
                  <span className="text-slate-500 dark:text-slate-400">Games &amp; Rally Points (11 pts)</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Player Awards & Governance */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <Shield className="size-4 text-orange-500" />
              <h3 className="font-black uppercase tracking-wider text-xs sm:text-sm text-slate-900 dark:text-white">
                Awards &amp; Governance Badges
              </h3>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 space-y-2 text-[11px]">
              <div className="flex items-start gap-2">
                <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20 font-black shrink-0">Red Star ★</span>
                <p className="text-slate-500 dark:text-slate-400">
                  <strong>Match MVP:</strong> Awarded to the top-performing athlete at the end of each completed match. Requires facilitator attestation and is audited by database triggers.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-black shrink-0">Gold Star ★</span>
                <p className="text-slate-500 dark:text-slate-400">
                  <strong>Tournament MVP:</strong> Institutional award recognizing the best overall athlete of the entire championship tournament.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200/80 dark:border-white/10 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider transition-all"
          >
            Got It
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
