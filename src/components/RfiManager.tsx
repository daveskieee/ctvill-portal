/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Plus, CheckCircle2, Clock, AlertTriangle, Search,
  ShieldCheck, Building2, FileText, Check, X, Truck,
  Package, ShoppingCart, ClipboardCheck, ArrowRight, Printer
} from 'lucide-react';
import { ProjectRFI, ProjectProfile } from '../types';
import { openEnterprisePrintWindow, escapePrintHtml } from '../utils/printEngine';

interface RfiManagerProps {
  rfis: ProjectRFI[];
  projects?: ProjectProfile[];
  isAdmin?: boolean;
  userRole?: string;
  onSubmitRfi?: (rfi: Partial<ProjectRFI>) => Promise<void> | void;
  onAnswerRfi?: (id: string, answer: string, status?: ProjectRFI['status']) => Promise<void> | void;
}

interface MaterialPurchaseRequest {
  id: string;
  projectName: string;
  materialType: string;
  quantity: number;
  unit: string;
  estimatedCostPhp: number;
  urgency: 'NORMAL' | 'URGENT' | 'CRITICAL';
  requestedBy: string;
  purposePhase: string;
  dateRequested: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'DENIED';
  approvedBy?: string;
  deliveryStatus?: 'Scheduled' | 'Accepted' | 'Delayed';
  supplierName?: string;
  etaDate?: string;
}

const DEFAULT_MATERIAL_CATALOG = [
  'Portland Cement Type 1 (40kg Bags)',
  'Deformed Reinforcing Steel Bars (16mm / 12mm / 10mm)',
  'Concrete Hollow Blocks (CHB 4" & 6")',
  'Phenolic Board Formworks (1/2" & 3/4")',
  'Washed Sand & Crushed Gravel Aggregates (cu.m)',
  'Ready-Mix Concrete (4,000 PSI Pumpcrete)',
  '60x60 Homogeneous Floor Tiles & Tile Adhesive',
  'Gypsum Board & Metal Furring (Ceiling Works)',
  'Marine Plywood & Kiln-Dried Lumber (Carpentry)',
  'Elastomeric & Latex Architectural Paint (Gallons)',
  'THHN Copper Wires & uPVC Electrical Conduits',
  'PPR Cold/Hot Water Pipes & Sanitary PVC Fittings'
];

