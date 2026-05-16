import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, Trophy, ChevronLeft, Award } from 'lucide-react';

type PlayerStar = {
  id: string;
  star_type: 'Red' | 'Gold';
  match_id: string | null;
  tournament_id: string | null;
  created_at: string;
  matches: { round: string } | null;
  tournaments: { name: string } | null;
};

export const MyAchievements = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stars, setStars] = useState<PlayerStar[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchStars();
    }
  }, [user]);

  const fetchStars = async () => {
    setIsLoading(true);
    const { data: starsData } = await supabase
      .from('player_stars')
      .select('*, matches(round), tournaments(name)')
      .eq('player_id', user?.id)
      .order('created_at', { ascending: false });
    
    if (starsData) {
      setStars(starsData as unknown as PlayerStar[]);
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Branded Header */}
      <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl border border-white/5 relative overflow-hidden">
        <div className="relative z-10 flex items-center gap-6">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(-1)} 
            className="rounded-full bg-white/10 hover:bg-white/20 text-white border-none"
          >
            <ChevronLeft className="size-6" />
          </Button>
          <div>
            <h1 className="text-3xl font-black tracking-tighter italic uppercase leading-none">MY <span className="text-orange-500">ACHIEVEMENTS</span></h1>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-1 opacity-70">Official PSU Athlete Trophy Room</p>
          </div>
        </div>
        <div className="absolute right-0 top-0 h-full w-64 bg-orange-500/10 -skew-x-12 translate-x-32" />
      </div>

      <div className="max-w-5xl mx-auto px-4">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Trophy className="size-12 text-slate-200 animate-pulse" />
          </div>
        ) : stars.length === 0 ? (
          <Card className="border-2 border-dashed bg-muted/5 py-20 text-center">
            <CardContent className="space-y-4 pt-6">
              <div className="flex justify-center gap-4 opacity-10">
                <Star className="size-12" />
                <Star className="size-16 -translate-y-4" />
                <Star className="size-12" />
              </div>
              <h2 className="text-2xl font-bold text-slate-400">Empty Trophy Case</h2>
              <p className="text-slate-500 max-w-sm mx-auto">
                Participate in matches and tournaments to earn MVP stars and recognition.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {stars.map((star) => (
              <Card key={star.id} className="group hover:shadow-xl transition-all duration-300 border-2 overflow-hidden">
                <div className={`h-2 ${star.star_type === 'Red' ? 'bg-red-500' : 'bg-orange-500'}`} />
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div className={`p-4 rounded-2xl ${
                      star.star_type === 'Red' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                    } group-hover:scale-110 transition-transform`}>
                      <Star className={`size-8 ${star.star_type === 'Red' ? 'fill-red-500' : 'fill-orange-500'}`} />
                    </div>
                    <Award className="size-6 text-slate-200" />
                  </div>
                  
                  <div className="space-y-1">
                    <h3 className="text-xl font-black uppercase italic tracking-tight">
                      {star.star_type === 'Red' ? 'Match MVP' : 'Tournament MVP'}
                    </h3>
                    <p className="text-sm font-bold text-slate-500">
                      {star.tournaments?.name}
                    </p>
                    {star.star_type === 'Red' && (
                      <p className="text-xs font-black text-orange-500/80 uppercase tracking-widest mt-2">
                        {star.matches?.round}
                      </p>
                    )}
                  </div>

                  <div className="mt-6 pt-6 border-t border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                    Earned on {new Date(star.created_at).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
