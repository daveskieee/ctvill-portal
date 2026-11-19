/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import {
  X, DollarSign, Banknote, TrendingUp, Flame, Printer,
  Users, Package, HardHat, Building2, CheckCircle2, AlertTriangle
} from 'lucide-react';
import { ProjectProfile } from '../types';
import { getProjectMaterialSpend, getStoredMaterialDirectory } from '../utils/bomProfitSync';
import { openEnterprisePrintWindow, escapePrintHtml } from '../utils/printEngine';
import { useTheme } from '../context/ThemeContext';

export interface ProjectBudgetBreakdownRow {
  id: string;
  name: string;
  clientName: string;
  status: string;
  progress: number;
  budget: number;
  collected: number;
  laborDisbursed: number;
  materialsDisbursed: number;
  subconDisbursed: number;
  totalDisbursed: number;
  remainingBuffer: number;
  burnRatePct: number;
}

interface BudgetsExpensesModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: ProjectProfile[];
  /** Optional precomputed per-project labor & subcon disbursals from parent */
  projectDisbursals?: Record<string, { labor: number; subcon: number }>;
  /** Optional total labor / subcon overrides when per-project breakdown isn't granular */
  totalLaborFallback?: number;
  totalSubconFallback?: number;
  initialFocus?: 'budget' | 'collected' | 'progress' | 'all';
}

