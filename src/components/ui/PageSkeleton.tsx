import React from 'react';
import { SkeletonCard } from '@/components/ui/SkeletonCard';

interface PageSkeletonProps {
  variant?: 'page' | 'dashboard' | 'admin-dashboard' | 'stadium' | 'match-center';
  className?: string;
}

export const PageSkeleton: React.FC<PageSkeletonProps> = ({
  variant = 'page',
  className = '',
}) => {
  return (
    <div className={`w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200 ${className}`}>
      <SkeletonCard variant={variant} />
    </div>
  );
};
