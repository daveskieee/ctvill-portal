import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, Search, ShieldCheck, Trash2, Plus, 
  MapPin, Award, Radio, ChevronRight, 
  X, LayoutGrid, CheckCircle2, Sliders, Check,
  ArrowRightLeft, Phone, HardHat, Building2, User
} from 'lucide-react';
import { Contractor, DailyManpowerAudit, ProjectProfile, isOfficeOrExecutive, isIndividualStaffOrEngineer } from '../types';
import { useTheme } from '../context/ThemeContext';

// Curated high-resolution professional avatars for construction/fit-out personnel
const DEFAULT_AVATARS: Record<string, string> = {
  'CONT-1789426633747': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&auto=format&fit=crop&q=80',
  'CONT-001': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&auto=format&fit=crop&q=80',
  'CONT-002': 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=160&auto=format&fit=crop&q=80',
  'CONT-003': 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=160&auto=format&fit=crop&q=80',
  'CONT-004': 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=160&auto=format&fit=crop&q=80',
  'CONT-9420': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80',
};

interface WorkforceMessengerRosterProps {
  contractors: Contractor[];
  manpowerAudits?: DailyManpowerAudit[];
  projects?: ProjectProfile[];
  onRegisterClick: () => void;
  onVerifyRollCall: (contractorId: string) => void;
  onDeleteContractor?: (contractorId: string) => void;
  onUpdateContractor?: (updated: Contractor) => void;
  onUpdateContractors?: (updated: Contractor[]) => void;
  onUpdateProject?: (id: string, updates: Partial<ProjectProfile>) => void | Promise<void>;
  onSwitchToAllocationTab?: (workerId?: string) => void;
  notify?: (msg: string) => void;
}

