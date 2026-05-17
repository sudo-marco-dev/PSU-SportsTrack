import { useState, useEffect, useRef } from 'react';
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
  
  const broadcastChannelRef = useRef<any>(null);

  const isAuthorized = role === 'Admin' || role === 'Coach';

  useEffect(() => {
    if (!matchId) {
      console.log("⏳ Waiting for Match ID before connecting to Realtime...");
      return;
    }

    fetchInitialData();
    console.log(`🔌 Connecting to Realtime for Match ID: ${matchId}`);

    let isMounted = true;

    const broadcastChannel = supabase
      .channel(`match-broadcast:${matchId}`)
      .on(
        'broadcast',
        { event: 'score_update' },
        (payload) => {
          if (!isMounted) return;
          console.log('🔥 Broadcast score received:', payload);
          const { team_a_score, team_b_score } = payload.payload;
          setMatch(prev => prev ? { ...prev, team_a_score, team_b_score } : prev);
        }
      )
      .on(
        'broadcast',
        { event: 'event_update' },
        (payload) => {
          if (!isMounted) return;
          console.log('🔥 Broadcast event received:', payload);
          const newEvent = payload.payload as MatchEvent;
          // Check if event already exists to prevent duplicate optimistic updates
          setEvents(prev => prev.some(e => e.id === newEvent.id) ? prev : [newEvent, ...prev]);
        }
      )
      .on(
        'broadcast',
        { event: 'mvp_update' },
        (payload) => {
          if (!isMounted) return;
          console.log('🔥 Broadcast MVP received:', payload);
          setAwardedMVP(payload.payload.mvpName);
        }
      )
      .subscribe((status) => {
        console.log('📡 Broadcast channel status:', status);
      });
      
    broadcastChannelRef.current = broadcastChannel;

    const channel = supabase
      .channel(`realtime:matches:${matchId}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'matches',
          filter: `id=eq.${matchId}`
        },
        (payload) => {
          console.log("🔥 GLOBAL REALTIME PAYLOAD (matches) RECEIVED:", payload);
          setMatch((prev) => prev ? { ...prev, ...payload.new } : (payload.new as Match));
        }
      )
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'player_stars',
          filter: `match_id=eq.${matchId}`
        },
        (payload) => {
          console.log("🔥 GLOBAL REALTIME PAYLOAD (player_stars) RECEIVED:", payload);
          fetchInitialData();
        }
      )
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'match_events',
          filter: `match_id=eq.${matchId}`
        },
        (payload) => {
          console.log("🔥 GLOBAL REALTIME PAYLOAD (match_events) RECEIVED:", payload);
          setEvents((prev) => [payload.new as MatchEvent, ...prev]);
        }
      )
      .subscribe((status) => {
        console.log(`📡 Status for ${matchId}:`, status);
      });

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
      supabase.removeChannel(broadcastChannel);
      broadcastChannelRef.current = null;
    };
  }, [matchId]);

  const fetchInitialData = async () => {
    if (!matchId) return;
    setIsLoading(true);
    
    try {
      // Fetch match, events, and star in parallel
      // We fetch star player_id only to avoid ambiguous join issues
      const [matchRes, eventsRes, starRes] = await Promise.all([
        supabase
          .from('matches')
          .select('*, team_a:team_a_id(name), team_b:team_b_id(name)')
          .eq('id', matchId)
          .single(),
        supabase
          .from('match_events')
          .select('*')
          .eq('match_id', matchId)
          .order('created_at', { ascending: false }),
        supabase
          .from('player_stars')
          .select('player_id')
          .eq('match_id', matchId)
          .eq('star_type', 'Red')
          .maybeSingle()
      ]);

      if (matchRes.error) throw matchRes.error;

      setMatch(matchRes.data);
      if (eventsRes.data) setEvents(eventsRes.data);

      // Fetch eligible players for the match roster first
      let currentRoster: EligiblePlayer[] = [];
      if (matchRes.data) {
        const { data: rosterData } = await supabase
          .from('team_roster')
          .select('player_id, users(full_name)')
          .in('team_id', [matchRes.data.team_a_id, matchRes.data.team_b_id])
          .eq('status', 'Approved');
        
        if (rosterData) {
          currentRoster = (rosterData as unknown) as EligiblePlayer[];
          setEligiblePlayers(currentRoster);
        }
      }

      // Now resolve the MVP name based on the star data
      if (starRes.data) {
        const star = starRes.data;
        const playerInRoster = currentRoster.find(p => p.player_id === star.player_id);
        
        if (playerInRoster) {
          const users = playerInRoster.users as any;
          const mvpName = Array.isArray(users) ? users[0]?.full_name : users?.full_name;
          setAwardedMVP(mvpName || 'A Player');
        } else {
          // Fallback: Fetch user name directly if not found in pre-fetched roster
          const { data: userData } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', star.player_id)
            .single();
          setAwardedMVP(userData?.full_name || 'A Player');
        }
      } else {
        setAwardedMVP(null);
      }

    } catch (error: any) {
      console.error("Error fetching match data:", error);
      if (error.code !== 'PGRST116') {
         toast.error("Failed to load match details");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateScore = async (team: 'a' | 'b', points: number) => {
    if (!isAuthorized || !match || match.status === 'Completed') return;
    setIsSubmitting(true);

    const newScoreA = team === 'a' ? match.team_a_score + points : match.team_a_score;
    const newScoreB = team === 'b' ? match.team_b_score + points : match.team_b_score;
    const teamName = team === 'a' ? match.team_a?.name : match.team_b?.name;

    const { error: updateError } = await supabase
      .from('matches')
      .update({ team_a_score: newScoreA, team_b_score: newScoreB })
      .eq('id', match.id)
      .select()
      .single();

    if (updateError) {
      toast.error('Failed to update score: ' + updateError.message);
      setIsSubmitting(false);
      return;
    }

    // Optimistically update local state for the sender
    setMatch(prev => prev ? { ...prev, team_a_score: newScoreA, team_b_score: newScoreB } : prev);

    if (broadcastChannelRef.current) {
      await broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'score_update',
        payload: {
          match_id: matchId,
          team_a_score: newScoreA,
          team_b_score: newScoreB,
          updated_at: new Date().toISOString(),
        },
      });
    }

    const { data: eventData, error: eventError } = await supabase.from('match_events').insert({
      match_id: match.id,
      description: `${teamName} scored ${points} point${points > 1 ? 's' : ''}!`
    }).select().single();

    if (!eventError && eventData) {
      setEvents(prev => [eventData as MatchEvent, ...prev]);
      if (broadcastChannelRef.current) {
        await broadcastChannelRef.current.send({
          type: 'broadcast',
          event: 'event_update',
          payload: eventData
        });
      }
    }

    setIsSubmitting(false);
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!isAuthorized || !match) return;
    const { error } = await supabase
      .from('matches')
      .update({ status: newStatus })
      .eq('id', match.id)
      .select()
      .single();

    if (error) {
      toast.error('Failed to update status: ' + error.message);
    } else {
      toast.success(`Match status updated to ${newStatus}`);
      const { data: eventData, error: eventError } = await supabase.from('match_events').insert({
        match_id: match.id,
        description: `Match status changed to ${newStatus}`
      }).select().single();

      if (!eventError && eventData) {
        setEvents(prev => [eventData as MatchEvent, ...prev]);
        if (broadcastChannelRef.current) {
          await broadcastChannelRef.current.send({
            type: 'broadcast',
            event: 'event_update',
            payload: eventData
          });
        }
      }
    }
  };

  const handleLogCustomEvent = async () => {
    if (!isAuthorized || !match || !customEvent.trim()) return;
    setIsSubmitting(true);

    const { data: eventData, error } = await supabase.from('match_events').insert({
      match_id: match.id,
      description: customEvent.trim()
    }).select().single();

    if (error) {
      toast.error('Failed to log event: ' + error.message);
    } else {
      setCustomEvent('');
      if (eventData) {
        setEvents(prev => [eventData as MatchEvent, ...prev]);
        if (broadcastChannelRef.current) {
          await broadcastChannelRef.current.send({
            type: 'broadcast',
            event: 'event_update',
            payload: eventData
          });
        }
      }
    }
    setIsSubmitting(false);
  };

  const handleAwardMVP = async () => {
    if (isAwarding || !isAuthorized || !match || !selectedPlayerId) return;
    setIsAwarding(true);

    const { error } = await supabase.from('player_stars').insert({
      player_id: selectedPlayerId,
      star_type: 'Red',
      match_id: match.id,
      tournament_id: match.tournament_id,
      awarded_by: user?.id
    });

    if (error) {
      if (error.code === '23505') {
        toast.error("An MVP has already been awarded for this match!");
        // Re-fetch to lock UI
        fetchInitialData();
      } else {
        toast.error('Failed to award MVP: ' + error.message);
      }
      setIsAwarding(false);
    } else {
      toast.success('Red Star awarded to player!');
      const player = (eligiblePlayers || []).find(p => p.player_id === selectedPlayerId);
      const users = player?.users as any;
      const selectedPlayerName = Array.isArray(users) ? users[0]?.full_name : users?.full_name;
      const finalMvpName = selectedPlayerName || 'Unknown Player';
      
      setAwardedMVP(finalMvpName);
      
      if (broadcastChannelRef.current) {
        await broadcastChannelRef.current.send({
          type: 'broadcast',
          event: 'mvp_update',
          payload: { mvpName: finalMvpName }
        });
      }
      
      setIsAwarding(false);
      setSelectedPlayerId('');
    }
  };

  if (isLoading) return <div className="p-8 text-center">Loading match...</div>;
  if (!match) return <div className="p-8 text-center text-destructive">Match not found.</div>;

  return (
    <div className="space-y-8 pb-12">
      {/* Dynamic Arena Header */}
      <div className="bg-slate-950 text-white py-6 md:py-8 px-6 md:px-10 rounded-[2rem] shadow-2xl border border-white/5 relative overflow-hidden group">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full bg-white/10 hover:bg-white/20 text-white border-none">
              <ChevronLeft className="size-6" />
            </Button>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-5 h-5 text-orange-500" />
                <span className="text-orange-500 font-bold text-xs tracking-[0.2em] uppercase">
                  {match.status === 'Completed' ? 'Post-Game Record' : 'Live Match Control'}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-sans font-black tracking-tight uppercase leading-tight">
                {match.status === 'Completed' ? (
                  <>POST-GAME <span className="text-orange-500">BOX SCORE</span></>
                ) : (
                  <>MATCH <span className="text-orange-500">CONTROL</span></>
                )}
              </h1>
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

        {/* MVP Recognition Center (Visible to EVERYONE once awarded) */}
        {awardedMVP && (
          <Card className="border-primary/50 bg-primary/5 shadow-lg overflow-hidden border-2">
            <CardContent className="p-0">
              <div className="relative py-12 px-6 text-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-orange-500/10 to-transparent pointer-events-none" />
                <div className="relative z-10 animate-in zoom-in fade-in duration-700">
                  <div className="flex justify-center mb-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-orange-500 blur-xl opacity-20 animate-pulse" />
                      <div className="relative inline-flex items-center justify-center p-6 bg-orange-500 rounded-full shadow-2xl shadow-orange-500/50">
                        <Trophy className="size-16 text-white" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 text-orange-600 mb-1">
                      <Star className="size-5 fill-orange-600" />
                      <span className="text-xs font-black uppercase tracking-[0.2em]">Match Recognition</span>
                      <Star className="size-5 fill-orange-600" />
                    </div>
                    <h3 className="text-4xl font-black text-slate-900 uppercase tracking-tighter italic">{awardedMVP}</h3>
                    <div className="inline-block px-4 py-1.5 bg-slate-900 text-white rounded-full text-xs font-bold uppercase tracking-widest mt-4">
                      Official Red Star MVP
                    </div>
                    <p className="text-slate-500 text-sm mt-6 max-w-xs mx-auto">
                      This player has been officially recognized for their exceptional performance in this match.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Administrative Controls (Admins/Coaches Only) */}
        {isAuthorized && (
          <div className="space-y-8">
            {/* Live Scoring Controls */}
            {match.status === 'Ongoing' && (
              <div className="grid md:grid-cols-2 gap-8">
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
              </div>
            )}

            {/* Post-Game Award Form (Only if NOT awarded yet) */}
            {match.status === 'Completed' && !awardedMVP && (
              <Card className="border-primary/50 bg-primary/5 shadow-lg overflow-hidden border-2">
                <CardHeader className="text-center">
                  <div className="flex justify-center mb-2">
                    <Star className="size-12 text-red-500 fill-red-500 animate-bounce" />
                  </div>
                  <CardTitle className="text-2xl text-primary font-black uppercase italic">Post-Game: Award MVP</CardTitle>
                  <p className="text-sm text-muted-foreground">Select the standout player of this match to recognize their performance.</p>
                </CardHeader>
                <CardContent className="max-w-md mx-auto space-y-4 pb-8 text-center">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block text-left">Select MVP Player</label>
                    <Select value={selectedPlayerId} onValueChange={(val) => setSelectedPlayerId(val || '')}>
                      <SelectTrigger className="w-full bg-white border-slate-200">
                        <SelectValue placeholder="Select a player..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(eligiblePlayers || []).map((player) => {
                          const users = player.users as any;
                          const playerName = Array.isArray(users) ? users[0]?.full_name : users?.full_name;
                          return (
                            <SelectItem key={player.player_id} value={player.player_id}>
                              {playerName || 'Unknown Player'}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    className="w-full bg-red-500 hover:bg-red-600 text-white font-bold h-12 gap-2"
                    onClick={handleAwardMVP}
                    disabled={!selectedPlayerId || isAwarding}
                  >
                    <Star className="size-5 fill-white" />
                    {isAwarding ? 'Awarding...' : 'Award Red Star'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Default state if scheduled */}
            {match.status === 'Scheduled' && (
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
