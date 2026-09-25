import React from 'react';
import Skeleton from './SkeletonBase';

interface CardGridSkeletonProps {
  cardsCount?: number;
  title?: string;
  type?: 'projects' | 'workforce';
}

export const CardGridSkeleton: React.FC<CardGridSkeletonProps> = ({
  cardsCount = 4,
  title,
  type = 'projects',
}) => {
  return (
    <div className="space-y-6 animate-fadeIn select-none" aria-busy="true" aria-label="Loading cards layout">
      
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            {title ? (
              <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
            ) : (
              <Skeleton className="h-6 w-56" />
            )}
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-3.5 w-72" />
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-36 rounded-xl" />
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/90 p-4 shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex-1 max-w-md">
          <Skeleton className="h-9 w-full rounded-xl" />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-28 rounded-lg" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
      </div>

      {/* Grid of Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {Array.from({ length: cardsCount }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-800/80 bg-slate-950/90 p-5 shadow-2xl space-y-4 flex flex-col justify-between"
          >
            {/* Card Header */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-40 font-bold" />
                    <Skeleton className="h-4 w-12 rounded" />
                  </div>
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>

              {/* Location / Meta row */}
              <div className="flex items-center gap-4 text-xs pt-1">
                <div className="flex items-center gap-1.5">
                  <Skeleton variant="circular" className="w-3.5 h-3.5" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <div className="flex items-center gap-1.5">
                  <Skeleton variant="circular" className="w-3.5 h-3.5" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </div>

            {/* Progress / Metric Section */}
            {type === 'projects' ? (
              <div className="space-y-3 p-3.5 rounded-xl border border-slate-800/60 bg-slate-900/40">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-10 font-mono font-bold" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
                
                {/* 3Cs badges: Open RFIs & Changes */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                    <Skeleton className="h-3 w-14" />
                    <Skeleton className="h-4 w-6 rounded" />
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                    <Skeleton className="h-3 w-14" />
                    <Skeleton className="h-4 w-6 rounded" />
                  </div>
                </div>
              </div>
            ) : (
              /* Workforce trade badges & headcount */
              <div className="space-y-2 p-3.5 rounded-xl border border-slate-800/60 bg-slate-900/40">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-4 w-12 rounded-full" />
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Skeleton className="h-5 w-20 rounded-md" />
                  <Skeleton className="h-5 w-24 rounded-md" />
                  <Skeleton className="h-5 w-16 rounded-md" />
                </div>
              </div>
            )}

            {/* Card Footer: Team avatars + Action buttons */}
            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center -space-x-2">
                <Skeleton variant="circular" className="w-7 h-7 border-2 border-slate-950" />
                <Skeleton variant="circular" className="w-7 h-7 border-2 border-slate-950" />
                <Skeleton variant="circular" className="w-7 h-7 border-2 border-slate-950" />
              </div>
              
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-8 w-20 rounded-lg" />
                <Skeleton className="w-8 h-8 rounded-lg" />
              </div>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
};

export default CardGridSkeleton;
