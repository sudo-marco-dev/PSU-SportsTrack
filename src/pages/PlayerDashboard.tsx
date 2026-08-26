import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { VerificationUpload } from '@/components/auth/VerificationUpload';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Activity, Trophy, Clock, Star, User, CalendarDays, Dumbbell, Swords, MapPin } from 'lucide-react';

type RosterInvite = {
  id: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  teams: {
    name: string;
    tournaments: {
      name: string;
    } | { name: string }[] | null;
  } | { name: string; tournaments: any }[] | null;
};

type LiveMatch = {
  id: string;
  team_a_score: number;
  team_b_score: number;
  status: string;
  round: string;
  venue?: string | null;
  team_a: { name: string } | null;
  team_b: { name: string } | null;
};

type PlayerStar = {
  id: string;
  star_type: 'Red' | 'Gold';
  match_id: string | null;
  tournament_id: string | null;
  created_at: string;
  matches: { round: string } | null;
  tournaments: { name: string } | null;
};

export const PlayerDashboard = () => {
  const { isVerified, user } = useAuth();
  const navigate = useNavigate();
  const [hasPendingDocuments, setHasPendingDocuments] = useState(false);
  const [invites, setInvites] = useState<RosterInvite[]>([]);
  const [myTeams, setMyTeams] = useState<RosterInvite[]>([]);
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [draftTournaments, setDraftTournaments] = useState<any[]>([]);
  const [stars, setStars] = useState<PlayerStar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTournament, setSelectedTournament] = useState<any | null>(null);

  useEffect(() => {
    if (user && !isVerified) {
      supabase
        .from('verification_documents')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'Pending')
        .then(({ data }) => {
          if (data && data.length > 0) {
            setHasPendingDocuments(true);
          }
        });
    }

    fetchDashboardData();
  }, [user, isVerified]);

  useEffect(() => {
    if (!user) return;

    const matchSubscription = supabase
      .channel('dashboard-live-matches')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setLiveMatches((prev) => 
              prev.map(match => 
                match.id === payload.new.id 
                  ? { 
                      ...match, 
                      status: payload.new.status, 
                      team_a_score: payload.new.team_a_score, 
                      team_b_score: payload.new.team_b_score 
                    } 
                  : match
              )
            );
          } else {
            fetchDashboardData(); 
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(matchSubscription);
    };
  }, [user]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    
    // Fetch Roster Data only if logged in
    if (user?.id) {
      const { data: rosterData } = await supabase
        .from('team_roster')
        .select('id, status, teams(name, tournaments(name))')
        .eq('player_id', user.id);

      if (rosterData) {
        const formattedRoster = (rosterData as unknown) as RosterInvite[];
        setInvites(formattedRoster.filter((i) => i.status === 'Pending'));
        setMyTeams(formattedRoster.filter((i) => i.status === 'Approved'));
      }

      // Fetch MVP Stars
      const { data: starsData } = await supabase
        .from('player_stars')
        .select('*, matches(round), tournaments(name)')
        .eq('player_id', user.id);
      
      if (starsData) {
        setStars(starsData as unknown as PlayerStar[]);
      }
    } else {
      setInvites([]);
      setMyTeams([]);
      setStars([]);
    }

    // Fetch Live/Upcoming Matches (Public)
    const { data: matchData } = await supabase
      .from('matches')
      .select('id, team_a_score, team_b_score, status, round, venue, team_a:team_a_id(name), team_b:team_b_id(name)')
      .in('status', ['Scheduled', 'Ongoing'])
      .order('status', { ascending: false });

    if (matchData) {
      setLiveMatches(matchData as unknown as LiveMatch[]);
    }

    // Fetch Draft / Coming Soon Tournaments (Public)
    const { data: draftData } = await supabase
      .from('tournaments')
      .select('*')
      .eq('status', 'Draft')
      .order('created_at', { ascending: false });

    if (draftData) {
      setDraftTournaments(draftData);
    }

    setIsLoading(false);
  };

  const handleRosterAction = async (inviteId: string, newStatus: 'Approved' | 'Rejected') => {
    const { error } = await supabase
      .from('team_roster')
      .update({ status: newStatus })
      .eq('id', inviteId);

    if (error) {
      toast.error(`Error: ${error.message}`);
    } else {
      toast.success(`Invite ${newStatus === 'Approved' ? 'accepted' : 'declined'}.`);
      fetchDashboardData();
    }
  };

  if (user && !isVerified) {
    if (hasPendingDocuments) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
          <div className="size-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-6">
            <Clock className="size-8 animate-pulse" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 uppercase italic">Review <span className="text-orange-500">In Progress</span></h1>
          <p className="text-slate-500 max-w-md mx-auto mt-4 font-medium">Your verification documents are being processed by our team. You'll gain full access once your eligibility is confirmed.</p>
        </div>
      );
    }

    return (
      <div className="p-4">
        <VerificationUpload onUploadSuccess={() => setHasPendingDocuments(true)} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-lg text-muted-foreground animate-pulse">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Hero Banner */}
      <div className="bg-slate-950 py-5 md:py-8 px-5 md:px-10 rounded-2xl md:rounded-[2rem] shadow-2xl border border-white/5 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 md:w-5 md:h-5 text-orange-500" />
              <span className="text-orange-500 font-bold text-xs tracking-[0.2em] uppercase">
                {user ? 'Athlete Hub' : 'Official Portal'}
              </span>
            </div>
            <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white uppercase italic leading-none">
              {user ? 'PLAYER ' : 'SPORTS '}<span className="text-orange-500">HUB</span>
            </h1>
            <p className="text-slate-400 text-xs md:text-sm font-medium mt-2 max-w-md">
              {user 
                ? 'Track your progress, accept team invitations, and follow live university matches.'
                : 'Explore live university matches, upcoming tournaments, and official PSU sports action.'}
            </p>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <div className="px-3.5 py-2 bg-white/5 rounded-xl md:rounded-2xl border border-white/10 backdrop-blur-md">
                <p className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total Stars</p>
                <div className="flex items-center gap-1.5">
                  <Star className="size-3 text-orange-500 fill-orange-500" />
                  <p className="text-lg md:text-xl font-black text-white leading-none">{stars.length}</p>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="absolute right-0 top-0 h-full w-64 bg-gradient-to-l from-orange-500/10 to-transparent -skew-x-12 translate-x-32" />
      </div>

      {/* MVP Stars / Achievements Preview (Only visible when logged in) */}
      {user && (
        <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-both">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-black uppercase italic tracking-tight flex items-center gap-2">
              <Trophy className="size-5 text-orange-500" /> My Achievements
            </h2>
          </div>
          <Card className="bg-white border-2 border-slate-100 overflow-hidden shadow-xl rounded-2xl md:rounded-[2rem]">
            <CardContent className="p-4 md:p-8">
              {stars.length === 0 ? (
                <div className="text-center py-8 space-y-3 opacity-50">
                  <div className="flex justify-center gap-3">
                    <Star className="size-7 text-slate-200" />
                    <Star className="size-9 text-slate-300 -translate-y-2" />
                    <Star className="size-7 text-slate-200" />
                  </div>
                  <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-slate-400">Trophy Case Empty</p>
                </div>
              ) : (
                <div className="space-y-4 md:space-y-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 md:gap-6 p-4 md:p-6 rounded-xl md:rounded-[1.5rem] bg-slate-50 border border-slate-100 group hover:border-orange-500/30 transition-all duration-300">
                    <div className={`p-4 md:p-5 rounded-2xl shadow-lg shrink-0 ${
                      stars[0].star_type === 'Red' ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'
                    }`}>
                      <Star className={`size-8 md:size-10 ${stars[0].star_type === 'Red' ? 'fill-white' : 'fill-white'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">Latest Honor</span>
                        <div className="h-px flex-1 bg-slate-200" />
                      </div>
                      <p className="font-black text-xl md:text-2xl uppercase italic tracking-tight leading-none mb-1">
                        {stars[0].star_type === 'Red' ? 'Match MVP' : 'Tournament MVP'}
                      </p>
                      <p className="text-xs md:text-sm font-bold text-slate-500 truncate">
                        {stars[0].tournaments?.name}
                      </p>
                    </div>
                    <div className="hidden md:block">
                      <Badge variant="outline" className="font-black uppercase tracking-widest border-2 px-3 py-1 text-[10px]">{new Date(stars[0].created_at).toLocaleDateString()}</Badge>
                    </div>
                  </div>

                  <Button 
                    variant="outline" 
                    className="w-full h-12 md:h-14 border-2 border-slate-100 font-black uppercase italic tracking-widest text-xs md:text-sm hover:bg-slate-950 hover:text-white hover:border-slate-950 transition-all rounded-xl md:rounded-2xl group shadow-sm"
                    onClick={() => navigate('/profile')}
                  >
                    <span className="group-hover:translate-x-1 transition-transform inline-block mr-2">View Full Trophy Room</span>
                    <Trophy className="size-4 opacity-50" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Coming Soon • Upcoming Tournaments Banner */}
      {draftTournaments.length > 0 && (
        <section className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-orange-500 animate-ping" />
              <h2 className="text-lg md:text-xl font-black uppercase italic tracking-tight text-slate-900 flex items-center gap-2">
                <Clock className="size-4 md:size-5 text-orange-500" /> Coming Soon • Upcoming Events
              </h2>
            </div>
            <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 font-black text-[9px] md:text-[10px] uppercase tracking-wider border border-orange-500/20">
              Draft & Recruitment Phase
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {draftTournaments.map((t) => (
              <div 
                key={t.id}
                onClick={() => setSelectedTournament(t)}
                className="p-5 rounded-2xl bg-gradient-to-br from-white via-orange-50/20 to-orange-50/40 border-2 border-orange-500/20 hover:border-orange-500 hover:shadow-lg transition-all duration-300 cursor-pointer group relative overflow-hidden"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-md bg-orange-500 text-white font-bold text-[9px] uppercase tracking-wider">
                    {t.sport}
                  </span>
                  <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest bg-orange-500/10 px-2 py-0.5 rounded-full">
                    Coming Soon
                  </span>
                </div>
                <h4 className="font-black text-base uppercase italic tracking-tight text-slate-900 truncate group-hover:text-orange-500 transition-colors">
                  {t.name}
                </h4>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                  <span>Kickoff: {new Date(t.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  <span className="text-orange-600 font-black uppercase tracking-wider group-hover:translate-x-1 transition-transform inline-flex items-center gap-0.5">
                    View Details →
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Live & Upcoming Games Section */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Activity className="size-5 text-primary" /> Live & Upcoming Games
        </h2>
        {liveMatches.length === 0 ? (
          <div className="p-8 border border-dashed rounded-lg text-center text-muted-foreground">
            No live or upcoming games at the moment.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {liveMatches.map((match, index) => (
              <Card 
                key={match.id} 
                className={`group transition-all duration-300 border-2 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 fill-mode-both ${
                  match.status === 'Ongoing' ? 'border-orange-500 shadow-xl shadow-orange-500/10' : 'hover:border-slate-300'
                }`}
                style={{ animationDelay: `${index * 75}ms` }}
              >
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start mb-2">
                    <Badge 
                      variant={match.status === 'Ongoing' ? 'destructive' : 'secondary'} 
                      className={`font-black uppercase text-[10px] tracking-widest ${match.status === 'Ongoing' ? 'animate-pulse bg-red-600' : ''}`}
                    >
                      {match.status === 'Ongoing' ? 'LIVE NOW' : match.status}
                    </Badge>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">{match.round}</span>
                  </div>
                  <CardTitle className="text-lg mt-2 flex items-center justify-between font-black uppercase italic tracking-tight">
                    <span className="truncate">{match.team_a?.name || 'TBD'}</span>
                    <span className="text-slate-300 text-xs mx-2">VS</span>
                    <span className="truncate">{match.team_b?.name || 'BYE'}</span>
                  </CardTitle>
                  {match.venue && (
                    <div className="flex items-center gap-1 mt-2 text-[10px] font-black text-slate-500 uppercase tracking-wider truncate">
                      <MapPin className="size-3 text-orange-500 shrink-0" />
                      <span className="truncate">{match.venue}</span>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {match.status === 'Ongoing' && (
                    <div className="flex justify-center items-center gap-6 bg-slate-950 text-white py-3 rounded-xl font-mono text-2xl font-black shadow-inner">
                      <span className="text-orange-500">{match.team_a_score}</span>
                      <span className="opacity-20">:</span>
                      <span className="text-orange-500">{match.team_b_score}</span>
                    </div>
                  )}
                  {match.status === 'Scheduled' && (
                    <div className="flex justify-center items-center gap-2 text-slate-400 font-bold uppercase text-[10px] tracking-widest py-3 bg-slate-50 rounded-xl border border-dashed">
                      <Clock className="size-3" /> <span>Pre-Match Warmup</span>
                    </div>
                  )}
                  <Button 
                    className="w-full gap-2 font-black uppercase italic tracking-widest h-11 rounded-xl" 
                    variant={match.status === 'Ongoing' ? 'default' : 'outline'}
                    onClick={() => navigate(`/match/${match.id}`)}
                  >
                    Watch Live Tracker
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Pending Invites Section (Only visible when logged in) */}
      {user && invites.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            Active Team Invites
            <Badge variant="destructive">{invites.length}</Badge>
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {invites.map((invite, index) => (
              <Card 
                key={invite.id} 
                className="group border-2 border-orange-200 bg-orange-50/30 overflow-hidden rounded-2xl animate-in fade-in slide-in-from-bottom-4 fill-mode-both"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="h-1 w-full bg-orange-500" />
                <CardHeader>
                  <CardTitle className="font-black uppercase italic tracking-tight">
                    {Array.isArray(invite.teams) ? invite.teams[0]?.name : invite.teams?.name ?? 'Unknown Team'}
                  </CardTitle>
                  <CardDescription className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    {(() => {
                      const team = Array.isArray(invite.teams) ? invite.teams[0] : invite.teams;
                      return Array.isArray(team?.tournaments) ? team?.tournaments[0]?.name : team?.tournaments?.name ?? 'Unknown Tournament';
                    })()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Button 
                    className="flex-1 font-black uppercase italic tracking-widest h-10 rounded-xl" 
                    onClick={() => handleRosterAction(invite.id, 'Approved')}
                  >
                    Join Team
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1 font-black uppercase italic tracking-widest h-10 rounded-xl border-2" 
                    onClick={() => handleRosterAction(invite.id, 'Rejected')}
                  >
                    Decline
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* My Teams Section (Only visible when logged in) */}
      {user && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">My Teams</h2>
          {myTeams.length === 0 ? (
            <div className="p-8 border border-dashed rounded-lg text-center text-muted-foreground">
              You are not currently part of any teams. Wait for an invitation from a coach.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {myTeams.map((roster, index) => (
                <Card 
                  key={roster.id} 
                  className="group border-2 border-slate-100 hover:border-slate-300 transition-all rounded-2xl animate-in fade-in slide-in-from-bottom-4 fill-mode-both"
                  style={{ animationDelay: `${index * 75}ms` }}
                >
                  <CardHeader>
                    <CardTitle className="font-black uppercase italic tracking-tight">
                      {Array.isArray(roster.teams) ? roster.teams[0]?.name : roster.teams?.name ?? 'Unknown Team'}
                    </CardTitle>
                    <CardDescription className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      {(() => {
                        const team = Array.isArray(roster.teams) ? roster.teams[0] : roster.teams;
                        return Array.isArray(team?.tournaments) ? team?.tournaments[0]?.name : team?.tournaments?.name ?? 'Unknown Tournament';
                      })()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Badge className="font-black uppercase tracking-widest text-[9px] bg-slate-900">Official Roster Member</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Coming Soon Tournament Detail Dialog */}
      <Dialog open={!!selectedTournament} onOpenChange={(open) => { if (!open) setSelectedTournament(null); }}>
        <DialogContent className="sm:max-w-lg">
          {selectedTournament && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-md bg-orange-500 text-white font-bold text-[9px] uppercase tracking-wider">
                    {selectedTournament.sport}
                  </span>
                  <Badge variant="secondary" className="font-black uppercase text-[9px] tracking-widest">
                    {selectedTournament.status}
                  </Badge>
                </div>
                <DialogTitle className="text-xl font-black uppercase italic tracking-tight">
                  {selectedTournament.name}
                </DialogTitle>
                <DialogDescription>
                  This tournament is currently in the recruitment phase. Teams are being assembled — stay tuned for the official kickoff!
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                {/* Sport */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
                    <Dumbbell className="size-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sport</p>
                    <p className="font-bold text-sm text-slate-900">{selectedTournament.sport}</p>
                  </div>
                </div>

                {/* Format / Type */}
                {selectedTournament.type && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
                      <Swords className="size-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Format</p>
                      <p className="font-bold text-sm text-slate-900">{selectedTournament.type}</p>
                    </div>
                  </div>
                )}

                {/* Start Date */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
                    <CalendarDays className="size-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Start Date</p>
                    <p className="font-bold text-sm text-slate-900">
                      {new Date(selectedTournament.start_date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                {/* End Date */}
                {selectedTournament.end_date && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="p-2 rounded-lg bg-slate-200 text-slate-600">
                      <CalendarDays className="size-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">End Date</p>
                      <p className="font-bold text-sm text-slate-900">
                        {new Date(selectedTournament.end_date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  className="w-full font-black uppercase italic tracking-widest h-11 rounded-xl"
                  onClick={() => {
                    setSelectedTournament(null);
                    navigate('/matches');
                  }}
                >
                  Go to Match Arena
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