export default function RfiManager({
  projects = [],
  onSubmitRfi,
  onAnswerRfi
}: RfiManagerProps) {
  const [activeSubTab, setActiveSubTab] = useState<'requests' | 'approvals' | 'deliveries'>('requests');
  const [materialCatalog, setMaterialCatalog] = useState<string[]>(DEFAULT_MATERIAL_CATALOG);
  const [showAddCatalogModal, setShowAddCatalogModal] = useState<boolean>(false);
  const [newCatalogItemName, setNewCatalogItemName] = useState<string>('');

  // Form states for submitting a new Material / Purchase Request
  const [selectedProjectName, setSelectedProjectName] = useState<string>(
    projects[0]?.name || 'Commercial Fit-Out Site'
  );
  const [selectedMaterial, setSelectedMaterial] = useState<string>(DEFAULT_MATERIAL_CATALOG[0]);
  const [quantity, setQuantity] = useState<number>(150);
  const [unit, setUnit] = useState<string>('bags');
  const [estimatedCost, setEstimatedCost] = useState<number>(42000);
  const [urgency, setUrgency] = useState<'NORMAL' | 'URGENT' | 'CRITICAL'>('URGENT');
  const [purposePhase, setPurposePhase] = useState<string>('Concreting Works — Footing & Columns');
  const [supplierName, setSupplierName] = useState<string>('Holcim / Metro Builders Supply');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toastBanner, setToastBanner] = useState<string | null>(null);

  const [requests, setRequests] = useState<MaterialPurchaseRequest[]>([
    {
      id: 'PR-2026-001',
      projectName: projects[0]?.name || 'NexBridge Software Hub',
      materialType: 'Portland Cement Type 1 (40kg Bags)',
      quantity: 250,
      unit: 'bags',
      estimatedCostPhp: 67500,
      urgency: 'URGENT',
      requestedBy: 'Engr. Carlos Mendoza (Site Engineer)',
      purposePhase: 'Concreting Works — Footing & Ground Columns',
      dateRequested: '2026-11-06',
      approvalStatus: 'PENDING',
      supplierName: 'Holcim Philippines Industrial Supply',
      etaDate: '2026-11-11'
    },
    {
      id: 'PR-2026-002',
      projectName: projects[0]?.name || 'NexBridge Software Hub',
      materialType: 'Deformed Reinforcing Steel Bars (16mm / 12mm / 10mm)',
      quantity: 180,
      unit: 'lengths',
      estimatedCostPhp: 94500,
      urgency: 'CRITICAL',
      requestedBy: 'Engr. Carlos Mendoza (Site Engineer)',
      purposePhase: 'Reinforcing Bar — 2nd Floor Beam & Slab Cage',
      dateRequested: '2026-11-07',
      approvalStatus: 'PENDING',
      supplierName: 'Pag-Asa Steel Works Corp.',
      etaDate: '2026-11-12'
    },
    {
      id: 'PR-2026-003',
      projectName: projects[1]?.name || projects[0]?.name || 'Commercial Fit-Out Site',
      materialType: 'Concrete Hollow Blocks (CHB 4" & 6")',
      quantity: 1500,
      unit: 'pcs',
      estimatedCostPhp: 33000,
      urgency: 'NORMAL',
      requestedBy: 'Engr. Ricardo Ramos (Project Manager)',
      purposePhase: 'Masonry Works — Interior Partition Walls',
      dateRequested: '2026-11-04',
      approvalStatus: 'APPROVED',
      approvedBy: 'Engr. Ricardo Ramos (Head Engineer)',
      deliveryStatus: 'Accepted',
      supplierName: 'Luzon Concrete Aggregates Inc.',
      etaDate: '2026-11-07'
    },
    {
      id: 'PR-2026-004',
      projectName: projects[0]?.name || 'NexBridge Software Hub',
      materialType: 'Phenolic Board Formworks (1/2" & 3/4")',
      quantity: 65,
      unit: 'sheets',
      estimatedCostPhp: 55250,
      urgency: 'URGENT',
      requestedBy: 'Engr. Carlos Mendoza (Site Engineer)',
      purposePhase: 'Formworks — Suspended Slab & Beam Soffits',
      dateRequested: '2026-11-05',
      approvalStatus: 'APPROVED',
      approvedBy: 'Engr. Ricardo Ramos (Head Engineer)',
      deliveryStatus: 'Scheduled',
      supplierName: 'CW Home Depot Commercial Pro',
      etaDate: '2026-11-10'
    }
  ]);

  const showToast = (msg: string) => {
    setToastBanner(msg);
    setTimeout(() => setToastBanner(null), 3500);
  };

  const handleAddMaterialToCatalog = () => {
    const clean = newCatalogItemName.trim();
    if (!clean) return;
    if (!materialCatalog.includes(clean)) {
      setMaterialCatalog(prev => [clean, ...prev]);
    }
    setSelectedMaterial(clean);
    setNewCatalogItemName('');
    setShowAddCatalogModal(false);
    showToast(`Added "${clean}" to Material & Request Type catalog.`);
  };

  const handleCreatePurchaseRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const newId = `PR-2026-${String(requests.length + 1).padStart(3, '0')}`;
    const newReq: MaterialPurchaseRequest = {
      id: newId,
      projectName: selectedProjectName,
      materialType: selectedMaterial,
      quantity: Math.max(1, Number(quantity) || 1),
      unit: unit.trim() || 'units',
      estimatedCostPhp: Math.max(0, Number(estimatedCost) || 0),
      urgency,
      requestedBy: 'Engr. Carlos Mendoza (Site Engineer)',
      purposePhase: purposePhase.trim() || 'General Construction Phase',
      dateRequested: new Date().toISOString().split('T')[0],
      approvalStatus: 'PENDING',
      supplierName: supplierName.trim() || 'Approved Vendor',
      etaDate: new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0]
    };

    setRequests(prev => [newReq, ...prev]);
    showToast(`Material Request ${newId} (${selectedMaterial}) submitted to Approvals Inbox.`);

    if (onSubmitRfi) {
      try {
        await onSubmitRfi({
          rfiNumber: newId,
          projectName: selectedProjectName,
          subject: `${selectedMaterial} (${quantity} ${unit})`,
          question: `Material request for ${purposePhase} — Est. ₱${estimatedCost.toLocaleString()}`,
          priority: urgency === 'CRITICAL' ? 'CRITICAL' : urgency === 'URGENT' ? 'HIGH' : 'MEDIUM',
          status: 'OPEN'
        });
      } catch {}
    }
  };

  const handleDecision = async (reqId: string, decision: 'APPROVED' | 'DENIED') => {
    setRequests(prev =>
      prev.map(r =>
        r.id === reqId
          ? {
              ...r,
              approvalStatus: decision,
              approvedBy: 'Engr. Ricardo Ramos (Head Engineer)',
              deliveryStatus: decision === 'APPROVED' ? 'Scheduled' : undefined
            }
          : r
      )
    );
    showToast(
      decision === 'APPROVED'
        ? `Request ${reqId} APPROVED and dispatched to Deliveries Tracker.`
        : `Request ${reqId} marked as DENIED.`
    );
    if (onAnswerRfi) {
      try {
        await onAnswerRfi(reqId, `Procurement ${decision}`, decision === 'APPROVED' ? 'ANSWERED' : 'CLOSED');
      } catch {}
    }
  };

  const handleUpdateDeliveryStatus = (reqId: string, nextStatus: 'Scheduled' | 'Accepted' | 'Delayed') => {
    setRequests(prev =>
      prev.map(r => (r.id === reqId ? { ...r, deliveryStatus: nextStatus } : r))
    );
    showToast(`Delivery ${reqId} status updated to ${nextStatus}.`);
  };

  const pendingApprovals = requests.filter(r => r.approvalStatus === 'PENDING');
  const approvedDeliveries = requests.filter(r => r.approvalStatus === 'APPROVED');
  const filteredRequests = requests.filter(r => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.id.toLowerCase().includes(q) ||
      r.materialType.toLowerCase().includes(q) ||
      r.projectName.toLowerCase().includes(q) ||
      r.purposePhase.toLowerCase().includes(q)
    );
  });

  const handlePrintPurchaseOrderSheet = (targetReq?: MaterialPurchaseRequest) => {
    const itemsToPrint = targetReq ? [targetReq] : filteredRequests;
    if (itemsToPrint.length === 0) return;

    const totalCost = itemsToPrint.reduce((s, r) => s + r.estimatedCostPhp, 0);
    const rowsHtml = itemsToPrint
      .map(
        (req) => `
        <tr>
          <td class="mono font-bold">${escapePrintHtml(req.id)}</td>
          <td><strong>${escapePrintHtml(req.projectName)}</strong></td>
          <td>
            <div><strong>${escapePrintHtml(req.materialType)}</strong></div>
            <div style="font-size: 7.5pt; color: #475569;">Specs / Phase: ${escapePrintHtml(req.purposePhase)} • Supplier: ${escapePrintHtml(req.supplierName || 'Approved Vendor')}</div>
          </td>
          <td class="text-center mono font-bold">${req.quantity} ${escapePrintHtml(req.unit)}</td>
          <td class="text-right mono font-bold">₱${req.estimatedCostPhp.toLocaleString()}</td>
          <td class="text-center">
            <span class="badge ${
              req.urgency === 'CRITICAL'
                ? 'badge-rose'
                : req.urgency === 'URGENT'
                ? 'badge-amber'
                : 'badge-slate'
            }">${escapePrintHtml(req.urgency)}</span>
          </td>
          <td class="text-center">
            <span class="badge ${
              req.approvalStatus === 'APPROVED'
                ? 'badge-emerald'
                : req.approvalStatus === 'DENIED'
                ? 'badge-rose'
                : 'badge-amber'
            }">${escapePrintHtml(req.approvalStatus)}</span>
          </td>
          <td class="text-center">
            <span class="badge ${
              req.deliveryStatus === 'Accepted'
                ? 'badge-emerald'
                : req.deliveryStatus === 'Delayed'
                ? 'badge-rose'
                : 'badge-sky'
            }">${escapePrintHtml(req.deliveryStatus || 'Pending PO')}</span>
          </td>
        </tr>`
      )
      .join('');

    const bodyHtml = `
      <div class="section-title">Material Requisition & Purchase Order Specification Schedule</div>
      <table>
        <thead>
          <tr>
            <th>Requisition ID</th>
            <th>Project Site</th>
            <th>Requested Material Items, Specifications & Supplier</th>
            <th class="text-center">Quantity & Unit</th>
            <th class="text-right">Estimated Cost (₱)</th>
            <th class="text-center">Urgency</th>
            <th class="text-center">Approval Status</th>
            <th class="text-center">Delivery Status</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4" class="text-right">TOTAL ESTIMATED REQUISITION / PO VALUE:</td>
            <td class="text-right mono">₱${totalCost.toLocaleString()}</td>
            <td colspan="3"></td>
          </tr>
        </tfoot>
      </table>
    `;

    openEnterprisePrintWindow({
      title: 'Material Requisition & Purchase Order Sheet',
      subtitle: targetReq
        ? `Official Requisition & Purchase Order Form — ${targetReq.id} (${targetReq.materialType})`
        : 'Consolidated Site Material Requisition & Purchase Order Register',
      docRef: targetReq ? targetReq.id : `PR-PO-REG-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
      orientation: targetReq ? 'portrait' : 'landscape',
      projectMeta: {
        name: targetReq ? targetReq.projectName : selectedProjectName || 'All Active Commercial Sites',
        location: 'Metro Manila Commercial Fit-Out Operations',
        period: targetReq ? `Date Requested: ${targetReq.dateRequested}` : new Date().toLocaleDateString('en-PH'),
        client: targetReq ? `Supplier: ${targetReq.supplierName || 'Approved Vendor'}` : 'Procurement & Logistics Division'
      },
      kpiSummary: [
        { label: 'Requisition Count', value: `${itemsToPrint.length} Item(s)` },
        { label: 'Approved Orders', value: `${itemsToPrint.filter((i) => i.approvalStatus === 'APPROVED').length}` },
        { label: 'Pending Review', value: `${itemsToPrint.filter((i) => i.approvalStatus === 'PENDING').length}` },
        { label: 'Total Estimated Value', value: `₱${totalCost.toLocaleString()}` }
      ],
      bodyHtml,
      signatures: [
        { role: 'Requested By (Site Engineer)', name: 'Engr. Carlos Mendoza', title: 'Site Engineer' },
        { role: 'Reviewed & Approved By (PM / Head Engr)', name: 'Engr. Ricardo Ramos', title: 'Project Manager / Head Engineer' },
        { role: 'Budget & PO Released By (Finance)', name: 'Ma. Theresa Santos, CPA', title: 'Finance & Accounting Lead' }
      ]
    });
  };

  return (
    <div className="space-y-5">
      {toastBanner && (
        <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastBanner}</span>
          </div>
          <button onClick={() => setToastBanner(null)} className="text-xs underline cursor-pointer">Dismiss</button>
        </div>
      )}

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono uppercase">
            <span>Total Requisitions</span>
            <ShoppingCart className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white mt-1">{requests.length} Requests</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{materialCatalog.length} Catalog Material Types</div>
        </div>

        <div
          onClick={() => setActiveSubTab('approvals')}
          className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-xl p-4 cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono uppercase">
            <span>Approvals Inbox</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-400 mt-1">{pendingApprovals.length} Pending</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Awaiting PM / Head Engineer Sign-off</div>
        </div>

        <div
          onClick={() => setActiveSubTab('deliveries')}
          className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-xl p-4 cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono uppercase">
            <span>Active Site Deliveries</span>
            <Truck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-1">{approvedDeliveries.length} Orders</div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {approvedDeliveries.filter(d => d.deliveryStatus === 'Accepted').length} Accepted on Site
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono uppercase">
            <span>Estimated PO Value</span>
            <Package className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white mt-1">
            ₱{requests.reduce((s, r) => s + r.estimatedCostPhp, 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Across active commercial sites</div>
        </div>
      </div>

      {/* Sub-Navigation Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 gap-1">
          <button
            type="button"
            onClick={() => setActiveSubTab('requests')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'requests'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>1. Purchase & Material Requests</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('approvals')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'approvals'
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>2. Approvals Inbox ({pendingApprovals.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('deliveries')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'deliveries'
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>3. Deliveries Tracker ({approvedDeliveries.length})</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter material, PR#, site..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => handlePrintPurchaseOrderSheet()}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" />
            <span>Print PR / PO Form</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: PURCHASE & MATERIAL REQUESTS                                   */}
      {/* ===================================================================== */}
      {activeSubTab === 'requests' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Submit New Material / Purchase Request Form */}
          <div className="lg:col-span-5">
            <form
              onSubmit={handleCreatePurchaseRequest}
              className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 sticky top-6"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Plus className="w-4 h-4 text-amber-400" />
                    Submit Material / Purchase Request
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Site Engineer requisition form routed to PM Approvals Inbox
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Project Site</label>
                <select
                  value={selectedProjectName}
                  onChange={(e) => setSelectedProjectName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-mono uppercase text-slate-400">Material / Request Type *</label>
                  <button
                    type="button"
                    onClick={() => setShowAddCatalogModal(prev => !prev)}
                    className="text-[10px] font-mono font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Add Material / Request Type</span>
                  </button>
                </div>
                <select
                  value={selectedMaterial}
                  onChange={(e) => setSelectedMaterial(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                >
                  {materialCatalog.map(item => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>

                {showAddCatalogModal && (
                  <div className="mt-2 p-2.5 rounded-xl bg-slate-950 border border-amber-500/40 flex items-center gap-2">
                    <input
                      type="text"
                      value={newCatalogItemName}
                      onChange={(e) => setNewCatalogItemName(e.target.value)}
                      placeholder="e.g. Ready-Mix Concrete 5,000 PSI or Scaffolding Set..."
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddMaterialToCatalog}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer shrink-0"
                    >
                      Add Item
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Quantity *</label>
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Unit</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="bags / pcs / cu.m"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Est. Cost (₱)</label>
                  <input
                    type="number"
                    min={0}
                    value={estimatedCost}
                    onChange={(e) => setEstimatedCost(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Urgency Level</label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="NORMAL">Normal (Standard Lead Time)</option>
                    <option value="URGENT">Urgent (Within 48 Hours)</option>
                    <option value="CRITICAL">Critical Path Blocker</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Preferred Supplier</label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Construction Phase & Purpose</label>
                <input
                  type="text"
                  value={purposePhase}
                  onChange={(e) => setPurposePhase(e.target.value)}
                  placeholder="e.g. Concreting Works — Footing Pouring"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer transition shadow-md shadow-amber-500/10"
              >
                Submit Material Requisition
              </button>
            </form>
          </div>

          {/* Right: Active Material Requisitions List */}
          <div className="lg:col-span-7 space-y-3">
            {filteredRequests.map(req => (
              <div
                key={req.id}
                className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-amber-400">
                      {req.id}
                    </span>
                    <span className="text-xs font-semibold text-slate-300">{req.projectName}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                      req.urgency === 'CRITICAL'
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        : req.urgency === 'URGENT'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {req.urgency}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">
                    {req.materialType} — <span className="text-amber-400 font-mono">{req.quantity} {req.unit}</span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    {req.purposePhase} • Est. <span className="font-mono text-white font-semibold">₱{req.estimatedCostPhp.toLocaleString()}</span>
                  </p>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Requested by {req.requestedBy} on {req.dateRequested}
                  </div>
                </div>

                <div className="flex flex-col sm:items-end gap-2 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handlePrintPurchaseOrderSheet(req)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-mono font-semibold flex items-center gap-1 cursor-pointer"
                      title="Print Official PR / PO Sheet"
                    >
                      <Printer className="w-3 h-3 text-amber-400" />
                      <span>Print PR / PO Form</span>
                    </button>
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border ${
                      req.approvalStatus === 'APPROVED'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : req.approvalStatus === 'DENIED'
                        ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                        : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    }`}>
                      {req.approvalStatus}
                    </span>
                  </div>
                  {req.approvalStatus === 'PENDING' && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDecision(req.id, 'APPROVED')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                        <span>Approve</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDecision(req.id, 'DENIED')}
                        className="px-2.5 py-1 rounded-lg bg-rose-950/90 hover:bg-rose-900 text-rose-300 border border-rose-800 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                        <span>Deny</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: APPROVALS INBOX (ONE-CLICK APPROVE / DENY FOR PM & HEAD ENGR)  */}
      {/* ===================================================================== */}
      {activeSubTab === 'approvals' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-emerald-400" />
                Project Manager & Head Engineer Approvals Inbox
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                One-click approval or denial of site material and equipment purchase requisitions
              </p>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold">
              {pendingApprovals.length} Awaiting Decision
            </span>
          </div>

          {pendingApprovals.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-slate-800 rounded-xl">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <div className="text-sm font-bold text-white">All Purchase & Material Requests Reviewed</div>
              <p className="text-xs text-slate-400 mt-1">There are 0 pending requisitions in the Approvals Inbox.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingApprovals.map(req => (
                <div
                  key={req.id}
                  className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-amber-400">{req.id}</span>
                      <span className="text-xs font-semibold text-white">{req.projectName}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        {req.urgency}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-white">
                      {req.materialType} — {req.quantity} {req.unit} (₱{req.estimatedCostPhp.toLocaleString()})
                    </div>
                    <div className="text-xs text-slate-400">
                      Phase: {req.purposePhase} • Supplier: {req.supplierName}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      Submitted by {req.requestedBy} ({req.dateRequested})
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDecision(req.id, 'APPROVED')}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/10"
                    >
                      <Check className="w-4 h-4" />
                      <span>Approve Order</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDecision(req.id, 'DENIED')}
                      className="px-4 py-2 rounded-xl bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      <span>Deny</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: DELIVERIES TRACKER (SCHEDULED / ACCEPTED / DELAYED)            */}
      {/* ===================================================================== */}
      {activeSubTab === 'deliveries' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-cyan-400" />
                Jobsite Material Deliveries Tracker
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time receiving status for approved purchase orders visible to Site Engineers
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
                  <th className="py-3 px-4">PO / PR #</th>
                  <th className="py-3 px-4">Project Site</th>
                  <th className="py-3 px-4">Material & Quantity</th>
                  <th className="py-3 px-3">Supplier & ETA</th>
                  <th className="py-3 px-3">Approved By</th>
                  <th className="py-3 px-3">Delivery Status</th>
                  <th className="py-3 px-4 text-right">Site Receiving Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {approvedDeliveries.map(del => (
                  <tr key={del.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-bold text-cyan-400">{del.id}</td>
                    <td className="py-3 px-4 font-semibold text-white">{del.projectName}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{del.materialType}</div>
                      <div className="text-[11px] font-mono text-amber-400">
                        {del.quantity} {del.unit} • ₱{del.estimatedCostPhp.toLocaleString()}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-slate-200">{del.supplierName}</div>
                      <div className="text-[10px] font-mono text-slate-400">ETA: {del.etaDate || 'Scheduled'}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-300 font-mono text-[11px]">
                      {del.approvedBy || 'Head Engineer'}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold border ${
                        del.deliveryStatus === 'Accepted'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : del.deliveryStatus === 'Delayed'
                          ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          : 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                      }`}>
                        {del.deliveryStatus || 'Scheduled'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleUpdateDeliveryStatus(del.id, 'Scheduled')}
                          className={`px-2 py-1 rounded text-[10px] font-mono cursor-pointer border ${
                            del.deliveryStatus === 'Scheduled'
                              ? 'bg-sky-500 text-slate-950 font-bold border-sky-400'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          Scheduled
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateDeliveryStatus(del.id, 'Accepted')}
                          className={`px-2 py-1 rounded text-[10px] font-mono cursor-pointer border ${
                            del.deliveryStatus === 'Accepted'
                              ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          Accepted
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateDeliveryStatus(del.id, 'Delayed')}
                          className={`px-2 py-1 rounded text-[10px] font-mono cursor-pointer border ${
                            del.deliveryStatus === 'Delayed'
                              ? 'bg-rose-500 text-white font-bold border-rose-400'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          Delayed
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
