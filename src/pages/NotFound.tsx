import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function NotFound() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, isCoach, isPlayer, isFacilitator } = useAuth();

  useEffect(() => {
    // Log 404 attempts for debugging / analytics
    console.warn(`[404] Attempted access to: ${location.pathname}`);
  }, [location.pathname]);

  const handleSmartRedirect = () => {
    if (!user) {
      // Not authenticated -> redirect to public dashboard
      navigate('/', { replace: true });
    } else if (isAdmin) {
      // Admin -> redirect to admin dashboard
      navigate('/admin', { replace: true });
    } else if (isCoach) {
      // Coach -> redirect to coach dashboard
      navigate('/coach', { replace: true });
    } else if (isPlayer) {
      // Player -> redirect to player dashboard
      navigate('/player', { replace: true });
    } else if (isFacilitator) {
      // Facilitator -> redirect to match center
      navigate('/explorer', { replace: true });
    } else {
      // Default fallback
      navigate('/', { replace: true });
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-950 px-4 relative overflow-hidden">
      <div className="absolute -right-20 -top-20 size-80 bg-orange-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="w-full max-w-md relative z-10">
        {/* Error Container */}
        <div className="bg-slate-900 border border-white/10 rounded-3xl sm:rounded-[2rem] shadow-2xl p-6 sm:p-10 text-center">
          
          {/* Error Eyebrow */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
            Arena Navigation Error
          </div>

          {/* Error Code & Message */}
          <h1 className="text-6xl sm:text-7xl font-black italic tracking-tighter text-orange-500 leading-none mb-1">
            404
          </h1>
          <p className="text-xl font-black uppercase italic tracking-tight text-white mb-2">
            Fixture Not Found
          </p>
          <p className="text-slate-400 text-xs sm:text-sm font-medium leading-relaxed mb-6">
            The tournament page or fixture you are attempting to reach does not exist or has been relocated.
          </p>

          {/* Attempted Route (Debug Info) */}
          <div className="bg-slate-950 rounded-xl p-3 mb-6 text-left border border-white/5">
            <p className="text-[10px] text-slate-500 font-mono break-all uppercase tracking-wider">
              Attempted route: <code className="text-orange-400 font-bold lowercase">{location.pathname}</code>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleSmartRedirect}
              className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic tracking-wider text-xs rounded-xl shadow-lg shadow-orange-500/20 cursor-pointer active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {!user 
                ? 'Sign In to Arena' 
                : isAdmin 
                  ? 'Admin Command Center'
                  : isCoach 
                    ? 'Coach Dashboard'
                    : isPlayer 
                      ? 'Player Hub'
                      : 'Match Center'}
            </button>
            
            <button
              type="button"
              onClick={() => navigate('/', { replace: true })}
              className="w-full h-11 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-bold uppercase text-xs tracking-wider rounded-xl border border-white/5 cursor-pointer active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              Return Home
            </button>

            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-full py-2 text-slate-500 hover:text-slate-300 font-bold text-[11px] uppercase tracking-wider cursor-pointer active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="size-3.5" />
              <span>Go Back to Previous View</span>
            </button>
          </div>

          {/* Help Text */}
          <p className="text-xs text-slate-500 mt-8">
            If you believe this is an error, please contact support.
          </p>
        </div>
      </div>
    </div>
  );
}
