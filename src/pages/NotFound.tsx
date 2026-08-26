import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export function NotFound() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role } = useAuth();

  useEffect(() => {
    // Log 404 attempts for debugging / analytics
    console.warn(`[404] Attempted access to: ${location.pathname}`);
  }, [location.pathname]);

  const handleSmartRedirect = () => {
    if (!user) {
      // Not authenticated → redirect to public dashboard
      navigate('/', { replace: true });
    } else if (role === 'Admin') {
      // Admin → redirect to admin dashboard
      navigate('/admin', { replace: true });
    } else if (role === 'Coach') {
      // Coach → redirect to coach dashboard
      navigate('/coach', { replace: true });
    } else if (role === 'Player') {
      // Player → redirect to player dashboard
      navigate('/player', { replace: true });
    } else {
      // Default fallback
      navigate('/', { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="w-full max-w-md">
        {/* Error Container */}
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          
          {/* Error Icon */}
          <div className="mb-6">
            <div className="inline-block p-4 bg-red-50 rounded-full">
              <svg 
                className="w-12 h-12 text-red-600" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1.5} 
                  d="M12 9v2m0 4v2m0 4v2M12 3a9 9 0 110 18 9 9 0 010-18z" 
                />
              </svg>
            </div>
          </div>

          {/* Error Code & Message */}
          <h1 className="text-5xl font-bold text-slate-900 mb-2">404</h1>
          <p className="text-xl font-semibold text-slate-700 mb-1">Page Not Found</p>
          <p className="text-slate-600 mb-6">
            The page you're looking for doesn't exist or has been moved to a new location.
          </p>

          {/* Attempted Route (Debug Info) */}
          <div className="bg-slate-50 rounded-lg p-4 mb-8 text-left border border-slate-200">
            <p className="text-xs text-slate-600 font-mono break-all">
              <span className="text-slate-500">Attempted route:</span><br />
              <code className="text-red-600">{location.pathname}</code>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleSmartRedirect}
              className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 active:bg-blue-800 transition duration-200 shadow-sm"
            >
              {!user 
                ? '🔐 Go to Login' 
                : role === 'Admin' 
                  ? '⚙️ Go to Admin Dashboard'
                  : role === 'Coach'
                    ? '🏀 Go to Coach Dashboard'
                    : role === 'Player'
                      ? '🏅 Go to Player Dashboard'
                      : '🏠 Go Home'}
            </button>
            
            <button
              onClick={() => navigate('/', { replace: true })}
              className="w-full px-6 py-3 bg-slate-200 text-slate-900 font-semibold rounded-lg hover:bg-slate-300 active:bg-slate-400 transition duration-200"
            >
              🏠 Back to Home
            </button>

            <button
              onClick={() => navigate(-1)}
              className="w-full px-6 py-3 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 active:bg-slate-300 transition duration-200"
            >
              ← Go Back
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
