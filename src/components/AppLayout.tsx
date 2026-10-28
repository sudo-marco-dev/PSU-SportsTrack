import { useState, lazy, Suspense } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ErrorBoundary } from './ui/ErrorBoundary';
const LoginModal = lazy(() =>
  import('@/components/auth/LoginModal').then((m) => ({ default: m.LoginModal }))
);
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
  Activity,
  Info,
  RotateCcw,
  Terminal,
  Search,
  FileText
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ThemeToggle } from './ui/ThemeToggle';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { toast } from 'sonner';

export const AppLayout = () => {
  const { user, role, isDev, isAdmin, isFacilitator, isCoach, isPlayer, isImpersonating, impersonatedPersona, clearImpersonation, signOut, openLoginModal } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showSignOutPrompt, setShowSignOutPrompt] = useState(false);

  const formatRole = (r: string | null) => {
    if (!r) return 'Spectator';
    if (r === 'dev') return 'Developer';
    if (r === 'admin' || r === 'super_admin') return 'Admin';
    if (r === 'facilitator') return 'Facilitator';
    if (r === 'coach') return 'Coach';
    if (r === 'player_student') return 'Student Athlete';
    if (r === 'player_faculty') return 'Faculty Athlete';
    if (r === 'player_staff') return 'Staff Athlete';
    if (r === 'official') return 'Match Official';
    return r;
  };

  const getDashboardHref = () => {
    if (!user) return '/';
    if (isDev) return '/dev';
    if (isAdmin) return '/admin';
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
    {
      name: 'Athletics Hub',
      href: '/athletics',
      icon: Search
    },
    ...(isDev || Boolean(import.meta.env.DEV) || isImpersonating ? [
      { name: 'Dev Sandbox', href: '/dev', icon: Terminal },
    ] : []),
    ...(isAdmin ? [
      { name: 'Tournaments', href: '/admin/tournaments', icon: Trophy },
      { name: 'System Verifications', href: '/admin/verifications', icon: ShieldCheck },
      { name: 'System Audit', href: '/admin/audit-logs', icon: ClipboardList },
      { name: 'Recovery Center', href: '/admin/recovery', icon: RotateCcw },
    ] : []),
    ...(isFacilitator && !isAdmin ? [
      { name: 'Live Scorer', href: '/explorer', icon: Activity },
    ] : []),
    ...(isCoach ? [
      { name: 'My Teams', href: '/coach/teams', icon: UserCheck },
    ] : []),
    {
      name: 'About SportsTrack',
      href: '/about',
      icon: Info
    },
    {
      name: 'Legal & Privacy',
      href: '/legal',
      icon: FileText
    },
  ];

  const isActive = (path: string) => location.pathname === path;

  // Secondary management routes that make "More" tab show active state
  const isMoreRouteActive = ['/about', '/legal', '/privacy', '/terms', '/athletics', '/scouting'].includes(location.pathname) || (isDev
    ? ['/dev'].includes(location.pathname)
    : isAdmin
    ? ['/admin/tournaments', '/admin/verifications', '/admin/audit-logs', '/admin/recovery'].includes(location.pathname)
    : isCoach
    ? ['/coach/teams'].includes(location.pathname)
    : false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
    toast.success('Signed out successfully. You are now viewing public mode.');
  };

  return (
    <div className="min-h-dvh w-full max-w-[100vw] overflow-x-hidden bg-slate-50 dark:bg-background transition-colors duration-200">
      {/* Desktop Sidebar — Permanently anchored to viewport left, eliminating floating detachment on scroll */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900 text-white fixed top-0 bottom-0 left-0 h-dvh shadow-xl border-r border-white/5 z-30">
        <div className="p-6">
          <Link to={getDashboardHref()} className="flex items-center gap-2 font-black text-2xl tracking-tighter">
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

        <div className="px-4 py-2 border-t border-white/5">
          <ThemeToggle className="w-full justify-start gap-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl h-9" />
        </div>

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
                  <p className="text-[10px] text-orange-500/90 uppercase font-black tracking-widest">{formatRole(role)}</p>
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

      {/* Layout Content Wrapper — lg:pl-64 accommodates the fixed desktop sidebar */}
      <div className="flex-1 min-w-0 w-full max-w-full flex flex-col relative lg:pl-64">
        {/* Mobile Topbar */}
        <header className="lg:hidden sticky top-0 flex h-12 xs:h-14 sm:h-16 short:h-12 items-center justify-between bg-slate-900 text-white px-3.5 sm:px-6 shadow-lg z-30 border-b border-white/10">
          <Link to={getDashboardHref()} className="flex items-center gap-2 font-black text-lg xs:text-xl">
            <span className="text-orange-500 italic">PSU</span>
            <span className="text-white">SportsTrack</span>
          </Link>
        </header>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-[70] lg:hidden animate-in fade-in duration-300">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="fixed inset-y-0 right-0 w-72 bg-slate-900 text-white shadow-2xl animate-in slide-in-from-right duration-500 border-l border-white/5 flex flex-col overscroll-contain">
              <div className="p-8 flex justify-between items-center border-b border-white/5">
                <div className="font-black text-xl italic tracking-tighter">
                  <span className="text-orange-500">NAV</span>IGATION
                </div>
                <div className="flex items-center gap-1">
                  <ThemeToggle className="text-slate-400 hover:text-white hover:bg-white/10 rounded-full" />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="rounded-full hover:bg-white/10"
                  >
                    <X className="size-6" />
                  </Button>
                </div>
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
                        <p className="text-[10px] text-orange-500 uppercase font-black tracking-widest">{formatRole(role)}</p>
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

        {/* Active Impersonation Strip (Dev Mode Persona Switcher) */}
        {isImpersonating && impersonatedPersona && (
          <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-purple-500/15 border-b border-orange-500/30 px-3.5 sm:px-6 py-2 backdrop-blur-md sticky top-12 xs:top-14 sm:top-16 short:top-12 lg:top-0 z-20 flex flex-wrap items-center justify-between gap-2 shadow-sm text-xs">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="flex items-center gap-1.5 font-black uppercase text-[10px] tracking-widest text-orange-600 dark:text-orange-400 shrink-0">
                <span className="size-2 rounded-full bg-orange-500 animate-ping inline-block" />
                Impersonating:
              </span>
              <span className="font-bold text-slate-900 dark:text-white truncate">
                {impersonatedPersona.full_name}
              </span>
              <Badge className={`text-[9px] uppercase font-black px-1.5 py-0.2 border ${impersonatedPersona.badge_color || 'bg-orange-500/10 text-orange-600 border-orange-500/30'}`}>
                {impersonatedPersona.persona_label || formatRole(role)}
              </Badge>
              {impersonatedPersona.college_name && (
                <span className="hidden sm:inline text-slate-500 dark:text-slate-400 text-[11px] truncate max-w-xs">
                  • {impersonatedPersona.college_name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(getDashboardHref())}
                className="h-7 text-[10px] font-bold uppercase rounded-lg border-orange-500/40 text-orange-600 dark:text-orange-300 hover:bg-orange-500/10 cursor-pointer px-2"
              >
                Role View
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/dev')}
                className="h-7 text-[10px] font-bold uppercase rounded-lg border-slate-300 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:bg-white/10 cursor-pointer px-2"
              >
                Dev Deck
              </Button>
              <Button
                size="sm"
                onClick={clearImpersonation}
                className="h-7 text-[10px] font-black uppercase rounded-lg bg-rose-500 hover:bg-rose-600 text-white cursor-pointer px-2.5 shadow-sm"
              >
                Exit
              </Button>
            </div>
          </div>
        )}

        {/* Main Routed Content Area */}
        <main className="flex-1 min-w-0 px-3 xs:px-3.5 sm:px-6 md:px-8 py-4 sm:py-6 md:py-8 lg:px-10 lg:py-10 pb-20 sm:pb-24 lg:pb-10 max-w-7xl mx-auto w-full overflow-x-hidden">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>

        {/* Mobile Bottom Navigation Rail — Hidden on /legal which renders its own dedicated sticky bottom bar */}
        {location.pathname !== '/legal' && (
        <nav
          aria-label="Mobile Navigation"
          className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-slate-900/95 backdrop-blur-md border-t border-white/15 pb-safe w-full max-w-[100vw] overflow-hidden shadow-2xl [isolation:isolate]"
        >
          <div className="flex items-center justify-around h-13 xs:h-14 sm:h-16 short:h-12 max-w-2xl mx-auto w-full px-0.5 sm:px-4">
            {/* 1. Home / Mission Command */}
            <Link
              to={getDashboardHref()}
              aria-current={
                isActive(getDashboardHref()) || (getDashboardHref() === '/admin' && location.pathname === '/')
                  ? 'page'
                  : undefined
              }
              className={`flex-1 min-w-0 w-0 h-full flex flex-col items-center justify-center py-1 text-center transition-all duration-150 active:scale-90 relative ${
                isActive(getDashboardHref()) || (getDashboardHref() === '/admin' && location.pathname === '/')
                  ? 'text-orange-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <div className="relative">
                <LayoutDashboard className="size-5" />
                {(isActive(getDashboardHref()) || (getDashboardHref() === '/admin' && location.pathname === '/')) && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 size-1 bg-orange-500 rounded-full shadow-[0_0_8px_#f97316]" />
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight leading-none truncate w-full px-0.5">
                Home
              </span>
            </Link>

            {/* 2. Matches / Live Courtside */}
            <Link
              to="/explorer"
              aria-current={isActive('/explorer') || location.pathname.startsWith('/match/') ? 'page' : undefined}
              className={`flex-1 min-w-0 w-0 h-full flex flex-col items-center justify-center py-1 text-center transition-all duration-150 active:scale-90 relative ${
                isActive('/explorer') || location.pathname.startsWith('/match/')
                  ? 'text-orange-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <div className="relative">
                <Globe className="size-5" />
                {(isActive('/explorer') || location.pathname.startsWith('/match/')) && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 size-1 bg-orange-500 rounded-full shadow-[0_0_8px_#f97316]" />
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight leading-none truncate w-full px-0.5">
                Matches
              </span>
            </Link>

            {/* 3. Rankings / Standings */}
            <Link
              to="/ranking"
              aria-current={isActive('/ranking') ? 'page' : undefined}
              className={`flex-1 min-w-0 w-0 h-full flex flex-col items-center justify-center py-1 text-center transition-all duration-150 active:scale-90 relative ${
                isActive('/ranking')
                  ? 'text-orange-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <div className="relative">
                <Medal className="size-5" />
                {isActive('/ranking') && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 size-1 bg-orange-500 rounded-full shadow-[0_0_8px_#f97316]" />
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight leading-none truncate w-full px-0.5">
                Rankings
              </span>
            </Link>

            {/* 4. Profile / Authentication — Guaranteed Zero Right-Overflow */}
            {user ? (
              <Link
                to="/profile"
                aria-current={isActive('/profile') ? 'page' : undefined}
                className={`flex-1 min-w-0 w-0 h-full flex flex-col items-center justify-center py-1 text-center transition-all duration-150 active:scale-90 relative ${
                  isActive('/profile') ? 'text-orange-400 font-bold' : 'text-slate-400 hover:text-slate-200 font-medium'
                }`}
              >
                <div className="relative">
                  <div
                    className={`size-5 rounded-full flex items-center justify-center text-[10px] font-black text-white ${
                      isActive('/profile') ? 'bg-orange-500 ring-2 ring-orange-400/50' : 'bg-slate-700'
                    }`}
                  >
                    {user?.email?.charAt(0).toUpperCase()}
                  </div>
                  {isActive('/profile') && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 size-1 bg-orange-500 rounded-full shadow-[0_0_8px_#f97316]" />
                  )}
                </div>
                <span className="text-[10px] mt-1 tracking-tight leading-none truncate w-full px-0.5">
                  Profile
                </span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={openLoginModal}
                aria-label="Log in to your account"
                className="flex-1 min-w-0 w-0 h-full flex flex-col items-center justify-center py-1 text-center transition-all duration-150 active:scale-90 text-slate-400 hover:text-orange-400 cursor-pointer"
              >
                <LogIn className="size-5" />
                <span className="text-[10px] mt-1 tracking-tight leading-none truncate w-full px-0.5">
                  Log In
                </span>
              </button>
            )}

            {/* 5. More / Role Management Hub */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={isMobileMenuOpen}
              className={`flex-1 min-w-0 w-0 h-full flex flex-col items-center justify-center py-1 text-center transition-all duration-150 active:scale-90 cursor-pointer relative ${
                isMoreRouteActive || isMobileMenuOpen ? 'text-orange-400 font-bold' : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <div className="relative">
                <Menu className="size-5" />
                {(isMoreRouteActive || isMobileMenuOpen) && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 size-1 bg-orange-500 rounded-full shadow-[0_0_8px_#f97316]" />
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight leading-none truncate w-full px-0.5">
                More
              </span>
            </button>
          </div>
        </nav>
        )}
      </div>

      {/* Global Sign Out Confirmation Dialog */}
      <Dialog open={showSignOutPrompt} onOpenChange={setShowSignOutPrompt}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl p-6">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-2xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white">
              Confirm Sign Out
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400 text-sm font-medium">
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
      <Suspense fallback={null}>
        <LoginModal />
      </Suspense>
    </div>
  );
};
