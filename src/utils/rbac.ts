/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Canonical System Roles for LDM Construction ERP
 */
export enum UserRole {
  OM = 'OPERATIONS_MANAGER',      // Top-Tier: Operations Manager / Admin (Weight: 100)
  FINANCE = 'FINANCE',            // Specialized Tier: Finance & Payroll (Weight: 70)
  PM = 'PROJECT_MANAGER',          // Mid-Tier: Project Manager / Site Engineer (Weight: 50)
  TIMEKEEPER = 'TIMEKEEPER',      // Leaf Tier: Site Timekeeper (Weight: 10)
  CLIENT = 'CLIENT',              // External Client / Property Owner Tier (Weight: 5)
  UNAUTHORIZED = 'UNAUTHORIZED',  // Tier for unknown / unmapped roles (Weight: 0)
}

/**
 * Vertical Role Hierarchy Weight Mapping:
 * Higher-tier roles inherit permissions and visibility from lower-tier operational roles,
 * but lower-tier roles cannot look upward.
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.OM]: 100,
  [UserRole.FINANCE]: 70,
  [UserRole.PM]: 50,
  [UserRole.TIMEKEEPER]: 10,
  [UserRole.CLIENT]: 5,
  [UserRole.UNAUTHORIZED]: 0,
};

/**
 * Normalizes any string representation of a role into the canonical UserRole enum.
 * NEVER defaults to OM/Admin when given an unknown or empty role.
 */
export function normalizeRole(rawRole: string | undefined | null): UserRole {
  if (!rawRole) return UserRole.UNAUTHORIZED;
  const upper = String(rawRole).toUpperCase().trim();
  if (upper === 'TIMEKEEPER' || upper.includes('TIME')) return UserRole.TIMEKEEPER;
  if (upper === 'FINANCE' || upper.includes('TREASURY') || upper.includes('ACCOUNT')) return UserRole.FINANCE;
  if (upper === 'CLIENT' || upper.includes('CLIENT') || upper.includes('BUYER')) return UserRole.CLIENT;
  if (upper === 'PROJECT_MANAGER' || upper === 'PM' || upper === 'ENGINEER' || upper.includes('ENG') || upper.includes('SITE_ENG')) return UserRole.PM;
  if (upper === 'ADMIN' || upper.includes('OPERAT') || upper.includes('DIRECTOR') || upper === 'SUPERADMIN' || upper.includes('OM')) return UserRole.OM;
  return UserRole.UNAUTHORIZED;
}

/**
 * Checks if a user's role meets or exceeds a target role weight in the vertical hierarchy.
 */
export const hasRoleOrHigher = (userRole: UserRole | string, targetRole: UserRole): boolean => {
  const normalized = typeof userRole === 'string' && Object.values(UserRole).includes(userRole as UserRole)
    ? (userRole as UserRole)
    : normalizeRole(userRole);
  return ROLE_HIERARCHY[normalized] >= ROLE_HIERARCHY[targetRole];
};

/**
 * Module IDs supported across the ERP navigation and routing system.
 */
export type AppModuleId =
  | 'dashboard'              // Executive Command Center & Portfolio
  | 'projects'               // Commercial Sites Hub
  | 'gantt'                  // Master Gantt & Timeline
  | 'site-diary'             // Daily Site Diary & Weather
  | 'documents'              // Detailed Engineering & CAD
  | 'kanban'                 // Field Execution Kanban
  | 'rfis'                   // Engineering RFIs
  | 'change-orders'          // Commercial Change Orders
  | 'risks'                  // Jobsite Safety & Risk Matrix
  | 'quotation-leads'        // Fit-Out Estimates & Leads
  | 'permits'                // Building & LGU Permits
  | 'schedule'               // Company Calendar
  | 'timekeeper-attendance'  // Daily Roll-Call & Attendance Check-In
  | 'worker-masterlist'      // Worker Master & Wage Rates
  | 'finance-payroll'        // Automated Weekly Payroll Run
  | 'payroll'                // Artisan Payroll Ledger
  | 'contractors'            // Artisan Trades & Workforce Allocation
  | 'subcontractor-audits'   // Finance-only: Subcontractor Roll-Call Audit View
  | 'subcontractor-payables' // Finance AP: Subcontractor Billings & Disbursements
  | 'payments'               // Progress Billings & Receipts
  | 'audit-trail'            // Operational Audit Trail & QA Logs
  | 'account-settings'       // My Account & Security
  | 'operations-settings';   // Operations & System Settings

