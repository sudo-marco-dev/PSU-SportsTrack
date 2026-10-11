import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Trophy, 
  Activity, 
  Star, 
  ShieldCheck, 
  Sparkles, 
  CheckCircle2, 
  Globe, 
  Medal, 
  Users, 
  ArrowRight,
  School
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';

export const About: React.FC = () => {
  const { user, openLoginModal } = useAuth();

  return (
    <div className="min-h-full w-full py-6 sm:py-10 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-8 sm:space-y-12 animate-in fade-in duration-300">
      {/* Hero Showcase Header */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-[2.5rem] bg-slate-950 border border-white/10 p-6 sm:p-10 lg:p-12 text-white shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-1 bg-orange-500" />

        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] sm:text-xs font-black uppercase tracking-widest">
            <School className="size-3.5" />
            <span>Palawan State University • Official Athletic Platform</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black italic uppercase tracking-tight text-white leading-tight">
            Digital Arena for <span className="text-orange-500">PSU Athletics</span> &amp; Competitions
          </h1>

          <p className="text-slate-300 font-medium text-xs sm:text-sm lg:text-base leading-relaxed">
            PSU SportsTrack connects student-athletes, coaches, and university athletic administrators in an integrated digital hub for campus sports, live scores, and official tournament records.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Link to="/explorer">
              <Button className="bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic tracking-wider text-xs h-11 px-5 rounded-xl shadow-lg shadow-orange-500/20">
                Explore Matches <ArrowRight className="size-4 ml-1.5" />
              </Button>
            </Link>
            {!user && (
              <Button 
                onClick={openLoginModal}
                className="bg-slate-900 hover:bg-slate-800 text-white border border-white/15 font-bold uppercase text-xs h-11 px-5 rounded-xl transition-all shadow-sm"
              >
                Sign In to Portal
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Core Platform Pillars */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <div className="size-6 sm:size-7 rounded-lg sm:rounded-xl bg-orange-500 text-white font-black text-xs flex items-center justify-center shadow-md">
            ★
          </div>
          <h2 className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">
            Platform Capabilities &amp; Features
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <Card className="rounded-2xl border-slate-200/80 dark:border-white/10 shadow-sm hover:shadow-md transition-all p-5 sm:p-6 bg-white dark:bg-slate-900 flex flex-col justify-between">
            <CardContent className="p-0 space-y-3">
              <div className="size-11 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center border border-orange-500/20 shadow-sm">
                <Activity className="size-5" />
              </div>
              <h3 className="font-black italic uppercase tracking-tight text-base sm:text-lg text-slate-900 dark:text-white">
                Live Matchroom &amp; Real-Time Tracking
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-normal leading-relaxed">
                Instant point scoring, live referee play-by-play events, and public leaderboard streams across all campus sports disciplines.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200/80 dark:border-white/10 shadow-sm hover:shadow-md transition-all p-5 sm:p-6 bg-white dark:bg-slate-900 flex flex-col justify-between">
            <CardContent className="p-0 space-y-3">
              <div className="size-11 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center border border-orange-500/20 shadow-sm">
                <Trophy className="size-5" />
              </div>
              <h3 className="font-black italic uppercase tracking-tight text-base sm:text-lg text-slate-900 dark:text-white">
                Tournament Arena &amp; Bracket Seeding
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-normal leading-relaxed">
                Automated single-elimination trees, round-robin pools, match venue slotting, and official administrator score verification.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200/80 dark:border-white/10 shadow-sm hover:shadow-md transition-all p-5 sm:p-6 bg-white dark:bg-slate-900 flex flex-col justify-between">
            <CardContent className="p-0 space-y-3">
              <div className="size-11 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center border border-orange-500/20 shadow-sm">
                <Star className="size-5" />
              </div>
              <h3 className="font-black italic uppercase tracking-tight text-base sm:text-lg text-slate-900 dark:text-white">
                Roster Verification &amp; Hall of Fame MVPs
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-normal leading-relaxed">
                Verified team application screening, athlete eligibility badges, and Gold/Red Star MVP honors recognized across university profiles.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Trust & Verification Badges */}
      <div className="bg-slate-900 text-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center sm:text-left">
          <h4 className="font-black italic uppercase tracking-tight text-sm sm:text-base text-white">
            Official University Athletics Standards
          </h4>
          <p className="text-slate-400 text-xs font-normal">
            Certified by the Palawan State University Sports Governance Board.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <span className="px-3.5 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs font-medium text-slate-200 flex items-center gap-2">
            <CheckCircle2 className="size-3.5 text-emerald-400" /> Real-time Scores
          </span>
          <span className="px-3.5 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs font-medium text-slate-200 flex items-center gap-2">
            <ShieldCheck className="size-3.5 text-orange-400" /> Verified PSU Athletes
          </span>
          <span className="px-3.5 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs font-medium text-slate-200 flex items-center gap-2">
            <Sparkles className="size-3.5 text-yellow-400" /> Official Brackets
          </span>
        </div>
      </div>

      {/* Fast Navigation Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        <Link 
          to="/explorer" 
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 hover:border-orange-500/50 hover:bg-orange-50/20 dark:hover:bg-slate-800 transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <Globe className="size-5 text-orange-500" />
            <span className="font-bold text-xs uppercase text-slate-800 dark:text-slate-200">Match Center</span>
          </div>
          <ArrowRight className="size-4 text-slate-400 dark:text-slate-500 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
        </Link>

        <Link 
          to="/ranking" 
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 hover:border-orange-500/50 hover:bg-orange-50/20 dark:hover:bg-slate-800 transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <Medal className="size-5 text-orange-500" />
            <span className="font-bold text-xs uppercase text-slate-800 dark:text-slate-200">Standings &amp; Rankings</span>
          </div>
          <ArrowRight className="size-4 text-slate-400 dark:text-slate-500 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
        </Link>

        <Link 
          to={user ? "/profile" : "/"} 
          onClick={() => { if (!user) openLoginModal(); }}
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 hover:border-orange-500/50 hover:bg-orange-50/20 dark:hover:bg-slate-800 transition-all flex items-center justify-between group cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <Users className="size-5 text-orange-500" />
            <span className="font-bold text-xs uppercase text-slate-800 dark:text-slate-200">{user ? "My Athlete Profile" : "Athlete Portal Login"}</span>
          </div>
          <ArrowRight className="size-4 text-slate-400 dark:text-slate-500 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
        </Link>
      </div>
    </div>
  );
};