export default function BudgetsExpensesModal({
  isOpen,
  onClose,
  projects,
  projectDisbursals = {},
  totalLaborFallback = 0,
  totalSubconFallback = 0,
  initialFocus = 'all',
}: BudgetsExpensesModalProps) {
  const { isDark } = useTheme();

  const rows: ProjectBudgetBreakdownRow[] = useMemo(() => {
    const allMaterials = getStoredMaterialDirectory();
    const totalBudgetSum = projects.reduce((acc, p) => acc + (Number(p.budget) || 0), 0);

    return projects.map((p) => {
      const budget = Number(p.budget) || 0;
      const collected = Number(p.fundsCollected) || 0;
      const rawProg =
        (p as any).cpmProgress ??
        (p as any).overallProgress ??
        (p as any).progress ??
        p.progressPercentage ??
        0;
      const progress = Math.round(Number(rawProg) || 0);

      const disb = projectDisbursals[p.id];
      const weight = totalBudgetSum > 0 ? budget / totalBudgetSum : 1 / (projects.length || 1);

      const laborDisbursed = disb
        ? disb.labor
        : Math.round(totalLaborFallback * weight);
      const subconDisbursed = disb
        ? disb.subcon
        : Math.round(totalSubconFallback * weight);
      const materialsDisbursed = getProjectMaterialSpend(p.name, allMaterials);

      const totalDisbursed = laborDisbursed + materialsDisbursed + subconDisbursed;
      const remainingBuffer = budget - totalDisbursed;
      const burnRatePct = budget > 0 ? (totalDisbursed / budget) * 100 : 0;

      return {
        id: p.id,
        name: p.name,
        clientName: p.clientName || 'Corporate Client',
        status: p.status || 'IN_PROGRESS',
        progress,
        budget,
        collected,
        laborDisbursed,
        materialsDisbursed,
        subconDisbursed,
        totalDisbursed,
        remainingBuffer,
        burnRatePct,
      };
    });
  }, [projects, projectDisbursals, totalLaborFallback, totalSubconFallback]);

  const totals = useMemo(() => {
    const allocatedBudget = rows.reduce((s, r) => s + r.budget, 0);
    const collectedFunds = rows.reduce((s, r) => s + r.collected, 0);
    const manpowerTotal = rows.reduce((s, r) => s + r.laborDisbursed, 0);
    const materialsTotal = rows.reduce((s, r) => s + r.materialsDisbursed, 0);
    const subconTotal = rows.reduce((s, r) => s + r.subconDisbursed, 0);
    const totalDisbursed = manpowerTotal + materialsTotal + subconTotal;
    const burnRatePct = allocatedBudget > 0 ? (totalDisbursed / allocatedBudget) * 100 : 0;
    const collectionPacePct = allocatedBudget > 0 ? Math.round((collectedFunds / allocatedBudget) * 100) : 0;
    const avgProgress = rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + r.progress, 0) / rows.length)
      : 0;

    return {
      allocatedBudget,
      collectedFunds,
      manpowerTotal,
      materialsTotal,
      subconTotal,
      totalDisbursed,
      remainingBuffer: allocatedBudget - totalDisbursed,
      burnRatePct,
      collectionPacePct,
      avgProgress,
    };
  }, [rows]);

  if (!isOpen) return null;

  const handlePrintReport = () => {
    const tableRowsHtml = rows
      .map(
        (r) => `
      <tr>
        <td><strong>${escapePrintHtml(r.name)}</strong><br/><span style="color:#64748b;font-size:10px;">${escapePrintHtml(r.clientName)}</span></td>
        <td class="mono" style="text-align:right;">₱${r.budget.toLocaleString()}</td>
        <td class="mono" style="text-align:right;">₱${r.laborDisbursed.toLocaleString()}</td>
        <td class="mono" style="text-align:right;">₱${r.materialsDisbursed.toLocaleString()}</td>
        <td class="mono" style="text-align:right;">₱${r.subconDisbursed.toLocaleString()}</td>
        <td class="mono" style="text-align:right;font-weight:700;">₱${r.totalDisbursed.toLocaleString()}</td>
        <td class="mono" style="text-align:right;color:#047857;">₱${r.collected.toLocaleString()}</td>
        <td class="mono" style="text-align:center;font-weight:700;color:${r.burnRatePct > 100 ? '#be123c' : r.burnRatePct >= 80 ? '#b45309' : '#047857'};">${r.burnRatePct.toFixed(1)}%</td>
        <td class="mono" style="text-align:center;">${r.progress}%</td>
      </tr>
    `
      )
      .join('');

    openEnterprisePrintWindow({
      title: 'Portfolio Budgets & Disbursed Expenses Summary',
      subtitle: 'Executive Capital Allocation, Disbursement Breakdown & Burn Rate Ledger',
      docRef: `LDM-BUDGET-${new Date().toISOString().slice(0, 10)}`,
      orientation: 'landscape',
      kpiSummary: [
        { label: 'Total Allocated Budget', value: `₱${totals.allocatedBudget.toLocaleString()}` },
        { label: 'Total Disbursed Expenses', value: `₱${totals.totalDisbursed.toLocaleString()}` },
        { label: 'Collected Funds', value: `₱${totals.collectedFunds.toLocaleString()} (${totals.collectionPacePct}%)` },
        { label: 'Portfolio Burn Rate', value: `${totals.burnRatePct.toFixed(1)}%` },
      ],
      bodyHtml: `
        <div class="section-title">Disbursement Category Breakdown</div>
        <table>
          <thead>
            <tr>
              <th>Expense Category</th>
              <th style="text-align:right;">Amount Disbursed (PHP)</th>
              <th style="text-align:right;">Share of Total Spend</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>In-House Manpower &amp; Labor Payroll</td>
              <td class="mono" style="text-align:right;">₱${totals.manpowerTotal.toLocaleString()}</td>
              <td class="mono" style="text-align:right;">${totals.totalDisbursed > 0 ? ((totals.manpowerTotal / totals.totalDisbursed) * 100).toFixed(1) : '0.0'}%</td>
            </tr>
            <tr>
              <td>Site Materials &amp; Procurement Ledger</td>
              <td class="mono" style="text-align:right;">₱${totals.materialsTotal.toLocaleString()}</td>
              <td class="mono" style="text-align:right;">${totals.totalDisbursed > 0 ? ((totals.materialsTotal / totals.totalDisbursed) * 100).toFixed(1) : '0.0'}%</td>
            </tr>
            <tr>
              <td>Subcontractor Accounts Payable (AP)</td>
              <td class="mono" style="text-align:right;">₱${totals.subconTotal.toLocaleString()}</td>
              <td class="mono" style="text-align:right;">${totals.totalDisbursed > 0 ? ((totals.subconTotal / totals.totalDisbursed) * 100).toFixed(1) : '0.0'}%</td>
            </tr>
          </tbody>
        </table>

        <div class="section-title" style="margin-top:18px;">Project-by-Project Budget &amp; Spend Breakdown</div>
        <table>
          <thead>
            <tr>
              <th>Commercial Project</th>
              <th style="text-align:right;">Allocated Budget</th>
              <th style="text-align:right;">Manpower</th>
              <th style="text-align:right;">Materials</th>
              <th style="text-align:right;">Subcontractors</th>
              <th style="text-align:right;">Total Disbursed</th>
              <th style="text-align:right;">Collected</th>
              <th style="text-align:center;">Burn Rate</th>
              <th style="text-align:center;">Progress</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      `,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-6xl max-h-[92vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 border-b flex flex-wrap items-center justify-between gap-3 ${
            isDark ? 'border-slate-800 bg-slate-950/70' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className={`text-base sm:text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Budgets &amp; Expenses Overview
              </h2>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Allocated budgets, disbursed expenses (Manpower, Materials, Subcontractors), collections &amp; live burn rate
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintReport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Summary</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                isDark
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
              }`}
              title="Close Budgets & Expenses"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Top 4 Executive Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div
              className={`rounded-xl border p-4 ${
                initialFocus === 'budget'
                  ? 'border-amber-500/70 ring-1 ring-amber-500/30'
                  : isDark
                  ? 'border-slate-800 bg-slate-950/70'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-400">
                <span>Total Allocated Budget</span>
                <Building2 className="w-4 h-4 text-amber-400" />
              </div>
              <div className={`text-xl font-bold font-mono mt-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                ₱{totals.allocatedBudget.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Across {rows.length} active project{rows.length === 1 ? '' : 's'}
              </div>
            </div>

            <div
              className={`rounded-xl border p-4 ${
                isDark ? 'border-slate-800 bg-slate-950/70' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-400">
                <span>Disbursed Expenses</span>
                <Banknote className="w-4 h-4 text-indigo-400" />
              </div>
              <div className={`text-xl font-bold font-mono mt-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                ₱{totals.totalDisbursed.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Buffer: ₱{totals.remainingBuffer.toLocaleString()}
              </div>
            </div>

            <div
              className={`rounded-xl border p-4 ${
                initialFocus === 'collected'
                  ? 'border-emerald-500/70 ring-1 ring-emerald-500/30'
                  : isDark
                  ? 'border-slate-800 bg-slate-950/70'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-400">
                <span>Collected Funds</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-bold font-mono mt-1.5 text-emerald-400">
                ₱{totals.collectedFunds.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {totals.collectionPacePct}% of total contract value
              </div>
            </div>

            <div
              className={`rounded-xl border p-4 ${
                initialFocus === 'progress'
                  ? 'border-sky-500/70 ring-1 ring-sky-500/30'
                  : isDark
                  ? 'border-slate-800 bg-slate-950/70'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-400">
                <span>Burn Rate &amp; Progress</span>
                <Flame
                  className={`w-4 h-4 ${
                    totals.burnRatePct > 100
                      ? 'text-rose-400'
                      : totals.burnRatePct >= 80
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                />
              </div>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span
                  className={`text-xl font-bold font-mono ${
                    totals.burnRatePct > 100
                      ? 'text-rose-400'
                      : totals.burnRatePct >= 80
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {totals.burnRatePct.toFixed(1)}%
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  • {totals.avgProgress}% Avg. Progress
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2">
                <div
                  className={`h-full rounded-full ${
                    totals.burnRatePct > 100
                      ? 'bg-rose-500'
                      : totals.burnRatePct >= 80
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(totals.burnRatePct > 0 ? 2 : 0, totals.burnRatePct))}%` }}
                />
              </div>
            </div>
          </div>

          {/* 3-Category Expense Breakdown Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className={`rounded-xl border p-3.5 flex items-center justify-between ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-sky-500/15 border border-sky-500/30">
                  <Users className="w-4 h-4 text-sky-400" />
                </div>
                <div>
                  <div className="text-[11px] font-mono uppercase text-slate-400">Manpower / Labor</div>
                  <div className={`text-base font-bold font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    ₱{totals.manpowerTotal.toLocaleString()}
                  </div>
                </div>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                {totals.totalDisbursed > 0 ? ((totals.manpowerTotal / totals.totalDisbursed) * 100).toFixed(0) : 0}%
              </span>
            </div>

            <div className={`rounded-xl border p-3.5 flex items-center justify-between ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/30">
                  <Package className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <div className="text-[11px] font-mono uppercase text-slate-400">Materials &amp; Procurement</div>
                  <div className={`text-base font-bold font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    ₱{totals.materialsTotal.toLocaleString()}
                  </div>
                </div>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {totals.totalDisbursed > 0 ? ((totals.materialsTotal / totals.totalDisbursed) * 100).toFixed(0) : 0}%
              </span>
            </div>

            <div className={`rounded-xl border p-3.5 flex items-center justify-between ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-purple-500/15 border border-purple-500/30">
                  <HardHat className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <div className="text-[11px] font-mono uppercase text-slate-400">Subcontractors (AP)</div>
                  <div className={`text-base font-bold font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    ₱{totals.subconTotal.toLocaleString()}
                  </div>
                </div>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                {totals.totalDisbursed > 0 ? ((totals.subconTotal / totals.totalDisbursed) * 100).toFixed(0) : 0}%
              </span>
            </div>
          </div>

          {/* Per-Project Breakdown Table */}
          <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-white'}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className={`border-b font-mono text-[10px] uppercase tracking-wider ${isDark ? 'border-slate-800 bg-slate-950 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                    <th className="py-3 px-4">Project</th>
                    <th className="py-3 px-3 text-right">Allocated Budget</th>
                    <th className="py-3 px-3 text-right">Manpower</th>
                    <th className="py-3 px-3 text-right">Materials</th>
                    <th className="py-3 px-3 text-right">Subcontractors</th>
                    <th className="py-3 px-3 text-right">Total Disbursed</th>
                    <th className="py-3 px-3 text-right">Collected</th>
                    <th className="py-3 px-3 text-center">Burn Rate</th>
                    <th className="py-3 px-3 text-center">Progress</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-800/70' : 'divide-slate-100'}`}>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500 italic">
                        No project budget records available.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => {
                      const isOver = r.burnRatePct > 100;
                      const isNear = r.burnRatePct >= 80 && !isOver;
                      return (
                        <tr key={r.id} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                          <td className="py-3 px-4">
                            <div className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{r.name}</div>
                            <div className="text-[10px] text-slate-400">{r.clientName}</div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold">
                            ₱{r.budget.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-sky-400">
                            ₱{r.laborDisbursed.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-amber-400">
                            ₱{r.materialsDisbursed.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-purple-400">
                            ₱{r.subconDisbursed.toLocaleString()}
                          </td>
                          <td className={`py-3 px-3 text-right font-mono font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            ₱{r.totalDisbursed.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-emerald-400 font-semibold">
                            ₱{r.collected.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                                isOver
                                  ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                  : isNear
                                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                  : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              }`}
                            >
                              {isOver ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                              {r.burnRatePct.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-amber-400">
                            {r.progress}%
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
