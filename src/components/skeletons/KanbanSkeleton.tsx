import React from 'react';
import Skeleton from './SkeletonBase';

export const KanbanSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-fadeIn select-none" aria-busy="true" aria-label="Loading kanban execution board">
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-52" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-3.5 w-80" />
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-36 rounded-xl" />
        </div>
      </div>

      {/* 3 Kanban Columns Container */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Column 1: TO DO */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Skeleton variant="circular" className="w-2.5 h-2.5" />
              <Skeleton className="h-4 w-20 font-bold" />
            </div>
            <Skeleton className="h-5 w-8 rounded-full" />
          </div>

          <div className="space-y-3">
            {[1, 2, 3].map((card) => (
              <div key={card} className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-16 rounded" />
                  <Skeleton variant="circular" className="w-4 h-4" />
                </div>
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3.5 w-3/4" />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton variant="circular" className="w-6 h-6" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: IN PROGRESS */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Skeleton variant="circular" className="w-2.5 h-2.5" />
              <Skeleton className="h-4 w-28 font-bold" />
            </div>
            <Skeleton className="h-5 w-8 rounded-full" />
          </div>

          <div className="space-y-3">
            {[1, 2].map((card) => (
              <div key={card} className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-20 rounded" />
                  <Skeleton variant="circular" className="w-4 h-4" />
                </div>
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-3.5 w-1/2" />
                </div>
                {/* Simulated progress indicator */}
                <Skeleton className="h-1.5 w-full rounded-full" />
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton variant="circular" className="w-6 h-6" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: COMPLETED */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Skeleton variant="circular" className="w-2.5 h-2.5" />
              <Skeleton className="h-4 w-24 font-bold" />
            </div>
            <Skeleton className="h-5 w-8 rounded-full" />
          </div>

          <div className="space-y-3">
            {[1, 2, 3].map((card) => (
              <div key={card} className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-16 rounded" />
                  <Skeleton variant="circular" className="w-4 h-4" />
                </div>
                <Skeleton className="h-4 w-4/5 line-through opacity-60" />
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton variant="circular" className="w-6 h-6" />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};

export default KanbanSkeleton;
