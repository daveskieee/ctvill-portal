/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, UserPlus, HardHat, DollarSign, Search, Edit3, Trash2, 
  Check, X, Plus, ShieldCheck, Building2, RefreshCw, CheckCircle2, AlertCircle, Lock 
} from 'lucide-react';
import { ProjectProfile, SiteWorker, UserSession } from '../types';
import { normalizeRole, UserRole } from '../utils/rbac';

interface WorkerMasterlistManagerProps {
  projects: ProjectProfile[];
  session?: UserSession | any;
  onRefreshData?: () => void;
  onNotify?: (msg: string) => void;
}

export default function WorkerMasterlistManager({
  projects,
  session,
  onRefreshData
}: WorkerMasterlistManagerProps) {
  const [workers, setWorkers] = useState<SiteWorker[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFilterPosition, setSelectedFilterPosition] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'INACTIVE' | 'ALL'>('ACTIVE');

  // RBAC Separation of Duties: Only Finance / HR can modify wage rates; OM has read-only rates
  const currentRole = normalizeRole(session?.role);
  const isFinance = currentRole === UserRole.FINANCE;
  const isOM = currentRole === UserRole.OM;
  const canEditWageRates = isFinance;

  // Modal State for New Worker
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [position, setPosition] = useState<string>('General Laborer');
  const [dailyRate, setDailyRate] = useState<string>('600');
  const [hourlyOtRate, setHourlyOtRate] = useState<string>('93.75');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Edit State
  const [editingWorker, setEditingWorker] = useState<SiteWorker | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Auto-compute OT rate whenever daily rate changes: (dailyRate / 8) * 1.25
  useEffect(() => {
    const rate = parseFloat(dailyRate);
    if (!isNaN(rate) && rate > 0) {
      const computed = ((rate / 8) * 1.25).toFixed(2);
      setHourlyOtRate(computed);
    }
  }, [dailyRate]);

  // Load Workers
  const fetchWorkers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/workers', {
        headers: { 'x-user-role': session?.role || 'ADMIN', 'x-user-id': session?.id || '' }
      });
      if (res.ok) {
        setWorkers(await res.json());
      }
    } catch (e) {
      console.error('Error fetching workers:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, []);

  // Save New Worker
  const handleCreateWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || parseFloat(dailyRate) <= 0) {
      alert('Please fill in first name, last name, and daily wage rate.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/workers', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': session?.role || 'ADMIN',
          'x-user-id': session?.id || ''
        },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          position: position.trim(),
          dailyRate: parseFloat(dailyRate),
          hourlyOtRate: parseFloat(hourlyOtRate),
          status: 'Active',
          projectIds: selectedProjectIds
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create worker');
      }

      setToastMessage({ text: 'Worker successfully registered into Labor Masterlist!', type: 'success' });
      setIsAddModalOpen(false);
      setFirstName('');
      setLastName('');
      setDailyRate('600');
      setSelectedProjectIds([]);
      await fetchWorkers();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Error creating worker');
    } finally {
      setIsSaving(false);
    }
  };

  // Update Worker
  const handleUpdateWorker = async () => {
    if (!editingWorker) return;
    try {
      const res = await fetch(`/api/workers/${editingWorker.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': session?.role || 'ADMIN' 
        },
        body: JSON.stringify({
          position: editingWorker.position,
          dailyRate: editingWorker.dailyRate,
          hourlyOtRate: editingWorker.hourlyOtRate,
          status: editingWorker.status
        })
      });

      if (!res.ok) throw new Error('Failed to update worker');
      setToastMessage({ text: 'Worker details updated successfully!', type: 'success' });
      setEditingWorker(null);
      await fetchWorkers();
    } catch (err: any) {
      alert(err.message || 'Failed to update worker');
    }
  };

  // Toggle Project Assignment
  const handleToggleProjectAssignment = async (workerId: string, projectId: string, isAssigned: boolean) => {
    try {
      if (isAssigned) {
        await fetch(`/api/workers/${workerId}/assign/${projectId}`, {
          method: 'DELETE',
          headers: { 'x-user-role': session?.role || 'ADMIN' }
        });
      } else {
        await fetch(`/api/workers/${workerId}/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-role': session?.role || 'ADMIN' },
          body: JSON.stringify({ projectId })
        });
      }
      await fetchWorkers();
    } catch (err) {
      console.error('Error toggling worker assignment:', err);
    }
  };

  // Filtered list
  const filteredWorkers = useMemo(() => {
    return workers.filter(w => {
      const matchesSearch = !searchQuery.trim() || 
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        w.position.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesPosition = selectedFilterPosition === 'ALL' || w.position.toLowerCase().includes(selectedFilterPosition.toLowerCase());

      const workerStatus = (w.status || 'Active').toLowerCase();
      const matchesStatus = 
        statusFilter === 'ALL' ? true :
        statusFilter === 'ACTIVE' ? workerStatus === 'active' :
        workerStatus !== 'active';

      return matchesSearch && matchesPosition && matchesStatus;
    });
  }, [workers, searchQuery, selectedFilterPosition, statusFilter]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold backdrop-blur-md border bg-emerald-950/90 text-emerald-200 border-emerald-500/50 animate-slideDown">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <HardHat className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight">Labor Workforce Masterlist</h1>
              <span className="text-[10px] font-mono uppercase bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                {isFinance ? 'FINANCE & COMPENSATION' : 'ADMIN / OPERATIONS'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage artisan trades, daily wage rates, statutory OT formulas • Assign personnel to commercial sites
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer self-start md:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Register New Worker</span>
        </button>
      </div>

      {/* Filter Bar with Status Toggle Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5">
        <div className="flex-1 flex flex-col sm:flex-row items-center gap-3">
          {/* Search */}
          <div className="w-full sm:flex-1 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by worker name or trade position..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Position Selector */}
          <div className="w-full sm:w-56">
            <select
              value={selectedFilterPosition}
              onChange={(e) => setSelectedFilterPosition(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="ALL">All Trade Positions</option>
              <option value="Foreman">Foreman</option>
              <option value="Carpenter">Carpenter</option>
              <option value="Electrician">Electrician</option>
              <option value="Welder">Welder / Steelman</option>
              <option value="Mason">Mason / Plasterer</option>
              <option value="Laborer">General Laborer</option>
            </select>
          </div>
        </div>

        {/* Status Toggle Tabs & Reload */}
        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
            {[
              { id: 'ACTIVE', label: 'Active', count: workers.filter(w => (w.status || 'Active').toLowerCase() === 'active').length },
              { id: 'INACTIVE', label: 'Inactive', count: workers.filter(w => (w.status || 'Active').toLowerCase() !== 'active').length },
              { id: 'ALL', label: 'All', count: workers.length }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === tab.id
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  statusFilter === tab.id ? 'bg-slate-950/20 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={fetchWorkers}
            disabled={isLoading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center border border-slate-700 transition-colors cursor-pointer shrink-0"
            title="Reload Workers"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Workers Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col flex-1">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white">
              {statusFilter === 'ACTIVE' 
                ? 'Active Labor Workforce' 
                : statusFilter === 'INACTIVE' 
                ? 'Inactive / Suspended Personnel' 
                : 'Total Labor Workforce Masterlist'} ({filteredWorkers.length} workers)
            </h2>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Default OT Formula: (Daily Rate / 8) • 1.25
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 font-semibold">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Worker Full Name</th>
                <th className="py-3 px-4">Trade Position</th>
                <th className="py-3 px-4 text-right">Daily Rate</th>
                <th className="py-3 px-4 text-right">Hourly OT Rate</th>
                <th className="py-3 px-4">Site Assignments</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredWorkers.map((w, idx) => (
                <tr key={w.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-mono text-slate-500">{idx + 1}</td>
                  
                  {/* Name */}
                  <td className="py-3 px-4">
                    <div className="font-bold text-white">{w.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{w.id}</div>
                  </td>

                  {/* Position */}
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-medium">
                      {w.position}
                    </span>
                  </td>

                  {/* Daily Rate */}
                  <td className="py-3 px-4 text-right font-mono text-slate-200 font-bold">
                    ₱{w.dailyRate.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>

                  {/* OT Rate */}
                  <td className="py-3 px-4 text-right font-mono text-amber-400 font-bold">
                    ₱{w.hourlyOtRate.toLocaleString('en-US', { minimumFractionDigits: 2 })}/hr
                  </td>

                  {/* Assigned Projects */}
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {projects.map(proj => {
                        const isAssigned = (w.assignedProjectIds || []).includes(proj.id);
                        return (
                          <button
                            key={proj.id}
                            onClick={() => handleToggleProjectAssignment(w.id, proj.id, isAssigned)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer border ${
                              isAssigned
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                            }`}
                            title={isAssigned ? `Assigned to ${proj.name}. Click to unassign.` : `Click to assign to ${proj.name}.`}
                          >
                            {proj.name.slice(0, 14)}...
                          </button>
                        );
                      })}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      w.status === 'Active'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {w.status}
                    </span>
                  </td>

                  {/* Edit */}
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => setEditingWorker(w)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
                      title="Edit Wage Rate & Position"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* REGISTER WORKER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-sm">Register Labor Personnel</h3>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateWorker} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Danilo"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Mercado"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Trade Position *</label>
                <input
                  type="text"
                  required
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="e.g. Lead Carpenter, General Foreman, Mason"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Daily Wage Rate (₱) *</label>
                  <input
                    type="number"
                    required
                    min="100"
                    step="10"
                    value={dailyRate}
                    onChange={(e) => setDailyRate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Hourly Overtime Rate (₱)
                    <span className="text-[10px] text-amber-400 font-normal ml-1">(Auto: &times; 1.25)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={hourlyOtRate}
                    onChange={(e) => setHourlyOtRate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Initial Project Site Assignments</label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto bg-slate-950 border border-slate-800 p-2 rounded-xl">
                  {projects.map(p => {
                    const checked = selectedProjectIds.includes(p.id);
                    return (
                      <label key={p.id} className="flex items-center gap-2 cursor-pointer select-none text-slate-300 hover:text-white">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedProjectIds(prev => [...prev, p.id]);
                            else setSelectedProjectIds(prev => prev.filter(x => x !== p.id));
                          }}
                          className="rounded bg-slate-900 border-slate-700 accent-amber-500"
                        />
                        <span className="text-xs">{p.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs rounded-xl font-bold cursor-pointer"
                >
                  {isSaving ? 'Registering...' : 'Save Worker Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT WORKER MODAL */}
      {editingWorker && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm">Edit Worker Profile & Rates</h3>
              <button onClick={() => setEditingWorker(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400">Worker:</span>
                <div className="font-bold text-white text-sm">{editingWorker.name}</div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Position</label>
                <input
                  type="text"
                  value={editingWorker.position}
                  onChange={(e) => setEditingWorker({ ...editingWorker, position: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                    <span>Daily Rate (₱)</span>
                    {!canEditWageRates && (
                      <span className="text-[10px] text-amber-400 font-normal">Read-Only</span>
                    )}
                  </label>
                  <input
                    type="number"
                    disabled={!canEditWageRates}
                    readOnly={!canEditWageRates}
                    value={editingWorker.dailyRate}
                    title={!canEditWageRates ? "Wage rates can only be modified by Finance or HR." : undefined}
                    onChange={(e) => {
                      if (!canEditWageRates) return;
                      const dr = parseFloat(e.target.value) || 0;
                      const ot = Number(((dr / 8) * 1.25).toFixed(2));
                      setEditingWorker({ ...editingWorker, dailyRate: dr, hourlyOtRate: ot });
                    }}
                    className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-white font-mono ${
                      !canEditWageRates 
                        ? 'border-slate-800 bg-slate-900/60 text-slate-400 cursor-not-allowed opacity-75' 
                        : 'border-slate-700'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                    <span>Hourly OT Rate (₱)</span>
                    {!canEditWageRates && (
                      <span className="text-[10px] text-amber-400 font-normal">Read-Only</span>
                    )}
                  </label>
                  <input
                    type="number"
                    disabled={!canEditWageRates}
                    readOnly={!canEditWageRates}
                    value={editingWorker.hourlyOtRate}
                    title={!canEditWageRates ? "Wage rates can only be modified by Finance or HR." : undefined}
                    onChange={(e) => {
                      if (!canEditWageRates) return;
                      setEditingWorker({ ...editingWorker, hourlyOtRate: parseFloat(e.target.value) || 0 });
                    }}
                    className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-white font-mono ${
                      !canEditWageRates 
                        ? 'border-slate-800 bg-slate-900/60 text-slate-400 cursor-not-allowed opacity-75' 
                        : 'border-slate-700'
                    }`}
                  />
                </div>
              </div>

              {!canEditWageRates && (
                <div 
                  className="flex items-center gap-1.5 p-2 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-300 text-[11px]"
                  title="Wage rates can only be modified by Finance or HR."
                >
                  <Lock className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  <span>Wage rates can only be modified by Finance or HR.</span>
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Status</label>
                <select
                  value={editingWorker.status}
                  onChange={(e) => setEditingWorker({ ...editingWorker, status: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setEditingWorker(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateWorker}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs rounded-xl font-bold"
              >
                Update Profile
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
