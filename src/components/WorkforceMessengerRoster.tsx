import React, { useState, useMemo } from 'react';
import { 
  Users, Search, ShieldCheck, Trash2, Plus, 
  MapPin, Award, Radio, ChevronRight, 
  UserCheck, X, LayoutGrid, Building, Star, CheckCircle2, Clock, Sliders, Check
} from 'lucide-react';
import { Contractor, DailyManpowerAudit, ProjectProfile, isOfficeOrExecutive, isIndividualStaffOrEngineer } from '../types';

// Curated high-resolution professional avatars for construction/fit-out personnel
const DEFAULT_AVATARS: Record<string, string> = {
  'CONT-1789426633747': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&auto=format&fit=crop&q=80',
  'CONT-001': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&auto=format&fit=crop&q=80',
  'CONT-002': 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=160&auto=format&fit=crop&q=80',
  'CONT-003': 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=160&auto=format&fit=crop&q=80',
  'CONT-004': 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=160&auto=format&fit=crop&q=80',
  'CONT-9420': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80',
};

const AVATAR_FALLBACKS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=160&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=160&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=160&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=160&auto=format&fit=crop&q=80',
];

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
  notify = console.log
}) => {
  const [selectedId, setSelectedId] = useState<string>(() => contractors[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ONLINE' | 'BREAK' | 'OFFLINE'>('ALL');
  const [employmentFilter, setEmploymentFilter] = useState<'ALL' | 'INTERNAL' | 'OUTSOURCED'>('ALL');
  const [viewMode, setViewMode] = useState<'MESSENGER' | 'GRID'>('MESSENGER');

  // Manual Allocation Modal State
  const [isAllocModalOpen, setIsAllocModalOpen] = useState<boolean>(false);
  const [allocContractor, setAllocContractor] = useState<Contractor | null>(null);
  const [allocSite, setAllocSite] = useState<string>('');
  const [allocZone, setAllocZone] = useState<string>('');
  const [allocHeadcount, setAllocHeadcount] = useState<number>(1);

  // Ensure selectedId is valid
  React.useEffect(() => {
    if (contractors.length > 0 && !contractors.some(c => c.id === selectedId)) {
      setSelectedId(contractors[0].id);
    }
  }, [contractors, selectedId]);

  // Helper to determine active presence (directly grounded in database state)
  const getWorkerPresence = (c: Contractor): 'ONLINE' | 'BREAK' | 'OFFLINE' => {
    if (c.activePresence) return c.activePresence;
    if (c.status === 'BREAK') return 'BREAK';
    if (c.status === 'OFFLINE' || c.status === 'INACTIVE' || c.status === 'ON_LEAVE') return 'OFFLINE';
    return 'ONLINE';
  };

  const getWorkerAvatar = (c: Contractor, index: number): string | null => {
    if (c.avatar) return c.avatar;
    if (DEFAULT_AVATARS[c.id]) return DEFAULT_AVATARS[c.id];
    // No preset avatar — return null so initials are shown
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
        return { text: 'On Break / Meal', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', dot: 'bg-amber-400' };
      case 'OFFLINE':
        return { text: 'Off-Shift / Standby', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30', dot: 'bg-slate-500' };
    }
  };

  const getPresenceSubtitle = (c: Contractor, status: 'ONLINE' | 'BREAK' | 'OFFLINE') => {
    const site = c.activeProjectSite || 'General Pool';
    const zone = c.assignedZone;
    switch (status) {
      case 'ONLINE':
        return zone ? `Active on ${zone} • ${site}` : `Active on-site • ${site}`;
      case 'BREAK':
        return `Meal break • ${site}`;
      case 'OFFLINE':
        return `Clocked out • Off duty`;
    }
  };

  const handleOpenAllocationModal = (c: Contractor) => {
    setAllocContractor(c);
    setAllocSite(c.activeProjectSite || (projects[0]?.name || ''));
    setAllocZone(c.assignedZone || '');
    const isIndiv = isIndividualStaffOrEngineer(c);
    setAllocHeadcount(isIndiv ? 1 : (c.activeManpower || 1));
    setIsAllocModalOpen(true);
  };

  const handleSaveAllocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocContractor) return;
    const cleanSite = allocSite.trim();
    const cleanZone = allocZone.trim();
    const isIndiv = isIndividualStaffOrEngineer(allocContractor);
    const cleanCount = isIndiv ? 1 : Math.max(1, Number(allocHeadcount) || 1);
    const updated: Contractor = {
      ...allocContractor,
      activeProjectSite: cleanSite || undefined,
      assignedZone: cleanZone || undefined,
      activeManpower: cleanCount
    };
    if (onUpdateContractor) {
      onUpdateContractor(updated);
    }
    if (onUpdateContractors) {
      onUpdateContractors(contractors.map(c => c.id === updated.id ? updated : c));
    }

    // Also sync with project's assignedContractorIds if a specific project was selected
    if (cleanSite && projects && projects.length > 0) {
      const selectedProject = projects.find(p => p.name === cleanSite);
      if (selectedProject) {
        try {
          await fetch(`/api/projects/${selectedProject.id}/workers`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workerId: allocContractor.id, action: 'add' })
          });
          if (onUpdateProject) {
            const current = selectedProject.assignedContractorIds || [];
            if (!current.includes(allocContractor.id)) {
              onUpdateProject(selectedProject.id, {
                assignedContractorIds: [...current, allocContractor.id],
                assignedWorkersCount: (selectedProject.assignedWorkersCount || 0) + 1
              });
            }
          }
        } catch (_) {}
      }
    }

    setIsAllocModalOpen(false);
    notify(`✅ Manual allocation saved: ${allocContractor.name} assigned to ${cleanSite || 'General Site Pool'} (${cleanCount} crew)`);
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

      return true;
    });
  }, [contractors, searchQuery, employmentFilter, statusFilter]);

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

  // Active selected contractor
  const selectedContractor = contractors.find(c => c.id === selectedId) || contractors[0];
  const selectedPresence = selectedContractor ? getWorkerPresence(selectedContractor) : 'ONLINE';
  const selectedAvatar: string | null = selectedContractor 
    ? getWorkerAvatar(selectedContractor, contractors.indexOf(selectedContractor))
    : null;

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
      {/* Top Header & Toolbar */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="p-2 bg-teal-500/10 border border-teal-500/30 rounded-xl text-teal-400">
                <Users className="w-5 h-5" />
              </span>
              <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                CTVill Workforce Directory &amp; Roster
              </h3>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap pt-0.5">
              <span>View personnel profiles, verify active on-site presence, and inspect trade credentials.</span>
              <span className="inline-flex items-center gap-1 text-emerald-400 font-mono font-bold bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded-md text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                {counts.online} Active On-Site
              </span>
              <span className="inline-flex items-center gap-1 text-amber-400 font-mono font-bold bg-amber-950/60 border border-amber-800/80 px-2 py-0.5 rounded-md text-[11px]">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                {counts.onBreak} On Break
              </span>
              <span className="inline-flex items-center gap-1 text-slate-400 font-mono font-bold bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md text-[11px]">
                <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                {counts.offline} Off-Shift
              </span>
            </div>
          </div>

          {/* Action buttons & View Toggle */}
          <div className="flex items-center gap-2 self-start lg:self-center flex-wrap">
            <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('MESSENGER')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'MESSENGER' 
                    ? 'bg-teal-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Roster View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('GRID')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'GRID' 
                    ? 'bg-teal-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Grid Cards</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onRegisterClick}
              className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold font-mono transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-md shadow-teal-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Register Worker</span>
            </button>
          </div>
        </div>

        {/* Search and Filters Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3 border-t border-slate-800/80 items-center">
          {/* Search Box */}
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search personnel, trade, floor, or company..."
              className="w-full bg-slate-900/90 border border-slate-800 focus:border-teal-500 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Active Presence Filters */}
          <div className="md:col-span-6 flex items-center justify-start md:justify-end gap-1.5 overflow-x-auto pb-1 md:pb-0 font-mono text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === 'ALL' ? 'bg-slate-800 text-white font-bold border border-slate-700' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({counts.total})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ONLINE')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                statusFilter === 'ONLINE' ? 'bg-emerald-900/80 text-emerald-300 font-bold border border-emerald-700' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Active ({counts.online})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('BREAK')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                statusFilter === 'BREAK' ? 'bg-amber-900/80 text-amber-300 font-bold border border-amber-700' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>Break ({counts.onBreak})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('OFFLINE')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                statusFilter === 'OFFLINE' ? 'bg-slate-800 text-slate-300 font-bold border border-slate-700' : 'text-slate-500 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-slate-500"></span>
              <span>Off-Shift ({counts.offline})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      {viewMode === 'MESSENGER' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* LEFT COLUMN: Messenger Contact List */}
          <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-lg flex flex-col h-[440px] lg:h-[740px]">
            {/* List Header */}
            <div className="p-3.5 border-b border-slate-800/80 bg-slate-900/40 flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
                <Users className="w-4 h-4 text-teal-400" />
                <span className="font-bold text-slate-200">Personnel Roster ({filteredContractors.length})</span>
              </div>
              {/* Type Filter */}
              <div className="flex items-center gap-1 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => setEmploymentFilter('ALL')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${employmentFilter === 'ALL' ? 'text-teal-400 font-bold' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  All
                </button>
                <span className="text-slate-700">|</span>
                <button
                  type="button"
                  onClick={() => setEmploymentFilter('INTERNAL')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${employmentFilter === 'INTERNAL' ? 'text-emerald-400 font-bold' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  In-House
                </button>
                <span className="text-slate-700">|</span>
                <button
                  type="button"
                  onClick={() => setEmploymentFilter('OUTSOURCED')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${employmentFilter === 'OUTSOURCED' ? 'text-amber-400 font-bold' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Partners
                </button>
              </div>
            </div>

            {/* Scrollable Contacts Feed */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-900/80 p-2 space-y-1">
              {filteredContractors.length === 0 ? (
                <div className="p-8 text-center space-y-2 text-slate-500">
                  <UserCheck className="w-8 h-8 mx-auto text-slate-600" />
                  <div className="text-xs font-bold text-slate-400">
                    {contractors.length === 0 ? 'No personnel registered' : 'No personnel match filter'}
                  </div>
                  <p className="text-[11px] text-slate-600">
                    {contractors.length === 0 ? 'Click "+ Register Worker" above to add in-house or outsourced crew.' : 'Try searching a different trade name or reset filter.'}
                  </p>
                </div>
              ) : (
                filteredContractors.map((c, idx) => {
                  const presence = getWorkerPresence(c);
                  const avatarUrl = getWorkerAvatar(c, idx);
                  const isSelected = c.id === selectedId;
                  const presenceConfig = getPresenceLabel(presence);
                  const subtitle = getPresenceSubtitle(c, presence);

                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className={`group p-3 rounded-xl cursor-pointer transition-all flex items-center gap-3 relative ${
                        isSelected 
                          ? 'bg-slate-900 border border-teal-500/40 shadow-md' 
                          : 'hover:bg-slate-900/60 border border-transparent'
                      }`}
                    >
                      {/* Avatar with Messenger Status Indicator */}
                      <div className="relative shrink-0">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={c.name}
                            className="w-12 h-12 rounded-full object-cover border border-slate-700/80 group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-teal-400 font-bold text-sm group-hover:scale-105 transition-transform">
                            {getWorkerInitials(c.name)}
                          </div>
                        )}
                        {/* Status Badge Ring on Avatar (Messenger Style) */}
                        <span 
                          className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${presenceConfig.dot} shadow-xs ${
                            presence === 'ONLINE' ? 'ring-2 ring-emerald-400/40' : ''
                          }`}
                          title={presenceConfig.text}
                        >
                          {presence === 'ONLINE' && (
                            <span className="absolute -top-0.5 -left-0.5 w-4 h-4 rounded-full bg-emerald-400 opacity-60 animate-ping"></span>
                          )}
                        </span>
                      </div>

                      {/* Info & Status Subtitle */}
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>
                            {c.name}
                          </h4>
                          <span className="text-[10px] font-mono text-slate-500 shrink-0">
                            {isOfficeOrExecutive(c)
                              ? 'Office Staff (1)'
                              : isIndividualStaffOrEngineer(c)
                                ? 'Field Pro (1)'
                                : `${c.activeManpower} crew`}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-400 truncate">
                          {c.roleTitle || c.specialty || 'Staff'} • <span className="text-slate-500">{c.company}</span>
                        </p>

                        {/* Presence Subtitle (Messenger-style status text) */}
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <span className={`text-[10px] font-mono truncate ${presenceConfig.color}`}>
                            {subtitle}
                          </span>
                        </div>
                      </div>

                      {/* Quick delete button */}
                      {onDeleteContractor && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Remove "${c.name}" from CTVill workforce roster?`)) {
                              onDeleteContractor(c.id);
                              notify(`Worker "${c.name}" removed.`);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 rounded-lg transition-all shrink-0 cursor-pointer"
                          title="Remove Worker"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Right indicator arrow */}
                      <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${
                        isSelected ? 'text-teal-400 translate-x-0.5' : 'text-slate-600 opacity-0 group-hover:opacity-100'
                      }`} />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Full Worker Profile View & Field Dossier */}
          <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-lg flex flex-col h-[600px] lg:h-[740px]">
            {selectedContractor ? (
              <>
                {/* Profile Cover & Header */}
                <div className="relative bg-gradient-to-r from-slate-900 via-slate-850 to-teal-950/40 border-b border-slate-800 p-5 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {/* Large Profile Picture with Online Status Beacon */}
                      <div className="relative shrink-0">
                        {selectedAvatar ? (
                          <img
                            src={selectedAvatar}
                            alt={selectedContractor.name}
                            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-teal-500/50 shadow-xl"
                          />
                        ) : (
                          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-800 border-2 border-teal-500/50 shadow-xl flex items-center justify-center text-teal-400 font-black text-xl">
                            {getWorkerInitials(selectedContractor.name)}
                          </div>
                        )}
                        <span 
                          className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border-2 border-slate-950 ${
                            getPresenceLabel(selectedPresence).dot
                          } shadow-md flex items-center justify-center`}
                          title={getPresenceLabel(selectedPresence).text}
                        >
                          {selectedPresence === 'ONLINE' && (
                            <span className="w-2 h-2 rounded-full bg-white"></span>
                          )}
                        </span>
                      </div>

                      {/* Profile Name & Primary Tags */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                            {selectedContractor.name}
                          </h2>
                          {selectedContractor.employmentType !== 'OUTSOURCED' ? (
                            <span className="bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                              🏢 CTVILL IN-HOUSE
                            </span>
                          ) : (
                            <span className="bg-amber-950/80 border border-amber-700 text-amber-300 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                              🤝 OUTSOURCED PARTNER
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-300 font-medium">
                          {selectedContractor.roleTitle || selectedContractor.specialty || 'General Trade Specialist'}
                        </p>

                        <p className="text-xs text-slate-500 font-mono">
                          {selectedContractor.company} • ID: <span className="text-slate-400">{selectedContractor.id}</span>
                        </p>
                      </div>
                    </div>

                    {/* Interactive Presence Status Switcher (Live Toggle) */}
                    <div className="bg-slate-900/80 border border-slate-800 p-2 rounded-xl self-start sm:self-center space-y-1.5 shrink-0">
                      <div className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Radio className="w-3 h-3 text-teal-400" />
                        <span>Field Presence Status</span>
                      </div>
                      <div className="flex items-center gap-1 font-mono text-[11px]">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus('ONLINE')}
                          className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                            selectedPresence === 'ONLINE'
                              ? 'bg-emerald-600 text-white font-bold shadow-xs'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                          title="Mark Active On-Site"
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-300"></span>
                          <span>Active</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus('BREAK')}
                          className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                            selectedPresence === 'BREAK'
                              ? 'bg-amber-600 text-white font-bold shadow-xs'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                          title="Mark On Meal Break"
                        >
                          <span className="w-2 h-2 rounded-full bg-amber-300"></span>
                          <span>Break</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus('OFFLINE')}
                          className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                            selectedPresence === 'OFFLINE'
                              ? 'bg-slate-700 text-white font-bold shadow-xs'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                          title="Mark Off-Shift"
                        >
                          <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                          <span>Off</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center gap-2 pt-4 mt-4 border-t border-slate-800/80 flex-wrap">
                    <button
                      type="button"
                      onClick={() => onVerifyRollCall(selectedContractor.id)}
                      className="px-3.5 py-1.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-300 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Verify Roll-Call Muster</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenAllocationModal(selectedContractor)}
                      className="px-3.5 py-1.5 bg-blue-950 hover:bg-blue-900 border border-blue-700/80 text-blue-300 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Sliders className="w-3.5 h-3.5 text-blue-400" />
                      <span>Manual Site &amp; Zone Allocation</span>
                    </button>

                    <div className="ml-auto flex items-center gap-1">
                      {onDeleteContractor && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Remove "${selectedContractor.name}" from CTVill workforce roster?`)) {
                              onDeleteContractor(selectedContractor.id);
                              notify(`Worker "${selectedContractor.name}" removed.`);
                            }
                          }}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                          title="Remove Worker"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Worker Dossier & Field Specifications */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {/* Live Jobsite Assignment Card */}
                  <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400 flex items-center gap-1.5 font-bold">
                        <MapPin className="w-3.5 h-3.5 text-teal-400" />
                        Commercial Project &amp; Zone Assignment
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenAllocationModal(selectedContractor)}
                          className="text-[11px] font-mono text-teal-400 hover:text-teal-300 underline cursor-pointer"
                        >
                          Edit Allocation
                        </button>
                        <span className="text-slate-600">|</span>
                        <span className="text-emerald-400 font-bold">
                          ● {getPresenceLabel(selectedPresence).text}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="bg-slate-950/80 border border-slate-800 p-2.5 rounded-lg space-y-1">
                        <span className="text-[10px] font-mono text-slate-500 block">Current Project</span>
                        <strong className="text-white text-xs block truncate">
                          {selectedContractor.activeProjectSite || 'Unassigned (General Pool)'}
                        </strong>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {selectedContractor.activeProjectSite ? 'Commercial Construction Site' : 'Tap "Manual Allocation" to assign'}
                        </span>
                      </div>

                      <div className="bg-slate-950/80 border border-slate-800 p-2.5 rounded-lg space-y-1">
                        <span className="text-[10px] font-mono text-slate-500 block">Assigned Work Zone</span>
                        <strong className="text-slate-200 text-xs block truncate">
                          {selectedContractor.assignedZone || 'General Site Area'}
                        </strong>
                        <span className="text-[10px] text-slate-400 font-mono">Shift: 07:00 AM – 04:00 PM</span>
                      </div>

                      <div className="bg-slate-950/80 border border-slate-800 p-2.5 rounded-lg space-y-1">
                        <span className="text-[10px] font-mono text-slate-500 block">Contact Phone</span>
                        <strong className="text-white text-xs block truncate">
                          {selectedContractor.contact || 'No contact provided'}
                        </strong>
                        <span className="text-[10px] text-slate-400 font-mono">Mobile / Radio Channel</span>
                      </div>
                    </div>
                  </div>

                  {/* Graphical Metrics & KPIs */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Active Crew / Role Metric */}
                    <div className="bg-slate-900/50 border border-slate-800 p-3.5 rounded-xl space-y-1">
                      <span className="text-[10px] font-mono text-slate-400 block">
                        {isOfficeOrExecutive(selectedContractor) 
                          ? 'Workforce Class' 
                          : isIndividualStaffOrEngineer(selectedContractor) 
                            ? 'Field Deployment' 
                            : 'Crew Managed'}
                      </span>
                      <div className="flex items-baseline gap-1">
                        <strong className="text-lg font-bold text-white font-mono">
                          {isOfficeOrExecutive(selectedContractor) 
                            ? 'Corporate' 
                            : isIndividualStaffOrEngineer(selectedContractor) 
                              ? 'Supervisor' 
                              : selectedContractor.activeManpower}
                        </strong>
                        <span className="text-xs text-slate-500">
                          {isOfficeOrExecutive(selectedContractor) || isIndividualStaffOrEngineer(selectedContractor) 
                            ? '(1 Person)' 
                            : 'workers'}
                        </span>
                      </div>
                      <span className="text-[10px] text-teal-400 font-mono">
                        {isOfficeOrExecutive(selectedContractor) 
                          ? 'Executive & Admin Oversight' 
                          : isIndividualStaffOrEngineer(selectedContractor) 
                            ? 'Dedicated Site Professional' 
                            : 'Skilled craft roster'}
                      </span>
                    </div>

                    {/* QA Inspection Score */}
                    <div className="bg-slate-900/50 border border-slate-800 p-3.5 rounded-xl space-y-1.5">
                      <span className="text-[10px] font-mono text-slate-400 block">QA Inspection Score</span>
                      {typeof selectedContractor.rating === 'number' && selectedContractor.rating > 0 ? (
                        <>
                          <div className="flex items-center justify-between text-xs font-mono">
                            <strong className="text-amber-400 font-bold text-sm">
                              ⭐ {selectedContractor.rating.toFixed(1)} / 5.0
                            </strong>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-amber-400 rounded-full"
                              style={{ width: `${(selectedContractor.rating / 5) * 100}%` }}
                            ></div>
                          </div>
                        </>
                      ) : (
                        <div className="space-y-1">
                          <strong className="text-slate-500 font-mono text-xs block">Pending QA Audit</strong>
                          <span className="text-[10px] text-slate-600 block">No field QA audits logged yet</span>
                        </div>
                      )}
                    </div>

                    {/* Milestone Progress Pace */}
                    <div className="bg-slate-900/50 border border-slate-800 p-3.5 rounded-xl space-y-1.5">
                      <span className="text-[10px] font-mono text-slate-400 block">Milestone Pace</span>
                      {typeof selectedContractor.milestoneProgress === 'number' && selectedContractor.milestoneProgress > 0 ? (
                        <>
                          <div className="flex items-center justify-between text-xs font-mono">
                            <strong className="text-blue-400 font-bold text-sm">
                              {selectedContractor.milestoneProgress}%
                            </strong>
                            <span className="text-[10px] text-slate-500">
                              {selectedContractor.milestoneProgress >= 100 ? 'Completed' : 'On Track'}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${Math.min(100, selectedContractor.milestoneProgress)}%` }}
                            ></div>
                          </div>
                        </>
                      ) : (
                        <div className="space-y-1">
                          <strong className="text-slate-500 font-mono text-xs block">No Active Milestone</strong>
                          <span className="text-[10px] text-slate-600 block">Pace tracked via project tasks</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Financial / Compensation Breakdown */}
                  <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400 font-bold flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-teal-400" />
                        Compensation &amp; Contract Framework
                      </span>
                      <span className="text-slate-500 text-[10px]">PHILIPPINE PESO (₱)</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-500 block">Daily Wage</span>
                        <strong className="text-emerald-400 text-xs">
                          {selectedContractor.dailyRate ? `₱${selectedContractor.dailyRate.toLocaleString()}` : 'Salaried'}
                        </strong>
                      </div>
                      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-500 block">Monthly Equivalent</span>
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

                  {/* Certifications & Trade Badges */}
                  <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-4 space-y-2">
                    <span className="text-xs font-mono text-slate-400 block font-bold">
                      Professional Accreditations &amp; Safety Badges
                    </span>
                    {selectedContractor.certifications && selectedContractor.certifications.length > 0 ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {selectedContractor.certifications.map((cert, cIdx) => (
                          <span 
                            key={cIdx} 
                            className="bg-teal-950/60 border border-teal-800 text-teal-300 text-[10px] font-mono px-2.5 py-1 rounded-lg"
                          >
                            ✓ {cert}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="pt-1 text-slate-600 text-[11px] font-mono flex items-center gap-1.5">
                        <span>No registered accreditations or trade certifications recorded yet.</span>
                      </div>
                    )}
                  </div>

                  {/* Recent Roll-Call Audits for this Contractor */}
                  <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-300 font-bold flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        Recent Field Roll-Call Audits
                      </span>
                      <span className="text-slate-500 text-[10px]">{workerAudits.length} Records</span>
                    </div>

                    {workerAudits.length === 0 ? (
                      <div className="text-center py-3 text-slate-500 text-xs font-mono">
                        No recent roll-call audit logged today for this contractor. Click "Verify Roll-Call Muster" to register attendance.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-800/80">
                        {workerAudits.slice(0, 3).map(audit => (
                          <div key={audit.id} className="py-2 flex items-center justify-between gap-2 text-xs font-mono">
                            <div>
                              <span className="text-white font-bold block">{audit.date}</span>
                              <span className="text-slate-500 text-[10px]">{audit.assignedSectorOrLot} • {audit.shift}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-emerald-400 font-bold block">
                                {audit.verifiedHeadcount} / {audit.claimedHeadcount} Verified
                              </span>
                              <span className="text-[10px] text-teal-400">
                                {audit.verificationStatus}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center p-8 text-center text-slate-500">
                <div>
                  <Users className="w-12 h-12 mx-auto text-slate-600 mb-2" />
                  <p className="text-sm font-bold text-slate-400">
                    {contractors.length === 0 ? 'No Workers Registered' : 'Select a worker from the roster'}
                  </p>
                  <p className="text-xs text-slate-600">
                    {contractors.length === 0 
                      ? 'Register construction workers or contractors to manage presence, trade allocations, and roll-calls.' 
                      : 'Click on any contact on the left to view their profile, active status, and credentials.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* GRID CARDS VIEW (Alternative view mode) */
        filteredContractors.length === 0 ? (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 space-y-2">
            <Users className="w-10 h-10 mx-auto text-slate-600" />
            <p className="text-sm font-bold text-slate-400">{contractors.length === 0 ? 'No Workers Registered' : 'No personnel match filter'}</p>
            <p className="text-xs text-slate-600">{contractors.length === 0 ? 'Click "+ Register Worker" above to add your first worker.' : 'Try resetting search or filters.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContractors.map((c, idx) => {
            const presence = getWorkerPresence(c);
            const avatarUrl = getWorkerAvatar(c, idx);
            const presenceConfig = getPresenceLabel(presence);

            return (
              <div 
                key={c.id} 
                className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-md space-y-3.5 transition-all"
              >
                {/* Header with Avatar and Online Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={c.name}
                          className="w-12 h-12 rounded-full object-cover border border-slate-700"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-teal-400 font-bold text-sm">
                          {getWorkerInitials(c.name)}
                        </div>
                      )}
                      <span 
                        className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${presenceConfig.dot}`}
                        title={presenceConfig.text}
                      ></span>
                    </div>

                    <div className="space-y-0.5 min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{c.name}</h4>
                      <p className="text-[11px] text-slate-400 truncate">
                        {c.roleTitle || c.specialty || 'Staff'}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono truncate">{c.company}</p>
                    </div>
                  </div>

                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold border ${presenceConfig.bg} ${presenceConfig.border} ${presenceConfig.color} shrink-0`}>
                    ● {presenceConfig.text}
                  </span>
                </div>

                {/* Status Subtitle */}
                <div className="text-[11px] font-mono text-slate-400 bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                  <span className="text-teal-400">Assignment: </span>
                  <span>{c.assignedZone || 'Level 4 Fit-Out'} • {c.activeProjectSite || 'NexBridge Hub'}</span>
                </div>

                {/* Gauges & Progress */}
                <div className="space-y-2 pt-1 font-sans">
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="bg-slate-900/70 border border-slate-800 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-500 block">
                        {isOfficeOrExecutive(c) ? 'Classification' : isIndividualStaffOrEngineer(c) ? 'Deployment' : 'Crew Deployed'}
                      </span>
                      <strong className="text-white text-xs">
                        {isOfficeOrExecutive(c) ? 'Office Staff (1)' : isIndividualStaffOrEngineer(c) ? 'Field Pro (1)' : `${c.activeManpower} Workers`}
                      </strong>
                    </div>
                    <div className="bg-slate-900/70 border border-slate-800 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-500 block">Daily Rate</span>
                      <strong className="text-emerald-400 text-xs">
                        {c.dailyRate ? `₱${c.dailyRate.toLocaleString()}` : 'Salaried'}
                      </strong>
                    </div>
                  </div>

                  {/* QA Rating */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="text-slate-400 text-[11px]">QA Score</span>
                      {typeof c.rating === 'number' && c.rating > 0 ? (
                        <span className="text-amber-400 font-bold text-xs">⭐ {c.rating.toFixed(1)} / 5.0</span>
                      ) : (
                        <span className="text-slate-500 text-[10px]">Pending QA</span>
                      )}
                    </div>
                    {typeof c.rating === 'number' && c.rating > 0 && (
                      <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-amber-400 rounded-full" 
                          style={{ width: `${(c.rating / 5) * 100}%` }}
                        ></div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(c.id);
                      setViewMode('MESSENGER');
                    }}
                    className="flex-1 py-1.5 px-2 bg-teal-950 hover:bg-teal-900 border border-teal-800/80 text-teal-300 rounded-lg text-xs font-mono font-bold cursor-pointer transition-colors flex items-center justify-center gap-1"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Open Profile</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onVerifyRollCall(c.id)}
                    className="py-1.5 px-2.5 bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white rounded-lg text-xs font-mono font-bold cursor-pointer transition-colors flex items-center justify-center gap-1"
                    title="Verify Roll-Call Muster"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                  </button>

                  {onDeleteContractor && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Remove "${c.name}" from CTVill workforce roster?`)) {
                          onDeleteContractor(c.id);
                          notify(`Worker "${c.name}" removed.`);
                        }
                      }}
                      className="py-1.5 px-2 bg-slate-800 hover:bg-rose-950/70 border border-slate-700 hover:border-rose-700/60 text-slate-400 hover:text-rose-300 rounded-lg text-xs font-mono font-bold cursor-pointer transition-colors flex items-center justify-center gap-1"
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
        )
      )}

      {/* MANUAL MANPOWER & SITE ALLOCATION MODAL */}
      {isAllocModalOpen && allocContractor && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleIn">
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-teal-400" />
                <h3 className="font-bold text-white text-sm">Manual Site &amp; Zone Allocation</h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsAllocModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAllocationSubmit} className="p-5 space-y-4 text-xs font-sans">
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] font-mono text-slate-400 uppercase">Target Personnel / Contractor</span>
                <div className="font-bold text-white text-sm">{allocContractor.name}</div>
                <div className="text-teal-400 font-mono text-[11px]">{allocContractor.company} • {allocContractor.specialty || 'General Trades'}</div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-slate-300 font-bold block">
                  Assign to Commercial Project Site
                </label>
                {projects && projects.length > 0 ? (
                  <select
                    value={allocSite}
                    onChange={(e) => setAllocSite(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-sans focus:border-teal-500 focus:outline-none"
                  >
                    <option value="">-- General Site Pool (Unassigned) --</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={allocSite}
                    onChange={(e) => setAllocSite(e.target.value)}
                    placeholder="e.g. Commercial Site Alpha (or leave blank for pool)"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-sans focus:border-teal-500 focus:outline-none"
                  />
                )}
                <span className="text-[10px] text-slate-500 font-mono">Select a registered site or assign to general pool.</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-slate-300 font-bold block">
                  Assigned Work Zone / Area
                </label>
                <input
                  type="text"
                  value={allocZone}
                  onChange={(e) => setAllocZone(e.target.value)}
                  placeholder="e.g. Ground Floor Civil, Level 2 Electrical, Facade"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-sans focus:border-teal-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 font-mono">Specific area or floor where this crew operates.</span>
              </div>

              {isOfficeOrExecutive(allocContractor) ? (
                <div className="p-3 bg-purple-950/40 border border-purple-800/50 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-purple-300 font-bold flex items-center gap-1.5">
                      🏢 Corporate Office Executive / Management
                    </span>
                    <span className="text-[10px] font-mono bg-purple-900/70 text-purple-200 px-2 py-0.5 rounded-full font-bold border border-purple-700/60">
                      Headcount: 1 (Fixed)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Assigned for executive governance, project sponsorship, and management oversight. Office staff do not contribute to physical labor crew headcount and cannot be scaled as field laborers.
                  </p>
                </div>
              ) : isIndividualStaffOrEngineer(allocContractor) ? (
                <div className="p-3 bg-cyan-950/40 border border-cyan-800/50 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-cyan-300 font-bold flex items-center gap-1.5">
                      👷 Field Professional / Site Supervisor
                    </span>
                    <span className="text-[10px] font-mono bg-cyan-900/70 text-cyan-200 px-2 py-0.5 rounded-full font-bold border border-cyan-700/60">
                      Headcount: 1 (Fixed)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Dedicated individual site deployment (e.g. Project Manager, Site Engineer, Safety Officer).
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-slate-300 font-bold block flex items-center justify-between">
                    <span>Active Crew Headcount</span>
                    <span className="text-[10px] font-normal text-teal-400">Trade Crew Gang Size</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={allocHeadcount}
                      onChange={(e) => setAllocHeadcount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-28 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-sm focus:border-teal-500 focus:outline-none"
                    />
                    <span className="text-slate-400 font-mono text-xs">assigned trade craft laborers on-site</span>
                  </div>
                </div>
              )}

              <div className="p-3 bg-blue-950/40 border border-blue-900/50 rounded-xl text-[11px] text-blue-300 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>Manual Human Decision: You have full manual control over this labor deployment. AI will only provide optional suggestions.</span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setIsAllocModalOpen(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl font-bold cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl font-bold font-mono cursor-pointer shadow-md transition flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Manual Allocation</span>
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
