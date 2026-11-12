/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Plus, CheckCircle2, Clock, AlertTriangle, Search,
  ShieldCheck, Building2, FileText, Check, X, Truck,
  Package, ShoppingCart, ClipboardCheck, ArrowRight, Printer,
  Layers, Download, Edit2, Trash2, Filter, Sliders, DollarSign, Database,
  Eye, Camera
} from 'lucide-react';
import { ProjectRFI, ProjectProfile } from '../types';
import { normalizeRole, UserRole } from '../utils/rbac';
import { openEnterprisePrintWindow, escapePrintHtml } from '../utils/printEngine';
import { exportToCsv } from '../utils/exportUtils';
import { logAuditEvent } from '../utils/auditLogger';
import { useTheme } from '../context/ThemeContext';

interface RfiManagerProps {
  rfis: ProjectRFI[];
  projects?: ProjectProfile[];
  isAdmin?: boolean;
  userRole?: string;
  onSubmitRfi?: (rfi: Partial<ProjectRFI>) => Promise<void> | void;
  onAnswerRfi?: (id: string, answer: string, status?: ProjectRFI['status']) => Promise<void> | void;
}

export const STANDARD_UNITS = [
  'bags', 'pcs', 'cu.m.', 'sq.m.', 'kg', 'sheets', 'lengths', 'lot', 'gallons', 'rolls', 'sets', 'drums'
] as const;

export const MATERIAL_CATEGORIES = [
  'Structural', 'Masonry', 'Formworks', 'Finishes', 'Electrical', 'Plumbing', 'Carpentry', 'General'
] as const;

export interface MaterialLedgerItem {
  id: string;
  projectName: string;
  week: string; // e.g. 'Week 1', 'Week 2'
  date: string;
  materialDescription: string;
  category: 'Structural' | 'Masonry' | 'Formworks' | 'Finishes' | 'Electrical' | 'Plumbing' | 'Carpentry' | 'General';
  ordered: number;
  unit: string;
  received: number;
  used: number; // Used / Issued
  supplier: string;
  unitCostPhp: number;
  notes?: string;
}

export const DEFAULT_MATERIAL_DIRECTORY: MaterialLedgerItem[] = [
  {
    id: 'MAT-DIR-001',
    projectName: 'LDM Prime Residential Build',
    week: 'Week 1',
    date: '2026-11-01',
    materialDescription: 'Portland Cement Type 1 (40kg)',
    category: 'Structural',
    ordered: 500,
    unit: 'bags',
    received: 350,
    used: 280,
    supplier: 'Holcim Philippines Industrial',
    unitCostPhp: 270,
    notes: 'Footings & columns concrete mix'
  },
  {
    id: 'MAT-DIR-002',
    projectName: 'LDM Prime Residential Build',
    week: 'Week 1',
    date: '2026-11-02',
    materialDescription: 'Deformed Reinforcing Steel Bars 16mm x 6m',
    category: 'Structural',
    ordered: 200,
    unit: 'lengths',
    received: 200,
    used: 160,
    supplier: 'Pag-Asa Steel Works',
    unitCostPhp: 520,
    notes: 'Column & footing rebar cages completed'
  },
  {
    id: 'MAT-DIR-003',
    projectName: 'LDM Prime Residential Build',
    week: 'Week 2',
    date: '2026-11-05',
    materialDescription: 'Concrete Hollow Blocks (CHB 6" Load Bearing)',
    category: 'Masonry',
    ordered: 2000,
    unit: 'pcs',
    received: 1200,
    used: 800,
    supplier: 'Luzon Concrete Aggregates Inc.',
    unitCostPhp: 22,
    notes: 'Perimeter and ground exterior walls'
  },
  {
    id: 'MAT-DIR-004',
    projectName: 'LDM Prime Residential Build',
    week: 'Week 2',
    date: '2026-11-06',
    materialDescription: 'Phenolic Board 3/4" Film Faced Formwork',
    category: 'Formworks',
    ordered: 80,
    unit: 'sheets',
    received: 80,
    used: 65,
    supplier: 'CW Home Depot Commercial Pro',
    unitCostPhp: 850,
    notes: '2nd floor suspended slab formworks'
  },
  {
    id: 'MAT-DIR-005',
    projectName: 'LDM Prime Residential Build',
    week: 'Week 3',
    date: '2026-11-08',
    materialDescription: 'Washed River Sand (Fine Aggregates)',
    category: 'Structural',
    ordered: 30,
    unit: 'cu.m.',
    received: 20,
    used: 15,
    supplier: 'Metro Aggregates & Hauling',
    unitCostPhp: 1200,
    notes: 'Mortar batching and concrete works'
  },
  {
    id: 'MAT-DIR-006',
    projectName: 'LDM Prime Residential Build',
    week: 'Week 3',
    date: '2026-11-09',
    materialDescription: 'PPR Hot & Cold Water Pipes 1/2"',
    category: 'Plumbing',
    ordered: 45,
    unit: 'lengths',
    received: 45,
    used: 30,
    supplier: 'Vesbo Piping Solutions',
    unitCostPhp: 380,
    notes: 'Ground & 2nd floor roughing-in'
  }
];

