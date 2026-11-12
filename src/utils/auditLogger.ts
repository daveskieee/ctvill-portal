/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProcessAuditLog } from '../types';

export const AUDIT_LOGS_STORAGE_KEY = 'ctvill_audit_logs';
export const AUDIT_LOGS_UPDATED_EVENT = 'ctvill-audit-logs-updated';

export const INITIAL_LDM_AUDIT_LOGS: ProcessAuditLog[] = [
  {
    id: 'LOG-LDM-1001',
    entityType: 'CIVIL_WORKS',
    entityId: 'PRJ-4693',
    action: 'CHANGE_ORDER_APPROVED',
    actorName: 'Engr. Dan Ramos',
    actorRole: 'Operations Manager',
    details: 'Approved Change Order CO-2026-004 (+₱145,000 for 3-Storey Extended Roof Deck & Cantilever Balcony on Proyecto Bahia). Client notice transmitted.',
    createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString() // 35 mins ago
  },
  {
    id: 'LOG-LDM-1002',
    entityType: 'CIVIL_WORKS',
    entityId: 'PRJ-4693',
    action: 'WBS_GANTT_BASELINE_SYNC',
    actorName: 'Engr. Dan Ramos',
    actorRole: 'Operations Manager',
    details: 'Verified and sealed 14-Phase Master CPM WBS Gantt Baseline for 2-Storey Modern Residential Villa. 100% synchronized with Bill of Quantities.',
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString() // 2 hours ago
  },
  {
    id: 'LOG-LDM-1003',
    entityType: 'CIVIL_WORKS',
    entityId: 'PRJ-4693',
    action: 'QA_INSPECTION_PASSED',
    actorName: 'Engr. Ricardo Gomez',
    actorRole: 'Project Manager / Site Engineer',
    details: 'Structural Pouring QA Inspection Passed: 3,000 PSI Ready-Mix Batch Pour on 2-Storey Footing & Columns (Slump Test: 4.0 inches, Rebar clear cover 50mm verified).',
    createdAt: new Date(Date.now() - 1000 * 60 * 240).toISOString() // 4 hours ago
  },
  {
    id: 'LOG-LDM-1004',
    entityType: 'CIVIL_WORKS',
    entityId: 'REQ-MAT-9921',
    action: 'DELIVERY_ACCEPTED',
    actorName: 'Engr. Ricardo Gomez',
    actorRole: 'Project Manager / Site Engineer',
    details: 'Material Delivery Acceptance: Received 420 Bags Republic Portland Cement & 65 Deformed 16mm Rebars. Delivery receipt photo and Mill Certificate tagged.',
    createdAt: new Date(Date.now() - 1000 * 60 * 360).toISOString() // 6 hours ago
  },
  {
    id: 'LOG-LDM-1005',
    entityType: 'CIVIL_WORKS',
    entityId: 'PAY-4693-W38',
    action: 'PAYROLL_FINALIZED',
    actorName: 'Clarisse Mendoza',
    actorRole: 'Finance Controller',
    details: 'Payroll Register Finalized & Approved: Week 38 Batch Disbursal (₱46,270.33 net payout across 10 site artisans with GCash & physical claim vouchers verified).',
    createdAt: new Date(Date.now() - 1000 * 60 * 600).toISOString() // 10 hours ago
  },
  {
    id: 'LOG-LDM-1006',
    entityType: 'CIVIL_WORKS',
    entityId: 'SPY-003',
    action: 'PAYMENT_DISBURSED',
    actorName: 'Clarisse Mendoza',
    actorRole: 'Finance Controller',
    details: 'Subcontractor Milestone Disbursement Disbursed: BW-889123-BDO (₱125,000 to Lizter Foremen Crew after 100% Gate Roll-Call headcount verification).',
    createdAt: new Date(Date.now() - 1000 * 60 * 1440).toISOString() // 1 day ago
  },
  {
    id: 'LOG-LDM-1007',
    entityType: 'CIVIL_WORKS',
    entityId: 'DTR-MUSTER-20260921',
    action: 'ATTENDANCE_LOGGED',
    actorName: 'Rodelio Cruz',
    actorRole: 'Timekeeper',
    details: 'Daily Artisan Muster Sealed: 22 In-House Trades clocked-in via GPS geofence on 2-Storey Residential House site with 0 absenteeism.',
    createdAt: new Date(Date.now() - 1000 * 60 * 1800).toISOString() // 1.2 days ago
  },
  {
    id: 'LOG-LDM-1008',
    entityType: 'CIVIL_WORKS',
    entityId: 'VALE-SYNC-20260920',
    action: 'VALE_ADJUSTMENT',
    actorName: 'Rodelio Cruz',
    actorRole: 'Timekeeper',
    details: 'Mid-Week Vale (Cash Advance) Voucher Deductions Synchronized to Weekly Payroll Register. 6 artisan subsistence vouchers logged.',
    createdAt: new Date(Date.now() - 1000 * 60 * 2880).toISOString() // 2 days ago
  }
];

export function getStoredAuditLogs(): ProcessAuditLog[] {
  if (typeof window === 'undefined') return INITIAL_LDM_AUDIT_LOGS;
  try {
    const raw = localStorage.getItem(AUDIT_LOGS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(AUDIT_LOGS_STORAGE_KEY, JSON.stringify(INITIAL_LDM_AUDIT_LOGS));
      return INITIAL_LDM_AUDIT_LOGS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(AUDIT_LOGS_STORAGE_KEY, JSON.stringify(INITIAL_LDM_AUDIT_LOGS));
      return INITIAL_LDM_AUDIT_LOGS;
    }
    // Check if logs contain legacy placeholder text; if so, replace with initial logs
    const hasLegacy = parsed.some((l: any) =>
      typeof l.details === 'string' &&
      (l.details.includes('NexBridge') || l.details.includes('CTVill Titling') || l.details.includes('Ghost'))
    );
    if (hasLegacy) {
      localStorage.setItem(AUDIT_LOGS_STORAGE_KEY, JSON.stringify(INITIAL_LDM_AUDIT_LOGS));
      return INITIAL_LDM_AUDIT_LOGS;
    }
    return parsed;
  } catch {
    return INITIAL_LDM_AUDIT_LOGS;
  }
}

export function logAuditEvent(event: {
  entityType?: 'SLOT' | 'CLIENT' | 'TITLING' | 'DEFECT' | 'CIVIL_WORKS' | 'TURNOVER' | string;
  entityId: string;
  action: string;
  actorName: string;
  actorRole: string;
  details: string;
}): ProcessAuditLog {
  const currentLogs = getStoredAuditLogs();
  const newLog: ProcessAuditLog = {
    id: `LOG-LDM-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`,
    entityType: (event.entityType as any) || 'CIVIL_WORKS',
    entityId: event.entityId,
    action: event.action,
    actorName: event.actorName,
    actorRole: event.actorRole,
    details: event.details,
    createdAt: new Date().toISOString()
  };

  const updated = [newLog, ...currentLogs];
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(AUDIT_LOGS_STORAGE_KEY, JSON.stringify(updated.slice(0, 100)));
      window.dispatchEvent(new CustomEvent(AUDIT_LOGS_UPDATED_EVENT, { detail: updated }));
    } catch {
      /* ignore storage quota */
    }
  }

  // Quietly send to server endpoint if present
  fetch('/api/audit-logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newLog)
  }).catch(() => null);

  return newLog;
}

