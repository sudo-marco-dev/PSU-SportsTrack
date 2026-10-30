import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { DevPersona } from '@/lib/devPersonas';

export type UserRole =
  | 'admin'
  | 'super_admin'
  | 'facilitator'
  | 'coach'
  | 'player_student'
  | 'player_faculty'
  | 'player_staff'
  | 'official'
  | 'dev';

export type AccountStatus = 'active' | 'inactive' | 'archived' | 'soft_deleted';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  isVerified: boolean;
  isLoading: boolean;
  isDev: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isFacilitator: boolean;
  isOfficial: boolean;
  isCoach: boolean;
  isPlayer: boolean;
  isFacultyAthlete: boolean;
  isStaffAthlete: boolean;
  isStudentAthlete: boolean;
  canAccessFriendlyGames: boolean;
  accountStatus: AccountStatus;
  profile: {
    full_name: string | null;
    role: UserRole | null;
    is_facilitator?: boolean | null;
    college_id?: string | null;
    college_name?: string | null;
    cluster_id?: string | null;
    account_status?: AccountStatus;
    faculty_id_url?: string | null;
    student_number?: string | null;
    employee_id?: string | null;
    department?: string | null;
    campus?: string | null;
    program?: string | null;
    year_level?: number | string | null;
    age?: number | null;
    preferred_sports?: string[] | null;
    primary_position?: string | null;
  } | null;
  impersonatedPersona: DevPersona | null;
  impersonatePersona: (persona: DevPersona) => void;
  clearImpersonation: () => void;
  isImpersonating: boolean;
  isLoginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  signOut: () => Promise<void>;
  refetchProfile?: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  isVerified: false,
  isLoading: true,
  isDev: false,
  isAdmin: false,
  isSuperAdmin: false,
  isFacilitator: false,
  isOfficial: false,
  isCoach: false,
  isPlayer: false,
  isFacultyAthlete: false,
  isStaffAthlete: false,
  isStudentAthlete: false,
  canAccessFriendlyGames: false,
  accountStatus: 'active',
  profile: null,
  impersonatedPersona: null,
  impersonatePersona: () => { },
  clearImpersonation: () => { },
  isImpersonating: false,
  isLoginModalOpen: false,
  openLoginModal: () => { },
  closeLoginModal: () => { },
  signOut: async () => { },
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [accountStatus, setAccountStatus] = useState<AccountStatus>('active');
  const [profile, setProfile] = useState<AuthContextType['profile']>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Dev Persona Impersonation State
  const [impersonatedPersona, setImpersonatedPersona] = useState<DevPersona | null>(() => {
    try {
      const saved = localStorage.getItem('psu_dev_impersonated_persona');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const impersonatePersona = (persona: DevPersona) => {
    setImpersonatedPersona(persona);
    try {
      localStorage.setItem('psu_dev_impersonated_persona', JSON.stringify(persona));
    } catch {
      // ignore storage failure
    }
    toast.success(`Active Persona: ${persona.full_name} (${persona.persona_label})`);
  };

  const clearImpersonation = () => {
    setImpersonatedPersona(null);
    try {
      localStorage.removeItem('psu_dev_impersonated_persona');
    } catch {
      // ignore storage failure
    }
    toast.info('Exited persona impersonation mode. Restored authenticated session.');
  };

  const openLoginModal = () => setIsLoginModalOpen(true);
  const closeLoginModal = () => setIsLoginModalOpen(false);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
      } else if (data) {
        const userRole = data.role as UserRole;
        const status = (data.account_status as AccountStatus) || 'active';

        if (status === 'soft_deleted') {
          toast.error('This account has been archived by an administrator.');
          await supabase.auth.signOut();
          setRole(null);
          setIsVerified(false);
          setAccountStatus('active');
          setProfile(null);
          return;
        }

        setRole(userRole);
        setIsVerified(!!data.is_verified);
        setAccountStatus(status);

        // Fetch college name if college_id exists
        let collegeName: string | null = null;
        if (data.college_id) {
          const { data: colData } = await supabase
            .from('colleges')
            .select('college_name')
            .eq('id', data.college_id)
            .maybeSingle();
          if (colData) collegeName = colData.college_name;
        }

        setProfile({
          full_name: data.full_name,
          role: userRole,
          is_facilitator: Boolean(data.is_facilitator),
          college_id: data.college_id,
          college_name: collegeName,
          cluster_id: data.cluster_id || null,
          account_status: status,
          faculty_id_url: data.faculty_id_url || null,
          student_number: data.student_number || null,
          employee_id: data.employee_id || null,
          department: data.department || null,
          campus: data.campus || 'PSU Main Campus (Puerto Princesa)',
          program: data.program || null,
          year_level: data.year_level || null,
          age: data.age ?? null,
          preferred_sports: Array.isArray(data.preferred_sports) ? data.preferred_sports : [],
          primary_position: data.primary_position || null,
        });
      }
    } catch (err) {
      console.error('Unexpected error fetching user profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setIsLoading(true);
        fetchUserProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setIsLoading(true);
          fetchUserProfile(session.user.id);
        } else {
          setRole(null);
          setIsVerified(false);
          setAccountStatus('active');
          setProfile(null);
          setIsLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const refetchProfile = async () => {
    if (user?.id) {
      await fetchUserProfile(user.id);
    }
  };

  const signOut = async () => {
    if (impersonatedPersona) {
      clearImpersonation();
    }
    await supabase.auth.signOut();
  };

  // Compute effective user, role, verification status, and profile based on impersonation state
  const effectiveUser: User | null = impersonatedPersona
    ? ({
        id: impersonatedPersona.id,
        email: impersonatedPersona.email,
        aud: 'authenticated',
        role: 'authenticated',
        app_metadata: { provider: 'email' },
        user_metadata: { full_name: impersonatedPersona.full_name },
        created_at: new Date().toISOString(),
      } as unknown as User)
    : user;

  const effectiveRole: UserRole | null = impersonatedPersona ? impersonatedPersona.role : role;
  const effectiveIsVerified: boolean = impersonatedPersona ? impersonatedPersona.is_verified : isVerified;
  const effectiveAccountStatus: AccountStatus = (impersonatedPersona?.account_status as AccountStatus) || (impersonatedPersona ? 'active' : accountStatus);

  const effectiveProfile: AuthContextType['profile'] = impersonatedPersona
    ? {
        full_name: impersonatedPersona.full_name,
        role: impersonatedPersona.role,
        is_facilitator: Boolean(impersonatedPersona.is_facilitator || impersonatedPersona.role === 'facilitator'),
        college_id: impersonatedPersona.college_id || null,
        college_name: impersonatedPersona.college_name || null,
        cluster_id: impersonatedPersona.cluster_id || null,
        account_status: effectiveAccountStatus,
        faculty_id_url: null,
        student_number: impersonatedPersona.student_number || null,
        employee_id: impersonatedPersona.employee_id || null,
        department: impersonatedPersona.department || null,
        program: impersonatedPersona.program || null,
        year_level: impersonatedPersona.year_level || null,
        age: 21,
        preferred_sports: impersonatedPersona.preferred_sports || [],
        primary_position: impersonatedPersona.primary_position || null,
      }
    : profile;

  // Derived role permission flags computed from effective role and dual-role flags
  const isImpersonating = Boolean(impersonatedPersona);
  const isDev = effectiveRole === 'dev';
  const isAdmin = effectiveRole === 'admin' || effectiveRole === 'super_admin' || effectiveRole === 'dev';
  const isSuperAdmin = isAdmin;
  const isFacilitator = Boolean(effectiveProfile?.is_facilitator) || effectiveRole === 'facilitator' || isAdmin;
  const isOfficial = Boolean(effectiveProfile?.is_facilitator) || effectiveRole === 'official' || isAdmin;
  const isCoach = effectiveRole === 'coach';
  const isPlayer = effectiveRole === 'player_student' || effectiveRole === 'player_faculty' || effectiveRole === 'player_staff';
  const isFacultyAthlete = effectiveRole === 'player_faculty';
  const isStaffAthlete = effectiveRole === 'player_staff';
  const isStudentAthlete = effectiveRole === 'player_student';
  const canAccessFriendlyGames = Boolean(
    isFacultyAthlete ||
    isStaffAthlete ||
    isAdmin ||
    isFacilitator
  );

  return (
    <AuthContext.Provider value={{
      user: effectiveUser,
      session,
      role: effectiveRole,
      isVerified: effectiveIsVerified,
      isLoading,
      isDev,
      isAdmin,
      isSuperAdmin,
      isFacilitator,
      isOfficial,
      isCoach,
      isPlayer,
      isFacultyAthlete,
      isStaffAthlete,
      isStudentAthlete,
      canAccessFriendlyGames,
      accountStatus: effectiveAccountStatus,
      profile: effectiveProfile,
      impersonatedPersona,
      impersonatePersona,
      clearImpersonation,
      isImpersonating,
      isLoginModalOpen,
      openLoginModal,
      closeLoginModal,
      signOut,
      refetchProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
