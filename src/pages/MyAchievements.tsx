import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, ChevronLeft, Award, Loader2, Trophy } from 'lucide-react';

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
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const fetchStars = async () => {
    try {
      setIsLoading(true);
      const { data: starsData, error } = await supabase
        .from('player_stars')
        .select('*, matches(round), tournaments(name)')
        .eq('player_id', user?.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      if (starsData) {
        setStars(starsData as unknown as PlayerStar[]);
      }
    } catch (error) {
      console.error('Error fetching stars:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Branded Header */}
      <div className="bg-slate-950 py-6 md:py-8 px-6 md:px-10 rounded-[2rem] shadow-2xl border border-white/5 relative overflow-hidden">
        <div className="relative z-10 flex items-center gap-6">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(-1)} 
            className="rounded-full bg-white/10 hover:bg-white/20 text-white border-none size-12"
          >
            <ChevronLeft className="size-6" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-5 h-5 text-orange-500" />
              <span className="text-orange-500 font-bold text-xs tracking-[0.2em] uppercase">
                Athlete Profile
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter italic uppercase leading-none text-white">MY <span className="text-orange-500">ACHIEVEMENTS</span></h1>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-2 opacity-70">Official PSU Athlete Trophy Room</p>
          </div>
        </div>
        <div className="absolute right-0 top-0 h-full w-64 bg-gradient-to-l from-orange-500/10 to-transparent -skew-x-12 translate-x-32" />
      </div>

      <div className="max-w-5xl mx-auto px-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4 animate-in fade-in duration-500">
            <Loader2 className="size-12 text-orange-500 animate-spin" />
            <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-[10px]">Unlocking Trophy Case...</p>
          </div>
        ) : (stars || []).length === 0 ? (
          <Card className="border-2 border-dashed bg-slate-50/50 dark:bg-white/5 py-24 text-center rounded-[2.5rem] border-slate-200 dark:border-white/10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <CardContent className="space-y-6 pt-6">
              <div className="flex justify-center gap-4 opacity-20">
                <Star className="size-12 text-slate-300" />
                <Star className="size-20 -translate-y-6 text-orange-500" />
                <Star className="size-12 text-slate-300" />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-black italic uppercase tracking-tighter text-slate-400">Empty Trophy Case</h2>
                <p className="text-slate-500 font-medium max-w-sm mx-auto text-sm">
                  The arena awaits. Participate in matches and tournaments to earn MVP stars and claim your place in the Hall of Fame.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {(stars || []).map((star, index) => (
              <Card 
                key={star?.id || index} 
                className="group hover:shadow-2xl transition-all duration-500 border-2 border-slate-100 hover:border-orange-500/30 overflow-hidden rounded-[2rem] animate-in fade-in slide-in-from-bottom-4 fill-mode-both"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className={`h-2 ${star?.star_type === 'Red' ? 'bg-red-500' : 'bg-orange-500'} shadow-lg`} />
                <CardContent className="p-8">
                  <div className="flex items-start justify-between mb-8">
                    <div className={`p-5 rounded-2xl shadow-xl ${
                      star?.star_type === 'Red' ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'
                    } group-hover:scale-110 group-hover:rotate-6 transition-all duration-500`}>
                      <Star className={`size-10 ${star?.star_type === 'Red' ? 'fill-white' : 'fill-white'}`} />
                    </div>
                    <Award className="size-8 text-slate-100 group-hover:text-orange-200 transition-colors" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">Honored Distinction</span>
                    </div>
                    <h3 className="text-2xl font-black uppercase italic tracking-tight leading-none text-slate-900 group-hover:text-orange-600 transition-colors">
                      {star?.star_type === 'Red' ? 'Match MVP' : 'Tournament MVP'}
                    </h3>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest truncate">
                      {star?.tournaments?.name || 'Tournament Participant'}
                    </p>
                    {star?.star_type === 'Red' && (
                      <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 border-none font-black uppercase tracking-[0.2em] text-[9px] mt-2">
                        {star?.matches?.round || 'Round Completed'}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-8 pt-6 border-t border-slate-50 text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] flex items-center justify-between">
                    <span>Awarded</span>
                    <span className="text-slate-400">
                      {star?.created_at ? new Date(star.created_at).toLocaleDateString() : 'N/A'}
                    </span>
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
