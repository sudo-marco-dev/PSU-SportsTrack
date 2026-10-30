import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, Star, CheckCircle2 } from 'lucide-react';
import { logAudit } from '@/lib/audit';
import type { Tournament } from './types';

interface TournamentMvpTabProps {
  tournaments: Tournament[];
}

export const TournamentMvpTab: React.FC<TournamentMvpTabProps> = ({ tournaments }) => {
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [selectedPlayerForGoldId, setSelectedPlayerForGoldId] = useState<string>('');
  const [tournamentPlayers, setTournamentPlayers] = useState<any[]>([]);
  const [existingGoldWinner, setExistingGoldWinner] = useState<string | null>(null);
  const [existingGoldStarId, setExistingGoldStarId] = useState<string | null>(null);
  const [isAwardingGold, setIsAwardingGold] = useState<boolean>(false);

  useEffect(() => {
    if (!selectedTournamentId) {
      setTournamentPlayers([]);
      setSelectedPlayerForGoldId('');
      setExistingGoldWinner(null);
      setExistingGoldStarId(null);
      return;
    }

    const fetchPlayers = async () => {
      const [{ data: teamsData }, { data: existingStar }] = await Promise.all([
        supabase
          .from('teams')
          .select('id')
          .eq('tournament_id', selectedTournamentId)
          .eq('status', 'Approved')
          .or('is_deleted.is.null,is_deleted.eq.false'),
        supabase
          .from('player_stars')
          .select('id, player_id, users:player_id(full_name)')
          .eq('tournament_id', selectedTournamentId)
          .eq('star_type', 'Gold')
          .maybeSingle(),
      ]);

      if (existingStar) {
        const uObj: any = (existingStar as any).users;
        const name = Array.isArray(uObj) ? uObj[0]?.full_name : uObj?.full_name;
        setExistingGoldWinner(name || 'Awarded Athlete');
        setExistingGoldStarId(existingStar.id);
      } else {
        setExistingGoldWinner(null);
        setExistingGoldStarId(null);
      }

      if (teamsData && teamsData.length > 0) {
        const teamIds = teamsData.map(t => t.id);
        const { data: playersData } = await supabase
          .from('team_roster')
          .select('player_id, users(full_name)')
          .in('team_id', teamIds)
          .eq('status', 'Approved');

        if (playersData) {
          const uniquePlayers = Array.from(new Map(playersData.map(p => [p.player_id, p])).values());
          setTournamentPlayers(uniquePlayers);
        }
      } else {
        setTournamentPlayers([]);
      }
    };

    fetchPlayers();
  }, [selectedTournamentId]);

  const handleAwardGoldStar = async () => {
    if (isAwardingGold || !selectedTournamentId || !selectedPlayerForGoldId) {
      if (!selectedTournamentId || !selectedPlayerForGoldId) {
        toast.error('Please select both a tournament and a player.');
      }
      return;
    }

    setIsAwardingGold(true);
    const { error } = await supabase.from('player_stars').insert({
      player_id: selectedPlayerForGoldId,
      star_type: 'Gold',
      tournament_id: selectedTournamentId,
      awarded_by: (await supabase.auth.getUser()).data.user?.id
    });

    if (error) {
      if (error.code === '23505') {
        toast.error('A Tournament MVP has already been awarded!');
      } else {
        toast.error('Failed to award Tournament MVP: ' + error.message);
      }
    } else {
      const awardedObj = (tournamentPlayers || []).find(p => p.player_id === selectedPlayerForGoldId);
      const awardedName = Array.isArray(awardedObj?.users) ? awardedObj?.users[0]?.full_name : awardedObj?.users?.full_name;
      setExistingGoldWinner(awardedName || 'Awarded Athlete');
      toast.success('Gold Star awarded to Tournament MVP!');

      logAudit({
        action: 'AWARD_STAR',
        entity_type: 'player_stars',
        entity_id: selectedPlayerForGoldId,
        details: `Awarded MVP Gold Star in tournament ${selectedTournamentId}`
      });

      setSelectedPlayerForGoldId('');
    }
    setIsAwardingGold(false);
  };

  const handleRevokeGoldStar = async () => {
    if (!existingGoldStarId) return;
    const confirm = window.confirm(
      `Are you sure you want to revoke the Tournament MVP Gold Star from ${existingGoldWinner}? This will return the tournament to an unawarded state.`
    );
    if (!confirm) return;

    const { error } = await supabase.from('player_stars').delete().eq('id', existingGoldStarId);
    if (error) {
      toast.error('Failed to revoke Gold Star: ' + error.message);
    } else {
      toast.success('Gold Star revoked successfully.');
      logAudit({
        action: 'REVOKE_STAR',
        entity_type: 'player_stars',
        entity_id: existingGoldStarId,
        details: `Revoked Tournament MVP Gold Star from ${existingGoldWinner} in tournament ${selectedTournamentId}`,
      });
      setExistingGoldWinner(null);
      setExistingGoldStarId(null);
      setSelectedPlayerForGoldId('');
    }
  };

  return (
    <div className="grid lg:grid-cols-5 gap-12 items-start animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="lg:col-span-2 space-y-6">
        <div className="p-10 bg-slate-950 text-white rounded-[3rem] shadow-2xl relative overflow-hidden group border border-white/5">
          <div className="relative z-10">
            <div className="size-16 rounded-3xl bg-orange-500 flex items-center justify-center mb-8 shadow-2xl shadow-orange-500/20 group-hover:scale-110 transition-transform duration-500">
              <Trophy className="size-8 text-white" />
            </div>
            <h3 className="text-4xl font-black italic uppercase tracking-tighter leading-none mb-4">
              Gold Star <br /> <span className="text-orange-500 text-5xl">Recognition</span>
            </h3>
            <p className="text-slate-400 font-bold text-sm uppercase tracking-widest leading-relaxed opacity-60">
              The ultimate honor for a PSU athlete. Awarding a Gold Star signifies peak performance and institutional mastery.
            </p>
          </div>
          <Star className="absolute -bottom-10 -right-10 size-48 text-white/5 group-hover:text-orange-500/10 transition-colors duration-1000 rotate-12 group-hover:rotate-45" />
        </div>

        <div className="p-8 bg-orange-50 dark:bg-orange-500/5 rounded-[2.5rem] border-2 border-orange-200/50 dark:border-orange-500/10">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-orange-200 dark:bg-orange-500/20 rounded-xl mt-1">
              <Star className="size-5 text-orange-600" />
            </div>
            <div>
              <h4 className="font-black uppercase italic text-lg tracking-tight text-orange-900 dark:text-orange-400">
                Institutional Impact
              </h4>
              <p className="text-xs font-bold text-orange-800/60 dark:text-orange-400/60 uppercase tracking-widest mt-1">
                Awarded players receive a permanent "Tournament MVP" badge on their profile dashboard.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Card className="lg:col-span-3 rounded-[3rem] border-2 border-slate-100 dark:border-white/5 shadow-2xl overflow-hidden p-1">
        <CardContent className="space-y-8 p-12">
          <div className="grid md:grid-cols-1 gap-8">
            <div className="space-y-4">
              <Label className="text-[10px] uppercase font-black text-slate-400 tracking-[0.3em] ml-1">
                1. Select Tournament Arena
              </Label>
              <Select value={selectedTournamentId} onValueChange={(val) => setSelectedTournamentId(val ?? '')}>
                <SelectTrigger className="border-2 h-16 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-white/5 font-black uppercase italic tracking-tight text-lg focus:ring-orange-500 transition-all cursor-pointer">
                  <SelectValue placeholder="Browse Competitions...">
                    {selectedTournamentId && (tournaments || []).find(t => t.id === selectedTournamentId)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {(tournaments || []).map(t => (
                    <SelectItem key={t.id} value={t.id} className="rounded-xl font-bold uppercase italic text-sm">
                      {t.name} ({t.sport})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <Label className="text-[10px] uppercase font-black text-slate-400 tracking-[0.3em] ml-1">
                2. Nominate Top Performer
              </Label>
              {existingGoldWinner && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-amber-600 dark:text-amber-400">
                  <div className="flex items-center gap-3">
                    <Trophy className="size-5 shrink-0" />
                    <div className="text-xs font-bold">
                      Official Tournament MVP: <strong className="font-black uppercase underline">{existingGoldWinner}</strong>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRevokeGoldStar}
                    className="text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10 font-bold uppercase h-8 px-3 rounded-lg"
                  >
                    Revoke Star
                  </Button>
                </div>
              )}
              <Select 
                value={selectedPlayerForGoldId} 
                onValueChange={(val) => setSelectedPlayerForGoldId(val ?? '')}
                disabled={!selectedTournamentId || !!existingGoldWinner}
              >
                <SelectTrigger className="border-2 h-16 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-white/5 font-black uppercase italic tracking-tight text-lg focus:ring-orange-500 transition-all disabled:opacity-30 cursor-pointer">
                  <SelectValue placeholder={selectedTournamentId ? 'Select MVP Candidate...' : 'Select tournament first'}>
                    {selectedPlayerForGoldId && (() => {
                      const p = (tournamentPlayers || []).find(p => p.player_id === selectedPlayerForGoldId);
                      if (!p) return null;
                      return Array.isArray(p.users) ? p.users[0]?.full_name : p.users?.full_name;
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {(tournamentPlayers || []).length === 0 ? (
                    <div className="p-8 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                      No verified players found in this arena.
                    </div>
                  ) : (
                    (tournamentPlayers || []).map((p: any) => (
                      <SelectItem key={p.player_id} value={p.player_id} className="rounded-xl font-bold uppercase italic text-sm">
                        {Array.isArray(p.users) 
                          ? p.users[0]?.full_name 
                          : p.users?.full_name ?? 'Unknown Player'}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="pt-6">
            <Button 
              className="w-full h-20 bg-orange-500 hover:bg-orange-600 text-white font-black text-2xl italic uppercase tracking-tighter gap-4 shadow-2xl shadow-orange-500/30 rounded-[2rem] transition-all hover:scale-[1.02] active:scale-95 disabled:grayscale cursor-pointer"
              disabled={!selectedPlayerForGoldId || isAwardingGold}
              onClick={handleAwardGoldStar}
            >
              <Star className={`size-8 ${isAwardingGold ? 'animate-spin' : 'fill-white animate-pulse'}`} />
              {isAwardingGold ? 'Committing to Hall of Fame...' : 'Award Tournament MVP'}
            </Button>
            <div className="flex items-center justify-center gap-2 mt-6 opacity-40">
              <CheckCircle2 className="size-3 text-slate-400" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                Official Hall of Fame Record
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
