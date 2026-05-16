import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Trophy, ChevronLeft, Activity, Send, Clock, AlertCircle, Star } from 'lucide-react';

type Match = {
  id: string;
  team_a_id: string;
  team_b_id: string | null;
  team_a_score: number;
  team_b_score: number;
  status: 'Scheduled' | 'Ongoing' | 'Completed';
  round: string;
  team_a: { name: string } | null;
  team_b: { name: string } | null;
  tournament_id: string;
};

type EligiblePlayer = {
  player_id: string;
  users: {
    full_name: string;
  } | null;
};

type MatchEvent = {
  id: string;
  description: string;
  created_at: string;
};

export const LiveMatch = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const [match, setMatch] = useState<Match | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [customEvent, setCustomEvent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [eligiblePlayers, setEligiblePlayers] = useState<EligiblePlayer[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [isAwarding, setIsAwarding] = useState(false);
  const [awardedMVP, setAwardedMVP] = useState<string | null>(null);

  const isAuthorized = role === 'Admin' || role === 'Coach';

  useEffect(() => {
    if (!matchId) return;

    fetchInitialData();

    // Subscribe to Match Updates (Score changes)
    const matchSubscription = supabase
      .channel('match-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
        (payload) => {
          setMatch((prev) => (prev ? { ...prev, ...payload.new } : payload.new as Match));
        }
      )
      .subscribe();

    // Subscribe to New Match Events (Live Commentary)
    const eventSubscription = supabase
      .channel('match-events')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'match_events', filter: `match_id=eq.${matchId}` },
        (payload) => {
          setEvents((prev) => [payload.new as MatchEvent, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(matchSubscription);
      supabase.removeChannel(eventSubscription);
    };
  }, [matchId]);

  const fetchInitialData = async () => {
    if (!matchId) return;
    
    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select('*, team_a:team_a_id(name), team_b:team_b_id(name)')
      .eq('id', matchId)
      .single();

    if (matchError) {
      toast.error('Failed to load match: ' + matchError.message);
      return;
    }

    const { data: eventsData, error: eventsError } = await supabase
      .from('match_events')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: false });

    if (eventsError) {
      toast.error('Failed to load events: ' + eventsError.message);
    } else {
      setMatch(matchData);
      setEvents(eventsData);

      // Check for existing MVP
      const { data: starData } = await supabase
        .from('player_stars')
        .select('users(full_name)')
        .eq('match_id', matchId)
        .eq('star_type', 'Red')
        .maybeSingle();

      if (starData) {
        const users = starData.users as any;
        const mvpName = Array.isArray(users) ? users[0]?.full_name : users?.full_name;
        setAwardedMVP(mvpName ?? 'A Player');
      }
      
      // Fetch eligible players for MVP
      if (matchData) {
        const { data: rosterData } = await supabase
          .from('team_roster')
          .select('player_id, users(full_name)')
          .in('team_id', [matchData.team_a_id, matchData.team_b_id])
          .eq('status', 'Approved');
        
        if (rosterData) {
          setEligiblePlayers((rosterData as unknown) as EligiblePlayer[]);
        }
      }
    }
    setIsLoading(false);
  };

  const handleUpdateScore = async (team: 'a' | 'b', points: number) => {
    if (!isAuthorized || !match || match.status === 'Completed') return;
    setIsSubmitting(true);

    const newScore = team === 'a' ? match.team_a_score + points : match.team_b_score + points;
    const teamName = team === 'a' ? match.team_a?.name : match.team_b?.name;

    const { error: updateError } = await supabase
      .from('matches')
      .update({ [team === 'a' ? 'team_a_score' : 'team_b_score']: newScore })
      .eq('id', match.id);

    if (updateError) {
      toast.error('Failed to update score: ' + updateError.message);
      setIsSubmitting(false);
      return;
    }

    await supabase.from('match_events').insert({
      match_id: match.id,
      description: `${teamName} scored ${points} point${points > 1 ? 's' : ''}!`
    });

    setIsSubmitting(false);
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!isAuthorized || !match) return;
    const { error } = await supabase
      .from('matches')
      .update({ status: newStatus })
      .eq('id', match.id);

    if (error) {
      toast.error('Failed to update status: ' + error.message);
    } else {
      toast.success(`Match status updated to ${newStatus}`);
      await supabase.from('match_events').insert({
        match_id: match.id,
        description: `Match status changed to ${newStatus}`
      });
    }
  };

  const handleLogCustomEvent = async () => {
    if (!isAuthorized || !match || !customEvent.trim()) return;
    setIsSubmitting(true);

    const { error } = await supabase.from('match_events').insert({
      match_id: match.id,
      description: customEvent.trim()
    });

    if (error) {
      toast.error('Failed to log event: ' + error.message);
    } else {
      setCustomEvent('');
    }
    setIsSubmitting(false);
  };

  const handleAwardMVP = async () => {
    if (!isAuthorized || !match || !selectedPlayerId) return;
    setIsAwarding(true);

    const { error } = await supabase.from('player_stars').insert({
      player_id: selectedPlayerId,
      star_type: 'Red',
      match_id: match.id,
      tournament_id: match.tournament_id,
      awarded_by: user?.id
    });

    if (error) {
      toast.error('Failed to award MVP: ' + error.message);
    } else {
      toast.success('Red Star awarded to player!');
      const player = eligiblePlayers.find(p => p.player_id === selectedPlayerId);
      const users = player?.users as any;
      const selectedPlayerName = Array.isArray(users) ? users[0]?.full_name : users?.full_name;
      setAwardedMVP(selectedPlayerName || 'Unknown Player');
      setSelectedPlayerId('');
    }
    setIsAwarding(false);
  };

  if (isLoading) return <div className="p-8 text-center">Loading match...</div>;
  if (!match) return <div className="p-8 text-center text-destructive">Match not found.</div>;

  return (
    <div className="space-y-8 pb-12">
      {/* Dynamic Arena Header */}
      <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl border border-white/5 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full bg-white/10 hover:bg-white/20 text-white border-none">
              <ChevronLeft className="size-6" />
            </Button>
            <div>
              <h1 className="text-3xl font-black tracking-tighter italic uppercase leading-none">MATCH <span className="text-orange-500">CONTROL</span></h1>
              <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-1 opacity-70">Official PSU Match Execution Interface</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
              <Activity className="size-4 text-orange-500 animate-pulse" />
              <span className="font-black text-xs uppercase tracking-widest">{match.status}</span>
            </div>
            <Badge variant={match.status === 'Completed' ? 'secondary' : 'destructive'} className="h-10 px-6 rounded-full font-black text-sm uppercase tracking-tighter italic animate-pulse">
              {match.status === 'Ongoing' ? 'LIVE' : match.status}
            </Badge>
          </div>
        </div>
        <div className="absolute right-0 top-0 h-full w-64 bg-orange-500/10 -skew-x-12 translate-x-32" />
      </div>

      <div className="max-w-5xl mx-auto space-y-8">
        {/* Scoreboard */}
        <Card className="bg-primary text-primary-foreground shadow-2xl overflow-hidden border-none">
          <CardContent className="p-0">
            <div className="bg-black/20 p-4 text-center text-xs font-bold uppercase tracking-widest opacity-80">
              {match.round} • Live Scoring
            </div>
            <div className="flex items-center justify-between p-8 md:p-12">
              <div className="flex-1 text-center">
                <h2 className="text-xl md:text-2xl font-bold mb-2 uppercase">{match.team_a?.name || 'Team A'}</h2>
                <div className="text-6xl md:text-8xl font-black tabular-nums">{match.team_a_score}</div>
              </div>
              
              <div className="px-8 text-4xl font-black italic opacity-40">VS</div>
              
              <div className="flex-1 text-center">
                <h2 className="text-xl md:text-2xl font-bold mb-2 uppercase">{match.team_b?.name || 'BYE'}</h2>
                <div className="text-6xl md:text-8xl font-black tabular-nums">{match.team_b_score}</div>
              </div>
            </div>
            {isAuthorized && (
              <div className="bg-black/10 p-6 flex justify-center gap-4">
                {match.status === 'Scheduled' && (
                  <Button variant="secondary" className="bg-white text-primary hover:bg-white/90" onClick={() => handleUpdateStatus('Ongoing')}>
                    Start Match
                  </Button>
                )}
                {match.status === 'Ongoing' && (
                  <Button variant="secondary" className="bg-white text-primary hover:bg-white/90" onClick={() => handleUpdateStatus('Completed')}>
                    End Match
                  </Button>
                )}
                {match.status === 'Completed' && (
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <Trophy className="size-5 text-yellow-400" />
                    Winner: {match.team_a_score > match.team_b_score ? match.team_a?.name : match.team_b?.name || 'N/A'}
                  </div>
                )}
              </div>
            )}
            {!isAuthorized && match.status === 'Completed' && (
              <div className="bg-black/10 p-6 flex justify-center gap-4">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <Trophy className="size-5 text-yellow-400" />
                  Winner: {match.team_a_score > match.team_b_score ? match.team_a?.name : match.team_b?.name || 'N/A'}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Controls (Admin/Coach Only) */}
        {isAuthorized && (
          <div className="grid md:grid-cols-2 gap-8">
            {match.status === 'Ongoing' ? (
              <>
                {/* Team A Controls */}
                <Card>
                  <CardHeader className="text-center border-b pb-4">
                    <CardTitle className="text-primary">{match.team_a?.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 grid grid-cols-3 gap-3">
                    <Button size="lg" variant="outline" className="flex flex-col h-20 gap-1 border-2" onClick={() => handleUpdateScore('a', 1)}>
                      <span className="text-xl font-bold">+1</span>
                      <span className="text-[10px] uppercase opacity-60">FT</span>
                    </Button>
                    <Button size="lg" variant="outline" className="flex flex-col h-20 gap-1 border-2" onClick={() => handleUpdateScore('a', 2)}>
                      <span className="text-xl font-bold">+2</span>
                      <span className="text-[10px] uppercase opacity-60">Field</span>
                    </Button>
                    <Button size="lg" variant="outline" className="flex flex-col h-20 gap-1 border-2" onClick={() => handleUpdateScore('a', 3)}>
                      <span className="text-xl font-bold">+3</span>
                      <span className="text-[10px] uppercase opacity-60">Triple</span>
                    </Button>
                  </CardContent>
                </Card>

                {/* Team B Controls */}
                <Card className={!match.team_b_id ? 'opacity-50 pointer-events-none' : ''}>
                  <CardHeader className="text-center border-b pb-4">
                    <CardTitle className="text-primary">{match.team_b?.name || 'BYE'}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 grid grid-cols-3 gap-3">
                    <Button size="lg" variant="outline" className="flex flex-col h-20 gap-1 border-2" onClick={() => handleUpdateScore('b', 1)}>
                      <span className="text-xl font-bold">+1</span>
                      <span className="text-[10px] uppercase opacity-60">FT</span>
                    </Button>
                    <Button size="lg" variant="outline" className="flex flex-col h-20 gap-1 border-2" onClick={() => handleUpdateScore('b', 2)}>
                      <span className="text-xl font-bold">+2</span>
                      <span className="text-[10px] uppercase opacity-60">Field</span>
                    </Button>
                    <Button size="lg" variant="outline" className="flex flex-col h-20 gap-1 border-2" onClick={() => handleUpdateScore('b', 3)}>
                      <span className="text-xl font-bold">+3</span>
                      <span className="text-[10px] uppercase opacity-60">Triple</span>
                    </Button>
                  </CardContent>
                </Card>
              </>
            ) : match.status === 'Completed' ? (
              <Card className="col-span-full border-primary/50 bg-primary/5 shadow-lg">
                <CardHeader className="text-center">
                  <div className="flex justify-center mb-2">
                    <Star className="size-12 text-red-500 fill-red-500 animate-bounce" />
                  </div>
                  <CardTitle className="text-2xl text-primary">Post-Game: Award MVP (Red Star)</CardTitle>
                  <p className="text-sm text-muted-foreground">Select the standout player of this match to recognize their performance.</p>
                </CardHeader>
                <CardContent className="max-w-md mx-auto space-y-4 pb-8 text-center">
                  {awardedMVP ? (
                    <div className="py-8 space-y-4 animate-in fade-in zoom-in duration-500">
                      <div className="flex justify-center">
                        <div className="relative">
                          <Star className="size-20 text-red-500 fill-red-500" />
                          <Trophy className="size-8 text-yellow-400 absolute -bottom-2 -right-2 bg-background rounded-full p-1 border-2 border-primary" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm uppercase tracking-widest font-bold opacity-50">Match Recognition</p>
                        <h3 className="text-2xl font-black text-red-600">🏆 {awardedMVP}</h3>
                        <p className="font-medium text-primary/80">Has been recognized as the Match MVP</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 text-left">
                        <label className="text-sm font-bold uppercase tracking-wider opacity-60">Select MVP Player</label>
                        <Select value={selectedPlayerId} onValueChange={(val) => setSelectedPlayerId(val ?? '')}>
                          <SelectTrigger className="w-full bg-background border-2 h-12">
                            <SelectValue placeholder="Search or select player...">
                              {selectedPlayerId && (() => {
                                const p = (eligiblePlayers || []).find(player => player.player_id === selectedPlayerId);
                                const u = p?.users as any;
                                return Array.isArray(u) ? u[0]?.full_name : u?.full_name;
                              })()}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {(eligiblePlayers || []).length === 0 ? (
                              <div className="p-4 text-center text-sm text-muted-foreground">No players found in rosters.</div>
                            ) : (
                              (eligiblePlayers || []).map((p) => (
                                <SelectItem key={p.player_id} value={p.player_id}>
                                  {Array.isArray(p.users) 
                                    ? p.users[0]?.full_name 
                                    : p.users?.full_name ?? 'Unknown Player'}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button 
                        className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-bold gap-2 text-lg"
                        disabled={!selectedPlayerId || isAwarding}
                        onClick={handleAwardMVP}
                      >
                        <Star className="size-5 fill-white" /> {isAwarding ? 'Awarding...' : 'Award Red Star'}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                Match is scheduled. Start the match to enable score controls.
              </div>
            )}
          </div>
        )}

        {/* Live Feed & Commentary */}
        <Card className="shadow-lg">
          <CardHeader className="border-b bg-muted/10">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="size-4 text-primary" /> Live Commentary & Events
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isAuthorized && (
              <div className="p-4 border-b flex gap-2">
                <Input 
                  placeholder="Log a custom event (e.g., Timeout, Foul, Substitution)..." 
                  value={customEvent}
                  onChange={(e) => setCustomEvent(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogCustomEvent()}
                  disabled={match.status === 'Completed'}
                />
                <Button size="icon" onClick={handleLogCustomEvent} disabled={!customEvent.trim() || isSubmitting || match.status === 'Completed'}>
                  <Send className="size-4" />
                </Button>
              </div>
            )}
            <div className="h-[400px] overflow-y-auto p-4 space-y-4 bg-muted/5">
              {events.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                  <AlertCircle className="size-12 mb-2" />
                  <p>No events logged yet.</p>
                </div>
              ) : (
                events.map((event) => (
                  <div key={event.id} className="flex gap-4 items-start animate-in slide-in-from-left-2 duration-300">
                    <div className="mt-1.5 p-1.5 bg-primary/10 rounded-full">
                      <Clock className="size-3 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          {new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm font-medium leading-relaxed">{event.description}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
