/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Building2, Users, CheckCircle2, TrendingUp, DollarSign, Calendar, 
  Layers, Plus, ExternalLink, ShieldCheck, Clock, FileText, ArrowRight, 
  X, AlertCircle, Edit3, Trash2, Check, Sliders, HardHat, Search, Download, HelpCircle, FileSpreadsheet, Lock,
  MapPin, CloudSun, RefreshCw, LayoutGrid, Table, Eye
} from 'lucide-react';
import { ProjectProfile, ProjectTask, Contractor, WorkforceReallocationRecommendation, ProjectRFI, ChangeOrder } from '../types';
import { generateReallocationRecommendations } from '../services/WorkforceReallocationService';
import { exportToCsv } from '../utils/exportUtils';
import { resolveLocalGeocoding, resolveProjectCoordinatesAsync, resolveProjectCoordinatesSync, GeocodedLocation } from '../utils/geocoding';

export const AVAILABLE_PMS = [
  { id: 'usr-pm-ricardo', name: 'Engr. Ricardo Ramos (Senior Project Manager)' },
  { id: 'usr-pm-carlos', name: 'Engr. Carlos Mendoza (Civil & Site Operations Lead)' },
  { id: 'usr-pm-jonathan', name: 'Ar. Jonathan Dela Cruz (Principal Architect & Design Lead)' },
  { id: 'usr-pm-marco', name: 'Principal Architect Marco Alcantara (Lead Designer)' },
];

export function calculateProjectProgress(
  projectId: string,
  tasks: ProjectTask[] = [],
  fallbackProgress: number = 0
): number {
  const projectTasks = tasks.filter(t => t.projectId === projectId);
  if (!projectTasks || projectTasks.length === 0) {
    return Math.round(fallbackProgress);
  }
  // Milestone actual completion deliverables
  const milestones = projectTasks.filter(
    t => (t as any).type === 'milestone' || t.category === 'MILESTONE' || ((t as any).duration !== undefined && (t as any).duration === 0)
  );
  const items = milestones.length > 0 ? milestones : projectTasks;
  const sumProgress = items.reduce((sum, item) => {
    let p = item.progress ?? 0;
    if (p > 0 && p <= 1) {
      p = p * 100;
    }
    return sum + p;
  }, 0);
  return Math.round(sumProgress / items.length);
}

export function getEffectiveProjectStatus(
  status: ProjectProfile['status'] | string,
  progress: number
): ProjectProfile['status'] {
  if (progress > 0 && (status === 'PLANNING' || !status)) {
    return 'IN_PROGRESS';
  }
  return (status || 'PLANNING') as ProjectProfile['status'];
}

interface ProjectProfileHubProps {
  projects: ProjectProfile[];
  tasks: ProjectTask[];
  contractors: Contractor[];
  rfis?: ProjectRFI[];
  changeOrders?: ChangeOrder[];
  userRole?: string;
  isAdmin?: boolean;
  onSelectProject?: (project: ProjectProfile) => void;
  onUpdateProjectProgress?: (projectId: string, progress: number) => void;
  onCreateProject?: (project: Partial<ProjectProfile>) => Promise<void> | void;
  onUpdateProject?: (projectId: string, updates: Partial<ProjectProfile>) => Promise<void> | void;
  onDeleteProject?: (projectId: string) => Promise<void> | void;
}

