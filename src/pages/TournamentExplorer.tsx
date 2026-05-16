import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Globe, Clock, ChevronRight, PlayCircle, History, Filter } from 'lucide-react';

type Tournament = {
  id: string;
  name: string;
  status: string;
  start_date: string;
};

type Match = {
  id: string;
  tournament_id: string;
  team_a_score: number;
  team_b_score: number;
  status: 'Scheduled' | 'Ongoing' | 'Completed';
  round: string;
  match_time: string;
  team_a: { name: string } | null;
  team_b: { name: string } | null;
};

export const TournamentExplorer = () => {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | 'all'>('all');
  const [activeTab, setActiveTab] = useState("live");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchExplorerData();
  }, []);

  const fetchExplorerData = async () => {
    setIsLoading(true);
    try {
      const [tournamentsRes, matchesRes] = await Promise.all([
        supabase
          .from('tournaments')
          .select('id, name, status, start_date')
          .order('start_date', { ascending: false }),
        supabase
          .from('matches')
          .select('*, team_a:team_a_id(name), team_b:team_b_id(name)')
          .order('match_time', { ascending: true })
      ]);

      if (tournamentsRes.error) throw tournamentsRes.error;
      if (matchesRes.error) throw matchesRes.error;

      setTournaments(tournamentsRes.data || []);
      setMatches((matchesRes.data as unknown) as Match[] || []);
      
      // Step 2: Fix the Alt-Tab State Overwrite
      if (tournamentsRes.data && tournamentsRes.data.length > 0) {
        setSelectedTournamentId(prev => {
          // Preserve the existing selection across re-renders/refetches!
          if (prev !== 'all') return prev; 
          return 'all'; // In this specific UI, 'all' is the desired default
        });
      }
    } catch (error: any) {
      console.error('Error fetching explorer data:', error);
      toast.error('Failed to load tournaments and matches');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredMatches = selectedTournamentId === 'all' 
    ? matches 
    : matches.filter(m => m.tournament_id === selectedTournamentId);

  const liveAndUpcoming = filteredMatches.filter(m => m.status === 'Scheduled' || m.status === 'Ongoing');
  const history = filteredMatches.filter(m => m.status === 'Completed').sort((a, b) => 
    new Date(b.match_time).getTime() - new Date(a.match_time).getTime()
  );

  const groupMatchesByDate = (matchList: Match[]) => {
    const groups: { [key: string]: Match[] } = {};
    matchList.forEach(match => {
      const date = match.match_time 
        ? new Date(match.match_time).toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric',
            year: 'numeric'
          }).toUpperCase()
        : 'DATE TBD';
      if (!groups[date]) groups[date] = [];
      groups[date].push(match);
    });
    return groups;
  };

  const liveGroups = useMemo(() => groupMatchesByDate(liveAndUpcoming), [liveAndUpcoming]);
  const historyGroups = useMemo(() => groupMatchesByDate(history), [history]);

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh] w-full gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
        <p className="text-slate-500 font-bold animate-pulse uppercase tracking-widest text-xs">Loading Match Center...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 text-white py-6 md:py-8 px-8 md:px-12 shadow-2xl border border-white/5">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 size-64 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-5 h-5 text-orange-500" />
              <span className="text-orange-500 font-bold text-xs tracking-[0.2em] uppercase">
                Official Match Center
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-sans font-black tracking-tight uppercase leading-tight">
              TOURNAMENT <span className="text-orange-500">EXPLORER</span>
            </h1>
            <p className="text-slate-400 font-sans font-medium text-sm tracking-wide mt-2 max-w-2xl opacity-80">
              Browse all official PSU tournaments, track live scores, and relive historical match moments.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 w-full max-w-full overflow-hidden pb-12">
        {/* Sidebar: Tournament Selector */}
        <div className="w-full lg:w-1/4 flex flex-col gap-4 shrink-0 animate-in fade-in slide-in-from-left-4 duration-700 delay-100 fill-mode-both">
          <div className="backdrop-blur-xl bg-slate-950/[0.03] border border-slate-200/60 rounded-[2rem] p-6 shadow-xl shadow-slate-200/20">
            <h3 className="font-black text-slate-400 uppercase flex items-center gap-2 px-2 text-[10px] tracking-[0.3em] mb-6">
              <Filter className="size-3 text-orange-500" /> Filter Hub
            </h3>
            <div className="flex flex-col gap-3">
              <Button
                variant={selectedTournamentId === 'all' ? 'default' : 'outline'}
                className={`justify-start text-left h-auto py-4 px-5 rounded-2xl border-2 transition-all duration-300 ${
                  selectedTournamentId === 'all' 
                  ? 'bg-slate-950 text-white border-slate-950 shadow-xl shadow-slate-950/20 scale-[1.02]' 
                  : 'bg-white border-slate-100 hover:border-orange-500/30 hover:bg-slate-50 text-slate-600'
                }`}
                onClick={() => setSelectedTournamentId('all')}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-black uppercase italic tracking-tight text-sm">Global View</span>
                  <span className="text-[9px] font-bold opacity-50 uppercase tracking-widest">All Matchfeeds</span>
                </div>
              </Button>
              <div className="h-px bg-slate-100 my-2 mx-4" />
              {tournaments?.map((t, index) => (
                <Button
                  key={t.id}
                  variant={selectedTournamentId === t.id ? 'default' : 'outline'}
                  className={`justify-start text-left h-auto py-4 px-5 rounded-2xl border-2 transition-all duration-300 animate-in fade-in slide-in-from-left-2 fill-mode-both ${
                    selectedTournamentId === t.id 
                    ? 'bg-slate-950 text-white border-slate-950 shadow-xl shadow-slate-950/20 scale-[1.02]' 
                    : 'bg-white border-slate-100 hover:border-orange-500/30 hover:bg-slate-50 text-slate-600'
                  }`}
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => setSelectedTournamentId(t.id)}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-black uppercase italic tracking-tight text-sm truncate max-w-[180px]">{t?.name || 'Unnamed'}</span>
                    <span className="text-[9px] font-bold opacity-50 uppercase tracking-widest">
                      EST. {t?.start_date ? new Date(t.start_date).getFullYear() : 'N/A'}
                    </span>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content: Match Views */}
        <div className="w-full lg:w-3/4 flex flex-col max-w-full">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-both">
            <div className="sticky top-0 z-20 pb-4 -mx-2 px-2 bg-background/80 backdrop-blur-sm">
              <TabsList className="p-1 h-14 bg-slate-950/5 border border-slate-200/50 backdrop-blur-xl rounded-2xl w-full md:w-auto flex items-stretch">
                <TabsTrigger 
                  value="live" 
                  className="px-8 font-black uppercase italic tracking-tight data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-lg rounded-xl transition-all flex items-center gap-2"
                >
                  <Clock className="size-4" /> Live & Upcoming
                </TabsTrigger>
                
                <TabsTrigger 
                  value="history" 
                  className="px-8 font-black uppercase italic tracking-tight data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-lg rounded-xl transition-all flex items-center gap-2"
                >
                  <History className="size-4" /> Match History
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="live" className="w-full outline-none mt-0 space-y-12">
              {Object.keys(liveGroups).length === 0 ? (
                <Card className="border-dashed border-2 py-20 text-center bg-slate-50/50">
                  <Clock className="size-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium italic">No live or upcoming matches scheduled for this selection.</p>
                </Card>
              ) : (
                Object.entries(liveGroups).map(([date, dateMatches]) => (
                  <div key={date} className="relative border-l-2 border-slate-200 pl-6 ml-3 mb-8 space-y-4">
                    <div className="absolute -left-[11px] top-0 bg-orange-500 w-5 h-5 rounded-full border-4 border-slate-50 flex items-center justify-center"></div>
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest pt-0.5 mb-6 flex items-center gap-3">
                      {date}
                      <span className="h-px flex-1 bg-slate-100" />
                    </h4>
                    
                    <div className="space-y-3">
                      {dateMatches.map((match) => (
                        <div key={match.id} className="flex flex-col md:flex-row items-center justify-between bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-all group/card">
                          {/* Status/Time */}
                          <div className="flex items-center gap-4 w-full md:w-40 mb-4 md:mb-0">
                            {match.status === 'Ongoing' ? (
                              <div className="flex items-center gap-2 px-2 py-1 bg-red-500 text-white rounded-md animate-pulse shadow-lg shadow-red-500/20">
                                <span className="flex h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                                <span className="text-[10px] font-black uppercase tracking-widest">LIVE NOW</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 border border-slate-100 rounded-md">
                                <Clock className="size-3 text-slate-400" />
                                <span className="text-slate-600 font-bold text-xs tabular-nums">
                                  {match.match_time ? new Date(match.match_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD'}
                                </span>
                              </div>
                            )}
                            <div className="md:hidden flex-1 h-px bg-slate-100" />
                          </div>

                          {/* Matchup */}
                          <div className="flex items-center justify-center gap-4 flex-1 mb-4 md:mb-0">
                            <div className="flex-1 text-right">
                              <span className="text-lg font-black text-slate-900 uppercase italic tracking-tight">{match.team_a?.name || 'TBD'}</span>
                            </div>
                            <div className="px-3 py-1 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-3">
                              <span className="text-lg font-black text-slate-300 tabular-nums">{match.team_a_score || 0}</span>
                              <span className="text-[10px] font-black text-slate-200 italic tracking-widest">VS</span>
                              <span className="text-lg font-black text-slate-300 tabular-nums">{match.team_b_score || 0}</span>
                            </div>
                            <div className="flex-1 text-left">
                              <span className="text-lg font-black text-slate-900 uppercase italic tracking-tight">{match.team_b?.name || 'TBD'}</span>
                            </div>
                          </div>

                          {/* Action */}
                          <div className="w-full md:w-auto ml-0 md:ml-6">
                            <Button 
                              variant="outline" 
                              className="w-full md:w-auto border-orange-500 text-orange-600 hover:bg-orange-50 font-black uppercase italic tracking-widest text-[10px] h-10 px-6 rounded-xl transition-all"
                              onClick={() => navigate(`/match/${match.id}`)}
                            >
                              Matchroom
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="history" className="w-full outline-none mt-0 space-y-12">
              {Object.keys(historyGroups).length === 0 ? (
                <Card className="border-dashed border-2 py-20 text-center bg-slate-50/50">
                  <History className="size-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium italic">No match history found for this selection.</p>
                </Card>
              ) : (
                Object.entries(historyGroups).map(([date, dateMatches]) => (
                  <div key={date} className="relative border-l-2 border-slate-100 pl-6 ml-3 mb-8 space-y-4">
                    <div className="absolute -left-[11px] top-0 bg-slate-400 w-5 h-5 rounded-full border-4 border-slate-50 flex items-center justify-center"></div>
                    <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest pt-0.5 mb-6 flex items-center gap-3">
                      {date}
                      <span className="h-px flex-1 bg-slate-100" />
                    </h4>
                    
                    <div className="space-y-3">
                      {dateMatches.map((match) => (
                        <div key={match.id} className="flex flex-col md:flex-row items-center justify-between bg-white border border-slate-100 rounded-xl p-4 hover:shadow-sm transition-all group/card opacity-80 hover:opacity-100">
                          {/* Status/Final */}
                          <div className="flex items-center gap-4 w-full md:w-40 mb-4 md:mb-0">
                            <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 border border-slate-200 rounded-md">
                              <span className="text-slate-400 font-black uppercase tracking-widest text-[9px]">FINAL RECORD</span>
                            </div>
                            <div className="md:hidden flex-1 h-px bg-slate-100" />
                          </div>

                          {/* Matchup with Final Score */}
                          <div className="flex items-center justify-center gap-4 flex-1 mb-4 md:mb-0">
                            <div className="flex-1 text-right">
                              <span className={`text-lg font-black uppercase italic tracking-tight ${(match.team_a_score || 0) > (match.team_b_score || 0) ? 'text-slate-900' : 'text-slate-400'}`}>
                                {match.team_a?.name || 'TBD'}
                              </span>
                            </div>
                            <div className="px-4 py-2 bg-slate-900 rounded-xl flex items-center gap-4 shadow-lg shadow-slate-900/10">
                              <span className={`text-xl font-black tabular-nums ${(match.team_a_score || 0) > (match.team_b_score || 0) ? 'text-orange-500' : 'text-white/40'}`}>
                                {match.team_a_score || 0}
                              </span>
                              <div className="h-4 w-px bg-white/10" />
                              <span className={`text-xl font-black tabular-nums ${(match.team_b_score || 0) > (match.team_a_score || 0) ? 'text-orange-500' : 'text-white/40'}`}>
                                {match.team_b_score || 0}
                              </span>
                            </div>
                            <div className="flex-1 text-left">
                              <span className={`text-lg font-black uppercase italic tracking-tight ${(match.team_b_score || 0) > (match.team_a_score || 0) ? 'text-slate-900' : 'text-slate-400'}`}>
                                {match.team_b?.name || 'TBD'}
                              </span>
                            </div>
                          </div>

                          {/* Action */}
                          <div className="w-full md:w-auto ml-0 md:ml-6">
                            <Button 
                              variant="ghost" 
                              className="w-full md:w-auto text-slate-400 hover:text-slate-900 hover:bg-slate-50 font-black uppercase italic tracking-widest text-[10px] h-10 px-6 rounded-xl transition-all"
                              onClick={() => navigate(`/match/${match.id}`)}
                            >
                              Details
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};
