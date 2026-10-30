import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FileBarChart2,
  Download,
  Printer,
  ArrowLeft,
  Trophy,
  Star,
  Users,
  Activity,
  Layers,
  Building,
  RotateCcw,
  CheckSquare,
  Square,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchInstitutionalReportData,
  generateReportCSV,
  downloadReportCSV,
  type InstitutionalReportData,
  type ReportFilterOptions
} from '@/lib/institutionalReportEngine';

// Strict 9 Ballgames
const OFFICIAL_BALLGAMES = [
  'Basketball',
  'Volleyball',
  'Soccer',
  'Futsal',
  'Sepak Takraw',
  'Baseball',
  'Softball',
  'Pickleball',
  'Table Tennis',
];

export const AdminReports: React.FC = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();

  const [filters, setFilters] = useState<ReportFilterOptions>({
    academicYear: 'current',
    sport: 'all',
    division: 'all',
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [reportData, setReportData] = useState<InstitutionalReportData | null>(null);

  // Section Visibility Toggles
  const [showWinningColleges, setShowWinningColleges] = useState(true);
  const [showStandings, setShowStandings] = useState(true);
  const [showMvpRecords, setShowMvpRecords] = useState(true);
  const [showParticipation, setShowParticipation] = useState(true);

  // Sub-tab for Standings
  const [standingsTab, setStandingsTab] = useState<'teams' | 'athletes'>('teams');

  const adminDisplayName = profile?.full_name || user?.email || 'Administrator';

  const loadReport = async () => {
    setIsLoading(true);
    try {
      const data = await fetchInstitutionalReportData(filters, adminDisplayName);
      setReportData(data);
    } catch (err: any) {
      console.error('Error compiling institutional report:', err);
      toast.error('Failed to compile institutional report data: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [filters]);

  const handleDownloadCSV = () => {
    if (!reportData) return;
    try {
      const csvContent = generateReportCSV(reportData);
      const yearPart = filters.academicYear === 'current' ? '2026' : filters.academicYear;
      const sportPart = filters.sport === 'all' ? 'all-sports' : filters.sport.toLowerCase().replace(/\s+/g, '-');
      const filename = `psu-sportstrack-institutional-report-${yearPart}-${sportPart}.csv`;
      downloadReportCSV(filename, csvContent);
      toast.success('Institutional Report CSV downloaded successfully.');
    } catch (err: any) {
      toast.error('Failed to generate CSV: ' + err.message);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const resetFilters = () => {
    setFilters({
      academicYear: 'current',
      sport: 'all',
      division: 'all',
    });
  };

  return (
    <div className="space-y-6 relative max-w-[1440px] mx-auto px-3 sm:px-4 md:px-6 pb-12 print:p-0 print:m-0 print:max-w-none">
      {/* Print-Only Professional Software Header */}
      <div className="hidden print:block mb-6 p-4 border-b-2 border-slate-900 bg-white text-slate-950">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight">PALAWAN STATE UNIVERSITY</h1>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">SportsTrack — Institutional Athletic Report</h2>
            <p className="text-[10px] text-slate-500 mt-1">Official Athletic Performance, Medal Tally &amp; Participation Dossier</p>
          </div>
          <div className="text-right text-[10px] space-y-0.5">
            <p><strong>Generated:</strong> {reportData?.metadata.generatedAt || new Date().toLocaleString()}</p>
            <p><strong>Officer:</strong> {adminDisplayName}</p>
            <p><strong>Scope:</strong> {reportData?.metadata.academicYear} • {reportData?.metadata.sportFilter}</p>
          </div>
        </div>
      </div>

      {/* Screen Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin')}
            className="size-9 p-0 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 cursor-pointer"
            title="Back to Admin Dashboard"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-1.5 text-orange-500 text-[10px] sm:text-xs font-bold uppercase tracking-widest">
              <FileBarChart2 className="size-3.5 sm:size-4" />
              <span>Administrative Compliance • FR-43</span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black italic tracking-tighter uppercase text-slate-900 dark:text-white leading-tight">
              Institutional <span className="text-orange-500">Report Generation</span>
            </h1>
          </div>
        </div>

        {/* Global Export Buttons */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleDownloadCSV}
            disabled={isLoading || !reportData}
            className="h-9 sm:h-10 px-3 sm:px-4 rounded-xl font-bold text-xs gap-1.5 border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:border-orange-500 cursor-pointer shadow-sm transition-all"
          >
            <Download className="size-3.5 text-orange-500" />
            <span>Download CSV</span>
          </Button>

          <Button
            type="button"
            onClick={handlePrint}
            disabled={isLoading || !reportData}
            className="h-9 sm:h-10 px-3 sm:px-4 rounded-xl font-bold text-xs gap-1.5 bg-orange-500 hover:bg-orange-600 text-white cursor-pointer shadow-md shadow-orange-500/25 transition-all"
          >
            <Printer className="size-3.5 text-white" />
            <span>Print / Save as PDF</span>
          </Button>
        </div>
      </div>

      {/* Control & Filter Deck (Hidden in Print) */}
      <Card className="rounded-2xl md:rounded-[2rem] border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm print:hidden">
        <CardContent className="p-3.5 sm:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/10">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
              <Filter className="size-4 text-orange-500" />
              <span>Report Parameters &amp; Scope</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500 dark:text-slate-400">
              <span>Audited Officer: <strong className="text-slate-800 dark:text-slate-200">{adminDisplayName}</strong></span>
              <span>•</span>
              <span>Active Sport Disciplines: <strong className="text-slate-800 dark:text-slate-200">Strict 9 Ballgames</strong></span>
            </div>
          </div>

          {/* Filter Dropdowns Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Academic Year */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Academic Period
              </label>
              <Select
                value={filters.academicYear}
                onValueChange={(val: string | null) => setFilters((prev) => ({ ...prev, academicYear: val || 'all' }))}
              >
                <SelectTrigger className="h-10 rounded-xl font-bold text-xs uppercase bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-white/10">
                  <SelectValue placeholder="Academic Period" />
                </SelectTrigger>
                <SelectContent className="rounded-xl font-bold uppercase text-xs">
                  <SelectItem value="current">Current (AY 2026)</SelectItem>
                  <SelectItem value="2026">Year 2026</SelectItem>
                  <SelectItem value="2025">Year 2025</SelectItem>
                  <SelectItem value="2024">Year 2024</SelectItem>
                  <SelectItem value="all">All Academic Periods</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ballgame Discipline */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Ballgame Discipline (9 Official)
              </label>
              <Select
                value={filters.sport}
                onValueChange={(val: string | null) => setFilters((prev) => ({ ...prev, sport: val || 'all' }))}
              >
                <SelectTrigger className="h-10 rounded-xl font-bold text-xs uppercase bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-white/10">
                  <SelectValue placeholder="All Ballgames" />
                </SelectTrigger>
                <SelectContent className="rounded-xl font-bold uppercase text-xs max-h-72">
                  <SelectItem value="all">All 9 Ballgames</SelectItem>
                  {OFFICIAL_BALLGAMES.map((sport) => (
                    <SelectItem key={sport} value={sport}>
                      {sport}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Division */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Tournament Division
              </label>
              <Select
                value={filters.division}
                onValueChange={(val: string | null) => setFilters((prev) => ({ ...prev, division: val || 'all' }))}
              >
                <SelectTrigger className="h-10 rounded-xl font-bold text-xs uppercase bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-white/10">
                  <SelectValue placeholder="All Divisions" />
                </SelectTrigger>
                <SelectContent className="rounded-xl font-bold uppercase text-xs">
                  <SelectItem value="all">All Divisions</SelectItem>
                  <SelectItem value="binturungan">Binturungan (Tribal Fest)</SelectItem>
                  <SelectItem value="collegiate">Inter-Collegiate</SelectItem>
                  <SelectItem value="friendly">Faculty &amp; Staff Friendly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Module Visibility Toggles */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-white/10">
            <div className="flex items-center gap-4 flex-wrap text-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Included Modules:</span>
              <button
                type="button"
                onClick={() => setShowWinningColleges((v) => !v)}
                className="flex items-center gap-1.5 font-bold cursor-pointer text-slate-700 dark:text-slate-300 hover:text-orange-500"
              >
                {showWinningColleges ? <CheckSquare className="size-4 text-orange-500" /> : <Square className="size-4 text-slate-400" />}
                <span>Winning Colleges</span>
              </button>
              <button
                type="button"
                onClick={() => setShowStandings((v) => !v)}
                className="flex items-center gap-1.5 font-bold cursor-pointer text-slate-700 dark:text-slate-300 hover:text-orange-500"
              >
                {showStandings ? <CheckSquare className="size-4 text-orange-500" /> : <Square className="size-4 text-slate-400" />}
                <span>Standings</span>
              </button>
              <button
                type="button"
                onClick={() => setShowMvpRecords((v) => !v)}
                className="flex items-center gap-1.5 font-bold cursor-pointer text-slate-700 dark:text-slate-300 hover:text-orange-500"
              >
                {showMvpRecords ? <CheckSquare className="size-4 text-orange-500" /> : <Square className="size-4 text-slate-400" />}
                <span>MVP Records</span>
              </button>
              <button
                type="button"
                onClick={() => setShowParticipation((v) => !v)}
                className="flex items-center gap-1.5 font-bold cursor-pointer text-slate-700 dark:text-slate-300 hover:text-orange-500"
              >
                {showParticipation ? <CheckSquare className="size-4 text-orange-500" /> : <Square className="size-4 text-slate-400" />}
                <span>Event Participation</span>
              </button>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-[11px] font-bold text-slate-500 hover:text-orange-500 gap-1 h-8 px-2 cursor-pointer"
            >
              <RotateCcw className="size-3" />
              <span>Reset Parameters</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="space-y-4">
          <Card className="p-8 text-center rounded-3xl animate-pulse bg-slate-100 dark:bg-slate-900 border-dashed border-slate-300 dark:border-white/10">
            <FileBarChart2 className="size-10 text-slate-400 mx-auto mb-2 animate-bounce" />
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Compiling Institutional Athletic Dossier...
            </h3>
            <p className="text-xs text-slate-400 mt-1">Aggregating tournament finals, standings, and star awards across PSU.</p>
          </Card>
        </div>
      ) : !reportData ? (
        <Card className="p-8 text-center rounded-3xl bg-slate-50 dark:bg-slate-900">
          <p className="text-sm font-bold text-slate-500">No report records found for the selected scope.</p>
        </Card>
      ) : (
        <div className="space-y-6 print:space-y-4">
          {/* Active Scope Summary Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent border border-orange-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black uppercase tracking-widest text-orange-600 dark:text-orange-400">Report Scope:</span>
              <Badge variant="outline" className="font-bold border-orange-500/30 text-slate-800 dark:text-slate-200">
                {reportData.metadata.academicYear}
              </Badge>
              <Badge variant="outline" className="font-bold border-orange-500/30 text-slate-800 dark:text-slate-200">
                {reportData.metadata.sportFilter}
              </Badge>
              <Badge variant="outline" className="font-bold border-orange-500/30 text-slate-800 dark:text-slate-200">
                {reportData.metadata.divisionFilter}
              </Badge>
            </div>
            <div className="text-slate-500 text-[11px] font-medium">
              Compiled on {reportData.metadata.generatedAt} by {reportData.metadata.generatedBy}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 1: Winning College per Sport per Year */}
          {/* ========================================================================= */}
          {showWinningColleges && (
            <Card className="rounded-2xl md:rounded-[2rem] border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm overflow-hidden print:border print:border-slate-400 print:shadow-none print:break-after-page">
              <CardHeader className="p-4 sm:p-5 border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02]">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                      <Trophy className="size-4 sm:size-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base sm:text-lg font-black uppercase italic tracking-tight text-slate-900 dark:text-white">
                        1. Winning College per Sport per Year
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Official crowned champions, runner-ups, and podium finishers from completed tournament finals.
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold border-amber-500/30">
                    {reportData.winningColleges.length} Crowned Champions
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {reportData.winningColleges.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs font-bold uppercase tracking-wider">
                    No completed championship tournaments found in this scope.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/75 dark:bg-white/5 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-white/10">
                        <tr>
                          <th className="py-3 px-3 sm:px-4">Year</th>
                          <th className="py-3 px-3 sm:px-4">Sport Discipline</th>
                          <th className="py-3 px-3 sm:px-4">Tournament Event</th>
                          <th className="py-3 px-3 sm:px-4">Gold / Champion College</th>
                          <th className="py-3 px-3 sm:px-4">Silver / Runner-Up</th>
                          <th className="py-3 px-3 sm:px-4">Bronze / 3rd Place</th>
                          <th className="py-3 px-3 sm:px-4 text-right">Finals Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                        {reportData.winningColleges.map((w) => (
                          <tr key={w.tournamentId} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                            <td className="py-3 px-3 sm:px-4 font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              {w.academicYear}
                            </td>
                            <td className="py-3 px-3 sm:px-4 font-black uppercase text-slate-900 dark:text-white whitespace-nowrap">
                              {w.sport}
                            </td>
                            <td className="py-3 px-3 sm:px-4 max-w-[200px] truncate" title={w.tournamentName}>
                              <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">{w.tournamentName}</span>
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider">{w.division}</span>
                            </td>
                            <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400 font-black text-[9px] uppercase border border-amber-500/30">
                                  {w.championCollegeCode}
                                </span>
                                <div>
                                  <span className="font-black text-slate-900 dark:text-white block">{w.championCollege}</span>
                                  <span className="text-[10px] text-slate-400">{w.championTeamName}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-bold text-[9px] uppercase">
                                  {w.runnerUpCollegeCode}
                                </span>
                                <div>
                                  <span className="font-bold text-slate-700 dark:text-slate-300 block">{w.runnerUpCollege}</span>
                                  <span className="text-[10px] text-slate-400">{w.runnerUpTeamName}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                              {w.bronzeCollegeCode !== '—' ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.5 rounded bg-amber-700/10 text-amber-700 dark:text-amber-500 font-bold text-[9px] uppercase">
                                    {w.bronzeCollegeCode}
                                  </span>
                                  <div>
                                    <span className="font-bold text-slate-700 dark:text-slate-300 block">{w.bronzeCollege}</span>
                                    <span className="text-[10px] text-slate-400">{w.bronzeTeamName}</span>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[11px] italic">Not contested</span>
                              )}
                            </td>
                            <td className="py-3 px-3 sm:px-4 text-right font-black tabular-nums text-slate-900 dark:text-white whitespace-nowrap">
                              {w.finalsScore}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ========================================================================= */}
          {/* SECTION 2: Athlete and Team Standings */}
          {/* ========================================================================= */}
          {showStandings && (
            <Card className="rounded-2xl md:rounded-[2rem] border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm overflow-hidden print:border print:border-slate-400 print:shadow-none print:break-after-page">
              <CardHeader className="p-4 sm:p-5 border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02]">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-orange-500/10 text-orange-500">
                      <Activity className="size-4 sm:size-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base sm:text-lg font-black uppercase italic tracking-tight text-slate-900 dark:text-white">
                        2. Athlete and Team Standings
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Official standings, win rates, and individual athlete scoring rankings across competitions.
                      </CardDescription>
                    </div>
                  </div>

                  {/* Sub-Tabs (Screen Only) */}
                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 p-1 rounded-xl print:hidden">
                    <button
                      type="button"
                      onClick={() => setStandingsTab('teams')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        standingsTab === 'teams'
                          ? 'bg-orange-500 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Team Standings ({reportData.teamStandings.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStandingsTab('athletes')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        standingsTab === 'athletes'
                          ? 'bg-orange-500 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Athlete Scorers ({reportData.athleteStandings.length})
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* 2A: Team Standings */}
                {(standingsTab === 'teams' || typeof window !== 'undefined') && (
                  <div className={`${standingsTab !== 'teams' ? 'print:block hidden' : 'block'}`}>
                    <div className="px-4 py-2 bg-slate-50 dark:bg-white/[0.01] border-b border-slate-100 dark:border-white/5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Section 2A: Squad &amp; College Match Standings
                    </div>
                    {reportData.teamStandings.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs font-bold uppercase tracking-wider">
                        No team match records found in this scope.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100/75 dark:bg-white/5 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-white/10">
                            <tr>
                              <th className="py-3 px-3 sm:px-4 w-12 text-center">Rank</th>
                              <th className="py-3 px-3 sm:px-4">Squad Name</th>
                              <th className="py-3 px-3 sm:px-4">College</th>
                              <th className="py-3 px-3 sm:px-4">Discipline</th>
                              <th className="py-3 px-3 sm:px-4 text-center">GP</th>
                              <th className="py-3 px-3 sm:px-4 text-center text-emerald-600 dark:text-emerald-400">W</th>
                              <th className="py-3 px-3 sm:px-4 text-center text-rose-600 dark:text-rose-400">L</th>
                              <th className="py-3 px-3 sm:px-4 text-center">Win %</th>
                              <th className="py-3 px-3 sm:px-4 text-center">PF</th>
                              <th className="py-3 px-3 sm:px-4 text-center">PA</th>
                              <th className="py-3 px-3 sm:px-4 text-right">Diff</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                            {reportData.teamStandings.slice(0, 30).map((t) => (
                              <tr key={t.teamId} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                                <td className="py-2.5 px-3 sm:px-4 text-center font-black text-slate-500">
                                  #{t.rank}
                                </td>
                                <td className="py-2.5 px-3 sm:px-4 font-black uppercase text-slate-900 dark:text-white whitespace-nowrap">
                                  {t.teamName}
                                </td>
                                <td className="py-2.5 px-3 sm:px-4 whitespace-nowrap">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 font-bold text-[9px] uppercase mr-1.5">
                                    {t.collegeCode}
                                  </span>
                                  <span className="text-slate-600 dark:text-slate-300">{t.collegeName}</span>
                                </td>
                                <td className="py-2.5 px-3 sm:px-4 font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                  {t.sport}
                                </td>
                                <td className="py-2.5 px-3 sm:px-4 text-center font-bold text-slate-600 dark:text-slate-400">{t.matchesPlayed}</td>
                                <td className="py-2.5 px-3 sm:px-4 text-center font-black text-emerald-600 dark:text-emerald-400">{t.wins}</td>
                                <td className="py-2.5 px-3 sm:px-4 text-center font-black text-rose-600 dark:text-rose-400">{t.losses}</td>
                                <td className="py-2.5 px-3 sm:px-4 text-center font-black tabular-nums">{t.winRate}%</td>
                                <td className="py-2.5 px-3 sm:px-4 text-center font-bold tabular-nums text-slate-700 dark:text-slate-300">{t.pointsFor}</td>
                                <td className="py-2.5 px-3 sm:px-4 text-center font-bold tabular-nums text-slate-500">{t.pointsAgainst}</td>
                                <td className={`py-2.5 px-3 sm:px-4 text-right font-black tabular-nums ${t.pointDiff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                  {t.pointDiff >= 0 ? `+${t.pointDiff}` : t.pointDiff}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* 2B: Athlete Scorers Standings */}
                {(standingsTab === 'athletes' || typeof window !== 'undefined') && (
                  <div className={`${standingsTab !== 'athletes' ? 'print:block hidden' : 'block'} border-t border-slate-100 dark:border-white/10`}>
                    <div className="px-4 py-2 bg-slate-50 dark:bg-white/[0.01] border-b border-slate-100 dark:border-white/5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Section 2B: Top Individual Athlete Scorers &amp; Performance
                    </div>
                    {reportData.athleteStandings.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs font-bold uppercase tracking-wider">
                        No athlete individual scoring data logged for this scope.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100/75 dark:bg-white/5 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-white/10">
                            <tr>
                              <th className="py-3 px-3 sm:px-4 w-12 text-center">Rank</th>
                              <th className="py-3 px-3 sm:px-4">Athlete Name</th>
                              <th className="py-3 px-3 sm:px-4">College</th>
                              <th className="py-3 px-3 sm:px-4">Discipline</th>
                              <th className="py-3 px-3 sm:px-4">Squad</th>
                              <th className="py-3 px-3 sm:px-4 text-center">GP</th>
                              <th className="py-3 px-3 sm:px-4 text-center">Total Points</th>
                              <th className="py-3 px-3 sm:px-4 text-center">PPG</th>
                              <th className="py-3 px-3 sm:px-4 text-right">MVPs</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                            {reportData.athleteStandings.slice(0, 30).map((a) => (
                              <tr key={a.playerId} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                                <td className="py-2.5 px-3 sm:px-4 text-center font-black text-slate-500">
                                  #{a.rank}
                                </td>
                                <td className="py-2.5 px-3 sm:px-4 font-black uppercase text-slate-900 dark:text-white whitespace-nowrap">
                                  {a.playerName}
                                </td>
                                <td className="py-2.5 px-3 sm:px-4 whitespace-nowrap">
                                  <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold text-[9px] uppercase mr-1.5">
                                    {a.collegeCode}
                                  </span>
                                  <span className="text-slate-600 dark:text-slate-300">{a.collegeName}</span>
                                </td>
                                <td className="py-2.5 px-3 sm:px-4 font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                  {a.sport}
                                </td>
                                <td className="py-2.5 px-3 sm:px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                  {a.teamName}
                                </td>
                                <td className="py-2.5 px-3 sm:px-4 text-center font-bold text-slate-600 dark:text-slate-400">{a.gamesPlayed}</td>
                                <td className="py-2.5 px-3 sm:px-4 text-center font-black text-orange-600 dark:text-orange-400 tabular-nums">{a.totalPoints}</td>
                                <td className="py-2.5 px-3 sm:px-4 text-center font-bold tabular-nums text-slate-800 dark:text-slate-200">{a.ppg}</td>
                                <td className="py-2.5 px-3 sm:px-4 text-right font-black tabular-nums text-amber-500">{a.mvpCount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ========================================================================= */}
          {/* SECTION 3: Gold Star and Red Star MVP Award Records */}
          {/* ========================================================================= */}
          {showMvpRecords && (
            <Card className="rounded-2xl md:rounded-[2rem] border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm overflow-hidden print:border print:border-slate-400 print:shadow-none print:break-after-page">
              <CardHeader className="p-4 sm:p-5 border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02]">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-yellow-500/10 text-yellow-500">
                      <Star className="size-4 sm:size-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base sm:text-lg font-black uppercase italic tracking-tight text-slate-900 dark:text-white">
                        3. Gold Star &amp; Red Star MVP Award Records
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Official individual distinction records: Gold Star (Tournament MVP) and Red Star (Match MVP).
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 font-bold border-yellow-500/30">
                    {reportData.mvpAwards.length} Stars Awarded
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {reportData.mvpAwards.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs font-bold uppercase tracking-wider">
                    No MVP star awards logged for this scope.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/75 dark:bg-white/5 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-white/10">
                        <tr>
                          <th className="py-3 px-3 sm:px-4">Award Distinction</th>
                          <th className="py-3 px-3 sm:px-4">Athlete Honoree</th>
                          <th className="py-3 px-3 sm:px-4">College</th>
                          <th className="py-3 px-3 sm:px-4">Discipline</th>
                          <th className="py-3 px-3 sm:px-4">Event Context</th>
                          <th className="py-3 px-3 sm:px-4 text-right">Award Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                        {reportData.mvpAwards.map((m) => {
                          const isGold = m.starType === 'Gold';
                          return (
                            <tr key={m.starId} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                              <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase border ${
                                  isGold
                                    ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/40 shadow-sm'
                                    : 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40'
                                }`}>
                                  <Star className="size-3 fill-current" />
                                  <span>{isGold ? 'Gold Star • Tourney MVP' : 'Red Star • Match MVP'}</span>
                                </span>
                              </td>
                              <td className="py-3 px-3 sm:px-4 font-black uppercase text-slate-900 dark:text-white whitespace-nowrap">
                                {m.athleteName}
                              </td>
                              <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 font-bold text-[9px] uppercase mr-1.5">
                                  {m.collegeCode}
                                </span>
                                <span className="text-slate-600 dark:text-slate-300">{m.collegeName}</span>
                              </td>
                              <td className="py-3 px-3 sm:px-4 font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                {m.sport}
                              </td>
                              <td className="py-3 px-3 sm:px-4 max-w-[240px] truncate" title={m.matchContext}>
                                <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">{m.tournamentName}</span>
                                <span className="text-[10px] text-slate-400 block truncate">{m.matchContext}</span>
                              </td>
                              <td className="py-3 px-3 sm:px-4 text-right font-bold text-slate-500 tabular-nums whitespace-nowrap">
                                {m.awardedDate}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ========================================================================= */}
          {/* SECTION 4: Event Participation Summary */}
          {/* ========================================================================= */}
          {showParticipation && (
            <Card className="rounded-2xl md:rounded-[2rem] border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm overflow-hidden print:border print:border-slate-400 print:shadow-none">
              <CardHeader className="p-4 sm:p-5 border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02]">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                      <Users className="size-4 sm:size-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base sm:text-lg font-black uppercase italic tracking-tight text-slate-900 dark:text-white">
                        4. Event Participation Summaries
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Athletic participation volumes, squad enrollments, and college distribution across official ballgame disciplines.
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-6">
                {/* 4A: Participation Breakdown by Sport */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Layers className="size-3.5 text-orange-500" />
                    <span>Summary 4A: Participation Metrics by Official PSU Ballgame Discipline</span>
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/75 dark:bg-white/5 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-white/10">
                        <tr>
                          <th className="py-2.5 px-3">Ballgame Discipline</th>
                          <th className="py-2.5 px-3 text-center">Tournaments Hosted</th>
                          <th className="py-2.5 px-3 text-center">Active Squads</th>
                          <th className="py-2.5 px-3 text-center">Enrolled Athletes</th>
                          <th className="py-2.5 px-3 text-center">Colleges Represented</th>
                          <th className="py-2.5 px-3 text-right">Colleges List</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                        {reportData.sportParticipation.map((sp) => (
                          <tr key={sp.sport} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                            <td className="py-2.5 px-3 font-black uppercase text-slate-900 dark:text-white">
                              {sp.sport}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-700 dark:text-slate-300">{sp.totalTournaments}</td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-700 dark:text-slate-300">{sp.totalTeams}</td>
                            <td className="py-2.5 px-3 text-center font-black text-orange-600 dark:text-orange-400">{sp.totalAthletes}</td>
                            <td className="py-2.5 px-3 text-center font-bold">{sp.collegesRepresented}</td>
                            <td className="py-2.5 px-3 text-right font-medium text-slate-500 text-[11px]">
                              {sp.collegeCodes.join(', ') || 'None'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4B: Participation & Medal Tally by College */}
                <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-white/10">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Building className="size-3.5 text-orange-500" />
                    <span>Summary 4B: Institutional College Participation &amp; Medal Overview</span>
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/75 dark:bg-white/5 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-white/10">
                        <tr>
                          <th className="py-2.5 px-3">College / Institutional Unit</th>
                          <th className="py-2.5 px-3 text-center">Disciplines</th>
                          <th className="py-2.5 px-3 text-center">Squads</th>
                          <th className="py-2.5 px-3 text-center">Athletes</th>
                          <th className="py-2.5 px-3 text-center text-amber-600 font-bold">Gold / Titles</th>
                          <th className="py-2.5 px-3 text-center text-slate-600 font-bold">Silver / 2nd</th>
                          <th className="py-2.5 px-3 text-center text-yellow-600 font-bold">Gold Stars</th>
                          <th className="py-2.5 px-3 text-right text-rose-600 font-bold">Red Stars</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                        {reportData.collegeParticipation.map((cp) => (
                          <tr key={cp.collegeCode} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                            <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                              <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400 font-black text-[9px] uppercase mr-2">
                                {cp.collegeCode}
                              </span>
                              <span>{cp.collegeName}</span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-600 dark:text-slate-400">{cp.participatingSports.length}</td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-700 dark:text-slate-300">{cp.totalTeams}</td>
                            <td className="py-2.5 px-3 text-center font-black text-slate-900 dark:text-white">{cp.totalAthletes}</td>
                            <td className="py-2.5 px-3 text-center font-black text-amber-600 dark:text-amber-400">{cp.championships}</td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-500">{cp.runnerUps}</td>
                            <td className="py-2.5 px-3 text-center font-black text-yellow-500">{cp.goldStars}</td>
                            <td className="py-2.5 px-3 text-right font-black text-rose-500">{cp.redStars}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Report Footer Certification Block (Print Friendly) */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-white/[0.02] text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <p className="font-bold text-slate-700 dark:text-slate-300">
                Palawan State University SportsTrack System Report Verification
              </p>
              <p className="text-[10px] text-slate-400">
                Data generated directly from audited PostgreSQL match scorecards and institutional tournament registries.
              </p>
            </div>
            <div className="text-right text-[10px] shrink-0 font-medium">
              <span>Verified System Record • Page 1 of 1</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
