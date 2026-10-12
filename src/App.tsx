import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeProvider';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Toaster } from '@/components/ui/sonner';
import { AppLayout } from '@/components/AppLayout';

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

import { useAuthRedirect } from '@/hooks/useAuthRedirect';

const PageLoader = () => (
  <div className="flex py-28 items-center justify-center w-full">
    <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
      <div className="size-12 rounded-full border-3 border-orange-500/20 border-t-orange-500 animate-spin" />
      <span className="text-slate-400 font-bold uppercase tracking-[0.25em] text-[10px]">Loading...</span>
    </div>
  </div>
);

function AppRoutes() {
  // This hook handles legacy route redirects
  useAuthRedirect();

  return (
    <Suspense fallback={<PageLoader />}>
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

          {/* Protected Routes Requiring Authentication */}
          <Route element={<ProtectedRoute />}>
            <Route path="/profile" element={<Profile />} />
            <Route path="/achievements" element={<Navigate to="/profile" replace />} />

            {/* Super Admin Protected Routes */}
            <Route element={<ProtectedRoute requiredRole="super_admin" />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/tournaments" element={<TournamentManagement />} />
              <Route path="/admin/verifications" element={<SystemVerifications />} />
              <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
              <Route path="/admin/recovery" element={<AdminRecovery />} />
            </Route>

            {/* Platform Developer Isolated Protected Route */}
            <Route element={<ProtectedRoute requiredRole="dev" />}>
              <Route path="/dev" element={<DevSandbox />} />
            </Route>

            <Route element={<ProtectedRoute requiredRole="coach" />}>
              <Route path="/coach" element={<CoachDashboard />} />
              <Route path="/coach/teams" element={<TeamManagement />} />
            </Route>

            <Route element={<ProtectedRoute requiredRole={['player_student', 'player_faculty']} />}>
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

