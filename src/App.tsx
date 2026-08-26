import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Toaster } from '@/components/ui/sonner';

import { Register } from '@/pages/Register';
import { PlayerDashboard } from '@/pages/PlayerDashboard';
import { AdminDashboard } from '@/pages/AdminDashboard';
import { SystemVerifications } from '@/pages/SystemVerifications';
import { AdminAuditLogs } from '@/pages/AdminAuditLogs';
import { CoachDashboard } from '@/pages/CoachDashboard';
import { TeamManagement } from '@/pages/TeamManagement';
import { TournamentManagement } from '@/pages/TournamentManagement';
import { LiveMatch } from '@/pages/LiveMatch';
import { Profile } from '@/pages/Profile';
import { TournamentExplorer } from '@/pages/TournamentExplorer';
import { Ranking } from '@/pages/Ranking';
import { AppLayout } from '@/components/AppLayout';
import { NotFound } from '@/pages/NotFound';
import { AuthConfirm } from '@/pages/AuthConfirm';
import { ResetPassword } from '@/pages/ResetPassword';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';

function AppRoutes() {
  // This hook handles legacy route redirects
  useAuthRedirect();

  return (
    <Routes>
      {/* Public Standalone Auth Routes */}
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/register" element={<Register />} />
      <Route path="/auth/confirm" element={<AuthConfirm />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      
      {/* App Shell Layout */}
      <Route element={<AppLayout />}>
        {/* Public Views Accessible to Everyone */}
        <Route path="/" element={<PlayerDashboard />} />
        <Route path="/explorer" element={<TournamentExplorer />} />
        <Route path="/ranking" element={<Ranking />} />
        <Route path="/match/:matchId" element={<LiveMatch />} />
        
        {/* Protected Routes Requiring Authentication */}
        <Route element={<ProtectedRoute />}>
          <Route path="/profile" element={<Profile />} />
          <Route path="/achievements" element={<Navigate to="/profile" replace />} />
          
          {/* Role-Specific Routes */}
          <Route element={<ProtectedRoute requiredRole="Admin" />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/tournaments" element={<TournamentManagement />} />
            <Route path="/admin/verifications" element={<SystemVerifications />} />
            <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
          </Route>
          
          <Route element={<ProtectedRoute requiredRole="Coach" />}>
            <Route path="/coach" element={<CoachDashboard />} />
            <Route path="/coach/teams" element={<TeamManagement />} />
          </Route>
          
          <Route element={<ProtectedRoute requiredRole="Player" />}>
            <Route path="/player" element={<PlayerDashboard />} />
          </Route>
        </Route>
      </Route>

      {/* 404 Catch-All Route (Must be last) */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
      <Toaster />
    </AuthProvider>
  );
}

export default App;

