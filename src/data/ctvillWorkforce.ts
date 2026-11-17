import { CTVillDepartment, CTVillRole } from '../types';

export interface DepartmentConfig {
  department: CTVillDepartment;
  phase: string;
  badgeColor: string;
  roles: {
    title: CTVillRole;
    defaultDailyRate: number;
    description: string;
    isFieldRole: boolean;
  }[];
}

export const CTVILL_ORGANIZATION_HIERARCHY: DepartmentConfig[] = [
  {
    department: 'Executive Leadership',
    phase: 'Strategic Governance',
    badgeColor: 'border-purple-600/60 text-purple-300 bg-purple-950/60',
    roles: [
      { title: 'Chief Executive Officer (CEO)', defaultDailyRate: 4500, description: 'Executive strategic leadership & enterprise growth', isFieldRole: false },
      { title: 'Chief Operating Officer (COO)', defaultDailyRate: 4000, description: 'Operational oversight across CREATE, CONSTRUCT & AFTER-CARE', isFieldRole: false },
    ]
  },
  {
    department: 'Design & Pre-Construction ("CREATE" Phase)',
    phase: 'CREATE Phase',
    badgeColor: 'border-blue-600/60 text-blue-300 bg-blue-950/60',
    roles: [
      { title: 'Architect', defaultDailyRate: 2600, description: 'Architectural design, spatial planning & structural layout sign-offs', isFieldRole: false },
      { title: 'Interior Designer', defaultDailyRate: 2200, description: 'Residential, commercial, and custom interior fit-out specifications', isFieldRole: false },
      { title: 'Electrical Engineer', defaultDailyRate: 2400, description: 'Electrical load calculations, MEPFS sizing & PEC compliance', isFieldRole: false },
      { title: 'Master Plumber', defaultDailyRate: 2000, description: 'Sanitary, water supply, and drainage layout design & inspection', isFieldRole: false },
      { title: 'Quantity Surveyor & Estimator', defaultDailyRate: 2000, description: 'Bill of Quantities (BOQ), material takeoffs & procurement budgets', isFieldRole: false },
    ]
  },
  {
    department: 'Project Management & Construction ("CONSTRUCT" Phase)',
    phase: 'CONSTRUCT Phase',
    badgeColor: 'border-amber-600/60 text-amber-300 bg-amber-950/60',
    roles: [
      { title: 'Project Manager / Site Engineer', defaultDailyRate: 2500, description: 'Unified field lead managing 14-phase Master Gantt, WBS execution & QA inspections', isFieldRole: true },
      { title: 'Safety Officer', defaultDailyRate: 1400, description: 'DOLE-BOSH compliance, hazard identification & daily toolbox safety briefings', isFieldRole: true },
      { title: 'Skilled Trade Crew (Electricians, Carpenters, Masons, Plumbers)', defaultDailyRate: 900, description: 'Direct in-house craft execution (senior skilled artisan acts as on-site lead)', isFieldRole: true },
    ]
  },
  {
    department: 'Property Management & Maintenance ("AFTER CARE" Phase)',
    phase: 'AFTER CARE Phase',
    badgeColor: 'border-emerald-600/60 text-emerald-300 bg-emerald-950/60',
    roles: [
      { title: 'Aftercare Coordinators', defaultDailyRate: 1400, description: 'Warranty ticket management, client inspections & handover follow-ups', isFieldRole: false },
      { title: 'Facilities Maintenance Technicians', defaultDailyRate: 950, description: 'Preventive maintenance for HVAC, electrical, plumbing & building fabrics', isFieldRole: true },
    ]
  },
  {
    department: 'Corporate Support',
    phase: 'Corporate Services',
    badgeColor: 'border-cyan-600/60 text-cyan-300 bg-cyan-950/60',
    roles: [
      { title: 'Finance & Accounting', defaultDailyRate: 1600, description: 'Disbursement ledgers, payroll runs, cash flow & financial reporting', isFieldRole: false },
      { title: 'Human Resources & Admin', defaultDailyRate: 1400, description: 'Talent management, labor compliance, benefits & administrative affairs', isFieldRole: false },
      { title: 'Procurement & Logistics (On-Delivery)', defaultDailyRate: 1500, description: 'Vendor POs, site material deliveries, and supplier coordination', isFieldRole: false },
    ]
  }
];

export const ALL_CTVILL_DEPARTMENTS: CTVillDepartment[] = CTVILL_ORGANIZATION_HIERARCHY.map(d => d.department);

export function getRolesForDepartment(dept: CTVillDepartment | string): CTVillRole[] {
  const found = CTVILL_ORGANIZATION_HIERARCHY.find(d => d.department === dept);
  return found ? found.roles.map(r => r.title) : [];
}

export function getDefaultDailyRate(roleTitle: CTVillRole | string): number {
  for (const dept of CTVILL_ORGANIZATION_HIERARCHY) {
    const roleObj = dept.roles.find(r => r.title === roleTitle);
    if (roleObj) return roleObj.defaultDailyRate;
  }
  return 850;
}

export function getDepartmentBadge(dept: CTVillDepartment | string | undefined | null): string {
  if (!dept) return 'border-slate-700 text-slate-400 bg-slate-900';
  const found = CTVILL_ORGANIZATION_HIERARCHY.find(d => d.department === dept);
  return found?.badgeColor || 'border-slate-700 text-slate-300 bg-slate-900';
}

export type StandardWorkforceCategory = 'PROFESSIONAL' | 'SKILLED' | 'GENERAL_LABOR';

export function getWorkforceCategory(roleTitle: string | undefined | null): StandardWorkforceCategory {
  if (!roleTitle) return 'SKILLED';
  const lower = roleTitle.toLowerCase();

  // 1. PROFESSIONAL
  if (
    lower.includes('architect') ||
    lower.includes('engineer') ||
    lower.includes('project manager') ||
    lower.includes('pm') ||
    lower.includes('estimator') ||
    lower.includes('surveyor') ||
    lower.includes('safety officer') ||
    lower.includes('ehso') ||
    lower.includes('director') ||
    lower.includes('officer') ||
    lower.includes('specialist')
  ) {
    return 'PROFESSIONAL';
  }

  // 2. GENERAL LABOR
  if (
    lower.includes('helper') ||
    lower.includes('labor') ||
    lower.includes('maintenance') ||
    lower.includes('cleaner') ||
    lower.includes('utility')
  ) {
    return 'GENERAL_LABOR';
  }

  // 3. SKILLED (Default for trades, foremen, operators, carpenters, etc.)
  return 'SKILLED';
}
