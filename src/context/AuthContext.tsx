import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export type UserRole =
  | 'super_admin'
  | 'facilitator'
  | 'coach'
  | 'player_student'
  | 'player_faculty'
  | 'dev';

export type AccountStatus = 'active' | 'inactive' | 'archived' | 'soft_deleted';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  isVerified: boolean;
  isLoading: boolean;
  isDev: boolean;
  isSuperAdmin: boolean;
  isFacilitator: boolean;
  isCoach: boolean;
  isPlayer: boolean;
  isFacultyAthlete: boolean;
  isStudentAthlete: boolean;
  accountStatus: AccountStatus;
  profile: {
    full_name: string | null;
    role: UserRole | null;
    college_id?: string | null;
    college_name?: string | null;
    cluster_id?: string | null;
    account_status?: AccountStatus;
    faculty_id_url?: string | null;
    student_number?: string | null;
    program?: string | null;
    year_level?: string | null;
    age?: number | null;
    preferred_sports?: string[] | null;
    primary_position?: string | null;
  } | null;
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
  isSuperAdmin: false,
  isFacilitator: false,
  isCoach: false,
  isPlayer: false,
  isFacultyAthlete: false,
  isStudentAthlete: false,
  accountStatus: 'active',
  profile: null,
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
          college_id: data.college_id,
          college_name: collegeName,
          cluster_id: data.cluster_id || null,
          account_status: status,
          faculty_id_url: data.faculty_id_url || null,
          student_number: data.student_number || null,
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
    await supabase.auth.signOut();
  };

  // Derived role permission flags
  const isDev = role === 'dev';
  const isSuperAdmin = role === 'super_admin';
  const isFacilitator = role === 'facilitator' || isSuperAdmin;
  const isCoach = role === 'coach';
  const isPlayer = role === 'player_student' || role === 'player_faculty';
  const isFacultyAthlete = role === 'player_faculty';
  const isStudentAthlete = role === 'player_student';

  return (
    <AuthContext.Provider value={{
      user,
      session,
      role,
      isVerified,
      isLoading,
      isDev,
      isSuperAdmin,
      isFacilitator,
      isCoach,
      isPlayer,
      isFacultyAthlete,
      isStudentAthlete,
      accountStatus,
      profile,
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
