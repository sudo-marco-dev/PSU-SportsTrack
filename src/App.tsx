import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Toaster } from '@/components/ui/sonner';

import { Login } from '@/pages/Login';
import { Register } from '@/pages/Register';
import { PlayerDashboard } from '@/pages/PlayerDashboard';
import { AdminDashboard } from '@/pages/AdminDashboard';
import { SystemVerifications } from '@/pages/SystemVerifications';
import { AdminAuditLogs } from '@/pages/AdminAuditLogs';
import { CoachDashboard } from '@/pages/CoachDashboard';
import { TeamManagement } from '@/pages/TeamManagement';
import { TournamentManagement } from '@/pages/TournamentManagement';
import { LiveMatch } from '@/pages/LiveMatch';
import { MyAchievements } from '@/pages/MyAchievements';
import { TournamentExplorer } from '@/pages/TournamentExplorer';
import { AppLayout } from '@/components/AppLayout';
import { NotFound } from '@/pages/NotFound';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';

const RootRedirect = () => {
  const { role, isLoading } = useAuth();
  
  if (isLoading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  
  switch (role) {
    case 'Admin': return <Navigate to="/admin" replace />;
    case 'Coach': return <Navigate to="/coach" replace />;
    case 'Player': return <Navigate to="/player" replace />;
    default: return <Navigate to="/login" replace />;
  }
};

function AppRoutes() {
  // This hook handles legacy route redirects
  useAuthRedirect();

  return (
    <Routes>
      {/* Public Standalone Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      
      {/* Protected Routes inside App Shell */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<RootRedirect />} />
          
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
            <Route path="/achievements" element={<MyAchievements />} />
          </Route>
          <Route path="/match/:matchId" element={<LiveMatch />} />
          <Route path="/explorer" element={<TournamentExplorer />} />
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