/**
 * Checks if a specific role is permitted to view or navigate to a given module tab.
 */
export function canAccessModule(roleInput: UserRole | string, moduleId: string): boolean {
  const role = normalizeRole(roleInput);

  switch (moduleId) {
    // 1. Executive Analytics & Dashboards (OM Only)
    case 'dashboard':
      return role === UserRole.OM;

    case 'operations-settings':
      return role === UserRole.OM;

    // 2. Master Gantt & Timeline (PM / Site Engineer Only - On-Site Execution)
    case 'gantt':
      return role === UserRole.PM;

    // 3. Commercial Sites / Projects Hub (OM, PM, Client)
    case 'projects':
      return role === UserRole.OM || role === UserRole.PM || role === UserRole.CLIENT;

    // 4. Progress & Activity Reports (OM: Read-Only, PM: Submit & Full Edit)
    case 'kanban':
      return role === UserRole.OM || role === UserRole.PM;

    // 5. Company Calendar (Universal for Internal Roles)
    case 'schedule':
      return role === UserRole.OM || role === UserRole.PM || role === UserRole.TIMEKEEPER || role === UserRole.FINANCE;

    // 6. Site Diary & Weather (OM: View, PM: Log)
    case 'site-diary':
      return role === UserRole.OM || role === UserRole.PM;

    // 7. Procurement, Approvals & Deliveries (OM: Approvals, PM: PR Submission & Receiving)
    case 'rfis':
      return role === UserRole.OM || role === UserRole.PM;

    // 8. Commercial Change Orders (OM & PM)
    case 'change-orders':
      return role === UserRole.OM || role === UserRole.PM;

    // 9. Labor Workforce & Artisan Trades (OM: Analytics & Approvals, PM: Dispatch & Reallocations)
    case 'contractors':
      return role === UserRole.OM || role === UserRole.PM;

    // 10. Technical Drawings, CAD & Blueprints (OM, PM, Client)
    case 'documents':
      return role === UserRole.OM || role === UserRole.PM || role === UserRole.CLIENT;

    // 11. Statutory & LGU Permits (OM, PM)
    case 'permits':
      return role === UserRole.OM || role === UserRole.PM;

    // 12. Audit Trail & Logs (OM, PM, Timekeeper, Finance)
    case 'audit-trail':
      return role === UserRole.OM || role === UserRole.PM || role === UserRole.TIMEKEEPER || role === UserRole.FINANCE;

    // 13. Attendance Roll-Call (Timekeeper: Edit; Finance & OM: Strictly Read-Only)
    case 'timekeeper-attendance':
      return role === UserRole.OM || role === UserRole.TIMEKEEPER || role === UserRole.FINANCE;

    // 14. Finance & Commercial Controls (Finance Only)
    case 'worker-masterlist':
    case 'finance-payroll':
    case 'payroll':
    case 'payments':
    case 'subcontractor-payables':
      return role === UserRole.FINANCE;

    // 15. Quotation Estimates & Bill of Materials (Finance, Client)
    case 'quotation-leads':
      return role === UserRole.FINANCE || role === UserRole.CLIENT;

    // 16. Profile & Security
    case 'account-settings':
      return role !== UserRole.UNAUTHORIZED;

    // 17. Deprecated / Removed Modules
    case 'risks':
    case 'subcontractor-audits':
    default:
      return false;
  }
}

/**
 * Returns role-specific capabilities for the Attendance module
 */
export function getAttendanceCapabilities(roleInput: UserRole | string) {
  const role = normalizeRole(roleInput);
  return {
    role,
    // Can submit and edit daily batch attendance (Timekeeper ONLY)
    canLogAttendance: role === UserRole.TIMEKEEPER,
    // Has full override and backfill capabilities across all company projects
    canOverrideAndBackfill: false,
    // Can view and endorse attendance for assigned projects
    canEndorse: role === UserRole.PM,
    // Read-only inspection / review
    isReadOnlyReview: role === UserRole.OM || role === UserRole.FINANCE,
    // Dedicated site timekeeper roll-call mode
    isTimekeeperCheckIn: role === UserRole.TIMEKEEPER,
  };
}
