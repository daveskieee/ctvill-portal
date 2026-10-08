/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Canonical System Roles for CTVill Construction ERP
 */
export enum UserRole {
  OM = 'OPERATIONS_MANAGER',      // Top-Tier: Operations Manager / Admin (Weight: 100)
  FINANCE = 'FINANCE',            // Specialized Tier: Finance & Payroll (Weight: 70)
  PM = 'PROJECT_MANAGER',          // Mid-Tier: Project Manager / Site Engineer (Weight: 50)
  TIMEKEEPER = 'TIMEKEEPER',      // Leaf Tier: Site Timekeeper (Weight: 10)
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
};

/**
 * Normalizes any string representation of a role into the canonical UserRole enum.
 */
export function normalizeRole(rawRole: string | undefined | null): UserRole {
  if (!rawRole) return UserRole.OM;
  const upper = String(rawRole).toUpperCase().trim();
  if (upper.includes('TIME')) return UserRole.TIMEKEEPER;
  if (upper.includes('FINANCE') || upper.includes('TREASURY') || upper.includes('ACCOUNT')) return UserRole.FINANCE;
  if (upper.includes('ENG') || upper.includes('PROJECT') || upper.includes('PM') || upper.includes('SITE_ENG')) return UserRole.PM;
  if (upper === 'ADMIN' || upper.includes('OPERAT') || upper.includes('DIRECTOR') || upper === 'SUPERADMIN' || upper.includes('OM')) return UserRole.OM;
  return UserRole.OM;
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
  | 'permits'                // PEZA & City Hall Permits
  | 'schedule'               // Company Calendar
  | 'timekeeper-attendance'  // Daily Roll-Call & Attendance Check-In
  | 'worker-masterlist'      // Worker Master & Wage Rates
  | 'finance-payroll'        // Automated Weekly Payroll Run
  | 'payroll'                // Artisan Payroll Ledger
  | 'contractors'            // Artisan Trades & Workforce Allocation
  | 'subcontractor-audits'   // Finance-only: Subcontractor Roll-Call Audit View
  | 'subcontractor-payables' // Finance AP: Subcontractor Billings & Disbursements
  | 'audit-trail'            // Operational Audit Trail & QA Logs
  | 'account-settings'       // My Account & Security
  | 'operations-settings';   // Operations & System Settings

/**
 * Checks if a specific role is permitted to view or navigate to a given module tab.
 */
export function canAccessModule(roleInput: UserRole | string, moduleId: string): boolean {
  const role = normalizeRole(roleInput);

  switch (moduleId) {
    // 1. OM & FINANCE (Executive Analytics & Global Financial Controls)
    case 'dashboard':
      return role === UserRole.OM || role === UserRole.FINANCE;

    case 'operations-settings':
      return role === UserRole.OM;

    // 2. OM & FINANCE ONLY (Financial Controls, Wage Rates & Billings)
    case 'worker-masterlist':
    case 'finance-payroll':
    case 'payroll':
    case 'payments':
      return role === UserRole.OM || role === UserRole.FINANCE;

    // 3. OM, PM, & FINANCE (Workforce, Projects, Change Orders, CRM, Permits, Audit Trail)
    case 'contractors':
    case 'projects':
    case 'change-orders':
    case 'audit-trail':
    case 'quotation-leads':
    case 'permits':
      return role === UserRole.OM || role === UserRole.PM || role === UserRole.FINANCE;

    // 3b. FINANCE-ONLY dedicated Subcontractor Audit view (read-only isolation)
    case 'subcontractor-audits':
      return role === UserRole.OM || role === UserRole.FINANCE;

    // 3c. FINANCE & ADMIN: Subcontractor AP / Billings & Disbursements
    case 'subcontractor-payables':
      return role === UserRole.OM || role === UserRole.FINANCE;

    // 4. PM & OM ONLY (Operational Site Execution Modules)
    case 'gantt':
    case 'site-diary':
    case 'documents':
    case 'kanban':
    case 'rfis':
    case 'risks':
    case 'schedule':
      return role === UserRole.OM || role === UserRole.PM;

    // 4. ATTENDANCE (Universal access with role-specific capabilities)
    case 'timekeeper-attendance':
      return true;

    // 5. PROFILE & SECURITY (Universal access)
    case 'account-settings':
      return true;

    default:
      // Unknown routes default to OM-only
      return role === UserRole.OM;
  }
}

/**
 * Returns role-specific capabilities for the Attendance module
 */
export function getAttendanceCapabilities(roleInput: UserRole | string) {
  const role = normalizeRole(roleInput);
  return {
    role,
    // Can submit and edit daily batch attendance
    canLogAttendance: role === UserRole.TIMEKEEPER || role === UserRole.OM,
    // Has full override and backfill capabilities across all company projects
    canOverrideAndBackfill: role === UserRole.OM,
    // Can view and endorse attendance for assigned projects
    canEndorse: role === UserRole.PM || role === UserRole.OM,
    // Read-only inspection / review
    isReadOnlyReview: role === UserRole.PM || role === UserRole.FINANCE,
    // Dedicated site timekeeper roll-call mode
    isTimekeeperCheckIn: role === UserRole.TIMEKEEPER,
  };
}
