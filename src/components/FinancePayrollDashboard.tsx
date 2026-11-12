/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Banknote, Calendar, Printer, CheckCircle2, Lock, AlertTriangle,
  FileSpreadsheet, Plus, RefreshCw, HardHat, FileText, ChevronRight,
  ShieldCheck, Info, X, DollarSign, ArrowUpRight, Search, ExternalLink,
  Mail, Phone, Send, Edit3
} from 'lucide-react';
import {
  ProjectProfile, PayrollRun, PayrollBreakdownItem, CashAdvance, UserSession, Contractor
} from '../types';
import { normalizeRole, UserRole } from '../utils/rbac';
import { computeWorkerShiftMetrics, DtrEntryState } from './TimekeeperAttendanceDashboard';
import { openEnterprisePrintWindow, escapePrintHtml } from '../utils/printEngine';
import { logAuditEvent } from '../utils/auditLogger';
import { useTheme } from '../context/ThemeContext';

const FALLBACK_PAYROLL_ARTISANS = [
  { id: 'ART-101', name: 'Ramon Dela Cruz', position: 'Site Leadman / Master Carpenter', dailyRate: 950, hourlyOtRate: 148.44 },
  { id: 'ART-102', name: 'Ernesto Villanueva', position: 'Site Foreman (Civil & Masonry)', dailyRate: 1050, hourlyOtRate: 164.06 },
  { id: 'ART-103', name: 'Jomar Santos', position: 'Master Electrician (MEPFS)', dailyRate: 900, hourlyOtRate: 140.63 },
  { id: 'ART-104', name: 'Arnel Mendoza', position: 'Senior Tile & Finishing Mason', dailyRate: 850, hourlyOtRate: 132.81 },
  { id: 'ART-105', name: 'Carlo Bautista', position: 'HVAC & Plumbing Technician', dailyRate: 880, hourlyOtRate: 137.5 },
  { id: 'ART-106', name: 'Dennis Soriano', position: 'Drywall & Acoustic Partition Installer', dailyRate: 800, hourlyOtRate: 125.0 },
  { id: 'ART-107', name: 'Reynaldo Pascual', position: 'Finishing Painter & Coating Specialist', dailyRate: 800, hourlyOtRate: 125.0 },
  { id: 'ART-108', name: 'Mark Anthony Reyes', position: 'General Construction Laborer', dailyRate: 700, hourlyOtRate: 109.38 }
];

interface FinancePayrollDashboardProps {
  projects: ProjectProfile[];
  contractors?: Contractor[];
  session?: UserSession | any;
  onRefreshData?: () => void;
  onNotify?: (msg: string) => void;
}

