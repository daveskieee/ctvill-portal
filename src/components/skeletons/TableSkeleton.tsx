import React from 'react';
import Skeleton from './SkeletonBase';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  title?: string;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 6,
  columns = 6,
  title,
}) => {
  return (
    <div className="space-y-6 animate-fadeIn select-none" aria-busy="true" aria-label="Loading table records">
      
      {/* Table Header Section: Title, Stats & Primary Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            {title ? (
              <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
            ) : (
              <Skeleton className="h-6 w-52" />
            )}
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-3.5 w-80" />
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-36 rounded-xl" />
        </div>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/90 p-4 shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex-1 max-w-md">
          <Skeleton className="h-9 w-full rounded-xl" />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      </div>

      {/* Main Table Structure */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/90 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            
            {/* Table Header */}
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60">
                <th className="p-4 w-12 text-center">
                  <Skeleton variant="circular" className="w-4 h-4 mx-auto" />
                </th>
                {Array.from({ length: columns }).map((_, c) => (
                  <th key={c} className="p-4">
                    <Skeleton className={`h-3.5 ${c === 0 ? 'w-28' : c === 1 ? 'w-36' : 'w-20'}`} />
                  </th>
                ))}
                <th className="p-4 w-28 text-right">
                  <Skeleton className="h-3.5 w-16 ml-auto" />
                </th>
              </tr>
            </thead>

            {/* Table Rows */}
            <tbody className="divide-y divide-slate-800/60">
              {Array.from({ length: rows }).map((_, r) => {
                // Generate natural varying widths for table cells
                const widthVariants = ['w-24', 'w-32', 'w-40', 'w-20', 'w-28'];
                return (
                  <tr key={r} className="hover:bg-slate-900/30 transition-colors">
                    <td className="p-4 text-center">
                      <Skeleton variant="circular" className="w-3.5 h-3.5 mx-auto" />
                    </td>
                    <td className="p-4">
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-32 font-mono font-bold" />
                        <Skeleton className="h-2.5 w-20" />
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-44 font-semibold" />
                        <Skeleton className="h-2.5 w-56" />
                      </div>
                    </td>
                    <td className="p-4">
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </td>
                    <td className="p-4">
                      <Skeleton className={`h-4 ${widthVariants[r % widthVariants.length]}`} />
                    </td>
                    <td className="p-4">
                      <Skeleton className="h-4 w-20 font-mono" />
                    </td>
                    {columns > 5 && (
                      <td className="p-4">
                        <Skeleton className="h-4 w-24 font-mono" />
                      </td>
                    )}
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Skeleton className="w-7 h-7 rounded-lg" />
                        <Skeleton className="w-7 h-7 rounded-lg" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>

          </table>
        </div>

        {/* Table Pagination / Footer Bar Skeleton */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/40 flex flex-col sm:flex-row items-center justify-between gap-3">
          <Skeleton className="h-3.5 w-48" />
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </div>
      </div>

    </div>
  );
};

export default TableSkeleton;
