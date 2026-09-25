import React from 'react';
import Skeleton from './SkeletonBase';

export const SiteDiarySkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-fadeIn select-none" aria-busy="true" aria-label="Loading site diary and weather telemetry">
      
      {/* Top Header & Jobsite Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-5 w-28 rounded-full" />
          </div>
          <Skeleton className="h-3.5 w-80" />
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Skeleton className="h-9 w-40 rounded-xl" />
          <Skeleton className="h-9 w-36 rounded-xl" />
        </div>
      </div>

      {/* Main Weather Telemetry Hero Panel */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/90 p-6 shadow-2xl space-y-6">
        
        {/* Top Row: Hero Temp & Live Clock */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-4 sm:gap-5">
            <Skeleton variant="circular" className="w-14 h-14 shrink-0" />
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <Skeleton className="h-10 w-24 font-mono" />
                <Skeleton className="h-5 w-12" />
              </div>
              <Skeleton className="h-3.5 w-44" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-32 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </div>

        {/* 4 Weather Metric Telemetry Gauges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((g) => (
            <div key={g} className="p-4 rounded-xl border border-slate-800/60 bg-slate-900/40 space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton variant="circular" className="w-4 h-4" />
              </div>
              <Skeleton className="h-6 w-20 font-mono font-bold" />
              <Skeleton className="h-2.5 w-24" />
            </div>
          ))}
        </div>

        {/* 7-Day Forecast Outlook Carousel */}
        <div className="pt-2 space-y-3">
          <Skeleton className="h-4 w-36" />
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <div key={d} className="p-3 rounded-xl border border-slate-800/50 bg-slate-900/30 text-center space-y-2">
                <Skeleton className="h-3 w-12 mx-auto" />
                <Skeleton variant="circular" className="w-6 h-6 mx-auto" />
                <Skeleton className="h-3.5 w-14 mx-auto font-mono" />
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Field Site Diary Daily Execution Logs Feed */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/90 p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div className="space-y-1">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>

        <div className="space-y-3 pt-1">
          {[1, 2, 3].map((entry) => (
            <div key={entry} className="p-4 rounded-xl border border-slate-800/60 bg-slate-900/40 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Skeleton variant="circular" className="w-7 h-7" />
                  <Skeleton className="h-4 w-32 font-bold" />
                  <Skeleton className="h-4 w-20 rounded-full" />
                </div>
                <Skeleton className="h-3 w-28 font-mono" />
              </div>
              <Skeleton className="h-3.5 w-5/6" />
              <div className="flex items-center gap-3 pt-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default SiteDiarySkeleton;
