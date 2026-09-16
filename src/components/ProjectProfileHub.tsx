/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Building2, Users, CheckCircle2, TrendingUp, DollarSign, Calendar, 
  Layers, Plus, ExternalLink, ShieldCheck, Clock, FileText, ArrowRight, 
  X, AlertCircle, Edit3, Trash2, Check, Sliders, HardHat, Search
} from 'lucide-react';
import { ProjectProfile, ProjectTask, Contractor, WorkforceReallocationRecommendation } from '../types';
import { generateReallocationRecommendations } from '../services/WorkforceReallocationService';

export const AVAILABLE_PMS = [
  { id: 'usr-pm-ricardo', name: 'Engr. Ricardo Ramos (Senior Project Manager)' },
  { id: 'usr-pm-carlos', name: 'Engr. Carlos Mendoza (Civil & Site Operations Lead)' },
  { id: 'usr-pm-maria', name: 'Engr. Maria Santos (Fit-Out QA & Finishes Lead)' },
];

interface ProjectProfileHubProps {
  projects: ProjectProfile[];
  tasks: ProjectTask[];
  contractors: Contractor[];
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

  const [selectedProject, setSelectedProject] = useState<ProjectProfile | null>(projects[0] || null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [activeTabInsideProfile, setActiveTabInsideProfile] = useState<'OVERVIEW' | 'TASKS' | 'MILESTONES' | 'WORKERS'>('OVERVIEW');

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
  const [formStatus, setFormStatus] = useState<ProjectProfile['status']>('PLANNING');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [formEndDate, setFormEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [formWorkers, setFormWorkers] = useState(0);
  const [formTasksCount, setFormTasksCount] = useState(0);
  const [formMilestonesCount, setFormMilestonesCount] = useState(0);
  const [formIsPrivateAccounting, setFormIsPrivateAccounting] = useState<boolean>(false);
  const [formPMId, setFormPMId] = useState<string>('');
  const [formPMName, setFormPMName] = useState<string>('');
  const [availablePMs, setAvailablePMs] = useState<{ id: string; name: string }[]>(AVAILABLE_PMS);

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

  const filteredProjects = localProjects.filter(p => {
    if (filterStatus === 'ALL') return true;
    return p.status === filterStatus;
  });

  const totalPortfolioBudget = localProjects.reduce((acc, p) => acc + p.budget, 0);
  const totalFundsCollected = localProjects.reduce((acc, p) => acc + p.fundsCollected, 0);
  const avgPortfolioProgress = Math.round(
    localProjects.reduce((acc, p) => acc + p.progressPercentage, 0) / (localProjects.length || 1)
  );
  const totalSiteManpower = localProjects.reduce((acc, p) => acc + (p.assignedWorkersCount || 0), 0);

  const openNewModal = () => {
    // Reset all dummy/pre-filled defaults strictly to 0 or empty strings
    setFormName('');
    setFormClient('');
    setFormDescription('');
    setFormLocation('');
    setFormBudget(0);
    setFormCollected(0);
    setFormProgress(0);
    setFormStatus('PLANNING');
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
    setShowNewModal(true);
  };

  const openEditModal = (p: ProjectProfile) => {
    setFormName(p.name);
    setFormClient(p.clientName);
    setFormDescription(p.description);
    setFormLocation(p.location);
    setFormBudget(p.budget);
    setFormCollected(p.fundsCollected);
    setFormProgress(p.progressPercentage);
    setFormStatus(p.status);
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

    const newProj: ProjectProfile = {
      id: `PRJ-${Date.now().toString().slice(-4)}`,
      name: formName.trim(),
      clientName: formClient.trim(),
      description: formDescription.trim(),
      location: formLocation.trim(),
      budget: Number(formBudget) || 0,
      fundsCollected: Number(formCollected) || 0,
      progressPercentage: Number(formProgress) || 0,
      status: formStatus,
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

    const updated: ProjectProfile = {
      ...selectedProject,
      name: formName.trim(),
      clientName: formClient.trim(),
      description: formDescription.trim(),
      location: formLocation.trim(),
      budget: Number(formBudget),
      fundsCollected: Number(formCollected),
      progressPercentage: Number(formProgress),
      status: formStatus,
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
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-6 rounded-2xl backdrop-blur-xl shadow-2xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold tracking-wider uppercase">
              Operational Command Hub
            </span>
            <span className="text-xs text-slate-400">Enterprise Fit-Out Portfolio</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Building2 className="w-7 h-7 text-amber-400" />
            Projects Profile Hub
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Central hub for project-specific tracking: budget vs. collected funds, live progress %, assigned workers, tasks, and milestones.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">All Project Statuses</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="PUNCHLIST_QA">Punchlist & QA</option>
            <option value="PLANNING">Planning Phase</option>
            <option value="HANDED_OVER">Handed Over</option>
          </select>

          <button
            onClick={openNewModal}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl transition shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Project Profile
          </button>
        </div>
      </div>

      {/* Portfolio Overview KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Total Contract Value</span>
            <DollarSign className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2 font-mono">
            ₱{totalPortfolioBudget.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Across {localProjects.length} active fit-out sites
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Funds Collected</span>
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2 font-mono">
            ₱{totalFundsCollected.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {totalPortfolioBudget > 0 ? Math.round((totalFundsCollected / totalPortfolioBudget) * 100) : 0}% portfolio collection rate
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Average Progress</span>
            <CheckCircle2 className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-400 mt-2 font-mono">
            {avgPortfolioProgress}%
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
            <div className="bg-blue-500 h-full rounded-full" style={{ width: `${avgPortfolioProgress}%` }} />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Total Deployed Workers</span>
            <Users className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2 font-mono">
            {totalSiteManpower} Artisans
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Carpenters, Electricians, HVAC & QA
          </div>
        </div>
      </div>

      {/* Projects Grid or Empty State */}
      {filteredProjects.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white mb-1">No Projects Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
            There are currently no projects matching your filter in the database. Create a new commercial project profile to get started.
          </p>
          <button
            onClick={openNewModal}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-2 cursor-pointer transition shadow-lg shadow-amber-500/10"
          >
            <Plus className="w-4 h-4" />
            Create Project Profile
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredProjects.map((project) => {
          const collectionRate = project.budget > 0 ? Math.round((project.fundsCollected / project.budget) * 100) : 0;
          const remainingFunds = Math.max(0, project.budget - project.fundsCollected);

          return (
            <div
              key={project.id}
              className="group bg-slate-900/70 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-6 transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/5 relative overflow-hidden flex flex-col justify-between"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-bl-full pointer-events-none group-hover:bg-amber-500/10 transition" />

              <div>
                {/* Status Badge & Code & Quick Actions */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
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
                    {project.isPrivateAccounting && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800 font-semibold flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-rose-400" />
                        <span>Private</span>
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
                  </div>
                </div>

                {/* Project Title & Client */}
                <h3 
                  onClick={() => setSelectedProject(project)}
                  className="text-xl font-bold text-white group-hover:text-amber-300 transition cursor-pointer"
                >
                  {project.name}
                </h3>
                <p className="text-xs text-amber-400 font-medium mt-0.5">
                  {project.clientName}
                </p>

                {/* Description */}
                <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                  {project.description}
                </p>

                {/* Location */}
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span className="truncate">{project.location}</span>
                </div>

                {/* Progress Bar with Quick Interactive Slider */}
                <div className="mt-5 space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-slate-400">Execution Progress</span>
                    <span className="text-amber-400 font-bold">{project.progressPercentage}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800 relative">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-amber-400 h-full rounded-full transition-all duration-300"
                      style={{ width: `${project.progressPercentage}%` }}
                    />
                  </div>
                  {/* Interactive Quick Slider */}
                  <div className="flex items-center gap-2 pt-1">
                    <Sliders className="w-3 h-3 text-slate-500" />
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={project.progressPercentage}
                      onChange={(e) => handleQuickProgressUpdate(project.id, Number(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>
                </div>

                {/* Assigned Project Manager Badge */}
                <div className="flex items-center gap-1.5 mt-3 text-xs text-amber-300 font-mono">
                  <HardHat className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">{project.assignedProjectManagerName || 'PM: Unassigned'}</span>
                </div>

                {/* Financial Health Split */}
                {project.isPrivateAccounting && !isAdmin ? (
                  <div className="mt-4 bg-rose-950/40 p-3 rounded-xl border border-rose-800/70 flex items-center gap-2.5 text-xs text-rose-300 font-mono">
                    <ShieldCheck className="w-4 h-4 text-rose-400 shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-bold text-[11px]">Confidential Accounting</span>
                      <span className="text-[10px] text-rose-400/80">Restricted Access — Admin Authorization Required</span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 mt-4 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Contract Budget</span>
                      <span className="text-sm font-bold text-white font-mono">₱{project.budget.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Funds Collected</span>
                      <span className="text-sm font-bold text-emerald-400 font-mono">₱{project.fundsCollected.toLocaleString()} ({collectionRate}%)</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Card Footer Metrics */}
              <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-3 font-mono">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-purple-400" />
                    {project.assignedWorkersCount} Workers
                  </span>
                  <span className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    {project.tasksCount} Tasks
                  </span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    {project.milestonesCount} Milestones
                  </span>
                </div>

                <button
                  onClick={() => setSelectedProject(project)}
                  className="flex items-center gap-1 text-amber-400 font-medium hover:translate-x-1 transition-transform cursor-pointer"
                >
                  View Profile <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Detailed Project Profile Modal */}
      {selectedProject && !showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 relative">
            <button
              onClick={() => setSelectedProject(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Profile Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                    {selectedProject.id}
                  </span>
                  <span className="text-xs text-slate-400">Commercial Fit-Out Profile</span>
                </div>
                <h2 className="text-2xl font-bold text-white">{selectedProject.name}</h2>
                <p className="text-sm text-amber-400 font-medium">{selectedProject.clientName}</p>
                <div className="flex flex-wrap items-center gap-4 mt-1.5 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    {selectedProject.location}
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-300/90 font-mono">
                    <HardHat className="w-3.5 h-3.5 text-amber-400" />
                    <span>Lead PM: {selectedProject.assignedProjectManagerName || 'Unassigned'}</span>
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(selectedProject)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold transition"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit Profile
                  </button>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    selectedProject.status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-300 border-emerald-800' :
                    selectedProject.status === 'PUNCHLIST_QA' ? 'bg-purple-950 text-purple-300 border-purple-800' :
                    'bg-amber-950 text-amber-300 border-amber-800'
                  }`}>
                    {selectedProject.status.replace('_', ' ')}
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  Target Handover: {selectedProject.targetHandoverDate}
                </span>
              </div>
            </div>

            {/* Scope & Description */}
            <div className="mt-6 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <h4 className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-1.5">Fit-Out Scope & Architectural Brief</h4>
              <p className="text-sm text-slate-300 leading-relaxed">{selectedProject.description}</p>
            </div>

            {/* Financial Status Breakdown */}
            {selectedProject.isPrivateAccounting && !isAdmin ? (
              <div className="mt-6 p-5 bg-rose-950/40 border border-rose-800/80 rounded-xl flex items-center gap-3.5">
                <ShieldCheck className="w-7 h-7 text-rose-400 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-rose-300">Confidential Accounting — Restricted Access</h4>
                  <p className="text-xs text-rose-200/70 mt-0.5 leading-relaxed">
                    Granular contract values, disbursement ledgers, and contractor profit margins for this project are restricted to Operations Directors only.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-6">
                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  Financial Transparency & Installment Billing
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                    <span className="text-[10px] text-amber-500/80">Progress billing installment schedule</span>
                  </div>
                </div>
              </div>
            )}

            {/* Execution Progress Bar + Live Interactive Slider */}
            <div className="mt-6 bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono text-slate-300 font-bold uppercase tracking-wider">Overall Site Progress</span>
                <span className="text-sm font-bold text-amber-400 font-mono">{selectedProject.progressPercentage}% Complete</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 h-full rounded-full transition-all"
                  style={{ width: `${selectedProject.progressPercentage}%` }}
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <span className="text-xs text-slate-400 font-mono">Adjust Progress:</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={selectedProject.progressPercentage}
                  onChange={(e) => handleQuickProgressUpdate(selectedProject.id, Number(e.target.value))}
                  className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <span className="text-xs font-mono text-amber-400 font-bold w-12 text-right">
                  {selectedProject.progressPercentage}%
                </span>
              </div>
            </div>

            {/* Milestones Roadmap */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  Fit-Out Milestones & Deliverable Gates ({selectedProject.milestonesCount} Phases)
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { title: '1. Demolition & MEP Roughing', pct: 100, done: true },
                  { title: '2. Framing & Acoustic Walls', pct: selectedProject.progressPercentage >= 60 ? 100 : selectedProject.progressPercentage, done: selectedProject.progressPercentage >= 60 },
                  { title: '3. Millwork & Finishes', pct: selectedProject.progressPercentage >= 85 ? 100 : Math.max(0, (selectedProject.progressPercentage - 50) * 2), done: selectedProject.progressPercentage >= 85 },
                  { title: '4. Testing & QA Punch-List', pct: selectedProject.progressPercentage >= 95 ? 100 : 0, done: selectedProject.progressPercentage >= 95 },
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

            {/* Interactive Assigned Workforce Panel */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-400" />
                  Assigned Workers
                  <span className="text-xs font-mono bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded-full">
                    {(selectedProject.assignedContractorIds || []).length} assigned
                  </span>
                </h4>
              </div>

              {/* Currently assigned workers */}
              {(selectedProject.assignedContractorIds || []).length === 0 ? (
                <div className="text-center py-8 bg-slate-950/60 border border-dashed border-slate-700 rounded-xl">
                  <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No workers assigned yet.</p>
                  <p className="text-xs text-slate-600 mt-1">Use the search below to add team members.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                  {contractors
                    .filter(c => (selectedProject.assignedContractorIds || []).includes(c.id))
                    .map(c => {
                      const initials = c.name.split(' ').map(n => n[0]).filter(Boolean).slice(0,2).join('').toUpperCase();
                      return (
                        <div key={c.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
                          {c.avatar ? (
                            <img src={c.avatar} alt={c.name} className="w-9 h-9 rounded-full object-cover border border-slate-700 shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-purple-400 font-bold text-xs shrink-0">
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
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer shrink-0"
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
              <div className="border border-dashed border-slate-700 rounded-xl p-3 bg-slate-950/40">
                <p className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider mb-2">+ Add Worker from Roster</p>
                <input
                  type="text"
                  value={workerSearchQuery}
                  onChange={e => setWorkerSearchQuery(e.target.value)}
                  placeholder="Search by name, role, or specialty..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 mb-2"
                />
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
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
                        <div key={c.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-800/60 transition group">
                          {c.avatar ? (
                            <img src={c.avatar} alt={c.name} className="w-7 h-7 rounded-full object-cover border border-slate-700 shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-purple-300 font-bold text-[10px] shrink-0">
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
                            className="px-2.5 py-1 text-[10px] font-bold bg-purple-950/80 text-purple-400 border border-purple-800/60 rounded-lg hover:bg-purple-900/60 transition opacity-0 group-hover:opacity-100 cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            + Assign
                          </button>
                        </div>
                      );
                    })}
                  {contractors.filter(c => !(selectedProject.assignedContractorIds || []).includes(c.id)).filter(c => {
                    if (!workerSearchQuery.trim()) return true;
                    const q = workerSearchQuery.toLowerCase();
                    return c.name.toLowerCase().includes(q) || (c.specialty || '').toLowerCase().includes(q) || (c.roleTitle || '').toLowerCase().includes(q);
                  }).length === 0 && (
                    <p className="text-center text-xs text-slate-600 py-3">
                      {workerSearchQuery ? 'No workers match your search.' : 'All registered workers are already assigned.'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Close / Action Footer */}
            <div className="mt-8 pt-4 border-t border-slate-800 flex justify-between items-center">
              <button
                onClick={() => handleDelete(selectedProject.id)}
                className="px-4 py-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 text-xs font-medium transition"
              >
                Delete Project
              </button>

              <div className="flex gap-3">
                <button
                  onClick={() => openEditModal(selectedProject)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition"
                >
                  Edit Parameters
                </button>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Project Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
            <button
              onClick={() => setShowNewModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-bold text-white">Create Commercial Project Profile</h3>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {isTimelineInvalid && (
                <div className="flex items-center gap-2 p-3 bg-red-950/80 border border-red-500/60 rounded-xl text-red-300 text-xs font-semibold animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>Validation Alert: Target Handover Date cannot be earlier than Project Start Date.</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., NexBridge Software Hub Phase 2"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Client / Corporate Account</label>
                <input
                  type="text"
                  placeholder="e.g., Summit Holdings Philippines"
                  value={formClient}
                  onChange={(e) => setFormClient(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Site Location / Address</label>
                <input
                  type="text"
                  placeholder="e.g., Cabuyao Technopark, Laguna"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Total Estimated Budget (₱)</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="e.g., 15,000,000"
                    value={formBudget || ''}
                    onChange={(e) => setFormBudget(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:border-amber-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Funds Collected (₱)</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="e.g., 0"
                    value={formCollected || ''}
                    onChange={(e) => setFormCollected(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:border-amber-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Progress (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={formProgress}
                    onChange={(e) => setFormProgress(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:border-amber-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-mono text-slate-400 uppercase">Assigned Workers</label>
                    {formAssignedWorkerIds.length > 0 && (
                      <span className="text-[10px] text-amber-400 font-mono font-bold flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" /> Auto-synced
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min={0}
                    placeholder="e.g., 0"
                    value={formAssignedWorkerIds.length > 0 ? formAssignedWorkerIds.length : (formWorkers || '')}
                    onChange={(e) => setFormWorkers(Number(e.target.value))}
                    disabled={formAssignedWorkerIds.length > 0}
                    className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-sm font-mono focus:outline-none transition ${
                      formAssignedWorkerIds.length > 0
                        ? 'border-amber-500/50 bg-amber-500/10 text-amber-300 cursor-not-allowed font-bold'
                        : 'border-slate-700 text-white focus:border-amber-500'
                    }`}
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    {formAssignedWorkerIds.length > 0
                      ? `Locked to ${formAssignedWorkerIds.length} registered artisan${formAssignedWorkerIds.length > 1 ? 's' : ''} below`
                      : 'Or select registered workers below'}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as ProjectProfile['status'])}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-2 py-2 text-xs focus:border-amber-500 focus:outline-none"
                  >
                    <option value="PLANNING">Planning</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="PUNCHLIST_QA">Punchlist & QA</option>
                    <option value="HANDED_OVER">Handed Over</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Target Handover Date</label>
                  <input
                    type="date"
                    required
                    min={formStartDate}
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className={`w-full bg-slate-950 border text-white rounded-xl px-3 py-2 text-sm focus:outline-none ${
                      isTimelineInvalid ? 'border-red-500 focus:border-red-400' : 'border-slate-700 focus:border-amber-500'
                    }`}
                  />
                </div>
              </div>

              {/* Designated Project Manager Selector */}
              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1 flex items-center gap-1.5">
                  <HardHat className="w-3.5 h-3.5 text-amber-400" />
                  <span>Designated Project Manager (PM Execution Lead)</span>
                </label>
                <select
                  value={formPMId}
                  onChange={(e) => {
                    const selected = availablePMs.find(p => p.id === e.target.value);
                    setFormPMId(e.target.value);
                    setFormPMName(selected ? selected.name : '');
                  }}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                >
                  <option value="">-- Unassigned (Designate Later) --</option>
                  {availablePMs.map(pm => (
                    <option key={pm.id} value={pm.id}>{pm.name}</option>
                  ))}
                </select>
              </div>

              {/* Confidential Accounting Flag */}
              <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <span>Confidential Accounting (Restricted Access)</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Restricts granular ledgers, profit margins, and contractor rates to Administrator only
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formIsPrivateAccounting}
                  onChange={(e) => setFormIsPrivateAccounting(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
              </div>

              {/* Assign Initial Workforce & Trade Contractors */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono text-slate-400 uppercase flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    <span>Assign Registered Workers & Contractors (Optional)</span>
                  </label>
                  <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                    {formAssignedWorkerIds.length} Selected
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Filter workers by name or trade..."
                    value={modalWorkerSearchQuery}
                    onChange={(e) => setModalWorkerSearchQuery(e.target.value)}
                    className="w-full bg-slate-900/80 border border-slate-800 text-white rounded-lg pl-8 pr-3 py-1.5 text-xs placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                  {contractors.length === 0 ? (
                    <div className="text-center py-3 text-xs text-slate-500 italic">No registered workers found in roster.</div>
                  ) : (
                    contractors
                      .filter(c => {
                        if (!modalWorkerSearchQuery.trim()) return true;
                        const q = modalWorkerSearchQuery.toLowerCase();
                        return (
                          c.name.toLowerCase().includes(q) ||
                          (c.tradeType && c.tradeType.toLowerCase().includes(q)) ||
                          (c.specialty && c.specialty.toLowerCase().includes(q))
                        );
                      })
                      .map(worker => {
                        const isSelected = formAssignedWorkerIds.includes(worker.id);
                        return (
                          <div
                            key={worker.id}
                            onClick={() => toggleWorkerSelection(worker.id)}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition border text-xs ${
                              isSelected
                                ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                              : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-800/50 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                                {worker.avatar ? (
                                  <img src={worker.avatar} alt={worker.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[10px] font-bold text-amber-400">
                                    {worker.name.charAt(0)}
                                  </span>
                                )}
                              </div>
                              <div className="truncate">
                                <span className="font-semibold">{worker.name}</span>
                                <span className="text-[10px] text-slate-400 ml-1.5 font-mono">
                                  ({worker.tradeType || 'General'})
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {worker.activeProjectSite && (
                                <span className="text-[9px] font-mono text-slate-500 hidden sm:inline truncate max-w-[100px]">
                                  {worker.activeProjectSite}
                                </span>
                              )}
                              <div
                                className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                                  isSelected
                                    ? 'bg-amber-500 border-amber-500 text-slate-950'
                                    : 'border-slate-700 bg-slate-950'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Scope & Description</label>
                <textarea
                  rows={2}
                  placeholder="e.g., Land clearing, road network grading, and drainage civil works."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 text-sm font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isTimelineInvalid || !formName.trim()}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  Save Project Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {showEditModal && selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
            <button
              onClick={() => setShowEditModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <Edit3 className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-bold text-white">Edit Profile: {selectedProject.name}</h3>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              {isTimelineInvalid && (
                <div className="flex items-center gap-2 p-3 bg-red-950/80 border border-red-500/60 rounded-xl text-red-300 text-xs font-semibold animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>Validation Alert: Target Handover Date cannot be earlier than Project Start Date.</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., NexBridge Software Hub Phase 2"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Client / Corporate Account</label>
                <input
                  type="text"
                  placeholder="e.g., Summit Holdings Philippines"
                  value={formClient}
                  onChange={(e) => setFormClient(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Site Location</label>
                <input
                  type="text"
                  placeholder="e.g., Cabuyao Technopark, Laguna"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Total Budget (₱)</label>
                  <input
                    type="number"
                    value={formBudget}
                    onChange={(e) => setFormBudget(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:border-amber-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Funds Collected (₱)</label>
                  <input
                    type="number"
                    value={formCollected}
                    onChange={(e) => setFormCollected(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:border-amber-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Progress (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={formProgress}
                    onChange={(e) => setFormProgress(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:border-amber-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-mono text-slate-400 uppercase">Workers Count</label>
                    {formAssignedWorkerIds.length > 0 && (
                      <span className="text-[10px] text-amber-400 font-mono font-bold flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" /> Auto-synced
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={formAssignedWorkerIds.length > 0 ? formAssignedWorkerIds.length : formWorkers}
                    onChange={(e) => setFormWorkers(Number(e.target.value))}
                    disabled={formAssignedWorkerIds.length > 0}
                    className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-sm font-mono focus:outline-none transition ${
                      formAssignedWorkerIds.length > 0
                        ? 'border-amber-500/50 bg-amber-500/10 text-amber-300 cursor-not-allowed font-bold'
                        : 'border-slate-700 text-white focus:border-amber-500'
                    }`}
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    {formAssignedWorkerIds.length > 0
                      ? `Locked to ${formAssignedWorkerIds.length} registered artisan${formAssignedWorkerIds.length > 1 ? 's' : ''} below`
                      : 'Or select registered workers below'}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as ProjectProfile['status'])}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-2 py-2 text-xs focus:border-amber-500 focus:outline-none"
                  >
                    <option value="PLANNING">Planning</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="PUNCHLIST_QA">Punchlist & QA</option>
                    <option value="HANDED_OVER">Handed Over</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Target Handover Date</label>
                  <input
                    type="date"
                    min={formStartDate}
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className={`w-full bg-slate-950 border text-white rounded-xl px-3 py-2 text-sm focus:outline-none ${
                      isTimelineInvalid ? 'border-red-500 focus:border-red-400' : 'border-slate-700 focus:border-amber-500'
                    }`}
                  />
                </div>
              </div>

              {/* Designated Project Manager Selector */}
              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1 flex items-center gap-1.5">
                  <HardHat className="w-3.5 h-3.5 text-amber-400" />
                  <span>Designated Project Manager (PM Execution Lead)</span>
                </label>
                <select
                  value={formPMId}
                  onChange={(e) => {
                    const selected = availablePMs.find(p => p.id === e.target.value);
                    setFormPMId(e.target.value);
                    setFormPMName(selected ? selected.name : '');
                  }}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                >
                  <option value="">-- Unassigned (Designate Later) --</option>
                  {availablePMs.map(pm => (
                    <option key={pm.id} value={pm.id}>{pm.name}</option>
                  ))}
                </select>
              </div>

              {/* Confidential Accounting Flag */}
              <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <span>Confidential Accounting (Restricted Access)</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Restricts granular ledgers, profit margins, and contractor rates to Administrator only
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formIsPrivateAccounting}
                  onChange={(e) => setFormIsPrivateAccounting(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
              </div>

              {/* Edit Assigned Workforce & Trade Contractors */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono text-slate-400 uppercase flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    <span>Assigned Workers & Trade Contractors</span>
                  </label>
                  <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                    {formAssignedWorkerIds.length} Assigned
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Filter workers by name or trade..."
                    value={modalWorkerSearchQuery}
                    onChange={(e) => setModalWorkerSearchQuery(e.target.value)}
                    className="w-full bg-slate-900/80 border border-slate-800 text-white rounded-lg pl-8 pr-3 py-1.5 text-xs placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                  {contractors
                    .filter(c => {
                      if (!modalWorkerSearchQuery.trim()) return true;
                      const q = modalWorkerSearchQuery.toLowerCase();
                      return (
                        c.name.toLowerCase().includes(q) ||
                        (c.tradeType && c.tradeType.toLowerCase().includes(q)) ||
                        (c.specialty && c.specialty.toLowerCase().includes(q))
                      );
                    })
                    .map(worker => {
                      const isSelected = formAssignedWorkerIds.includes(worker.id);
                      return (
                        <div
                          key={worker.id}
                          onClick={() => toggleWorkerSelection(worker.id)}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition border text-xs ${
                            isSelected
                              ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                              : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-800/50 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                              {worker.avatar ? (
                                <img src={worker.avatar} alt={worker.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[10px] font-bold text-amber-400">
                                  {worker.name.charAt(0)}
                                </span>
                              )}
                            </div>
                            <div className="truncate">
                              <span className="font-semibold">{worker.name}</span>
                              <span className="text-[10px] text-slate-400 ml-1.5 font-mono">
                                ({worker.tradeType || 'General'})
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {worker.activeProjectSite && (
                              <span className="text-[9px] font-mono text-slate-500 hidden sm:inline truncate max-w-[100px]">
                                {worker.activeProjectSite}
                              </span>
                            )}
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                                isSelected
                                  ? 'bg-amber-500 border-amber-500 text-slate-950'
                                  : 'border-slate-700 bg-slate-950'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Scope & Description</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 text-sm font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isTimelineInvalid || !formName.trim()}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
            <button
              onClick={() => setShowReallocationModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
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
                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
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

