import { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  Trophy,
  LogOut,
  LogIn,
  Menu,
  X,
  ShieldCheck,
  UserCheck,
  Globe,
  ClipboardList,
  Medal,
  Activity
} from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { LoginModal } from '@/components/auth/LoginModal';
import { toast } from 'sonner';

export const AppLayout = () => {
  const { user, role, isSuperAdmin, isFacilitator, isCoach, isPlayer, signOut, openLoginModal } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showSignOutPrompt, setShowSignOutPrompt] = useState(false);

  const formatRole = (r: string | null) => {
    if (!r) return 'Spectator';
    if (r === 'super_admin' || r === 'Admin') return 'Super Admin';
    if (r === 'facilitator') return 'Facilitator';
    if (r === 'coach' || r === 'Coach') return 'Coach';
    if (r === 'player_student' || r === 'Player') return 'Student';
    if (r === 'player_faculty' || r === 'faculty' || r === 'Faculty') return 'Faculty';
    return r;
  };

  const getDashboardHref = () => {
    if (!user) return '/';
    if (isSuperAdmin) return '/admin';
    if (isCoach) return '/coach';
    if (isPlayer) return '/player';
    return '/explorer';
  };

  const navigation = [
    {
      name: 'Dashboard',
      href: getDashboardHref(),
      icon: LayoutDashboard
    },
    {
      name: 'Match Center',
      href: '/explorer',
      icon: Globe
    },
    {
      name: 'Ranking',
      href: '/ranking',
      icon: Medal
    },
    ...(isSuperAdmin ? [
      { name: 'Tournaments', href: '/admin/tournaments', icon: Trophy },
      { name: 'System Verifications', href: '/admin/verifications', icon: ShieldCheck },
      { name: 'System Audit', href: '/admin/audit-logs', icon: ClipboardList },
    ] : []),
    ...(isFacilitator && !isSuperAdmin ? [
      { name: 'Live Scorer', href: '/explorer', icon: Activity },
    ] : []),
    ...(isCoach ? [
      { name: 'My Teams', href: '/coach/teams', icon: UserCheck },
    ] : []),
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
    toast.success('Signed out successfully. You are now viewing public mode.');
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white sticky top-0 h-screen shadow-xl border-r border-white/5">
        <div className="p-6">
          <Link to="/" className="flex items-center gap-2 font-black text-2xl tracking-tighter">
            <span className="text-orange-500 italic">PSU</span>
            <span className="text-white">SportsTrack</span>
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <div className="h-[2px] w-8 bg-orange-500" />
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black">Official Hub</p>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto scrollbar-hide">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-150 active:scale-[0.99] group ${isActive(item.href)
                ? 'bg-orange-500/10 text-orange-400 font-semibold shadow-[inset_3px_0_0_0_#f97316]'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <item.icon className={`size-4.5 transition-transform duration-150 ${isActive(item.href) ? 'scale-105' : 'group-hover:scale-105'}`} />
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5 bg-black/20">
          {user ? (
            <>
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="w-full flex items-center gap-3 p-2 mb-2 rounded-xl bg-white/5 hover:bg-orange-500/10 border border-white/5 hover:border-orange-500/30 transition-all duration-150 active:scale-[0.98] text-left group cursor-pointer"
                title="Open Profile Page"
              >
                <div className="size-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-orange-500/20 group-hover:scale-105 transition-transform shrink-0">
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate text-slate-200 group-hover:text-white transition-colors">{user?.email?.split('@')[0]}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-orange-500/90 uppercase font-black tracking-widest">{formatRole(role)}</p>
                    <span className="text-[9px] font-bold text-slate-400 group-hover:text-orange-400 transition-colors">Profile →</span>
                  </div>
                </div>
              </button>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-slate-400 hover:text-orange-400 hover:bg-orange-500/5 transition-colors font-bold rounded-xl"
                onClick={() => setShowSignOutPrompt(true)}
              >
                <LogOut className="size-5" />
                Sign Out
              </Button>
            </>
          ) : (
            <Button
              className="w-full justify-center gap-3 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic tracking-wider h-12 rounded-xl transition-all shadow-lg shadow-orange-500/20"
              onClick={openLoginModal}
            >
              <LogIn className="size-5" />
              Log In
            </Button>
          )}
        </div>
      </aside>

      {/* Layout Content Wrapper */}
      <div className="flex-1 min-w-0 flex flex-col relative">
        {/* Mobile Topbar */}
        <header className="md:hidden sticky top-0 flex h-16 items-center justify-between bg-slate-900 text-white px-4 shadow-lg z-30 border-b border-white/5">
          <Link to="/" className="flex items-center gap-2 font-black text-xl">
            <span className="text-orange-500 italic">PSU</span>
            <span className="text-white">SportsTrack</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-slate-300 hover:text-white hover:bg-white/10"
            >
              {isMobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
            </Button>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden animate-in fade-in duration-300">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="fixed inset-y-0 right-0 w-72 bg-slate-900 text-white shadow-2xl animate-in slide-in-from-right duration-500 border-l border-white/5 flex flex-col">
              <div className="p-8 flex justify-between items-center border-b border-white/5">
                <div className="font-black text-xl italic tracking-tighter">
                  <span className="text-orange-500">NAV</span>IGATION
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="rounded-full hover:bg-white/10"
                >
                  <X className="size-6" />
                </Button>
              </div>

              <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-4 px-6 py-4 rounded-2xl text-base font-bold transition-all duration-300 ${isActive(item.href)
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30 translate-x-2'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                  >
                    <item.icon className="size-6" />
                    {item.name}
                  </Link>
                ))}
              </nav>

              <div className="p-6 bg-black/20 border-t border-white/5 space-y-3">
                {user ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        navigate('/profile');
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-orange-500/10 border border-white/5 transition-all duration-150 active:scale-[0.98] text-left group cursor-pointer"
                    >
                      <div className="size-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-black text-sm shrink-0">
                        {user?.email?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate text-slate-200">{user?.email?.split('@')[0]}</p>
                        <p className="text-[10px] text-orange-500 uppercase font-black tracking-widest">{formatRole(role)} • View Profile →</p>
                      </div>
                    </button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-4 text-slate-400 h-12 px-4 hover:text-orange-500 font-bold text-base"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        setShowSignOutPrompt(true);
                      }}
                    >
                      <LogOut className="size-6" />
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <Button
                    className="w-full justify-center gap-3 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic tracking-wider h-14 rounded-2xl transition-all shadow-lg shadow-orange-500/20 text-base"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      openLoginModal();
                    }}
                  >
                    <LogIn className="size-6" />
                    Log In
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Routed Content Area */}
        <main className="flex-1 px-4 py-8 md:px-10 md:py-10 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>

      {/* Global Sign Out Confirmation Dialog */}
      <Dialog open={showSignOutPrompt} onOpenChange={setShowSignOutPrompt}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl p-6">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-2xl font-black uppercase italic tracking-tight text-slate-900">
              Confirm Sign Out
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-sm font-medium">
              Are you sure you want to end your active session? You will be switched to public viewer mode.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
            <Button
              variant="outline"
              className="w-full sm:w-1/2 rounded-xl font-bold h-11"
              onClick={() => setShowSignOutPrompt(false)}
            >
              Cancel
            </Button>
            <Button
              className="w-full sm:w-1/2 bg-orange-500 hover:bg-orange-600 text-white font-bold h-11 rounded-xl shadow-lg shadow-orange-500/20"
              onClick={async () => {
                setShowSignOutPrompt(false);
                await handleSignOut();
              }}
            >
              Sign Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Global Login Dialog Component */}
      <LoginModal />
    </div>
  );
};
