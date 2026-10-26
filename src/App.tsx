import React, { Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeProvider';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Toaster } from '@/components/ui/sonner';
import { AppLayout } from '@/components/AppLayout';
import { supabase } from '@/lib/supabase';

// Lazy-loaded page routes — split into separate chunks for faster initial load
const Register = React.lazy(() => import('@/pages/Register').then(m => ({ default: m.Register })));
const PlayerDashboard = React.lazy(() => import('@/pages/PlayerDashboard').then(m => ({ default: m.PlayerDashboard })));
const AdminDashboard = React.lazy(() => import('@/pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const SystemVerifications = React.lazy(() => import('@/pages/SystemVerifications').then(m => ({ default: m.SystemVerifications })));
const AdminAuditLogs = React.lazy(() => import('@/pages/AdminAuditLogs').then(m => ({ default: m.AdminAuditLogs })));
const CoachDashboard = React.lazy(() => import('@/pages/CoachDashboard').then(m => ({ default: m.CoachDashboard })));
const TeamManagement = React.lazy(() => import('@/pages/TeamManagement').then(m => ({ default: m.TeamManagement })));
const TournamentManagement = React.lazy(() => import('@/pages/TournamentManagement').then(m => ({ default: m.TournamentManagement })));
const LiveMatch = React.lazy(() => import('@/pages/LiveMatch').then(m => ({ default: m.LiveMatch })));
const Profile = React.lazy(() => import('@/pages/Profile').then(m => ({ default: m.Profile })));
const TournamentExplorer = React.lazy(() => import('@/pages/TournamentExplorer').then(m => ({ default: m.TournamentExplorer })));
const Ranking = React.lazy(() => import('@/pages/Ranking').then(m => ({ default: m.Ranking })));
const About = React.lazy(() => import('@/pages/About').then(m => ({ default: m.About })));
const NotFound = React.lazy(() => import('@/pages/NotFound').then(m => ({ default: m.NotFound })));
const AuthConfirm = React.lazy(() => import('@/pages/AuthConfirm').then(m => ({ default: m.AuthConfirm })));
const ResetPassword = React.lazy(() => import('@/pages/ResetPassword').then(m => ({ default: m.ResetPassword })));
const AdminRecovery = React.lazy(() => import('@/pages/AdminRecovery').then(m => ({ default: m.AdminRecovery })));
const StadiumDisplay = React.lazy(() => import('@/pages/StadiumDisplay').then(m => ({ default: m.StadiumDisplay })));
const FacilitatorKiosk = React.lazy(() => import('@/pages/FacilitatorKiosk').then(m => ({ default: m.FacilitatorKiosk })));
const DevSandbox = React.lazy(() => import('@/pages/DevSandbox').then(m => ({ default: m.DevSandbox })));
const ScoutingHub = React.lazy(() => import('@/pages/ScoutingHub').then(m => ({ default: m.ScoutingHub })));

import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { PageSkeleton } from '@/components/ui/PageSkeleton';

function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();
  const { openLoginModal } = useAuth();

  // This hook handles legacy route redirects
  useAuthRedirect();

  useEffect(() => {
    // 1. Automatically open login modal if redirected with ?login=true
    if (location.search.includes('login=true')) {
      openLoginModal();
    }

    // 2. Intercept password recovery flows arriving with hash or query parameters on other routes
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const isRecoveryFlow = hash.includes('type=recovery') || search.includes('type=recovery');

    if (isRecoveryFlow && location.pathname !== '/reset-password' && location.pathname !== '/auth/confirm') {
      navigate('/reset-password' + hash, { replace: true });
      return;
    }

    // 3. Global listener for Supabase PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        if (location.pathname !== '/reset-password') {
          navigate('/reset-password', { replace: true });
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [location.pathname, location.search, navigate, openLoginModal]);

  return (
    <Suspense fallback={<PageSkeleton variant="page" />}>
      <Routes>
        {/* Public Standalone Auth Routes */}
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/register" element={<Register />} />
        <Route path="/auth/confirm" element={<AuthConfirm />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Dedicated Stadium Jumbotron Edge-to-Edge Display */}
        <Route path="/match/:matchId/display" element={<StadiumDisplay />} />

        {/* Dedicated Courtside Facilitator Kiosk Scoring Deck */}
        <Route path="/match/:matchId/kiosk" element={<FacilitatorKiosk />} />

        {/* App Shell Layout */}
        <Route element={<AppLayout />}>
          {/* Public Views Accessible to Everyone */}
          <Route path="/" element={<PlayerDashboard />} />
          <Route path="/explorer" element={<TournamentExplorer />} />
          <Route path="/ranking" element={<Ranking />} />
          <Route path="/about" element={<About />} />
          <Route path="/match/:matchId" element={<LiveMatch />} />

          {/* Platform Developer Sandbox */}
          <Route element={<ProtectedRoute requiredRole="dev" />}>
            <Route path="/dev" element={<DevSandbox />} />
          </Route>

          {/* Protected Routes Requiring Authentication */}
          <Route element={<ProtectedRoute />}>
            <Route path="/profile" element={<Profile />} />
            <Route path="/scouting" element={<ScoutingHub />} />
            <Route path="/achievements" element={<Navigate to="/profile" replace />} />

            {/* Super Admin Protected Routes */}
            <Route element={<ProtectedRoute requiredRole="super_admin" />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/tournaments" element={<TournamentManagement />} />
              <Route path="/admin/verifications" element={<SystemVerifications />} />
              <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
              <Route path="/admin/recovery" element={<AdminRecovery />} />
            </Route>

            <Route element={<ProtectedRoute requiredRole="coach" />}>
              <Route path="/coach" element={<CoachDashboard />} />
              <Route path="/coach/teams" element={<TeamManagement />} />
            </Route>

            <Route element={<ProtectedRoute requiredRole={['player_student', 'player_faculty', 'player_staff']} />}>
              <Route path="/player" element={<PlayerDashboard />} />
            </Route>
          </Route>
        </Route>

        {/* 404 Catch-All Route (Must be last) */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

