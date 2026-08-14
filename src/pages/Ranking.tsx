import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, Medal, Filter, Sparkles, Shield, RotateCcw } from 'lucide-react';

export const Ranking = () => {
  // Filter States
  const [tournamentType, setTournamentType] = useState<string>('all');
  const [sportCategory, setSportCategory] = useState<string>('all');
  const [winMetric, setWinMetric] = useState<string>('most wins');
  const [academicYear, setAcademicYear] = useState<string>('current');

  const handleResetFilters = () => {
    setTournamentType('all');
    setSportCategory('all');
    setWinMetric('most_wins');
    setAcademicYear('current');
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      {/* Header Banner */}
      <div className="bg-slate-950 text-white py-8 px-6 md:px-10 rounded-[2.5rem] shadow-2xl border border-white/5 relative overflow-hidden group">
        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center gap-2 mb-3">
            <Medal className="w-5 h-5 text-orange-500" />
            <span className="text-orange-500 font-bold text-xs tracking-[0.2em] uppercase">
              Official Leaderboard & Standings
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter leading-none mb-3">
            LEADERBOARD <span className="text-orange-500">& RANKINGS</span>
          </h1>
          <p className="text-slate-400 font-medium text-sm leading-relaxed max-w-2xl opacity-90">
            Institutional sports performance standings, championship tier lists, and athlete win analytics across PSU sports tournaments.
          </p>
        </div>
        <div className="absolute -right-16 -top-16 size-80 bg-orange-500/10 rounded-full blur-[100px] group-hover:bg-orange-500/20 transition-all duration-1000" />
        <Trophy className="absolute -bottom-10 -right-8 size-52 text-white/5 rotate-12 group-hover:rotate-6 transition-all duration-700 pointer-events-none" />
      </div>

      {/* Filter Control Section - Clean & Formal Enterprise Styling */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden transition-all">
        {/* Filter Toolbar Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <Filter className="size-4 text-slate-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Standing Filters
            </h3>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-xs text-slate-500 font-normal">
              Select parameters to refine leaderboard view
            </span>
          </div>

          <div className="flex items-center gap-3">
            {(tournamentType !== 'all' || sportCategory !== 'all' || winMetric !== 'most_wins' || academicYear !== 'current') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-8 px-3 text-xs font-semibold text-slate-500 hover:text-orange-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg gap-1.5 transition-colors"
              >
                <RotateCcw className="size-3" />
                Reset Defaults
              </Button>
            )}
          </div>
        </div>

        {/* Filter Input Grid */}
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* 1. Tournament Type */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Tournament Category
              </label>
              <Select value={tournamentType} onValueChange={(v) => v && setTournamentType(v)}>
                <SelectTrigger className="h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 shadow-none hover:border-slate-300 dark:hover:border-slate-700 focus:ring-1 focus:ring-slate-400 transition-colors">
                  <SelectValue placeholder="All Tournaments" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                  <SelectItem value="all" className="text-xs font-medium">All Competitions</SelectItem>
                  <SelectItem value="Binturungan" className="text-xs font-medium">Binturungan</SelectItem>
                  <SelectItem value="STRASUC" className="text-xs font-medium">STRASUC</SelectItem>
                  <SelectItem value="Faculty and Staff Friendly Games" className="text-xs font-medium">Faculty & Staff Friendly Games</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 2. Sport Category */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Sport Discipline
              </label>
              <Select value={sportCategory} onValueChange={(v) => v && setSportCategory(v)}>
                <SelectTrigger className="h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 shadow-none hover:border-slate-300 dark:hover:border-slate-700 focus:ring-1 focus:ring-slate-400 transition-colors">
                  <SelectValue placeholder="All Sports" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                  <SelectItem value="all" className="text-xs font-medium">All Sports</SelectItem>
                  <SelectItem value="Basketball" className="text-xs font-medium">Basketball</SelectItem>
                  <SelectItem value="Volleyball" className="text-xs font-medium">Volleyball</SelectItem>
                  <SelectItem value="Badminton" className="text-xs font-medium">Badminton</SelectItem>
                  <SelectItem value="Football" className="text-xs font-medium">Football</SelectItem>
                  <SelectItem value="Sepak Takraw" className="text-xs font-medium">Sepak Takraw</SelectItem>
                  <SelectItem value="Table Tennis" className="text-xs font-medium">Table Tennis</SelectItem>
                  <SelectItem value="Chess" className="text-xs font-medium">Chess</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 3. Win Metric */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Ranking Criterion
              </label>
              <Select value={winMetric} onValueChange={(v) => v && setWinMetric(v)}>
                <SelectTrigger className="h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 shadow-none hover:border-slate-300 dark:hover:border-slate-700 focus:ring-1 focus:ring-slate-400 transition-colors">
                  <SelectValue placeholder="Most Wins" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                  <SelectItem value="most_wins" className="text-xs font-medium">Most Match Wins</SelectItem>
                  <SelectItem value="overall_wins" className="text-xs font-medium">Overall Championships (1st Place)</SelectItem>
                  <SelectItem value="win_rate" className="text-xs font-medium">Win Ratio Percentage (%)</SelectItem>
                  <SelectItem value="mvp_stars" className="text-xs font-medium">MVP Gold Stars Awarded</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 4. Competition Year */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Academic Period
              </label>
              <Select value={academicYear} onValueChange={(v) => v && setAcademicYear(v)}>
                <SelectTrigger className="h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 shadow-none hover:border-slate-300 dark:hover:border-slate-700 focus:ring-1 focus:ring-slate-400 transition-colors">
                  <SelectValue placeholder="Current Season" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                  <SelectItem value="current" className="text-xs font-medium">Current Season (2026)</SelectItem>
                  <SelectItem value="2025" className="text-xs font-medium">Academic Year 2025</SelectItem>
                  <SelectItem value="2024" className="text-xs font-medium">Academic Year 2024</SelectItem>
                  <SelectItem value="all_time" className="text-xs font-medium">All-Time Cumulative</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Filter Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-5 mt-5 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-medium text-slate-400">Active Criteria:</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
              {tournamentType === 'all' ? 'All Competitions' : tournamentType}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
              {sportCategory === 'all' ? 'All Sports' : sportCategory}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
              {winMetric === 'most_wins' ? 'Most Match Wins' : winMetric === 'overall_wins' ? 'Overall Championships' : winMetric === 'win_rate' ? 'Win Ratio (%)' : 'MVP Gold Stars'}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
              {academicYear === 'current' ? 'Current Season (2026)' : academicYear === 'all_time' ? 'All-Time' : `AY ${academicYear}`}
            </span>
          </div>
        </div>
      </div>

      {/* Podium Preview Section (Placeholder Architecture) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Rank 2 - Silver */}
        <Card className="rounded-[2.5rem] border-2 border-slate-100 dark:border-white/5 bg-white/70 dark:bg-slate-900/60 backdrop-blur-sm p-6 text-center relative overflow-hidden order-2 md:order-1">
          <div className="size-16 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center mx-auto mb-4 text-slate-400 font-black text-2xl shadow-inner">
            2
          </div>
          <h4 className="font-black italic uppercase tracking-tight text-xl text-slate-900 dark:text-white">Silver Tier</h4>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Runner-Up Standings</p>
          <div className="mt-6 py-6 border-t border-dashed border-slate-200 dark:border-white/10">
            <span className="text-xs font-bold text-slate-400 italic">Standings compiling...</span>
          </div>
        </Card>

        {/* Rank 1 - Gold */}
        <Card className="rounded-[2.5rem] border-2 border-orange-500/40 bg-gradient-to-b from-orange-500/10 to-transparent dark:from-orange-500/10 dark:to-slate-900/60 backdrop-blur-sm p-8 text-center relative overflow-hidden shadow-2xl shadow-orange-500/10 order-1 md:order-2 scale-105 border-t-4 border-t-orange-500">
          <div className="size-20 rounded-3xl bg-orange-500 flex items-center justify-center mx-auto mb-4 text-white font-black text-3xl shadow-xl shadow-orange-500/30">
            <Medal className="size-10 text-white" />
          </div>
          <Badge className="bg-orange-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 mb-2">
            Top Seed
          </Badge>
          <h4 className="font-black italic uppercase tracking-tight text-2xl text-slate-900 dark:text-white">Champion Tier</h4>
          <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mt-1">First Place Leaderboard</p>
          <div className="mt-6 py-6 border-t border-dashed border-orange-200 dark:border-orange-500/20">
            <span className="text-xs font-bold text-orange-500/80 italic">Awaiting tournament match dataset</span>
          </div>
        </Card>

        {/* Rank 3 - Bronze */}
        <Card className="rounded-[2.5rem] border-2 border-slate-100 dark:border-white/5 bg-white/70 dark:bg-slate-900/60 backdrop-blur-sm p-6 text-center relative overflow-hidden order-3">
          <div className="size-16 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center mx-auto mb-4 text-amber-700/60 dark:text-amber-500/60 font-black text-2xl shadow-inner">
            3
          </div>
          <h4 className="font-black italic uppercase tracking-tight text-xl text-slate-900 dark:text-white">Bronze Tier</h4>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">3rd Place Standings</p>
          <div className="mt-6 py-6 border-t border-dashed border-slate-200 dark:border-white/10">
            <span className="text-xs font-bold text-slate-400 italic">Standings compiling...</span>
          </div>
        </Card>
      </div>

      {/* Standings Table Placeholder / Awaiting Data Empty State */}
      <Card className="border-2 border-dashed border-slate-200 dark:border-white/10 rounded-[2.5rem] py-16 px-6 text-center bg-slate-50/50 dark:bg-slate-900/20 relative overflow-hidden">
        <div className="max-w-md mx-auto space-y-4">
          <div className="size-16 rounded-3xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mx-auto text-slate-400 shadow-inner">
            <Sparkles className="size-8 text-orange-500 animate-pulse" />
          </div>
          <h3 className="text-2xl font-black italic uppercase tracking-tight text-slate-800 dark:text-white">
            Leaderboard Compiling
          </h3>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
            Historical and season standings data are currently being aggregated. Live rankings will populate automatically as tournament matches and official records are finalized.
          </p>
          <div className="pt-2 flex items-center justify-center gap-2 text-slate-400 text-xs font-semibold">
            <Shield className="size-4 text-orange-500" />
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Filters configured and ready for live computation
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
};
