/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  DollarSign, CheckCircle2, Clock, AlertTriangle, Filter, 
  Search, Plus, ArrowUpRight, ShieldAlert, CreditCard, Building2, 
  Receipt, Calendar, X, Check, FileText, Printer, Trash2, Edit3
} from 'lucide-react';
import { Client, ProjectProfile } from '../types';

export interface InstallmentRowItem {
  id: string;
  clientId: string;
  clientName: string;
  projectName: string;
  dueDate: string;
  amount: number;
  status: 'Paid' | 'Pending';
  paidDate?: string;
  paymentMethod?: string;
  reference?: string;
  isOverdue: boolean;
}

interface PaymentsTrackerProps {
  clients: Client[];
  projects?: ProjectProfile[];
  userRole?: string;
  isPrivateAccounting?: boolean;
  onRecordPayment?: (paymentData: {
    clientId: string;
    amount: number;
    paymentMethod: string;
    reference: string;
    notes: string;
  }) => Promise<void>;
}

export default function PaymentsTracker({ 
  clients = [], 
  projects = [], 
  userRole = 'ADMIN',
  isPrivateAccounting = false,
  onRecordPayment 
}: PaymentsTrackerProps) {
  const isAdmin = (userRole || '').toUpperCase() === 'ADMIN' || (userRole || '').toUpperCase() === 'OPERATIONS_DIRECTOR';
  // Local list of installment records initialized from clients
  const [installments, setInstallments] = useState<InstallmentRowItem[]>(() => {
    return clients.flatMap(client => {
      return (client.payments || []).map(p => {
        const isOverdue = p.status === 'Pending' && new Date(p.dueDate) < new Date();
        return {
          ...p,
          clientId: client.id,
          clientName: client.name,
          projectName: client.packageName || 'Commercial Fit-Out',
          isOverdue
        };
      });
    });
  });

  // Re-sync if clients prop changes
  React.useEffect(() => {
    if (clients && clients.length > 0) {
      setInstallments(clients.flatMap(client => {
        return (client.payments || []).map(p => {
          const isOverdue = p.status === 'Pending' && new Date(p.dueDate) < new Date();
          return {
            ...p,
            clientId: client.id,
            clientName: client.name,
            projectName: client.packageName || 'Commercial Fit-Out',
            isOverdue
          };
        });
      }));
    }
  }, [clients]);

  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [showRecordModal, setShowRecordModal] = useState<boolean>(false);
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState<boolean>(false);
  const [selectedReceipt, setSelectedReceipt] = useState<InstallmentRowItem | null>(null);

  // Record Payment Form state
  const [recordClientId, setRecordClientId] = useState<string>('');
  const [recordAmount, setRecordAmount] = useState<number>(150000);
  const [recordMethod, setRecordMethod] = useState<string>('Bank Wire (Metrobank Corporate)');
  const [recordRef, setRecordRef] = useState<string>('');
  const [recordNotes, setRecordNotes] = useState<string>('Progress billing installment');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // New Invoice Form state
  const [invoiceClientName, setInvoiceClientName] = useState<string>('NexBridge Corp');
  const [invoiceProjectName, setInvoiceProjectName] = useState<string>('NexBridge Software Hub');
  const [invoiceDueDate, setInvoiceDueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [invoiceAmount, setInvoiceAmount] = useState<number>(350000);
  const [invoiceMethod, setInvoiceMethod] = useState<string>('Progress Billing Installment');

  // Compute live totals from active installments list
  const totalCollected = installments
    .filter(i => i.status === 'Paid')
    .reduce((sum, i) => sum + i.amount, 0);

  const totalPending = installments
    .filter(i => i.status === 'Pending')
    .reduce((sum, i) => sum + i.amount, 0);

  const totalTCP = totalCollected + totalPending;
  const overdueCount = installments.filter(i => i.isOverdue).length;

  const filteredInstallments = installments.filter(item => {
    if (selectedProjectFilter !== 'ALL' && !item.projectName.toLowerCase().includes(selectedProjectFilter.toLowerCase())) {
      return false;
    }
    if (statusFilter === 'PAID' && item.status !== 'Paid') return false;
    if (statusFilter === 'PENDING' && (item.status !== 'Pending' || item.isOverdue)) return false;
    if (statusFilter === 'OVERDUE' && !item.isOverdue) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return item.clientName.toLowerCase().includes(q) || item.projectName.toLowerCase().includes(q) || item.id.toLowerCase().includes(q);
    }
    return true;
  });

  const handleToggleStatus = (id: string) => {
    let nextStatus: 'Paid' | 'Pending' = 'Paid';
    setInstallments(prev => prev.map(inst => {
      if (inst.id !== id) return inst;
      nextStatus = inst.status === 'Paid' ? 'Pending' : 'Paid';
      const isOverdue = nextStatus === 'Pending' && new Date(inst.dueDate) < new Date();
      return {
        ...inst,
        status: nextStatus,
        isOverdue,
        paidDate: nextStatus === 'Paid' ? new Date().toISOString().split('T')[0] : undefined
      };
    }));

    fetch(`/api/payments/installment/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus })
    }).catch(console.error);
  };

  const handleDeleteInstallment = (id: string) => {
    setInstallments(prev => prev.filter(i => i.id !== id));
    fetch(`/api/payments/installment/${id}`, { method: 'DELETE' }).catch(console.error);
  };

  const handleCreateInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceClientName.trim() || !invoiceAmount) return;

    const tempId = `INV-${Date.now().toString().slice(-4)}`;
    const matchedClient = clients.find(c => c.name.toLowerCase() === invoiceClientName.trim().toLowerCase());

    const newInst: InstallmentRowItem = {
      id: tempId,
      clientId: matchedClient?.id || `CLI-${Date.now().toString().slice(-3)}`,
      clientName: invoiceClientName.trim(),
      projectName: invoiceProjectName,
      dueDate: invoiceDueDate,
      amount: Number(invoiceAmount),
      status: 'Pending',
      paymentMethod: invoiceMethod,
      isOverdue: new Date(invoiceDueDate) < new Date()
    };

    setInstallments([newInst, ...installments]);
    setShowCreateInvoiceModal(false);

    try {
      const res = await fetch('/api/payments/installment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: matchedClient?.id,
          clientName: invoiceClientName.trim(),
          projectName: invoiceProjectName,
          dueDate: invoiceDueDate,
          amount: Number(invoiceAmount),
          paymentMethod: invoiceMethod
        })
      });
      if (res.ok) {
        const saved = await res.json();
        if (saved && saved.id) {
          setInstallments(prev => prev.map(item => item.id === tempId ? { ...item, id: saved.id } : item));
        }
      }
    } catch (err) {
      console.error('Failed to create invoice:', err);
    }
  };

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordClientId || !recordAmount) return;

    setIsSubmitting(true);
    setFeedbackMsg(null);

    try {
      if (onRecordPayment) {
        await onRecordPayment({
          clientId: recordClientId,
          amount: Number(recordAmount),
          paymentMethod: recordMethod,
          reference: recordRef,
          notes: recordNotes
        });
      } else {
        await fetch('/api/payments/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: recordClientId,
            amount: Number(recordAmount),
            paymentMethod: recordMethod,
            reference: recordRef,
            notes: recordNotes
          })
        });
      }

      // Mark the first matching pending installment in local state as Paid
      setInstallments(prev => {
        let found = false;
        return prev.map(item => {
          if (!found && item.status === 'Pending') {
            found = true;
            return {
              ...item,
              status: 'Paid',
              isOverdue: false,
              paidDate: new Date().toISOString().split('T')[0],
              reference: recordRef || 'VERIFIED-SETTLED'
            };
          }
          return item;
        });
      });

      setFeedbackMsg('Payment successfully recorded and synced with PostgreSQL ledger!');
      setTimeout(() => {
        setShowRecordModal(false);
        setFeedbackMsg(null);
      }, 1200);
    } catch (err: any) {
      setFeedbackMsg(`Error: ${err.message || 'Payment recording failed'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check confidentiality policy:
  // If prop isPrivateAccounting is set OR if the selected project filter matches a project with isPrivateAccounting
  const matchingProject = projects.find(p => p.name.toLowerCase().includes(selectedProjectFilter.toLowerCase()));
  const isConfidential = isPrivateAccounting || (selectedProjectFilter !== 'ALL' && matchingProject?.isPrivateAccounting) || false;
  const isAccessRestricted = isConfidential && !isAdmin;

  if (isAccessRestricted) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-6 rounded-2xl backdrop-blur-xl shadow-2xl">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold tracking-wider uppercase">
                Restricted Access Policy
              </span>
              <span className="text-xs text-slate-400">Financial Ledger Protection</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <ShieldAlert className="w-7 h-7 text-amber-400" />
              Confidential Accounting — Restricted Access
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Granular financial ledger entries, profit margins, and contractor payment records are protected.
            </p>
          </div>
          {projects.length > 0 && (
            <select
              value={selectedProjectFilter}
              onChange={(e) => setSelectedProjectFilter(e.target.value)}
              aria-label="Filter by Project Profile"
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
            >
              <option value="ALL">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.name}>
                  {p.name} {p.isPrivateAccounting ? '(Confidential)' : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="bg-slate-900/60 border border-amber-500/30 rounded-2xl p-10 text-center flex flex-col items-center justify-center max-w-2xl mx-auto shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Confidential Financial Ledger</h3>
          <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
            Granular ledger entries, payment schedules, and contractor disbursement records for this project have been designated as private accounting. Access is strictly restricted to Executive Admin authority.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
            <span>Required Authority:</span>
            <span className="font-mono font-bold text-amber-400">ADMIN</span>
            <span className="text-slate-500">•</span>
            <span>Your Session:</span>
            <span className="font-mono text-slate-400">{userRole}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-6 rounded-2xl backdrop-blur-xl shadow-2xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold tracking-wider uppercase">
              Financial Transparency
            </span>
            {isConfidential && (
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold tracking-wider uppercase flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-amber-400" />
                Confidential Accounting (Admin View)
              </span>
            )}
            <span className="text-xs text-slate-400">Installment Ledger & Corporate Receivables</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <DollarSign className="w-7 h-7 text-emerald-400" />
            Payments & Milestone Billing
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Focused on installment tracking per project: client payments, due dates, collected vs. pending amounts, and overdue accounts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateInvoiceModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Installment Schedule
          </button>

          <button
            onClick={() => {
              if (clients.length > 0) setRecordClientId(clients[0].id);
              setShowRecordModal(true);
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl transition shadow-lg shadow-emerald-500/20 cursor-pointer text-xs"
          >
            <CheckCircle2 className="w-4 h-4" />
            Record Client Payment
          </button>
        </div>
      </div>

      {/* Financial Health Overview KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Total Contract Price (TCP)</span>
            <CreditCard className="w-5 h-5 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2 font-mono">
            ₱{totalTCP.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Across {installments.length} installment schedules
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Total Funds Collected</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2 font-mono">
            ₱{totalCollected.toLocaleString()}
          </div>
          <div className="text-xs text-emerald-500/80 mt-1">
            {totalTCP > 0 ? Math.round((totalCollected / totalTCP) * 100) : 0}% collected to date
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Pending Receivables</span>
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-2 font-mono">
            ₱{totalPending.toLocaleString()}
          </div>
          <div className="text-xs text-amber-500/80 mt-1">
            Pending milestone billing cycles
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Overdue Accounts</span>
            <AlertTriangle className="w-5 h-5 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 mt-2 font-mono">
            {overdueCount} Overdue
          </div>
          <div className="text-xs text-rose-500/80 mt-1">
            Requires follow-up / notice of delay
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
              value={selectedProjectFilter}
              onChange={(e) => setSelectedProjectFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono"
            >
              <option value="ALL">All Commercial Projects</option>
              <option value="NexBridge">NexBridge Software Hub</option>
              <option value="BGComm">BGComm Global BPO Floor</option>
              <option value="RedBin">RedBin Commercial HQ</option>
              <option value="Owl">Owl Creative Studio</option>
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
              <option value="ALL">All Payment Statuses</option>
              <option value="PAID">Paid Only</option>
              <option value="PENDING">Pending (Current)</option>
              <option value="OVERDUE">Overdue Accounts Only</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search client, project, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Installments Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-400" />
            Installment Billing Ledger ({filteredInstallments.length} Records)
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            Click status button to toggle Paid / Pending
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Invoice / ID</th>
                <th className="py-3.5 px-4">Client / Company</th>
                <th className="py-3.5 px-4">Project Fit-Out</th>
                <th className="py-3.5 px-4">Due Date</th>
                <th className="py-3.5 px-4 text-right">Amount (₱)</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredInstallments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-500 italic">
                    No installment records found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredInstallments.map((inst, index) => (
                  <tr key={`${inst.id}-${index}`} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-amber-400">
                      {inst.id}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {inst.clientName}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {inst.projectName}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      {inst.dueDate}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                      ₱{inst.amount.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleToggleStatus(inst.id)}
                        className="cursor-pointer transition hover:scale-105"
                        title="Click to toggle Paid / Pending"
                      >
                        {inst.status === 'Paid' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> Paid
                          </span>
                        ) : inst.isOverdue ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-800 animate-pulse">
                            <AlertTriangle className="w-3 h-3" /> Overdue
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedReceipt(inst)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono flex items-center gap-1 transition cursor-pointer"
                          title="View Receipt Statement"
                        >
                          <FileText className="w-3 h-3" /> Receipt
                        </button>
                        <button
                          onClick={() => handleDeleteInstallment(inst.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                          title="Delete Installment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* Printable Receipt / Invoice Statement Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 sm:p-8 relative">
            <button
              onClick={() => setSelectedReceipt(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Receipt Header */}
            <div className="border-b border-slate-800 pb-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Building2 className="w-5 h-5 text-amber-400" />
                <span className="font-bold text-white tracking-wider uppercase text-sm">
                  CTVill Design & Construction
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                Official Installment Billing Statement & Receipt
              </p>
            </div>

            {/* Receipt Body */}
            <div className="py-5 space-y-3 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Invoice Reference:</span>
                <span className="text-amber-400 font-bold">{selectedReceipt.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Client / Account:</span>
                <span className="text-white font-bold">{selectedReceipt.clientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Project Name:</span>
                <span className="text-slate-200">{selectedReceipt.projectName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Due Date:</span>
                <span className="text-slate-300">{selectedReceipt.dueDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payment Status:</span>
                <span className={`font-bold ${selectedReceipt.status === 'Paid' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {selectedReceipt.status.toUpperCase()}
                </span>
              </div>
              {selectedReceipt.paidDate && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Settled On:</span>
                  <span className="text-emerald-400">{selectedReceipt.paidDate}</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 flex justify-between text-sm">
                <span className="text-slate-300 font-bold">Installment Amount:</span>
                <span className="text-emerald-400 font-bold font-mono">
                  ₱{selectedReceipt.amount.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Receipt Footer */}
            <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Print Statement
              </button>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Installment Schedule Modal */}
      {showCreateInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative">
            <button
              onClick={() => setShowCreateInvoiceModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <Receipt className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-bold text-white">Create Installment Schedule</h3>
            </div>

            <form onSubmit={handleCreateInvoiceSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Client / Corporate Account</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. NexBridge Software Corp"
                  value={invoiceClientName}
                  onChange={(e) => setInvoiceClientName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Commercial Fit-Out Project</label>
                <select
                  value={invoiceProjectName}
                  onChange={(e) => setInvoiceProjectName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                >
                  <option value="NexBridge Software Hub">NexBridge Software Hub</option>
                  <option value="BGComm Global BPO Floor">BGComm Global BPO Floor</option>
                  <option value="RedBin Commercial HQ">RedBin Commercial HQ</option>
                  <option value="Owl Creative Studio">Owl Creative Studio</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Installment Amount (₱)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={invoiceAmount}
                    onChange={(e) => setInvoiceAmount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={invoiceDueDate}
                    onChange={(e) => setInvoiceDueDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Payment Plan Milestone</label>
                <select
                  value={invoiceMethod}
                  onChange={(e) => setInvoiceMethod(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                >
                  <option value="Downpayment & Mobilization">Downpayment & Mobilization (15%)</option>
                  <option value="Progress Billing Installment">Progress Billing Milestone</option>
                  <option value="Framing & MEPFS Sign-Off">Framing & MEPFS Sign-Off (30%)</option>
                  <option value="Substantial Completion">Substantial Completion (35%)</option>
                  <option value="Retention & Final Handover">Retention & Final Handover (10%)</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateInvoiceModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  Create Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative">
            <button
              onClick={() => setShowRecordModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-bold text-white">Record Client Payment</h3>
            </div>

            {feedbackMsg && (
              <div className={`p-3 rounded-xl mb-4 text-xs font-mono flex items-center gap-2 ${
                feedbackMsg.startsWith('Error') 
                  ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                  : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
              }`}>
                {feedbackMsg.startsWith('Error') ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
                {feedbackMsg}
              </div>
            )}

            <form onSubmit={handleRecordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Select Client / Project</label>
                <select
                  required
                  value={recordClientId}
                  onChange={(e) => setRecordClientId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                >
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.packageName} (Bal: ₱{c.balance.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Payment Amount (₱)</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={recordAmount}
                  onChange={(e) => setRecordAmount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Payment Channel / Bank</label>
                <select
                  value={recordMethod}
                  onChange={(e) => setRecordMethod(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                >
                  <option value="Bank Wire (Metrobank Corporate)">Bank Wire (Metrobank Corporate)</option>
                  <option value="BDO Corporate Direct Debit">BDO Corporate Direct Debit</option>
                  <option value="Managers Check (Over-the-Counter)">Manager's Check (Over-the-Counter)</option>
                  <option value="PEZA Escrow Disbursement">PEZA Escrow Disbursement</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Transaction / Deposit Reference No.</label>
                <input
                  type="text"
                  placeholder="e.g. MBTC-TRX-2026-90412"
                  value={recordRef}
                  onChange={(e) => setRecordRef(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Notes & Allocation Details</label>
                <textarea
                  rows={2}
                  value={recordNotes}
                  onChange={(e) => setRecordNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowRecordModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? 'Recording...' : 'Confirm & Sync Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
