import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { 
  Trophy, 
  Users, 
  Plus, 
  Star 
} from 'lucide-react';
import { DataToolbar } from '@/components/admin/DataToolbar';
import { ViewToggle } from '@/components/admin/ViewToggle';
import { logAudit } from '@/lib/audit';

// Decomposed Sub-components
import type { Tournament, PendingTeam } from '@/components/tournament-management/types';
import { CreateTournamentModal } from '@/components/tournament-management/CreateTournamentModal';
import { DeleteTournamentModal } from '@/components/tournament-management/DeleteTournamentModal';
import { ConcludeTournamentModal } from '@/components/tournament-management/ConcludeTournamentModal';
import { TournamentListTab } from '@/components/tournament-management/TournamentListTab';
import { TeamApprovalsTab } from '@/components/tournament-management/TeamApprovalsTab';
import { TournamentMvpTab } from '@/components/tournament-management/TournamentMvpTab';
import { BracketGenerationModal } from '@/components/tournament-management/BracketGenerationModal';
import { ExpandableIconTabs } from '@/components/ui/expandable-icon-tabs';

export const TournamentManagement: React.FC = () => {
  const { user } = useAuth();

  // Primary Datasets
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [pendingTeams, setPendingTeams] = useState<PendingTeam[]>([]);
  const [isLoadingTournaments, setIsLoadingTournaments] = useState(true);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);

  // Tab & Filters
  const [activeTab, setActiveTab] = useState('tournaments');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBracketOpen, setIsBracketOpen] = useState(false);
  const [selectedTournamentForBracket, setSelectedTournamentForBracket] = useState<Tournament | null>(null);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [tournamentToDelete, setTournamentToDelete] = useState<Tournament | null>(null);

  const [isConcludeOpen, setIsConcludeOpen] = useState(false);
  const [tournamentToConclude, setTournamentToConclude] = useState<Tournament | null>(null);
  const [concludeChampionName, setConcludeChampionName] = useState<string | null>(null);

  // Data Fetching
  const fetchTournaments = async () => {
    setIsLoadingTournaments(true);
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load tournaments: ' + error.message);
    } else {
      const allTournaments = (data as Tournament[]) || [];
      const activeTournaments = allTournaments.filter(t => !t.is_deleted);
      setTournaments(activeTournaments);
    }
    setIsLoadingTournaments(false);
  };

  const fetchPendingTeams = async () => {
    setIsLoadingTeams(true);
    const { data, error } = await supabase
      .from('teams')
      .select('id, name, status, users!coach_id(full_name), tournaments(id, name, status, sport)')
      .eq('status', 'Pending')
      .or('is_deleted.is.null,is_deleted.eq.false');

    if (error) {
      toast.error('Failed to load pending teams: ' + error.message);
    } else {
      setPendingTeams((data as unknown) as PendingTeam[]);
    }
    setIsLoadingTeams(false);
  };

  useEffect(() => {
    fetchTournaments();
    fetchPendingTeams();
  }, []);

  // Filtered Datasets
  const filteredTournaments = useMemo(() => {
    return tournaments.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            t.sport.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [tournaments, searchQuery, statusFilter]);

  const filteredTeams = useMemo(() => {
    return pendingTeams.filter(team => {
      const teamName = team.name || '';
      const coachName = (team.users as any)?.full_name || '';
      const tourName = (team.tournaments as any)?.name || '';
      
      return teamName.toLowerCase().includes(searchQuery.toLowerCase()) ||
             coachName.toLowerCase().includes(searchQuery.toLowerCase()) ||
             tourName.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [pendingTeams, searchQuery]);

  // Team Approval Handlers
  const handleApproveTeam = async (teamId: string) => {
    const pendingTeam = pendingTeams.find(t => t.id === teamId);
    const tournamentStatus = (pendingTeam?.tournaments as any)?.status;

    if (tournamentStatus && tournamentStatus !== 'Draft') {
      toast.error(`Team approvals are only permitted during the Draft phase. This tournament is already "${tournamentStatus}".`);
      return;
    }

    const { error } = await supabase
      .from('teams')
      .update({ status: 'Approved' })
      .eq('id', teamId);

    if (error) {
      toast.error('Failed to approve team: ' + error.message);
    } else {
      toast.success('Team approved successfully.');
      
      logAudit({
        action: 'APPROVE_TEAM',
        entity_type: 'teams',
        entity_id: teamId,
        details: `Approved team ${teamId} for tournament ${(pendingTeam?.tournaments as any)?.name || 'Draft tournament'}`
      });

      fetchPendingTeams();
    }
  };

  const handleRejectTeam = async (teamId: string) => {
    const pendingTeam = pendingTeams.find(t => t.id === teamId);
    const adminId = user?.id || (await supabase.auth.getUser()).data.user?.id || null;

    const { error } = await supabase
      .from('teams')
      .update({
        status: 'Rejected',
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: adminId
      })
      .eq('id', teamId);

    if (error) {
      toast.error('Failed to reject team: ' + error.message);
    } else {
      toast.success('Team application moved to Recovery Archive.', {
        description: 'Preserved in Recovery Center if you need to restore it.'
      });

      await logAudit({
        action: 'REJECT_TEAM',
        entity_type: 'teams',
        entity_id: teamId,
        details: `Soft-deleted / rejected team application: ${pendingTeam?.name || teamId}`
      });

      fetchPendingTeams();
    }
  };

  const openBracketWizard = (tournament: Tournament) => {
    setSelectedTournamentForBracket(tournament);
    setIsBracketOpen(true);
  };

  const promptDeleteTournament = (tournament: Tournament) => {
    setTournamentToDelete(tournament);
    setIsDeleteOpen(true);
  };

  const promptConcludeTournament = (tournament: Tournament, champ: string | null) => {
    setTournamentToConclude(tournament);
    setConcludeChampionName(champ);
    setIsConcludeOpen(true);
  };

  return (
    <div className="space-y-6 relative max-w-[1600px] mx-auto px-4 pb-6">
      {/* Subtle Grain Overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.015] mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/p6.png')]" />

      {/* Header Showcase Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-950 text-white py-6 md:py-8 px-6 md:px-10 rounded-[2rem] shadow-2xl border border-white/5 relative overflow-hidden group">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-5 h-5 text-orange-500" />
            <span className="text-orange-500 font-bold text-xs tracking-[0.2em] uppercase">
              Administrative Hub
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black italic tracking-tighter uppercase leading-none">
            TOURNAMENT <span className="text-orange-500">ARENA</span>
          </h1>
          <p className="text-slate-400 font-sans font-medium text-sm tracking-wide mt-2 max-w-2xl opacity-80">
            The central command for institutional competitions, team enrollments, and MVP recognition.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          <Button 
            size="lg" 
            onClick={() => setIsCreateOpen(true)}
            className="h-14 bg-orange-500 hover:bg-orange-600 text-white font-black gap-2 px-8 rounded-xl shadow-xl shadow-orange-500/20 uppercase italic tracking-wider transition-all hover:scale-[1.02] active:scale-95 group cursor-pointer"
          >
            <Plus className="size-5 group-hover:rotate-90 transition-transform duration-300" /> 
            <span className="text-base">Host Event</span>
          </Button>
        </div>

        <div className="absolute -right-20 -top-20 size-96 bg-orange-500/10 rounded-full blur-[100px] group-hover:bg-orange-500/20 transition-all duration-1000" />
      </div>

      {/* Management Navigation Tabs — Expandable Icon Tabs (Single sleek 44px row) */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full relative z-10 flex flex-col min-w-0">
        <ExpandableIconTabs
          tabs={[
            { id: 'tournaments', label: 'Tournaments', icon: Trophy, count: tournaments.length },
            {
              id: 'approvals',
              label: 'Approvals',
              icon: Users,
              count: pendingTeams.length,
              badgeTone: pendingTeams.length > 0 ? 'warning' : 'muted',
            },
            { id: 'mvp', label: 'MVP Hall of Fame', icon: Star },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
          className="w-full sm:w-fit sm:mx-auto sm:self-center mb-6"
          ariaLabel="Tournament Operations Navigation"
        />

        {activeTab !== 'mvp' && (
          <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <DataToolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              filterValue={statusFilter}
              onFilterChange={setStatusFilter}
              filterOptions={[
                { label: 'All Statuses', value: 'all' },
                { label: 'Draft Mode', value: 'Draft' },
                { label: 'Active Games', value: 'Active' },
                { label: 'Completed', value: 'Completed' },
              ]}
              searchPlaceholder={activeTab === 'tournaments' ? 'Search tournaments or sports...' : 'Search teams or coaches...'}
              actions={
                <ViewToggle view={viewMode} onViewChange={setViewMode} />
              }
            />
          </div>
        )}

        <TabsContent value="tournaments" className="space-y-6 outline-none">
          <TournamentListTab
            tournaments={filteredTournaments}
            isLoading={isLoadingTournaments}
            viewMode={viewMode}
            onOpenWizard={openBracketWizard}
            onPromptDelete={promptDeleteTournament}
            onClearFilters={() => {
              setSearchQuery('');
              setStatusFilter('all');
            }}
          />
        </TabsContent>

        <TabsContent value="approvals" className="space-y-6 outline-none">
          <TeamApprovalsTab
            teams={filteredTeams}
            isLoading={isLoadingTeams}
            viewMode={viewMode}
            onApprove={handleApproveTeam}
            onReject={handleRejectTeam}
            onClearSearch={() => setSearchQuery('')}
          />
        </TabsContent>

        <TabsContent value="mvp" className="space-y-6 outline-none">
          <TournamentMvpTab tournaments={tournaments} />
        </TabsContent>
      </Tabs>

      {/* Host Event Modal */}
      <CreateTournamentModal
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onTournamentCreated={() => {
          fetchTournaments();
        }}
      />

      {/* Delete / Soft Archive Modal */}
      <DeleteTournamentModal
        isOpen={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        tournament={tournamentToDelete}
        onDeleted={() => {
          fetchTournaments();
          fetchPendingTeams();
        }}
      />

      {/* Conclude Tournament Modal */}
      <ConcludeTournamentModal
        isOpen={isConcludeOpen}
        onOpenChange={setIsConcludeOpen}
        tournament={tournamentToConclude}
        championName={concludeChampionName}
        onConcluded={() => {
          fetchTournaments();
          if (selectedTournamentForBracket) {
            setSelectedTournamentForBracket(prev => prev ? { ...prev, status: 'Completed' } : null);
          }
        }}
      />

      {/* Bracket Generation & Match Manager Wizard */}
      <BracketGenerationModal
        isOpen={isBracketOpen}
        onOpenChange={setIsBracketOpen}
        tournament={selectedTournamentForBracket}
        onMatchesUpdated={() => {
          fetchTournaments();
        }}
        onOpenConclude={(tourn, champ) => {
          promptConcludeTournament(tourn, champ);
        }}
      />
    </div>
  );
};
export default TournamentManagement;
