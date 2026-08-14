import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const REDIRECT_MAP: Record<string, string> = {
  '/coach/tournaments': '/coach',
  '/coach/events': '/coach',
  '/admin/users': '/admin',
  '/admin/verification': '/admin',
  '/admin/reports': '/admin',
  '/admin/settings': '/admin',
  // Add more as needed
};

/**
 * Hook to handle old route redirects.
 * Note: Role-based auth protection is handled by ProtectedRoute.tsx
 */
export function useAuthRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const currentPath = location.pathname;

    // Check if this is an old route that should be redirected
    if (currentPath in REDIRECT_MAP) {
      console.warn(`[Redirect] Old route detected: ${currentPath} → ${REDIRECT_MAP[currentPath]}`);
      navigate(REDIRECT_MAP[currentPath], { replace: true });
    }
  }, [location.pathname, navigate]);
}
