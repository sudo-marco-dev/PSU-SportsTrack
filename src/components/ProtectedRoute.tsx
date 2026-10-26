import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, type UserRole } from '@/context/AuthContext';
import { PageSkeleton } from '@/components/ui/PageSkeleton';

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
    return <PageSkeleton variant="page" />;
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
