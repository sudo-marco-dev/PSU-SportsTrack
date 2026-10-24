import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, type UserRole } from '@/context/AuthContext';

interface ProtectedRouteProps {
  requiredRole?: UserRole | UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ requiredRole }) => {
  const { user, role, isDev, isSuperAdmin, isFacilitator, isCoach, isPlayer, isImpersonating, isLoading, openLoginModal } = useAuth();

  const isDevRoute = Array.isArray(requiredRole) ? requiredRole.includes('dev') : requiredRole === 'dev';

  useEffect(() => {
    if (!isLoading && !user) {
      if (isDevRoute && Boolean(import.meta.env.DEV)) {
        return;
      }
      openLoginModal();
    }
  }, [isLoading, user, openLoginModal, isDevRoute]);

  if (isLoading) {
    return (
      <div className="flex py-28 items-center justify-center w-full">
        <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
          <div className="size-12 rounded-full border-3 border-orange-500/20 border-t-orange-500 animate-spin" />
          <div className="flex items-center gap-2">
            <span className="text-orange-500 font-black italic tracking-wider text-xs uppercase">PSU</span>
            <span className="text-slate-400 font-bold uppercase tracking-[0.25em] text-[10px]">Verifying Access...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    if (isDevRoute && Boolean(import.meta.env.DEV)) {
      return <Outlet />;
    }
    return <Navigate to="/" replace />;
  }

  if (requiredRole) {
    const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    
    // Check permission with role-specific access control
    const hasPermission = requiredRoles.some((req) => {
      if (req === 'dev') {
        return isDev || isSuperAdmin || isImpersonating || Boolean(import.meta.env.DEV);
      }
      if (req === 'super_admin') {
        return isSuperAdmin;
      }
      if (req === 'facilitator') {
        return isFacilitator;
      }
      if (req === 'coach') {
        return isCoach;
      }
      if (req === 'player_student' || req === 'player_faculty' || req === 'player_staff') {
        return isPlayer;
      }
      return role === req;
    });

    if (!hasPermission) {
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
};
