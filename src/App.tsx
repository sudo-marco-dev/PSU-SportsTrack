import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Toaster } from '@/components/ui/sonner';

import { Login } from '@/pages/Login';
import { Register } from '@/pages/Register';
import { PlayerDashboard } from '@/pages/PlayerDashboard';
import { AdminDashboard } from '@/pages/AdminDashboard';
import { CoachDashboard } from '@/pages/CoachDashboard';
import { TournamentManagement } from '@/pages/TournamentManagement';
import { LiveMatch } from '@/pages/LiveMatch';
import { Navbar } from '@/components/layout/Navbar';

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

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-background">
          <Navbar />
          <main className="container mx-auto py-6 px-4">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              {/* Protected Routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<RootRedirect />} />
                
                {/* Role-Specific Routes */}
                <Route element={<ProtectedRoute requiredRole="Admin" />}>
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/admin/tournaments" element={<TournamentManagement />} />
                </Route>
                
                <Route element={<ProtectedRoute requiredRole="Coach" />}>
                  <Route path="/coach" element={<CoachDashboard />} />
                </Route>
                
                <Route element={<ProtectedRoute requiredRole="Player" />}>
                  <Route path="/player" element={<PlayerDashboard />} />
                </Route>
                <Route path="/match/:matchId" element={<LiveMatch />} />
              </Route>
            </Routes>
          </main>
        </div>
      </BrowserRouter>
      <Toaster />
    </AuthProvider>
  );
}

export default App;
