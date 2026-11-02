import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Layers,
  Sparkles,
  Building2,
  MapPin,
  Check,
  AlertCircle,
  Loader2,
  Palette,
  Search,
  X,
} from 'lucide-react';
import {
  type Cluster,
  CLUSTER_COLOR_PALETTE,
} from '@/lib/clusterGovernance';
import { PSU_MAIN_COLLEGES } from '@/lib/collegeDictionary';
import { PSU_EXTERNAL_CAMPUSES, formatCampusShort } from '@/lib/psuCampuses';

interface ClusterGovernanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clusterToEdit: Cluster | null;
  allClusters: Cluster[];
  onSuccess: () => void;
}

export const ClusterGovernanceModal = ({
  open,
  onOpenChange,
  clusterToEdit,
  allClusters,
  onSuccess,
}: ClusterGovernanceModalProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#f97316');
  const [selectedColleges, setSelectedColleges] = useState<string[]>([]);
  const [selectedCampuses, setSelectedCampuses] = useState<string[]>([]);
  const [campusFilterQuery, setCampusFilterQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Filtered external campuses based on search query
  const filteredExternalCampuses = useMemo(() => {
    if (!campusFilterQuery.trim()) return PSU_EXTERNAL_CAMPUSES;
    const q = campusFilterQuery.trim().toLowerCase();
    return PSU_EXTERNAL_CAMPUSES.filter(
      (c) => c.toLowerCase().includes(q) || formatCampusShort(c).toLowerCase().includes(q)
    );
  }, [campusFilterQuery]);

  // Initialize form when opened or clusterToEdit changes
  useEffect(() => {
    if (open) {
      if (clusterToEdit) {
        setName(clusterToEdit.name || '');
        setDescription(clusterToEdit.description || '');
        setColor(clusterToEdit.color || '#f97316');
        setSelectedColleges(clusterToEdit.college_codes || []);
        setSelectedCampuses(clusterToEdit.campuses || []);
      } else {
        setName('');
        setDescription('');
        // Pick an unused palette color if available
        const usedColors = new Set(allClusters.map((c) => c.color));
        const freeColor = CLUSTER_COLOR_PALETTE.find((c) => !usedColors.has(c)) || '#f97316';
        setColor(freeColor);
        setSelectedColleges([]);
        setSelectedCampuses([]);
      }
    }
  }, [open, clusterToEdit, allClusters]);

  // Map other clusters for exclusivity lookup
  const otherClusters = allClusters.filter(
    (c) => !clusterToEdit || c.id !== clusterToEdit.id
  );

  const getCollegeAssignment = (code: string): Cluster | undefined => {
    return otherClusters.find((c) => c.college_codes?.includes(code));
  };

  const getCampusAssignment = (campus: string): Cluster | undefined => {
    return otherClusters.find((c) => c.campuses?.includes(campus));
  };

  const toggleCollege = (code: string) => {
    setSelectedColleges((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const toggleCampus = (campus: string) => {
    setSelectedCampuses((prev) =>
      prev.includes(campus) ? prev.filter((c) => c !== campus) : [...prev, campus]
    );
  };

  const handleSelectAllAvailableColleges = () => {
    const assignedCodes = new Set(
      otherClusters.flatMap((c) => c.college_codes || [])
    );
    const available = PSU_MAIN_COLLEGES.map((c) => c.code).filter(
      (code) => !assignedCodes.has(code)
    );
    setSelectedColleges(available);
  };

  const handleSelectAllAvailableCampuses = () => {
    const assignedCampuses = new Set(
      otherClusters.flatMap((c) => c.campuses || [])
    );
    const available = PSU_EXTERNAL_CAMPUSES.filter(
      (campus) => !assignedCampuses.has(campus)
    );
    setSelectedCampuses(available);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Cluster / Tribe name is required');
      return;
    }

    // Check duplicate name
    const duplicate = otherClusters.find(
      (c) => c.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      toast.error(`A cluster named "${duplicate.name}" already exists.`);
      return;
    }

    setIsSaving(true);
    try {
      let savedClusterId = clusterToEdit?.id;

      if (clusterToEdit) {
        // Update existing cluster
        const { error: updateErr } = await supabase
          .from('clusters')
          .update({
            name: trimmedName,
            description: description.trim(),
            color,
            college_codes: selectedColleges,
            campuses: selectedCampuses,
          })
          .eq('id', clusterToEdit.id);

        if (updateErr) throw updateErr;

        await logAudit({
          action: 'UPDATE_CLUSTER',
          entity_type: 'clusters',
          entity_id: clusterToEdit.id,
          details: `Updated cluster ${trimmedName} (${selectedColleges.length} colleges, ${selectedCampuses.length} external campuses)`,
        });
      } else {
        // Insert new cluster
        const { data: newCluster, error: insertErr } = await supabase
          .from('clusters')
          .insert({
            name: trimmedName,
            description: description.trim(),
            color,
            college_codes: selectedColleges,
            campuses: selectedCampuses,
          })
          .select('id')
          .single();

        if (insertErr) throw insertErr;
        savedClusterId = newCluster?.id;

        await logAudit({
          action: 'CREATE_CLUSTER',
          entity_type: 'clusters',
          entity_id: savedClusterId,
          details: `Created cluster ${trimmedName} (${selectedColleges.length} colleges, ${selectedCampuses.length} external campuses)`,
        });
      }

      // Enforce exclusivity: remove assigned colleges & campuses from other clusters
      for (const other of otherClusters) {
        const needsCollegeUpdate = (other.college_codes || []).some((code) =>
          selectedColleges.includes(code)
        );
        const needsCampusUpdate = (other.campuses || []).some((camp) =>
          selectedCampuses.includes(camp)
        );

        if (needsCollegeUpdate || needsCampusUpdate) {
          const updatedColleges = (other.college_codes || []).filter(
            (code) => !selectedColleges.includes(code)
          );
          const updatedCampuses = (other.campuses || []).filter(
            (camp) => !selectedCampuses.includes(camp)
          );

          await supabase
            .from('clusters')
            .update({
              college_codes: updatedColleges,
              campuses: updatedCampuses,
            })
            .eq('id', other.id);
        }
      }

      toast.success(
        clusterToEdit
          ? `Cluster "${trimmedName}" updated successfully`
          : `Cluster "${trimmedName}" created successfully`
      );
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error saving cluster:', err);
      toast.error(err.message || 'Failed to save cluster');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-3xl max-w-[95vw] rounded-3xl border-slate-200 dark:border-white/10 p-4 sm:p-6 shadow-2xl bg-white dark:bg-slate-950 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="space-y-1 min-w-0 pr-7 shrink-0">
          <div className="flex items-start sm:items-center gap-2.5 min-w-0">
            <div
              className="p-2.5 rounded-xl border shrink-0 transition-colors"
              style={{
                backgroundColor: `${color}15`,
                borderColor: `${color}40`,
                color: color,
              }}
            >
              <Layers className="size-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg sm:text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                <span>{clusterToEdit ? 'Configure Cluster / Tribe' : 'Create New Cluster / Tribe'}</span>
                {name && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-white"
                    style={{ backgroundColor: color }}
                  >
                    {name}
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                Partition Main Campus colleges and whole external campuses into university athletic tribes.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Form Body */}
        <div className="overflow-y-auto pr-1 sm:pr-2 space-y-6 my-2 grow">
          {/* Section 1: Cluster Identity & Theme */}
          <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
              <Sparkles className="size-3.5 text-orange-500" />
              <span>Tribe Identity & Branding</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Cluster / Tribe Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Tribo Apolaki or Cluster North"
                  className="rounded-xl border-slate-200 dark:border-white/10 text-xs font-bold"
                  maxLength={60}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Palette className="size-3 text-orange-500" />
                  <span>Theme Color</span>
                </label>
                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                  {CLUSTER_COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className="size-7 rounded-lg transition-transform cursor-pointer relative flex items-center justify-center shrink-0 shadow-sm"
                      style={{
                        backgroundColor: c,
                        transform: color === c ? 'scale(1.15)' : 'scale(1)',
                        outline: color === c ? '2px solid white' : 'none',
                        outlineOffset: color === c ? '1px' : '0px',
                      }}
                      title={c}
                    >
                      {color === c && <Check className="size-3.5 text-white stroke-[3]" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Tagline / Description
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. God of Sun & War — Guardians of the North"
                className="rounded-xl border-slate-200 dark:border-white/10 text-xs min-h-[58px]"
                maxLength={250}
              />
            </div>
          </div>

          {/* Section 2: Main Campus College Partition */}
          <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                <Building2 className="size-3.5 text-blue-500" />
                <span>Main Campus Colleges (Partitioned)</span>
                <span className="px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-black">
                  {selectedColleges.length} Selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllAvailableColleges}
                  className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Add Available
                </button>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedColleges([])}
                  className="text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-rose-500 cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
              Athletes enrolled in Puerto Princesa Main Campus inherit this tribe based on their college badge. Each college is strictly exclusive to one tribe.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {PSU_MAIN_COLLEGES.map((col) => {
                const isSelected = selectedColleges.includes(col.code);
                const assignedToOther = getCollegeAssignment(col.code);

                return (
                  <button
                    key={col.code}
                    type="button"
                    onClick={() => toggleCollege(col.code)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start justify-between gap-2 group ${
                      isSelected
                        ? 'border-transparent text-white shadow-md'
                        : assignedToOther
                        ? 'border-slate-200 dark:border-white/5 bg-slate-100/70 dark:bg-white/5 hover:border-orange-500/40 text-slate-700 dark:text-slate-300'
                        : 'border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 hover:border-blue-500 text-slate-800 dark:text-slate-200'
                    }`}
                    style={isSelected ? { backgroundColor: color } : undefined}
                  >
                    <div className="min-w-0 pr-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-xs tracking-tight uppercase">
                          {col.code}
                        </span>
                        {isSelected && (
                          <Badge className="bg-white/20 text-white text-[8px] font-black uppercase px-1 py-0 border-0">
                            Active
                          </Badge>
                        )}
                      </div>
                      <p
                        className={`text-[10px] leading-tight line-clamp-1 mt-0.5 ${
                          isSelected ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'
                        }`}
                        title={col.name}
                      >
                        {col.name}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      {isSelected ? (
                        <div className="size-5 rounded-full bg-white/20 flex items-center justify-center text-white">
                          <Check className="size-3 stroke-[3]" />
                        </div>
                      ) : assignedToOther ? (
                        <Badge
                          variant="outline"
                          className="text-[8px] font-bold border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 group-hover:border-orange-500"
                        >
                          Transfer from {assignedToOther.name.replace(/^Tribo\s+/i, '')}
                        </Badge>
                      ) : (
                        <span className="text-[9px] font-bold uppercase text-slate-400 group-hover:text-blue-500">
                          + Add
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: External Campuses (Whole Entities Partition) */}
          <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                <MapPin className="size-3.5 text-emerald-500" />
                <span>External Campuses (Whole Entities)</span>
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black">
                  {selectedCampuses.length} Selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllAvailableCampuses}
                  className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Add Available
                </button>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedCampuses([])}
                  className="text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-rose-500 cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
              Provincial campuses participate as whole university entities (e.g. PSU Brooke&apos;s Point, Narra, Coron) rather than by college divisions.
            </p>

            {/* Campus Search Filter */}
            <div className="relative">
              <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={campusFilterQuery}
                onChange={(e) => setCampusFilterQuery(e.target.value)}
                placeholder="Search external campuses (e.g. Narra, Coron, Brooke's Point)..."
                className="pl-8 pr-8 h-8 rounded-xl border-slate-200 dark:border-white/10 text-xs font-medium"
              />
              {campusFilterQuery && (
                <button
                  type="button"
                  onClick={() => setCampusFilterQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
              {filteredExternalCampuses.map((campus) => {
                const isSelected = selectedCampuses.includes(campus);
                const assignedToOther = getCampusAssignment(campus);
                const shortName = formatCampusShort(campus);

                return (
                  <button
                    key={campus}
                    type="button"
                    onClick={() => toggleCampus(campus)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-1.5 group ${
                      isSelected
                        ? 'border-transparent text-white shadow-md'
                        : assignedToOther
                        ? 'border-slate-200 dark:border-white/5 bg-slate-100/70 dark:bg-white/5 hover:border-orange-500/40 text-slate-700 dark:text-slate-300'
                        : 'border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 hover:border-emerald-500 text-slate-800 dark:text-slate-200'
                    }`}
                    style={isSelected ? { backgroundColor: color } : undefined}
                    title={campus}
                  >
                    <div className="min-w-0 pr-1">
                      <span className="font-bold text-[11px] leading-tight line-clamp-1">
                        {shortName}
                      </span>
                    </div>

                    <div className="shrink-0">
                      {isSelected ? (
                        <div className="size-4 rounded-full bg-white/20 flex items-center justify-center text-white">
                          <Check className="size-2.5 stroke-[3]" />
                        </div>
                      ) : assignedToOther ? (
                        <Badge
                          variant="outline"
                          className="text-[8px] font-bold border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 group-hover:border-orange-500"
                        >
                          Transfer from {assignedToOther.name.replace(/^Tribo\s+/i, '')}
                        </Badge>
                      ) : (
                        <span className="text-[8px] font-bold uppercase text-slate-400 group-hover:text-emerald-500">
                          + Add
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            {filteredExternalCampuses.length === 0 && (
              <p className="text-xs text-center text-slate-400 py-3 italic">
                No campuses match &quot;{campusFilterQuery}&quot;
              </p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <AlertCircle className="size-3.5 text-orange-500 shrink-0" />
            <span>
              Total: {selectedColleges.length} Main Colleges, {selectedCampuses.length} External Campuses
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="rounded-xl text-xs font-bold uppercase tracking-wider flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider gap-2 shadow-lg shadow-orange-500/20 flex-1 sm:flex-initial cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  {clusterToEdit ? 'Save Changes' : 'Create Cluster'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