export default function FinancePayrollDashboard({
  projects = [],
  contractors = [],
  session,
  onRefreshData
}: FinancePayrollDashboardProps) {
  const { isDark } = useTheme();
  // Build unified live + localStorage projects list so newly created projects (e.g. "2-storey residential unit") are always selectable
  const effectiveProjects = useMemo<ProjectProfile[]>(() => {
    const byId = new Map<string, ProjectProfile>();
    const addList = (list: any[]) => {
      if (!Array.isArray(list)) return;
      for (const item of list) {
        if (!item || item.id === undefined || item.id === null) continue;
        const key = String(item.id);
        if (!byId.has(key)) {
          byId.set(key, {
            ...item,
            id: key,
            name: item.name || item.projectName || item.title || `Commercial Site #${key}`
          });
        }
      }
    };
    addList(projects);
    try {
      const cachedPrimary = localStorage.getItem('ctvill_cached_projects');
      if (cachedPrimary) addList(JSON.parse(cachedPrimary));
      const cachedSecondary = localStorage.getItem('ctvill_projects');
      if (cachedSecondary) addList(JSON.parse(cachedSecondary));
    } catch { }
    return Array.from(byId.values());
  }, [projects]);

  // State
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() =>
    effectiveProjects[0]?.id ? String(effectiveProjects[0].id) : ''
  );
  const [hasManuallyChangedDates, setHasManuallyChangedDates] = useState<boolean>(false);

  useEffect(() => {
    if (effectiveProjects.length > 0) {
      const exists = effectiveProjects.some(p => String(p.id) === String(selectedProjectId));
      if (!selectedProjectId || !exists) {
        setSelectedProjectId(String(effectiveProjects[0].id));
      }
    }
  }, [effectiveProjects, selectedProjectId]);

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
  const [viewingFinalizedRun, setViewingFinalizedRun] = useState<PayrollRun | null>(null);
  const [isLoadingFinalizedRun, setIsLoadingFinalizedRun] = useState<boolean>(false);
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

  // Individual & Batch Payslip Generator State
  const [selectedPayslipItem, setSelectedPayslipItem] = useState<PayrollBreakdownItem | null>(null);
  const [isBatchPayslipsModalOpen, setIsBatchPayslipsModalOpen] = useState<boolean>(false);
  const [batchDeliveryMode, setBatchDeliveryMode] = useState<'EMAIL_ONLY' | 'PRINT_ONLY' | 'BOTH_EMAIL_AND_PRINT'>('BOTH_EMAIL_AND_PRINT');
  const [isEditingModalEmail, setIsEditingModalEmail] = useState<boolean>(false);
  const [modalEmailDraft, setModalEmailDraft] = useState<string>('');

  const [workerEmailOverrides, setWorkerEmailOverrides] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('ctvill_worker_email_overrides');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [dispatchedPayslips, setDispatchedPayslips] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('ctvill_dispatched_payslips');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Resolve worker email, mobile number, and payout channel from Masterlist + deterministic fallback
  const resolveWorkerContact = (item: Pick<PayrollBreakdownItem, 'workerId' | 'workerName' | 'position'>) => {
    const wid = String(item.workerId || '').trim();
    const wname = String(item.workerName || '').trim();

    let masterMatch: Partial<Contractor> | undefined = contractors.find(
      (c) => String(c.id) === wid || String(c.name || '').toLowerCase() === wname.toLowerCase()
    );
    if (!masterMatch) {
      try {
        const cached = localStorage.getItem('ctvill_contractors');
        if (cached) {
          const list = JSON.parse(cached);
          if (Array.isArray(list)) {
            masterMatch = list.find(
              (c: any) => String(c.id) === wid || String(c.name || '').toLowerCase() === wname.toLowerCase()
            );
          }
        }
      } catch { }
    }

    // Deterministic fallback email: <firstname>.<lastname>@ldmconstruction.ph
    const nameTokens = wname
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(Boolean);
    const firstToken = nameTokens[0] || 'artisan';
    const lastToken = nameTokens.length > 1 ? nameTokens[nameTokens.length - 1] : wid.toLowerCase().replace(/[^a-z0-9]/g, '');
    const fallbackEmail = `${firstToken}.${lastToken}@ldmconstruction.ph`;

    // Deterministic fallback phone: 0917-XXX-XXXX based on workerId/name hash
    let hash = 0;
    const seedStr = `${wid}-${wname}`;
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash * 31 + seedStr.charCodeAt(i)) % 9000000;
    }
    const num7 = String(1000000 + Math.abs(hash)).slice(0, 7);
    const fallbackPhone = `0917-${num7.slice(0, 3)}-${num7.slice(3, 7)}`;

    const email =
      workerEmailOverrides[wid] ||
      (masterMatch?.email && masterMatch.email.includes('@') ? masterMatch.email.trim() : '') ||
      fallbackEmail;

    const phone =
      (masterMatch?.phone && masterMatch.phone.trim().length >= 7 ? masterMatch.phone.trim() : '') ||
      fallbackPhone;

    // Payout channel badge: deterministic or role-based (e.g. General Laborer / Mason may use Site Cash Envelope or Email / GCash)
    const isCashEnvelope =
      wid.endsWith('4') ||
      wid.endsWith('8') ||
      String(item.position || '').toLowerCase().includes('laborer');
    const payoutChannel: '📧 Email / GCash' | '💵 Site Cash Envelope' = isCashEnvelope
      ? '💵 Site Cash Envelope'
      : '📧 Email / GCash';

    return { email, phone, payoutChannel };
  };

  const handleSaveWorkerEmailOverride = (workerId: string, newEmail: string) => {
    const cleaned = newEmail.trim();
    if (!cleaned || !cleaned.includes('@')) return;
    setWorkerEmailOverrides((prev) => {
      const next = { ...prev, [workerId]: cleaned };
      try {
        localStorage.setItem('ctvill_worker_email_overrides', JSON.stringify(next));
      } catch { }
      return next;
    });
    setIsEditingModalEmail(false);
    setToastMessage({
      text: `Updated recipient email for ${workerId} to ${cleaned}.`,
      type: 'success',
    });
  };

  const buildPayslipMailtoUrl = (item: PayrollBreakdownItem) => {
    const { email, phone, payoutChannel } = resolveWorkerContact(item);
    const pStart = selectedRunDetail?.periodStart || periodStart;
    const pEnd = selectedRunDetail?.periodEnd || periodEnd;
    const siteName = activeProject?.name || selectedRunDetail?.projectName || 'LDM Construction Project Site';
    const refId = `PS-${String(selectedProjectId || 'SITE').slice(-4).toUpperCase()}-${item.workerId}-${pEnd.replace(/-/g, '')}`;
    const regHours = Number((Number(item.daysWorked || 0) * 8).toFixed(2));
    const basePayVal = Number(item.basePay ?? Number(item.daysWorked || 0) * Number(item.dailyRate || 0));
    const otPayVal = Number(item.otPay || 0);
    const grossPayVal = Number(item.grossPay || basePayVal + otPayVal);
    const deductVal = Number(item.totalDeductions || 0);
    const netPayVal = Number(item.netPay || grossPayVal - deductVal);

    const subject = encodeURIComponent(
      `[LDM Construction Official E-Payslip] ${item.workerName} (${pStart} to ${pEnd}) - Ref ${refId}`
    );
    const body = encodeURIComponent(
      `LDM CONSTRUCTION — ENGINEERS • ARCHITECTS • BUILDERS\n` +
      `ldmengineeringdesign@gmail.com • (+63) 945 681 0515\n` +
      `OFFICIAL INDIVIDUAL EMPLOYEE E-PAYSLIP\n` +
      `==================================================\n` +
      `Payslip Ref ID: ${refId}\n` +
      `Pay Period: ${pStart} to ${pEnd}\n` +
      `Assigned Project Site: ${siteName}\n\n` +
      `WORKER DETAILS:\n` +
      `- Name: ${item.workerName} (${item.workerId})\n` +
      `- Position / Trade: ${item.position}\n` +
      `- Mobile / GCash: ${phone}\n` +
      `- Payout Channel: ${payoutChannel}\n\n` +
      `EARNINGS BREAKDOWN:\n` +
      `- Regular Worked: ${item.daysWorked ?? 0} days (${regHours} Reg Hrs) @ PHP ${Number(item.dailyRate || 0).toLocaleString()}/day = PHP ${basePayVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n` +
      `- Overtime (1.25x): ${item.otHours ?? 0} hrs = PHP ${otPayVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n` +
      `- GROSS PAY: PHP ${grossPayVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n` +
      `- Vale / Deductions: -PHP ${deductVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n` +
      `--------------------------------------------------\n` +
      `VERIFIED NET TAKE-HOME PAY: PHP ${netPayVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n` +
      `==================================================\n` +
      `Released by: LDM Construction Finance & Payroll Controller`
    );
    return `mailto:${email}?subject=${subject}&body=${body}`;
  };

  const markPayslipDispatched = (item: PayrollBreakdownItem) => {
    const { email, payoutChannel } = resolveWorkerContact(item);
    const cycleKey = `${selectedRunDetail?.periodStart || periodStart}_${selectedRunDetail?.periodEnd || periodEnd}_${item.workerId}`;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setDispatchedPayslips((prev) => {
      const next = { ...prev, [cycleKey]: timestamp };
      try {
        localStorage.setItem('ctvill_dispatched_payslips', JSON.stringify(next));
      } catch { }
      return next;
    });
    setToastMessage({
      text: `✅ Emailed to ${email} & Queued Site Claim Stub (${item.workerName} • ${payoutChannel}) at ${timestamp}.`,
      type: 'success',
    });
  };

  const renderPayslipVoucherHtml = (item: PayrollBreakdownItem) => {
    const { email, phone, payoutChannel } = resolveWorkerContact(item);
    const pStart = selectedRunDetail?.periodStart || periodStart;
    const pEnd = selectedRunDetail?.periodEnd || periodEnd;
    const siteName = activeProject?.name || selectedRunDetail?.projectName || 'LDM Construction Project Site';
    const refId = `PS-${String(selectedProjectId || 'SITE').slice(-4).toUpperCase()}-${item.workerId}-${pEnd.replace(/-/g, '')}`;
    const regHours = Number((Number(item.daysWorked || 0) * 8).toFixed(2));
    const hourlyRate = Number((Number(item.dailyRate || 0) / 8).toFixed(2));
    const otRate = Number((item.hourlyOtRate || hourlyRate * 1.25).toFixed(2));
    const basePayVal = Number(item.basePay ?? Number(item.daysWorked || 0) * Number(item.dailyRate || 0));
    const otPayVal = Number(item.otPay || 0);
    const grossPayVal = Number(item.grossPay || basePayVal + otPayVal);
    const deductVal = Number(item.totalDeductions || 0);
    const netPayVal = Number(item.netPay || grossPayVal - deductVal);

    return `<div class="payslip-voucher">
      <div class="voucher-hdr">
        <div>
          <div style="font-size:12px;font-weight:900;text-transform:uppercase;">OFFICIAL PAYSLIP &amp; CASH/GCASH RELEASE VOUCHER</div>
          <div style="font-size:10px;color:#334155;font-weight:700;">Worker: ${escapePrintHtml(item.workerName)} (${escapePrintHtml(item.workerId)}) • ${escapePrintHtml(item.position)}</div>
          <div style="font-size:9.5px;color:#475569;">Email: ${escapePrintHtml(email)} • Mobile: ${escapePrintHtml(phone)} • Channel: ${escapePrintHtml(payoutChannel)}</div>
        </div>
        <div style="text-align:right;font-family:monospace;font-size:9.5px;">
          <div><strong>VOUCHER REF:</strong> ${escapePrintHtml(refId)}</div>
          <div><strong>PERIOD:</strong> ${escapePrintHtml(pStart)} to ${escapePrintHtml(pEnd)}</div>
          <div><strong>SITE:</strong> ${escapePrintHtml(siteName)}</div>
        </div>
      </div>

      <table class="ent-table" style="margin-bottom:8px;">
        <thead>
          <tr>
            <th>Earnings &amp; Adjustments Breakdown</th>
            <th class="center">Days / Hours</th>
            <th class="num">Rate (₱)</th>
            <th class="num">Amount (₱)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Regular Basic Wage (8.0h Standard Shift)</td>
            <td class="center">${item.daysWorked ?? 0} days (${regHours} hrs)</td>
            <td class="num">₱${Number(item.dailyRate || 0).toLocaleString()}/day (₱${hourlyRate}/hr)</td>
            <td class="num">₱${basePayVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td>Approved Overtime Pay (1.25x DOLE Rate)</td>
            <td class="center">${item.otHours ?? 0} hrs</td>
            <td class="num">₱${otRate}/hr</td>
            <td class="num">₱${otPayVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td colspan="3"><strong>Gross Earnings</strong></td>
            <td class="num"><strong>₱${grossPayVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></td>
          </tr>
          <tr>
            <td colspan="3">Less: Cash Advances (Vale) &amp; Undertime Adjustments</td>
            <td class="num">-₱${deductVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr class="total-row">
            <td colspan="3">VERIFIED NET TAKE-HOME PAY (PHP)</td>
            <td class="num">₱${netPayVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          </tr>
        </tbody>
      </table>

      <div class="claim-stub">
        <div style="display:flex;justify-content:space-between;font-weight:800;">
          <span>✂️ WORKER ACKNOWLEDGEMENT &amp; CLAIM STUB (${escapePrintHtml(refId)})</span>
          <span>NET AMOUNT: ₱${netPayVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div style="margin-top:2px;color:#334155;">
          Received full net wage for cycle ${escapePrintHtml(pStart)} to ${escapePrintHtml(pEnd)} via ${escapePrintHtml(payoutChannel)}.
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:16px;text-align:center;">
          <div style="border-top:1px solid #0f172a;padding-top:3px;">
            <strong>Clarisse Mendoza / Site Timekeeper</strong><br/>Authorized Disbursing Officer
          </div>
          <div style="border-top:1px solid #0f172a;padding-top:3px;">
            <strong>${escapePrintHtml(item.workerName)} (${escapePrintHtml(item.workerId)})</strong><br/>Worker Signature &amp; Date Received: ____/____/2026
          </div>
        </div>
      </div>
    </div>`;
  };

  const handlePrintSinglePayslip = (item: PayrollBreakdownItem) => {
    const pStart = selectedRunDetail?.periodStart || periodStart;
    const pEnd = selectedRunDetail?.periodEnd || periodEnd;
    const siteName = activeProject?.name || selectedRunDetail?.projectName || 'LDM Construction Project Site';
    const refId = `PS-${String(selectedProjectId || 'SITE').slice(-4).toUpperCase()}-${item.workerId}-${pEnd.replace(/-/g, '')}`;

    openEnterprisePrintWindow({
      title: `Official Employee Payslip — ${item.workerName}`,
      subtitle: 'Individual Worker Wage Statement & Physical Site Claim Voucher',
      docRef: refId,
      orientation: 'portrait',
      projectMeta: {
        name: siteName,
        location: activeProject?.location || 'LDM Project Site',
        period: `${pStart} to ${pEnd}`,
        client: (activeProject as any)?.clientName || (activeProject as any)?.client || (selectedRunDetail as any)?.clientName || 'LDM Construction Client',
      },
      bodyHtml: `<div class="payslip-grid">${renderPayslipVoucherHtml(item)}</div>`,
      signatures: [],
    });
  };

  const markAllPayslipsDispatched = (
    items: PayrollBreakdownItem[],
    mode: 'EMAIL_ONLY' | 'PRINT_ONLY' | 'BOTH_EMAIL_AND_PRINT' = batchDeliveryMode
  ) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setDispatchedPayslips((prev) => {
      const next = { ...prev };
      for (const item of items) {
        const cycleKey = `${selectedRunDetail?.periodStart || periodStart}_${selectedRunDetail?.periodEnd || periodEnd}_${item.workerId}`;
        next[cycleKey] = timestamp;
      }
      try {
        localStorage.setItem('ctvill_dispatched_payslips', JSON.stringify(next));
      } catch { }
      return next;
    });

    if (mode === 'PRINT_ONLY') {
      setToastMessage({
        text: `✅ Generated Printable Site Claim Stubs for ${items.length} workers (Released via Site Timekeeper / Foreman).`,
        type: 'success',
      });
      handlePrint('payslips');
    } else if (mode === 'EMAIL_ONLY') {
      setToastMessage({
        text: `✅ Emailed ${items.length} E-Payslips to registered worker email addresses & Queued Site Claim Stubs.`,
        type: 'success',
      });
    } else {
      setToastMessage({
        text: `✅ Emailed ${items.length} E-Payslips to registered worker email addresses & generated Printable Site Claim Stubs.`,
        type: 'success',
      });
      handlePrint('payslips');
    }
  };

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
      const res = await fetch(`/api/payroll/runs${q}`);
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

  const activeProject = useMemo(
    () =>
      effectiveProjects.find(p => String(p.id) === String(selectedProjectId)) ||
      effectiveProjects[0] ||
      undefined,
    [effectiveProjects, selectedProjectId]
  );

  // Aggregate submitted/active DTR logs from shared localStorage (or fallback to project's active assigned in-house roster)
  const buildLocalPayrollDraft = (
    projId: string,
    startStr: string,
    endStr: string,
    enforceStrictDates: boolean
  ) => {
    const proj = effectiveProjects.find(p => String(p.id) === String(projId));
    const projNameLower = String(proj?.name || '').toLowerCase().trim();

    let ledger: any = null;
    try {
      const rawById = localStorage.getItem(`ctvill_dtr_project_ledger_${projId}`);
      if (rawById) ledger = JSON.parse(rawById);
      if (!ledger && projNameLower) {
        const rawByName = localStorage.getItem(`ctvill_dtr_project_ledger_name_${projNameLower}`);
        if (rawByName) ledger = JSON.parse(rawByName);
      }
    } catch { }

    // Resolve roster of workers for this project
    let roster: { id: string; name: string; position: string; dailyRate: number; hourlyOtRate: number }[] = [];
    if (Array.isArray(ledger?.workers) && ledger.workers.length > 0) {
      roster = ledger.workers.map((w: any) => {
        const dailyRate = Number(w.dailyRate ?? w.daily_rate ?? 750);
        return {
          id: String(w.id),
          name: String(w.name || 'Site Artisan'),
          position: String(w.position || w.trade || 'Skilled Artisan'),
          dailyRate,
          hourlyOtRate: Number(w.hourlyOtRate ?? +((dailyRate / 8) * 1.25).toFixed(2))
        };
      });
    }

    if (roster.length === 0 && contractors && contractors.length > 0) {
      const assigned = contractors.filter(c => {
        if (c.employmentType === 'OUTSOURCED' || (c.activeManpower && c.activeManpower > 1)) return false;
        return (
          String(c.assignedProjectId || '') === String(projId) ||
          (proj?.assignedContractorIds || []).map(String).includes(String(c.id)) ||
          (projNameLower && (c.activeProjectSite || '').toLowerCase().trim() === projNameLower)
        );
      });
      const source = assigned.length > 0 ? assigned : contractors.filter(c => c.employmentType !== 'OUTSOURCED' && (!c.activeManpower || c.activeManpower <= 1)).slice(0, 8);
      roster = source.map(c => {
        const dailyRate = Number(c.dailyRate || 800);
        return {
          id: String(c.id),
          name: String(c.name || 'Site Artisan'),
          position: String(c.tradeType || c.specialty || c.roleTitle || 'Skilled Artisan'),
          dailyRate,
          hourlyOtRate: +((dailyRate / 8) * 1.25).toFixed(2)
        };
      });
    }

    if (roster.length === 0) {
      roster = FALLBACK_PAYROLL_ARTISANS;
    }

    // Collect per-date DTR maps from ledger + any standalone `ctvill_dtr_entries_${projId}_*` keys
    const dateMaps: Record<string, Record<string, any>> = {
      ...(ledger?.dates || {})
    };
    try {
      const prefix = `ctvill_dtr_entries_${projId}_`;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          const datePart = key.slice(prefix.length);
          if (!dateMaps[datePart]) {
            const parsed = JSON.parse(localStorage.getItem(key) || '{}');
            if (parsed && typeof parsed === 'object') {
              dateMaps[datePart] = parsed;
            }
          }
        }
      }
    } catch { }

    const allDates = Object.keys(dateMaps).sort();
    const inWindowDates = allDates.filter(d => d >= startStr && d <= endStr);
    // Use in-window dates if present; otherwise if user hasn't manually changed dates (or no in-window dates exist), aggregate all project DTR dates
    const targetDates =
      inWindowDates.length > 0
        ? inWindowDates
        : !enforceStrictDates
          ? allDates
          : allDates;

    const items: PayrollBreakdownItem[] = [];
    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;

    for (const w of roster) {
      let daysWorked = 0;
      let otHours = 0;
      let basePay = 0;
      let otPay = 0;

      if (targetDates.length > 0) {
        for (const dStr of targetDates) {
          const entry: any = dateMaps[dStr]?.[w.id];
          if (!entry) continue;
          if (entry.granularStatus === 'ABSENT' || entry.status === 'ABSENT') continue;

          if (typeof entry.regularHours === 'number') {
            const dayFraction = +(entry.regularHours / 8).toFixed(2);
            const entryOt = Number(entry.overtimeHours || 0);
            daysWorked += dayFraction;
            otHours += entryOt;
            basePay += dayFraction * w.dailyRate;
            otPay += entryOt * w.hourlyOtRate;
          } else {
            const metrics = computeWorkerShiftMetrics(entry as DtrEntryState, w.dailyRate);
            if (metrics.regularHours > 0 || metrics.overtimeHours > 0) {
              const dayFraction = +(metrics.regularHours / 8).toFixed(2);
              daysWorked += dayFraction;
              otHours += metrics.overtimeHours;
              basePay += dayFraction * w.dailyRate;
              otPay += metrics.overtimeHours * w.hourlyOtRate;
            }
          }
        }
      } else {
        // Fallback when no DTR log has been saved yet: 1 standard active shift (8.0h = 1.0 day)
        daysWorked = 1.0;
        otHours = 0;
        basePay = w.dailyRate;
        otPay = 0;
      }

      if (daysWorked > 0 || otHours > 0) {
        const cleanBase = +basePay.toFixed(2);
        const cleanOt = +otPay.toFixed(2);
        const grossPay = +(cleanBase + cleanOt).toFixed(2);
        const deductions = 0;
        const netPay = +(grossPay - deductions).toFixed(2);

        items.push({
          workerId: w.id,
          workerName: w.name,
          position: w.position,
          dailyRate: w.dailyRate,
          hourlyOtRate: w.hourlyOtRate,
          daysWorked: +daysWorked.toFixed(2),
          otHours: +otHours.toFixed(2),
          basePay: cleanBase,
          otPay: cleanOt,
          grossPay,
          totalDeductions: deductions,
          netPay,
          cashAdvances: []
        });

        totalGross += grossPay;
        totalDeductions += deductions;
        totalNet += netPay;
      }
    }

    return {
      totalGross: +totalGross.toFixed(2),
      totalDeductions: +totalDeductions.toFixed(2),
      totalNet: +totalNet.toFixed(2),
      workerCount: items.length,
      items,
      hasLocalDtrLogs: allDates.length > 0
    };
  };

  // Auto-sync draft calculation when Timekeeper submits a Daily Log
  useEffect(() => {
    const handleSync = (e: any) => {
      const syncedProjId = e?.detail?.projectId;
      if (!syncedProjId || String(syncedProjId) === String(selectedProjectId)) {
        const localDraft = buildLocalPayrollDraft(selectedProjectId, periodStart, periodEnd, hasManuallyChangedDates);
        if (localDraft.workerCount > 0) {
          setDraftCalculation(localDraft);
        }
      }
    };
    window.addEventListener('ctvill-dtr-payroll-sync', handleSync);
    return () => window.removeEventListener('ctvill-dtr-payroll-sync', handleSync);
  }, [selectedProjectId, periodStart, periodEnd, hasManuallyChangedDates, effectiveProjects, contractors]);

  // Generate Draft Payroll
  const handleGenerateDraft = async () => {
    if (!selectedProjectId) {
      setToastMessage({ text: 'Please select a project site first.', type: 'error' });
      return;
    }

    setIsGenerating(true);
    const localDraft = buildLocalPayrollDraft(
      selectedProjectId,
      periodStart,
      periodEnd,
      hasManuallyChangedDates
    );

    try {
      const res = await fetch('/api/payroll/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId: selectedProjectId,
          periodStart,
          periodEnd
        })
      });

      const data = await res.json().catch(() => ({}));
      const apiDraft = res.ok ? data?.draft : null;

      // Prefer local DTR ledger if Timekeeper has logged rich DTR timestamps for this project, or if API returned 0 workers / ₱0
      const resolvedDraft =
        localDraft.hasLocalDtrLogs && localDraft.workerCount > 0
          ? localDraft
          : apiDraft && apiDraft.workerCount > 0 && apiDraft.totalGross > 0
            ? apiDraft
            : localDraft;

      setDraftCalculation(resolvedDraft);
      setCycleBoundsNotice(false);
      setToastMessage({
        text: `Payroll draft calculated for ${resolvedDraft.workerCount} workers! Total Net: ₱${resolvedDraft.totalNet.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        type: 'success'
      });
    } catch {
      // Fallback cleanly to local DTR / assigned project roster calculation
      setDraftCalculation(localDraft);
      setCycleBoundsNotice(false);
      setToastMessage({
        text: `Payroll draft calculated for ${localDraft.workerCount} workers! Total Net: ₱${localDraft.totalNet.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        type: 'success'
      });
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
          'Content-Type': 'application/json'
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
      const detailRes = await fetch(`/api/payroll/runs/${data.payrollRunId}`);
      if (detailRes.ok) {
        setSelectedRunDetail(await detailRes.json());
      }

      // Record immutable operational audit event
      logAuditEvent({
        entityType: 'CIVIL_WORKS',
        entityId: data.payrollRunId || `PAY-${Date.now().toString().slice(-4)}`,
        action: 'PAYROLL_FINALIZED',
        actorName: session?.name || 'Clarisse Mendoza',
        actorRole: 'Finance Controller',
        details: `Finalized and locked weekly payroll register for ${activeProject?.name || 'Project Site'} (${periodStart} to ${periodEnd}). Disbursed: ₱${(draftCalculation.totalNet || 0).toLocaleString()}`
      });
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
          'Content-Type': 'application/json'
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

      logAuditEvent({
        entityType: 'CIVIL_WORKS',
        entityId: selectedWorkerForVale.id,
        action: 'VALE_ISSUED',
        actorName: session?.name || 'Clarisse Mendoza',
        actorRole: 'Finance Controller',
        details: `Issued mid-week subsistence vale voucher of ₱${amountNum.toLocaleString()} for ${selectedWorkerForVale.name} (${activeProject?.name || 'Site'}). Synchronized to weekly payroll.`
      });

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

  // Trigger Enterprise A4 Print Window
  const handlePrint = (type: 'summary' | 'payslips') => {
    setPrintPreviewType(type);
    const pStart = selectedRunDetail?.periodStart || periodStart;
    const pEnd = selectedRunDetail?.periodEnd || periodEnd;
    const siteName = activeProject?.name || selectedRunDetail?.projectName || 'LDM Construction Project Site';
    const totalGrossVal = Number(selectedRunDetail?.totalGross ?? draftCalculation?.totalGross ?? 0);
    const totalDeductVal = Number(selectedRunDetail?.totalDeductions ?? draftCalculation?.totalDeductions ?? 0);
    const totalNetVal = Number(selectedRunDetail?.totalNet ?? draftCalculation?.totalNet ?? 0);

    if (type === 'payslips') {
      const vouchersHtml = displayItems.map((item) => renderPayslipVoucherHtml(item)).join('');
      openEnterprisePrintWindow({
        title: 'Official Worker Payslips & Cash/GCash Release Vouchers',
        subtitle: `Batch Payout Slips with Physical Site Claim Stubs (${displayItems.length} Active Artisans)`,
        docRef: selectedRunDetail?.id || `PAYSLIPS-${pEnd.replace(/-/g, '')}`,
        orientation: 'portrait',
        projectMeta: {
          name: siteName,
          location: activeProject?.location || 'LDM Project Site',
          period: `${pStart} to ${pEnd}`,
          client: (activeProject as any)?.clientName || (activeProject as any)?.client || (selectedRunDetail as any)?.clientName || 'LDM Construction Client',
        },
        kpiSummary: [
          { label: 'Total Workers', value: `${displayItems.length} Artisans` },
          { label: 'Total Gross Payroll', value: `₱${totalGrossVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
          { label: 'Total Vale / Deductions', value: `-₱${totalDeductVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
          { label: 'Total Net Take-Home', value: `₱${totalNetVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
        ],
        bodyHtml: `<div class="payslip-grid">${vouchersHtml}</div>`,
        signatures: [],
      });
      return;
    }

    // Master Payroll Sheet in A4 Landscape
    const rowsHtml = displayItems
      .map((item, idx) => {
        const contact = resolveWorkerContact(item);
        const basePayVal = Number(item.basePay ?? Number(item.daysWorked || 0) * Number(item.dailyRate || 0));
        const otPayVal = Number(item.otPay || 0);
        const grossPayVal = Number(item.grossPay || basePayVal + otPayVal);
        const deductVal = Number(item.totalDeductions || 0);
        const netPayVal = Number(item.netPay || grossPayVal - deductVal);
        return `<tr>
          <td class="center">${idx + 1}</td>
          <td>
            <strong>${escapePrintHtml(item.workerName)}</strong><br/>
            <span style="font-size:9px;color:#475569;font-family:monospace;">${escapePrintHtml(item.workerId)} • ${escapePrintHtml(contact.email)}</span>
          </td>
          <td>${escapePrintHtml(item.position)}</td>
          <td class="num">₱${Number(item.dailyRate || 0).toLocaleString()}</td>
          <td class="center">${item.daysWorked ?? 0}</td>
          <td class="center">${item.otHours ?? 0}</td>
          <td class="num">₱${basePayVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          <td class="num">₱${otPayVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          <td class="num"><strong>₱${grossPayVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></td>
          <td class="num">-₱${deductVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          <td class="num"><strong>₱${netPayVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></td>
          <td style="width:120px;"></td>
        </tr>`;
      })
      .join('');

    const bodyHtml = `<table class="ent-table">
      <thead>
        <tr>
          <th class="center">#</th>
          <th>Worker Name &amp; Email</th>
          <th>Trade / Position</th>
          <th class="num">Daily Rate</th>
          <th class="center">Days Worked</th>
          <th class="center">OT Hours</th>
          <th class="num">Base Pay</th>
          <th class="num">OT Pay</th>
          <th class="num">Gross Pay</th>
          <th class="num">Vale / Deductions</th>
          <th class="num">Net Take-Home</th>
          <th class="center">Worker Signature</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="total-row">
          <td colspan="8" class="num">GRAND TOTAL WEEKLY PAYROLL DISBURSAL:</td>
          <td class="num">₱${totalGrossVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          <td class="num">-₱${totalDeductVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          <td class="num">₱${totalNetVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          <td></td>
        </tr>
      </tbody>
    </table>`;

    openEnterprisePrintWindow({
      title: 'Official Weekly Payroll Master Register',
      subtitle: 'Direct In-House Workforce Wage Computation & Site Payout Ledger',
      docRef: selectedRunDetail?.id || `PAY-MASTER-${pEnd.replace(/-/g, '')}`,
      orientation: 'landscape',
      projectMeta: {
        name: siteName,
        location: activeProject?.location || 'LDM Project Site',
        period: `${pStart} to ${pEnd}`,
        client: (activeProject as any)?.clientName || (activeProject as any)?.client || (selectedRunDetail as any)?.clientName || 'LDM Construction Client',
      },
      kpiSummary: [
        { label: 'Active Workforce', value: `${displayItems.length} Artisans` },
        { label: 'Total Gross Earnings', value: `₱${totalGrossVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
        { label: 'Total Vale / Deductions', value: `-₱${totalDeductVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
        { label: 'Net Payroll Disbursal', value: `₱${totalNetVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
      ],
      bodyHtml,
      signatures: [
        { role: 'Prepared By (Timekeeper)', name: 'Rodel Reyes', title: 'Site Timekeeper & Attendance Officer' },
        { role: 'Checked & Verified By (PM)', name: 'Engr. Marco Santos', title: 'Project Manager / Senior Civil Engineer' },
        { role: 'Approved For Release (Finance)', name: 'Clarisse Mendoza, CPA', title: 'Finance & Payroll Controller' },
      ],
    });
  };

  const handleOpenFinalizedRun = async (run: PayrollRun) => {
    setIsLoadingFinalizedRun(true);
    try {
      const res = await fetch(`/api/payroll/runs/${run.id}`);
      if (res.ok) {
        const detailed = await res.json();
        setViewingFinalizedRun(detailed);
        return;
      }
    } catch (e) {
      console.warn('Could not fetch payroll run detail from server, using local fallback:', e);
    } finally {
      setIsLoadingFinalizedRun(false);
    }

    if (Array.isArray(run.items) && run.items.length > 0) {
      setViewingFinalizedRun(run);
      return;
    }

    const draft = buildLocalPayrollDraft(
      run.projectId || selectedProjectId || 'PRJ-4693',
      run.periodStart || '2026-09-14',
      run.periodEnd || '2026-09-21',
      false
    );
    setViewingFinalizedRun({
      ...run,
      items: draft.items && draft.items.length > 0 ? draft.items : (run.items || [])
    });
  };

  const handlePrintFinalizedRegister = (run: PayrollRun) => {
    const items = run.items && run.items.length > 0
      ? run.items
      : buildLocalPayrollDraft(run.projectId || selectedProjectId || 'PRJ-4693', run.periodStart, run.periodEnd, false).items;

    const totalGrossVal = Number(run.totalGross || items.reduce((s, i) => s + Number(i.grossPay || 0), 0));
    const totalDeductVal = Number(run.totalDeductions || items.reduce((s, i) => s + Number(i.totalDeductions || 0), 0));
    const totalNetVal = Number(run.totalNet || totalGrossVal - totalDeductVal);

    const rowsHtml = items.map((item, idx) => {
      const contact = resolveWorkerContact(item);
      const basePayVal = Number(item.basePay ?? Number(item.daysWorked || 0) * Number(item.dailyRate || 0));
      const otPayVal = Number(item.otPay || 0);
      const grossPayVal = Number(item.grossPay || basePayVal + otPayVal);
      const deductVal = Number(item.totalDeductions || 0);
      const netPayVal = Number(item.netPay || grossPayVal - deductVal);
      return `<tr>
        <td class="center">${idx + 1}</td>
        <td>
          <strong>${escapePrintHtml(item.workerName)}</strong><br/>
          <span style="font-size:9px;color:#475569;font-family:monospace;">${escapePrintHtml(item.workerId)} • ${escapePrintHtml(contact.email)}</span>
        </td>
        <td>${escapePrintHtml(item.position)}</td>
        <td class="num">₱${Number(item.dailyRate || 0).toLocaleString()}</td>
        <td class="center">${item.daysWorked ?? 0}</td>
        <td class="center">${item.otHours ?? 0}</td>
        <td class="num">₱${basePayVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
        <td class="num">₱${otPayVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
        <td class="num"><strong>₱${grossPayVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></td>
        <td class="num">-₱${deductVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
        <td class="num"><strong>₱${netPayVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></td>
        <td style="width:120px;"></td>
      </tr>`;
    }).join('');

    const bodyHtml = `<table class="ent-table">
      <thead>
        <tr>
          <th class="center">#</th>
          <th>Worker Name &amp; Email</th>
          <th>Trade / Position</th>
          <th class="num">Daily Rate</th>
          <th class="center">Days Worked</th>
          <th class="center">OT Hours</th>
          <th class="num">Base Pay</th>
          <th class="num">OT Pay</th>
          <th class="num">Gross Earnings</th>
          <th class="num">Deductions / Vale</th>
          <th class="num">Net Payout</th>
          <th class="center">Artisan Signature</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>`;

    openEnterprisePrintWindow({
      title: 'OFFICIAL FINALIZED PAYROLL REGISTER',
      subtitle: `Disbursed Weekly Wage Register • Reference: ${run.id}`,
      docRef: run.id,
      orientation: 'landscape',
      projectMeta: {
        name: run.projectName,
        location: activeProject?.location || 'LDM Project Site',
        period: `${run.periodStart} to ${run.periodEnd}`,
        client: run.clientName || 'LDM Construction Client',
      },
      kpiSummary: [
        { label: 'Total Workers', value: `${items.length} Artisans` },
        { label: 'Total Gross Payroll', value: `₱${totalGrossVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
        { label: 'Total Deductions / Vale', value: `-₱${totalDeductVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
        { label: 'Total Net Disbursed', value: `₱${totalNetVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
      ],
      bodyHtml,
      signatures: [
        { role: 'Prepared By: Timekeeper', name: 'Rodelio Cruz', title: 'Site Timekeeper' },
        { role: 'Audited By: Site Engineer', name: 'Engr. Ricardo Gomez', title: 'Project Manager / Site Engineer' },
        { role: 'Approved By: Finance Controller', name: run.approvedByName || 'Clarisse Mendoza', title: 'Finance Controller' },
      ],
    });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">

      {/* Toast Alert */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold backdrop-blur-md border animate-slideDown ${toastMessage.type === 'success'
            ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/50'
            : 'bg-red-950/90 text-red-200 border-red-500/50'
          }`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-emerald-400">
            <Banknote className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight">Weekly Site Payroll Engine</h1>
              <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-medium border ${!isFinance
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                }`}>
                {!isFinance ? 'AUDIT & READ-ONLY' : 'FINANCE & DISBURSAL'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated wage calculation from verified site attendance logs • Cash advance deductions • Direct payroll ledger
            </p>
          </div>
        </div>

        {/* View Toggle Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-lg text-xs font-medium self-start md:self-auto">
          <button
            onClick={() => { setActiveTab('calculator'); setSelectedRunDetail(null); }}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${activeTab === 'calculator' && !selectedRunDetail
                ? 'bg-amber-500 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-white'
              }`}
          >
            Weekly Wage Engine
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${activeTab === 'history'
                ? 'bg-amber-500 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-white'
              }`}
          >
            Payroll Archive ({pastRuns.length})
          </button>
        </div>
      </div>

      {/* Control Panel: Project & Cycle Selection */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">

          {/* Project Selector */}
          <div className="md:col-span-4">
            <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <HardHat className="w-3.5 h-3.5 text-amber-400" />
              <span>Project Construction Site</span>
            </label>
            <select
              value={String(selectedProjectId || effectiveProjects[0]?.id || '')}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setDraftCalculation(null);
                setSelectedRunDetail(null);
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              {effectiveProjects.map((p: any) => (
                <option key={String(p.id)} value={String(p.id)}>
                  {`${p.name || p.projectName || p.title || `Commercial Site #${p.id}`} (${p.id})`}
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
              onChange={(e) => {
                setPeriodStart(e.target.value);
                setHasManuallyChangedDates(true);
              }}
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
              onChange={(e) => {
                setPeriodEnd(e.target.value);
                setHasManuallyChangedDates(true);
              }}
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
                className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
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
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="text-[10px] text-slate-400 uppercase font-semibold font-mono tracking-wider">Active Labor Headcount</div>
            <div className="text-2xl font-bold font-mono text-white mt-1">
              {selectedRunDetail?.workerCount || draftCalculation?.workerCount} <span className="text-xs font-normal text-slate-400">workers</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Attendance Verified</span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="text-[10px] text-slate-400 uppercase font-semibold font-mono tracking-wider">Total Gross Wages</div>
            <div className="text-2xl font-bold font-mono text-white mt-1">
              ₱{(selectedRunDetail?.totalGross || draftCalculation?.totalGross || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Includes Base + Overtime</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="text-[10px] text-slate-400 uppercase font-semibold font-mono tracking-wider">Cash Advances / Vale</div>
            <div className="text-2xl font-bold font-mono text-white mt-1">
              -₱{(selectedRunDetail?.totalDeductions || draftCalculation?.totalDeductions || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Subtracted from gross pay</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="text-[10px] text-slate-400 uppercase font-semibold font-mono tracking-wider">Total Net Disbursal</div>
            <div className="text-2xl font-bold font-mono text-white mt-1">
              ₱{(selectedRunDetail?.totalNet || draftCalculation?.totalNet || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Final Take-Home Payout</div>
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
                      <td className="py-3 px-4 text-right font-mono">₱{Number(run.totalGross || 0).toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-mono text-rose-400">-₱{Number(run.totalDeductions || 0).toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">₱{Number(run.totalNet || 0).toLocaleString()}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          {run.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenFinalizedRun(run)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            View Sheet
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrintFinalizedRegister(run)}
                            className="p-1 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 rounded-lg transition-colors cursor-pointer"
                            title="Open Print-Ready Master Sheet & Payslips"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
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
        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xs overflow-hidden flex flex-col flex-1">

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

            {/* Action Buttons: Batch Payslips (Email & Print), Print Master Sheet, Finalize */}
            <div className="flex flex-wrap items-center gap-2">
              {displayItems.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsBatchPayslipsModalOpen(true)}
                    className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-bold rounded-lg border border-emerald-500/40 flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Open Batch Payslip Generator (Email E-Payslips & Print Site Claim Stubs)"
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Batch Payslips (Email &amp; Print)</span>
                  </button>

                  <button
                    onClick={() => handlePrint('summary')}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Print Clean Master Payroll Sheet"
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-400" />
                    <span>Print Master Sheet</span>
                  </button>
                </>
              )}

              {/* Finalize Button (Only for Finance, shown only for unfinalized draft) */}
              {!selectedRunDetail && draftCalculation && isFinance && (
                <button
                  onClick={handleFinalizePayroll}
                  disabled={isFinalizing || draftCalculation.workerCount === 0}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg shadow-xs flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Lock className="w-3.5 h-3.5" />
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
                  <th className="py-3 px-4 text-center">Payslip &amp; Actions</th>
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
                    const workerContact = resolveWorkerContact(item);
                    return (
                      <tr key={item.workerId} className="hover:bg-slate-800/40 transition-colors">

                        {/* Worker Name, ID, Email & Payout Channel Badge */}
                        <td className="py-3 px-4 font-semibold text-white">
                          <div>{item.workerName}</div>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                            <span>{item.workerId}</span>
                            <span>•</span>
                            <span>{workerContact.phone}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className="text-[10px] font-mono text-cyan-400 flex items-center gap-1">
                              <Mail className="w-2.5 h-2.5 shrink-0" />
                              {workerContact.email}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${workerContact.payoutChannel === '📧 Email / GCash'
                                  ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                }`}
                            >
                              {workerContact.payoutChannel}
                            </span>
                          </div>
                        </td>

                        {/* Position */}
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                            {item.position}
                          </span>
                        </td>

                        {/* Daily Rate */}
                        <td className="py-3 px-4 text-right font-mono text-slate-300">
                          ₱{Number(item.dailyRate || 0).toLocaleString()}
                        </td>

                        {/* Days Worked */}
                        <td className="py-3 px-4 text-center font-mono">
                          <span className="font-bold text-white">{item.daysWorked ?? 0}</span>
                          <span className="text-[10px] text-slate-400 ml-1">days</span>
                        </td>

                        {/* OT Hours */}
                        <td className="py-3 px-4 text-center font-mono">
                          {Number(item.otHours || 0) > 0 ? (
                            <span className="text-blue-400 font-bold">{item.otHours} hrs</span>
                          ) : (
                            <span className="text-slate-400 font-mono">0</span>
                          )}
                        </td>

                        {/* Base Pay */}
                        <td className="py-3 px-4 text-right font-mono text-slate-300">
                          ₱{Number(item.basePay ?? (Number(item.daysWorked || 0) * Number(item.dailyRate || 0))).toLocaleString()}
                        </td>

                        {/* OT Pay */}
                        <td className="py-3 px-4 text-right font-mono text-blue-300">
                          {Number(item.otPay || 0) > 0 ? `₱${Number(item.otPay || 0).toLocaleString()}` : '₱0'}
                        </td>

                        {/* Gross Pay */}
                        <td className="py-3 px-4 text-right font-mono font-semibold text-white">
                          ₱{Number(item.grossPay || 0).toLocaleString()}
                        </td>

                        {/* Vale / Deductions */}
                        <td className="py-3 px-4 text-right font-mono">
                          {hasDeductions ? (
                            <span className="text-rose-400 font-bold">-₱{Number(item.totalDeductions || 0).toLocaleString()}</span>
                          ) : (
                            <span className="text-slate-400 font-mono">₱0</span>
                          )}
                        </td>

                        {/* Net Pay */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400 text-sm">
                          ₱{Number(item.netPay || 0).toLocaleString()}
                        </td>

                        {/* Actions: View / Print Slip, Email Payslip, + Vale */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPayslipItem(item);
                                setIsEditingModalEmail(false);
                                setModalEmailDraft(workerContact.email);
                              }}
                              className="px-2.5 py-1 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 rounded-lg text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                              title="Open Official Individual Employee Payslip & Site Claim Stub"
                            >
                              <span>📄 View / Print Slip</span>
                            </button>

                            {(() => {
                              const cycleKey = `${selectedRunDetail?.periodStart || periodStart}_${selectedRunDetail?.periodEnd || periodEnd}_${item.workerId}`;
                              const sentAt = dispatchedPayslips[cycleKey];
                              return (
                                <button
                                  type="button"
                                  onClick={() => markPayslipDispatched(item)}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1 border ${sentAt
                                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                                    }`}
                                  title={
                                    sentAt
                                      ? `Recipient: ${workerContact.email} • Channel: ${workerContact.payoutChannel} • Delivered at ${sentAt}`
                                      : `Send itemized E-Payslip to ${workerContact.email} (${workerContact.payoutChannel})`
                                  }
                                >
                                  <span>
                                    {sentAt
                                      ? `✅ Emailed to ${workerContact.email} & Queued Site Claim Stub (${sentAt})`
                                      : '📧 Email Payslip'}
                                  </span>
                                </button>
                              );
                            })()}

                            {!selectedRunDetail && isFinance && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedWorkerForVale({ id: item.workerId, name: item.workerName });
                                  setIsValeModalOpen(true);
                                }}
                                className="px-2 py-1 bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 border border-rose-800/40 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer"
                                title="Attach Cash Advance (Vale) deduction"
                              >
                                + Vale
                              </button>
                            )}
                          </div>
                        </td>
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

      {/* MODAL: Official Individual Employee Payslip Generator */}
      {selectedPayslipItem && (() => {
        const pStart = selectedRunDetail?.periodStart || periodStart;
        const pEnd = selectedRunDetail?.periodEnd || periodEnd;
        const siteName = activeProject?.name || selectedRunDetail?.projectName || 'LDM Construction Project Site';
        const refId = `PS-${String(selectedProjectId || 'SITE').slice(-4).toUpperCase()}-${selectedPayslipItem.workerId}-${pEnd.replace(/-/g, '')}`;
        const regHours = Number((Number(selectedPayslipItem.daysWorked || 0) * 8).toFixed(2));
        const hourlyRate = Number((Number(selectedPayslipItem.dailyRate || 0) / 8).toFixed(2));
        const otRate = Number((selectedPayslipItem.hourlyOtRate || hourlyRate * 1.25).toFixed(2));
        const basePayVal = Number(selectedPayslipItem.basePay ?? Number(selectedPayslipItem.daysWorked || 0) * Number(selectedPayslipItem.dailyRate || 0));
        const otPayVal = Number(selectedPayslipItem.otPay || 0);
        const grossPayVal = Number(selectedPayslipItem.grossPay || basePayVal + otPayVal);
        const deductVal = Number(selectedPayslipItem.totalDeductions || 0);
        const netPayVal = Number(selectedPayslipItem.netPay || grossPayVal - deductVal);
        const cycleKey = `${pStart}_${pEnd}_${selectedPayslipItem.workerId}`;
        const dispatchedAt = dispatchedPayslips[cycleKey];
        const modalContact = resolveWorkerContact(selectedPayslipItem);

        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl animate-scaleUp">
              {/* Company Header */}
              <div className="bg-slate-950 border-b border-slate-800 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-bold uppercase">
                      OFFICIAL EMPLOYEE PAYSLIP
                    </span>
                    <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono font-bold">
                      {modalContact.payoutChannel}
                    </span>
                    {dispatchedAt && (
                      <span
                        className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-bold"
                        title={`Recipient: ${modalContact.email} • Delivered at ${dispatchedAt}`}
                      >
                        ✅ Emailed to {modalContact.email} &amp; Queued Site Claim Stub ({dispatchedAt})
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-black text-white tracking-tight mt-1">
                    LDM Construction &mdash; Engineers &bull; Architects &bull; Builders
                  </h3>
                  <p className="text-xs text-slate-400">
                    Pay Period: <span className="font-mono text-slate-200 font-semibold">{pStart} to {pEnd}</span>
                  </p>
                </div>
                <div className="text-left sm:text-right font-mono text-xs space-y-1">
                  <div className="text-cyan-400 font-bold">REF: {refId}</div>
                  <div className="text-[11px] text-slate-400">Issued: {new Date().toLocaleDateString()}</div>
                  <button
                    type="button"
                    onClick={() => setSelectedPayslipItem(null)}
                    className="text-slate-400 hover:text-white text-xs font-sans underline cursor-pointer"
                  >
                    Close [X]
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4 text-xs">
                {/* Worker Metadata + Inline Editable Recipient Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950 border border-slate-800 rounded-xl p-4">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-400 block">Worker Name &amp; ID</span>
                    <span className="text-sm font-bold text-white">{selectedPayslipItem.workerName}</span>
                    <span className="text-xs font-mono text-cyan-400 ml-2">({selectedPayslipItem.workerId})</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-400 block">Trade Role / Position</span>
                    <span className="text-sm font-bold text-amber-300">{selectedPayslipItem.position}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-400 block">Recipient Email (E-Payslip Target)</span>
                    {!isEditingModalEmail ? (
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-mono font-bold text-cyan-300">{modalContact.email}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setModalEmailDraft(modalContact.email);
                            setIsEditingModalEmail(true);
                          }}
                          className="text-[10px] text-slate-400 hover:text-white underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" /> Edit
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 mt-1">
                        <input
                          type="email"
                          value={modalEmailDraft}
                          onChange={(e) => setModalEmailDraft(e.target.value)}
                          className="bg-slate-900 border border-cyan-500/60 rounded px-2 py-1 text-xs font-mono text-white w-48 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveWorkerEmailOverride(selectedPayslipItem.workerId, modalEmailDraft)}
                          className="px-2 py-1 rounded bg-cyan-500 text-slate-950 font-bold text-[10px] cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-400 block">Mobile Contact &amp; Assigned Site</span>
                    <span className="text-xs font-mono text-slate-200">{modalContact.phone}</span>
                    <span className="text-xs font-semibold text-emerald-300 block">{siteName}</span>
                  </div>
                </div>

                {/* Earnings & Deductions Breakdown */}
                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3.5">Earnings / Adjustment Item</th>
                        <th className="py-2.5 px-3.5 text-center">Hours / Days</th>
                        <th className="py-2.5 px-3.5 text-right">Rate (₱)</th>
                        <th className="py-2.5 px-3.5 text-right">Amount (₱)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 bg-slate-900/50">
                      <tr>
                        <td className="py-2.5 px-3.5 font-semibold text-white">Regular Basic Wage (Standard 8h Shift)</td>
                        <td className="py-2.5 px-3.5 text-center font-mono text-slate-300">
                          {selectedPayslipItem.daysWorked ?? 0} days ({regHours} hrs)
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono text-slate-300">
                          ₱{Number(selectedPayslipItem.dailyRate || 0).toLocaleString()}/day (₱{hourlyRate}/hr)
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono font-bold text-white">
                          ₱{basePayVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3.5 font-semibold text-blue-300">Approved Overtime Pay (1.25x Rate)</td>
                        <td className="py-2.5 px-3.5 text-center font-mono text-blue-300">
                          {selectedPayslipItem.otHours ?? 0} hrs
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono text-blue-300">
                          ₱{otRate}/hr
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono font-bold text-blue-300">
                          ₱{otPayVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                      <tr className="bg-slate-950/90 font-bold">
                        <td colSpan={3} className="py-2.5 px-3.5 text-slate-200 uppercase font-mono text-[11px]">
                          Gross Pay
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono text-white text-sm">
                          ₱{grossPayVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={3} className="py-2.5 px-3.5 text-rose-300">
                          Deductions / Adjustments (Cash Advances / Vale &amp; Undertime)
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono font-bold text-rose-400">
                          -₱{deductVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Net Take-Home Pay Banner */}
                <div className="bg-emerald-950/40 border-2 border-emerald-500/50 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-300 font-bold">
                      VERIFIED NET TAKE-HOME PAY
                    </div>
                    <div className="text-xs text-slate-300 mt-0.5">
                      Authorized for direct weekly wage disbursal ({modalContact.payoutChannel})
                    </div>
                  </div>
                  <div className="text-2xl font-black font-mono text-emerald-400">
                    ₱{netPayVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>

                {/* Physical Site Release: Worker Acknowledgement & Signature Stub */}
                <div className="border-t-2 border-dashed border-slate-700 pt-3.5 mt-2 bg-slate-950/70 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase font-bold text-amber-300">
                      ✂️ WORKER ACKNOWLEDGEMENT &amp; PHYSICAL SITE CLAIM STUB ({refId})
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Release via Site Timekeeper / Foreman
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    I hereby acknowledge receipt of my verified net wage of{' '}
                    <span className="font-mono font-bold text-emerald-400">
                      ₱{netPayVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>{' '}
                    for the period <span className="font-mono">{pStart}</span> to <span className="font-mono">{pEnd}</span>.
                  </p>
                  <div className="grid grid-cols-2 gap-6 pt-3 text-center text-[10px] font-mono text-slate-400">
                    <div className="border-t border-slate-700 pt-1">
                      <div className="text-white font-bold">Clarisse Mendoza / Site Timekeeper</div>
                      <div>Authorized Disbursing Officer</div>
                    </div>
                    <div className="border-t border-slate-700 pt-1">
                      <div className="text-white font-bold">{selectedPayslipItem.workerName}</div>
                      <div>Worker Signature &amp; Date Claimed</div>
                    </div>
                  </div>
                </div>

                {/* Modal Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-800">
                  <a
                    href={buildPayslipMailtoUrl(selectedPayslipItem)}
                    onClick={() => markPayslipDispatched(selectedPayslipItem)}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                    title={`Open pre-filled email draft to ${modalContact.email}`}
                  >
                    <Mail className="w-4 h-4 text-cyan-400" />
                    <span>Open Email Client Draft (mailto:)</span>
                  </a>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handlePrintSinglePayslip(selectedPayslipItem)}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Printer className="w-4 h-4 text-amber-400" />
                      <span>🖨️ Print / Save PDF Slip</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => markPayslipDispatched(selectedPayslipItem)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-lg shadow-emerald-600/20"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>
                        {dispatchedAt
                          ? `✅ Emailed to ${modalContact.email} & Queued Site Claim Stub (${dispatchedAt})`
                          : `📧 Email Payslip to ${modalContact.email}`}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: Batch Generate All Payslips */}
      {isBatchPayslipsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-400" />
                  Batch Payslip Generator ({displayItems.length} Active Workers)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Cycle: {selectedRunDetail?.periodStart || periodStart} to {selectedRunDetail?.periodEnd || periodEnd} • {activeProject?.name || 'LDM Project Site'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchPayslipsModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Delivery Channel Mode Selector */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
                SELECT PAYSLIP DELIVERY CHANNEL MODE (NO WORKER PORTAL LOGIN REQUIRED)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {[
                  {
                    id: 'EMAIL_ONLY' as const,
                    label: '📧 Send E-Payslips via Email',
                    sub: 'All Workers with Email',
                  },
                  {
                    id: 'PRINT_ONLY' as const,
                    label: '🖨️ Print Physical Site Claim Stubs',
                    sub: 'Released via Site Timekeeper / Foreman',
                  },
                  {
                    id: 'BOTH_EMAIL_AND_PRINT' as const,
                    label: '📧 + 🖨️ Both Channels',
                    sub: 'Email E-Payslips & Print Site Claim Sheet',
                  },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setBatchDeliveryMode(opt.id)}
                    className={`text-left p-2.5 rounded-lg border transition-colors cursor-pointer ${batchDeliveryMode === opt.id
                        ? 'bg-cyan-500/15 border-cyan-500 text-white'
                        : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                  >
                    <div className="text-xs font-bold">{opt.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{opt.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {displayItems.map((item) => {
                const cycleKey = `${selectedRunDetail?.periodStart || periodStart}_${selectedRunDetail?.periodEnd || periodEnd}_${item.workerId}`;
                const sentAt = dispatchedPayslips[cycleKey];
                const contact = resolveWorkerContact(item);
                return (
                  <div
                    key={item.workerId}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-white">{item.workerName}</span>
                        <span className="text-slate-400 font-mono text-[11px]">({item.position})</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${contact.payoutChannel === '📧 Email / GCash'
                              ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                              : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                            }`}
                        >
                          {contact.payoutChannel}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 flex flex-wrap items-center gap-2">
                        <span>
                          {item.daysWorked ?? 0} days • OT: {item.otHours ?? 0}h • Net:{' '}
                          <strong className="text-emerald-400">₱{Number(item.netPay || 0).toLocaleString()}</strong>
                        </span>
                        <span>•</span>
                        <span className="text-cyan-300">Recipient: {contact.email}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setIsBatchPayslipsModalOpen(false);
                          setSelectedPayslipItem(item);
                          setIsEditingModalEmail(false);
                          setModalEmailDraft(contact.email);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-[11px] font-semibold cursor-pointer"
                      >
                        📄 View / Print Slip
                      </button>
                      <span
                        className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold border ${sentAt
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          }`}
                        title={`Recipient: ${contact.email} • Channel: ${contact.payoutChannel}`}
                      >
                        {sentAt ? `✅ Emailed to ${contact.email} & Queued Site Claim Stub (${sentAt})` : 'Ready to Email'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsBatchPayslipsModalOpen(false);
                  handlePrint('payslips');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-amber-400" />
                <span>🖨️ Print Physical Site Claim Stubs</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  markAllPayslipsDispatched(displayItems, batchDeliveryMode);
                  setIsBatchPayslipsModalOpen(false);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-600/20"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {batchDeliveryMode === 'PRINT_ONLY'
                    ? `🖨️ Generate & Print ${displayItems.length} Site Claim Stubs`
                    : batchDeliveryMode === 'EMAIL_ONLY'
                      ? `📧 Email All ${displayItems.length} Worker E-Payslips`
                      : `✅ Email ${displayItems.length} E-Payslips & Generate Site Claim Stubs`}
                </span>
              </button>
            </div>
          </div>
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
                <div className="text-slate-400 font-mono text-[10px]">{selectedWorkerForVale.id}</div>
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
        <style dangerouslySetInnerHTML={{
          __html: `
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
                  <h1 className="text-xl font-black uppercase tracking-wider">LDM CONSTRUCTION</h1>
                  <div className="text-[10px] font-bold text-slate-700 uppercase">ENGINEERS &bull; ARCHITECTS &bull; BUILDERS | ldmengineeringdesign@gmail.com &bull; (+63) 945 681 0515</div>
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
                      <td className="p-1 border border-black text-right">₱{Number(item.dailyRate || 0).toLocaleString()}</td>
                      <td className="p-1 border border-black text-center">{item.daysWorked ?? 0}</td>
                      <td className="p-1 border border-black text-center">{item.otHours ?? 0}</td>
                      <td className="p-1 border border-black text-right">₱{Number(item.grossPay || 0).toLocaleString()}</td>
                      <td className="p-1 border border-black text-right text-red-700">₱{Number(item.totalDeductions || 0).toLocaleString()}</td>
                      <td className="p-1 border border-black text-right font-black">₱{Number(item.netPay || 0).toLocaleString()}</td>
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
                <div className="font-bold uppercase text-sm">Individual Worker Payout Slips &mdash; LDM Construction</div>
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
                      <span>₱{Number(item.dailyRate || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Days Worked:</span>
                      <span>{item.daysWorked ?? 0} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Overtime ({item.otHours ?? 0} hrs):</span>
                      <span>₱{Number(item.otPay || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Gross Pay:</span>
                      <span>₱{Number(item.grossPay || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-red-700">
                      <span>Vale Deductions:</span>
                      <span>-₱{Number(item.totalDeductions || 0).toLocaleString()}</span>
                    </div>
                    <div className="border-t border-black pt-1 flex justify-between font-black text-sm">
                      <span>NET TAKE-HOME:</span>
                      <span>₱{Number(item.netPay || 0).toLocaleString()}</span>
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

      {/* FINALIZED PAYROLL REGISTER IN-PAGE MODAL */}
      {viewingFinalizedRun && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className={`${isDark ? 'bg-slate-900 border-slate-700/80 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-2xl'} border rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150`}>
            {/* Modal Header */}
            <div className={`p-4 sm:p-5 border-b ${isDark ? 'border-slate-800 bg-slate-950/80' : 'border-slate-200 bg-slate-50'} flex items-center justify-between gap-3 shrink-0`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="text-[10px] font-mono text-emerald-500 font-bold uppercase tracking-wider">
                    LOCKED &amp; ARCHIVED PAYROLL RUN
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30">
                    {viewingFinalizedRun.id}
                  </span>
                </div>
                <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'} mt-1`}>
                  {viewingFinalizedRun.projectName} &bull; Official Payroll Register
                </h3>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mt-0.5`}>
                  Disbursal Cycle: <span className={`${isDark ? 'text-slate-200' : 'text-slate-700'} font-mono`}>{viewingFinalizedRun.periodStart}</span> to{' '}
                  <span className={`${isDark ? 'text-slate-200' : 'text-slate-700'} font-mono`}>{viewingFinalizedRun.periodEnd}</span> &bull; Approved by:{' '}
                  <span className="text-emerald-500 font-semibold">{viewingFinalizedRun.approvedByName || 'Clarisse Mendoza (Finance Controller)'}</span>
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handlePrintFinalizedRegister(viewingFinalizedRun)}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>🖨️ Print Official Payroll Register</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingFinalizedRun(null)}
                  className={`p-1.5 ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'} rounded-lg transition cursor-pointer`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Summary Strip */}
            <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 border-b ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50/60'} shrink-0 text-xs font-mono`}>
              <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'} border p-2.5 rounded-xl`}>
                <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase block font-semibold`}>Total Workers</span>
                <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'} mt-0.5 block`}>{viewingFinalizedRun.workerCount || viewingFinalizedRun.items?.length || 0} Artisans</span>
              </div>
              <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'} border p-2.5 rounded-xl`}>
                <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase block font-semibold`}>Total Gross Wages</span>
                <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'} mt-0.5 block`}>₱{Number(viewingFinalizedRun.totalGross || 0).toLocaleString()}</span>
              </div>
              <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'} border p-2.5 rounded-xl`}>
                <span className="text-[10px] text-rose-500 uppercase block font-semibold">Vale / Deductions</span>
                <span className="text-sm font-bold text-rose-500 mt-0.5 block">-₱{Number(viewingFinalizedRun.totalDeductions || 0).toLocaleString()}</span>
              </div>
              <div className={`${isDark ? 'bg-slate-900 border-emerald-500/30' : 'bg-emerald-50/50 border-emerald-300'} border p-2.5 rounded-xl`}>
                <span className="text-[10px] text-emerald-500 uppercase block font-semibold">Net Payout Disbursed</span>
                <span className="text-sm font-black text-emerald-500 mt-0.5 block">₱{Number(viewingFinalizedRun.totalNet || 0).toLocaleString()}</span>
              </div>
            </div>

            {/* Itemized Worker Table */}
            <div className="overflow-y-auto p-4 flex-1">
              <div className={`border ${isDark ? 'border-slate-800' : 'border-slate-200'} rounded-xl overflow-hidden`}>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className={`${isDark ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200'} font-mono text-[10px] uppercase border-b`}>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Worker Name &amp; Role</th>
                      <th className="py-2.5 px-3 text-right">Daily Rate</th>
                      <th className="py-2.5 px-3 text-center">Days</th>
                      <th className="py-2.5 px-3 text-center">OT Hrs</th>
                      <th className="py-2.5 px-3 text-right">Gross Pay</th>
                      <th className="py-2.5 px-3 text-right">Deductions</th>
                      <th className="py-2.5 px-3 text-right font-bold text-emerald-500">Net Pay</th>
                      <th className="py-2.5 px-3 text-center">Payout Channel</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-200'} font-sans`}>
                    {(viewingFinalizedRun.items || []).map((item, idx) => {
                      const contact = resolveWorkerContact(item);
                      const base = Number(item.basePay ?? Number(item.daysWorked || 0) * Number(item.dailyRate || 0));
                      const ot = Number(item.otPay || 0);
                      const gross = Number(item.grossPay || base + ot);
                      const deduct = Number(item.totalDeductions || 0);
                      const net = Number(item.netPay || gross - deduct);
                      return (
                        <tr key={item.workerId || idx} className={`${isDark ? 'hover:bg-slate-800/40 text-slate-300' : 'hover:bg-slate-50 text-slate-700'} transition-colors`}>
                          <td className={`py-2.5 px-3 font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{idx + 1}</td>
                          <td className="py-2.5 px-3">
                            <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'} block`}>{item.workerName}</span>
                            <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'} block font-mono`}>{item.position}</span>
                          </td>
                          <td className={`py-2.5 px-3 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>₱{Number(item.dailyRate || 0).toLocaleString()}</td>
                          <td className={`py-2.5 px-3 text-center font-mono ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{item.daysWorked ?? 0}</td>
                          <td className="py-2.5 px-3 text-center font-mono text-amber-500 font-semibold">{item.otHours ?? 0}</td>
                          <td className={`py-2.5 px-3 text-right font-mono ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>₱{gross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-rose-500">-₱{deduct.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-500">₱{net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200'} border`}>
                              {contact.payoutChannel}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className={`p-4 border-t ${isDark ? 'border-slate-800 bg-slate-950/80 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'} flex items-center justify-between gap-3 shrink-0`}>
              <span className="text-xs font-mono">
                Immutable audit record archived in LDM Construction Finance Ledger.
              </span>
              <button
                type="button"
                onClick={() => setViewingFinalizedRun(null)}
                className={`px-4 py-2 ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'} text-xs font-semibold rounded-xl transition cursor-pointer`}
              >
                Close Register
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
