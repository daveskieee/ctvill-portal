import React from 'react';
import Skeleton from './SkeletonBase';

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-fadeIn select-none" aria-busy="true" aria-label="Loading dashboard data">
      
      {/* Top Notice / Status Banner Skeleton */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 w-full sm:w-auto">
          <Skeleton variant="circular" className="w-10 h-10 shrink-0" />
          <div className="space-y-2 flex-1 sm:w-64">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-60" />
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Skeleton className="h-8 w-28 rounded-lg" />
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
      </div>

      {/* 4 Core Operational & Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-800/80 bg-slate-950/90 p-5 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton variant="circular" className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-8 w-36" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-12 rounded-full" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        ))}
      </div>

      {/* Primary Analytics Section: 2 Major Chart Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Milestones & Progress Distribution Chart (2 cols) */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800/80 bg-slate-950/90 p-6 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3.5 w-72" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-20 rounded-lg" />
              <Skeleton className="h-7 w-24 rounded-lg" />
            </div>
          </div>

          {/* Chart Wireframe (Bar graph simulation) */}
          <div className="h-64 sm:h-72 flex items-end gap-3 sm:gap-6 pt-6 pb-2 px-4 border-b border-slate-800/60">
            {[45, 75, 30, 90, 60, 80, 50, 65, 85].map((heightPct, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <Skeleton
                  className="w-full rounded-t-md"
                  style={{ height: `${heightPct}%` }}
                />
                <Skeleton className="h-2.5 w-8 rounded-sm" />
              </div>
            ))}
          </div>

          {/* Chart Legend Skeleton */}
          <div className="flex items-center justify-center gap-6 pt-2">
            <div className="flex items-center gap-2">
              <Skeleton variant="circular" className="w-3 h-3" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton variant="circular" className="w-3 h-3" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton variant="circular" className="w-3 h-3" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </div>

        {/* Right: 3Cs Variance & Financial Exposure Breakdown (1 col) */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-950/90 p-6 shadow-xl space-y-5 flex flex-col justify-between">
          <div>
            <div className="pb-4 border-b border-slate-800/80 space-y-1.5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3.5 w-52" />
            </div>

            {/* Circular Gauge / Donut Placeholder */}
            <div className="py-6 flex flex-col items-center justify-center">
              <div className="relative w-40 h-40 flex items-center justify-center">
                <Skeleton variant="circular" className="w-36 h-36" />
                <div className="absolute w-24 h-24 rounded-full bg-slate-950 flex items-center justify-center">
                  <div className="space-y-1 text-center flex flex-col items-center">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-2.5 w-16" />
                  </div>
                </div>
              </div>
            </div>

            {/* Stacked Metric Breakdown List */}
            <div className="space-y-3 pt-2">
              {[1, 2, 3].map((row) => (
                <div key={row} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-800/60 bg-slate-900/40">
                  <div className="flex items-center gap-2.5">
                    <Skeleton variant="circular" className="w-3.5 h-3.5" />
                    <Skeleton className="h-3.5 w-24" />
                  </div>
                  <Skeleton className="h-4 w-16 font-mono" />
                </div>
              ))}
            </div>
          </div>

          <Skeleton className="h-9 w-full rounded-xl mt-4" />
        </div>
      </div>

      {/* Bottom Row: Recent Field Logs & Critical Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Field Site Diary Feed Skeleton */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-950/90 p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3.5 w-16" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="flex items-start gap-3 p-3 rounded-xl border border-slate-800/50 bg-slate-900/30">
                <Skeleton variant="circular" className="w-8 h-8 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="h-2.5 w-16" />
                  </div>
                  <Skeleton className="h-3 w-5/6" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Urgent Site Tasks Skeleton */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-950/90 p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3.5 w-16" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="flex items-center justify-between p-3 rounded-xl border border-slate-800/50 bg-slate-900/30">
                <div className="flex items-center gap-3">
                  <Skeleton variant="circular" className="w-5 h-5 shrink-0" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-48" />
                    <Skeleton className="h-2.5 w-24" />
                  </div>
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};

export default DashboardSkeleton;
