import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Layers,
  Search,
  Plus,
  RotateCcw,
  Trash2,
  Loader2,
  X,
} from 'lucide-react';
import {
  type Cluster,
  resetToOfficialBinturunganTribes,
} from '@/lib/clusterGovernance';
import { ClusterGovernanceCard } from '@/components/admin/ClusterGovernanceCard';
import { ClusterGovernanceModal } from '@/components/admin/ClusterGovernanceModal';

export const ClusterGovernanceTab: React.FC = () => {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal & Dialog states
  const [isClusterModalOpen, setIsClusterModalOpen] = useState(false);
  const [clusterToEdit, setClusterToEdit] = useState<Cluster | null>(null);
  const [clusterToDelete, setClusterToDelete] = useState<Cluster | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const fetchClusters = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('clusters')
        .select('id, name, description, college_codes, campuses, color, created_at')
        .order('name');
      if (error) throw error;
      setClusters((data || []) as Cluster[]);
    } catch (err: any) {
      console.error('Error fetching clusters:', err);
      toast.error('Failed to load clusters: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClusters();
  }, []);

  // Filtered clusters based on name, colleges, or external campuses
  const filteredClusters = useMemo(() => {
    if (!searchQuery.trim()) return clusters;
    const q = searchQuery.trim().toLowerCase();
    return clusters.filter((c) => {
      const nameMatch = c.name.toLowerCase().includes(q);
      const descMatch = (c.description || '').toLowerCase().includes(q);
      const collegeMatch = (c.college_codes || []).some((code) =>
        code.toLowerCase().includes(q)
      );
      const campusMatch = (c.campuses || []).some((camp) =>
        camp.toLowerCase().includes(q)
      );
      return nameMatch || descMatch || collegeMatch || campusMatch;
    });
  }, [clusters, searchQuery]);

  const handleDeleteCluster = async () => {
    if (!clusterToDelete) return;
    setIsDeleting(true);
    try {
      const { count: teamCount } = await supabase
        .from('teams')
        .select('*', { count: 'exact', head: true })
        .eq('cluster_id', clusterToDelete.id);

      if (teamCount && teamCount > 0) {
        toast.error(
          `Cannot delete "${clusterToDelete.name}" because ${teamCount} squad(s) are currently affiliated with it. Reassign or delete those squads first.`
        );
        setClusterToDelete(null);
        return;
      }

      const { error } = await supabase
        .from('clusters')
        .delete()
        .eq('id', clusterToDelete.id);

      if (error) throw error;

      await logAudit({
        action: 'DELETE_CLUSTER',
        entity_type: 'clusters',
        entity_id: clusterToDelete.id,
        details: `Deleted cluster "${clusterToDelete.name}"`,
      });

      toast.success(`Cluster "${clusterToDelete.name}" deleted successfully.`);
      setClusterToDelete(null);
      fetchClusters();
    } catch (err: any) {
      console.error('Error deleting cluster:', err);
      toast.error(err.message || 'Failed to delete cluster');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResetClusters = async () => {
    setIsResetting(true);
    try {
      const res = await resetToOfficialBinturunganTribes(supabase);
      if (!res.success) throw new Error(res.error);
      toast.success('Successfully reset all clusters to official PSU Binturungan Tribes presets!');
      setIsResetDialogOpen(false);
      fetchClusters();
    } catch (err: any) {
      console.error('Error resetting clusters:', err);
      toast.error(err.message || 'Failed to reset clusters');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner & Toolbar */}
      <div className="bg-slate-950 text-white rounded-3xl p-5 sm:p-7 border border-white/5 relative overflow-hidden shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-2xl text-orange-500 shrink-0">
              <Layers className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">
                  Palawan State University
                </span>
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-slate-300 text-[9px] font-bold">
                  {clusters.length} Official Tribes
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase italic tracking-tight text-white mt-0.5">
                Cluster &amp; Tribe Governance
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Configure official athletic clusters. Main Campus entities partition by college, while provincial external campuses participate as whole university units with strict exclusivity.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <Button
              variant="ghost"
              onClick={() => setIsResetDialogOpen(true)}
              className="h-10 border border-white/15 hover:border-orange-500/60 bg-white/5 hover:bg-orange-500/20 text-white hover:text-white font-bold gap-2 px-3.5 rounded-xl text-xs uppercase tracking-wider cursor-pointer"
            >
              <RotateCcw className="size-3.5 text-orange-400" />
              <span>Reset to Official Tribes</span>
            </Button>

            <Button
              onClick={() => {
                setClusterToEdit(null);
                setIsClusterModalOpen(true);
              }}
              className="h-10 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase text-xs tracking-wider gap-2 px-4 rounded-xl shadow-lg shadow-orange-500/25 cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Create Cluster</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Search Filter Bar */}
      <div className="relative max-w-md">
        <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter by tribe name, college (e.g. CS, CEAT), or campus (e.g. Narra, Coron)..."
          className="pl-10 pr-9 h-11 rounded-2xl border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-medium shadow-sm"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Clusters Responsive Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-64 rounded-3xl bg-slate-100 dark:bg-white/5 animate-pulse border border-slate-200 dark:border-white/5"
            />
          ))}
        </div>
      ) : filteredClusters.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-200 dark:border-white/10 p-12 text-center space-y-3 bg-white dark:bg-slate-900">
          <Layers className="size-10 text-slate-400 mx-auto" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {searchQuery ? 'No Tribes Match Search' : 'No Clusters Configured'}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {searchQuery
              ? `No athletic tribes matched "${searchQuery}". Clear your search or try searching by college acronym or campus name.`
              : 'Click "Reset to Official Tribes" to seed the authentic 6 PSU Binturungan Tribes.'}
          </p>
          {searchQuery ? (
            <Button
              variant="outline"
              onClick={() => setSearchQuery('')}
              className="text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer"
            >
              Clear Search
            </Button>
          ) : (
            <Button
              onClick={() => setIsResetDialogOpen(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl gap-2 cursor-pointer"
            >
              <RotateCcw className="size-3.5" />
              Reset to Official Tribes
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
          {filteredClusters.map((cluster) => (
            <ClusterGovernanceCard
              key={cluster.id}
              cluster={cluster}
              onEdit={(item) => {
                setClusterToEdit(item);
                setIsClusterModalOpen(true);
              }}
              onDelete={(item) => setClusterToDelete(item)}
            />
          ))}
        </div>
      )}

      {/* Cluster Create / Edit Modal */}
      <ClusterGovernanceModal
        open={isClusterModalOpen}
        onOpenChange={setIsClusterModalOpen}
        clusterToEdit={clusterToEdit}
        allClusters={clusters}
        onSuccess={fetchClusters}
      />

      {/* Delete Cluster Confirmation Dialog */}
      <Dialog
        open={!!clusterToDelete}
        onOpenChange={(open) => !open && setClusterToDelete(null)}
      >
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-3xl p-6 shadow-2xl">
          <DialogHeader className="space-y-2">
            <div className="size-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 className="size-6" />
            </div>
            <DialogTitle className="text-center text-lg font-black uppercase tracking-tight">
              Delete Cluster / Tribe
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-slate-500 dark:text-slate-400">
              Are you sure you want to delete <strong className="text-slate-900 dark:text-white font-bold">{clusterToDelete?.name}</strong>? Its assigned colleges and external campuses will become unassigned. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex sm:justify-center gap-2 pt-4">
            <Button
              variant="ghost"
              onClick={() => setClusterToDelete(null)}
              disabled={isDeleting}
              className="rounded-xl text-xs font-bold uppercase tracking-wider flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteCluster}
              disabled={isDeleting}
              className="bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-wider gap-2 shadow-lg shadow-rose-500/20 flex-1 sm:flex-initial cursor-pointer"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="size-4" />
                  Delete Cluster
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset to Official Tribes Confirmation Dialog */}
      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-3xl p-6 shadow-2xl">
          <DialogHeader className="space-y-2">
            <div className="size-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center mx-auto">
              <RotateCcw className="size-6" />
            </div>
            <DialogTitle className="text-center text-lg font-black uppercase tracking-tight">
              Reset to Official PSU Binturungan Tribes
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-slate-500 dark:text-slate-400">
              This will restore the 6 official university tribes (Tribo Apolaki, Tribo Libulan, Tribo Tala, Tribo Haliya, Tribo Mapulon, Tribo Dumangan) with default Main Campus colleges and external campus assignments.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex sm:justify-center gap-2 pt-4">
            <Button
              variant="ghost"
              onClick={() => setIsResetDialogOpen(false)}
              disabled={isResetting}
              className="rounded-xl text-xs font-bold uppercase tracking-wider flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
            <Button
              onClick={handleResetClusters}
              disabled={isResetting}
              className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider gap-2 shadow-lg shadow-orange-500/20 flex-1 sm:flex-initial cursor-pointer"
            >
              {isResetting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <RotateCcw className="size-4" />
                  Confirm Reset
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
