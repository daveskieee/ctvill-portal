import React from 'react';
import Skeleton from './SkeletonBase';

export const GanttSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-fadeIn select-none" aria-busy="true" aria-label="Loading gantt timeline engine">
      
      {/* Top Header & Gantt Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-60" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-3.5 w-80" />
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Skeleton className="h-9 w-44 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
      </div>

      {/* Gantt View Controls Toolbar */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/90 p-4 shadow-xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Zoom & View Scales */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
            <Skeleton className="h-7 w-16 rounded-md" />
            <Skeleton className="h-7 w-16 rounded-md" />
            <Skeleton className="h-7 w-16 rounded-md" />
          </div>
          <Skeleton className="w-8 h-8 rounded-lg" />
          <Skeleton className="w-8 h-8 rounded-lg" />
        </div>
      </div>

      {/* Main Gantt Split Container (Left: Task List, Right: Timeline Bars) */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/90 shadow-2xl overflow-hidden flex flex-col">
        
        {/* Timeline Header Row (Dates scale) */}
        <div className="flex border-b border-slate-800 bg-slate-900/70">
          <div className="w-1/3 min-w-[280px] p-4 border-r border-slate-800 flex items-center justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex-1 p-4 flex items-center justify-between gap-4 overflow-hidden">
            {[1, 2, 3, 4, 5, 6, 7].map((wk) => (
              <div key={wk} className="flex-1 text-center space-y-1">
                <Skeleton className="h-3 w-16 mx-auto" />
                <Skeleton className="h-2 w-10 mx-auto" />
              </div>
            ))}
          </div>
        </div>

        {/* Gantt Row Items */}
        <div className="divide-y divide-slate-800/60">
          {[
            { wbs: '1.0', name: 'Mobilisation & PEZA Clearances', barStart: '5%', barWidth: '25%' },
            { wbs: '2.0', name: 'MEPFS Rough-in & Circuit Routing', barStart: '20%', barWidth: '35%' },
            { wbs: '3.0', name: 'Acoustic Ceilings & Baffles', barStart: '45%', barWidth: '30%' },
            { wbs: '4.0', name: 'Glass Partitions & Framing', barStart: '55%', barWidth: '28%' },
            { wbs: '5.0', name: 'Flooring, Carpet & Polishing', barStart: '65%', barWidth: '22%' },
            { wbs: '6.0', name: 'Commissioning & Handover', barStart: '80%', barWidth: '15%' },
          ].map((row, idx) => (
            <div key={idx} className="flex items-center hover:bg-slate-900/30 transition-colors">
              
              {/* Left Task Hierarchy Cell */}
              <div className="w-1/3 min-w-[280px] p-3.5 border-r border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Skeleton className="h-3.5 w-8 font-mono" />
                  <Skeleton className="h-3.5 w-44" />
                </div>
                <Skeleton className="h-4 w-12 rounded" />
              </div>

              {/* Right Timeline Bar Cell with simulated duration bar */}
              <div className="flex-1 p-3.5 relative h-12 flex items-center">
                {/* Background vertical grid guides */}
                <div className="absolute inset-0 flex justify-between pointer-events-none opacity-20">
                  {[1, 2, 3, 4, 5, 6, 7].map((g) => (
                    <div key={g} className="h-full border-r border-slate-700/40" />
                  ))}
                </div>

                {/* Staggered Gantt Bar Placeholder */}
                <div
                  className="absolute h-6 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center px-2"
                  style={{ left: row.barStart, width: row.barWidth }}
                >
                  <Skeleton className="h-2 w-3/4 rounded-full" />
                </div>
              </div>

            </div>
          ))}
        </div>

        {/* Gantt Footer Legend */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Skeleton className="w-3 h-3 rounded" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="flex items-center gap-1.5">
              <Skeleton className="w-3 h-3 rounded" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="flex items-center gap-1.5">
              <Skeleton className="w-3 h-3 rounded" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-3.5 w-36" />
        </div>

      </div>

    </div>
  );
};

export default GanttSkeleton;
