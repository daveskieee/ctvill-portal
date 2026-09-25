/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileCheck, AlertTriangle, Clock, ShieldCheck, Plus, 
  Building2, Calendar, Search, Filter, ExternalLink, 
  CheckCircle2, XCircle, RefreshCw, X, FileText, Download,
  Edit3, Trash2
} from 'lucide-react';
import { GovernmentPermit, PermitType, ProjectProfile } from '../types';

interface GovernmentPermitsTrackerProps {
  permits: GovernmentPermit[];
  projects?: ProjectProfile[];
  onAddPermit?: (permit: Partial<GovernmentPermit>) => Promise<void>;
  onUpdatePermitStatus?: (permitId: string, status: GovernmentPermit['status'], notes?: string) => Promise<void>;
  onUpdatePermit?: (permitId: string, updates: Partial<GovernmentPermit>) => Promise<void>;
  onDeletePermit?: (permitId: string) => Promise<void>;
}

export default function GovernmentPermitsTracker({
  permits = [],
  projects = [],
  onAddPermit,
  onUpdatePermitStatus,
  onUpdatePermit,
  onDeletePermit
}: GovernmentPermitsTrackerProps) {
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingPermit, setEditingPermit] = useState<GovernmentPermit | null>(null);

  // Dynamically aggregate project names from database and existing permits
  const availableProjectNames = useMemo(() => {
    const names = new Set<string>();
    (projects || []).forEach(p => {
      if (p.name?.trim()) names.add(p.name.trim());
    });
    (permits || []).forEach(p => {
      if (p.projectName?.trim()) names.add(p.projectName.trim());
    });
    if (names.size === 0) {
      names.add('Commercial Fit-Out Site 1');
    }
    return Array.from(names);
  }, [projects, permits]);

  // System-recorded permit names with industry presets
  const defaultSuggestedNames = useMemo(() => [
    'Permit to construct',
    'LGU Building Permit',
    'BFP Fire Safety Evaluation Clearance (FSEC)',
    'Fire Safety Inspection Certificate (FSIC)',
    'DOLE Construction Safety & Health Program (CSHP)',
    'Occupancy Permit',
    'Barangay Construction Clearance',
    'Sanitary & Plumbing Clearance',
    'Electrical & Mechanical Installation Permit',
    'PEZA Environmental & Fit-Out Clearances',
    'Excavation & Shoring Permit',
    'Architectural Fit-Out Clearances'
  ], []);

  const [suggestedPermitNames, setSuggestedPermitNames] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('ctvill_saved_permit_names');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return Array.from(new Set([...parsed, ...defaultSuggestedNames]));
        }
      }
    } catch {}
    return defaultSuggestedNames;
  });

  const recordPermitName = (name: string) => {
    if (!name.trim()) return;
    setSuggestedPermitNames(prev => {
      const updated = Array.from(new Set([name.trim(), ...prev]));
      try {
        localStorage.setItem('ctvill_saved_permit_names', JSON.stringify(updated.slice(0, 50)));
      } catch {}
      return updated;
    });
  };

  // Add Form State
  const [newProject, setNewProject] = useState(availableProjectNames[0] || 'Commercial Fit-Out Site 1');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<PermitType>('LGU_BUILDING_PERMIT');
  const [newAgency, setNewAgency] = useState('City Engineering Office - Cabuyao');
  const [newRef, setNewRef] = useState('');
  const [newAppDate, setNewAppDate] = useState(new Date().toISOString().split('T')[0]);
  const [newExpDate, setNewExpDate] = useState('2027-02-28');
  const [newNotes, setNewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync default new project when projects change
  useEffect(() => {
    if (availableProjectNames.length > 0 && (!newProject || !availableProjectNames.includes(newProject))) {
      setNewProject(availableProjectNames[0]);
    }
  }, [availableProjectNames]);

  // Edit Form State
  const [editName, setEditName] = useState('');
  const [editProject, setEditProject] = useState('');
  const [editType, setEditType] = useState<PermitType>('LGU_BUILDING_PERMIT');
  const [editAgency, setEditAgency] = useState('');
  const [editRef, setEditRef] = useState('');
  const [editAppDate, setEditAppDate] = useState('');
  const [editExpDate, setEditExpDate] = useState('');
  const [editStatus, setEditStatus] = useState<GovernmentPermit['status']>('PENDING');
  const [editNotes, setEditNotes] = useState('');

  // KPI Calculations
  const totalPermits = permits.length;
  const approvedPermits = permits.filter(p => p.status === 'APPROVED').length;
  const pendingPermits = permits.filter(p => p.status === 'PENDING').length;
  const expiredOrRenewal = permits.filter(p => p.status === 'EXPIRED' || p.status === 'UNDER_RENEWAL').length;

  const filteredPermits = permits.filter(p => {
    if (projectFilter !== 'ALL' && p.projectName.trim().toLowerCase() !== projectFilter.trim().toLowerCase()) {
      return false;
    }
    if (statusFilter !== 'ALL' && p.status !== statusFilter) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        p.permitName.toLowerCase().includes(q) ||
        p.referenceNo.toLowerCase().includes(q) ||
        p.issuingAgency.toLowerCase().includes(q) ||
        p.projectName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newAgency.trim()) return;

    recordPermitName(newName.trim());
    setIsSubmitting(true);
    try {
      const payload: Partial<GovernmentPermit> = {
        projectName: newProject,
        permitName: newName.trim(),
        permitType: newType || 'LGU_BUILDING_PERMIT',
        issuingAgency: newAgency.trim(),
        referenceNo: newRef.trim() || `REF-${Date.now().toString().slice(-5)}`,
        status: 'PENDING',
        applicationDate: newAppDate,
        expiryDate: newExpDate,
        notes: newNotes.trim()
      };

      if (onAddPermit) {
        await onAddPermit(payload);
      } else {
        await fetch('/api/permits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      setShowAddModal(false);
      setNewName('');
      setNewRef('');
      setNewNotes('');
    } catch (err) {
      console.error('Failed to add permit:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (permit: GovernmentPermit) => {
    setEditingPermit(permit);
    setEditName(permit.permitName);
    setEditProject(permit.projectName);
    setEditType(permit.permitType);
    setEditAgency(permit.issuingAgency);
    setEditRef(permit.referenceNo);
    setEditAppDate(permit.applicationDate || '');
    setEditExpDate(permit.expiryDate || '');
    setEditStatus(permit.status);
    setEditNotes(permit.notes || '');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPermit) return;

    recordPermitName(editName.trim());
    setIsSubmitting(true);
    try {
      const updates: Partial<GovernmentPermit> = {
        permitName: editName.trim(),
        projectName: editProject,
        permitType: editType || 'LGU_BUILDING_PERMIT',
        issuingAgency: editAgency.trim(),
        referenceNo: editRef.trim(),
        applicationDate: editAppDate || null,
        expiryDate: editExpDate || null,
        status: editStatus,
        notes: editNotes.trim()
      };

      if (onUpdatePermit) {
        await onUpdatePermit(editingPermit.id, updates);
      } else {
        await fetch(`/api/permits/${editingPermit.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        });
      }

      setEditingPermit(null);
    } catch (err) {
      console.error('Failed to update permit:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (permitId: string, status: GovernmentPermit['status']) => {
    try {
      if (onUpdatePermitStatus) {
        await onUpdatePermitStatus(permitId, status);
      } else {
        await fetch(`/api/permits/${permitId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status })
        });
      }
    } catch (err) {
      console.error('Failed to update permit status:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this government permit record?')) return;
    try {
      if (onDeletePermit) {
        await onDeletePermit(id);
      } else {
        await fetch(`/api/permits/${id}`, { method: 'DELETE' });
      }
    } catch (err) {
      console.error('Failed to delete permit:', err);
    }
  };

  // Export Compliance Matrix as CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Reference No', 'Permit Name', 'Type', 'Project', 'Issuing Agency', 'Application Date', 'Expiry Date', 'Status', 'Notes'];
    const rows = filteredPermits.map(p => [
      p.id,
      p.referenceNo || '',
      `"${p.permitName.replace(/"/g, '""')}"`,
      p.permitType,
      `"${p.projectName.replace(/"/g, '""')}"`,
      `"${p.issuingAgency.replace(/"/g, '""')}"`,
      p.applicationDate || '',
      p.expiryDate || '',
      p.status,
      `"${(p.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Permit_Compliance_Matrix_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getPermitTypeLabel = (type: PermitType) => {
    switch (type) {
      case 'LGU_BUILDING_PERMIT': return 'LGU Building Permit';
      case 'PEZA_FITOUT_PERMIT': return 'PEZA Fit-Out Clearance';
      case 'FSIC_FIRE_SAFETY': return 'BFP Fire Safety (FSIC)';
      case 'DOLE_CSHP': return 'DOLE Safety (CSHP)';
      case 'OCCUPANCY_PERMIT': return 'Certificate of Occupancy';
      case 'BARANGAY_CLEARANCE': return 'Barangay Clearance';
      default: return type;
    }
  };

  // Calculate days to expiration badge
  const renderExpiryBadge = (expiryDate?: string | null, status?: GovernmentPermit['status']) => {
    if (!expiryDate) {
      return <span className="text-[10px] text-slate-500 font-mono">Permanent / Sign-Off</span>;
    }

    const today = new Date();
    const exp = new Date(expiryDate);
    const diffTime = exp.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0 || status === 'EXPIRED') {
      return (
        <div className="flex flex-col items-start">
          <span className="text-[10px] font-mono text-slate-400">{expiryDate}</span>
          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-950/80 text-rose-300 border border-rose-800">
            <AlertTriangle className="w-2.5 h-2.5" /> Expired {Math.abs(diffDays)}d ago
          </span>
        </div>
      );
    }

    if (diffDays <= 30) {
      return (
        <div className="flex flex-col items-start">
          <span className="text-[10px] font-mono text-slate-300">{expiryDate}</span>
          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-800">
            <Clock className="w-2.5 h-2.5" /> Due in {diffDays} days
          </span>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-start">
        <span className="text-[10px] font-mono text-slate-300">{expiryDate}</span>
        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-900/60">
          <ShieldCheck className="w-2.5 h-2.5" /> {diffDays} days valid
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-6 rounded-2xl backdrop-blur-xl shadow-2xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold tracking-wider uppercase">
              Regulatory Compliance
            </span>
            <span className="text-xs text-slate-400">Statutory Fit-Out & Safety Permits</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <FileCheck className="w-7 h-7 text-amber-400" />
            Government Permits & Legal Compliance
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Track legal compliance, regulatory filings, PEZA clearances, and renewal expirations for each commercial fit-out project.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3.5 py-2.5 rounded-xl border border-slate-700 text-xs transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-amber-400" />
            Export Matrix (CSV)
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl transition shadow-lg shadow-amber-500/20 text-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            File Permit Application
          </button>
        </div>
      </div>

      {/* Compliance Overview KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Total Active Permits</span>
            <FileText className="w-5 h-5 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2 font-mono">
            {totalPermits} Filed
          </div>
          <div className="text-xs text-slate-400 mt-1">
            LGU, PEZA, BFP, and DOLE filings
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Approved & Valid</span>
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2 font-mono">
            {approvedPermits} Permits
          </div>
          <div className="text-xs text-emerald-500/80 mt-1">
            {totalPermits > 0 ? Math.round((approvedPermits / totalPermits) * 100) : 0}% fully approved compliance
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Pending Evaluation</span>
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-2 font-mono">
            {pendingPermits} Pending
          </div>
          <div className="text-xs text-amber-500/80 mt-1">
            Under agency review & sign-off
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Renewal Required</span>
            <AlertTriangle className="w-5 h-5 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 mt-2 font-mono">
            {expiredOrRenewal} Urgent
          </div>
          <div className="text-xs text-rose-500/80 mt-1">
            Expiring within 30 days or lapsed
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Project Filter */}
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-400" />
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 font-mono"
            >
              <option value="ALL">All Commercial Projects ({availableProjectNames.length})</option>
              {availableProjectNames.map((projName) => (
                <option key={projName} value={projName}>{projName}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">All Compliance Statuses</option>
              <option value="APPROVED">Approved Only</option>
              <option value="PENDING">Pending Review</option>
              <option value="UNDER_RENEWAL">Under Renewal</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            list="permit-search-suggestions"
            placeholder="Search agency, permit, reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-amber-500"
          />
          <datalist id="permit-search-suggestions">
            {suggestedPermitNames.map((sName, i) => (
              <option key={`search-sug-${i}`} value={sName} />
            ))}
          </datalist>
        </div>
      </div>

      {/* Permits Grid & Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            Active Regulatory Compliance Registry ({filteredPermits.length} Records)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Permit ID / Ref</th>
                <th className="py-3.5 px-4">Permit Title & Scope</th>
                <th className="py-3.5 px-4">Commercial Project</th>
                <th className="py-3.5 px-4">Issuing Agency</th>
                <th className="py-3.5 px-4">Renewal / Expiry</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredPermits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-500 italic">
                    No permit records found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredPermits.map((p) => {
                  return (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-amber-400">
                        <div>{p.id}</div>
                        <div className="text-[10px] text-slate-500 font-normal">{p.referenceNo || '—'}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white">{p.permitName}</div>
                        <div className="text-[10px] text-amber-500/90 font-mono">{getPermitTypeLabel(p.permitType)}</div>
                        {p.notes && <div className="text-[10px] text-slate-500 italic mt-0.5 max-w-xs truncate">{p.notes}</div>}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 font-medium">
                        {p.projectName}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {p.issuingAgency}
                      </td>
                      <td className="py-3.5 px-4">
                        {renderExpiryBadge(p.expiryDate, p.status)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {p.status === 'APPROVED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> Approved
                          </span>
                        ) : p.status === 'PENDING' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800">
                            <Clock className="w-3 h-3" /> Pending Review
                          </span>
                        ) : p.status === 'UNDER_RENEWAL' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-950/80 text-blue-300 border border-blue-800">
                            <RefreshCw className="w-3 h-3" /> Renewal Filed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-800">
                            <XCircle className="w-3 h-3" /> Expired
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {p.status !== 'APPROVED' && (
                            <button
                              onClick={() => handleStatusChange(p.id, 'APPROVED')}
                              className="px-2 py-1 rounded bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800 text-[10px] font-bold transition cursor-pointer"
                              title="Mark Approved"
                            >
                              Approve
                            </button>
                          )}
                          {p.status === 'APPROVED' && (
                            <button
                              onClick={() => handleStatusChange(p.id, 'UNDER_RENEWAL')}
                              className="px-2 py-1 rounded bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 border border-blue-800 text-[10px] font-bold transition cursor-pointer"
                              title="File Renewal"
                            >
                              Renew
                            </button>
                          )}
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1 text-slate-400 hover:text-amber-400 transition cursor-pointer"
                            title="Edit Permit Details"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Permit Application Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <FileCheck className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-bold text-white">File Government Permit Application</h3>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Commercial Project</label>
                <select
                  value={newProject}
                  onChange={(e) => setNewProject(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
                >
                  {availableProjectNames.map((projName) => (
                    <option key={projName} value={projName}>{projName}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-mono text-slate-400 uppercase">Permit Name / Classification</label>
                  <span className="text-[10px] text-amber-400 font-mono">System-remembered</span>
                </div>
                <input
                  type="text"
                  required
                  list="permit-names-list"
                  placeholder="e.g. Permit to construct, Fire Safety Inspection..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
                />
                <datalist id="permit-names-list">
                  {suggestedPermitNames.map((sug, i) => (
                    <option key={`p-sug-${i}`} value={sug} />
                  ))}
                </datalist>

                {/* Quick Suggestion Chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {suggestedPermitNames.slice(0, 5).map((sug, i) => (
                    <button
                      key={`chip-${i}`}
                      type="button"
                      onClick={() => setNewName(sug)}
                      className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 hover:bg-amber-950/80 text-slate-300 hover:text-amber-300 border border-slate-700 hover:border-amber-700 transition cursor-pointer"
                    >
                      + {sug}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Reference / Docket No.</label>
                <input
                  type="text"
                  placeholder="e.g. BFP-R4A-2026-991"
                  value={newRef}
                  onChange={(e) => setNewRef(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-mono focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Issuing Authority / Agency</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Office of the Building Official (OBO)"
                  value={newAgency}
                  onChange={(e) => setNewAgency(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Filing / Application Date</label>
                  <input
                    type="date"
                    value={newAppDate}
                    onChange={(e) => setNewAppDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Expiration / Renewal Target</label>
                  <input
                    type="date"
                    value={newExpDate}
                    onChange={(e) => setNewExpDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Compliance Notes & Endorsements</label>
                <textarea
                  rows={2}
                  placeholder="Special conditions, structural engineer sign-off, PEZA endorsement details..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Filing...' : 'Submit Permit Filing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Permit Modal */}
      {editingPermit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditingPermit(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <Edit3 className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-bold text-white">Edit Government Permit</h3>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Commercial Project</label>
                <select
                  value={editProject}
                  onChange={(e) => setEditProject(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
                >
                  {editProject && !availableProjectNames.includes(editProject) && (
                    <option value={editProject}>{editProject}</option>
                  )}
                  {availableProjectNames.map((projName) => (
                    <option key={projName} value={projName}>{projName}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-mono text-slate-400 uppercase">Permit Name / Classification</label>
                  <span className="text-[10px] text-amber-400 font-mono">Suggested names enabled</span>
                </div>
                <input
                  type="text"
                  required
                  list="permit-names-list-edit"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
                />
                <datalist id="permit-names-list-edit">
                  {suggestedPermitNames.map((sug, i) => (
                    <option key={`edit-sug-${i}`} value={sug} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Reference / Docket No.</label>
                <input
                  type="text"
                  value={editRef}
                  onChange={(e) => setEditRef(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-mono focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Issuing Authority / Agency</label>
                  <input
                    type="text"
                    required
                    value={editAgency}
                    onChange={(e) => setEditAgency(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as GovernmentPermit['status'])}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
                  >
                    <option value="PENDING">PENDING (Under Review)</option>
                    <option value="APPROVED">APPROVED (Valid)</option>
                    <option value="UNDER_RENEWAL">UNDER RENEWAL</option>
                    <option value="EXPIRED">EXPIRED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Filing / Application Date</label>
                  <input
                    type="date"
                    value={editAppDate}
                    onChange={(e) => setEditAppDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Expiration Target</label>
                  <input
                    type="date"
                    value={editExpDate}
                    onChange={(e) => setEditExpDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Compliance Notes & Endorsements</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingPermit(null)}
                  className="px-4 py-2 rounded-xl text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
