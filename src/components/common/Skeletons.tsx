import React from 'react';

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 6 }) => (
  <div className="space-y-4 p-6 w-full animate-fadeIn">
    <div className="flex justify-between items-center mb-6">
      <div className="h-8 w-48 rounded skeleton-shimmer" />
      <div className="flex gap-2">
        <div className="h-8 w-24 rounded skeleton-shimmer" />
        <div className="h-8 w-32 rounded skeleton-shimmer" />
      </div>
    </div>
    <div className="h-10 w-full rounded skeleton-shimmer mb-4" />
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 w-full rounded-lg skeleton-shimmer" />
      ))}
    </div>
  </div>
);

export const FormSettingsSkeleton: React.FC = () => (
  <div className="p-6 max-w-4xl space-y-6 animate-fadeIn">
    <div className="h-8 w-60 rounded skeleton-shimmer mb-4" />
    <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/40 space-y-4">
      <div className="h-5 w-40 rounded skeleton-shimmer" />
      <div className="h-10 w-full rounded skeleton-shimmer" />
      <div className="h-5 w-32 rounded skeleton-shimmer" />
      <div className="h-10 w-full rounded skeleton-shimmer" />
      <div className="h-10 w-28 rounded skeleton-shimmer pt-2" />
    </div>
  </div>
);

export const DashboardKPISkeleton: React.FC = () => (
  <div className="p-6 space-y-6 w-full animate-fadeIn">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-28 rounded-xl skeleton-shimmer" />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 h-72 rounded-xl skeleton-shimmer" />
      <div className="h-72 rounded-xl skeleton-shimmer" />
    </div>
  </div>
);

export const GanttKanbanSkeleton: React.FC = () => (
  <div className="p-6 space-y-4 w-full animate-fadeIn">
    <div className="h-10 w-full rounded skeleton-shimmer" />
    <div className="grid grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-96 rounded-xl skeleton-shimmer" />
      ))}
    </div>
  </div>
);
