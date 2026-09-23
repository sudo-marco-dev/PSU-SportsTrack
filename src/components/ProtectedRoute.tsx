import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, type UserRole } from '@/context/AuthContext';

interface ProtectedRouteProps {
  requiredRole?: UserRole | UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ requiredRole }) => {
  const { user, role, isSuperAdmin, isFacilitator, isCoach, isPlayer, isLoading, openLoginModal } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      openLoginModal();
    }
  }, [isLoading, user, openLoginModal]);

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
    return <Navigate to="/" replace />;
  }

  if (requiredRole) {
    const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    
    // Check permission with hierarchical & backward compatibility
    const hasPermission = requiredRoles.some((req) => {
      if (req === 'super_admin' || req === 'Admin') {
        return isSuperAdmin;
      }
      if (req === 'facilitator') {
        return isFacilitator;
      }
      if (req === 'coach' || req === 'Coach') {
        return isCoach || isSuperAdmin;
      }
      if (req === 'player_student' || req === 'player_faculty' || req === 'Player') {
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
