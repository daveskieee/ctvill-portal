import React, { useMemo } from 'react';
import Skeleton from './SkeletonBase';
import DashboardSkeleton from './DashboardSkeleton';
import TableSkeleton from './TableSkeleton';
import CardGridSkeleton from './CardGridSkeleton';
import KanbanSkeleton from './KanbanSkeleton';
import GanttSkeleton from './GanttSkeleton';
import SiteDiarySkeleton from './SiteDiarySkeleton';
import Sidebar from '../Sidebar';
import logoJpg from '../../assets/images/ctvill/logo.jpg';

export const ERPShellSkeleton: React.FC = () => {
  // Determine requested module from URL hash or sessionStorage to pre-align content skeleton
  const activeTabCandidate = useMemo(() => {
    if (typeof window === 'undefined') return 'dashboard';
    const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase().trim();
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab')?.toLowerCase().trim();
    const savedTab = sessionStorage.getItem('ctvill_active_tab')?.toLowerCase().trim();
    return hash || tabParam || savedTab || 'dashboard';
  }, []);

  const renderModuleSkeleton = () => {
    switch (activeTabCandidate) {
      case 'dashboard':
      case 'executive-portfolio':
        return <DashboardSkeleton />;
      case 'projects':
        return <CardGridSkeleton type="projects" cardsCount={6} />;
      case 'gantt':
        return <GanttSkeleton />;
      case 'site-diary':
        return <SiteDiarySkeleton />;
      case 'kanban':
        return <KanbanSkeleton />;
      case 'contractors':
      case 'workforce':
        return <CardGridSkeleton type="workforce" cardsCount={6} />;
      case 'attendance':
      case 'timekeeper-attendance':
      case 'workforce/attendance':
      case 'daily-attendance':
      case 'payroll':
      case 'finance-payroll':
      case 'worker-masterlist':
      case 'subcontractor-audits':
      case 'subcontractor-payables':
      case 'rfis':
      case 'change-orders':
      case 'permits':
      case 'payments':
      case 'billings':
      case 'progress-billings':
      case 'documents':
      case 'quotations':
      case 'quotation-leads':
      case 'audit-trail':
      case 'schedule':
      case 'risks':
      case 'account-settings':
      case 'operations-settings':
        return <TableSkeleton columns={6} rows={7} />;
      default:
        return <DashboardSkeleton />;
    }
  };

  return (
    <div
      id="erp-shell-skeleton"
      className="h-screen h-[100dvh] bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden select-none"
      aria-busy="true"
      aria-label="Verifying workspace session"
    >
      {/* Top Neutral Header Bar */}
      <header className="bg-slate-950 border-b border-slate-800 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-30 shadow-md shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 flex items-center justify-center shrink-0">
            <Skeleton className="w-4 h-4 rounded" />
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="h-8 w-8 rounded-lg bg-black border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
              <img src={logoJpg} alt="CTVILL Logo" className="w-full h-full object-cover" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-tight">CTVILL</span>
              <Skeleton className="h-4 w-20 rounded" />
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-slate-800 text-xs">
            <Skeleton className="h-3.5 w-24" />
            <span className="text-slate-600">/</span>
            <Skeleton className="h-3.5 w-32" />
          </div>
        </div>

        {/* Global Search Skeleton */}
        <div className="flex-1 max-w-sm sm:max-w-md relative mx-2">
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>

        {/* Header Right Action Skeletons */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Skeleton variant="circular" className="w-8 h-8 rounded-lg hidden sm:block" />
          <Skeleton variant="circular" className="w-8 h-8 rounded-lg" />
          <Skeleton variant="circular" className="w-8 h-8 rounded-lg" />
        </div>
      </header>

      {/* Main Layout: Permanent Sidebar + Neutral Workspace Skeleton */}
      <div className="flex-1 flex overflow-hidden">
        {/* Permanent Static Sidebar - No Skeletons */}
        <Sidebar
          activeTab={activeTabCandidate}
          onSelectTab={() => {}}
          user={null}
          isSidebarOpen={true}
        />

        {/* Main Content Workspace Skeleton */}
        <main className="flex-1 overflow-y-auto bg-slate-900 p-3 sm:p-5 lg:p-8 space-y-4 sm:space-y-6 min-w-0 min-h-0">
          {renderModuleSkeleton()}
        </main>
      </div>
    </div>
  );
};

export default ERPShellSkeleton;
