/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, CheckCircle2, Clock, Users, Building2, 
  ArrowUpRight, Download, Filter, Search, Plus, ShieldCheck, 
  AlertCircle, X, Check, Edit3, Trash2, Printer, FileText,
  BadgeDollarSign, UserCheck
} from 'lucide-react';
import { ExtendedPayrollItem, Contractor, PayrollRecord, ProjectProfile } from '../types';

interface PayrollManagerProps {
  payrollRecords?: PayrollRecord[];
  initialPayroll?: ExtendedPayrollItem[];
  contractors?: Contractor[];
  projects?: ProjectProfile[];
  isFinance?: boolean;
  onDisburse?: (id?: string, all?: boolean) => Promise<void>;
  onAddWageEntry?: (entry: Partial<ExtendedPayrollItem>) => Promise<void>;
  onUpdateWageEntry?: (id: string, updates: Partial<ExtendedPayrollItem>) => Promise<void>;
  onDeleteWageEntry?: (id: string) => Promise<void>;
}

export default function PayrollManager({
  payrollRecords = [],
  initialPayroll = [],
  contractors = [],
  projects = [],
  isFinance = true,
  onDisburse,
  onAddWageEntry,
  onUpdateWageEntry,
  onDeleteWageEntry
}: PayrollManagerProps) {
  const [items, setItems] = useState<ExtendedPayrollItem[]>(initialPayroll || []);

  useEffect(() => {
    setItems(initialPayroll || []);
  }, [initialPayroll]);

  // Dynamically aggregate project names from database and active payroll
  const availableProjectNames = useMemo(() => {
    const names = new Set<string>();
    (projects || []).forEach(p => {
      if (p.name?.trim()) names.add(p.name.trim());
    });
    (items || []).forEach(item => {
      if (item.projectName?.trim()) names.add(item.projectName.trim());
    });
    if (names.size === 0) {
      names.add('Commercial Fit-Out Site 1');
    }
    return Array.from(names);
  }, [projects, items]);

  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<ExtendedPayrollItem | null>(null);
  const [payslipItem, setPayslipItem] = useState<ExtendedPayrollItem | null>(null);
  const [isDisbursing, setIsDisbursing] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // New Wage Item Form
  const [newName, setNewName] = useState('');
  const [newProject, setNewProject] = useState(availableProjectNames[0] || 'Commercial Fit-Out Site 1');
  const [newCompany, setNewCompany] = useState('SolidFoundations Engineering');
  const [newRole, setNewRole] = useState('Lead Carpenter');
  const [newDailyRate, setNewDailyRate] = useState(900);
  const [newDays, setNewDays] = useState(12);
  const [newOvertime, setNewOvertime] = useState(4);
  const [newDeductions, setNewDeductions] = useState(850);
  const [newMethod, setNewMethod] = useState('BDO Direct Payroll');

  // Sync default new project when projects change
  useEffect(() => {
    if (availableProjectNames.length > 0 && (!newProject || !availableProjectNames.includes(newProject))) {
      setNewProject(availableProjectNames[0]);
    }
  }, [availableProjectNames]);

  // Edit Wage Item Form
  const [editName, setEditName] = useState('');
  const [editProject, setEditProject] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editDailyRate, setEditDailyRate] = useState(900);
  const [editDays, setEditDays] = useState(12);
  const [editOvertime, setEditOvertime] = useState(0);
  const [editDeductions, setEditDeductions] = useState(0);
  const [editMethod, setEditMethod] = useState('BDO Direct Payroll');
  const [editStatus, setEditStatus] = useState<'Pending' | 'Disbursed'>('Pending');

  const filteredItems = items.filter(i => {
    if (projectFilter !== 'ALL' && i.projectName.trim().toLowerCase() !== projectFilter.trim().toLowerCase()) {
      return false;
    }
    if (statusFilter !== 'ALL' && i.status !== statusFilter) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        i.workerName.toLowerCase().includes(q) ||
        i.role.toLowerCase().includes(q) ||
        i.projectName.toLowerCase().includes(q) ||
        i.contractorCompany.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalGross = items.reduce((sum, i) => sum + i.grossPay, 0);
  const totalDeductions = items.reduce((sum, i) => sum + i.deductions, 0);
  const totalNet = items.reduce((sum, i) => sum + i.netPay, 0);
  const pendingCount = items.filter(i => i.status === 'Pending').length;
  const pendingAmount = items.filter(i => i.status === 'Pending').reduce((sum, i) => sum + i.netPay, 0);

  const handleDisburseAll = async () => {
    setIsDisbursing(true);
    try {
      if (onDisburse) {
        await onDisburse(undefined, true);
      } else {
        await fetch('/api/payroll/disburse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ all: true })
        });
      }

      setItems(prev => prev.map(i => ({
        ...i,
        status: 'Disbursed',
        disbursementDate: new Date().toISOString().split('T')[0]
      })));

      setFeedback('All pending worker wages disbursed successfully!');
      setTimeout(() => setFeedback(null), 3500);
    } catch (err) {
      console.error('Error disbursing payroll:', err);
    } finally {
      setIsDisbursing(false);
    }
  };

  const handleDisburseSingle = async (id: string) => {
    try {
      if (onDisburse) {
        await onDisburse(id);
      } else {
        await fetch('/api/payroll/disburse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
      }

      setItems(prev => prev.map(i => i.id === id ? {
        ...i,
        status: 'Disbursed',
        disbursementDate: new Date().toISOString().split('T')[0]
      } : i));

      setFeedback(`Wage record ${id} disbursed successfully!`);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error('Error disbursing single record:', err);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const hourlyRate = newDailyRate / 8;
    const basePay = newDailyRate * newDays;
    const otPay = hourlyRate * 1.25 * newOvertime;
    const gross = Math.round(basePay + otPay);
    const net = Math.max(0, gross - newDeductions);

    const newItem: Partial<ExtendedPayrollItem> = {
      workerName: newName.trim(),
      contractorCompany: newCompany,
      projectName: newProject,
      role: newRole,
      hoursWorked: newDays * 8 + newOvertime,
      daysWorked: newDays,
      dailyRate: newDailyRate,
      overtimeHours: newOvertime,
      grossPay: gross,
      deductions: newDeductions,
      netPay: net,
      status: 'Pending',
      paymentMethod: newMethod
    };

    try {
      if (onAddWageEntry) {
        await onAddWageEntry(newItem);
      } else {
        const res = await fetch('/api/extended-payroll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newItem)
        });
        if (res.ok) {
          const created = await res.json();
          setItems(prev => [created, ...prev]);
        } else {
          setItems(prev => [{ id: `PAY-${Date.now().toString().slice(-4)}`, ...newItem } as ExtendedPayrollItem, ...prev]);
        }
      }
    } catch {
      setItems(prev => [{ id: `PAY-${Date.now().toString().slice(-4)}`, ...newItem } as ExtendedPayrollItem, ...prev]);
    }

    setShowAddModal(false);
    setNewName('');
  };

  const openEditModal = (item: ExtendedPayrollItem) => {
    setEditingItem(item);
    setEditName(item.workerName);
    setEditProject(item.projectName);
    setEditCompany(item.contractorCompany);
    setEditRole(item.role);
    setEditDailyRate(item.dailyRate);
    setEditDays(item.daysWorked);
    setEditOvertime(item.overtimeHours || 0);
    setEditDeductions(item.deductions);
    setEditMethod(item.paymentMethod);
    setEditStatus(item.status);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const hourlyRate = editDailyRate / 8;
    const basePay = editDailyRate * editDays;
    const otPay = hourlyRate * 1.25 * editOvertime;
    const gross = Math.round(basePay + otPay);
    const net = Math.max(0, gross - editDeductions);

    const updates: Partial<ExtendedPayrollItem> = {
      workerName: editName.trim(),
      contractorCompany: editCompany,
      projectName: editProject,
      role: editRole,
      hoursWorked: editDays * 8 + editOvertime,
      daysWorked: editDays,
      dailyRate: editDailyRate,
      overtimeHours: editOvertime,
      grossPay: gross,
      deductions: editDeductions,
      netPay: net,
      status: editStatus,
      paymentMethod: editMethod,
      disbursementDate: editStatus === 'Disbursed' ? (editingItem.disbursementDate || new Date().toISOString().split('T')[0]) : undefined
    };

    try {
      if (onUpdateWageEntry) {
        await onUpdateWageEntry(editingItem.id, updates);
      } else {
        await fetch(`/api/extended-payroll/${editingItem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        });
      }

      setItems(prev => prev.map(i => i.id === editingItem.id ? { ...i, ...updates } : i));
      setFeedback(`Wage record for ${editName} updated.`);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error('Failed to update wage entry:', err);
    }

    setEditingItem(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this wage record?')) return;
    try {
      if (onDeleteWageEntry) {
        await onDeleteWageEntry(id);
      } else {
        await fetch(`/api/extended-payroll/${id}`, { method: 'DELETE' });
      }
      setItems(prev => prev.filter(i => i.id !== id));
      setFeedback('Wage record deleted.');
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error('Failed to delete wage record:', err);
    }
  };

  // Export Payroll Roster to CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Worker Name', 'Company', 'Project', 'Role', 'Days Worked', 'Daily Rate', 'OT Hours', 'Gross Pay', 'Deductions', 'Net Pay', 'Status', 'Disbursement Date', 'Payment Method'];
    const rows = filteredItems.map(i => [
      i.id,
      `"${i.workerName.replace(/"/g, '""')}"`,
      `"${i.contractorCompany.replace(/"/g, '""')}"`,
      `"${i.projectName.replace(/"/g, '""')}"`,
      `"${i.role.replace(/"/g, '""')}"`,
      i.daysWorked,
      i.dailyRate,
      i.overtimeHours || 0,
      i.grossPay,
      i.deductions,
      i.netPay,
      i.status,
      i.disbursementDate || '',
      `"${i.paymentMethod}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CTVill_Payroll_Roster_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-6 rounded-2xl backdrop-blur-xl shadow-2xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold tracking-wider uppercase">
              Field Compensation
            </span>
            <span className="text-xs text-slate-400">Worker Salaries & Contractor Wage Disbursement</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <DollarSign className="w-7 h-7 text-emerald-400" />
            Payroll & Wage Processing
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage worker salaries, hours worked, overtime, statutory deductions, and net disbursements linked to active project allocations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3.5 py-2.5 rounded-xl border border-slate-700 text-xs transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            Export Payroll (CSV)
          </button>

          {isFinance ? (
            <>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3.5 py-2.5 rounded-xl border border-slate-700 text-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                Log Wage Entry
              </button>

              <button
                onClick={handleDisburseAll}
                disabled={pendingCount === 0 || isDisbursing}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 text-xs cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isDisbursing ? 'Processing...' : `Disburse Pending (₱${pendingAmount.toLocaleString()})`}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Disbursements Restricted to Finance</span>
            </div>
          )}
        </div>
      </div>

      {/* Separation of Duties (SoD) Notice for Operations Role */}
      {!isFinance && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-amber-300 block">Separation of Duties (SoD) Enforced — Operations View</span>
              <span className="text-slate-400">
                You are viewing labor allocations and jobsite headcount. In accordance with enterprise governance, direct wage modifications, statutory deduction changes, and monetary disbursements are strictly managed by the Finance & Accounting Department.
              </span>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-slate-900 border border-amber-500/40 text-amber-400 font-bold shrink-0 self-start md:self-auto">
            READ-ONLY
          </span>
        </div>
      )}

      {feedback && (
        <div className="p-4 rounded-xl bg-emerald-950/80 text-emerald-300 border border-emerald-800 text-xs font-mono flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 shrink-0" />
          {feedback}
        </div>
      )}

      {/* Payroll Overview KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Gross Payroll</span>
            <Users className="w-5 h-5 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2 font-mono">
            ₱{totalGross.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Across {items.length} active artisan shifts
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Statutory Deductions</span>
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-indigo-400 mt-2 font-mono">
            ₱{totalDeductions.toLocaleString()}
          </div>
          <div className="text-xs text-indigo-500/80 mt-1">
            SSS, PhilHealth, Pag-IBIG & withholding
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Total Net Pay</span>
            <BadgeDollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2 font-mono">
            ₱{totalNet.toLocaleString()}
          </div>
          <div className="text-xs text-emerald-500/80 mt-1">
            Total take-home wage obligation
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Pending Release</span>
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-2 font-mono">
            ₱{pendingAmount.toLocaleString()}
          </div>
          <div className="text-xs text-amber-500/80 mt-1">
            {pendingCount} worker payout{pendingCount === 1 ? '' : 's'} awaiting release
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
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono"
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
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Disbursement Statuses</option>
              <option value="Pending">Pending Only</option>
              <option value="Disbursed">Disbursed</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search worker, trade, contractor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Payroll Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            Disbursement Ledger ({filteredItems.length} Worker Records)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Worker & Trade</th>
                <th className="py-3.5 px-4">Project & Contractor</th>
                <th className="py-3.5 px-4">Days / Hours</th>
                <th className="py-3.5 px-4">Daily Rate</th>
                <th className="py-3.5 px-4">Gross Pay</th>
                <th className="py-3.5 px-4">Deductions</th>
                <th className="py-3.5 px-4">Net Pay</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-500 italic">
                    No payroll records matching your current filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white">{item.workerName}</div>
                      <div className="text-[10px] text-emerald-400/90 font-mono">{item.role}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-200">{item.projectName}</div>
                      <div className="text-[10px] text-slate-400">{item.contractorCompany}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      <div>{item.daysWorked} days ({item.hoursWorked} hrs)</div>
                      {item.overtimeHours ? (
                        <span className="text-[10px] text-amber-400 font-semibold">+{item.overtimeHours} hrs OT</span>
                      ) : null}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      ₱{item.dailyRate.toLocaleString()} / day
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      ₱{item.grossPay.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-rose-400">
                      -₱{item.deductions.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-400 text-sm">
                      ₱{item.netPay.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {item.status === 'Disbursed' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                          <CheckCircle2 className="w-3 h-3" /> Disbursed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800">
                          <Clock className="w-3 h-3" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isFinance && item.status === 'Pending' && (
                          <button
                            onClick={() => handleDisburseSingle(item.id)}
                            className="px-2 py-1 rounded bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800 text-[10px] font-bold transition cursor-pointer"
                            title="Disburse this worker"
                          >
                            Disburse
                          </button>
                        )}
                        <button
                          onClick={() => setPayslipItem(item)}
                          className="p-1 text-slate-400 hover:text-emerald-400 transition cursor-pointer"
                          title="View / Print Payslip"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        {isFinance && (
                          <>
                            <button
                              onClick={() => openEditModal(item)}
                              className="p-1 text-slate-400 hover:text-amber-400 transition cursor-pointer"
                              title="Edit Wage Entry"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-1 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Wage Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-bold text-white">Log Worker Wage & Shift Record</h3>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              {/* Quick Select Registered CTVill Worker / Staff */}
              <div className="bg-slate-900/90 border border-emerald-500/40 rounded-xl p-3 space-y-1.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Select Registered CTVill Staff / Contractor
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">Auto-fills details below</span>
                </div>
                <select
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    if (!selectedId) return;
                    const worker = contractors.find(c => c.id === selectedId);
                    if (worker) {
                      setNewName(worker.name);
                      setNewCompany(worker.company || (worker.employmentType === 'INTERNAL' ? 'CTVill Builders Corporation' : worker.name));
                      setNewRole(worker.roleTitle || worker.specialty || 'Staff');
                      if (worker.dailyRate && worker.dailyRate > 0) {
                        setNewDailyRate(worker.dailyRate);
                      } else if (worker.monthlySalary && worker.monthlySalary > 0) {
                        setNewDailyRate(Math.round(worker.monthlySalary / 22));
                      }
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:border-emerald-400 focus:outline-none"
                >
                  <option value="">-- Choose Registered Worker/Staff to Auto-Fill --</option>
                  {contractors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.roleTitle || c.specialty} ({c.employmentType === 'INTERNAL' ? 'CTVill In-House' : 'Outsourced'}) {c.dailyRate ? `• ₱${c.dailyRate.toLocaleString()}/day` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 italic">
                  Selecting a registered worker automatically populates full name, company/department, trade/role, and daily wage rate.
                </p>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Worker Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Danilo R. Santos"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Project</label>
                  <select
                    value={newProject}
                    onChange={(e) => setNewProject(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                  >
                    {availableProjectNames.map((projName) => (
                      <option key={projName} value={projName}>{projName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Contractor Company</label>
                  <input
                    type="text"
                    required
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Trade / Role</label>
                  <input
                    type="text"
                    required
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Daily Rate (₱)</label>
                  <input
                    type="number"
                    required
                    min="500"
                    step="50"
                    value={newDailyRate}
                    onChange={(e) => setNewDailyRate(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Days Worked</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="31"
                    value={newDays}
                    onChange={(e) => setNewDays(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">OT Hours (1.25x)</label>
                  <input
                    type="number"
                    min="0"
                    value={newOvertime}
                    onChange={(e) => setNewOvertime(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Deductions (₱)</label>
                  <input
                    type="number"
                    min="0"
                    value={newDeductions}
                    onChange={(e) => setNewDeductions(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Live Net Pay Computation Preview */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex justify-between items-center text-xs">
                <div>
                  <span className="text-slate-400">Estimated Gross: </span>
                  <strong className="text-white font-mono">
                    ₱{Math.round(newDailyRate * newDays + (newDailyRate / 8) * 1.25 * newOvertime).toLocaleString()}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400">Net Take-Home: </span>
                  <strong className="text-emerald-400 font-mono text-sm">
                    ₱{Math.max(0, Math.round(newDailyRate * newDays + (newDailyRate / 8) * 1.25 * newOvertime) - newDeductions).toLocaleString()}
                  </strong>
                </div>
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
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  Log Wage Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Wage Entry Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditingItem(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <Edit3 className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-bold text-white">Edit Worker Wage Entry ({editingItem.id})</h3>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Worker Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Project</label>
                  <select
                    value={editProject}
                    onChange={(e) => setEditProject(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
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
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Contractor Company</label>
                  <input
                    type="text"
                    required
                    value={editCompany}
                    onChange={(e) => setEditCompany(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Trade / Role</label>
                  <input
                    type="text"
                    required
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Daily Rate (₱)</label>
                  <input
                    type="number"
                    required
                    min="500"
                    step="50"
                    value={editDailyRate}
                    onChange={(e) => setEditDailyRate(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Days Worked</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="31"
                    value={editDays}
                    onChange={(e) => setEditDays(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">OT Hours (1.25x)</label>
                  <input
                    type="number"
                    min="0"
                    value={editOvertime}
                    onChange={(e) => setEditOvertime(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Deductions (₱)</label>
                  <input
                    type="number"
                    min="0"
                    value={editDeductions}
                    onChange={(e) => setEditDeductions(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as 'Pending' | 'Disbursed')}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Disbursed">Disbursed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Payment Channel</label>
                  <input
                    type="text"
                    value={editMethod}
                    onChange={(e) => setEditMethod(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Live Net Pay Computation Preview */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex justify-between items-center text-xs">
                <div>
                  <span className="text-slate-400">Recomputed Gross: </span>
                  <strong className="text-white font-mono">
                    ₱{Math.round(editDailyRate * editDays + (editDailyRate / 8) * 1.25 * editOvertime).toLocaleString()}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400">Recomputed Net: </span>
                  <strong className="text-emerald-400 font-mono text-sm">
                    ₱{Math.max(0, Math.round(editDailyRate * editDays + (editDailyRate / 8) * 1.25 * editOvertime) - editDeductions).toLocaleString()}
                  </strong>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-xl text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View / Print Payslip Modal */}
      {payslipItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative">
            <button
              onClick={() => setPayslipItem(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Printable Payslip Card */}
            <div className="border border-slate-700 bg-slate-950 rounded-xl p-6 space-y-4">
              <div className="border-b border-slate-800 pb-3 flex justify-between items-start">
                <div>
                  <h4 className="text-base font-black text-white">CTVILL REALTY & DEVELOPMENT CORP.</h4>
                  <div className="text-[11px] text-slate-400">Field Artisan Compensation Voucher</div>
                </div>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                  payslipItem.status === 'Disbursed' 
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800' 
                    : 'bg-amber-950 text-amber-300 border-amber-800'
                }`}>
                  {payslipItem.status.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 text-[10px] block">EMPLOYEE NAME</span>
                  <strong className="text-white">{payslipItem.workerName}</strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">ROLE / TRADE</span>
                  <span className="text-emerald-400 font-mono">{payslipItem.role}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">PROJECT SITE</span>
                  <span className="text-slate-300">{payslipItem.projectName}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">CONTRACTOR</span>
                  <span className="text-slate-300">{payslipItem.contractorCompany}</span>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-3 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Basic Pay ({payslipItem.daysWorked} days @ ₱{payslipItem.dailyRate}):</span>
                  <span className="text-white font-mono font-bold">₱{(payslipItem.dailyRate * payslipItem.daysWorked).toLocaleString()}</span>
                </div>
                {payslipItem.overtimeHours ? (
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Overtime ({payslipItem.overtimeHours} hrs @ 1.25x):</span>
                    <span className="text-amber-400 font-mono font-bold">
                      ₱{(payslipItem.grossPay - payslipItem.dailyRate * payslipItem.daysWorked).toLocaleString()}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400 font-semibold">Total Gross Earnings:</span>
                  <span className="text-white font-mono font-bold">₱{payslipItem.grossPay.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60 text-rose-400">
                  <span>Statutory Deductions (SSS/PhilHealth/PagIBIG):</span>
                  <span className="font-mono font-bold">-₱{payslipItem.deductions.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 text-sm bg-emerald-950/40 p-2 rounded-lg border border-emerald-800/40">
                  <span className="font-bold text-emerald-300">NET TAKE-HOME PAY:</span>
                  <span className="font-bold text-emerald-400 font-mono text-base">₱{payslipItem.netPay.toLocaleString()}</span>
                </div>
              </div>

              <div className="pt-2 text-[10px] text-slate-500 flex justify-between font-mono">
                <span>Payment Channel: {payslipItem.paymentMethod}</span>
                {payslipItem.disbursementDate && <span>Date: {payslipItem.disbursementDate}</span>}
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Payslip
              </button>
              <button
                onClick={() => setPayslipItem(null)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 rounded-xl text-xs font-bold transition cursor-pointer"
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
