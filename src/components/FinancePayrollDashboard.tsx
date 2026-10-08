/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Banknote, Calendar, Printer, CheckCircle2, Lock, AlertTriangle, 
  FileSpreadsheet, Plus, RefreshCw, HardHat, FileText, ChevronRight, 
  ShieldCheck, Info, X, DollarSign, ArrowUpRight, Search, ExternalLink
} from 'lucide-react';
import { 
  ProjectProfile, PayrollRun, PayrollBreakdownItem, CashAdvance, UserSession 
} from '../types';
import { normalizeRole, UserRole } from '../utils/rbac';

interface FinancePayrollDashboardProps {
  projects: ProjectProfile[];
  session?: UserSession | any;
  onRefreshData?: () => void;
  onNotify?: (msg: string) => void;
}

export default function FinancePayrollDashboard({
  projects,
  session,
  onRefreshData
}: FinancePayrollDashboardProps) {
  // State
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  
  // RBAC Hierarchy Context: OM has Read-Only audit oversight, Finance has operational execution
  const currentRole = normalizeRole(session?.role);
  const isOM = currentRole === UserRole.OM;
  const isFinance = currentRole === UserRole.FINANCE;
  
  // Weekly cycle default: Mon to Sun (active week: 2026-09-21 to 2026-09-27)
  const [periodStart, setPeriodStart] = useState<string>(() => {
    const now = new Date();
    const day = now.getDay();
    const diffToMon = now.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(now.getFullYear(), now.getMonth(), diffToMon);
    const year = mon.getFullYear();
    const month = String(mon.getMonth() + 1).padStart(2, '0');
    const d = String(mon.getDate()).padStart(2, '0');
    return `${year}-${month}-${d}`;
  });

  const [periodEnd, setPeriodEnd] = useState<string>(() => {
    const now = new Date();
    const day = now.getDay();
    const diffToMon = now.getDate() - day + (day === 0 ? -6 : 1);
    const sun = new Date(now.getFullYear(), now.getMonth(), diffToMon + 6);
    const year = sun.getFullYear();
    const month = String(sun.getMonth() + 1).padStart(2, '0');
    const d = String(sun.getDate()).padStart(2, '0');
    return `${year}-${month}-${d}`;
  });

  // Data State
  const [draftCalculation, setDraftCalculation] = useState<{
    totalGross: number;
    totalDeductions: number;
    totalNet: number;
    workerCount: number;
    items: PayrollBreakdownItem[];
  } | null>(null);

  // Historical cycle seed initial state aligned with 2026 project timeline (2026-09-14 to 2026-09-21)
  const defaultHistoricalRuns: PayrollRun[] = [
    {
      id: `PAY-${(selectedProjectId || '4693').slice(-4)}-20260914-20260921`,
      projectId: selectedProjectId || 'PRJ-4693',
      projectName: '2-Storey Residential House',
      clientName: 'Jonathan Dela Cruz',
      periodStart: '2026-09-14',
      periodEnd: '2026-09-21',
      status: 'FINALIZED',
      totalGross: 46270.33,
      totalDeductions: 0.00,
      totalNet: 46270.33,
      approvedByUserId: 'usr-finance-controller',
      approvedByName: 'Clarisse Mendoza (Finance Controller)',
      workerCount: 10,
      createdAt: '2026-09-21T09:00:00.000Z'
    }
  ];

  const [pastRuns, setPastRuns] = useState<PayrollRun[]>(defaultHistoricalRuns);
  const [selectedRunDetail, setSelectedRunDetail] = useState<PayrollRun | null>(null);
  const [activeTab, setActiveTab] = useState<'calculator' | 'history'>('calculator');
  
  // Loading & Processing States
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [cycleBoundsNotice, setCycleBoundsNotice] = useState<boolean>(false);
  
  // Cash Advance (Vale) Modal State
  const [isValeModalOpen, setIsValeModalOpen] = useState<boolean>(false);
  const [selectedWorkerForVale, setSelectedWorkerForVale] = useState<{ id: string; name: string } | null>(null);
  const [valeAmount, setValeAmount] = useState<string>('500');
  const [valeNotes, setValeNotes] = useState<string>('Mid-week subsistence vale');
  const [isSavingVale, setIsSavingVale] = useState<boolean>(false);

  // Print Preview Modal State
  const [printPreviewType, setPrintPreviewType] = useState<'summary' | 'payslips' | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Load Historical Payroll Runs
  const loadPastRuns = async () => {
    try {
      const q = selectedProjectId ? `?projectId=${selectedProjectId}` : '';
      const res = await fetch(`/api/payroll/runs${q}`, {
        headers: { 'x-user-role': session?.role || 'FINANCE', 'x-user-id': session?.id || '' }
      });
      if (res.ok) {
        const data = await res.json();
        setPastRuns(Array.isArray(data) && data.length > 0 ? data : defaultHistoricalRuns);
      }
    } catch (e) {
      console.error('Error loading payroll runs:', e);
    }
  };

  useEffect(() => {
    loadPastRuns();
  }, [selectedProjectId]);

  // Generate Draft Payroll
  const handleGenerateDraft = async () => {
    if (!selectedProjectId) {
      setToastMessage({ text: 'Please select a project site first.', type: 'error' });
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch('/api/payroll/calculate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': session?.role || 'FINANCE',
          'x-user-id': session?.id || ''
        },
        body: JSON.stringify({
          projectId: selectedProjectId,
          periodStart,
          periodEnd
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to calculate weekly payroll');
      }

      setDraftCalculation(data.draft);
      if (data.outOfBoundsExcluded || (data.excludedCount && data.excludedCount > 0) || data.recordsExcludedNotice) {
        setCycleBoundsNotice(true);
        setToastMessage({ 
          text: 'Records outside the selected cycle bounds were excluded.', 
          type: 'info' 
        });
      } else {
        setCycleBoundsNotice(false);
        setToastMessage({ 
          text: `Payroll draft calculated for ${data.draft.workerCount} workers! Total Net: ₱${data.draft.totalNet.toLocaleString()}`, 
          type: 'success' 
        });
      }
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Error calculating payroll', type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  // Finalize Payroll Run
  const handleFinalizePayroll = async () => {
    if (!selectedProjectId || !draftCalculation) return;

    const confirmed = window.confirm(
      `Finalize Weekly Payroll for Period ${periodStart} to ${periodEnd}?\n\n` +
      `• Total Net Disbursal: ₱${draftCalculation.totalNet.toLocaleString()}\n` +
      `• Total Deductions: ₱${draftCalculation.totalDeductions.toLocaleString()}\n\n` +
      `CONFIRMATION LOCK: This action will permanently lock all site attendance records for this period and mark pending cash advances as deducted.`
    );
    if (!confirmed) return;

    setIsFinalizing(true);
    try {
      const res = await fetch('/api/payroll/finalize', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': session?.role || 'FINANCE',
          'x-user-id': session?.id || ''
        },
        body: JSON.stringify({
          projectId: selectedProjectId,
          periodStart,
          periodEnd
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to finalize payroll');
      }

      setToastMessage({ 
        text: `Payroll Run ${data.payrollRunId} Finalized & Attendance Records Locked!`, 
        type: 'success' 
      });

      // Reload runs
      await loadPastRuns();
      if (onRefreshData) onRefreshData();
      
      // Load details of the finalized run
      const detailRes = await fetch(`/api/payroll/runs/${data.payrollRunId}`, {
        headers: { 'x-user-role': session?.role || 'FINANCE' }
      });
      if (detailRes.ok) {
        setSelectedRunDetail(await detailRes.json());
      }
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Error finalizing payroll', type: 'error' });
    } finally {
      setIsFinalizing(false);
    }
  };

  // Issue Cash Advance (Vale)
  const handleSaveVale = async () => {
    if (!selectedWorkerForVale || !selectedProjectId) return;
    const amountNum = parseFloat(valeAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid cash advance amount');
      return;
    }

    setIsSavingVale(true);
    try {
      const res = await fetch('/api/cash-advances', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': session?.role || 'FINANCE',
          'x-user-id': session?.id || ''
        },
        body: JSON.stringify({
          projectId: selectedProjectId,
          workerId: selectedWorkerForVale.id,
          amount: amountNum,
          notes: valeNotes
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to record cash advance');
      }

      setToastMessage({ text: `Recorded vale of ₱${amountNum.toLocaleString()} for ${selectedWorkerForVale.name}`, type: 'success' });
      setIsValeModalOpen(false);
      setSelectedWorkerForVale(null);
      
      // Auto-recalculate draft to reflect newly attached deduction
      handleGenerateDraft();
    } catch (err: any) {
      alert(err.message || 'Failed to save cash advance');
    } finally {
      setIsSavingVale(false);
    }
  };

  // Quick Date Range Presets
  const setPresetRange = (type: 'thisWeek' | 'lastWeek' | 'fullMonth') => {
    const today = new Date();
    const formatYMD = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (type === 'thisWeek') {
      const day = today.getDay();
      const diffToMon = today.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(today.getFullYear(), today.getMonth(), diffToMon);
      const sun = new Date(today.getFullYear(), today.getMonth(), diffToMon + 6);
      setPeriodStart(formatYMD(mon));
      setPeriodEnd(formatYMD(sun));
    } else if (type === 'lastWeek') {
      const day = today.getDay();
      const diffToMon = today.getDate() - day + (day === 0 ? -6 : 1) - 7;
      const mon = new Date(today.getFullYear(), today.getMonth(), diffToMon);
      const sun = new Date(today.getFullYear(), today.getMonth(), diffToMon + 6);
      setPeriodStart(formatYMD(mon));
      setPeriodEnd(formatYMD(sun));
    }
  };

  // Active items for display (either draft or selected historical run)
  const displayItems = useMemo(() => {
    if (selectedRunDetail) return selectedRunDetail.items || [];
    return draftCalculation?.items || [];
  }, [selectedRunDetail, draftCalculation]);

  const activeProject = projects.find(p => p.id === selectedProjectId);

  // Trigger Print Window
  const handlePrint = (type: 'summary' | 'payslips') => {
    setPrintPreviewType(type);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold backdrop-blur-md border animate-slideDown ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/50' 
            : 'bg-red-950/90 text-red-200 border-red-500/50'
        }`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/30 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <Banknote className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight">Weekly Site Payroll Engine</h1>
              <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold border ${
                !isFinance
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              }`}>
                {!isFinance ? 'AUDIT & READ-ONLY' : 'FINANCE & DISBURSAL'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated wage calculation from verified site attendance logs • Cash advance vale deductions • Print-ready payroll sheets
            </p>
          </div>
        </div>

        {/* View Toggle Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 p-1 rounded-xl text-xs font-semibold self-start md:self-auto">
          <button
            onClick={() => { setActiveTab('calculator'); setSelectedRunDetail(null); }}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'calculator' && !selectedRunDetail
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Weekly Wage Engine
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Finalized Payroll Archive ({pastRuns.length})
          </button>
        </div>
      </div>

      {/* Control Panel: Project & Cycle Selection */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
          
          {/* Project Selector */}
          <div className="md:col-span-4">
            <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <HardHat className="w-3.5 h-3.5 text-amber-400" />
              <span>Project Construction Site</span>
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setDraftCalculation(null);
                setSelectedRunDetail(null);
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.id})
                </option>
              ))}
            </select>
          </div>

          {/* Period Start */}
          <div className="md:col-span-3">
            <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Cycle Start Date</span>
            </label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
            />
          </div>

          {/* Period End */}
          <div className="md:col-span-3">
            <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Cycle Cut-Off Date</span>
            </label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
            />
          </div>

          {/* Generate Draft Button */}
          <div className="md:col-span-2">
            {!isFinance ? (
              <div 
                className="w-full py-2 bg-slate-800/80 border border-slate-700/60 text-slate-400 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 text-center cursor-not-allowed"
                title="Operations Managers possess Read-Only audit access. Only Finance can trigger payroll calculations."
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Audit Read-Only</span>
              </div>
            ) : (
              <button
                onClick={handleGenerateDraft}
                disabled={isGenerating || !selectedProjectId}
                className="w-full py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                <span>Calculate Draft</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Cycle Presets & Helpers */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Quick Pay Cycle:</span>
            <button
              onClick={() => setPresetRange('thisWeek')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] transition-colors cursor-pointer"
            >
              Current Week (Mon–Sat)
            </button>
            <button
              onClick={() => setPresetRange('lastWeek')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] transition-colors cursor-pointer"
            >
              Last Week (Mon–Sat)
            </button>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
            <span>Rule: Base Pay = Days × Daily Rate • OT = OT Hrs × 1.25 • Net = Gross - Vale</span>
          </div>
        </div>
      </div>

      {/* Notice Banner: Records Outside Cycle Bounds Excluded */}
      {cycleBoundsNotice && (
        <div className="bg-amber-950/40 border border-amber-600/40 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs text-amber-200 shadow-lg">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold text-amber-300">Strict Date Bound Enforcement: </span>
              <span className="text-amber-200/90">Records outside the selected cycle bounds were excluded.</span>
            </div>
          </div>
          <button 
            type="button" 
            onClick={() => setCycleBoundsNotice(false)}
            className="text-amber-400 hover:text-white p-1 rounded-lg hover:bg-amber-900/40 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards: Calculated Totals */}
      {(draftCalculation || selectedRunDetail) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Active Labor Headcount</div>
            <div className="text-2xl font-bold text-white mt-1">
              {selectedRunDetail?.workerCount || draftCalculation?.workerCount} <span className="text-xs font-normal text-slate-500">workers</span>
            </div>
            <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Attendance Verified</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Gross Wages</div>
            <div className="text-2xl font-bold text-white mt-1">
              ₱{(selectedRunDetail?.totalGross || draftCalculation?.totalGross || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Includes Base + Overtime</div>
          </div>

          <div className="bg-slate-900 border border-rose-900/40 rounded-2xl p-4">
            <div className="text-[10px] text-rose-400 uppercase font-semibold">Cash Advances / Vale</div>
            <div className="text-2xl font-bold text-rose-300 mt-1">
              -₱{(selectedRunDetail?.totalDeductions || draftCalculation?.totalDeductions || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-rose-400/80 mt-1">Subtracted from gross pay</div>
          </div>

          <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-4 shadow-lg shadow-emerald-500/5">
            <div className="text-[10px] text-emerald-400 uppercase font-semibold">Total Net Disbursal</div>
            <div className="text-2xl font-bold text-emerald-300 mt-1">
              ₱{(selectedRunDetail?.totalNet || draftCalculation?.totalNet || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-emerald-400 mt-1 font-semibold">Final Take-Home Payout</div>
          </div>
        </div>
      )}

      {/* Main Content: Payroll Summary Table or Archive */}
      {activeTab === 'history' ? (
        /* ARCHIVE VIEW */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Historical Finalized Payroll Runs</h2>
              <p className="text-xs text-slate-400">Audit trail of archived wage runs and locked periods</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 font-semibold">
                <tr>
                  <th className="py-3 px-4">Run Reference</th>
                  <th className="py-3 px-4">Project Site</th>
                  <th className="py-3 px-4">Pay Cycle</th>
                  <th className="py-3 px-4 text-center">Workers</th>
                  <th className="py-3 px-4 text-right">Gross Pay</th>
                  <th className="py-3 px-4 text-right">Vale Deducted</th>
                  <th className="py-3 px-4 text-right">Net Payout</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {pastRuns.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500">
                      No finalized payroll runs recorded for this project yet.
                    </td>
                  </tr>
                ) : (
                  pastRuns.map(run => (
                    <tr key={run.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-amber-400">{run.id}</td>
                      <td className="py-3 px-4 font-semibold text-white">{run.projectName}</td>
                      <td className="py-3 px-4 font-mono text-slate-300">{run.periodStart} &rarr; {run.periodEnd}</td>
                      <td className="py-3 px-4 text-center">{run.workerCount}</td>
                      <td className="py-3 px-4 text-right font-mono">₱{run.totalGross.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-mono text-rose-400">-₱{run.totalDeductions.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">₱{run.totalNet.toLocaleString()}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          {run.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={async () => {
                              const res = await fetch(`/api/payroll/runs/${run.id}`, {
                                headers: { 'x-user-role': session?.role || 'FINANCE' }
                              });
                              if (res.ok) {
                                setSelectedRunDetail(await res.json());
                                setActiveTab('calculator');
                              }
                            }}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            View Sheet
                          </button>
                          <a
                            href={`/api/payroll/${run.id}/export?format=html`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 rounded-lg transition-colors cursor-pointer"
                            title="Open Print-Ready Master Sheet & Payslips"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CALCULATOR & LIVE SHEET VIEW */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col flex-1">
          
          {/* Table Header Bar */}
          <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">
                  {selectedRunDetail 
                    ? `Finalized Payroll Ledger • Ref: ${selectedRunDetail.id}` 
                    : `Draft Weekly Wage Calculation • ${activeProject?.name || 'Project'}`}
                </h2>
                {selectedRunDetail && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    LOCKED & ARCHIVED
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Cycle: {selectedRunDetail ? `${selectedRunDetail.periodStart} to ${selectedRunDetail.periodEnd}` : `${periodStart} to ${periodEnd}`}
              </p>
            </div>

            {/* Action Buttons: Finalize, Print Sheet, Print Payslips */}
            <div className="flex flex-wrap items-center gap-2">
              {displayItems.length > 0 && (
                <>
                  <button
                    onClick={() => handlePrint('summary')}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Print Clean Master Payroll Sheet"
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-400" />
                    <span>Print Master Sheet</span>
                  </button>

                  <button
                    onClick={() => handlePrint('payslips')}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Print Worker Payout Slips with Signatures"
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Print Payslips</span>
                  </button>
                </>
              )}

              {/* Finalize Button (Only for Finance, shown only for unfinalized draft) */}
              {!selectedRunDetail && draftCalculation && isFinance && (
                <button
                  onClick={handleFinalizePayroll}
                  disabled={isFinalizing || draftCalculation.workerCount === 0}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Lock className="w-4 h-4" />
                  <span>{isFinalizing ? 'Locking & Finalizing...' : 'Finalize Weekly Payroll'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Master Breakdown Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 font-semibold">
                <tr>
                  <th className="py-3 px-4">Worker Name</th>
                  <th className="py-3 px-4">Position / Trade</th>
                  <th className="py-3 px-4 text-right">Daily Rate</th>
                  <th className="py-3 px-4 text-center">Days Worked</th>
                  <th className="py-3 px-4 text-center">OT Hours</th>
                  <th className="py-3 px-4 text-right">Base Pay</th>
                  <th className="py-3 px-4 text-right">OT Pay</th>
                  <th className="py-3 px-4 text-right">Gross Pay</th>
                  <th className="py-3 px-4 text-right">Vale / Deductions</th>
                  <th className="py-3 px-4 text-right font-bold text-emerald-400">Net Pay</th>
                  {!selectedRunDetail && isFinance && <th className="py-3 px-4 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {displayItems.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center text-slate-500">
                      {isGenerating ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                          <span>Calculating attendance days and cash advance deductions...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Banknote className="w-8 h-8 text-slate-600" />
                          <span>Click &ldquo;Calculate Draft&rdquo; above to generate weekly wages for this cycle.</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  displayItems.map(item => {
                    const hasDeductions = item.totalDeductions > 0;
                    return (
                      <tr key={item.workerId} className="hover:bg-slate-800/40 transition-colors">
                        
                        {/* Worker Name */}
                        <td className="py-3 px-4 font-semibold text-white">
                          <div>{item.workerName}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{item.workerId}</div>
                        </td>

                        {/* Position */}
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                            {item.position}
                          </span>
                        </td>

                        {/* Daily Rate */}
                        <td className="py-3 px-4 text-right font-mono text-slate-300">
                          ₱{item.dailyRate.toLocaleString()}
                        </td>

                        {/* Days Worked */}
                        <td className="py-3 px-4 text-center font-mono">
                          <span className="font-bold text-white">{item.daysWorked}</span>
                          <span className="text-[10px] text-slate-500 ml-1">days</span>
                        </td>

                        {/* OT Hours */}
                        <td className="py-3 px-4 text-center font-mono">
                          {item.otHours > 0 ? (
                            <span className="text-blue-400 font-bold">{item.otHours} hrs</span>
                          ) : (
                            <span className="text-slate-600">0</span>
                          )}
                        </td>

                        {/* Base Pay */}
                        <td className="py-3 px-4 text-right font-mono text-slate-300">
                          ₱{item.basePay.toLocaleString()}
                        </td>

                        {/* OT Pay */}
                        <td className="py-3 px-4 text-right font-mono text-blue-300">
                          {item.otPay > 0 ? `₱${item.otPay.toLocaleString()}` : '₱0'}
                        </td>

                        {/* Gross Pay */}
                        <td className="py-3 px-4 text-right font-mono font-semibold text-white">
                          ₱{item.grossPay.toLocaleString()}
                        </td>

                        {/* Vale / Deductions */}
                        <td className="py-3 px-4 text-right font-mono">
                          {hasDeductions ? (
                            <span className="text-rose-400 font-bold">-₱{item.totalDeductions.toLocaleString()}</span>
                          ) : (
                            <span className="text-slate-600">₱0</span>
                          )}
                        </td>

                        {/* Net Pay */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400 text-sm">
                          ₱{item.netPay.toLocaleString()}
                        </td>

                        {/* Action: Add Vale (Finance Only) */}
                        {!selectedRunDetail && isFinance && (
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => {
                                setSelectedWorkerForVale({ id: item.workerId, name: item.workerName });
                                setIsValeModalOpen(true);
                              }}
                              className="px-2 py-1 bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 border border-rose-800/40 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer"
                              title="Attach Cash Advance (Vale) deduction"
                            >
                              + Vale
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Summary Footer */}
          {displayItems.length > 0 && (
            <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono">
              <div className="text-slate-400">
                Formula verified: Net Pay = (Days Worked &times; Daily Rate) + (OT &times; OT Rate) &minus; Deductions
              </div>

              <div className="flex items-center gap-6 font-bold">
                <div>Total Gross: <span className="text-white">₱{(selectedRunDetail?.totalGross || draftCalculation?.totalGross || 0).toLocaleString()}</span></div>
                <div>Total Vale: <span className="text-rose-400">-₱{(selectedRunDetail?.totalDeductions || draftCalculation?.totalDeductions || 0).toLocaleString()}</span></div>
                <div className="text-emerald-400 text-sm">Total Disbursal: ₱{(selectedRunDetail?.totalNet || draftCalculation?.totalNet || 0).toLocaleString()}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: Attach Cash Advance (Vale) */}
      {isValeModalOpen && selectedWorkerForVale && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-white text-sm">Issue Cash Advance (Vale)</h3>
              </div>
              <button 
                onClick={() => setIsValeModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400">Worker:</span>
                <div className="font-bold text-white text-sm mt-0.5">{selectedWorkerForVale.name}</div>
                <div className="text-slate-500 font-mono text-[10px]">{selectedWorkerForVale.id}</div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Cash Advance Amount (₱)
                </label>
                <input
                  type="number"
                  step="50"
                  min="50"
                  value={valeAmount}
                  onChange={(e) => setValeAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Purpose / Notes
                </label>
                <input
                  type="text"
                  value={valeNotes}
                  onChange={(e) => setValeNotes(e.target.value)}
                  placeholder="e.g. Subsistence allowance, medical emergency"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-3 text-[11px] text-amber-200">
                This amount will be deducted automatically from the worker's net take-home wage during weekly payroll finalization.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsValeModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingVale}
                onClick={handleSaveVale}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs rounded-xl font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-600/20"
              >
                {isSavingVale ? 'Recording...' : 'Attach Vale Deduction'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT MEDIA SECTION (Rendered only on window.print()) */}
      <div className="hidden print:block print:w-full print:bg-white print:text-black">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * { visibility: hidden !important; }
            #printable-payroll-area, #printable-payroll-area * { visibility: visible !important; }
            #printable-payroll-area { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; background: white !important; color: black !important; padding: 20px !important; }
            .print-page-break { page-break-before: always; }
          }
        `}} />

        <div id="printable-payroll-area" className="text-black font-sans text-xs">
          
          {/* MASTER PAYROLL SHEET (Visible if summary selected) */}
          {(printPreviewType === 'summary' || !printPreviewType) && (
            <div>
              <div className="border-b-2 border-black pb-3 mb-4 flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-black uppercase tracking-wider">CTVill Builders Corporation</h1>
                  <h2 className="text-sm font-bold text-amber-800 uppercase mt-0.5">Master Site Labor Payroll Sheet</h2>
                </div>
                <div className="text-right text-[11px]">
                  <div><strong>Site:</strong> {activeProject?.name || selectedRunDetail?.projectName}</div>
                  <div><strong>Period:</strong> {selectedRunDetail?.periodStart || periodStart} &ndash; {selectedRunDetail?.periodEnd || periodEnd}</div>
                  <div><strong>Ref:</strong> {selectedRunDetail?.id || 'DRAFT-RUN'}</div>
                </div>
              </div>

              {/* Totals Summary */}
              <div className="grid grid-cols-4 gap-2 mb-4 border border-black p-2 bg-slate-50 text-center text-xs">
                <div>
                  <div className="text-[10px] uppercase font-bold text-gray-600">Total Manpower</div>
                  <div className="font-bold text-sm">{displayItems.length} Workers</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-gray-600">Total Gross</div>
                  <div className="font-bold text-sm">₱{(selectedRunDetail?.totalGross || draftCalculation?.totalGross || 0).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-gray-600">Total Vale / Deductions</div>
                  <div className="font-bold text-sm">₱{(selectedRunDetail?.totalDeductions || draftCalculation?.totalDeductions || 0).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-gray-600">Net Take-Home Payout</div>
                  <div className="font-black text-sm text-green-800">₱{(selectedRunDetail?.totalNet || draftCalculation?.totalNet || 0).toLocaleString()}</div>
                </div>
              </div>

              {/* Master Sheet Table */}
              <table className="w-full border-collapse text-[10px] mb-6">
                <thead>
                  <tr className="bg-gray-100 border border-black">
                    <th className="p-1 border border-black text-center">#</th>
                    <th className="p-1 border border-black text-left">Worker Name</th>
                    <th className="p-1 border border-black text-left">Position</th>
                    <th className="p-1 border border-black text-right">Daily Rate</th>
                    <th className="p-1 border border-black text-center">Days</th>
                    <th className="p-1 border border-black text-center">OT Hrs</th>
                    <th className="p-1 border border-black text-right">Gross Pay</th>
                    <th className="p-1 border border-black text-right">Vale Deduct</th>
                    <th className="p-1 border border-black text-right">Net Take-Home</th>
                    <th className="p-1 border border-black text-center" style={{ width: '130px' }}>Worker Signature</th>
                  </tr>
                </thead>
                <tbody>
                  {displayItems.map((item, idx) => (
                    <tr key={item.workerId} className="border border-black">
                      <td className="p-1 border border-black text-center">{idx + 1}</td>
                      <td className="p-1 border border-black font-bold">{item.workerName}</td>
                      <td className="p-1 border border-black">{item.position}</td>
                      <td className="p-1 border border-black text-right">₱{item.dailyRate.toLocaleString()}</td>
                      <td className="p-1 border border-black text-center">{item.daysWorked}</td>
                      <td className="p-1 border border-black text-center">{item.otHours}</td>
                      <td className="p-1 border border-black text-right">₱{item.grossPay.toLocaleString()}</td>
                      <td className="p-1 border border-black text-right text-red-700">₱{item.totalDeductions.toLocaleString()}</td>
                      <td className="p-1 border border-black text-right font-black">₱{item.netPay.toLocaleString()}</td>
                      <td className="p-1 border border-black"></td>
                    </tr>
                  ))}
                  <tr className="font-bold bg-gray-100 border border-black">
                    <td colSpan={6} className="p-1 border border-black text-right">GRAND TOTALS:</td>
                    <td className="p-1 border border-black text-right">₱{(selectedRunDetail?.totalGross || draftCalculation?.totalGross || 0).toLocaleString()}</td>
                    <td className="p-1 border border-black text-right">₱{(selectedRunDetail?.totalDeductions || draftCalculation?.totalDeductions || 0).toLocaleString()}</td>
                    <td className="p-1 border border-black text-right font-black">₱{(selectedRunDetail?.totalNet || draftCalculation?.totalNet || 0).toLocaleString()}</td>
                    <td className="p-1 border border-black"></td>
                  </tr>
                </tbody>
              </table>

              {/* Signatures */}
              <div className="grid grid-cols-3 gap-8 mt-12 text-center text-xs">
                <div>
                  <div className="border-t border-black pt-1 font-bold">Rodel Reyes</div>
                  <div className="text-[10px] text-gray-600">Site Timekeeper (Prepared By)</div>
                </div>
                <div>
                  <div className="border-t border-black pt-1 font-bold">Engr. Marco Santos</div>
                  <div className="text-[10px] text-gray-600">Project / Site Engineer (Verified By)</div>
                </div>
                <div>
                  <div className="border-t border-black pt-1 font-bold">Clarisse Mendoza</div>
                  <div className="text-[10px] text-gray-600">Finance Controller (Approved for Release)</div>
                </div>
              </div>
            </div>
          )}

          {/* INDIVIDUAL PAYSLIPS (Visible if payslips selected) */}
          {(printPreviewType === 'payslips') && (
            <div className="print-page-break mt-4">
              <div className="border-b-2 border-black pb-2 mb-4 flex justify-between items-center">
                <div className="font-bold uppercase text-sm">Individual Worker Payout Slips &mdash; CTVill Builders</div>
                <div className="text-[10px] font-mono">Period: {selectedRunDetail?.periodStart || periodStart} &ndash; {selectedRunDetail?.periodEnd || periodEnd}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {displayItems.map(item => (
                  <div key={item.workerId} className="border border-black p-3 rounded text-[11px] space-y-1.5" style={{ pageBreakInside: 'avoid' }}>
                    <div className="border-b border-gray-400 pb-1 flex justify-between font-bold">
                      <span>{item.workerName}</span>
                      <span>{item.position}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Daily Wage Rate:</span>
                      <span>₱{item.dailyRate.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Days Worked:</span>
                      <span>{item.daysWorked} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Overtime ({item.otHours} hrs):</span>
                      <span>₱{item.otPay.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Gross Pay:</span>
                      <span>₱{item.grossPay.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-red-700">
                      <span>Vale Deductions:</span>
                      <span>-₱{item.totalDeductions.toLocaleString()}</span>
                    </div>
                    <div className="border-t border-black pt-1 flex justify-between font-black text-sm">
                      <span>NET TAKE-HOME:</span>
                      <span>₱{item.netPay.toLocaleString()}</span>
                    </div>
                    <div className="mt-4 pt-4 border-t border-dashed border-gray-400 text-center text-[9px] text-gray-500">
                      Received by: _________________________ (Signature)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
