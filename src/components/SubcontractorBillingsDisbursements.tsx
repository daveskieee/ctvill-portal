/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SubcontractorBillingsDisbursements.tsx
 * Finance-only Accounts Payable (AP) ledger for subcontractor trade crew invoices.
 * Separate from client AR (Progress Billings & Receipts).
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Receipt, Plus, Search, Filter, RefreshCw, CheckCircle2, Clock, AlertTriangle,
  CreditCard, Building2, HardHat, Users, DollarSign, FileText, ChevronDown,
  ChevronUp, X, Check, Eye, Send, Banknote, ShieldCheck, ExternalLink,
  Download, TrendingDown, ArrowUpRight, Calendar, Hash, Info, Loader2,
  ShieldAlert
} from 'lucide-react';
import { SubcontractorPayable, SubcontractorPayableStatus, DailyManpowerAudit, Contractor, ProjectProfile } from '../types';
import { isTradeGroupOrOutsourcedContractor } from '../types';

interface SubcontractorBillingsDisbursementsProps {
  manpowerAudits?: DailyManpowerAudit[];
  contractors?: Contractor[];
  projects?: ProjectProfile[];
  session?: any;
  onNotify?: (msg: string) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<SubcontractorPayableStatus, { label: string; color: string; icon: React.ElementType }> = {
  PENDING_AUDIT:  { label: 'Pending Audit Verification',    color: 'bg-amber-500/15 text-amber-300 border-amber-500/30',   icon: Clock },
  APPROVED:       { label: 'Approved',          color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', icon: CheckCircle2 },
  PAID:           { label: 'Paid / Disbursed',  color: 'bg-sky-500/15 text-sky-300 border-sky-500/30',         icon: CreditCard },
  DISPUTED:       { label: 'Disputed',          color: 'bg-rose-500/15 text-rose-300 border-rose-500/30',      icon: AlertTriangle },
};

const fmt = (n: number) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatDisbursementDate = (dateStr?: string | null) => {
  if (!dateStr) return 'Pending Release';
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? 'Pending Release' : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const fmtDate = formatDisbursementDate;

const EMPTY_FORM = {
  payeeContractorName: '',
  tradeSpecialty: '',
  projectSite: '',
  auditId: '',
  verifiedHeadcount: '',
  claimedHeadcount: '',
  billedDays: '',
  ratePerDay: '',
  billedAmount: '',
  paymentMethod: 'Bank Wire',
  referenceNo: '',
  status: 'PENDING_AUDIT' as SubcontractorPayableStatus,
  remarks: '',
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SubcontractorBillingsDisbursements({
  manpowerAudits = [],
  contractors = [],
  projects = [],
  session,
  onNotify,
}: SubcontractorBillingsDisbursementsProps) {
  const notify = (msg: string) => onNotify?.(msg);

  // ── State ──
  const [records, setRecords] = useState<SubcontractorPayable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | SubcontractorPayableStatus>('ALL');
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<'date' | 'amount' | 'status'>('date');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [disburseTarget, setDisburseTarget] = useState<SubcontractorPayable | null>(null);
  const [disburseRef, setDisburseRef] = useState('');
  const [disbursing, setDisbursing] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

// Default seed billing records linked to certified audits
const SEED_PAYABLES: SubcontractorPayable[] = [
  {
    id: 'SPY-001',
    disbursementDate: '2026-09-26T08:00:00.000Z',
    payeeContractorId: 'CONT-1789598922028',
    payeeContractorName: 'Brent',
    tradeSpecialty: 'Concrete Pouring & Structural Works',
    projectSite: 'NexBridge Software Hub',
    auditId: 'AUD-1790357393677',
    verifiedHeadcount: 15,
    claimedHeadcount: 15,
    billedDays: 3,
    ratePerDay: 1000,
    billedAmount: 45000,
    paymentMethod: 'Bank Wire',
    status: 'PENDING_AUDIT',
    remarks: '15 Men Verified on-site for NexBridge Concrete Pouring shift. Gate muster 100% matched, pending fund release.',
    createdBy: 'Finance Department',
    createdAt: '2026-09-25T18:00:00.000Z'
  },
  {
    id: 'SPY-002',
    disbursementDate: '2026-09-20T08:00:00.000Z',
    payeeContractorId: 'CONT-1789599140157',
    payeeContractorName: 'Paul',
    tradeSpecialty: 'Skilled Trade Crews (Electricians, Carpenters, Painters, Masons)',
    projectSite: 'NexBridge Software Hub',
    auditId: 'AUD-67542',
    verifiedHeadcount: 10,
    claimedHeadcount: 10,
    billedDays: 2,
    ratePerDay: 1400,
    billedAmount: 28000,
    approvedAmount: 28000,
    paymentMethod: 'Check',
    referenceNo: 'CHK-2026-0981',
    status: 'APPROVED',
    remarks: 'Quadrant B electrical rough-ins and conduit works verified with GPS photo proof. Approved for payout.',
    createdBy: 'Finance Department',
    createdAt: '2026-09-17T09:30:00.000Z'
  },
  {
    id: 'SPY-003',
    disbursementDate: '2026-09-18T08:00:00.000Z',
    payeeContractorId: 'CONT-1789599064683',
    payeeContractorName: 'Lizter',
    tradeSpecialty: 'Site Foremen & General Labor Muster',
    projectSite: 'NexBridge Software Hub',
    auditId: 'AUD-08944',
    verifiedHeadcount: 50,
    claimedHeadcount: 50,
    billedDays: 2.5,
    ratePerDay: 1000,
    billedAmount: 125000,
    approvedAmount: 125000,
    disbursedAmount: 125000,
    paymentMethod: 'Bank Wire',
    referenceNo: 'BW-889123-BDO',
    status: 'PAID',
    remarks: 'Full 50-man field supervision gang verified across all NexBridge levels. Disbursed via BDO wire.',
    createdBy: 'Finance Department',
    createdAt: '2026-09-17T14:15:00.000Z'
  }
];

  // Sub-contractors from live contractor list and active trade crews / audited crews
  const tradeContractors = useMemo(() => {
    const list = contractors.filter(c => isTradeGroupOrOutsourcedContractor(c));
    const seenNames = new Set(list.map(c => c.name.toLowerCase()));

    // Include contractors matching active trade specialties
    contractors.forEach(c => {
      const spec = (c.specialty || c.roleTitle || '').toLowerCase();
      const isTrade = spec.includes('crew') || spec.includes('forem') || spec.includes('trade') || spec.includes('carpenter') || spec.includes('electrician') || spec.includes('mason') || spec.includes('plumb') || spec.includes('hvac') || spec.includes('welder') || spec.includes('technician') || spec.includes('engineer') || c.employmentType === 'OUTSOURCED';
      if (isTrade && !seenNames.has(c.name.toLowerCase())) {
        list.push(c);
        seenNames.add(c.name.toLowerCase());
      }
    });

    // Also include any crews directly recorded in manpowerAudits (e.g. Brent, Paul, Lizter)
    manpowerAudits.forEach(a => {
      if (a.contractorName && !seenNames.has(a.contractorName.toLowerCase())) {
        list.push({
          id: a.contractorId || `AUD-CONT-${a.id}`,
          name: a.contractorName,
          specialty: a.specialty || 'Trade Contractor',
          employmentType: 'OUTSOURCED',
          activeManpower: a.verifiedHeadcount || a.claimedHeadcount || 1,
        } as any);
        seenNames.add(a.contractorName.toLowerCase());
      }
    });

    return list;
  }, [contractors, manpowerAudits]);

  const projectNames = useMemo(
    () => Array.from(new Set([
      ...projects.map(p => p.name),
      ...records.map(r => r.projectSite),
      ...manpowerAudits.map(a => a.assignedSectorOrLot),
      'NexBridge Software Hub',
      '2-Storey Residential House',
      'BGComm 1200sqm BPO Center'
    ])).filter(Boolean),
    [projects, records, manpowerAudits]
  );

  // ── Data fetch ──
  const fetchRecords = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const res = await fetch('/api/subcontractor-payables');
      if (res.ok) {
        const data: SubcontractorPayable[] = await res.json();
        setRecords(data && data.length > 0 ? data : SEED_PAYABLES);
      } else {
        setRecords(prev => prev.length > 0 ? prev : SEED_PAYABLES);
      }
    } catch (err) {
      console.warn('Failed to fetch subcontractor payables:', err);
      setRecords(prev => prev.length > 0 ? prev : SEED_PAYABLES);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMsg) {
      const t = setTimeout(() => setToastMsg(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toastMsg]);

  // ── Derived KPIs ──
  const kpis = useMemo(() => {
    const totalBilled   = records.reduce((s, r) => s + r.billedAmount, 0);
    const approved      = records.filter(r => r.status === 'APPROVED' || r.status === 'PAID').reduce((s, r) => s + (r.approvedAmount ?? r.billedAmount), 0);
    const pending       = records.filter(r => r.status === 'PENDING_AUDIT' || (r.status as string) === 'Pending Audit').reduce((s, r) => s + r.billedAmount, 0);
    const disbursed     = records.filter(r => r.status === 'PAID' || (r.status as string) === 'Paid / Disbursed').reduce((s, r) => s + (r.disbursedAmount ?? r.approvedAmount ?? r.billedAmount), 0);
    const disputed      = records.filter(r => r.status === 'DISPUTED' || (r.status as string) === 'Disputed').length;
    return { totalBilled, approved, pending, disbursed, disputed };
  }, [records]);

  // ── Filtered / sorted records ──
  const filtered = useMemo(() => {
    let out = [...records];
    if (statusFilter !== 'ALL') out = out.filter(r => r.status === statusFilter);
    if (projectFilter !== 'ALL') out = out.filter(r => r.projectSite === projectFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      out = out.filter(r =>
        r.payeeContractorName.toLowerCase().includes(q) ||
        r.tradeSpecialty.toLowerCase().includes(q) ||
        r.projectSite.toLowerCase().includes(q) ||
        (r.referenceNo || '').toLowerCase().includes(q)
      );
    }
    out.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'amount') cmp = a.billedAmount - b.billedAmount;
      else if (sortField === 'status') cmp = a.status.localeCompare(b.status);
      else cmp = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return out;
  }, [records, statusFilter, projectFilter, searchQuery, sortField, sortDir]);

  // ── Form helpers ──
  const autoCalcBilled = (f: typeof EMPTY_FORM) => {
    const days = Number(f.billedDays) || 0;
    const rate = Number(f.ratePerDay) || 0;
    if (days && rate) return String(days * rate);
    return f.billedAmount;
  };

  const handleFormChange = (field: keyof typeof EMPTY_FORM, value: string) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'billedDays' || field === 'ratePerDay') {
        next.billedAmount = autoCalcBilled(next);
      }
      return next;
    });
  };

  const handleContractorSelect = (name: string) => {
    const c = tradeContractors.find(tc => tc.name === name);
    setForm(prev => ({
      ...prev,
      payeeContractorName: name,
      tradeSpecialty: c?.specialty || c?.tradeType || prev.tradeSpecialty,
      ratePerDay: c?.dailyRate ? String(c.dailyRate) : prev.ratePerDay,
    }));
  };

  // Link to audit data
  const handleAuditSelect = (auditId: string) => {
    if (!auditId) {
      setForm(prev => ({
        ...prev,
        auditId: '',
        status: 'PENDING_AUDIT',
      }));
      return;
    }
    const audit = manpowerAudits.find(a => a.id === auditId);
    if (audit) {
      const rate = 1000;
      const days = Number(form.billedDays) || 1;
      const hc = audit.verifiedHeadcount || 1;
      setForm(prev => ({
        ...prev,
        auditId,
        verifiedHeadcount: String(audit.verifiedHeadcount),
        claimedHeadcount: String(audit.claimedHeadcount),
        payeeContractorName: audit.contractorName || prev.payeeContractorName,
        tradeSpecialty: audit.specialty || prev.tradeSpecialty,
        projectSite: audit.assignedSectorOrLot || prev.projectSite,
        ratePerDay: prev.ratePerDay || String(rate),
        billedDays: String(days),
        billedAmount: prev.billedAmount || String(rate * days * hc),
        remarks: `${audit.verifiedHeadcount} / ${audit.claimedHeadcount} Men Verified on-site for ${audit.assignedSectorOrLot || 'site'} via Audit ${audit.id}.`,
      }));
    }
  };

  // ── Create record ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.payeeContractorName || !form.projectSite) {
      setToastMsg({ text: 'Payee and Project Site are required.', type: 'error' });
      return;
    }
    if (!form.auditId && !form.remarks.trim()) {
      setToastMsg({ text: 'Audit Notes / Justification is required for unverified manual field payouts.', type: 'error' });
      return;
    }
    setIsSaving(true);
    const finalStatus = !form.auditId ? 'PENDING_AUDIT' : form.status;
    try {
      const res = await fetch('/api/subcontractor-payables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payeeContractorName: form.payeeContractorName,
          tradeSpecialty: form.tradeSpecialty || 'General Trade',
          projectSite: form.projectSite,
          auditId: form.auditId || undefined,
          verifiedHeadcount: Number(form.verifiedHeadcount) || 0,
          claimedHeadcount: Number(form.claimedHeadcount) || 0,
          billedDays: Number(form.billedDays) || 0,
          ratePerDay: Number(form.ratePerDay) || 0,
          billedAmount: Number(form.billedAmount) || 0,
          paymentMethod: form.paymentMethod,
          referenceNo: form.referenceNo || undefined,
          status: finalStatus,
          remarks: form.remarks || undefined,
          createdBy: session?.name || 'Finance',
        }),
      });
      if (res.ok) {
        setToastMsg({ text: 'Disbursement record logged successfully.', type: 'success' });
        setIsModalOpen(false);
        setForm(EMPTY_FORM);
        await fetchRecords(true);
      } else {
        const d = await res.json();
        setToastMsg({ text: d.error || 'Save failed.', type: 'error' });
      }
    } catch {
      setToastMsg({ text: 'Network error. Please retry.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Disburse / approve ──
  const handleApprove = async (record: SubcontractorPayable) => {
    try {
      const res = await fetch(`/api/subcontractor-payables/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED', approvedAmount: record.billedAmount }),
      });
      if (res.ok) {
        setToastMsg({ text: `${record.payeeContractorName} — Approved for disbursement.`, type: 'success' });
        await fetchRecords(true);
      }
    } catch { setToastMsg({ text: 'Failed to approve.', type: 'error' }); }
  };

  const handleDisburse = async () => {
    if (!disburseTarget) return;
    setDisbursing(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/subcontractor-payables/${disburseTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'PAID',
          disbursementDate: today,
          disbursedAmount: disburseTarget.approvedAmount ?? disburseTarget.billedAmount,
          referenceNo: disburseRef || disburseTarget.referenceNo,
        }),
      });
      if (res.ok) {
        setToastMsg({ text: `${fmt(disburseTarget.approvedAmount ?? disburseTarget.billedAmount)} disbursed to ${disburseTarget.payeeContractorName}.`, type: 'success' });
        setDisburseTarget(null);
        setDisburseRef('');
        await fetchRecords(true);
      }
    } catch { setToastMsg({ text: 'Disbursal failed.', type: 'error' }); }
    finally { setDisbursing(false); }
  };

  const handleFlag = async (record: SubcontractorPayable) => {
    try {
      await fetch(`/api/subcontractor-payables/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DISPUTED' }),
      });
      setToastMsg({ text: `Record flagged as Disputed.`, type: 'info' });
      await fetchRecords(true);
    } catch { /* silent */ }
  };

  // ── Export CSV ──
  const handleExport = () => {
    const headers = ['ID', 'Date', 'Payee', 'Trade', 'Project', 'Verified HC', 'Claimed HC', 'Days', 'Rate/Day', 'Billed', 'Approved', 'Disbursed', 'Method', 'Ref', 'Status'];
    const rows = filtered.map(r => [
      r.id, r.disbursementDate || r.createdAt?.split('T')[0] || '',
      r.payeeContractorName, r.tradeSpecialty, r.projectSite,
      r.verifiedHeadcount, r.claimedHeadcount, r.billedDays, r.ratePerDay,
      r.billedAmount, r.approvedAmount ?? '', r.disbursedAmount ?? '',
      r.paymentMethod, r.referenceNo || '', r.status
    ]);
    const csv = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'subcontractor_payables.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const cycleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortField(field); setSortDir('desc'); }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 relative">

      {/* ── Toast ── */}
      {toastMsg && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-semibold animate-in slide-in-from-bottom-4 duration-300 ${
          toastMsg.type === 'success' ? 'bg-emerald-950 border-emerald-500/40 text-emerald-200' :
          toastMsg.type === 'error'   ? 'bg-rose-950 border-rose-500/40 text-rose-200' :
          'bg-sky-950 border-sky-500/40 text-sky-200'
        }`}>
          {toastMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" /> :
           toastMsg.type === 'error'   ? <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" /> :
           <Info className="w-4 h-4 shrink-0 text-sky-400" />}
          <span>{toastMsg.text}</span>
          <button onClick={() => setToastMsg(null)} className="ml-1 text-slate-400 hover:text-white cursor-pointer"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* ── Module Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
              <Receipt className="w-4.5 h-4.5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white tracking-tight">Subcontractor Payables & Disbursements</h1>
              <p className="text-[11px] text-slate-400 font-mono">AP Ledger — Trade Crew Invoice Verification & Milestone Fund Release</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleExport} className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 text-xs font-semibold px-3 py-2 rounded-xl transition cursor-pointer">
            <Download className="w-3.5 h-3.5 text-amber-400" />
            Export CSV
          </button>
          <button onClick={() => fetchRecords(true)} disabled={isRefreshing} className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 text-xs font-semibold px-3 py-2 rounded-xl transition cursor-pointer disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
            Refresh
          </button>
          <button
            onClick={() => { setForm(EMPTY_FORM); setIsModalOpen(true); }}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold px-4 py-2 rounded-xl transition shadow-lg shadow-emerald-900/30 cursor-pointer text-xs"
          >
            <Plus className="w-4 h-4" />
            Record Contractor Disbursement
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Subcontractor Billed', value: fmt(kpis.totalBilled), sub: `${records.length} invoices`, icon: FileText, color: 'text-amber-400', ring: 'border-amber-500/20 bg-amber-500/5' },
          { label: 'Approved for Payout', value: fmt(kpis.approved), sub: 'Audit-verified', icon: ShieldCheck, color: 'text-emerald-400', ring: 'border-emerald-500/20 bg-emerald-500/5' },
          { label: 'Pending Disbursement', value: fmt(kpis.pending), sub: `${records.filter(r=>r.status==='PENDING_AUDIT').length} awaiting audit`, icon: Clock, color: 'text-amber-400', ring: 'border-amber-500/20 bg-amber-500/5' },
          { label: 'Total Disbursed', value: fmt(kpis.disbursed), sub: `${records.filter(r=>r.status==='PAID').length} releases`, icon: CreditCard, color: 'text-sky-400', ring: 'border-sky-500/20 bg-sky-500/5' },
        ].map(card => (
          <div key={card.label} className={`rounded-2xl border p-4 ${card.ring}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider leading-tight">{card.label}</span>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <div className="text-xl font-black text-white font-mono">{card.value}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Filters & Search Bar ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search payee, trade, project, reference…"
            className="w-full bg-slate-900 border border-slate-800 text-slate-200 pl-9 pr-3 py-2 rounded-xl text-xs focus:outline-none focus:border-emerald-500/50"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as any)}
          className="bg-slate-900 border border-slate-800 text-slate-300 text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-emerald-500/50 cursor-pointer"
        >
          <option value="ALL">All Statuses</option>
          {(Object.keys(STATUS_CONFIG) as SubcontractorPayableStatus[]).map(s => (
            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
          ))}
        </select>
        <select
          value={projectFilter}
          onChange={e => setProjectFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-slate-300 text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-emerald-500/50 cursor-pointer"
        >
          <option value="ALL">All Sites</option>
          {projectNames.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <div className="text-[10px] text-slate-500 whitespace-nowrap font-mono">
          {filtered.length} / {records.length} records
        </div>
      </div>

      {/* ── Main Table ── */}
      <div className="bg-slate-950/60 border border-slate-800/60 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-900/80 border-b border-slate-800/80">
                {[
                  { label: 'Disbursement Date', field: 'date' as const, w: 'w-36' },
                  { label: 'Payee & Contractor', field: null, w: 'w-56' },
                  { label: 'Project Site', field: null, w: 'w-40' },
                  { label: 'Headcount Basis', field: null, w: 'w-36' },
                  { label: 'Billed Amount', field: 'amount' as const, w: 'w-36 text-right' },
                  { label: 'Payment Channel', field: null, w: 'w-36' },
                  { label: 'Status', field: 'status' as const, w: 'w-40' },
                  { label: 'Actions', field: null, w: 'w-44 text-center' },
                ].map(col => (
                  <th
                    key={col.label}
                    onClick={() => col.field && cycleSort(col.field)}
                    className={`py-3 px-4 text-left text-[10px] font-bold font-mono uppercase tracking-widest text-slate-400 whitespace-nowrap ${col.w} ${col.field ? 'cursor-pointer hover:text-emerald-400 select-none' : ''}`}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {col.field && sortField === col.field && (
                        sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                    <p className="text-xs">Loading AP ledger…</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center mx-auto mb-3">
                      <Receipt className="w-5 h-5 text-slate-600" />
                    </div>
                    <p className="text-slate-400 font-semibold text-sm">No Disbursement Records Found</p>
                    <p className="text-slate-500 text-xs mt-1">Use [+ Record Contractor Disbursement] to log a subcontractor invoice.</p>
                  </td>
                </tr>
              ) : filtered.map(record => {
                const S = STATUS_CONFIG[record.status] ?? STATUS_CONFIG['PENDING_AUDIT'];
                const StatusIcon = S.icon;
                const isExpanded = expandedId === record.id;
                const headcountMatch = record.verifiedHeadcount >= record.claimedHeadcount;
                // Determine if the linked audit is verified (MATCH) — gates the Approve button
                const linkedAudit = record.auditId
                  ? manpowerAudits.find(a => a.id === record.auditId)
                  : null;
                const auditIsVerified = linkedAudit
                  ? linkedAudit.verificationStatus === 'VERIFIED_MATCH'
                  : headcountMatch; // fall back to headcount match if no linked audit record
                return (
                  <React.Fragment key={record.id}>
                    <tr
                      className="hover:bg-slate-900/50 transition-colors cursor-pointer group"
                      onClick={() => setExpandedId(isExpanded ? null : record.id)}
                    >
                      {/* Date */}
                      <td className="py-3 px-4">
                        <div className="font-mono text-slate-300 text-xs">{fmtDate(record.disbursementDate || record.createdAt)}</div>
                        <div className="text-[10px] text-slate-600 font-mono">{record.id}</div>
                      </td>
                      {/* Payee */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-200 truncate max-w-[200px]">{record.payeeContractorName}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                          <HardHat className="w-3 h-3 text-amber-500/60" />
                          {record.tradeSpecialty}
                        </div>
                      </td>
                      {/* Project */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-slate-300">
                          <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate max-w-[150px]">{record.projectSite}</span>
                        </div>
                      </td>
                      {/* Headcount */}
                      <td className="py-3 px-4">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold ${
                          headcountMatch
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        }`}>
                          <Users className="w-3 h-3" />
                          {record.verifiedHeadcount}/{record.claimedHeadcount} Verified
                        </div>
                        {record.auditId && (
                          <div className="text-[9px] text-slate-600 mt-0.5 font-mono flex items-center gap-1">
                            <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                            Audit Linked
                          </div>
                        )}
                      </td>
                      {/* Billed Amount */}
                      <td className="py-3 px-4 text-right">
                        <div className="font-black text-white font-mono">{fmt(record.billedAmount)}</div>
                        {record.approvedAmount !== undefined && record.approvedAmount !== record.billedAmount && (
                          <div className="text-[10px] text-emerald-400 font-mono">Approved: {fmt(record.approvedAmount)}</div>
                        )}
                      </td>
                      {/* Payment Channel */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <CreditCard className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate">{record.paymentMethod}</span>
                        </div>
                        {record.referenceNo && (
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">#{record.referenceNo}</div>
                        )}
                      </td>
                      {/* Status */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold ${S.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {S.label}
                        </span>
                      </td>
                      {/* Actions */}
                      <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {record.status === 'PENDING_AUDIT' && (
                            <>
                              {/* Show "Verify Audit" when linked audit is NOT yet verified_match */}
                              {!auditIsVerified ? (
                                <button
                                  onClick={() => setSelectedAuditId(record.auditId || null)}
                                  className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded text-[10px] font-medium hover:bg-amber-500/20 transition cursor-pointer"
                                  title="Audit must be verified before approving"
                                >
                                  <ShieldAlert className="w-3 h-3" />
                                  <span>Verify Audit</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleApprove(record)}
                                  className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                                  title="Audit verified — Approve for Disbursement"
                                >
                                  <Check className="w-3 h-3" /> Approve
                                </button>
                              )}
                              <button
                                onClick={() => handleFlag(record)}
                                className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                                title="Flag as Disputed"
                              >
                                <AlertTriangle className="w-3 h-3" />
                              </button>
                            </>
                          )}
                          {record.status === 'APPROVED' && (
                            <button
                              onClick={() => { setDisburseTarget(record); setDisburseRef(record.referenceNo || ''); }}
                              className="px-2 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                              title="Release Payment"
                            >
                              <Send className="w-3 h-3" /> Disburse
                            </button>
                          )}
                          {(record.status === 'PAID' || (record.status as string) === 'Paid / Disbursed') && (
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : record.id)}
                              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded text-xs font-semibold hover:bg-emerald-500/20 cursor-pointer transition"
                              title="View Voucher Proof"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              <span>Voucher Proof</span>
                            </button>
                          )}
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : record.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition cursor-pointer"
                            title="View Details"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* ── Expanded Detail Row ── */}
                    {isExpanded && (
                      <tr className="bg-slate-900/40 border-b border-slate-800/30">
                        <td colSpan={8} className="px-6 py-4">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                            <div>
                              <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-1">Billing Basis</div>
                              <div className="text-slate-200">{record.billedDays} days × {fmt(record.ratePerDay)}/day</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-1">Headcount Detail</div>
                              <div className="text-slate-200">Claimed: {record.claimedHeadcount} | Verified: {record.verifiedHeadcount}</div>
                              {record.claimedHeadcount > record.verifiedHeadcount && (
                                <div className="text-rose-400 text-[10px] mt-0.5">⚠ {record.claimedHeadcount - record.verifiedHeadcount} ghost workers detected</div>
                              )}
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-1">Disbursed Amount</div>
                              <div className="text-slate-200 font-mono font-bold">{record.disbursedAmount !== undefined ? fmt(record.disbursedAmount) : '—'}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-1">Remarks</div>
                              <div className="text-slate-400">{record.remarks || '—'}</div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Table Footer Summary */}
        {filtered.length > 0 && (
          <div className="border-t border-slate-800/60 bg-slate-900/50 px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <span className="text-slate-400">{filtered.length} records shown</span>
            <div className="flex items-center gap-6 font-mono">
              <span className="text-slate-400">Total Billed: <span className="text-amber-300 font-bold">{fmt(filtered.reduce((s,r)=>s+r.billedAmount,0))}</span></span>
              <span className="text-slate-400">Total Disbursed: <span className="text-sky-300 font-bold">{fmt(filtered.filter(r=>r.status==='PAID').reduce((s,r)=>s+(r.disbursedAmount??r.approvedAmount??r.billedAmount),0))}</span></span>
            </div>
          </div>
        )}
      </div>

      {/* ── Audit-Linked Records from DailyManpowerAudit ── */}
      {manpowerAudits.length > 0 && (
        <div className="bg-slate-950/60 border border-slate-800/60 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800/60 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-bold text-white">Certified Audit Headcounts — Available for Billing Linkage</span>
            <span className="ml-auto text-[10px] font-mono text-slate-500">{manpowerAudits.length} audit records</span>
          </div>
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-900/90">
                <tr className="border-b border-slate-800/60">
                  {['Date', 'Subcontractor / Crew', 'Trade', 'Project Site', 'Claimed', 'Verified', 'Status', 'Action'].map(h => (
                    <th key={h} className="py-2.5 px-3 text-left text-[10px] font-bold font-mono uppercase tracking-widest text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/30">
                {manpowerAudits.slice(0, 15).map(audit => {
                  const linked = records.some(r => r.auditId === audit.id);
                  const isBilled = linked || (audit as any).isBilled === true || (audit as any).status === 'Billed' || (audit as any).status === 'BILLED';
                  return (
                    <tr key={audit.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2 px-3 font-mono text-slate-400">{fmtDate(audit.date)}</td>
                      <td className="py-2 px-3 text-slate-200 font-semibold truncate max-w-[180px]">{audit.contractorName}</td>
                      <td className="py-2 px-3 text-slate-400">{audit.specialty}</td>
                      <td className="py-2 px-3 text-slate-400">{audit.assignedSectorOrLot}</td>
                      <td className="py-2 px-3 text-slate-300">{audit.claimedHeadcount}</td>
                      <td className="py-2 px-3">
                        <span className={`font-bold ${audit.verifiedHeadcount >= audit.claimedHeadcount ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {audit.verifiedHeadcount}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          audit.verificationStatus === 'VERIFIED_MATCH'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        }`}>
                          {audit.verificationStatus === 'VERIFIED_MATCH' ? '✓ Verified' : '⚠ Flagged'}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        {isBilled ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-slate-800 text-slate-400 border border-slate-700 cursor-default">
                            ✓ Billed
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              const DEFAULT_RATE = 1000;
                              const DEFAULT_DAYS = 1;
                              const hc = audit.verifiedHeadcount || 1;
                              setForm({
                                ...EMPTY_FORM,
                                payeeContractorName: audit.contractorName,
                                tradeSpecialty: audit.specialty || 'General Trade',
                                auditId: audit.id,
                                verifiedHeadcount: String(audit.verifiedHeadcount),
                                claimedHeadcount: String(audit.claimedHeadcount),
                                projectSite: audit.assignedSectorOrLot || '',
                                ratePerDay: String(DEFAULT_RATE),
                                billedDays: String(DEFAULT_DAYS),
                                billedAmount: String(DEFAULT_RATE * DEFAULT_DAYS * hc),
                                remarks: `${audit.verifiedHeadcount} / ${audit.claimedHeadcount} Men Verified on-site for ${audit.assignedSectorOrLot || 'site'}. Roll-call audit ${audit.id} — ${audit.verificationStatus === 'VERIFIED_MATCH' ? '100% Match ✓' : 'Discrepancy Flagged'}.`,
                              });
                              setIsModalOpen(true);
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-bold hover:bg-emerald-500/20 transition cursor-pointer"
                            title={`Create Invoice — ${audit.verifiedHeadcount}/${audit.claimedHeadcount} verified`}
                          >
                            <Plus className="w-3 h-3" /> Create Invoice
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Record Contractor Disbursement                               */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-2xl bg-slate-950 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-6 pb-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
                  <Receipt className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h2 className="font-bold text-white text-sm">Record Contractor Disbursement</h2>
                  <p className="text-[10px] text-slate-400">Log invoice billing linked to verified roll-call audit</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[72vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Payee */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Payee / Subcontractor Name *</label>
                  {tradeContractors.length > 0 ? (
                    <select
                      value={form.payeeContractorName}
                      onChange={e => handleContractorSelect(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-emerald-500/60 cursor-pointer"
                      required
                    >
                      <option value="">— Select Subcontractor —</option>
                      {tradeContractors.map(c => (
                        <option key={c.id} value={c.name}>{c.name} {c.specialty ? `(${c.specialty})` : ''}</option>
                      ))}
                      <option value="__custom">+ Enter manually…</option>
                    </select>
                  ) : (
                    <input
                      value={form.payeeContractorName}
                      onChange={e => handleFormChange('payeeContractorName', e.target.value)}
                      placeholder="e.g. Rodolfo Alonte - Manpower Supply"
                      className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-emerald-500/60"
                      required
                    />
                  )}
                  {form.payeeContractorName === '__custom' && (
                    <input
                      value={''}
                      onChange={e => handleFormChange('payeeContractorName', e.target.value)}
                      placeholder="Enter contractor name"
                      className="w-full mt-2 bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-emerald-500/60"
                      required
                    />
                  )}
                </div>

                {/* Trade */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Trade Specialty</label>
                  <input
                    value={form.tradeSpecialty}
                    onChange={e => handleFormChange('tradeSpecialty', e.target.value)}
                    placeholder="e.g. Concrete Pouring, Masonry"
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-emerald-500/60"
                  />
                </div>

                {/* Project Site */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Project Site *</label>
                  <select
                    value={form.projectSite}
                    onChange={e => handleFormChange('projectSite', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-emerald-500/60 cursor-pointer"
                    required
                  >
                    <option value="">— Select Site —</option>
                    {projectNames.map(p => <option key={p} value={p}>{p}</option>)}
                    <option value="__custom">+ Enter manually…</option>
                  </select>
                </div>

                {/* Audit Link */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    LINK TRADE ROLL-CALL AUDIT
                  </label>
                  <select
                    value={form.auditId}
                    onChange={e => handleAuditSelect(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-emerald-500/60 cursor-pointer"
                  >
                    <option value="">-- No Audit Linked --</option>
                    {manpowerAudits.map(a => (
                      <option key={a.id} value={a.id}>
                        {fmtDate(a.date)} — {a.contractorName} | {a.verifiedHeadcount}/{a.claimedHeadcount} verified ({a.verificationStatus})
                      </option>
                    ))}
                  </select>
                  {!form.auditId && (
                    <div className="mt-2.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2 font-medium">
                      <span>⚠️ Unverified Field Payout: Requires Executive OM Sign-Off</span>
                    </div>
                  )}
                </div>

                {/* Headcounts */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Verified Headcount</label>
                  <input type="number" min={0} value={form.verifiedHeadcount} onChange={e => handleFormChange('verifiedHeadcount', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-emerald-500/60" placeholder="0" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Claimed Headcount</label>
                  <input type="number" min={0} value={form.claimedHeadcount} onChange={e => handleFormChange('claimedHeadcount', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-emerald-500/60" placeholder="0" />
                </div>

                {/* Rate calculation */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Billed Days</label>
                  <input type="number" min={0} step={0.5} value={form.billedDays} onChange={e => handleFormChange('billedDays', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-emerald-500/60" placeholder="e.g. 10" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Rate Per Day (₱)</label>
                  <input type="number" min={0} value={form.ratePerDay} onChange={e => handleFormChange('ratePerDay', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-emerald-500/60" placeholder="e.g. 600" />
                </div>

                {/* Billed Amount */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Total Billed Amount (₱) * <span className="text-slate-600">— auto-calculated from days × rate</span>
                  </label>
                  <input type="number" min={0} value={form.billedAmount} onChange={e => handleFormChange('billedAmount', e.target.value)}
                    className="w-full bg-slate-900 border border-amber-500/40 text-white font-bold px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-amber-500/60" required placeholder="₱0.00" />
                </div>

                {/* Payment method */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Payment Channel</label>
                  <select value={form.paymentMethod} onChange={e => handleFormChange('paymentMethod', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-emerald-500/60 cursor-pointer">
                    {['Bank Wire', 'Check', 'Cash Voucher', 'GCash', 'Maya'].map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Reference No.</label>
                  <input value={form.referenceNo} onChange={e => handleFormChange('referenceNo', e.target.value)}
                    placeholder="Check #1042 / Wire Ref…"
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-emerald-500/60" />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Initial Status</label>
                  <select 
                    value={!form.auditId ? 'PENDING_AUDIT' : form.status} 
                    disabled={!form.auditId}
                    onChange={e => handleFormChange('status', e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-emerald-500/60 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {!form.auditId ? (
                      <option value="PENDING_AUDIT">Pending Audit Verification</option>
                    ) : (
                      (Object.keys(STATUS_CONFIG) as SubcontractorPayableStatus[]).map(s => (
                        <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                      ))
                    )}
                  </select>
                </div>

                {/* Remarks / Justification */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Audit Notes / Justification {!form.auditId && <span className="text-amber-400 font-bold">* (Required for Unverified Payouts)</span>}
                  </label>
                  <textarea 
                    value={form.remarks} 
                    onChange={e => handleFormChange('remarks', e.target.value)} 
                    rows={2}
                    required={!form.auditId}
                    placeholder={!form.auditId ? "Justification required for executive OM sign-off on unverified manual payout..." : "Notes, billing dispute context, etc."}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-emerald-500/60 resize-none" 
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-xs transition shadow-lg shadow-emerald-900/30 cursor-pointer disabled:opacity-60">
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {isSaving ? 'Saving…' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* DISBURSE CONFIRMATION MODAL                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {disburseTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDisburseTarget(null)} />
          <div className="relative w-full max-w-md bg-slate-950 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 pb-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/25 flex items-center justify-center">
                  <Send className="w-4.5 h-4.5 text-sky-400" />
                </div>
                <div>
                  <h2 className="font-bold text-white text-sm">Release Payment</h2>
                  <p className="text-[10px] text-slate-400">Confirm disbursement to subcontractor</p>
                </div>
              </div>
              <button onClick={() => setDisburseTarget(null)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 pt-4 space-y-4">
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-slate-400">Payee</span><span className="text-white font-semibold">{disburseTarget.payeeContractorName}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Project</span><span className="text-slate-300">{disburseTarget.projectSite}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Amount to Release</span><span className="text-sky-300 font-black font-mono">{fmt(disburseTarget.approvedAmount ?? disburseTarget.billedAmount)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Payment Channel</span><span className="text-slate-300">{disburseTarget.paymentMethod}</span></div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Reference / Voucher No.</label>
              <input value={disburseRef} onChange={e => setDisburseRef(e.target.value)}
                placeholder="e.g. Check #1043, Wire TXN-20260927"
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-sky-500/60" />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setDisburseTarget(null)} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer">Cancel</button>
              <button onClick={handleDisburse} disabled={disbursing} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 text-white font-bold text-xs transition cursor-pointer disabled:opacity-60 shadow-lg shadow-sky-900/30">
                {disbursing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {disbursing ? 'Processing…' : 'Confirm Disbursement'}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
