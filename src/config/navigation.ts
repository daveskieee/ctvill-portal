/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  TrendingUp, Building2, BarChart3, CheckSquare, CalendarDays,
  CloudSun, FileSpreadsheet, FileText, ShieldAlert,
  Users, ClipboardCheck, Banknote, Receipt, DollarSign,
  Briefcase, FileCode, FileCheck, History, UserCog, Settings2,
  ShieldCheck, HardHat, FolderKanban, LucideIcon
} from 'lucide-react';
import { UserRole } from '../utils/rbac';

export interface NavItemConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  badgeKey?: string;
}

export interface NavSectionConfig {
  id: string;
  title: string;
  items: NavItemConfig[];
}

/**
 * Centralized Role-Based Navigation Definitions.
 * Each role strictly sees only authorized, relevant modules.
 */
export const ROLE_NAVIGATION_CONFIG: Record<UserRole, NavSectionConfig[]> = {
  // ── OPERATIONS MANAGER / ADMIN ──
  [UserRole.OM]: [
    {
      id: 'om-projects',
      title: 'Projects & Planning',
      items: [
        { id: 'dashboard', label: 'Executive Portfolio', icon: TrendingUp },
        { id: 'projects', label: 'Commercial Sites Hub', icon: Building2 },
        { id: 'gantt', label: 'Master Gantt & Timeline', icon: BarChart3 },
        { id: 'kanban', label: 'Field Execution Kanban', icon: CheckSquare },
        { id: 'schedule', label: 'Company Schedule Calendar', icon: CalendarDays },
      ]
    },
    {
      id: 'om-field',
      title: 'Field Operations',
      items: [
        { id: 'site-diary', label: 'Site Diary & Weather', icon: CloudSun },
        { id: 'rfis', label: 'Engineering RFIs Register', icon: FileSpreadsheet, badgeKey: 'rfis' },
        { id: 'change-orders', label: 'Commercial Change Orders', icon: FileText, badgeKey: 'changeOrders' },
        { id: 'risks', label: 'Jobsite Safety & Risk Matrix', icon: ShieldAlert },
      ]
    },
    {
      id: 'om-workforce',
      title: 'Workforce & Labor',
      items: [
        { id: 'contractors', label: 'Labor Workforce & Artisan Trades', icon: Users },
        { id: 'worker-masterlist', label: 'Worker Masterlist & Rates', icon: Users },
        { id: 'timekeeper-attendance', label: 'In-House Artisan Roll-Call', icon: ClipboardCheck },
        { id: 'subcontractor-audits', label: 'Subcontractor Roll-Call Audits', icon: ShieldCheck },
      ]
    },
    {
      id: 'om-finance',
      title: 'Finance & Commercial',
      items: [
        { id: 'finance-payroll', label: 'Weekly Payroll & Disbursal', icon: Banknote },
        { id: 'subcontractor-payables', label: 'Subcontractor Payables', icon: Receipt },
        { id: 'payments', label: 'Progress Billings & Receipts', icon: DollarSign },
        { id: 'quotation-leads', label: 'Fit-Out Estimates & Leads', icon: Briefcase, badgeKey: 'quotations' },
      ]
    },
    {
      id: 'om-compliance',
      title: 'Design & Compliance',
      items: [
        { id: 'documents', label: 'Detailed Engineering & CAD', icon: FileCode },
        { id: 'permits', label: 'PEZA & City Hall Permits', icon: FileCheck },
        { id: 'audit-trail', label: 'Audit Trail & QA Logs', icon: History },
      ]
    },
    {
      id: 'om-system',
      title: 'System & Controls',
      items: [
        { id: 'account-settings', label: 'My Account & Security', icon: UserCog },
        { id: 'operations-settings', label: 'Operations & System Settings', icon: Settings2 },
      ]
    }
  ],

  // ── PROJECT MANAGER / SITE ENGINEER ──
  [UserRole.PM]: [
    {
      id: 'pm-projects',
      title: 'Projects & Planning',
      items: [
        { id: 'dashboard', label: 'Site Command Center', icon: HardHat },
        { id: 'projects', label: 'Commercial Sites Hub', icon: Building2 },
        { id: 'gantt', label: 'Site Gantt Schedule', icon: BarChart3 },
        { id: 'kanban', label: 'Field Execution Kanban', icon: CheckSquare },
        { id: 'schedule', label: 'Site Calendar & Visits', icon: CalendarDays },
      ]
    },
    {
      id: 'pm-field',
      title: 'Field Operations',
      items: [
        { id: 'site-diary', label: 'Site Diary & Weather', icon: CloudSun },
        { id: 'rfis', label: 'Engineering RFIs Register', icon: FileSpreadsheet, badgeKey: 'rfis' },
        { id: 'change-orders', label: 'Site Change Orders', icon: FileText, badgeKey: 'changeOrders' },
        { id: 'risks', label: 'Jobsite Safety & Risk Matrix', icon: ShieldAlert },
      ]
    },
    {
      id: 'pm-workforce',
      title: 'Workforce & Site Labor',
      items: [
        { id: 'contractors', label: 'Labor Workforce & Artisan Trades', icon: Users },
        { id: 'timekeeper-attendance', label: 'Artisan Roll-Call & Logs', icon: ClipboardCheck },
      ]
    },
    {
      id: 'pm-compliance',
      title: 'Design & Compliance',
      items: [
        { id: 'documents', label: 'Detailed Engineering & CAD', icon: FileCode },
        { id: 'permits', label: 'PEZA & City Hall Permits', icon: FileCheck },
        { id: 'audit-trail', label: 'Site Audit Trail & QA Logs', icon: History },
      ]
    },
    {
      id: 'pm-system',
      title: 'System & Controls',
      items: [
        { id: 'account-settings', label: 'My Account & Security', icon: UserCog },
      ]
    }
  ],

  // ── FINANCE CONTROLLER & TREASURY ──
  [UserRole.FINANCE]: [
    {
      id: 'fin-treasury',
      title: 'Finance & Commercial',
      items: [
        { id: 'dashboard', label: 'Financial Executive Overview', icon: TrendingUp },
        { id: 'finance-payroll', label: 'Weekly Payroll & Disbursal', icon: Banknote },
        { id: 'subcontractor-payables', label: 'Subcontractor Payables', icon: Receipt },
        { id: 'payments', label: 'Progress Billings & Receipts', icon: DollarSign },
        { id: 'change-orders', label: 'Change Order Fund Releases', icon: FileText, badgeKey: 'changeOrders' },
        { id: 'quotation-leads', label: 'Quotation Estimates CRM', icon: Briefcase, badgeKey: 'quotations' },
      ]
    },
    {
      id: 'fin-sites',
      title: 'Commercial Sites & Audit',
      items: [
        { id: 'projects', label: 'Commercial Sites Hub', icon: Building2 },
        { id: 'worker-masterlist', label: 'Worker Masterlist & Rates', icon: Users },
        { id: 'timekeeper-attendance', label: 'In-House Attendance Records', icon: ClipboardCheck },
        { id: 'subcontractor-audits', label: 'Subcontractor Roll-Call Audits', icon: ShieldCheck },
        { id: 'permits', label: 'PEZA & LGU Permits', icon: FileCheck },
        { id: 'audit-trail', label: 'Financial Audit Trail', icon: History },
      ]
    },
    {
      id: 'fin-system',
      title: 'System & Controls',
      items: [
        { id: 'account-settings', label: 'My Account & Security', icon: UserCog },
      ]
    }
  ],

  // ── SITE TIMEKEEPER ──
  [UserRole.TIMEKEEPER]: [
    {
      id: 'tk-workforce',
      title: 'Workforce & Attendance',
      items: [
        { id: 'timekeeper-attendance', label: 'In-House Artisan Roll-Call', icon: ClipboardCheck },
      ]
    },
    {
      id: 'tk-system',
      title: 'System & Controls',
      items: [
        { id: 'account-settings', label: 'My Account & Security', icon: UserCog },
      ]
    }
  ],

  // ── EXTERNAL CLIENT / PROPERTY OWNER ──
  [UserRole.CLIENT]: [
    {
      id: 'cli-project',
      title: 'Commercial Fit-Out',
      items: [
        { id: 'projects', label: 'My Fit-Out Project', icon: Building2 },
        { id: 'documents', label: 'Blueprints & Handover Docs', icon: FolderKanban },
        { id: 'quotation-leads', label: 'My Project Estimates', icon: Briefcase },
      ]
    },
    {
      id: 'cli-system',
      title: 'System & Controls',
      items: [
        { id: 'account-settings', label: 'My Account & Security', icon: UserCog },
      ]
    }
  ],

  // ── UNAUTHORIZED / MINIMAL FALLBACK ──
  [UserRole.UNAUTHORIZED]: [
    {
      id: 'unauth-system',
      title: 'System',
      items: [
        { id: 'account-settings', label: 'My Account & Security', icon: UserCog },
      ]
    }
  ]
};

/**
 * Returns the resolved sidebar navigation sections for a given role,
 * injecting dynamic badge counts where applicable.
 */
export function getSidebarSections(
  role: UserRole,
  badges: Record<string, number | undefined> = {}
): { id: string; title: string; items: { id: string; label: string; icon: LucideIcon; badge?: string }[] }[] {
  const sections = ROLE_NAVIGATION_CONFIG[role] || ROLE_NAVIGATION_CONFIG[UserRole.UNAUTHORIZED];

  return sections.map(section => ({
    id: section.id,
    title: section.title,
    items: section.items.map(item => {
      let badge: string | undefined = undefined;
      if (item.badgeKey && badges[item.badgeKey] && (badges[item.badgeKey] as number) > 0) {
        badge = String(badges[item.badgeKey]);
      }
      return {
        id: item.id,
        label: item.label,
        icon: item.icon,
        badge
      };
    })
  }));
}
