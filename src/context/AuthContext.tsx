import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type UserRole = 'Admin' | 'Coach' | 'Player';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  isVerified: boolean;
  isLoading: boolean;
  profile: {
    full_name: string | null;
    role: UserRole | null;
    college_id?: string | null;
    college_name?: string | null;
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
  profile: null,
  isLoginModalOpen: false,
  openLoginModal: () => {},
  closeLoginModal: () => {},
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<AuthContextType['profile']>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const openLoginModal = () => setIsLoginModalOpen(true);
  const closeLoginModal = () => setIsLoginModalOpen(false);

  useEffect(() => {
    // Fetch initial session
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

    // Listen for auth changes
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
          setProfile(null);
          setIsLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role, is_verified, full_name, college_id, colleges(college_name)')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
      } else if (data) {
        setRole(data.role as UserRole);
        setIsVerified(data.is_verified);
        // Handle joined colleges array or single object from Supabase
        const collegeData = Array.isArray(data.colleges) ? data.colleges[0] : data.colleges;
        setProfile({
          full_name: data.full_name,
          role: data.role as UserRole,
          college_id: data.college_id,
          college_name: collegeData?.college_name || null,
        });
      }
    } catch (err) {
      console.error('Unexpected error fetching user profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const refetchProfile = async () => {
    if (user?.id) {
      await fetchUserProfile(user.id);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      role, 
      isVerified, 
      isLoading, 
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

export const useAuth = () => useContext(AuthContext);
