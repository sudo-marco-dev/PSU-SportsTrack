import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { VerificationUpload } from '@/components/auth/VerificationUpload';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Activity, Trophy, Clock, Star } from 'lucide-react';

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
  const [stars, setStars] = useState<PlayerStar[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

    if (user && isVerified) {
      fetchDashboardData();
    }
  }, [user, isVerified]);

  useEffect(() => {
    if (!user || !isVerified) return;

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
  }, [user, isVerified]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    
    // Fetch Roster Data
    const { data: rosterData, error: rosterError } = await supabase
      .from('team_roster')
      .select('id, status, teams(name, tournaments(name))')
      .eq('player_id', user?.id);

    if (rosterError) {
      toast.error('Failed to load roster data: ' + rosterError.message);
    } else {
      const formattedRoster = (rosterData as unknown) as RosterInvite[];
      setInvites(formattedRoster.filter((i) => i.status === 'Pending'));
      setMyTeams(formattedRoster.filter((i) => i.status === 'Approved'));
    }

    // Fetch Live/Upcoming Matches
    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select('id, team_a_score, team_b_score, status, round, team_a:team_a_id(name), team_b:team_b_id(name)')
      .in('status', ['Scheduled', 'Ongoing'])
      .order('status', { ascending: false }); // Ongoing first

    if (matchError) {
      toast.error('Failed to load live matches: ' + matchError.message);
    } else {
      setLiveMatches(matchData as unknown as LiveMatch[]);
    }

    // Fetch MVP Stars
    const { data: starsData } = await supabase
      .from('player_stars')
      .select('*, matches(round), tournaments(name)')
      .eq('player_id', user?.id);
    
    if (starsData) {
      setStars(starsData as unknown as PlayerStar[]);
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

  if (!isVerified) {
    if (hasPendingDocuments) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
          <h1 className="text-2xl font-bold mb-2">Documents Under Review</h1>
          <p className="text-gray-600">Your verification documents have been received and are currently being reviewed by an admin. Please check back later.</p>
        </div>
      );
    }

    return (
      <div className="p-4">
        <VerificationUpload onUploadSuccess={() => setHasPendingDocuments(true)} />
      </div>
    );
  }

  if (isLoading && isVerified) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-lg text-muted-foreground animate-pulse">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-12">
      <div>
        <h1 className="text-3xl font-bold">Player Dashboard</h1>
        <p className="mt-2 text-gray-600">Manage your team invitations and watch live university matches.</p>
      </div>

      {/* MVP Stars / Trophy Case Section */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Trophy className="size-5 text-yellow-500" /> My Achievements
        </h2>
        <Card className="bg-gradient-to-br from-background to-muted/50 border-2">
          <CardContent className="pt-6">
            {stars.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <p className="text-muted-foreground">Participate in matches to earn MVP stars!</p>
                <div className="flex justify-center gap-2 opacity-20">
                  <Star className="size-6" />
                  <Star className="size-6" />
                  <Star className="size-6" />
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {stars.map((star) => (
                  <div 
                    key={star.id} 
                    className="flex items-center gap-4 p-4 rounded-xl bg-background border shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className={`p-3 rounded-full ${
                      star.star_type === 'Red' ? 'bg-red-100' : 'bg-yellow-100'
                    }`}>
                      <Star className={`size-6 ${
                        star.star_type === 'Red' 
                          ? 'text-red-500 fill-red-500' 
                          : 'text-yellow-500 fill-yellow-500'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">
                        {star.star_type === 'Red' ? 'Match MVP' : 'Tournament MVP'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {star.star_type === 'Red' 
                          ? `${star.tournaments?.name} - ${star.matches?.round}`
                          : star.tournaments?.name
                        }
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

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
            {liveMatches.map((match) => (
              <Card key={match.id} className={match.status === 'Ongoing' ? 'border-primary shadow-md' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <Badge 
                      variant={match.status === 'Ongoing' ? 'destructive' : 'secondary'} 
                      className={match.status === 'Ongoing' ? 'animate-pulse bg-red-600 hover:bg-red-700' : ''}
                    >
                      {match.status === 'Ongoing' ? 'LIVE' : match.status}
                    </Badge>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{match.round}</span>
                  </div>
                  <CardTitle className="text-lg mt-2 flex items-center justify-between">
                    <span>{match.team_a?.name || 'TBD'}</span>
                    <span className="text-muted-foreground text-sm font-normal mx-2 italic">vs</span>
                    <span>{match.team_b?.name || 'BYE'}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {match.status === 'Ongoing' && (
                    <div className="flex justify-center items-center gap-4 bg-muted/50 py-2 rounded-md font-mono text-xl font-bold">
                      <span>{match.team_a_score}</span>
                      <span className="opacity-30">-</span>
                      <span>{match.team_b_score}</span>
                    </div>
                  )}
                  {match.status === 'Scheduled' && (
                    <div className="flex justify-center items-center gap-2 text-muted-foreground text-sm">
                      <Clock className="size-4" /> <span>Match scheduled</span>
                    </div>
                  )}
                  <Button 
                    className="w-full gap-2" 
                    variant={match.status === 'Ongoing' ? 'default' : 'outline'}
                    onClick={() => navigate(`/match/${match.id}`)}
                  >
                    <Trophy className="size-4" /> Watch Live View
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Pending Invites Section */}
      {invites.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            Active Team Invites
            <Badge variant="destructive">{invites.length}</Badge>
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {invites.map((invite) => (
              <Card key={invite.id} className="border-primary/50 bg-primary/5">
                <CardHeader>
                  <CardTitle>
                    {Array.isArray(invite.teams) ? invite.teams[0]?.name : invite.teams?.name ?? 'Unknown Team'}
                  </CardTitle>
                  <CardDescription>
                    {(() => {
                      const team = Array.isArray(invite.teams) ? invite.teams[0] : invite.teams;
                      return Array.isArray(team?.tournaments) ? team?.tournaments[0]?.name : team?.tournaments?.name ?? 'Unknown Tournament';
                    })()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Button 
                    className="flex-1" 
                    onClick={() => handleRosterAction(invite.id, 'Approved')}
                  >
                    Accept
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1" 
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

      {/* My Teams Section */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">My Teams</h2>
        {myTeams.length === 0 ? (
          <div className="p-8 border border-dashed rounded-lg text-center text-muted-foreground">
            You are not currently part of any teams. Wait for an invitation from a coach.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {myTeams.map((roster) => (
              <Card key={roster.id}>
                <CardHeader>
                  <CardTitle>
                    {Array.isArray(roster.teams) ? roster.teams[0]?.name : roster.teams?.name ?? 'Unknown Team'}
                  </CardTitle>
                  <CardDescription>
                    {(() => {
                      const team = Array.isArray(roster.teams) ? roster.teams[0] : roster.teams;
                      return Array.isArray(team?.tournaments) ? team?.tournaments[0]?.name : team?.tournaments?.name ?? 'Unknown Tournament';
                    })()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge>Approved Member</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