function guessMaterialCategory(desc: string, phase: string): MaterialLedgerItem['category'] {
  const text = `${desc} ${phase}`.toLowerCase();
  if (text.includes('cement') || text.includes('rebar') || text.includes('steel') || text.includes('gravel') || text.includes('sand') || text.includes('concrete')) return 'Structural';
  if (text.includes('chb') || text.includes('block') || text.includes('masonry') || text.includes('plaster')) return 'Masonry';
  if (text.includes('phenolic') || text.includes('formwork') || text.includes('scaffold') || text.includes('plywood')) return 'Formworks';
  if (text.includes('tile') || text.includes('paint') || text.includes('finishing') || text.includes('ceiling') || text.includes('gypsum')) return 'Finishes';
  if (text.includes('wire') || text.includes('cable') || text.includes('conduit') || text.includes('breaker') || text.includes('electric')) return 'Electrical';
  if (text.includes('pipe') || text.includes('plumb') || text.includes('fitting') || text.includes('sanitary') || text.includes('valve')) return 'Plumbing';
  if (text.includes('lumber') || text.includes('wood') || text.includes('cabinet') || text.includes('carpentry') || text.includes('door')) return 'Carpentry';
  return 'General';
}

interface MaterialPurchaseRequest {
  id: string;
  projectName: string;
  materialType: string;
  quantity: number;
  unit: string;
  unitCostPhp?: number;
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
  actualReceivedQty?: number;
  receivedAt?: string;
  receivedBy?: string;
  receivingProofPhoto?: string;
  receivingRemarks?: string;
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
  isAdmin = false,
  userRole,
  onSubmitRfi,
  onAnswerRfi
}: RfiManagerProps) {
  const { isDark } = useTheme();
  const currentRole = normalizeRole(userRole);
  const isOM = currentRole === UserRole.OM || isAdmin;
  const isPM = currentRole === UserRole.PM;

  const [activeSubTab, setActiveSubTab] = useState<'requests' | 'directory' | 'approvals' | 'deliveries'>('requests');
  const [materialCatalog, setMaterialCatalog] = useState<string[]>(DEFAULT_MATERIAL_CATALOG);
  const [showAddCatalogModal, setShowAddCatalogModal] = useState<boolean>(false);
  const [newCatalogItemName, setNewCatalogItemName] = useState<string>('');

  // PM Receiving Modal State
  const [receivingModalItem, setReceivingModalItem] = useState<MaterialPurchaseRequest | null>(null);
  const [actualReceivedQty, setActualReceivedQty] = useState<number>(0);
  const [receivingProofPhoto, setReceivingProofPhoto] = useState<string>('');
  const [receivingRemarks, setReceivingRemarks] = useState<string>('');
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState<string | null>(null);

  // Form states for submitting a new Material / Purchase Request
  const [selectedProjectName, setSelectedProjectName] = useState<string>(
    projects[0]?.name || 'LDM Prime Residential Build'
  );
  const [selectedMaterial, setSelectedMaterial] = useState<string>(DEFAULT_MATERIAL_CATALOG[0]);
  const [quantity, setQuantity] = useState<number>(150);
  const [unit, setUnit] = useState<string>('bags');
  const [unitCost, setUnitCost] = useState<number>(270);
  const [urgency, setUrgency] = useState<'NORMAL' | 'URGENT' | 'CRITICAL'>('URGENT');
  const [purposePhase, setPurposePhase] = useState<string>('Concreting Works — Footing & Columns');
  const [supplierName, setSupplierName] = useState<string>('Holcim Philippines Industrial Supply');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toastBanner, setToastBanner] = useState<string | null>(null);

  // Material Directory Ledger State & Filters
  const [materialLedger, setMaterialLedger] = useState<MaterialLedgerItem[]>(() => {
    try {
      const raw = localStorage.getItem('ldm_material_directory') || localStorage.getItem('ctvill_material_directory');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_MATERIAL_DIRECTORY;
  });
  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState<string>('ALL');
  const [ledgerWeekFilter, setLedgerWeekFilter] = useState<string>('ALL');
  const [ledgerSearch, setLedgerSearch] = useState<string>('');

  // Add Item to Directory Modal State
  const [showAddDirectoryModal, setShowAddDirectoryModal] = useState<boolean>(false);
  const [newMatDesc, setNewMatDesc] = useState<string>('');
  const [newMatCategory, setNewMatCategory] = useState<MaterialLedgerItem['category']>('Structural');
  const [newMatWeek, setNewMatWeek] = useState<string>('Week 1');
  const [newMatOrdered, setNewMatOrdered] = useState<number>(100);
  const [newMatUnit, setNewMatUnit] = useState<string>('bags');
  const [newMatReceived, setNewMatReceived] = useState<number>(0);
  const [newMatUsed, setNewMatUsed] = useState<number>(0);
  const [newMatSupplier, setNewMatSupplier] = useState<string>('Holcim Philippines Industrial');
  const [newMatUnitCost, setNewMatUnitCost] = useState<number>(270);
  const [newMatNotes, setNewMatNotes] = useState<string>('');

  const [requests, setRequests] = useState<MaterialPurchaseRequest[]>([
    {
      id: 'PR-2026-001',
      projectName: projects[0]?.name || 'LDM Prime Residential Build',
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
      projectName: projects[0]?.name || 'LDM Prime Residential Build',
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
      projectName: projects[1]?.name || projects[0]?.name || 'LDM Prime Residential Build',
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
      projectName: projects[0]?.name || 'LDM Prime Residential Build',
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
    const cleanQty = Math.max(1, Number(quantity) || 1);
    const cleanUnitCost = Math.max(0, Number(unitCost) || 0);
    const totalEst = cleanQty * cleanUnitCost;
    const newId = `PR-2026-${String(requests.length + 1).padStart(3, '0')}`;
    const newReq: MaterialPurchaseRequest = {
      id: newId,
      projectName: selectedProjectName,
      materialType: selectedMaterial,
      quantity: cleanQty,
      unit: unit.trim() || 'bags',
      unitCostPhp: cleanUnitCost,
      estimatedCostPhp: totalEst,
      urgency,
      requestedBy: 'Engr. Carlos Mendoza (Site Engineer)',
      purposePhase: purposePhase.trim() || 'General Construction Phase',
      dateRequested: new Date().toISOString().split('T')[0],
      approvalStatus: 'PENDING',
      supplierName: supplierName.trim() || 'Holcim Philippines Industrial Supply',
      etaDate: new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0]
    };

    setRequests(prev => [newReq, ...prev]);
    showToast(`Material Request ${newId} (${cleanQty} ${unit} × ₱${cleanUnitCost.toLocaleString()} = ₱${totalEst.toLocaleString()}) submitted to Approvals Inbox.`);

    if (onSubmitRfi) {
      try {
        await onSubmitRfi({
          rfiNumber: newId,
          projectName: selectedProjectName,
          subject: `${selectedMaterial} (${cleanQty} ${unit})`,
          question: `Material request for ${purposePhase} — ₱${cleanUnitCost.toLocaleString()}/${unit} (Total: ₱${totalEst.toLocaleString()})`,
          priority: urgency === 'CRITICAL' ? 'CRITICAL' : urgency === 'URGENT' ? 'HIGH' : 'MEDIUM',
          status: 'OPEN'
        });
      } catch {}
    }
  };

  const persistMaterialLedger = (items: MaterialLedgerItem[]) => {
    try {
      localStorage.setItem('ldm_material_directory', JSON.stringify(items));
      localStorage.setItem('ctvill_material_directory', JSON.stringify(items));
    } catch {}
  };

  const handleDecision = async (reqId: string, decision: 'APPROVED' | 'DENIED') => {
    let approvedTarget: MaterialPurchaseRequest | undefined;
    setRequests(prev =>
      prev.map(r => {
        if (r.id === reqId) {
          approvedTarget = r;
          return {
            ...r,
            approvalStatus: decision,
            approvedBy: 'Engr. Ricardo Ramos (Head Engineer)',
            deliveryStatus: decision === 'APPROVED' ? 'Scheduled' : undefined
          };
        }
        return r;
      })
    );

    // If APPROVED, automatically sync into the Material Directory ledger!
    if (decision === 'APPROVED' && approvedTarget) {
      const uCost = (approvedTarget as MaterialPurchaseRequest).unitCostPhp || Math.round((approvedTarget as MaterialPurchaseRequest).estimatedCostPhp / ((approvedTarget as MaterialPurchaseRequest).quantity || 1)) || 270;
      const newLedgerItem: MaterialLedgerItem = {
        id: `MAT-DIR-${Date.now().toString().slice(-4)}`,
        projectName: (approvedTarget as MaterialPurchaseRequest).projectName,
        week: 'Week 1',
        date: new Date().toISOString().split('T')[0],
        materialDescription: (approvedTarget as MaterialPurchaseRequest).materialType,
        category: guessMaterialCategory((approvedTarget as MaterialPurchaseRequest).materialType, (approvedTarget as MaterialPurchaseRequest).purposePhase),
        ordered: (approvedTarget as MaterialPurchaseRequest).quantity,
        unit: (approvedTarget as MaterialPurchaseRequest).unit,
        received: 0,
        used: 0,
        supplier: (approvedTarget as MaterialPurchaseRequest).supplierName || 'Approved Supplier',
        unitCostPhp: uCost,
        notes: `PO from requisition ${(approvedTarget as MaterialPurchaseRequest).id} (${(approvedTarget as MaterialPurchaseRequest).purposePhase})`
      };
      setMaterialLedger(prev => {
        const next = [newLedgerItem, ...prev];
        persistMaterialLedger(next);
        return next;
      });
    }

    showToast(
      decision === 'APPROVED'
        ? `Request ${reqId} APPROVED, synced into Material Directory Ledger & Deliveries Tracker.`
        : `Request ${reqId} marked as DENIED.`
    );
    if (onAnswerRfi) {
      try {
        await onAnswerRfi(reqId, `Procurement ${decision}`, decision === 'APPROVED' ? 'ANSWERED' : 'CLOSED');
      } catch {}
    }
  };

  const handleUpdateLedgerReceived = (id: string, newReceived: number) => {
    const clamped = Math.max(0, newReceived);
    setMaterialLedger(prev => {
      const next = prev.map(item => item.id === id ? { ...item, received: clamped } : item);
      persistMaterialLedger(next);
      return next;
    });
  };

  const handleUpdateLedgerUsed = (id: string, newUsed: number) => {
    const clamped = Math.max(0, newUsed);
    setMaterialLedger(prev => {
      const next = prev.map(item => item.id === id ? { ...item, used: clamped } : item);
      persistMaterialLedger(next);
      return next;
    });
  };

  const handleDeleteLedgerItem = (id: string) => {
    setMaterialLedger(prev => {
      const next = prev.filter(item => item.id !== id);
      persistMaterialLedger(next);
      return next;
    });
    showToast('Material item deleted from directory.');
  };

  const handleAddDirectLedgerItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatDesc.trim()) return;
    const newItem: MaterialLedgerItem = {
      id: `MAT-DIR-${Date.now().toString().slice(-4)}`,
      projectName: selectedProjectName,
      week: newMatWeek,
      date: new Date().toISOString().split('T')[0],
      materialDescription: newMatDesc.trim(),
      category: newMatCategory,
      ordered: Math.max(1, Number(newMatOrdered) || 1),
      unit: newMatUnit,
      received: Math.max(0, Number(newMatReceived) || 0),
      used: Math.max(0, Number(newMatUsed) || 0),
      supplier: newMatSupplier.trim() || 'Approved Builders Supply',
      unitCostPhp: Math.max(0, Number(newMatUnitCost) || 0),
      notes: newMatNotes.trim()
    };
    setMaterialLedger(prev => {
      const next = [newItem, ...prev];
      persistMaterialLedger(next);
      return next;
    });
    setShowAddDirectoryModal(false);
    setNewMatDesc('');
    showToast(`Added "${newItem.materialDescription}" to Material Directory.`);
  };

  const handleExportLedgerCsv = () => {
    const headers = [
      'Week', 'Date', 'Material Description', 'Category', 'Project Site',
      'Ordered', 'Unit', 'Received', 'Used / Issued', 'Remaining Stock',
      'Balance Order', 'Delivery Status', 'Supplier', 'Unit Cost (PHP)', 'Stock Value (PHP)'
    ];
    const rows = filteredLedger.map(item => {
      const remaining = Math.max(0, item.received - item.used);
      const balance = Math.max(0, item.ordered - item.received);
      const status = balance <= 0 ? 'Completed' : 'Incomplete';
      const stockVal = remaining * item.unitCostPhp;
      return [
        item.week,
        item.date,
        item.materialDescription,
        item.category,
        item.projectName,
        item.ordered,
        item.unit,
        item.received,
        item.used,
        remaining,
        balance,
        status,
        item.supplier,
        item.unitCostPhp,
        stockVal
      ];
    });
    exportToCsv('LDM_Site_Material_Directory_Ledger', headers, rows);
  };

  const handlePrintLedgerSheet = () => {
    const totalInventoryValue = filteredLedger.reduce((sum, item) => {
      const remaining = Math.max(0, item.received - item.used);
      return sum + (remaining * item.unitCostPhp);
    }, 0);

    const rowsHtml = filteredLedger.map(item => {
      const remaining = Math.max(0, item.received - item.used);
      const balance = Math.max(0, item.ordered - item.received);
      const isComplete = balance <= 0;
      const stockVal = remaining * item.unitCostPhp;
      return `
        <tr>
          <td class="mono font-bold">${escapePrintHtml(item.week)}</td>
          <td>${escapePrintHtml(item.date)}</td>
          <td>
            <strong>${escapePrintHtml(item.materialDescription)}</strong>
            <div style="font-size: 7.5pt; color: #64748b;">${escapePrintHtml(item.projectName)} • ${escapePrintHtml(item.category)}</div>
          </td>
          <td class="text-right mono font-bold">${item.ordered} ${escapePrintHtml(item.unit)}</td>
          <td class="text-right mono font-bold" style="color: #059669;">${item.received}</td>
          <td class="text-right mono font-bold" style="color: #d97706;">${item.used}</td>
          <td class="text-right mono font-bold" style="background: #f1f5f9;">${remaining}</td>
          <td class="text-right mono font-bold" style="color: ${isComplete ? '#059669' : '#dc2626'};">${balance}</td>
          <td class="text-center">
            <span class="badge ${isComplete ? 'badge-emerald' : 'badge-amber'}">${isComplete ? 'Completed' : 'Incomplete'}</span>
          </td>
          <td>${escapePrintHtml(item.supplier)}</td>
          <td class="text-right mono">₱${item.unitCostPhp.toLocaleString()}</td>
          <td class="text-right mono font-bold">₱${stockVal.toLocaleString()}</td>
        </tr>
      `;
    }).join('');

    const bodyHtml = `
      <div class="section-title">Site Material Directory & Inventory Delivery Tracking Ledger</div>
      <div style="margin-bottom: 12px; font-size: 8.5pt; color: #475569;">
        Total On-Site Stock Value: <strong style="color: #0f172a; font-size: 10pt;">₱${totalInventoryValue.toLocaleString()}</strong> • Active Tracked Materials: <strong>${filteredLedger.length}</strong>
      </div>
      <table>
        <thead>
          <tr>
            <th>Week</th>
            <th>Date</th>
            <th>Material Description</th>
            <th class="text-right">Ordered</th>
            <th class="text-right">Received</th>
            <th class="text-right">Used / Issued</th>
            <th class="text-right">Remaining Stock</th>
            <th class="text-right">Balance Order</th>
            <th class="text-center">Status</th>
            <th>Supplier</th>
            <th class="text-right">Unit Cost</th>
            <th class="text-right">Stock Value</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;

    openEnterprisePrintWindow({
      title: 'LDM Site Material Directory Ledger',
      subtitle: 'Official Site Inventory & Delivery Tracking Register',
      projectMeta: {
        name: selectedProjectName,
        location: 'Commercial Jobsite Ledger'
      },
      bodyHtml
    });
  };

  const handleUpdateDeliveryStatus = (reqId: string, nextStatus: 'Scheduled' | 'Accepted' | 'Delayed') => {
    setRequests(prev =>
      prev.map(r => (r.id === reqId ? { ...r, deliveryStatus: nextStatus } : r))
    );
    showToast(`Delivery ${reqId} status updated to ${nextStatus}.`);
  };

  const handleOpenReceiveModal = (del: MaterialPurchaseRequest) => {
    setReceivingModalItem(del);
    setActualReceivedQty(del.quantity);
    setReceivingProofPhoto(del.receivingProofPhoto || '');
    setReceivingRemarks(del.receivingRemarks || 'Materials verified and received in good condition at project site.');
  };

  const handleConfirmReceive = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingModalItem) return;

    const receivedCount = Math.max(0, Number(actualReceivedQty) || 0);

    // 1. Update requests status to Accepted with receiving metadata
    setRequests(prev => {
      const next = prev.map(req => {
        if (req.id === receivingModalItem.id) {
          return {
            ...req,
            deliveryStatus: 'Accepted' as const,
            actualReceivedQty: receivedCount,
            receivedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            receivedBy: 'Site Engineer (PM)',
            receivingProofPhoto: receivingProofPhoto || 'https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?w=600&auto=format&fit=crop&q=80',
            receivingRemarks: receivingRemarks.trim() || 'Verified on site'
          };
        }
        return req;
      });
      localStorage.setItem('ctvill_purchase_requests', JSON.stringify(next));
      return next;
    });

    // 2. Synchronize and update Material Directory ledger (Received, Remaining Stock, Balance Order)
    setMaterialLedger(prev => {
      let matched = false;
      const next = prev.map(item => {
        const itemDesc = item.materialDescription.toLowerCase();
        const reqDesc = receivingModalItem.materialType.toLowerCase();
        if (
          (item.id === receivingModalItem.id || itemDesc.includes(reqDesc) || reqDesc.includes(itemDesc)) &&
          item.projectName === receivingModalItem.projectName
        ) {
          matched = true;
          return {
            ...item,
            received: item.received + receivedCount
          };
        }
        return item;
      });

      if (!matched) {
        const newItem: MaterialLedgerItem = {
          id: `MAT-${Date.now().toString().slice(-4)}`,
          projectName: receivingModalItem.projectName,
          week: 'Week 1',
          date: new Date().toISOString().split('T')[0],
          materialDescription: receivingModalItem.materialType,
          category: guessMaterialCategory(receivingModalItem.materialType, receivingModalItem.purposePhase),
          ordered: receivingModalItem.quantity,
          unit: receivingModalItem.unit,
          received: receivedCount,
          used: 0,
          supplier: receivingModalItem.supplierName || 'Primary Supplier',
          unitCostPhp: receivingModalItem.unitCostPhp || 300,
          notes: `Site Delivery received: ${receivingRemarks || 'Verified on site'}`
        };
        next.push(newItem);
      }

      localStorage.setItem('ldm_material_directory', JSON.stringify(next));
      return next;
    });

    showToast(`Delivery received! Logged ${receivedCount} ${receivingModalItem.unit} into site inventory ledger.`);

    logAuditEvent({
      entityType: 'CIVIL_WORKS',
      entityId: receivingModalItem.id,
      action: 'DELIVERY_ACCEPTED',
      actorName: 'Engr. Ricardo Gomez',
      actorRole: 'Project Manager / Site Engineer',
      details: `Material Delivery Acceptance: Received ${receivedCount} ${receivingModalItem.unit} of ${receivingModalItem.materialType} on ${receivingModalItem.projectName}. Signed delivery receipt and inspection remarks logged.`
    });

    setReceivingModalItem(null);
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

  const filteredLedger = materialLedger.filter(item => {
    if (ledgerCategoryFilter !== 'ALL' && item.category !== ledgerCategoryFilter) return false;
    if (ledgerWeekFilter !== 'ALL' && item.week !== ledgerWeekFilter) return false;
    if (ledgerSearch.trim()) {
      const q = ledgerSearch.toLowerCase();
      return (
        item.materialDescription.toLowerCase().includes(q) ||
        item.supplier.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.projectName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalLedgerStockValue = materialLedger.reduce((sum, item) => {
    const remaining = Math.max(0, item.received - item.used);
    return sum + (remaining * item.unitCostPhp);
  }, 0);
  const totalIncompleteDeliveries = materialLedger.filter(item => item.received < item.ordered).length;

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
        <div
          onClick={() => setActiveSubTab('requests')}
          className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-xl p-4 cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono uppercase">
            <span>Requisitions Queue</span>
            <ShoppingCart className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white mt-1">{requests.length} Requests</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{materialCatalog.length} Catalog Types • ₱{requests.reduce((s, r) => s + r.estimatedCostPhp, 0).toLocaleString()}</div>
        </div>

        <div
          onClick={() => setActiveSubTab('directory')}
          className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-xl p-4 cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono uppercase">
            <span>Site Material Stock Value</span>
            <Database className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-400 mt-1">₱{totalLedgerStockValue.toLocaleString()}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{materialLedger.length} Tracked Material Directory Items</div>
        </div>

        <div
          onClick={() => setActiveSubTab('directory')}
          className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-rose-500/40 rounded-xl p-4 cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono uppercase">
            <span>Incomplete Deliveries</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl font-bold font-mono text-rose-400 mt-1">{totalIncompleteDeliveries} Items Pending</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Balance order remaining on site</div>
        </div>

        <div
          onClick={() => setActiveSubTab('approvals')}
          className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-xl p-4 cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono uppercase">
            <span>Approvals &amp; Deliveries</span>
            <ClipboardCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-1">{pendingApprovals.length} Pending Approval</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{approvedDeliveries.length} Dispatched to Site Deliveries</div>
        </div>
      </div>

      {/* Sub-Navigation Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 gap-1 overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setActiveSubTab('requests')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeSubTab === 'requests'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>1. Purchase Requisitions</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('directory')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeSubTab === 'directory'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>2. Material Directory Ledger ({materialLedger.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('approvals')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeSubTab === 'approvals'
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>3. Approvals Inbox ({pendingApprovals.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('deliveries')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeSubTab === 'deliveries'
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>4. Deliveries Tracker ({approvedDeliveries.length})</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {activeSubTab === 'directory' ? (
            <>
              <div className="relative flex-1 sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  placeholder="Search directory material, supplier..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowAddDirectoryModal(true)}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Material</span>
              </button>
              <button
                type="button"
                onClick={handleExportLedgerCsv}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={handlePrintLedgerSheet}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Printer className="w-3.5 h-3.5 text-amber-400" />
                <span>Print Ledger</span>
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: PURCHASE & MATERIAL REQUESTS                                   */}
      {/* ===================================================================== */}
      {activeSubTab === 'requests' && (
        <div className="space-y-4">
          {isOM && (
            <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span><strong>Operations Manager View:</strong> Site requisitions submitted by Field Project Managers. Review pending orders in the Approvals Inbox tab.</span>
              </div>
              <span className="text-[10px] font-mono uppercase bg-slate-800 px-2 py-0.5 rounded text-slate-400">View-Only</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Submit New Material / Purchase Request Form (PM / Site Engineer ONLY) */}
            {!isOM && (
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
                        Site Engineer requisition form routed to OM Approvals Inbox
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Unit *</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-mono text-white focus:border-amber-500 focus:outline-none cursor-pointer"
                  >
                    {STANDARD_UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Unit Cost (₱) *</label>
                  <input
                    type="number"
                    min={0}
                    value={unitCost}
                    onChange={(e) => setUnitCost(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Auto-Calculated Total Estimated Cost Badge */}
              <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/30 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Total Estimated Requisition Cost</span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {quantity.toLocaleString()} {unit} × ₱{unitCost.toLocaleString()}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold font-mono text-amber-400">
                    ₱{(quantity * unitCost).toLocaleString()}
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    AUTO-CALCULATED
                  </span>
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
        )}

          {/* Right: Active Material Requisitions List */}
          <div className={`${isOM ? 'lg:col-span-12' : 'lg:col-span-7'} space-y-3`}>
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
                    isOM ? (
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
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-[10px]">
                        Awaiting OM Approval
                      </span>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}

      {/* ===================================================================== */}
      {/* TAB 2: MATERIAL DIRECTORY (SITE INVENTORY & DELIVERY TRACKING LEDGER) */}
      {/* ===================================================================== */}
      {activeSubTab === 'directory' && (
        <div className="space-y-4">
          {/* Category Filter Pills & Week Dropdown */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto py-1">
              <span className="text-[10px] font-mono uppercase text-slate-500 font-bold mr-1 shrink-0">Category:</span>
              {['ALL', ...MATERIAL_CATEGORIES].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setLedgerCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer shrink-0 ${
                    ledgerCategoryFilter === cat
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <span className="text-[10px] font-mono uppercase text-slate-500 font-bold">Week:</span>
              <select
                value={ledgerWeekFilter}
                onChange={(e) => setLedgerWeekFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono text-white focus:border-amber-500 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Weeks</option>
                {Array.from(new Set(materialLedger.map(m => m.week))).sort().map(w => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Ledger Table Container */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-amber-400" />
                  Site Material Directory &amp; Delivery Tracking Ledger
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Engineering site ledger for ordered materials, jobsite receiving, issuance, remaining stock balance, and live stock valuation.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddDirectoryModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer flex items-center gap-1.5 shadow-xs transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Material Item</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportLedgerCsv}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintLedgerSheet}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-400" />
                  <span>Print Ledger</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
                    <th className="py-3 px-3">Week</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-4">Material Description</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3 text-right">Ordered</th>
                    <th className="py-3 px-2 text-center">Unit</th>
                    <th className="py-3 px-3 text-right text-emerald-400">Received</th>
                    <th className="py-3 px-3 text-right text-amber-400">Used / Issued</th>
                    <th className="py-3 px-3 text-right text-white">Remaining Stock</th>
                    <th className="py-3 px-3 text-right">Balance Order</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3">Supplier</th>
                    <th className="py-3 px-3 text-right">Unit Cost</th>
                    <th className="py-3 px-4 text-right">Stock Value</th>
                    <th className="py-3 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {filteredLedger.length === 0 ? (
                    <tr>
                      <td colSpan={15} className="py-10 text-center text-slate-500 font-mono">
                        No materials match the selected filters. Click "+ Add Material Item" to record materials.
                      </td>
                    </tr>
                  ) : (
                    filteredLedger.map((item) => {
                      const remaining = Math.max(0, item.received - item.used);
                      const balance = Math.max(0, item.ordered - item.received);
                      const isComplete = balance <= 0;
                      const stockVal = remaining * item.unitCostPhp;

                      return (
                        <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-3 font-mono font-bold text-amber-400">{item.week}</td>
                          <td className="py-3 px-3 font-mono text-slate-300">{item.date}</td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-white">{item.materialDescription}</div>
                            {item.notes && <div className="text-[10px] text-slate-400">{item.notes}</div>}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                              {item.category}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-200">
                            {item.ordered.toLocaleString()}
                          </td>
                          <td className="py-3 px-2 text-center font-mono text-slate-400">{item.unit}</td>

                          {/* Received Input */}
                          <td className="py-3 px-3 text-right">
                            <input
                              type="number"
                              min={0}
                              value={item.received}
                              onChange={(e) => handleUpdateLedgerReceived(item.id, parseInt(e.target.value, 10) || 0)}
                              className="w-16 bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded px-1.5 py-0.5 text-right font-mono text-xs font-bold text-emerald-400 focus:outline-none"
                              title="Update quantity received on jobsite"
                            />
                          </td>

                          {/* Used / Issued Input */}
                          <td className="py-3 px-3 text-right">
                            <input
                              type="number"
                              min={0}
                              value={item.used}
                              onChange={(e) => handleUpdateLedgerUsed(item.id, parseInt(e.target.value, 10) || 0)}
                              className="w-16 bg-slate-950 border border-slate-700 focus:border-amber-500 rounded px-1.5 py-0.5 text-right font-mono text-xs font-bold text-amber-400 focus:outline-none"
                              title="Update quantity issued to trades"
                            />
                          </td>

                          {/* Remaining Stock = Received - Used */}
                          <td className="py-3 px-3 text-right font-mono font-bold text-white bg-slate-950/40">
                            {remaining.toLocaleString()}
                          </td>

                          {/* Balance Order = Ordered - Received */}
                          <td className={`py-3 px-3 text-right font-mono font-bold ${isComplete ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {balance.toLocaleString()}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${
                              isComplete
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                            }`}>
                              {isComplete ? 'Completed' : 'Incomplete'}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-slate-300 truncate max-w-xs">{item.supplier}</td>
                          <td className="py-3 px-3 text-right font-mono text-slate-400">
                            ₱{item.unitCostPhp.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-amber-300">
                            ₱{stockVal.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteLedgerItem(item.id)}
                              className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 cursor-pointer transition-colors"
                              title="Delete ledger item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
                Operations Manager Approvals Inbox
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isOM
                  ? 'One-click approval or denial of site material and equipment purchase requisitions'
                  : 'Requisitions awaiting Operations Manager authorization (View-Only)'}
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
                    {isOM ? (
                      <>
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
                      </>
                    ) : (
                      <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-semibold flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Awaiting OM Approval (View-Only)</span>
                      </div>
                    )}
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
                      {isPM ? (
                        del.deliveryStatus === 'Accepted' ? (
                          <div className="inline-flex items-center gap-2 justify-end">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono text-[11px] font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Received ({del.actualReceivedQty || del.quantity} {del.unit})
                            </span>
                            {del.receivingProofPhoto && (
                              <button
                                type="button"
                                onClick={() => setViewingPhotoUrl(del.receivingProofPhoto || null)}
                                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
                                title="View Receipt Photo"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenReceiveModal(del)}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/10"
                          >
                            <Package className="w-3.5 h-3.5" />
                            <span>Receive</span>
                          </button>
                        )
                      ) : (
                        <div className="inline-flex items-center gap-2 justify-end">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
                            del.deliveryStatus === 'Accepted'
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {del.deliveryStatus === 'Accepted' ? `Received (${del.actualReceivedQty || del.quantity} ${del.unit})` : 'In Transit / Scheduled'}
                          </span>
                          {del.receivingProofPhoto && (
                            <button
                              type="button"
                              onClick={() => setViewingPhotoUrl(del.receivingProofPhoto || null)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
                              title="View Proof of Receipt"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: ADD MATERIAL ITEM DIRECTLY TO DIRECTORY LEDGER                 */}
      {/* ===================================================================== */}
      {showAddDirectoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Plus className="w-4 h-4 text-amber-400" />
                  Add Material to Site Directory Ledger
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Record materials delivered or allocated to {selectedProjectName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddDirectoryModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDirectLedgerItem} className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Material Description *
                </label>
                <input
                  type="text"
                  required
                  value={newMatDesc}
                  onChange={(e) => setNewMatDesc(e.target.value)}
                  placeholder="e.g. Portland Cement Type 1 (40kg) or 16mm Rebar..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Category</label>
                  <select
                    value={newMatCategory}
                    onChange={(e) => setNewMatCategory(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white focus:border-amber-500 focus:outline-none cursor-pointer"
                  >
                    {MATERIAL_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Schedule Week</label>
                  <input
                    type="text"
                    value={newMatWeek}
                    onChange={(e) => setNewMatWeek(e.target.value)}
                    placeholder="e.g. Week 1, Week 2..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Ordered Qty *</label>
                  <input
                    type="number"
                    min={1}
                    value={newMatOrdered}
                    onChange={(e) => setNewMatOrdered(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Unit</label>
                  <select
                    value={newMatUnit}
                    onChange={(e) => setNewMatUnit(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-mono text-white focus:border-amber-500 focus:outline-none cursor-pointer"
                  >
                    {STANDARD_UNITS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Unit Cost (₱)</label>
                  <input
                    type="number"
                    min={0}
                    value={newMatUnitCost}
                    onChange={(e) => setNewMatUnitCost(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Initial Received Qty</label>
                  <input
                    type="number"
                    min={0}
                    value={newMatReceived}
                    onChange={(e) => setNewMatReceived(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Initial Used / Issued Qty</label>
                  <input
                    type="number"
                    min={0}
                    value={newMatUsed}
                    onChange={(e) => setNewMatUsed(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Supplier / Vendor</label>
                <input
                  type="text"
                  value={newMatSupplier}
                  onChange={(e) => setNewMatSupplier(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Notes / Phase Specs</label>
                <input
                  type="text"
                  value={newMatNotes}
                  onChange={(e) => setNewMatNotes(e.target.value)}
                  placeholder="e.g. For 2nd floor column concreting"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddDirectoryModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-300 hover:text-white bg-slate-800 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer shadow-xs transition"
                >
                  Add to Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: SITE RECEIVING DIALOG FOR PROJECT MANAGER / SITE ENGINEER      */}
      {/* ===================================================================== */}
      {receivingModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className={`${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-2xl'} border rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4`}>
            <div className={`flex items-center justify-between border-b ${isDark ? 'border-slate-800' : 'border-slate-200'} pb-3`}>
              <div>
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'} flex items-center gap-2`}>
                  <Package className="w-4 h-4 text-emerald-500" />
                  Site Delivery Acceptance &amp; Receiving
                </h3>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mt-0.5`}>
                  Confirm actual quantities received at jobsite to update inventory ledger
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReceivingModalItem(null)}
                className={`${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'} p-1 rounded-lg cursor-pointer`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmReceive} className="space-y-4">
              <div className={`p-3 ${isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'} rounded-xl border space-y-1 text-xs`}>
                <div className={`flex items-center justify-between ${isDark ? 'text-slate-400' : 'text-slate-500'} font-mono`}>
                  <span>PO/PR: <strong className="text-cyan-500">{receivingModalItem.id}</strong></span>
                  <span>Site: <strong className={isDark ? 'text-white' : 'text-slate-900'}>{receivingModalItem.projectName}</strong></span>
                </div>
                <div className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'} text-sm`}>
                  {receivingModalItem.materialType}
                </div>
                <div className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                  Ordered Quantity: <strong className="text-amber-500">{receivingModalItem.quantity} {receivingModalItem.unit}</strong>
                </div>
              </div>

              <div>
                <label className={`block text-[10px] font-mono uppercase ${isDark ? 'text-slate-400' : 'text-slate-600 font-semibold'} mb-1`}>
                  Actual Quantity Received ({receivingModalItem.unit}) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={actualReceivedQty}
                  onChange={(e) => setActualReceivedQty(Number(e.target.value) || 0)}
                  className={`w-full ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} border rounded-xl px-3 py-2 text-sm font-mono focus:border-emerald-500 focus:outline-none`}
                />
                <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-500'} mt-1 block`}>
                  Remaining balance to order will be auto-calculated against site ledger.
                </span>
              </div>

              <div>
                <label className={`block text-[10px] font-mono uppercase ${isDark ? 'text-slate-400' : 'text-slate-600 font-semibold'} mb-1`}>
                  Proof of Receipt / Delivery Waybill Photo
                </label>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => setReceivingProofPhoto(reader.result as string);
                        reader.readAsDataURL(file);
                      }
                    }}
                    className={`w-full text-xs ${isDark ? 'text-slate-400 file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700' : 'text-slate-600 file:bg-slate-200 file:text-slate-800 hover:file:bg-slate-300'} file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold cursor-pointer`}
                  />
                  {receivingProofPhoto ? (
                    <div className="relative rounded-xl overflow-hidden border border-slate-700 max-h-36">
                      <img src={receivingProofPhoto} alt="Proof" className="w-full h-36 object-cover" />
                      <button
                        type="button"
                        onClick={() => setReceivingProofPhoto('')}
                        className="absolute top-2 right-2 p-1 bg-black/70 text-white rounded-full hover:bg-black cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-500 italic">
                      Upload signed DR / delivery receipt photo, or click Receive to use default jobsite sign-off stamp.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className={`block text-[10px] font-mono uppercase ${isDark ? 'text-slate-400' : 'text-slate-600 font-semibold'} mb-1`}>
                  Receiving Inspection Remarks
                </label>
                <textarea
                  rows={2}
                  value={receivingRemarks}
                  onChange={(e) => setReceivingRemarks(e.target.value)}
                  placeholder="e.g. Delivered complete, unbagged without tears, stored at ground floor bodega"
                  className={`w-full ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} border rounded-xl px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none`}
                />
              </div>

              <div className={`flex items-center justify-end gap-2 pt-2 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <button
                  type="button"
                  onClick={() => setReceivingModalItem(null)}
                  className={`px-4 py-2 rounded-xl ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'} text-xs font-semibold cursor-pointer`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/10"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Receipt & Update Ledger</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Photo Preview Modal */}
      {viewingPhotoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fadeIn"
          onClick={() => setViewingPhotoUrl(null)}
        >
          <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-2 relative" onClick={e => e.stopPropagation()}>
            <img src={viewingPhotoUrl} alt="Delivery Receipt" className="w-full max-h-[80vh] object-contain rounded-xl" />
            <button
              type="button"
              onClick={() => setViewingPhotoUrl(null)}
              className="absolute top-4 right-4 p-1.5 bg-black/70 hover:bg-black text-white rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