export default function ProjectProfileHub({
  projects = [],
  tasks = [],
  contractors = [],
  rfis = [],
  changeOrders = [],
  userRole = 'Admin',
  isAdmin = true,
  onCreateProject,
  onUpdateProject,
  onDeleteProject
}: ProjectProfileHubProps) {
  // Local state initialized strictly from live database projects
  const [localProjects, setLocalProjects] = useState<ProjectProfile[]>(projects || []);

  // Sync when parent projects prop updates from database
  React.useEffect(() => {
    setLocalProjects(projects || []);
  }, [projects]);

  const [selectedProject, setSelectedProject] = useState<ProjectProfile | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<'general' | 'timeline' | 'personnel'>('general');
  const [activeTabInsideProfile, setActiveTabInsideProfile] = useState<'OVERVIEW' | 'FINANCIALS' | 'WORKERS'>('OVERVIEW');

  // Workforce Reallocation State
  const [showReallocationModal, setShowReallocationModal] = useState<boolean>(false);
  const [activeReallocProject, setActiveReallocProject] = useState<ProjectProfile | null>(null);
  const [reallocRecommendations, setReallocRecommendations] = useState<WorkforceReallocationRecommendation[]>([]);
  const [isReallocating, setIsReallocating] = useState<boolean>(false);
  const [reallocFeedback, setReallocFeedback] = useState<string | null>(null);

  // Form State for New / Edit - Strictly initialized to empty/0
  const [formName, setFormName] = useState('');
  const [formClient, setFormClient] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formBudget, setFormBudget] = useState(0);
  const [formCollected, setFormCollected] = useState(0);
  const [formProgress, setFormProgress] = useState(0);
  const [formStatus, setFormStatus] = useState<ProjectProfile['status'] | ''>('');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [formEndDate, setFormEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [formWorkers, setFormWorkers] = useState(0);
  const [formTasksCount, setFormTasksCount] = useState(0);
  const [formMilestonesCount, setFormMilestonesCount] = useState(0);
  const [formIsPrivateAccounting, setFormIsPrivateAccounting] = useState<boolean>(false);
  const [formPMId, setFormPMId] = useState<string>('');
  const [formPMName, setFormPMName] = useState<string>('');
  const [availablePMs, setAvailablePMs] = useState<{ id: string; name: string }[]>(AVAILABLE_PMS);

  // Geocoding Coordinates State for Live Weather Station Sync
  const [detectedCoords, setDetectedCoords] = useState<GeocodedLocation | null>(null);
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);

  // Auto-resolve geocoding whenever formLocation changes
  useEffect(() => {
    if (!formLocation || !formLocation.trim()) {
      setDetectedCoords(null);
      return;
    }

    // 1. Instant local dictionary check
    const localMatch = resolveLocalGeocoding(formLocation);
    if (localMatch) {
      setDetectedCoords(localMatch);
      return;
    }

    // 2. Debounced online geocoding check (350ms)
    setIsGeocoding(true);
    const timer = setTimeout(async () => {
      try {
        const asyncMatch = await resolveProjectCoordinatesAsync(formLocation, formName);
        setDetectedCoords(asyncMatch);
      } catch {
        // Ignore network errors
      } finally {
        setIsGeocoding(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [formLocation, formName]);

  // Worker assignment state (Workers tab in project profile)
  const [workerSearchQuery, setWorkerSearchQuery] = useState('');
  const [isAssigningWorker, setIsAssigningWorker] = useState(false);

  // Worker assignment state during Project Creation / Edit Modal
  const [formAssignedWorkerIds, setFormAssignedWorkerIds] = useState<string[]>([]);
  const [modalWorkerSearchQuery, setModalWorkerSearchQuery] = useState('');

  // Toggle worker selection and auto-sync headcount
  const toggleWorkerSelection = (workerId: string) => {
    setFormAssignedWorkerIds(prev => {
      const next = prev.includes(workerId)
        ? prev.filter(id => id !== workerId)
        : [...prev, workerId];
      setFormWorkers(next.length);
      return next;
    });
  };

  useEffect(() => {
    fetch('/api/users?role=PROJECT_MANAGER')
      .then(res => res.ok ? res.json() : null)
      .then(users => {
        if (Array.isArray(users) && users.length > 0) {
          setAvailablePMs(users.map((u: any) => ({
            id: u.id,
            name: `${u.name} (Project Manager)`
          })));
        }
      })
      .catch(() => {});
  }, []);

  const synchronizedProjects = React.useMemo(() => {
    return localProjects.map(p => {
      const computedProg = calculateProjectProgress(p.id, tasks, p.progressPercentage);
      const computedStatus = getEffectiveProjectStatus(p.status, computedProg);
      return {
        ...p,
        progressPercentage: computedProg,
        status: computedStatus
      };
    });
  }, [localProjects, tasks]);

  const filteredProjects = synchronizedProjects.filter(p => {
    const matchesStatus = filterStatus === 'ALL' || p.status === filterStatus;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || 
      p.name.toLowerCase().includes(query) ||
      p.clientName.toLowerCase().includes(query) ||
      p.location.toLowerCase().includes(query) ||
      p.id.toLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  });

  const totalPortfolioBudget = synchronizedProjects.reduce((acc, p) => acc + p.budget, 0);
  const totalFundsCollected = synchronizedProjects.reduce((acc, p) => acc + p.fundsCollected, 0);
  const avgPortfolioProgress = Math.round(
    synchronizedProjects.reduce((acc, p) => acc + p.progressPercentage, 0) / (synchronizedProjects.length || 1)
  );
  const totalSiteManpower = synchronizedProjects.reduce((acc, p) => acc + (p.assignedWorkersCount || 0), 0);

  // 3Cs Metrics: RFIs and Change Orders
  const totalOpenRfis = rfis.filter(r => r.status === 'OPEN' || r.status === 'UNDER_REVIEW').length;
  const pendingChangeOrders = changeOrders.filter(co => co.status === 'PENDING');
  const totalPendingCOValue = pendingChangeOrders.reduce((sum, co) => sum + (Number(co.requestedAmount ?? co.amount ?? 0) || 0), 0);

  const handleExportCsv = () => {
    const headers = [
      'Project ID', 'Project Name', 'Client', 'Location', 'Status',
      'Contract Budget (PHP)', 'Funds Collected (PHP)', 'Progress %',
      'Start Date', 'Target Handover', 'Assigned Workers', 'Open RFIs', 'Pending Change Orders'
    ];
    const rows = localProjects.map(p => {
      const pRfis = rfis.filter(r => r.projectId === p.id || (r.projectName && r.projectName.toLowerCase() === p.name.toLowerCase()));
      const openRfis = pRfis.filter(r => r.status === 'OPEN' || r.status === 'UNDER_REVIEW').length;
      const pCOs = changeOrders.filter(co => co.projectId === p.id || (co.projectName && co.projectName.toLowerCase() === p.name.toLowerCase()));
      const pendingCOs = pCOs.filter(co => co.status === 'PENDING').length;
      return [
        p.id,
        p.name,
        p.clientName,
        p.location,
        p.status,
        p.budget,
        p.fundsCollected,
        `${p.progressPercentage}%`,
        p.startDate,
        p.targetHandoverDate,
        p.assignedWorkersCount,
        openRfis,
        pendingCOs
      ];
    });
    exportToCsv('CTVill_Commercial_Sites_Portfolio', headers, rows);
  };

  const openNewModal = () => {
    // Reset all dummy/pre-filled defaults strictly to 0 or empty strings
    setFormName('');
    setFormClient('');
    setFormDescription('');
    setFormLocation('');
    setDetectedCoords(null);
    setFormBudget(0);
    setFormCollected(0);
    setFormProgress(0);
    setFormStatus('');
    setFormStartDate(new Date().toISOString().split('T')[0]);
    setFormEndDate(new Date().toISOString().split('T')[0]);
    setFormWorkers(0);
    setFormTasksCount(0);
    setFormMilestonesCount(0);
    setFormIsPrivateAccounting(false);
    setFormPMId('');
    setFormPMName('');
    setFormAssignedWorkerIds([]);
    setModalWorkerSearchQuery('');
    setModalTab('general');
    setShowNewModal(true);
  };

  const openEditModal = (p: ProjectProfile) => {
    setFormName(p.name);
    setFormClient(p.clientName);
    setFormDescription(p.description);
    setFormLocation(p.location);
    if (p.latitude && p.longitude) {
      setDetectedCoords({
        name: p.location,
        lat: Number(p.latitude),
        lon: Number(p.longitude),
        confidence: 'EXACT_COORDINATES'
      });
    } else {
      const localMatch = resolveLocalGeocoding(p.location || p.name);
      setDetectedCoords(localMatch);
    }
    setFormBudget(p.budget);
    setFormCollected(p.fundsCollected);
    const computedProg = calculateProjectProgress(p.id, tasks, p.progressPercentage);
    setFormProgress(computedProg);
    setFormStatus(getEffectiveProjectStatus(p.status, computedProg));
    setFormStartDate(p.startDate);
    setFormEndDate(p.targetHandoverDate);
    setFormWorkers(p.assignedWorkersCount);
    setFormTasksCount(p.tasksCount);
    setFormMilestonesCount(p.milestonesCount);
    setFormIsPrivateAccounting(Boolean(p.isPrivateAccounting));
    setFormPMId(p.assignedProjectManagerId || '');
    setFormPMName(p.assignedProjectManagerName || '');
    const assignedIds = p.assignedContractorIds || [];
    setFormAssignedWorkerIds(assignedIds);
    setFormWorkers(assignedIds.length > 0 ? assignedIds.length : (p.assignedWorkersCount || 0));
    setModalWorkerSearchQuery('');
    setModalTab('general');
    setShowEditModal(true);
  };

  const openReallocationModal = (proj: ProjectProfile) => {
    setActiveReallocProject(proj);
    const recs = generateReallocationRecommendations(localProjects, contractors);
    const relevant = recs.filter(r => r.originProjectId === proj.id);
    setReallocRecommendations(relevant.length > 0 ? relevant : recs);
    setReallocFeedback(null);
    setShowReallocationModal(true);
  };

  const handleExecuteReallocation = async (rec: WorkforceReallocationRecommendation) => {
    setIsReallocating(true);
    try {
      const res = await fetch('/api/workforce/reallocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: rec.workerId,
          targetProjectId: rec.targetProjectId,
          targetProjectName: rec.targetProjectName
        })
      });
      if (res.ok) {
        setReallocFeedback(`✅ Successfully transferred ${rec.workerName} to "${rec.targetProjectName}".`);
        setReallocRecommendations(prev => prev.map(r => r.id === rec.id ? { ...r, applied: true } : r));
        // Update local project counts
        setLocalProjects(prev => prev.map(p => {
          if (p.id === rec.originProjectId) {
            return { ...p, assignedWorkersCount: Math.max(0, p.assignedWorkersCount - 1) };
          }
          if (p.id === rec.targetProjectId) {
            return { ...p, assignedWorkersCount: p.assignedWorkersCount + 1 };
          }
          return p;
        }));
      }
    } catch (err) {
      setReallocFeedback('❌ Failed to execute reallocation.');
    } finally {
      setIsReallocating(false);
    }
  };

  // Timeline validation: targetHandoverDate cannot precede startDate
  const isTimelineInvalid = Boolean(
    formStartDate && formEndDate && new Date(formEndDate) < new Date(formStartDate)
  );

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || isTimelineInvalid) return;

    // Resolve coordinates for project site weather synchronization
    const syncCoords = resolveProjectCoordinatesSync(formLocation.trim(), formName.trim());
    const finalLat = detectedCoords?.lat ?? syncCoords.lat;
    const finalLon = detectedCoords?.lon ?? syncCoords.lon;

    const newProj: ProjectProfile = {
      id: `PRJ-${Date.now().toString().slice(-4)}`,
      name: formName.trim(),
      clientName: formClient.trim(),
      description: formDescription.trim(),
      location: formLocation.trim(),
      latitude: finalLat,
      longitude: finalLon,
      budget: Number(formBudget) || 0,
      fundsCollected: 0,
      progressPercentage: Number(formProgress) || 0,
      status: (formStatus || 'PLANNING') as ProjectProfile['status'],
      targetHandoverDate: formEndDate,
      startDate: formStartDate,
      assignedWorkersCount: formAssignedWorkerIds.length || Number(formWorkers) || 0,
      assignedContractorIds: formAssignedWorkerIds,
      isPrivateAccounting: formIsPrivateAccounting,
      tasksCount: Number(formTasksCount) || 0,
      milestonesCount: Number(formMilestonesCount) || 0,
      assignedProjectManagerId: formPMId || undefined,
      assignedProjectManagerName: formPMName || undefined,
    };

    setLocalProjects(prev => [...prev, newProj]);

    if (onCreateProject) {
      await onCreateProject(newProj);
    } else {
      fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProj)
      }).catch(console.error);
    }

    // Sync newly assigned workers to this project site
    if (formAssignedWorkerIds.length > 0) {
      for (const wId of formAssignedWorkerIds) {
        fetch(`/api/projects/${newProj.id}/workers`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workerId: wId, action: 'add' })
        }).catch(console.error);
      }
    }

    setShowNewModal(false);
    setSelectedProject(newProj);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    // Resolve coordinates for project site weather synchronization
    const syncCoords = resolveProjectCoordinatesSync(formLocation.trim(), formName.trim(), selectedProject.latitude, selectedProject.longitude);
    const finalLat = detectedCoords?.lat ?? syncCoords.lat;
    const finalLon = detectedCoords?.lon ?? syncCoords.lon;

    const updated: ProjectProfile = {
      ...selectedProject,
      name: formName.trim(),
      clientName: formClient.trim(),
      description: formDescription.trim(),
      location: formLocation.trim(),
      latitude: finalLat,
      longitude: finalLon,
      budget: Number(formBudget),
      fundsCollected: selectedProject.fundsCollected ?? Number(formCollected) ?? 0,
      progressPercentage: Number(formProgress),
      // Auto-advance status: if progress > 0 and status is still PLANNING, bump to IN_PROGRESS
      status: (() => {
        const rawStatus = (formStatus || selectedProject.status || 'PLANNING') as ProjectProfile['status'];
        if (Number(formProgress) > 0 && rawStatus === 'PLANNING') return 'IN_PROGRESS' as ProjectProfile['status'];
        return rawStatus;
      })(),
      targetHandoverDate: formEndDate,
      startDate: formStartDate,
      assignedWorkersCount: formAssignedWorkerIds.length || Number(formWorkers),
      assignedContractorIds: formAssignedWorkerIds,
      tasksCount: Number(formTasksCount),
      milestonesCount: Number(formMilestonesCount),
      isPrivateAccounting: formIsPrivateAccounting,
      assignedProjectManagerId: formPMId || undefined,
      assignedProjectManagerName: formPMName || undefined,
    };

    setLocalProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    setSelectedProject(updated);

    if (onUpdateProject) {
      await onUpdateProject(updated.id, updated);
    } else {
      fetch(`/api/projects/${updated.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      }).catch(console.error);
    }

    setShowEditModal(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this project profile?')) return;
    setLocalProjects(prev => prev.filter(p => p.id !== id));
    if (selectedProject?.id === id) setSelectedProject(null);

    if (onDeleteProject) {
      await onDeleteProject(id);
    } else {
      fetch(`/api/projects/${id}`, { method: 'DELETE' }).catch(console.error);
    }
  };

  const handleQuickProgressUpdate = async (id: string, newProgress: number) => {
    const clamped = Math.max(0, Math.min(100, newProgress));
    setLocalProjects(prev => prev.map(p => p.id === id ? { ...p, progressPercentage: clamped } : p));
    if (selectedProject?.id === id) {
      setSelectedProject(prev => prev ? { ...prev, progressPercentage: clamped } : null);
    }

    fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progressPercentage: clamped })
    }).catch(console.error);
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold tracking-wider uppercase">
              Operational Command Hub
            </span>
            <span className="text-xs text-slate-400">Enterprise Fit-Out Portfolio</span>
          </div>
          <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-400" />
            Projects Profile Hub
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Central hub for project-specific tracking: budget vs. collected funds, live progress %, assigned workers, tasks, and milestones.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 sm:w-52">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search projects, client, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg pl-8 pr-2.5 py-1.5 focus:outline-none focus:border-amber-500 placeholder:text-slate-500"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full sm:w-auto bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">All Project Statuses</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="PUNCHLIST_QA">Punchlist & QA</option>
            <option value="PLANNING">Planning Phase</option>
            <option value="HANDED_OVER">Handed Over</option>
          </select>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
                viewMode === 'table'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Compact Table View (Default)"
            >
              <Table className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
                viewMode === 'cards'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Card Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">Cards</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleExportCsv}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer text-xs"
              title="Export Commercial Sites to CSV"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Export CSV</span>
            </button>

            {isAdmin && (
            <button
              onClick={openNewModal}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer text-xs"
            >
              <Plus className="w-4 h-4" />
              <span>New Project</span>
            </button>
            )}
          </div>
        </div>
      </div>

      {/* Portfolio Overview KPIs — Enhanced with 3Cs Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Total Budget</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-white mt-1 font-mono">
            ₱{totalPortfolioBudget.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {localProjects.length} Fit-Out Sites
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Collected</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-400 mt-1 font-mono">
            ₱{totalFundsCollected.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {totalPortfolioBudget > 0 ? Math.round((totalFundsCollected / totalPortfolioBudget) * 100) : 0}% Collection Pace
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Avg Progress</span>
            <CheckCircle2 className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-bold text-blue-400 mt-1 font-mono">
            {avgPortfolioProgress}%
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
            <div className="bg-blue-500 h-full rounded-full" style={{ width: `${avgPortfolioProgress}%` }} />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Field Labor</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-bold text-white mt-1 font-mono">
            {totalSiteManpower} Artisans
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            On-Site Deployments
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Open RFIs</span>
            <HelpCircle className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold text-cyan-400 mt-1 font-mono">
            {totalOpenRfis} Inquiries
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Engineering Clarifications
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Pending COs</span>
            <FileSpreadsheet className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-300 mt-1 font-mono">
            {pendingChangeOrders.length} Orders
          </div>
          <div className="text-[11px] text-amber-400/80 mt-1 font-mono">
            ₱{totalPendingCOValue.toLocaleString()} Under Review
          </div>
        </div>
      </div>

      {/* Projects Table, Cards, or Empty State */}
      {filteredProjects.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white mb-1">No Projects Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
            There are currently no projects matching your filter in the database. Create a new commercial project profile to get started.
          </p>
          {isAdmin && (
            <button
              onClick={openNewModal}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-2 cursor-pointer transition shadow-lg shadow-amber-500/10"
            >
              <Plus className="w-4 h-4" />
              Create Project Profile
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Code / Project</th>
                  <th className="py-3 px-3">Location & Lead PM</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Progress</th>
                  <th className="py-3 px-3">Budget & Collected</th>
                  <th className="py-3 px-3">Target Handover</th>
                  <th className="py-3 px-3">Signals & Crew</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredProjects.map((project) => {
                  const collectionRate = project.budget > 0 ? Math.round((project.fundsCollected / project.budget) * 100) : 0;
                  const pRfis = rfis.filter(r => r.projectId === project.id || (r.projectName && r.projectName.toLowerCase() === project.name.toLowerCase()));
                  const openRfis = pRfis.filter(r => r.status === 'OPEN' || r.status === 'UNDER_REVIEW');
                  const pCOs = changeOrders.filter(co => co.projectId === project.id || (co.projectName && co.projectName.toLowerCase() === project.name.toLowerCase()));
                  const pendingCOs = pCOs.filter(co => co.status === 'PENDING');

                  return (
                    <tr 
                      key={project.id}
                      onClick={() => setSelectedProject(project)}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold shrink-0">
                            {project.id}
                          </span>
                          <div className="min-w-0">
                            <div className="font-bold text-white group-hover:text-amber-400 transition-colors truncate max-w-[200px] sm:max-w-[260px]">
                              {project.name}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                              {project.clientName}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="truncate max-w-[170px] text-slate-300 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate">{project.location}</span>
                        </div>
                        <div className="text-[11px] text-amber-300/80 font-mono truncate max-w-[170px] flex items-center gap-1 mt-0.5">
                          <HardHat className="w-3 h-3 text-amber-400 shrink-0" />
                          <span className="truncate">{project.assignedProjectManagerName ? project.assignedProjectManagerName.split('(')[0].trim() : 'Unassigned'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border inline-block whitespace-nowrap ${
                          project.status === 'COMPLETED' ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800' :
                          project.status === 'PUNCHLIST_QA' ? 'bg-purple-950/80 text-purple-300 border-purple-800' :
                          project.status === 'PLANNING' ? 'bg-blue-950/80 text-blue-300 border-blue-800' :
                          'bg-amber-950/80 text-amber-300 border-amber-800'
                        }`}>
                          {project.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3 min-w-[110px]">
                        <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                          <span className="text-white font-bold">{project.progressPercentage}%</span>
                        </div>
                        <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                          <div
                            className="bg-gradient-to-r from-amber-500 to-amber-400 h-full rounded-full transition-all"
                            style={{ width: `${project.progressPercentage}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-mono text-white font-bold text-[11px]">
                          ₱{project.budget.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-emerald-400 font-mono">
                          ₱{project.fundsCollected.toLocaleString()} ({collectionRate}%)
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                        {project.targetHandoverDate}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-purple-300 border border-slate-700 flex items-center gap-0.5">
                            <Users className="w-2.5 h-2.5" />
                            {project.assignedWorkersCount || (project.assignedContractorIds || []).length}
                          </span>
                          {openRfis.length > 0 && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800" title={`${openRfis.length} Open RFIs`}>
                              {openRfis.length} RFI
                            </span>
                          )}
                          {pendingCOs.length > 0 && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800" title={`${pendingCOs.length} Pending COs`}>
                              {pendingCOs.length} CO
                            </span>
                          )}
                          {project.isPrivateAccounting && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800">
                              Private
                            </span>
                          )}
                          {(project.progressPercentage >= 90 || project.status === 'HANDED_OVER' || project.status === 'COMPLETED') && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800">
                              Surplus
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {(project.progressPercentage >= 90 || project.status === 'HANDED_OVER' || project.status === 'COMPLETED') && (
                            <button
                              onClick={() => openReallocationModal(project)}
                              className="p-1.5 bg-indigo-950/90 hover:bg-indigo-900 border border-indigo-700 text-indigo-300 rounded-lg transition cursor-pointer"
                              title="Reallocate Surplus Workforce"
                            >
                              <Users className="w-3.5 h-3.5 text-indigo-400" />
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedProject(project)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition cursor-pointer"
                            title="View Project Profile"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => {
                                setSelectedProject(project);
                                openEditModal(project);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition cursor-pointer"
                              title="Edit Project Profile"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => handleDelete(project.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                              title="Delete Project"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProjects.map((project) => {
            const collectionRate = project.budget > 0 ? Math.round((project.fundsCollected / project.budget) * 100) : 0;
            const pRfis = rfis.filter(r => r.projectId === project.id || (r.projectName && r.projectName.toLowerCase() === project.name.toLowerCase()));
            const openRfis = pRfis.filter(r => r.status === 'OPEN' || r.status === 'UNDER_REVIEW');
            const pCOs = changeOrders.filter(co => co.projectId === project.id || (co.projectName && co.projectName.toLowerCase() === project.name.toLowerCase()));
            const pendingCOs = pCOs.filter(co => co.status === 'PENDING');

            return (
              <div
                key={project.id}
                className="group bg-slate-900/70 border border-slate-800 hover:border-amber-500/50 rounded-xl p-5 transition-all duration-200 hover:shadow-lg relative overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
                        {project.id}
                      </span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                        project.status === 'COMPLETED' ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800' :
                        project.status === 'PUNCHLIST_QA' ? 'bg-purple-950/80 text-purple-300 border-purple-800' :
                        project.status === 'PLANNING' ? 'bg-blue-950/80 text-blue-300 border-blue-800' :
                        'bg-amber-950/80 text-amber-300 border-amber-800'
                      }`}>
                        {project.status.replace('_', ' ')}
                      </span>
                      {openRfis.length > 0 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800 font-semibold flex items-center gap-1">
                          <HelpCircle className="w-3 h-3 text-cyan-400" />
                          <span>{openRfis.length} RFI</span>
                        </span>
                      )}
                      {pendingCOs.length > 0 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800 font-semibold flex items-center gap-1">
                          <FileSpreadsheet className="w-3 h-3 text-amber-400" />
                          <span>{pendingCOs.length} CO</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {(project.progressPercentage >= 90 || project.status === 'HANDED_OVER' || project.status === 'COMPLETED') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openReallocationModal(project);
                          }}
                          className="px-2 py-1 bg-indigo-950/90 hover:bg-indigo-900 border border-indigo-700 text-indigo-300 text-[10px] font-bold rounded-lg flex items-center gap-1 transition cursor-pointer"
                          title="Surplus Workforce Detected — Click to Reassign"
                        >
                          <Users className="w-3 h-3 text-indigo-400" />
                          <span>Reallocate</span>
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProject(project);
                            openEditModal(project);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition cursor-pointer"
                          title="Edit Project Profile"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(project.id);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                          title="Delete Project"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 
                    onClick={() => setSelectedProject(project)}
                    className="text-base font-bold text-white group-hover:text-amber-400 transition-colors cursor-pointer"
                  >
                    {project.name}
                  </h3>
                  <div className="text-xs text-amber-400/90 font-medium">{project.clientName}</div>
                  
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{project.location}</span>
                  </div>

                  <div className="mt-4 space-y-1">
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="text-slate-400">Progress</span>
                      <span className="text-amber-400 font-bold">{project.progressPercentage}%</span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div
                        className="bg-amber-500 h-full rounded-full transition-all"
                        style={{ width: `${project.progressPercentage}%` }}
                      />
                    </div>
                  </div>

                  {project.isPrivateAccounting && !isAdmin ? (
                    <div className="mt-3 bg-rose-950/40 p-2.5 rounded-lg border border-rose-800/70 text-xs text-rose-300 font-mono">
                      Confidential Accounting
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 mt-3 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block">Budget</span>
                        <span className="font-bold text-white">₱{project.budget.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block">Collected</span>
                        <span className="font-bold text-emerald-400">₱{project.fundsCollected.toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span className="font-mono text-[11px]">Due: {project.targetHandoverDate}</span>
                  <button
                    onClick={() => setSelectedProject(project)}
                    className="flex items-center gap-1 text-amber-400 font-medium hover:text-amber-300 transition-colors cursor-pointer text-xs"
                  >
                    View Details <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      
      {/* Detailed Project Profile Modal with Tabs */}
      {selectedProject && !showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[calc(100dvh-1rem)] sm:max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 pb-4 border-b border-slate-800 relative bg-slate-900/90">
              <button
                onClick={() => setSelectedProject(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer z-10"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-8 sm:pr-0">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                      {selectedProject.id}
                    </span>
                    <span className="text-xs text-slate-400">Commercial Fit-Out Profile</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{selectedProject.name}</h2>
                  <p className="text-xs sm:text-sm text-amber-400 font-medium">{selectedProject.clientName}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    selectedProject.status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-300 border-emerald-800' :
                    selectedProject.status === 'PUNCHLIST_QA' ? 'bg-purple-950 text-purple-300 border-purple-800' :
                    'bg-amber-950 text-amber-300 border-amber-800'
                  }`}>
                    {selectedProject.status.replace('_', ' ')}
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => openEditModal(selectedProject)}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold transition cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>
                  )}
                </div>
              </div>

              {/* Sub-meta */}
              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  {selectedProject.location}
                </span>
                <span className="flex items-center gap-1.5 text-amber-300/90 font-mono">
                  <HardHat className="w-3.5 h-3.5 text-amber-400" />
                  <span>PM: {selectedProject.assignedProjectManagerName ? selectedProject.assignedProjectManagerName.split('(')[0].trim() : 'Unassigned'}</span>
                </span>
                <span className="flex items-center gap-1.5 text-slate-400 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Handover: {selectedProject.targetHandoverDate}</span>
                </span>
              </div>

              {/* Logical Tabs Navigation */}
              <div className="flex items-center gap-1 mt-4 border-t border-slate-800/80 pt-3">
                <button
                  type="button"
                  onClick={() => setActiveTabInsideProfile('OVERVIEW')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    activeTabInsideProfile === 'OVERVIEW'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Overview & Milestones</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTabInsideProfile('FINANCIALS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    activeTabInsideProfile === 'FINANCIALS'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Financial Summary</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTabInsideProfile('WORKERS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    activeTabInsideProfile === 'WORKERS'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Assigned Crew ({(selectedProject.assignedContractorIds || []).length})</span>
                </button>
              </div>
            </div>

            {/* Modal Body - Tab Content */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
              {activeTabInsideProfile === 'OVERVIEW' && (
                <div className="space-y-5">
                  {/* Scope & Description */}
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                    <h4 className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-1.5">Fit-Out Scope & Architectural Brief</h4>
                    <p className="text-sm text-slate-300 leading-relaxed">{selectedProject.description || 'No detailed scope description provided.'}</p>
                  </div>

                  {/* Site Progress */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono text-slate-300 font-bold uppercase tracking-wider">Overall Site Progress</span>
                      <span className="text-sm font-bold text-amber-400 font-mono">
                        {calculateProjectProgress(selectedProject.id, tasks, selectedProject.progressPercentage)}% Complete
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
                      <div
                        className="bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 h-full rounded-full transition-all"
                        style={{ width: `${calculateProjectProgress(selectedProject.id, tasks, selectedProject.progressPercentage)}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-0.5 text-xs text-amber-400 font-mono font-medium">
                      <span>⚡ Auto-Synced from Master CPM Gantt & Task Kanban</span>
                    </div>
                  </div>

                  {/* Milestones Roadmap */}
                  <div>
                    <h4 className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-400" />
                      Fit-Out Milestones & Deliverable Gates ({selectedProject.milestonesCount} Phases)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { 
                          title: '1. Demolition & MEP Roughing', 
                          pct: selectedProject.progressPercentage >= 25 ? 100 : Math.min(100, Math.round(selectedProject.progressPercentage * 4)), 
                          done: selectedProject.progressPercentage >= 25 
                        },
                        { 
                          title: '2. Framing & Acoustic Walls', 
                          pct: selectedProject.progressPercentage >= 50 ? 100 : Math.max(0, Math.min(100, Math.round((selectedProject.progressPercentage - 25) * 4))), 
                          done: selectedProject.progressPercentage >= 50 
                        },
                        { 
                          title: '3. Millwork & Finishes', 
                          pct: selectedProject.progressPercentage >= 80 ? 100 : Math.max(0, Math.min(100, Math.round((selectedProject.progressPercentage - 50) * (100 / 30)))), 
                          done: selectedProject.progressPercentage >= 80 
                        },
                        { 
                          title: '4. Testing & QA Punch-List', 
                          pct: selectedProject.progressPercentage >= 100 ? 100 : Math.max(0, Math.min(100, Math.round((selectedProject.progressPercentage - 80) * 5))), 
                          done: selectedProject.progressPercentage >= 100 
                        },
                      ].map((m, idx) => (
                        <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-bold text-white">{m.title}</span>
                              {m.done ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              ) : (
                                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                              )}
                            </div>
                            <div className="w-full bg-slate-900 rounded-full h-1.5 mt-2 overflow-hidden">
                              <div className={`h-full rounded-full ${m.done ? 'bg-emerald-400' : 'bg-amber-400'}`} style={{ width: `${m.pct}%` }} />
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500 mt-2">
                            {m.done ? 'Completed' : `${m.pct}% in progress`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTabInsideProfile === 'FINANCIALS' && (
                <div className="space-y-4">
                  {selectedProject.isPrivateAccounting && !isAdmin ? (
                    <div className="p-5 bg-rose-950/40 border border-rose-800/80 rounded-xl flex items-center gap-3.5">
                      <ShieldCheck className="w-7 h-7 text-rose-400 shrink-0" />
                      <div>
                        <h4 className="text-sm font-bold text-rose-300">Confidential Accounting — Restricted Access</h4>
                        <p className="text-xs text-rose-200/70 mt-0.5 leading-relaxed">
                          Granular contract values, disbursement ledgers, and contractor profit margins for this project are restricted to Operations Directors only.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                          <span className="text-xs text-slate-400 font-mono uppercase">Total Contract Value</span>
                          <div className="text-xl font-bold text-white font-mono mt-1">₱{selectedProject.budget.toLocaleString()}</div>
                          <span className="text-[10px] text-slate-500">Fixed Turnkey BOQ</span>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                          <span className="text-xs text-slate-400 font-mono uppercase">Funds Collected</span>
                          <div className="text-xl font-bold text-emerald-400 font-mono mt-1">₱{selectedProject.fundsCollected.toLocaleString()}</div>
                          <span className="text-[10px] text-emerald-500/80">
                            {selectedProject.budget > 0 ? Math.round((selectedProject.fundsCollected / selectedProject.budget) * 100) : 0}% collected to date
                          </span>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                          <span className="text-xs text-slate-400 font-mono uppercase">Outstanding Balance</span>
                          <div className="text-xl font-bold text-amber-400 font-mono mt-1">
                            ₱{Math.max(0, selectedProject.budget - selectedProject.fundsCollected).toLocaleString()}
                          </div>
                          <span className="text-[10px] text-amber-500/80">Progress billing installment</span>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                          <span className="text-xs text-slate-400 font-mono uppercase">Disbursed (Paid)</span>
                          <div className="text-xl font-bold text-sky-400 font-mono mt-1">
                            ₱{(selectedProject.paidExpenses ?? selectedProject.totalExpenses ?? 0).toLocaleString()}
                          </div>
                          <span className="text-[10px] text-sky-500/80">
                            Labor: ₱{(selectedProject.paidLaborExpenses ?? selectedProject.laborExpenses ?? 0).toLocaleString()} | AP: ₱{(selectedProject.paidSubcontractorExpenses ?? selectedProject.subcontractorExpenses ?? 0).toLocaleString()}
                          </span>
                          {(selectedProject.approvedExpenses ?? 0) > 0 && (
                            <span className="text-[10px] text-amber-400/80 block mt-0.5 font-mono">
                              Approved/Pending: ₱{selectedProject.approvedExpenses?.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTabInsideProfile === 'WORKERS' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                      Assigned Project Roster ({(selectedProject.assignedContractorIds || []).length})
                    </span>
                  </div>

                  {(selectedProject.assignedContractorIds || []).length === 0 ? (
                    <div className="text-center py-6 bg-slate-950/60 border border-dashed border-slate-800 rounded-xl">
                      <Users className="w-7 h-7 text-slate-600 mx-auto mb-1.5" />
                      <p className="text-xs text-slate-500">No personnel currently assigned to this project site.</p>
                      <p className="text-[11px] text-slate-600 mt-0.5">Use the search box below to allocate crew members.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {contractors
                        .filter(c => (selectedProject.assignedContractorIds || []).includes(c.id))
                        .map(c => {
                          const initials = c.name.split(' ').map(n => n[0]).filter(Boolean).slice(0,2).join('').toUpperCase();
                          return (
                            <div key={c.id} className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex items-center gap-2.5">
                              {c.avatar ? (
                                <img src={c.avatar} alt={c.name} className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-purple-400 font-bold text-xs shrink-0">
                                  {initials}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-white truncate">{c.name}</div>
                                <div className="text-[10px] text-amber-400 truncate">{c.specialty || c.roleTitle}</div>
                              </div>
                              <button
                                onClick={async () => {
                                  setIsAssigningWorker(true);
                                  try {
                                    const res = await fetch(`/api/projects/${selectedProject.id}/workers`, {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ workerId: c.id, action: 'remove' })
                                    });
                                    if (res.ok) {
                                      const data = await res.json();
                                      const updated = { ...selectedProject, assignedContractorIds: data.assignedContractorIds, assignedWorkersCount: data.assignedWorkersCount };
                                      setSelectedProject(updated);
                                      setLocalProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
                                    }
                                  } finally { setIsAssigningWorker(false); }
                                }}
                                className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer shrink-0"
                                title="Remove from project"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {/* Add Worker Search */}
                  <div className="border border-slate-800 rounded-xl p-3 bg-slate-950/60">
                    <p className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider mb-2">+ Add Personnel from Roster</p>
                    <input
                      type="text"
                      value={workerSearchQuery}
                      onChange={e => setWorkerSearchQuery(e.target.value)}
                      placeholder="Search roster by name, role, or trade..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 mb-2"
                    />
                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                      {contractors
                        .filter(c => !(selectedProject.assignedContractorIds || []).includes(c.id))
                        .filter(c => {
                          if (!workerSearchQuery.trim()) return true;
                          const q = workerSearchQuery.toLowerCase();
                          return c.name.toLowerCase().includes(q) || (c.specialty || '').toLowerCase().includes(q) || (c.roleTitle || '').toLowerCase().includes(q);
                        })
                        .map(c => {
                          const initials = c.name.split(' ').map(n => n[0]).filter(Boolean).slice(0,2).join('').toUpperCase();
                          return (
                            <div key={c.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-800/60 transition group">
                              {c.avatar ? (
                                <img src={c.avatar} alt={c.name} className="w-6 h-6 rounded-full object-cover border border-slate-700 shrink-0" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-purple-300 font-bold text-[9px] shrink-0">
                                  {initials}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-white truncate">{c.name}</div>
                                <div className="text-[10px] text-slate-400 truncate">{c.specialty || c.roleTitle}</div>
                              </div>
                              <button
                                disabled={isAssigningWorker}
                                onClick={async () => {
                                  setIsAssigningWorker(true);
                                  try {
                                    const res = await fetch(`/api/projects/${selectedProject.id}/workers`, {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ workerId: c.id, action: 'add' })
                                    });
                                    if (res.ok) {
                                      const data = await res.json();
                                      const updated = { ...selectedProject, assignedContractorIds: data.assignedContractorIds, assignedWorkersCount: data.assignedWorkersCount };
                                      setSelectedProject(updated);
                                      setLocalProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
                                      setWorkerSearchQuery('');
                                    }
                                  } finally { setIsAssigningWorker(false); }
                                }}
                                className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded hover:bg-amber-500/30 transition cursor-pointer shrink-0 disabled:opacity-50"
                              >
                                + Assign
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3">
              {isAdmin && (
                <button
                  onClick={() => handleDelete(selectedProject.id)}
                  className="px-3 py-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 text-xs font-medium transition cursor-pointer"
                >
                  Delete Project
                </button>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => setSelectedProject(null)}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Project Modal with Tabs */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 relative bg-slate-900">
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer z-10"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-400" />
                <h3 className="text-base sm:text-lg font-bold text-white">Create Commercial Project Profile</h3>
              </div>

              {/* Form Tabs */}
              <div className="flex items-center gap-1 mt-3 border-t border-slate-800/80 pt-2.5">
                <button
                  type="button"
                  onClick={() => setModalTab('general')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    modalTab === 'general' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  1. General & Location
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('timeline')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    modalTab === 'timeline' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  2. Budget & Timeline
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('personnel')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    modalTab === 'personnel' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  3. Leadership & Crew ({formAssignedWorkerIds.length})
                </button>
              </div>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto flex flex-col">
              <div className="p-4 sm:p-6 space-y-4 flex-1">
                {isTimelineInvalid && (
                  <div className="flex items-center gap-2 p-3 bg-red-950/80 border border-red-500/60 rounded-xl text-red-300 text-xs font-semibold">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>Validation Alert: Target Handover Date cannot precede Start Date.</span>
                  </div>
                )}

                {modalTab === 'general' && (
                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Project Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., NexBridge Software Hub Phase 2"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Client / Corporate Account</label>
                      <input
                        type="text"
                        placeholder="e.g., Summit Holdings Philippines"
                        value={formClient}
                        onChange={(e) => setFormClient(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-mono text-slate-400 uppercase">Site Location / Address</label>
                        <span className="text-[10px] text-amber-400 font-mono flex items-center gap-1">
                          <CloudSun className="w-3 h-3" /> Live Weather Sync
                        </span>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g., Cabuyao, Laguna (or BGC, Makati, Cebu, Clark)"
                        value={formLocation}
                        onChange={(e) => setFormLocation(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                      />
                      {formLocation.trim() && (
                        <div className={`mt-2 p-2 rounded-lg border text-xs flex items-center justify-between ${
                          detectedCoords ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}>
                          <div className="flex items-center gap-2 truncate">
                            <MapPin className={`w-3.5 h-3.5 shrink-0 ${detectedCoords ? 'text-emerald-400' : 'text-slate-500'}`} />
                            <span className="truncate">
                              {detectedCoords ? (
                                <>Weather Station: <strong className="text-white">{detectedCoords.name}</strong> ({detectedCoords.lat.toFixed(3)}°N, {detectedCoords.lon.toFixed(3)}°E)</>
                              ) : (
                                'Resolving weather station telemetry...'
                              )}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Scope & Description</label>
                      <textarea
                        rows={3}
                        placeholder="e.g., Turnkey architectural fit-out, MEP roughing, HVAC, glass partitions."
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {modalTab === 'timeline' && (
                  <div className="space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Contract Budget (PHP)</label>
                        <input
                          type="number"
                          value={formBudget}
                          onChange={(e) => setFormBudget(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Initial Progress %</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={formProgress}
                          onChange={(e) => setFormProgress(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Project Status</label>
                        <select
                          value={formStatus}
                          onChange={(e) => setFormStatus(e.target.value as any)}
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                        >
                          <option value="PLANNING">Planning Phase</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="PUNCHLIST_QA">Punchlist & QA</option>
                          <option value="HANDED_OVER">Handed Over</option>
                          <option value="COMPLETED">Completed</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Deliverable Milestones</label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={formMilestonesCount}
                          onChange={(e) => setFormMilestonesCount(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Start Date</label>
                        <input
                          type="date"
                          value={formStartDate}
                          onChange={(e) => setFormStartDate(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Target Handover Date</label>
                        <input
                          type="date"
                          value={formEndDate}
                          onChange={(e) => setFormEndDate(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {modalTab === 'personnel' && (
                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Lead Project Manager</label>
                      <select
                        value={formPMId}
                        onChange={(e) => {
                          setFormPMId(e.target.value);
                          const pm = availablePMs.find(p => p.id === e.target.value);
                          setFormPMName(pm ? pm.name : '');
                        }}
                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                      >
                        <option value="">Select Project Lead...</option>
                        {availablePMs.map(pm => (
                          <option key={pm.id} value={pm.id}>{pm.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2 p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                      <input
                        type="checkbox"
                        id="new-private-accounting"
                        checked={formIsPrivateAccounting}
                        onChange={(e) => setFormIsPrivateAccounting(e.target.checked)}
                        className="w-4 h-4 rounded text-amber-500 focus:ring-0 bg-slate-900 border-slate-700 cursor-pointer"
                      />
                      <label htmlFor="new-private-accounting" className="text-xs text-slate-300 cursor-pointer select-none">
                        Confidential Accounting (Restricted to Operations Directors)
                      </label>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-mono text-slate-400 uppercase">
                          Assign Personnel ({formAssignedWorkerIds.length} Selected)
                        </label>
                      </div>
                      <input
                        type="text"
                        placeholder="Filter available contractors..."
                        value={modalWorkerSearchQuery}
                        onChange={(e) => setModalWorkerSearchQuery(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none mb-2"
                      />
                      <div className="max-h-40 overflow-y-auto space-y-1 pr-1 border border-slate-800 rounded-lg p-2 bg-slate-950/60">
                        {contractors
                          .filter(w => {
                            if (!modalWorkerSearchQuery.trim()) return true;
                            const q = modalWorkerSearchQuery.toLowerCase();
                            return w.name.toLowerCase().includes(q) || (w.tradeType || '').toLowerCase().includes(q);
                          })
                          .map(worker => {
                            const isSelected = formAssignedWorkerIds.includes(worker.id);
                            return (
                              <div
                                key={worker.id}
                                onClick={() => {
                                  if (isSelected) {
                                    setFormAssignedWorkerIds(prev => prev.filter(id => id !== worker.id));
                                  } else {
                                    setFormAssignedWorkerIds(prev => [...prev, worker.id]);
                                  }
                                }}
                                className={`p-1.5 rounded flex items-center justify-between text-xs cursor-pointer transition ${
                                  isSelected ? 'bg-amber-500/10 border border-amber-500/30 text-white' : 'hover:bg-slate-800 text-slate-300'
                                }`}
                              >
                                <span className="truncate">{worker.name} ({worker.tradeType || 'General'})</span>
                                <div className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] ${
                                  isSelected ? 'bg-amber-500 border-amber-500 text-slate-950' : 'border-slate-700'
                                }`}>
                                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Pinned Sticky Footer - Always Visible */}
              <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isTimelineInvalid || !formName.trim()}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-xs transition cursor-pointer"
                >
                  Save Project Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Project Modal with Tabs */}
      {showEditModal && selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 relative bg-slate-900">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer z-10"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                <h3 className="text-base sm:text-lg font-bold text-white">Edit Profile: {selectedProject.name}</h3>
              </div>

              {/* Form Tabs */}
              <div className="flex items-center gap-1 mt-3 border-t border-slate-800/80 pt-2.5">
                <button
                  type="button"
                  onClick={() => setModalTab('general')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    modalTab === 'general' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  1. General & Location
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('timeline')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    modalTab === 'timeline' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  2. Budget & Timeline
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('personnel')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    modalTab === 'personnel' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  3. Leadership & Crew ({formAssignedWorkerIds.length})
                </button>
              </div>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto flex flex-col">
              <div className="p-4 sm:p-6 space-y-4 flex-1">
                {isTimelineInvalid && (
                  <div className="flex items-center gap-2 p-3 bg-red-950/80 border border-red-500/60 rounded-xl text-red-300 text-xs font-semibold">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>Validation Alert: Target Handover Date cannot precede Start Date.</span>
                  </div>
                )}

                {modalTab === 'general' && (
                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Project Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., NexBridge Software Hub Phase 2"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Client / Corporate Account</label>
                      <input
                        type="text"
                        placeholder="e.g., Summit Holdings Philippines"
                        value={formClient}
                        onChange={(e) => setFormClient(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-mono text-slate-400 uppercase">Site Location</label>
                        <span className="text-[10px] text-amber-400 font-mono flex items-center gap-1">
                          <CloudSun className="w-3 h-3" /> Live Weather Sync
                        </span>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g., Cabuyao Technopark, Laguna"
                        value={formLocation}
                        onChange={(e) => setFormLocation(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                      />
                      {formLocation.trim() && (
                        <div className={`mt-2 p-2 rounded-lg border text-xs flex items-center justify-between ${
                          detectedCoords ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}>
                          <div className="flex items-center gap-2 truncate">
                            <MapPin className={`w-3.5 h-3.5 shrink-0 ${detectedCoords ? 'text-emerald-400' : 'text-slate-500'}`} />
                            <span className="truncate">
                              {detectedCoords ? (
                                <>Weather Station: <strong className="text-white">{detectedCoords.name}</strong> ({detectedCoords.lat.toFixed(3)}°N, {detectedCoords.lon.toFixed(3)}°E)</>
                              ) : (
                                'Resolving weather station telemetry...'
                              )}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Scope & Description</label>
                      <textarea
                        rows={3}
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {modalTab === 'timeline' && (
                  <div className="space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Contract Budget (PHP)</label>
                        <input
                          type="number"
                          value={formBudget}
                          onChange={(e) => setFormBudget(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Funds Collected (PHP)</label>
                        <input
                          type="number"
                          value={formCollected}
                          onChange={(e) => setFormCollected(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Project Status</label>
                        <select
                          value={formStatus}
                          onChange={(e) => setFormStatus(e.target.value as any)}
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                        >
                          <option value="PLANNING">Planning Phase</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="PUNCHLIST_QA">Punchlist & QA</option>
                          <option value="HANDED_OVER">Handed Over</option>
                          <option value="COMPLETED">Completed</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Progress %</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={formProgress}
                          onChange={(e) => setFormProgress(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Start Date</label>
                        <input
                          type="date"
                          value={formStartDate}
                          onChange={(e) => setFormStartDate(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Target Handover Date</label>
                        <input
                          type="date"
                          value={formEndDate}
                          onChange={(e) => setFormEndDate(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {modalTab === 'personnel' && (
                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Lead Project Manager</label>
                      <select
                        value={formPMId}
                        onChange={(e) => {
                          setFormPMId(e.target.value);
                          const pm = availablePMs.find(p => p.id === e.target.value);
                          setFormPMName(pm ? pm.name : '');
                        }}
                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                      >
                        <option value="">Select Project Lead...</option>
                        {availablePMs.map(pm => (
                          <option key={pm.id} value={pm.id}>{pm.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2 p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                      <input
                        type="checkbox"
                        id="edit-private-accounting"
                        checked={formIsPrivateAccounting}
                        onChange={(e) => setFormIsPrivateAccounting(e.target.checked)}
                        className="w-4 h-4 rounded text-amber-500 focus:ring-0 bg-slate-900 border-slate-700 cursor-pointer"
                      />
                      <label htmlFor="edit-private-accounting" className="text-xs text-slate-300 cursor-pointer select-none">
                        Confidential Accounting (Restricted to Operations Directors)
                      </label>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-mono text-slate-400 uppercase">
                          Assign Personnel ({formAssignedWorkerIds.length} Selected)
                        </label>
                      </div>
                      <input
                        type="text"
                        placeholder="Filter available contractors..."
                        value={modalWorkerSearchQuery}
                        onChange={(e) => setModalWorkerSearchQuery(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none mb-2"
                      />
                      <div className="max-h-40 overflow-y-auto space-y-1 pr-1 border border-slate-800 rounded-lg p-2 bg-slate-950/60">
                        {contractors
                          .filter(w => {
                            if (!modalWorkerSearchQuery.trim()) return true;
                            const q = modalWorkerSearchQuery.toLowerCase();
                            return w.name.toLowerCase().includes(q) || (w.tradeType || '').toLowerCase().includes(q);
                          })
                          .map(worker => {
                            const isSelected = formAssignedWorkerIds.includes(worker.id);
                            return (
                              <div
                                key={worker.id}
                                onClick={() => {
                                  if (isSelected) {
                                    setFormAssignedWorkerIds(prev => prev.filter(id => id !== worker.id));
                                  } else {
                                    setFormAssignedWorkerIds(prev => [...prev, worker.id]);
                                  }
                                }}
                                className={`p-1.5 rounded flex items-center justify-between text-xs cursor-pointer transition ${
                                  isSelected ? 'bg-amber-500/10 border border-amber-500/30 text-white' : 'hover:bg-slate-800 text-slate-300'
                                }`}
                              >
                                <span className="truncate">{worker.name} ({worker.tradeType || 'General'})</span>
                                <div className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] ${
                                  isSelected ? 'bg-amber-500 border-amber-500 text-slate-950' : 'border-slate-700'
                                }`}>
                                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Pinned Sticky Footer - Always Visible */}
              <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isTimelineInvalid || !formName.trim()}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-xs transition cursor-pointer"
                >
                  Update Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Workforce Reallocation Modal */}
      {showReallocationModal && activeReallocProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[90dvh] overflow-y-auto shadow-2xl p-4 sm:p-6 relative my-auto">
            <button
              onClick={() => setShowReallocationModal(false)}
              className="absolute top-3 right-3 sm:top-5 sm:right-5 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-indigo-400" />
              <h3 className="text-lg font-bold text-white">Cross-Project Workforce Reallocation</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Project <strong className="text-white">"{activeReallocProject.name}"</strong> is at {activeReallocProject.progressPercentage}% completion. 
              The dynamic labor allocation engine has detected surplus workers and generated target reassignments.
            </p>

            {reallocFeedback && (
              <div className="mb-4 p-3 bg-indigo-950/80 border border-indigo-700 rounded-xl text-xs font-semibold text-indigo-300 flex items-center justify-between">
                <span>{reallocFeedback}</span>
                <button onClick={() => setReallocFeedback(null)} className="text-slate-400 hover:text-white font-bold ml-2 cursor-pointer">✕</button>
              </div>
            )}

            <div className="space-y-3">
              {reallocRecommendations.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs italic">
                  No surplus reallocation recommendations found for this project.
                </div>
              ) : (
                reallocRecommendations.map(rec => (
                  <div 
                    key={rec.id}
                    className="bg-slate-950/80 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-4 transition space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-950 border border-indigo-700 text-indigo-300 flex items-center justify-center font-bold text-xs">
                          {rec.workerName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">{rec.workerName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{rec.roleTitle}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                          rec.workforceCategory === 'PROFESSIONAL' ? 'bg-purple-950 text-purple-300 border-purple-700' :
                          rec.workforceCategory === 'SKILLED' ? 'bg-amber-950 text-amber-300 border-amber-700' :
                          'bg-cyan-950 text-cyan-300 border-cyan-700'
                        }`}>
                          {rec.workforceCategory}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          rec.priority === 'HIGH' ? 'bg-rose-950 text-rose-300 border border-rose-700' : 'bg-slate-800 text-slate-300'
                        }`}>
                          {rec.priority} PRIORITY
                        </span>
                      </div>
                    </div>

                    {/* Transfer Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                      <div>
                        <span className="text-[10px] font-mono text-slate-500 uppercase block">From Project</span>
                        <span className="font-semibold text-slate-300 truncate block">{rec.originProjectName} ({rec.originProgress}%)</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-slate-500 uppercase block">Target Recipient</span>
                        <span className="font-semibold text-amber-300 truncate block">{rec.targetProjectName} ({rec.targetProgress}%)</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 italic">
                      "{rec.rationale}"
                    </p>

                    <div className="flex justify-end pt-1">
                      {rec.applied ? (
                        <span className="px-3 py-1 bg-emerald-950 text-emerald-300 border border-emerald-700 text-xs font-bold rounded-lg flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Reassigned
                        </span>
                      ) : (
                        <button
                          onClick={() => handleExecuteReallocation(rec)}
                          disabled={isReallocating}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <span>Execute Transfer</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowReallocationModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

