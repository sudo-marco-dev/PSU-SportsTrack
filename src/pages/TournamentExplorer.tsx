import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Globe, CalendarDays, Trophy, Clock, ChevronRight, PlayCircle, History, Filter } from 'lucide-react';

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
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white p-8 md:p-12 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 size-64 bg-orange-500/20 rounded-full blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-orange-400 mb-2">
              <Globe className="size-5" />
              <span className="text-sm font-bold uppercase tracking-wider">Official Match Center</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter">
              Tournament <span className="text-orange-500">Explorer</span>
            </h1>
            <p className="text-slate-400 mt-2 max-w-lg text-lg">
              Browse all official PSU tournaments, track live scores, and relive historical match moments.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 w-full max-w-full overflow-hidden pb-12">
        {/* Sidebar: Tournament Selector */}
        <div className="w-full lg:w-1/4 flex flex-col gap-4 shrink-0">
          <h3 className="font-bold text-slate-500 uppercase flex items-center gap-2 px-2 text-sm tracking-widest">
            <Filter className="size-4 text-orange-500" /> Filter by Tournament
          </h3>
          <div className="flex flex-col gap-2">
            <Button
              variant={selectedTournamentId === 'all' ? 'default' : 'outline'}
              className={`justify-start text-left h-auto py-3 px-4 rounded-xl border-2 ${
                selectedTournamentId === 'all' 
                ? 'bg-slate-900 text-white border-slate-900' 
                : 'border-slate-100 hover:border-orange-500/50 hover:bg-orange-50'
              }`}
              onClick={() => setSelectedTournamentId('all')}
            >
              <div className="flex flex-col">
                <span className="font-bold">All Tournaments</span>
                <span className="text-xs opacity-60">View every match across PSU</span>
              </div>
            </Button>
            {tournaments?.map((t) => (
              <Button
                key={t.id}
                variant={selectedTournamentId === t.id ? 'default' : 'outline'}
                className={`justify-start text-left h-auto py-3 px-4 rounded-xl border-2 transition-all ${
                  selectedTournamentId === t.id 
                  ? 'bg-slate-900 text-white border-slate-900 shadow-lg' 
                  : 'border-slate-100 hover:border-orange-500/50 hover:bg-orange-50'
                }`}
                onClick={() => setSelectedTournamentId(t.id)}
              >
                <div className="flex flex-col">
                  <span className="font-bold">{t?.name || 'Unnamed Tournament'}</span>
                  <span className="text-xs opacity-60">
                    Started {t?.start_date ? new Date(t.start_date).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </Button>
            ))}
          </div>
        </div>

        {/* Main Content: Match Views */}
        <div className="w-full lg:w-3/4 flex flex-col max-w-full">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col gap-6">
            <TabsList className="w-full flex justify-start overflow-x-auto whitespace-nowrap bg-transparent border-b-2 border-slate-200 rounded-none h-auto p-0 gap-8 scrollbar-hide pb-[2px]">
              <TabsTrigger 
                value="live" 
                className={`shrink-0 rounded-none pb-3 text-sm font-bold uppercase tracking-wider shadow-none transition-all border-b-4 ${
                  activeTab === "live" 
                    ? "border-orange-500 text-orange-600" 
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <Clock className="w-4 h-4 mr-2 inline-block" /> Live & Upcoming
              </TabsTrigger>
              
              <TabsTrigger 
                value="history" 
                className={`shrink-0 rounded-none pb-3 text-sm font-bold uppercase tracking-wider shadow-none transition-all border-b-4 ${
                  activeTab === "history" 
                    ? "border-orange-500 text-orange-600" 
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <History className="w-4 h-4 mr-2 inline-block" /> Match History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="live" className="w-full space-y-4 outline-none mt-0">
              {liveAndUpcoming.length === 0 ? (
                <Card className="border-dashed border-2 py-20 text-center bg-slate-50/50">
                  <Clock className="size-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium italic">No live or upcoming matches scheduled for this selection.</p>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {(liveAndUpcoming || []).map((match) => (
                    <Card key={match?.id} className="group hover:border-orange-500/50 transition-all duration-300 shadow-sm hover:shadow-xl rounded-2xl overflow-hidden border-2 border-slate-100">
                      <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                        <Badge variant="outline" className="bg-white text-[10px] font-black uppercase tracking-tighter">
                          {match?.round || 'TBD'}
                        </Badge>
                        <div className="flex items-center gap-2">
                          {match?.status === 'Ongoing' && (
                            <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                          )}
                          <span className={`text-[10px] font-black uppercase tracking-widest ${match?.status === 'Ongoing' ? 'text-red-500' : 'text-slate-400'}`}>
                            {match?.status || 'SCHEDULED'}
                          </span>
                        </div>
                      </div>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between gap-4 mb-6">
                          <div className="flex-1 text-center">
                            <p className="text-sm font-black uppercase italic tracking-tight truncate">{match?.team_a?.name ?? 'TBD'}</p>
                            <p className="text-2xl font-black text-slate-900 mt-1">{match?.team_a_score ?? 0}</p>
                          </div>
                          <div className="text-slate-300 font-black italic text-xl">VS</div>
                          <div className="flex-1 text-center">
                            <p className="text-sm font-black uppercase italic tracking-tight truncate">{match?.team_b?.name ?? 'TBD'}</p>
                            <p className="text-2xl font-black text-slate-900 mt-1">{match?.team_b_score ?? 0}</p>
                          </div>
                        </div>
                        <Button 
                          onClick={() => match?.id && navigate(`/match/${match.id}`)}
                          variant="outline" 
                          className="w-full border-2 border-orange-500 text-orange-600 hover:bg-orange-500 hover:text-white font-bold rounded-xl h-12 gap-2 group-hover:shadow-lg transition-all"
                        >
                          <PlayCircle className="size-5" />
                          Watch Live
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="w-full space-y-4 outline-none mt-0">
              {history.length === 0 ? (
                <Card className="border-dashed border-2 py-20 text-center bg-slate-50/50">
                  <History className="size-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium italic">No match history found for this selection.</p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {(history || []).map((match) => (
                    <Card key={match?.id} className="hover:border-slate-300 transition-all duration-300 border-2 border-slate-100 shadow-sm rounded-2xl overflow-hidden">
                      <CardContent className="p-0">
                        <div className="flex flex-col md:flex-row items-stretch md:items-center">
                          <div className="p-6 flex-1 flex items-center justify-between gap-8 border-b md:border-b-0 md:border-r border-slate-100 bg-slate-50/30">
                            <div className="flex-1 text-right">
                              <p className="text-xs text-slate-400 font-bold uppercase mb-1">{match?.round || 'COMPLETED'}</p>
                              <p className="font-black uppercase italic tracking-tighter text-slate-900">{match?.team_a?.name ?? 'TBD'}</p>
                            </div>
                            <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">
                              <span className={`text-2xl font-black ${(match?.team_a_score ?? 0) > (match?.team_b_score ?? 0) ? 'text-orange-600' : 'text-slate-400'}`}>{match?.team_a_score ?? 0}</span>
                              <span className="text-slate-200 font-bold">-</span>
                              <span className={`text-2xl font-black ${(match?.team_b_score ?? 0) > (match?.team_a_score ?? 0) ? 'text-orange-600' : 'text-slate-400'}`}>{match?.team_b_score ?? 0}</span>
                            </div>
                            <div className="flex-1 text-left">
                              <p className="text-xs text-slate-400 font-bold uppercase mb-1 text-right md:text-left">
                                {match?.match_time ? new Date(match.match_time).toLocaleDateString() : 'N/A'}
                              </p>
                              <p className="font-black uppercase italic tracking-tighter text-slate-900">{match?.team_b?.name ?? 'TBD'}</p>
                            </div>
                          </div>
                          <div className="p-4 bg-white flex items-center justify-center">
                            <Button 
                              onClick={() => match?.id && navigate(`/match/${match.id}`)}
                              className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl px-6 gap-2"
                            >
                              View Box Score & History
                              <ChevronRight className="size-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};
