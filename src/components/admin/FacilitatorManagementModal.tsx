import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { formatRole } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  ShieldCheck,
  Search,
  UserCheck,
  UserX,
  Loader2,
  Activity,
  Users,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

type UserProfile = {
  id: string;
  full_name: string;
  role: string;
  previous_role?: string | null;
  account_status?: string;
  college_id?: string;
  created_at?: string;
  colleges?: {
    college_name: string;
  } | null;
};

interface FacilitatorManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}

export const FacilitatorManagementModal = ({
  open,
  onOpenChange,
  onUpdated
}: FacilitatorManagementModalProps) => {
  const [activeTab, setActiveTab] = useState<'roster' | 'appoint'>('roster');
  const [facilitators, setFacilitators] = useState<UserProfile[]>([]);
  const [candidates, setCandidates] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);

  // Role Restoration on Revoke State
  const [revokingUser, setRevokingUser] = useState<UserProfile | null>(null);
  const [selectedRestoreRole, setSelectedRestoreRole] = useState<string>('player_student');

  const fetchFacilitators = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*, colleges(college_name)')
        .eq('role', 'facilitator')
        .neq('account_status', 'soft_deleted')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setFacilitators((data || []).map((u: any) => ({
        ...u,
        colleges: Array.isArray(u.colleges) ? u.colleges[0] : u.colleges
      })));
    } catch (err: any) {
      console.error('Error fetching facilitators:', err);
      toast.error('Failed to load facilitators roster: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const searchCandidates = async (query: string) => {
    try {
      let queryBuilder = supabase
        .from('users')
        .select('*, colleges(college_name)')
        .neq('role', 'facilitator')
        .neq('role', 'admin')
        .neq('role', 'super_admin')
        .neq('account_status', 'soft_deleted')
        .order('full_name', { ascending: true })
        .limit(20);

      if (query.trim()) {
        queryBuilder = queryBuilder.ilike('full_name', `%${query.trim()}%`);
      }

      const { data, error } = await queryBuilder;
      if (error) throw error;

      setCandidates((data || []).map((u: any) => ({
        ...u,
        colleges: Array.isArray(u.colleges) ? u.colleges[0] : u.colleges
      })));
    } catch (err: any) {
      console.error('Error searching candidates:', err);
    }
  };

  useEffect(() => {
    if (open) {
      fetchFacilitators();
      searchCandidates(searchQuery);
    }
  }, [open]);

  useEffect(() => {
    if (open && activeTab === 'appoint') {
      const timer = setTimeout(() => {
        searchCandidates(searchQuery);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, activeTab, open]);

  // Appoint User to Facilitator
  // Appoint User to Facilitator (preserving their previous role)
  const handleAppointFacilitator = async (targetUser: UserProfile) => {
    setIsUpdatingId(targetUser.id);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          role: 'facilitator',
          previous_role: targetUser.role
        })
        .eq('id', targetUser.id);

      if (error) throw error;

      await logAudit({
        action: 'APPOINT_FACILITATOR',
        entity_type: 'users',
        entity_id: targetUser.id,
        details: `Appointed "${targetUser.full_name}" (formerly ${targetUser.role}) as official Match Facilitator`
      });

      toast.success(`"${targetUser.full_name}" is now an Official Match Facilitator!`, {
        description: 'Authorized to preside court-side, update scores, and award Match MVPs.'
      });

      // Update lists
      setFacilitators(prev => [...prev, { ...targetUser, role: 'facilitator', previous_role: targetUser.role }]);
      setCandidates(prev => prev.filter(c => c.id !== targetUser.id));
      setActiveTab('roster');
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error('Failed to appoint facilitator: ' + err.message);
    } finally {
      setIsUpdatingId(null);
    }
  };

  // Open Revoke Role Modal with Smart Pre-Selection
  const handleInitiateRevoke = (targetUser: UserProfile) => {
    setRevokingUser(targetUser);
    const restored = targetUser.previous_role || (targetUser.role.toLowerCase().includes('coach') ? 'coach' : 'player_student');
    setSelectedRestoreRole(restored);
  };

  // Confirm Revocation and Restore Selected Role
  const handleConfirmRevoke = async (targetUser: UserProfile, newRole: string) => {
    setIsUpdatingId(targetUser.id);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          role: newRole,
          previous_role: null
        })
        .eq('id', targetUser.id);

      if (error) throw error;

      await logAudit({
        action: 'REVOKE_FACILITATOR',
        entity_type: 'users',
        entity_id: targetUser.id,
        details: `Revoked facilitator authority from "${targetUser.full_name}" (restored to ${newRole})`
      });

      toast.info(`Facilitator appointment revoked. "${targetUser.full_name}" restored as ${newRole}.`);

      // Update lists
      setFacilitators(prev => prev.filter(f => f.id !== targetUser.id));
      setRevokingUser(null);
      searchCandidates(searchQuery);
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error('Failed to revoke facilitator: ' + err.message);
    } finally {
      setIsUpdatingId(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-2xl max-w-[95vw] rounded-3xl border-slate-200 dark:border-white/10 p-3.5 xs:p-4 sm:p-6 shadow-2xl bg-white dark:bg-slate-950 overflow-hidden">
        <DialogHeader className="space-y-1 min-w-0 pr-7">
          <div className="flex items-start sm:items-center gap-2.5 min-w-0">
            <div className="p-2 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-xl border border-orange-500/20 shrink-0">
              <ShieldCheck className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base xs:text-lg sm:text-xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white flex items-center gap-2 leading-tight break-words">
                Match Facilitator Governance
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 break-words">
                Authorize official table scorekeepers and referees court-side without writing database queries.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tab Toggle */}
        <div
          role="tablist"
          aria-label="Facilitator Management Sections"
          className="flex items-center gap-1 sm:gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl mt-3 sm:mt-4 border border-slate-200/50 dark:border-white/5 min-w-0 w-full"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'roster'}
            aria-label={`Appointed Officials (${facilitators.length})`}
            onClick={() => setActiveTab('roster')}
            className={`flex-1 min-h-[36px] py-2 px-1.5 xs:px-2.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-tight sm:tracking-wider transition-colors flex items-center justify-center gap-1 sm:gap-2 cursor-pointer min-w-0 ${
              activeTab === 'roster'
                ? 'bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Activity className="size-3.5 shrink-0" />
            <span className="min-w-0 whitespace-nowrap sm:hidden">Officials ({facilitators.length})</span>
            <span className="min-w-0 whitespace-nowrap hidden sm:inline">Appointed Officials ({facilitators.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'appoint'}
            aria-label="Appoint New Official"
            onClick={() => setActiveTab('appoint')}
            className={`flex-1 min-h-[36px] py-2 px-1.5 xs:px-2.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-tight sm:tracking-wider transition-colors flex items-center justify-center gap-1 sm:gap-2 cursor-pointer min-w-0 ${
              activeTab === 'appoint'
                ? 'bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="size-3.5 shrink-0" />
            <span className="min-w-0 whitespace-nowrap sm:hidden">Appoint New</span>
            <span className="min-w-0 whitespace-nowrap hidden sm:inline">Appoint New Official</span>
          </button>
        </div>

        {/* TAB 1: CURRENT FACILITATORS ROSTER */}
        {activeTab === 'roster' && (
          <div className="mt-3 sm:mt-4 space-y-3 min-w-0 w-full">
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="size-6 animate-spin text-orange-500" />
                <span className="text-xs font-bold uppercase tracking-wider">Loading Facilitators...</span>
              </div>
            ) : facilitators.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/50">
                <Users className="size-10 text-slate-400 mx-auto mb-2 opacity-50" />
                <h4 className="text-sm font-black uppercase tracking-tight text-slate-800 dark:text-slate-200">
                  No Appointed Facilitators Yet
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                  Admins hold scoring authority by default. You can appoint students, faculty, or committee members as dedicated match officials.
                </p>
                <Button
                  size="sm"
                  onClick={() => setActiveTab('appoint')}
                  className="mt-4 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider rounded-xl gap-1.5"
                >
                  <Sparkles className="size-3.5" />
                  Appoint First Facilitator
                </Button>
              </div>
            ) : (
              <div className="max-h-[380px] overflow-y-auto space-y-2.5 pr-1 min-w-0 w-full">
                {facilitators.map((faci) => (
                  <div
                    key={faci.id}
                    className="p-3 sm:p-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 sm:gap-3 shadow-sm hover:border-orange-500/30 transition-all min-w-0 w-full"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                      <div className="size-9 sm:size-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-md shadow-orange-500/20">
                        {faci.full_name?.charAt(0).toUpperCase() || 'F'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                            {faci.full_name}
                          </h4>
                          <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 text-[9px] font-black uppercase">
                            Official Facilitator
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {faci.colleges?.college_name || 'Institutional Staff'}
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleInitiateRevoke(faci)}
                      disabled={isUpdatingId === faci.id}
                      className="h-8 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl shrink-0 ml-auto"
                    >
                      {isUpdatingId === faci.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <UserX className="size-3.5 mr-1" />
                      )}
                      Revoke Role
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: APPOINT NEW FACILITATOR */}
        {activeTab === 'appoint' && (
          <div className="mt-3 sm:mt-4 space-y-3 min-w-0 w-full">
            {/* Search Input */}
            <div className="relative min-w-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                placeholder="Search registered user by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-white/10 rounded-2xl text-xs font-medium"
              />
            </div>

            {/* Candidate List */}
            <div className="max-h-[340px] overflow-y-auto space-y-2 pr-1 min-w-0 w-full">
              {candidates.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  {searchQuery ? 'No matching registered users found.' : 'Type a name to search registered members.'}
                </div>
              ) : (
                candidates.map((cand) => (
                  <div
                    key={cand.id}
                    className="p-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 sm:gap-3 hover:border-slate-300 dark:hover:border-white/20 transition-all min-w-0 w-full"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                      <div className="size-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs shrink-0">
                        {cand.full_name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {cand.full_name}
                          </h4>
                          <Badge variant="outline" className="text-[9px] uppercase font-bold text-slate-500">
                            {cand.role}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate">
                          {cand.colleges?.college_name || 'No college listed'}
                        </p>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleAppointFacilitator(cand)}
                      disabled={isUpdatingId === cand.id}
                      className="h-8 bg-orange-500 hover:bg-orange-600 text-white font-black text-[11px] uppercase tracking-wider rounded-xl gap-1 shrink-0 shadow-sm shadow-orange-500/20 ml-auto"
                    >
                      {isUpdatingId === cand.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <UserCheck className="size-3.5" />
                      )}
                      Appoint
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Footer info note */}
        <div className="mt-3 sm:mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2 text-[11px] text-slate-400 min-w-0 w-full">
          <div className="flex items-center gap-1.5 min-w-0">
            <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
            <span className="truncate">Facilitators bypass athlete document verification.</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-7 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg shrink-0"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Revoke Role Confirmation Modal with Smart Role Restoration */}
    <Dialog open={!!revokingUser} onOpenChange={(isOpen) => !isOpen && setRevokingUser(null)}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-3xl p-6 shadow-2xl">
        <DialogHeader className="space-y-2">
          <div className="size-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
            <UserX className="size-6" />
          </div>
          <DialogTitle className="text-center text-lg font-black uppercase tracking-tight">
            Revoke Facilitator Appointment
          </DialogTitle>
          <DialogDescription className="text-center text-slate-500 dark:text-slate-400 text-xs">
            Select which role to restore for <strong>{revokingUser?.full_name}</strong> once facilitator privileges are removed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2">
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/5 rounded-2xl text-xs space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Official:</span>
              <span className="font-bold text-slate-900 dark:text-white">{revokingUser?.full_name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">College / Unit:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{revokingUser?.colleges?.college_name || 'General Staff'}</span>
            </div>
            {revokingUser?.previous_role && (
              <div className="flex justify-between items-center pt-1.5 border-t border-slate-200 dark:border-white/5">
                <span className="text-slate-500">Original Role Before Appointment:</span>
                <Badge variant="outline" className="text-orange-600 dark:text-orange-400 border-orange-500/30 text-[10px] font-black uppercase">
                  {formatRole(revokingUser.previous_role)}
                </Badge>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
              Restore User To Role:
            </label>
            <Select
              value={selectedRestoreRole}
              onValueChange={(val) => {
                if (val) setSelectedRestoreRole(val);
              }}
            >
              <SelectTrigger className="w-full rounded-xl border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 font-semibold text-xs">
                <SelectValue placeholder="Select role">
                  {selectedRestoreRole === 'coach'
                    ? 'Coach (Team Coach / Staff)'
                    : selectedRestoreRole === 'player_faculty'
                    ? 'Faculty Athlete'
                    : 'Student Athlete'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="coach">Coach (Team Coach / Staff)</SelectItem>
                <SelectItem value="player_student">Student Athlete</SelectItem>
                <SelectItem value="player_faculty">Faculty Athlete</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <Button
            variant="outline"
            className="w-1/2 rounded-xl border-slate-200 dark:border-white/10 font-bold text-xs"
            onClick={() => setRevokingUser(null)}
          >
            Cancel
          </Button>
          <Button
            className="w-1/2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md"
            onClick={() => {
              if (revokingUser) {
                handleConfirmRevoke(revokingUser, selectedRestoreRole);
              }
            }}
            disabled={isUpdatingId === revokingUser?.id}
          >
            {isUpdatingId === revokingUser?.id ? (
              <Loader2 className="size-4 animate-spin mr-1.5" />
            ) : (
              <UserX className="size-4 mr-1.5" />
            )}
            Confirm Revocation
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};
