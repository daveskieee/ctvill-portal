/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  FileSpreadsheet, Plus, CheckCircle2, XCircle, Clock, 
  DollarSign, AlertTriangle, Search, Filter, ShieldCheck, ShieldAlert,
  User, Calendar, X, Check, ArrowRight, Building2, FileText, CheckSquare, Download, Printer
} from 'lucide-react';
import { ChangeOrder, ProjectProfile } from '../types';
import { exportToCsv, printRegisterTable } from '../utils/exportUtils';

interface ChangeOrderManagerProps {
  changeOrders: ChangeOrder[];
  projects?: ProjectProfile[];
  isAdmin?: boolean;
  userRole?: string;
  onSubmitChangeOrder?: (order: Partial<ChangeOrder>) => Promise<void> | void;
  onUpdateChangeOrderStatus?: (id: string, status: 'APPROVED' | 'REJECTED', approvedAmount?: number) => Promise<void> | void;
}

export default function ChangeOrderManager({
  changeOrders = [],
  projects = [],
  isAdmin = true,
  userRole = 'ADMIN',
  onSubmitChangeOrder,
  onUpdateChangeOrderStatus
}: ChangeOrderManagerProps) {
  const normalizedRole = (userRole || '').toUpperCase();
  const isExecutiveAdmin = normalizedRole === 'ADMIN' || normalizedRole === 'SUPER_ADMIN';
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [selectedOrder, setSelectedOrder] = useState<ChangeOrder | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formContractor, setFormContractor] = useState('SolidFoundations Engineering');
  const [formProject, setFormProject] = useState(projects[0]?.name || 'NexBridge Software Hub');
  const [formAmount, setFormAmount] = useState<number>(150000);
  const [formJustification, setFormJustification] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Approval Modal State
  const [showApproveModal, setShowApproveModal] = useState<boolean>(false);
  const [targetOrder, setTargetOrder] = useState<ChangeOrder | null>(null);
  const [approvedAmountInput, setApprovedAmountInput] = useState<number>(0);
  const [approvalAction, setApprovalAction] = useState<'APPROVED' | 'REJECTED'>('APPROVED');

  const filteredOrders = changeOrders.filter(co => {
    if (statusFilter !== 'ALL' && co.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        co.title.toLowerCase().includes(q) ||
        co.orderNumber.toLowerCase().includes(q) ||
        co.contractorName.toLowerCase().includes(q) ||
        (co.justification && co.justification.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalRequested = changeOrders.reduce((sum, c) => sum + (Number(c.requestedAmount) || 0), 0);
  const totalApproved = changeOrders.filter(c => c.status === 'APPROVED').reduce((sum, c) => sum + (Number(c.approvedAmount || c.requestedAmount) || 0), 0);
  const pendingCount = changeOrders.filter(c => c.status === 'PENDING').length;
  const pendingAmount = changeOrders.filter(c => c.status === 'PENDING').reduce((sum, c) => sum + (Number(c.requestedAmount) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || formAmount <= 0) return;

    setIsSubmitting(true);
    try {
      const newOrder: Partial<ChangeOrder> = {
        orderNumber: `CO-${new Date().getFullYear()}-${String(changeOrders.length + 1).padStart(3, '0')}`,
        title: formTitle.trim(),
        contractorName: formContractor,
        requestedAmount: Number(formAmount),
        status: 'PENDING',
        justification: `[${formProject}] ${formJustification.trim()}`
      };

      if (onSubmitChangeOrder) {
        await onSubmitChangeOrder(newOrder);
      }

      setFormTitle('');
      setFormJustification('');
      setShowSubmitModal(false);
    } catch (err) {
      console.error('Failed to submit change order:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenApprove = (order: ChangeOrder, action: 'APPROVED' | 'REJECTED') => {
    if (action === 'APPROVED' && (Number(order.requestedAmount) || 0) >= 1000000 && !isExecutiveAdmin) {
      return;
    }
    setTargetOrder(order);
    setApprovalAction(action);
    setApprovedAmountInput(action === 'APPROVED' ? Number(order.requestedAmount) : 0);
    setShowApproveModal(true);
  };

  const handleConfirmApproval = async () => {
    if (!targetOrder) return;
    try {
      if (onUpdateChangeOrderStatus) {
        await onUpdateChangeOrderStatus(
          targetOrder.id, 
          approvalAction, 
          approvalAction === 'APPROVED' ? Number(approvedAmountInput) : 0
        );
      }
      setShowApproveModal(false);
      setTargetOrder(null);
    } catch (err) {
      console.error('Failed to update change order status:', err);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Order Ref', 'Title', 'Project Site', 'Contractor / Trade',
      'Amount Requested (PHP)', 'Approved Amount (PHP)', 'Timeline Impact (Days)',
      'Status', 'Date Raised', 'Justification'
    ];
    const rows = filteredOrders.map(co => [
      co.orderNumber,
      co.title,
      co.projectName || '',
      co.contractorName,
      co.requestedAmount ?? co.amount ?? 0,
      co.approvedAmount || '',
      co.scheduleImpactDays || 0,
      co.status,
      co.createdAt || '',
      co.justification || ''
    ]);
    exportToCsv('CTVill_Change_Orders_Register', headers, rows);
  };

  const handlePrint = () => {
    const headers = [
      'Order Ref', 'Title / Description', 'Project Site', 'Contractor',
      'Amount', 'Status', 'Days Impact'
    ];
    const rows = filteredOrders.map(co => [
      co.orderNumber,
      co.title,
      co.projectName || '',
      co.contractorName,
      `₱${Number(co.approvedAmount ?? co.requestedAmount ?? co.amount ?? 0).toLocaleString()}`,
      co.status,
      `+${co.scheduleImpactDays || 0}d`
    ]);
    printRegisterTable('Commercial Change Orders & Variations Register', 'Scope Alterations, Cost Revisions & Timeline Impacts', headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
            <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider">
              COMMERCIAL VARIATION CONTROL
            </span>
          </div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-amber-400" />
            Change Orders & Scope Variation Management
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Formal contract variations, material specification alterations, and schedule timeline impact approvals.
          </p>
        </div>

        <button
          onClick={() => setShowSubmitModal(true)}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer transition-all self-start sm:self-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Raise Change Order</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
            <span>TOTAL VARIATIONS</span>
            <FileText className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            ₱{totalRequested.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-400 block font-mono">
            {changeOrders.length} Change Orders Raised
          </span>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
            <span>APPROVED SCOPE VALUE</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-300">
            ₱{totalApproved.toLocaleString()}
          </div>
          <span className="text-[10px] text-emerald-400 block font-mono">
            Committed to Master Budget
          </span>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
            <span>PENDING EXECUTIVE APPROVAL</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-300">
            ₱{pendingAmount.toLocaleString()}
          </div>
          <span className="text-[10px] text-amber-400 block font-mono">
            {pendingCount} Pending Orders
          </span>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
            <span>GOVERNANCE STATUS</span>
            <ShieldCheck className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-teal-300">
            100%
          </div>
          <span className="text-[10px] text-teal-400 block font-mono">
            Audit-Protected Variance
          </span>
        </div>
      </div>

      {/* Filter & Search Controls */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-500 shrink-0" />
          <div className="flex gap-1.5 overflow-x-auto py-1">
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search order #, title, trade..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <button
            onClick={handleExportCsv}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            title="Export filtered change orders to CSV"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Export CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            title="Print or Save PDF report"
          >
            <Printer className="w-3.5 h-3.5 text-slate-300" />
            <span className="hidden md:inline">Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Change Orders Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Order Ref</th>
                <th className="py-3.5 px-4">Title & Scope</th>
                <th className="py-3.5 px-4">Trade Partner</th>
                <th className="py-3.5 px-4 text-right">Requested</th>
                <th className="py-3.5 px-4 text-right">Approved</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">No Change Orders found matching criteria</p>
                    <p className="text-xs text-slate-600 mt-0.5">Click "Raise Change Order" to submit a new scope variation.</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  return (
                    <tr key={order.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-amber-400">
                        {order.orderNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white max-w-xs sm:max-w-md truncate">{order.title}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-xs sm:max-w-md mt-0.5">
                          {order.justification}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 font-medium">
                        {order.contractorName}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                        ₱{Number(order.requestedAmount).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                        {order.approvedAmount !== null && order.approvedAmount !== undefined
                          ? `₱${Number(order.approvedAmount).toLocaleString()}`
                          : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${
                            order.status === 'APPROVED'
                              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                              : order.status === 'REJECTED'
                              ? 'bg-rose-950/80 text-rose-400 border-rose-800'
                              : 'bg-amber-950/80 text-amber-400 border-amber-800 animate-pulse'
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-medium transition cursor-pointer border border-slate-800"
                            title="View Justification"
                          >
                            Details
                          </button>
                          {isAdmin && order.status === 'PENDING' && (
                            <>
                              {(Number(order.requestedAmount) || 0) >= 1000000 && !isExecutiveAdmin ? (
                                <>
                                  <span 
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30"
                                    title="Variations of ₱1,000,000+ require Corporate Executive (ADMIN / SUPER_ADMIN) authorization"
                                  >
                                    <ShieldAlert className="w-3 h-3 text-amber-400" />
                                    Requires Corporate Executive Sign-Off
                                  </span>
                                  <button
                                    disabled
                                    className="px-2.5 py-1 bg-emerald-950/40 text-emerald-600/50 border border-emerald-900/30 rounded-lg text-xs font-bold cursor-not-allowed opacity-50 flex items-center gap-1"
                                    title="Direct approval locked: Requires Corporate Executive Sign-Off (₱1M+ variation)"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Approve</span>
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleOpenApprove(order, 'APPROVED')}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
                                  title="Approve Variation"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Approve</span>
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenApprove(order, 'REJECTED')}
                                className="px-2.5 py-1 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
                                title="Reject Variation"
                              >
                                <X className="w-3 h-3" />
                                <span>Reject</span>
                              </button>
                            </>
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
      </div>

      {/* Submit Change Order Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 animate-scaleUp">
            <div className="p-6 pb-4 border-b border-slate-800 flex items-center justify-between">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-400" />
                Raise Scope Change Order
              </h4>
              <button
                onClick={() => setShowSubmitModal(false)}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Variation Title</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g., Acoustic Glass Partitions Upgrade for Exec Suites"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Target Project</label>
                  <select
                    value={formProject}
                    onChange={(e) => setFormProject(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Trade Contractor</label>
                  <input
                    type="text"
                    required
                    value={formContractor}
                    onChange={(e) => setFormContractor(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Requested Amount (PHP)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2 text-slate-500 font-mono">₱</span>
                  <input
                    type="number"
                    required
                    min={1000}
                    step={1000}
                    value={formAmount}
                    onChange={(e) => setFormAmount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3.5 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Technical Justification & Impact</label>
                <textarea
                  required
                  rows={3}
                  value={formJustification}
                  onChange={(e) => setFormJustification(e.target.value)}
                  placeholder="Explain why this change order is required (site condition difference, client design revision, or structural enhancement)..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500 leading-relaxed"
                ></textarea>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-md"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Order for Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approve / Reject Modal */}
      {showApproveModal && targetOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              {approvalAction === 'APPROVED' ? 'Authorize Change Order' : 'Decline Change Order'}
            </h4>
            <p className="text-xs text-slate-400">
              Confirm action for <strong className="text-white">{targetOrder.orderNumber}</strong> ({targetOrder.title}).
            </p>

            {approvalAction === 'APPROVED' ? (
              <div className="space-y-2">
                <label className="block text-slate-300 text-xs font-semibold">Approved Budget Commitment (PHP)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-500 font-mono text-xs">₱</span>
                  <input
                    type="number"
                    value={approvedAmountInput}
                    onChange={(e) => setApprovedAmountInput(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-rose-300 bg-rose-950/40 p-3 rounded-xl border border-rose-900/60">
                This variation order will be marked as REJECTED. The trade partner will be instructed to adhere strictly to the original contract scope.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800 text-xs">
              <button
                onClick={() => setShowApproveModal(false)}
                className="px-3 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmApproval}
                className={`px-4 py-2 font-bold rounded-xl cursor-pointer ${
                  approvalAction === 'APPROVED'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-rose-600 hover:bg-rose-500 text-white'
                }`}
              >
                Confirm {approvalAction}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details View Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="p-6 pb-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-amber-400 font-bold">{selectedOrder.orderNumber}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  selectedOrder.status === 'APPROVED' ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-300'
                }`}>
                  {selectedOrder.status}
                </span>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)} 
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Title</span>
                <strong className="text-white text-sm">{selectedOrder.title}</strong>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                <div>
                  <span className="text-slate-500 block text-[11px]">Contractor</span>
                  <span className="text-slate-200 font-medium">{selectedOrder.contractorName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Requested Value</span>
                  <span className="text-amber-300 font-mono font-bold">₱{Number(selectedOrder.requestedAmount).toLocaleString()}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px]">Justification & Scope Details</span>
                <p className="text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800/80 leading-relaxed">
                  {selectedOrder.justification}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