export const WorkforceMessengerRoster: React.FC<WorkforceMessengerRosterProps> = ({
  contractors,
  manpowerAudits = [],
  projects = [],
  onRegisterClick,
  onVerifyRollCall,
  onDeleteContractor,
  onUpdateContractor,
  onUpdateContractors,
  onUpdateProject,
  onSwitchToAllocationTab,
  notify = console.log
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [selectedId, setSelectedId] = useState<string>(() => contractors[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ONLINE' | 'BREAK' | 'OFFLINE'>('ALL');
  const [employmentFilter, setEmploymentFilter] = useState<'ALL' | 'INTERNAL' | 'OUTSOURCED'>('ALL');
  const [siteFilter, setSiteFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'MESSENGER' | 'GRID'>('MESSENGER');
  const [dossierTab, setDossierTab] = useState<'DEPLOYMENT' | 'PERFORMANCE' | 'CREDENTIALS'>('DEPLOYMENT');

  // Inline Transfer Station State
  const [transferSite, setTransferSite] = useState<string>('');
  const [transferZone, setTransferZone] = useState<string>('');
  const [transferHeadcount, setTransferHeadcount] = useState<number>(1);
  const [isTransferring, setIsTransferring] = useState<boolean>(false);

  // Manual Allocation Modal State (Fallback / Advanced)
  const [isAllocModalOpen, setIsAllocModalOpen] = useState<boolean>(false);
  const [allocContractor, setAllocContractor] = useState<Contractor | null>(null);
  const [allocSite, setAllocSite] = useState<string>('');
  const [allocZone, setAllocZone] = useState<string>('');
  const [allocHeadcount, setAllocHeadcount] = useState<number>(1);

  // Ensure selectedId is valid
  useEffect(() => {
    if (contractors.length > 0 && !contractors.some(c => c.id === selectedId)) {
      setSelectedId(contractors[0].id);
    }
  }, [contractors, selectedId]);

  // Active selected contractor
  const selectedContractor = contractors.find(c => c.id === selectedId) || contractors[0];

  // Sync transfer form whenever selected contractor changes
  useEffect(() => {
    if (selectedContractor) {
      setTransferSite(selectedContractor.activeProjectSite || '');
      setTransferZone(selectedContractor.assignedZone || 'General');
      const isIndiv = isIndividualStaffOrEngineer(selectedContractor) || isOfficeOrExecutive(selectedContractor);
      setTransferHeadcount(isIndiv ? 1 : (selectedContractor.activeManpower || 1));
    }
  }, [selectedContractor?.id]);

  // Helper to determine active presence (grounded in database state)
  const getWorkerPresence = (c: Contractor): 'ONLINE' | 'BREAK' | 'OFFLINE' => {
    if (c.activePresence) return c.activePresence;
    if (c.status === 'BREAK') return 'BREAK';
    if (c.status === 'OFFLINE' || c.status === 'INACTIVE' || c.status === 'ON_LEAVE') return 'OFFLINE';
    return 'ONLINE';
  };

  const getWorkerAvatar = (c: Contractor): string | null => {
    if (c.avatar) return c.avatar;
    if (DEFAULT_AVATARS[c.id]) return DEFAULT_AVATARS[c.id];
    return null;
  };

  const getWorkerInitials = (name: string): string => {
    return name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  };

  const getPresenceLabel = (status: 'ONLINE' | 'BREAK' | 'OFFLINE') => {
    switch (status) {
      case 'ONLINE':
        return { text: 'Active On-Site', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: 'bg-emerald-400' };
      case 'BREAK':
        return { text: 'On Break', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', dot: 'bg-amber-400' };
      case 'OFFLINE':
        return { text: 'Off-Shift', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30', dot: 'bg-slate-500' };
    }
  };

  // Execute Manpower Transfer (Inline direct action)
  const handleExecuteTransfer = async (targetSiteName: string, targetZoneName?: string, count?: number) => {
    if (!selectedContractor) return;
    setIsTransferring(true);

    const cleanSite = targetSiteName.trim();
    const cleanZone = (targetZoneName !== undefined ? targetZoneName : transferZone).trim();
    const isIndiv = isIndividualStaffOrEngineer(selectedContractor) || isOfficeOrExecutive(selectedContractor);
    const cleanCount = isIndiv ? 1 : Math.max(1, count !== undefined ? count : (Number(transferHeadcount) || 1));

    const updated: Contractor = {
      ...selectedContractor,
      activeProjectSite: cleanSite || undefined,
      assignedZone: cleanZone || undefined,
      activeManpower: cleanCount
    };

    // 1. Optimistically update local contractor state
    if (onUpdateContractor) {
      onUpdateContractor(updated);
    }
    if (onUpdateContractors) {
      onUpdateContractors(contractors.map(c => c.id === updated.id ? updated : c));
    }

    // 2. Synchronize project roster via API
    try {
      if (cleanSite && projects && projects.length > 0) {
        const selectedProject = projects.find(p => p.name.toLowerCase() === cleanSite.toLowerCase());
        if (selectedProject) {
          await fetch(`/api/projects/${selectedProject.id}/workers`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workerId: selectedContractor.id, action: 'add' })
          });

          if (onUpdateProject) {
            const current = selectedProject.assignedContractorIds || [];
            if (!current.includes(selectedContractor.id)) {
              onUpdateProject(selectedProject.id, {
                assignedContractorIds: [...current, selectedContractor.id],
                assignedWorkersCount: (selectedProject.assignedWorkersCount || 0) + 1
              });
            }
          }
        }
      } else {
        // Unassigned / Standby: remove from previous project if any
        if (selectedContractor.activeProjectSite) {
          const prevProject = projects.find(p => p.name.toLowerCase() === selectedContractor.activeProjectSite?.toLowerCase());
          if (prevProject) {
            await fetch(`/api/projects/${prevProject.id}/workers`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ workerId: selectedContractor.id, action: 'remove' })
            }).catch(() => {});
          }
        }
      }

      notify(`Transferred ${selectedContractor.name} to ${cleanSite || 'General Standby Pool'}`);
    } catch (err) {
      console.error('Error applying transfer:', err);
      notify(`Transfer saved locally.`);
    } finally {
      setIsTransferring(false);
    }
  };

  // Handle status toggle
  const handleToggleStatus = (newStatus: 'ONLINE' | 'BREAK' | 'OFFLINE') => {
    if (!selectedContractor) return;
    const dbStatus = newStatus === 'ONLINE' ? 'ACTIVE' : newStatus === 'BREAK' ? 'BREAK' : 'OFFLINE';
    const updated: Contractor = {
      ...selectedContractor,
      activePresence: newStatus,
      status: dbStatus,
      lastSeen: newStatus === 'ONLINE' ? 'Active now' : newStatus === 'BREAK' ? 'On break' : 'Clocked out'
    };
    if (onUpdateContractor) {
      onUpdateContractor(updated);
    }
    if (onUpdateContractors) {
      onUpdateContractors(contractors.map(c => c.id === updated.id ? updated : c));
    }
    notify(`Updated ${selectedContractor.name}'s status to ${getPresenceLabel(newStatus).text}`);
  };

  // Modal Allocation Save
  const handleSaveAllocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocContractor) return;
    await handleExecuteTransfer(allocSite, allocZone, allocHeadcount);
    setIsAllocModalOpen(false);
  };

  // Filtered workers list
  const filteredContractors = useMemo(() => {
    return contractors.filter(c => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = (
          c.name.toLowerCase().includes(q) ||
          c.company.toLowerCase().includes(q) ||
          (c.roleTitle && c.roleTitle.toLowerCase().includes(q)) ||
          (c.specialty && c.specialty.toLowerCase().includes(q)) ||
          (c.department && c.department.toLowerCase().includes(q)) ||
          (c.activeProjectSite && c.activeProjectSite.toLowerCase().includes(q))
        );
        if (!matches) return false;
      }

      // Employment
      if (employmentFilter === 'INTERNAL' && c.employmentType === 'OUTSOURCED') return false;
      if (employmentFilter === 'OUTSOURCED' && c.employmentType !== 'OUTSOURCED') return false;

      // Status
      const presence = getWorkerPresence(c);
      if (statusFilter !== 'ALL' && presence !== statusFilter) return false;

      // Project Site Filter
      if (siteFilter !== 'ALL') {
        const activeSite = (c.activeProjectSite || 'STANDBY').toLowerCase();
        if (siteFilter === 'STANDBY') {
          if (activeSite && activeSite !== 'standby' && !activeSite.includes('unassigned') && !activeSite.includes('pool')) {
            return false;
          }
        } else {
          if (!activeSite.includes(siteFilter.toLowerCase())) {
            return false;
          }
        }
      }

      return true;
    });
  }, [contractors, searchQuery, employmentFilter, statusFilter, siteFilter]);

  // Counts
  const counts = useMemo(() => {
    let online = 0;
    let onBreak = 0;
    let offline = 0;
    contractors.forEach(c => {
      const p = getWorkerPresence(c);
      if (p === 'ONLINE') online++;
      else if (p === 'BREAK') onBreak++;
      else offline++;
    });
    return { total: contractors.length, online, onBreak, offline };
  }, [contractors]);

  // Selected avatar
  const selectedAvatar = selectedContractor ? getWorkerAvatar(selectedContractor) : null;
  const selectedPresence = selectedContractor ? getWorkerPresence(selectedContractor) : 'ONLINE';

  // Recent audits for selected worker
  const workerAudits = useMemo(() => {
    if (!selectedContractor) return [];
    return manpowerAudits.filter(a => 
      a.contractorId === selectedContractor.id || 
      a.contractorName?.toLowerCase() === selectedContractor.name?.toLowerCase()
    );
  }, [selectedContractor, manpowerAudits]);

  return (
    <div className="space-y-4 font-sans">
      {/* MINIMALIST TOP HEADER & TOOLBAR */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Title & Live Status Pills */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-teal-500/10 border border-teal-500/20 rounded-lg text-teal-400">
                <Users className="w-4 h-4" />
              </span>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Workforce Directory
              </h3>
              <span className="text-xs font-mono text-slate-500">
                ({counts.total})
              </span>
            </div>

            <div className="h-4 w-px bg-slate-800 hidden sm:block"></div>

            {/* Compact Presence Counters */}
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === 'ONLINE' ? 'ALL' : 'ONLINE')}
                className={`px-2 py-0.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer text-[11px] ${
                  statusFilter === 'ONLINE' 
                    ? 'bg-emerald-950 border border-emerald-700 text-emerald-300 font-bold' 
                    : 'text-slate-400 hover:text-emerald-400'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>{counts.online} Active</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === 'BREAK' ? 'ALL' : 'BREAK')}
                className={`px-2 py-0.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer text-[11px] ${
                  statusFilter === 'BREAK' 
                    ? 'bg-amber-950 border border-amber-700 text-amber-300 font-bold' 
                    : 'text-slate-400 hover:text-amber-400'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>{counts.onBreak} Break</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === 'OFFLINE' ? 'ALL' : 'OFFLINE')}
                className={`px-2 py-0.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer text-[11px] ${
                  statusFilter === 'OFFLINE' 
                    ? 'bg-slate-800 border border-slate-700 text-white font-bold' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                <span>{counts.offline} Off</span>
              </button>
            </div>
          </div>

          {/* Action buttons & View Mode */}
          <div className="flex items-center gap-2 self-start sm:self-center">
            <div className="flex items-center bg-slate-900 border border-slate-800 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setViewMode('MESSENGER')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer ${
                  viewMode === 'MESSENGER' 
                    ? 'bg-slate-800 text-white shadow-xs' 
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Roster View"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Roster</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('GRID')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer ${
                  viewMode === 'GRID' 
                    ? 'bg-slate-800 text-white shadow-xs' 
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Grid Cards"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Grid</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onRegisterClick}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register Worker</span>
            </button>
          </div>
        </div>

        {/* MINIMALIST SEARCH & SITE FILTER BAR */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-2 border-t border-slate-800/80 items-center">
          {/* Quick Search */}
          <div className="sm:col-span-6 relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by worker name, trade, or site..."
              className="w-full bg-slate-900 border border-slate-800 focus:border-teal-500 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Site Monitoring Filter (Dropdown) */}
          <div className="sm:col-span-4 flex items-center gap-1.5">
            <span className="text-[11px] font-mono text-slate-500 shrink-0 hidden md:inline">Site:</span>
            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:border-teal-500 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Commercial Projects ({counts.total})</option>
              {projects.map(p => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
              <option value="STANDBY">Standby / Unassigned Pool</option>
            </select>
          </div>

          {/* Classification Filter (All / In-House / Partner) */}
          <div className="sm:col-span-2 flex items-center justify-end gap-1 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => setEmploymentFilter(employmentFilter === 'INTERNAL' ? 'ALL' : 'INTERNAL')}
              className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                employmentFilter === 'INTERNAL' ? 'bg-teal-950 border border-teal-700 text-teal-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="Show In-House Only"
            >
              In-House
            </button>
            <button
              type="button"
              onClick={() => setEmploymentFilter(employmentFilter === 'OUTSOURCED' ? 'ALL' : 'OUTSOURCED')}
              className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                employmentFilter === 'OUTSOURCED' ? 'bg-amber-950 border border-amber-700 text-amber-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="Show Partners Only"
            >
              Partners
            </button>
          </div>
        </div>
      </div>

      {/* MAIN TWO-COLUMN WORKFORCE WORKSPACE */}
      {viewMode === 'MESSENGER' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* LEFT COLUMN: Clean, Fast-Scanning Roster List */}
          <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col h-[600px] lg:h-[720px]">
            {/* Header with Results Count */}
            <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">
                Personnel Roster
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                {filteredContractors.length} of {contractors.length}
              </span>
            </div>

            {/* Worker Rows */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-1">
              {filteredContractors.length === 0 ? (
                <div className="p-8 text-center text-slate-500 space-y-2">
                  <User className="w-8 h-8 mx-auto text-slate-600" />
                  <p className="text-xs font-semibold text-slate-400">No personnel match search</p>
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); setSiteFilter('ALL'); }}
                    className="text-[11px] text-teal-400 hover:underline cursor-pointer"
                  >
                    Reset filters
                  </button>
                </div>
              ) : (
                filteredContractors.map((c) => {
                  const isSelected = selectedContractor?.id === c.id;
                  const presence = getWorkerPresence(c);
                  const presenceConfig = getPresenceLabel(presence);
                  const avatarUrl = getWorkerAvatar(c);
                  const isCorp = isOfficeOrExecutive(c);
                  const siteName = c.activeProjectSite || 'Standby';

                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className={`p-3 rounded-xl transition-all cursor-pointer flex items-center gap-3 relative ${
                        isSelected 
                          ? 'bg-slate-900 border border-teal-500/40 shadow-xs' 
                          : 'hover:bg-slate-900/60 border border-transparent'
                      }`}
                    >
                      {/* Avatar with Presence Indicator */}
                      <div className="relative shrink-0">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={c.name}
                            className="w-10 h-10 rounded-full object-cover border border-slate-700"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-teal-400 font-bold text-xs">
                            {getWorkerInitials(c.name)}
                          </div>
                        )}
                        <span 
                          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-950 ${presenceConfig.dot}`}
                          title={presenceConfig.text}
                        />
                      </div>

                      {/* Info & Location Badge */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-teal-300' : 'text-white'}`}>
                            {c.name}
                          </h4>
                          {/* Live Project Location Pill */}
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md truncate max-w-[140px] shrink-0 ${
                            siteName === 'Standby' 
                              ? 'bg-slate-900 border border-slate-800 text-slate-400' 
                              : 'bg-teal-950/80 border border-teal-800/80 text-teal-300 font-semibold'
                          }`}>
                            📍 {siteName}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                          <span className="truncate">
                            {c.roleTitle || c.specialty || (isCorp ? 'Corporate Staff' : 'Trade Artisan')}
                          </span>
                          {!isCorp && (c.activeManpower || 1) > 1 && (
                            <span className="text-[10px] font-mono text-slate-500 shrink-0">
                              {c.activeManpower} crew
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right indicator arrow */}
                      <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                        isSelected ? 'text-teal-400 translate-x-0.5' : 'text-slate-700'
                      }`} />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Profile, Quick Transfer Station & Monitoring */}
          <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col h-[600px] lg:h-[720px]">
            {selectedContractor ? (
              <>
                {/* COMPACT WORKER PROFILE HEADER */}
                <div className="p-4 bg-slate-900/90 border-b border-slate-800">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        {selectedAvatar ? (
                          <img
                            src={selectedAvatar}
                            alt={selectedContractor.name}
                            className="w-12 h-12 rounded-xl object-cover border border-teal-500/40 shadow-sm"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-slate-800 border border-teal-500/40 shadow-sm flex items-center justify-center text-teal-400 font-black text-sm">
                            {getWorkerInitials(selectedContractor.name)}
                          </div>
                        )}
                        <span 
                          className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${
                            getPresenceLabel(selectedPresence).dot
                          }`}
                        />
                      </div>

                      {/* Name & Role */}
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                            {selectedContractor.name}
                          </h2>
                          {isOfficeOrExecutive(selectedContractor) ? (
                            <span className="bg-purple-950/70 border border-purple-800 text-purple-300 text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold">
                              CORPORATE
                            </span>
                          ) : selectedContractor.employmentType !== 'OUTSOURCED' ? (
                            <span className="bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold">
                              IN-HOUSE
                            </span>
                          ) : (
                            <span className="bg-amber-950/70 border border-amber-800 text-amber-300 text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold">
                              PARTNER
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-300 font-medium">
                          {selectedContractor.roleTitle || selectedContractor.specialty || 'General Trade'}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          ID: <span className="text-slate-400">{selectedContractor.id}</span> • {selectedContractor.company}
                        </p>
                      </div>
                    </div>

                    {/* Quick 1-Click Presence Switcher */}
                    <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-xl self-start sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus('ONLINE')}
                        className={`px-2 py-1 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-1 cursor-pointer ${
                          selectedPresence === 'ONLINE'
                            ? 'bg-emerald-600 text-white font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-300"></span>
                        <span>Active</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus('BREAK')}
                        className={`px-2 py-1 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-1 cursor-pointer ${
                          selectedPresence === 'BREAK'
                            ? 'bg-amber-600 text-white font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-amber-300"></span>
                        <span>Break</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus('OFFLINE')}
                        className={`px-2 py-1 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-1 cursor-pointer ${
                          selectedPresence === 'OFFLINE'
                            ? 'bg-slate-700 text-white font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                        <span>Off</span>
                      </button>
                    </div>
                  </div>

                  {/* Section Tabs */}
                  <div className="flex items-center gap-2 pt-3 mt-3 border-t border-slate-800/80 text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => setDossierTab('DEPLOYMENT')}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                        dossierTab === 'DEPLOYMENT'
                          ? 'bg-teal-600 text-white font-bold shadow-xs'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Jobsite &amp; Monitoring</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDossierTab('PERFORMANCE')}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                        dossierTab === 'PERFORMANCE'
                          ? 'bg-teal-600 text-white font-bold shadow-xs'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                      }`}
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>Compensation &amp; QA</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDossierTab('CREDENTIALS')}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                        dossierTab === 'CREDENTIALS'
                          ? 'bg-teal-600 text-white font-bold shadow-xs'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Roll-Call History ({workerAudits.length})</span>
                    </button>
                  </div>
                </div>

                {/* SCROLLABLE DOSSIER BODY */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* TAB 1: MINIMALIST JOBSITE DEPLOYMENT & MONITORING */}
                  {dossierTab === 'DEPLOYMENT' && (
                    <div className="space-y-4 animate-fadeIn">
                      {/* Active Site Card with Allocation Command Center Link */}
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3.5 shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-mono text-slate-500 tracking-wider block">
                              Active Jobsite Deployment
                            </span>
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-teal-400 shrink-0" />
                              <strong className="text-white text-sm font-bold truncate">
                                {selectedContractor.activeProjectSite || 'General Standby Pool'}
                              </strong>
                              {selectedContractor.activeProjectSite && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/30">
                                  Deployed
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-400 block font-mono">
                              Assigned Area: <span className="text-slate-300 font-semibold">{selectedContractor.assignedZone || 'General Area'}</span>
                              {' • '}
                              Crew Capacity: <span className="text-teal-300 font-semibold">{selectedContractor.activeManpower || 1} Headcount</span>
                            </span>
                          </div>

                          {/* Action Button: Jump to Live Allocation & Analytics Tab */}
                          {onSwitchToAllocationTab ? (
                            <button
                              type="button"
                              onClick={() => onSwitchToAllocationTab(selectedContractor.id)}
                              className="px-3.5 py-2 bg-teal-600/20 hover:bg-teal-600 border border-teal-500/40 text-teal-300 hover:text-white rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs shrink-0 group self-start sm:self-center"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5 text-teal-400 group-hover:rotate-180 transition-transform duration-300" />
                              <span>Reallocate Site in Analytics →</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setAllocContractor(selectedContractor);
                                setAllocSite(selectedContractor.activeProjectSite || '');
                                setAllocZone(selectedContractor.assignedZone || 'General Area');
                                setAllocHeadcount(selectedContractor.activeManpower || 1);
                                setIsAllocModalOpen(true);
                              }}
                              className="px-3.5 py-2 bg-teal-600/20 hover:bg-teal-600 border border-teal-500/40 text-teal-300 hover:text-white rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs shrink-0 self-start sm:self-center"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                              <span>Transfer Site</span>
                            </button>
                          )}
                        </div>

                        {/* Visual Project Status if mapped to an active project */}
                        {(() => {
                          const activeProj = projects.find(
                            p => p.name.toLowerCase() === (selectedContractor.activeProjectSite || '').toLowerCase()
                          );
                          if (!activeProj) return null;
                          return (
                            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                              <span className="text-slate-400">Project Status: <strong className="text-white">{activeProj.status || 'IN_PROGRESS'}</strong></span>
                              <span className="text-teal-400 font-bold">{activeProj.progressPercentage ?? activeProj.progress ?? 0}% Complete</span>
                            </div>
                          );
                        })()}
                      </div>

                      {/* WORKER MONITORING METRICS */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                        {/* Current Site Tile */}
                        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-1">
                          <span className="text-[10px] text-slate-500 block uppercase">Deployment Status</span>
                          <strong className="text-white text-xs block truncate">
                            {selectedContractor.activeProjectSite ? 'On Active Site' : 'Standby Pool'}
                          </strong>
                          <span className="text-[10px] text-teal-400 block truncate">
                            Zone: {selectedContractor.assignedZone || 'General Area'}
                          </span>
                        </div>

                        {/* Presence & Shift Tile */}
                        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-1">
                          <span className="text-[10px] text-slate-500 block uppercase">Field Attendance</span>
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${getPresenceLabel(selectedPresence).dot}`} />
                            <strong className="text-white text-xs">
                              {getPresenceLabel(selectedPresence).text}
                            </strong>
                          </div>
                          <span className="text-[10px] text-slate-400 block">
                            Shift: 07:00 AM – 04:00 PM
                          </span>
                        </div>

                        {/* Contact Info Tile */}
                        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-1">
                          <span className="text-[10px] text-slate-500 block uppercase">Communications</span>
                          <strong className="text-white text-xs block truncate">
                            {selectedContractor.contact || 'No phone registered'}
                          </strong>
                          <span className="text-[10px] text-slate-400 block">
                            Direct Field Comms
                          </span>
                        </div>
                      </div>

                      {/* ROLL-CALL VERIFICATION ACTION */}
                      {!(selectedContractor.workforce_class === 'Corporate' || selectedContractor.workforceClass === 'Corporate' || isOfficeOrExecutive(selectedContractor)) && (
                        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3">
                          <div className="text-xs">
                            <span className="font-bold text-white block">Roll-Call Muster Verification</span>
                            <span className="text-[11px] text-slate-400">Confirm physical presence for today's daily log.</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onVerifyRollCall(selectedContractor.id)}
                            className="px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Verify Muster</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: COMPENSATION & PERFORMANCE */}
                  {dossierTab === 'PERFORMANCE' && (
                    <div className="space-y-4">
                      {/* Rates & Compensation */}
                      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3 text-xs font-mono">
                        <span className="font-bold text-white block">
                          Compensation &amp; Payroll Rate
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                            <span className="text-[10px] text-slate-500 block">Daily Wage</span>
                            <strong className="text-emerald-400 text-xs">
                              {selectedContractor.dailyRate ? `₱${selectedContractor.dailyRate.toLocaleString()}` : 'Salaried / Monthly'}
                            </strong>
                          </div>
                          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                            <span className="text-[10px] text-slate-500 block">Monthly Rate</span>
                            <strong className="text-white text-xs">
                              ₱{(selectedContractor.monthlySalary || (selectedContractor.dailyRate ? selectedContractor.dailyRate * 22 : 0)).toLocaleString()}
                            </strong>
                          </div>
                          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 col-span-2 sm:col-span-1">
                            <span className="text-[10px] text-slate-500 block">Contract Scope</span>
                            <strong className="text-teal-300 text-xs truncate block">
                              {selectedContractor.contractAmount ? `₱${selectedContractor.contractAmount.toLocaleString()}` : 'CTVill In-House'}
                            </strong>
                          </div>
                        </div>
                      </div>

                      {/* QA Rating & Milestone Progress */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                        <div className="bg-slate-900/70 border border-slate-800 p-3.5 rounded-xl space-y-1.5">
                          <span className="text-[10px] text-slate-500 block">QA Inspection Score</span>
                          {typeof selectedContractor.rating === 'number' && selectedContractor.rating > 0 ? (
                            <div className="space-y-1">
                              <strong className="text-amber-400 font-bold text-sm">
                                ⭐ {selectedContractor.rating.toFixed(1)} / 5.0
                              </strong>
                              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-amber-400 rounded-full"
                                  style={{ width: `${(selectedContractor.rating / 5) * 100}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-xs block">Pending field QA inspection</span>
                          )}
                        </div>

                        <div className="bg-slate-900/70 border border-slate-800 p-3.5 rounded-xl space-y-1.5">
                          <span className="text-[10px] text-slate-500 block">Milestone Pace</span>
                          {typeof selectedContractor.milestoneProgress === 'number' && selectedContractor.milestoneProgress > 0 ? (
                            <div className="space-y-1">
                              <strong className="text-blue-400 font-bold text-sm">
                                {selectedContractor.milestoneProgress}%
                              </strong>
                              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-blue-500 rounded-full"
                                  style={{ width: `${Math.min(100, selectedContractor.milestoneProgress)}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-xs block">Tracked via active tasks</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: ROLL-CALL AUDIT HISTORY */}
                  {dossierTab === 'CREDENTIALS' && (
                    <div className="space-y-3 text-xs font-mono">
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="font-bold text-white">Daily Muster Logs</span>
                        <span>{workerAudits.length} Records</span>
                      </div>

                      {workerAudits.length === 0 ? (
                        <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-xl text-center text-slate-500">
                          No muster records logged today for this worker.
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-800/80 bg-slate-900/50 border border-slate-800 rounded-xl p-3">
                          {workerAudits.slice(0, 5).map(audit => (
                            <div key={audit.id} className="py-2.5 flex items-center justify-between gap-2">
                              <div>
                                <strong className="text-white block">{audit.date}</strong>
                                <span className="text-slate-500 text-[10px]">{audit.assignedSectorOrLot} • {audit.shift}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-emerald-400 font-bold block">
                                  {audit.verifiedHeadcount} / {audit.claimedHeadcount} Verified
                                </span>
                                <span className="text-[10px] text-teal-400">{audit.verificationStatus}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center p-8 text-center text-slate-500">
                <p className="text-xs">Select a worker from the left roster to view profile and transfer.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* GRID CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredContractors.map((c) => {
            const presence = getWorkerPresence(c);
            const avatarUrl = getWorkerAvatar(c);
            const presenceConfig = getPresenceLabel(presence);

            return (
              <div 
                key={c.id} 
                className={`${
                  isDark
                    ? 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-xs'
                } border rounded-xl p-4 space-y-3 transition-all`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="relative shrink-0">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={c.name} className={`w-10 h-10 rounded-full object-cover border ${isDark ? 'border-slate-700' : 'border-slate-200'}`} />
                      ) : (
                        <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-slate-800 border-slate-700 text-teal-400' : 'bg-slate-100 border-slate-200 text-slate-700'} border flex items-center justify-center font-bold text-xs`}>
                          {getWorkerInitials(c.name)}
                        </div>
                      )}
                      <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 ${isDark ? 'border-slate-950' : 'border-white'} ${presenceConfig.dot}`} />
                    </div>
                    <div className="min-w-0">
                      <h4 className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{c.name}</h4>
                      <p className={`text-[11px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{c.roleTitle || c.specialty || 'Trade Artisan'}</p>
                    </div>
                  </div>
                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded-md font-bold border ${presenceConfig.bg} ${presenceConfig.border} ${presenceConfig.color}`}>
                    ● {presenceConfig.text}
                  </span>
                </div>

                <div className={`text-[11px] font-mono p-2 rounded-lg border flex items-center justify-between ${
                  isDark ? 'text-slate-300 bg-slate-900 border-slate-800' : 'text-slate-700 bg-slate-50 border-slate-200'
                }`}>
                  <span className={isDark ? 'text-slate-500' : 'text-slate-500'}>Current Site:</span>
                  <span className={`${isDark ? 'text-teal-300' : 'text-slate-800 font-semibold'} truncate max-w-[150px]`}>📍 {c.activeProjectSite || 'Standby'}</span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(c.id);
                      setViewMode('MESSENGER');
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors text-center ${
                      isDark
                        ? 'bg-teal-950 hover:bg-teal-900 border border-teal-800/80 text-teal-300 font-mono font-bold'
                        : 'bg-slate-100 hover:bg-slate-200 border border-slate-300/80 text-slate-800 shadow-2xs'
                    }`}
                  >
                    Transfer / Profile
                  </button>
                  {onDeleteContractor && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Remove "${c.name}" from roster?`)) {
                          onDeleteContractor(c.id);
                          notify(`Removed ${c.name}`);
                        }
                      }}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg"
                      title="Remove Worker"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FALLBACK / ADVANCED MODAL (If Triggered) */}
      {isAllocModalOpen && allocContractor && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-white text-sm">Site &amp; Zone Allocation</h3>
              <button 
                type="button"
                onClick={() => setIsAllocModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveAllocationSubmit} className="p-4 space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">Target Project Site</label>
                <select
                  value={allocSite}
                  onChange={(e) => setAllocSite(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  <option value="">-- Standby Pool --</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">Work Zone</label>
                <input
                  type="text"
                  value={allocZone}
                  onChange={(e) => setAllocZone(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAllocModalOpen(false)}
                  className="px-3 py-1.5 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-bold"
                >
                  Save Allocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkforceMessengerRoster;
