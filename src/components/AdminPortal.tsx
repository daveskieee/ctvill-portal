/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Building2, Users, FileText, Settings2, BarChart3, PieChart, Landmark, ShieldCheck, Shield, Laptop,
  Search, Plus, Hammer, DollarSign, Calendar, Sliders, ChevronRight, ChevronLeft, ChevronDown, UserCheck, Trash2, 
  CheckCircle, FileBadge, Radio, Layers, ArrowRight, AlertTriangle, Clock, CheckCircle2,
  FileSpreadsheet, ClipboardList, MapPin, HardHat, CloudSun, FileCheck2, UserPlus, Eye, BadgeAlert,
  Scale, Menu, History, Banknote, TrendingUp, Sparkles, FileCode, ShieldAlert,
  Ticket, Award, Bot, RefreshCw, CheckCheck, Zap, SlidersHorizontal, Edit3, X, Smartphone,
  Mail, ExternalLink, Check, Copy, Send, Compass, UserCog, User, KeyRound, Bell, Building, Save, CheckSquare,
  Camera, Upload, Image as ImageIcon, EyeOff, Lock, CalendarDays, FileCheck, Briefcase, Lightbulb, ChevronUp,
  Volume2, VolumeX, HelpCircle, CloudRain, LogOut, ClipboardCheck, Receipt
} from 'lucide-react';
import { 
  ResponsiveContainer, PieChart as RePieChart, Pie, Cell, 
  BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid 
} from 'recharts';
import { 
  LandParcel, Slot, Client, QALog, Contractor, PayrollRecord, 
  CompanyBudget, PunchListDefect, CivilWorksMilestone, ProcessAuditLog, SlotStatus, DailyManpowerAudit,
  LaborAllocation, AIManpowerRecommendation, ProjectTask, DailySiteLog, ProjectDocument, ProjectRisk, 
  ChangeOrder, TaskStatus, CADParsedLot, GovernmentPermit, ScheduleEvent,
  ProjectProfile, ExtendedPayrollItem, CTVillDepartment, CTVillRole,
  ProjectRFI, FitoutQuotationItem, WorkforceClassification, RegistrationEntityType,
  isOfficeOrExecutive, isIndividualStaffOrEngineer, isTradeGroupOrOutsourcedContractor
} from '../types';
import { updateStoredSession } from '../utils/session';
import { secureFetch, getCsrfToken } from '../utils/apiClient';
import { 
  CTVILL_ORGANIZATION_HIERARCHY, ALL_CTVILL_DEPARTMENTS, 
  getRolesForDepartment, getDefaultDailyRate, getDepartmentBadge 
} from '../data/ctvillWorkforce';
import { 
  UserRole, ROLE_HIERARCHY, hasRoleOrHigher, 
  normalizeRole, canAccessModule, getAttendanceCapabilities 
} from '../utils/rbac';
import { getSidebarSections } from '../config/navigation';
import logoJpg from '../assets/images/ctvill/logo.jpg';
import ProjectKanban from './ProjectKanban';
import GanttTimeline from './GanttTimeline';
import DocumentManager from './DocumentManager';
import DailySiteDiary from './DailySiteDiary';
import RiskMatrix from './RiskMatrix';
import ProjectProfileHub from './ProjectProfileHub';
import PaymentsTracker from './PaymentsTracker';
import ProjectScheduleCalendar from './ProjectScheduleCalendar';
import GovernmentPermitsTracker from './GovernmentPermitsTracker';
import PayrollManager from './PayrollManager';
import ChangeOrderManager from './ChangeOrderManager';
import RfiManager from './RfiManager';
import QuotationLeadsManager from './QuotationLeadsManager';
import WorkforceMessengerRoster from './WorkforceMessengerRoster';
import AccountsCentre from './AccountsCentre';
import LaborWorkforceArtisanTrades from './LaborWorkforceArtisanTrades';
import TimekeeperAttendanceDashboard from './TimekeeperAttendanceDashboard';
import FinancePayrollDashboard from './FinancePayrollDashboard';
import WorkerMasterlistManager from './WorkerMasterlistManager';
import SubcontractorBillingsDisbursements from './SubcontractorBillingsDisbursements';
import SubcontractorRollCallAudits from './SubcontractorRollCallAudits';
import { useTheme } from '../context/ThemeContext';
import { ThemeToggle } from './ThemeToggle';
import {
  DashboardSkeleton,
  TableSkeleton,
  CardGridSkeleton,
  KanbanSkeleton,
  GanttSkeleton,
  SiteDiarySkeleton,
} from './skeletons';

export const TAB_METADATA: Record<string, { title: string; subtitle: string; department: string }> = {
  'dashboard': {
    title: 'Executive Portfolio',
    subtitle: 'Real-time overview of active fit-out sites, field workforce, and financial performance',
    department: 'Projects & Planning'
  },
  'projects': {
    title: 'Commercial Sites Hub',
    subtitle: 'Manage commercial fit-out projects, scope, contracts, and assigned project teams',
    department: 'Projects & Planning'
  },
  'gantt': {
    title: 'Master Gantt & Timeline',
    subtitle: 'Critical path schedule, phase dependencies, and completion milestone tracking',
    department: 'Projects & Planning'
  },
  'kanban': {
    title: 'Field Execution Kanban',
    subtitle: 'Jobsite work breakdown structure, task status flow, and contractor assignments',
    department: 'Projects & Planning'
  },
  'schedule': {
    title: 'Company Schedule Calendar',
    subtitle: 'Coordination calendar for site visits, inspections, milestones, and client handovers',
    department: 'Projects & Planning'
  },
  'site-diary': {
    title: 'Site Diary & Weather',
    subtitle: 'Daily site observations, weather telemetry, safety notes, and on-site logs',
    department: 'Field Operations'
  },
  'rfis': {
    title: 'Engineering RFIs Register',
    subtitle: 'Technical queries, architectural clarifications, and design coordination logs',
    department: 'Field Operations'
  },
  'change-orders': {
    title: 'Commercial Change Orders',
    subtitle: 'Contract variations, client amendments, cost impact assessments, and approvals',
    department: 'Field Operations'
  },
  'risks': {
    title: 'Jobsite Safety & Risk Matrix',
    subtitle: 'Proactive hazard identification, mitigation plans, and safety compliance audits',
    department: 'Field Operations'
  },
  'contractors': {
    title: 'Labor Workforce & Artisan Trades',
    subtitle: 'Deploy and monitor trade groups, craft specialists, and equipment teams across sites',
    department: 'Workforce & Labor'
  },
  'worker-masterlist': {
    title: 'Worker Masterlist & Rates',
    subtitle: 'Unified artisan roster, daily wage rates, overtime formulas, and project assignments',
    department: 'Workforce & Labor'
  },
  'timekeeper-attendance': {
    title: 'In-House Artisan Roll-Call',
    subtitle: 'Daily site attendance logs, overtime tracking, and verified timesheet ledger',
    department: 'Workforce & Labor'
  },
  'subcontractor-audits': {
    title: 'Subcontractor Roll-Call Audits',
    subtitle: 'Audited headcount verification against subcontractor billing claims',
    department: 'Workforce & Labor'
  },
  'finance-payroll': {
    title: 'Weekly Payroll & Disbursal',
    subtitle: 'Automated wage calculation, deductions, statutory withholdings, and payout releases',
    department: 'Finance & Commercial'
  },
  'subcontractor-payables': {
    title: 'Subcontractor Payables',
    subtitle: 'Contractor progress billings, retention balances, and disbursement vouchers',
    department: 'Finance & Commercial'
  },
  'payments': {
    title: 'Progress Billings & Receipts',
    subtitle: 'Client payment milestones, billing collection pace, and commercial cashflow',
    department: 'Finance & Commercial'
  },
  'quotation-leads': {
    title: 'Fit-Out Estimates & Leads',
    subtitle: 'Client project estimates, cost breakdowns, bill of quantities, and inquiries CRM',
    department: 'Finance & Commercial'
  },
  'documents': {
    title: 'Detailed Engineering & CAD',
    subtitle: 'Central repository for architectural blueprints, structural plans, and MEPFS specs',
    department: 'Design & Compliance'
  },
  'permits': {
    title: 'PEZA & City Hall Permits',
    subtitle: 'Statutory government clearances, building permits, and regulatory inspections',
    department: 'Design & Compliance'
  },
  'audit-trail': {
    title: 'Audit Trail & QA Logs',
    subtitle: 'Immutable record of financial transactions, project edits, and compliance events',
    department: 'Design & Compliance'
  },
  'account-settings': {
    title: 'My Account & Security',
    subtitle: 'Personal profile, session security, authentication credentials, and preferences',
    department: 'System'
  },
  'operations-settings': {
    title: 'Operations & System Settings',
    subtitle: 'Global parameters, automated alerts, AI scan policies, and audit configurations',
    department: 'System'
  }
};

interface AdminPortalProps {
  parcels: LandParcel[];
  slots: Slot[];
  clients: Client[];
  contractors: Contractor[];
  qaLogs: QALog[];
  punchListDefects: PunchListDefect[];
  civilWorksMilestones: CivilWorksMilestone[];
  auditLogs: ProcessAuditLog[];
  payroll: PayrollRecord[];
  budget: CompanyBudget;
  manpowerAudits?: DailyManpowerAudit[];
  laborAllocations?: LaborAllocation[];
  aiRecommendations?: AIManpowerRecommendation[];
  tasks?: ProjectTask[];
  siteLogs?: DailySiteLog[];
  documents?: ProjectDocument[];
  risks?: ProjectRisk[];
  changeOrders?: ChangeOrder[];
  rfis?: ProjectRFI[];
  quotations?: FitoutQuotationItem[];
  permits?: GovernmentPermit[];
  scheduleEvents?: ScheduleEvent[];
  projects?: ProjectProfile[];
  extendedPayroll?: ExtendedPayrollItem[];
  session?: any;
  onAddParcel: (parcel: LandParcel) => void;
  onSubdivideParcel: (parcelId: string, areaSqm: number, price: number, isReady: boolean) => void;
  onRegisterClient: (client: Client) => void;
  onDeleteClient?: (clientId: string) => void;
  onAssignClient: (slotId: string, clientId: string) => void;
  onTransitionSlotStatus: (slotId: string, status: string, notes?: string, clientId?: string | null) => void;
  onUpdateTitlePipeline: (clientId: string, stepKey?: string, value?: boolean, tctNumber?: string, taxDecNumber?: string) => void;
  onVerifyKyc: (clientId: string, docKey: string, verified: boolean, notes?: string) => void;
  onCreateDefect: (defectData: any) => void;
  onUpdateDefect: (id: string, updateData: any) => void;
  onUpdateCivilMilestone: (milestoneId: string, currentPercentage: number, status: string, inspectorSignOff: boolean, remarks?: string) => void;
  onRegisterContractor: (contractor: Contractor) => void;
  onDeleteContractor?: (contractorId: string) => void;
  onUpdateContractor?: (contractor: Contractor) => void;
  onUpdateContractors: (updated: Contractor[]) => void;
  onAddQALog: (log: Omit<QALog, 'id' | 'date'>) => void;
  onAddPayroll: (record: PayrollRecord) => void;
  onCreateManpowerAudit?: (auditData: any) => void;
  onSaveAllocation?: (alloc: LaborAllocation) => void;
  onApplyAIRecommendation?: (recId: string) => Promise<any> | void;
  onDismissAIRecommendation?: (recId: string) => Promise<any> | void;
  onAddTask?: (task: Omit<ProjectTask, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateTaskStatus?: (taskId: string, status: TaskStatus) => void;
  onDeleteTask?: (taskId: string) => void;
  onClearAllTasks?: () => void;
  onAddSiteLog?: (log: Omit<DailySiteLog, 'id' | 'createdAt'>) => void;
  onAddDocument?: (doc: Omit<ProjectDocument, 'id' | 'createdAt'>) => void;
  onUpdateDocument?: (id: string, doc: Partial<ProjectDocument>) => void;
  onDeleteDocument?: (id: string) => void;
  onSyncSchedule?: (tasks: any[]) => void;
  onAddRisk?: (risk: Omit<ProjectRisk, 'id' | 'createdAt'>) => void;
  onImportCADLots?: (lots: CADParsedLot[]) => void;
  onClearAllLots?: () => void;
  onDeleteParcel?: (parcelId: string) => void;
  onApplyAIPricing?: (updates: { slotId: string; newBasePrice: number }[], targetMargin: number) => Promise<void> | void;
  onAddPermit?: (permit: Partial<GovernmentPermit>) => Promise<void>;
  onUpdatePermitStatus?: (permitId: string, status: any, notes?: string) => Promise<void>;
  onUpdatePermit?: (permitId: string, updates: Partial<GovernmentPermit>) => Promise<void>;
  onDeletePermit?: (permitId: string) => Promise<void>;
  onAddScheduleEvent?: (event: Partial<ScheduleEvent>) => Promise<void>;
  onUpdateScheduleEvent?: (eventId: string, updates: Partial<ScheduleEvent>) => Promise<void>;
  onDeleteScheduleEvent?: (eventId: string) => Promise<void>;
  onCreateProject?: (project: Partial<ProjectProfile>) => Promise<void>;
  onUpdateProject?: (id: string, updates: Partial<ProjectProfile>) => Promise<void>;
  onDeleteProject?: (id: string) => Promise<void>;
  onAddExtendedPayroll?: (item: Partial<ExtendedPayrollItem>) => Promise<void>;
  onUpdateExtendedPayroll?: (id: string, updates: Partial<ExtendedPayrollItem>) => Promise<void>;
  onDeleteExtendedPayroll?: (id: string) => Promise<void>;
  onRecordPayment?: (paymentData: any) => Promise<void>;
  onDisbursePayroll?: (id?: string, all?: boolean) => Promise<void>;
  onSubmitChangeOrder?: (order: Partial<ChangeOrder>) => Promise<void> | void;
  onUpdateChangeOrderStatus?: (id: string, status: 'APPROVED' | 'REJECTED', approvedAmount?: number) => Promise<void> | void;
  onSubmitRfi?: (rfi: Partial<ProjectRFI>) => Promise<void> | void;
  onAnswerRfi?: (id: string, answer: string, status: 'OPEN' | 'UNDER_REVIEW' | 'ANSWERED' | 'CLOSED') => Promise<void> | void;
  onUpdateQuotationStatus?: (id: string, status: any, notes?: string) => Promise<void> | void;
  onConvertQuotationToProject?: (quotation: FitoutQuotationItem) => Promise<void> | void;
  onTriggerAiLaborScan?: () => Promise<any> | void;
  onLogManpowerAudit?: (auditData: any) => Promise<void> | void;
  onLogout: () => void;
  onUpdateSession?: (updated: any) => void;
  isInitialLoading?: boolean;
  onRefreshAllData?: () => Promise<void> | void;
}

export default function AdminPortal({
  parcels, slots, clients, contractors, qaLogs, punchListDefects, civilWorksMilestones,
  auditLogs, payroll, budget, manpowerAudits = [], laborAllocations = [], aiRecommendations = [],
  tasks = [], siteLogs = [], documents = [], risks = [], changeOrders = [],
  rfis = [], quotations = [],
  permits = [], scheduleEvents = [], projects = [], extendedPayroll = [],
  onAddParcel, onSubdivideParcel, onRegisterClient, onDeleteClient, onAssignClient,
  onTransitionSlotStatus, onUpdateTitlePipeline, onVerifyKyc, onCreateDefect, onUpdateDefect,
  onUpdateCivilMilestone, onRegisterContractor, onDeleteContractor, onUpdateContractor, onUpdateContractors, onAddQALog, onAddPayroll,
  onCreateManpowerAudit, onSaveAllocation, onApplyAIRecommendation, onDismissAIRecommendation,
  onAddTask, onUpdateTaskStatus, onDeleteTask, onClearAllTasks, onAddSiteLog, onAddDocument, onUpdateDocument, onDeleteDocument, onSyncSchedule, onAddRisk,
  onImportCADLots, onClearAllLots, onDeleteParcel, onApplyAIPricing,
  onAddPermit, onUpdatePermitStatus, onUpdatePermit, onDeletePermit, 
  onAddScheduleEvent, onUpdateScheduleEvent, onDeleteScheduleEvent,
  onCreateProject, onUpdateProject, onDeleteProject,
  onAddExtendedPayroll, onUpdateExtendedPayroll, onDeleteExtendedPayroll,
  onRecordPayment, onDisbursePayroll,
  onSubmitChangeOrder, onUpdateChangeOrderStatus,
  onSubmitRfi, onAnswerRfi,
  onUpdateQuotationStatus, onConvertQuotationToProject,
  onTriggerAiLaborScan, onLogManpowerAudit,
  onLogout, onUpdateSession, session,
  isInitialLoading = false,
  onRefreshAllData
}: AdminPortalProps) {
  
  // User Role Resolution via Centralized RBAC Hierarchy (OM -> PM -> TIMEKEEPER, FINANCE, CLIENT)
  const currentRole = normalizeRole(session?.role);
  const isOperationsManager = currentRole === UserRole.OM;
  const isProjectManager = currentRole === UserRole.PM;
  const isTimekeeper = currentRole === UserRole.TIMEKEEPER;
  const isFinance = currentRole === UserRole.FINANCE;
  const isClient = currentRole === UserRole.CLIENT;

  const isAdmin = isOperationsManager;
  const isEngineer = isProjectManager;
  const isOperationsDirector = isOperationsManager;
  const rawRole = isTimekeeper ? 'TIMEKEEPER' : isFinance ? 'FINANCE' : isClient ? 'CLIENT' : isProjectManager ? 'ENGINEER' : 'ADMIN';

  // Navigation Tabs with Role-Aware Default Landing Page
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (isTimekeeper) return 'timekeeper-attendance';
    if (isFinance) return 'finance-payroll';
    if (isClient) return 'projects';
    if (isProjectManager) return 'projects';
    return 'dashboard';
  });

  // Strict Vertical RBAC Guard: If role cannot access the active module, redirect to authorized default
  useEffect(() => {
    if (activeTab === 'forbidden-403') return;
    if (!canAccessModule(currentRole, activeTab)) {
      const defaultHome = isTimekeeper 
        ? 'timekeeper-attendance' 
        : isFinance 
          ? 'finance-payroll' 
          : isClient
            ? 'projects'
            : isProjectManager 
              ? 'projects' 
              : 'dashboard';
      setActiveTab(defaultHome);
    }
  }, [currentRole, activeTab, isTimekeeper, isFinance, isClient, isProjectManager]);

  // URL Hash & Query Parameter Route Guard (Prevents URL Tampering)
  useEffect(() => {
    const handleUrlRoute = () => {
      const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase().trim();
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab')?.toLowerCase().trim();
      const pathname = window.location.pathname.replace(/^\//, '').toLowerCase().trim();
      
      const requestedRoute = hash || tabParam || pathname;
      if (!requestedRoute) return;

      const routeMap: Record<string, string> = {
        'attendance': 'timekeeper-attendance',
        'workforce/attendance': 'timekeeper-attendance',
        'timekeeper-attendance': 'timekeeper-attendance',
        'daily-attendance': 'timekeeper-attendance',
        'workforce': isTimekeeper ? 'timekeeper-attendance' : 'contractors',
        'contractors': 'contractors',
        'dashboard': 'dashboard',
        'executive-portfolio': 'dashboard',
        'gantt': 'gantt',
        'kanban': 'kanban',
        'rfis': 'rfis',
        'change-orders': 'change-orders',
        'risks': 'risks',
        'payroll': isFinance ? 'finance-payroll' : 'payroll',
        'finance-payroll': 'finance-payroll',
        'payments': 'payments',
        'billings': 'payments',
        'progress-billings': 'payments',
        'projects': 'projects',
        'subcontractor-audits': 'subcontractor-audits',
        'subcontractor-payables': 'subcontractor-payables',
        'quotations': 'quotation-leads',
        'quotation-leads': 'quotation-leads',
        'permits': 'permits',
        'audit-trail': 'audit-trail',
        'profile': 'account-settings',
        'account-settings': 'account-settings',
        'settings': 'account-settings',
      };

      const targetTab = routeMap[requestedRoute];
      if (targetTab) {
        if (!canAccessModule(currentRole, targetTab)) {
          // Attempting to access unauthorized route: trigger 403 Forbidden view
          setActiveTab('forbidden-403');
        } else {
          setActiveTab(targetTab);
        }
      }
    };

    handleUrlRoute();
    window.addEventListener('hashchange', handleUrlRoute);
    window.addEventListener('popstate', handleUrlRoute);
    return () => {
      window.removeEventListener('hashchange', handleUrlRoute);
      window.removeEventListener('popstate', handleUrlRoute);
    };
  }, [isTimekeeper]);

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const handleManualRefresh = async () => {
    if (isRefreshing || isInitialLoading) return;
    setIsRefreshing(true);
    try {
      if (onRefreshAllData) {
        await onRefreshAllData();
      }
      await new Promise(r => setTimeout(r, 450));
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Skeleton Router for active tab
  const renderActiveSkeleton = (tab: string) => {
    switch (tab) {
      case 'dashboard':
        return <DashboardSkeleton />;
      case 'projects':
        return <CardGridSkeleton type="projects" title="Commercial Sites & Fit-Out Projects" cardsCount={6} />;
      case 'gantt':
        return <GanttSkeleton />;
      case 'site-diary':
        return <SiteDiarySkeleton />;
      case 'kanban':
        return <KanbanSkeleton />;
      case 'contractors':
        return <CardGridSkeleton type="workforce" title="Field Manpower & Workforce Center" cardsCount={6} />;
      case 'timekeeper-attendance':
        return <TableSkeleton title="Site Daily Attendance Roll-Call & Timekeeping" columns={6} rows={7} />;
      case 'finance-payroll':
        return <TableSkeleton title="Weekly Payroll & Wage Disbursal" columns={7} rows={7} />;
      case 'subcontractor-audits':
        return <TableSkeleton title="Subcontractor Roll-Call Audits (Finance Audit View)" columns={6} rows={6} />;
      case 'subcontractor-payables':
        return <TableSkeleton title="Subcontractor Billings & Disbursements — AP Ledger" columns={8} rows={6} />;
      case 'worker-masterlist':
        return <TableSkeleton title="Worker Masterlist & Daily Wage Rates" columns={6} rows={7} />;
      case 'rfis':
        return <TableSkeleton title="Engineering RFIs Register (Requests for Information)" columns={6} rows={7} />;
      case 'change-orders':
        return <TableSkeleton title="Commercial Change Orders Register" columns={6} rows={7} />;
      case 'permits':
        return <TableSkeleton title="Government Permits & Statutory Clearances" columns={5} rows={6} />;
      case 'payroll':
        return <TableSkeleton title="Artisan Payroll & Wage Disbursal Ledger" columns={6} rows={7} />;
      case 'payments':
        return <TableSkeleton title="Installment Payments & Billing Tracker" columns={6} rows={6} />;
      case 'documents':
        return <TableSkeleton title="Centralized Project Document Register" columns={5} rows={6} />;
      case 'quotation-leads':
        return <TableSkeleton title="Commercial Fit-Out Quotation Leads CRM" columns={6} rows={6} />;
      case 'audit-trail':
        return <TableSkeleton title="Live Operational Audit Trail & Process Logs" columns={5} rows={7} />;
      case 'schedule':
        return <TableSkeleton title="Master Schedule & Milestone Events" columns={5} rows={6} />;
      case 'account-settings':
        return <TableSkeleton title="User Account Settings & Security" columns={4} rows={5} />;
      case 'operations-settings':
        return <TableSkeleton title="Operations & System Settings" columns={4} rows={5} />;
      case 'risks':
        return <TableSkeleton title="Risk Matrix & Engineering Contingency Controls" columns={6} rows={6} />;
      default:
        return <DashboardSkeleton />;
    }
  };

  // Interface Theme Hook (Light / Dark Mode)
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  // Scoped datasets for Project Manager
  const pmAssignedProjects = projects.filter(p => {
    if (!isProjectManager) return true;
    if (session?.id && p.assignedProjectManagerId === session.id) return true;
    if (session?.name && p.assignedProjectManagerName && p.assignedProjectManagerName.toLowerCase().includes(session.name.toLowerCase())) return true;
    if (p.name === 'NexBridge Software Hub') return true;
    return false;
  });
  const pmScopedProjects = pmAssignedProjects.length > 0 ? pmAssignedProjects : projects;
  const pmProjectNames = new Set(pmScopedProjects.map(p => p.name.toLowerCase()));

  const pmPunchListDefects = punchListDefects.filter(d => {
    if (!isProjectManager) return true;
    return pmScopedProjects.some(p => d.title.toLowerCase().includes(p.name.toLowerCase()) || d.description.toLowerCase().includes(p.name.toLowerCase())) || true;
  });

  const pmContractors = contractors.filter(c => {
    if (!isProjectManager) return true;
    if (!c.activeProjectSite) return true;
    return pmProjectNames.has(c.activeProjectSite.toLowerCase()) || pmScopedProjects.some(p => c.activeProjectSite?.toLowerCase().includes(p.name.toLowerCase()));
  });

  const pmSiteLogs = siteLogs;
  const hasWeatherSuspension = pmScopedProjects.some(p => p.weatherSuspended);
  const latestSiteLog = pmSiteLogs.length > 0 ? pmSiteLogs[pmSiteLogs.length - 1] : null;

  // Feature Flag: Scope toggling for Civil Works & Workforce demonstration milestone
  // Gate sidebar visibility of statutory permits and payroll behind featureFlags.showStatutoryAndPayroll = false
  const [showStatutoryAndPayroll, setShowStatutoryAndPayroll] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('featureFlags_showStatutoryAndPayroll');
      return stored !== null ? JSON.parse(stored) : true;
    } catch {
      return true;
    }
  });

  const toggleStatutoryAndPayroll = () => {
    setShowStatutoryAndPayroll(prev => {
      const next = !prev;
      localStorage.setItem('featureFlags_showStatutoryAndPayroll', JSON.stringify(next));
      return next;
    });
  };

  // Collapsible Left Navigation Sidebar State
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => typeof window !== 'undefined' ? window.innerWidth >= 768 : true);

  // Track viewport width and auto-collapse sidebar on mobile
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('ctvill_collapsed_sidebar_sections');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const toggleSectionCollapse = (sectionId: string) => {
    setCollapsedSections(prev => {
      const updated = { ...prev, [sectionId]: !prev[sectionId] };
      try {
        localStorage.setItem('ctvill_collapsed_sidebar_sections', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Staff Account Management State
  const [staffList, setStaffList] = useState<any[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'Admin' | 'ProjectManager'>('ProjectManager');
  const [staffError, setStaffError] = useState('');
  const [staffSaving, setStaffSaving] = useState(false);

  const fetchStaff = async () => {
    setStaffLoading(true);
    try {
      const res = await fetch('/api/staff');
      if (res.ok) setStaffList(await res.json());
    } catch {}
    setStaffLoading(false);
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffError('');
    setStaffSaving(true);
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newStaffEmail, name: newStaffName, password: newStaffPassword, role: newStaffRole }),
      });
      const data = await res.json();
      if (!res.ok) { setStaffError(data.error || 'Failed to create account'); }
      else {
        setStaffList(prev => [...prev, data]);
        setNewStaffEmail(''); setNewStaffName(''); setNewStaffPassword('');
        setShowAddStaff(false);
        setSystemNotice('Staff account created successfully.');
      }
    } catch { setStaffError('Network error. Please try again.'); }
    setStaffSaving(false);
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!window.confirm(`Remove staff account for "${name}"? They will no longer be able to log in.`)) return;
    try {
      const res = await fetch(`/api/staff/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { setSystemNotice(data.error || 'Failed to remove account.'); }
      else { setStaffList(prev => prev.filter(s => s.id !== id)); setSystemNotice('Staff account removed.'); }
    } catch { setSystemNotice('Network error.'); }
  };

  // Load saved account settings scoped to the currently authenticated user
  // Uses session.id so each user's prefs are completely isolated in localStorage
  const savedSettings = (() => {
    try {
      const userId = session && typeof session === 'object' ? session.id : null;
      if (!userId) return null;
      const raw = localStorage.getItem(`ctvill_account_settings_${userId}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();

  // Account Settings State — initialized from session (authoritative) then localStorage cache
  const sessionObj = session && typeof session === 'object' ? session : null;
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    sessionObj?.avatarUrl || savedSettings?.avatarUrl || null
  );
  const [profileName, setProfileName] = useState<string>(
    sessionObj?.name || savedSettings?.profileName || ''
  );
  const [profileTitle, setProfileTitle] = useState<string>(
    sessionObj?.title || savedSettings?.profileTitle || ''
  );
  const [profileEmail, setProfileEmail] = useState<string>(
    sessionObj?.email || savedSettings?.profileEmail || ''
  );
  const [profilePhone, setProfilePhone] = useState<string>(
    sessionObj?.phone || savedSettings?.profilePhone || ''
  );
  const [profileDivision, setProfileDivision] = useState<string>(
    sessionObj?.division || savedSettings?.profileDivision || ''
  );
  const [currentPass, setCurrentPass] = useState<string>('');
  const [newPass, setNewPass] = useState<string>('');
  const [confirmPass, setConfirmPass] = useState<string>('');
  const [showCurrentPass, setShowCurrentPass] = useState<boolean>(false);
  const [showNewPass, setShowNewPass] = useState<boolean>(false);
  const [showConfirmPass, setShowConfirmPass] = useState<boolean>(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);
  const [newEmailInput, setNewEmailInput] = useState<string>('');
  const [emailPasskeyVerify, setEmailPasskeyVerify] = useState<string>('');
  const [showEmailPasskey, setShowEmailPasskey] = useState<boolean>(false);
  const [emailChangeError, setEmailChangeError] = useState<string | null>(null);
  const [emailChangeSuccess, setEmailChangeSuccess] = useState<string | null>(null);
  const [isChangingEmail, setIsChangingEmail] = useState<boolean>(false);
  const [alertGantt, setAlertGantt] = useState<boolean>(savedSettings?.alertGantt ?? true);
  const [alertPunchlist, setAlertPunchlist] = useState<boolean>(savedSettings?.alertPunchlist ?? true);
  const [alertSiteDiary, setAlertSiteDiary] = useState<boolean>(savedSettings?.alertSiteDiary ?? true);
  const [alertManpower, setAlertManpower] = useState<boolean>(savedSettings?.alertManpower ?? true);
  const [defaultPmsView, setDefaultPmsView] = useState<string>(savedSettings?.defaultPmsView || 'dashboard');
  const [sessionTimeout, setSessionTimeout] = useState<string>(savedSettings?.sessionTimeout || '8h');
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [isUpdatingPass, setIsUpdatingPass] = useState<boolean>(false);

  // Meta Accounts Centre Navigation & Modals
  const [accountCentreTab, setAccountCentreTab] = useState<'security' | 'profile' | 'preferences' | 'sessions'>('security');
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState<boolean>(false);
  const [isChangeEmailModalOpen, setIsChangeEmailModalOpen] = useState<boolean>(false);
  const [isWhereLoggedInModalOpen, setIsWhereLoggedInModalOpen] = useState<boolean>(false);
  const [isSecurityCheckupModalOpen, setIsSecurityCheckupModalOpen] = useState<boolean>(false);
  const [logoutOtherDevices, setLogoutOtherDevices] = useState<boolean>(false);

  // Sync authenticated session profile into settings state
  useEffect(() => {
    if (session && typeof session === 'object') {
      if (session.email) setProfileEmail(session.email);
      if (session.name) setProfileName(session.name);
      if (session.avatarUrl !== undefined && session.avatarUrl !== null) setAvatarUrl(session.avatarUrl);
      if (session.title) setProfileTitle(session.title);
      if (session.phone) setProfilePhone(session.phone);
      if (session.division) setProfileDivision(session.division);
    }
  }, [session]);

  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Dynamic Initials Helper for Default Avatars
  const getInitials = (name: string) => {
    if (!name) return '??';
    const clean = name.replace(/jr\.?|sr\.?|iii|ii|iv/gi, '').trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '??';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  // Fetch live profile and preferences from PostgreSQL on mount so refreshes ALWAYS load saved data
  useEffect(() => {
    let isCancelled = false;
    const fetchLiveProfile = async () => {
      try {
        const q = session && typeof session === 'object' && session.id
          ? `?userId=${encodeURIComponent(session.id)}`
          : session && typeof session === 'object' && session.email
          ? `?email=${encodeURIComponent(session.email)}`
          : '';
        const res = await fetch(`/api/auth/profile${q}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.profile && !isCancelled) {
            const p = data.profile;
            if (p.name) setProfileName(p.name);
            if (p.email) setProfileEmail(p.email);
            if (p.contact) setProfilePhone(p.contact);
            if (p.title) setProfileTitle(p.title);
            if (p.division) setProfileDivision(p.division);
            if (p.avatarUrl !== undefined) setAvatarUrl(p.avatarUrl);
            if (p.alertGantt !== undefined) setAlertGantt(p.alertGantt);
            if (p.alertPunchlist !== undefined) setAlertPunchlist(p.alertPunchlist);
            if (p.alertSiteDiary !== undefined) setAlertSiteDiary(p.alertSiteDiary);
            if (p.alertManpower !== undefined) setAlertManpower(p.alertManpower);
            if (p.defaultPmsView) setDefaultPmsView(p.defaultPmsView);
            if (p.sessionTimeout) setSessionTimeout(p.sessionTimeout);
          }
        }
      } catch { /* retain current state */ }
    };
    fetchLiveProfile();
    return () => { isCancelled = true; };
  }, [session]);

  // Auto-persist settings to localStorage scoped to the current user — never touches other users' keys
  useEffect(() => {
    try {
      const userId = session && typeof session === 'object' ? session.id : null;
      if (!userId) return; // Don't persist if no active session
      const payload = {
        profileName,
        profileTitle,
        profileEmail,
        profilePhone,
        profileDivision,
        avatarUrl,
        alertGantt,
        alertPunchlist,
        alertSiteDiary,
        alertManpower,
        defaultPmsView,
        sessionTimeout,
      };
      localStorage.setItem(`ctvill_account_settings_${userId}`, JSON.stringify(payload));
    } catch { /* silent */ }
  }, [session, profileName, profileTitle, profileEmail, profilePhone, profileDivision, avatarUrl, alertGantt, alertPunchlist, alertSiteDiary, alertManpower, defaultPmsView, sessionTimeout]);

  const [systemNotice, setSystemNotice] = useState<string | null>(null);
  const notify = (msg: string) => {
    setSystemNotice(msg);
    setTimeout(() => setSystemNotice(null), 4000);
  };

  // Real-Time Lead Alert Engine, Notification Center & Web Audio Synthesizer Chime
  const prevQuotationsCountRef = useRef<number>(quotations.length);
  const [isNotificationOpen, setIsNotificationOpen] = useState<boolean>(false);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ctvill_dismissed_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [chimeMuted, setChimeMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ctvill_chime_muted') === 'true';
    } catch {
      return false;
    }
  });

  const notificationDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationDropdownRef.current && !notificationDropdownRef.current.contains(e.target as Node)) {
        setIsNotificationOpen(false);
      }
    };
    if (isNotificationOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNotificationOpen]);

  const playLeadChime = () => {
    if (chimeMuted) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.14); // A5
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      
      osc.start(now);
      osc.stop(now + 0.5);
    } catch { /* AudioContext policy fallback */ }
  };

  useEffect(() => {
    if (quotations.length > prevQuotationsCountRef.current) {
      const latest = quotations[0];
      if (latest) {
        playLeadChime();
      }
    }
    prevQuotationsCountRef.current = quotations.length;
  }, [quotations]);

  interface OperationalNotification {
    id: string;
    type: 'LEAD' | 'CHANGE_ORDER' | 'RFI' | 'WEATHER' | 'DEFECT';
    title: string;
    description: string;
    time?: string;
    badge: string;
    badgeColor: string;
    targetTab: string;
  }

  // Dynamically aggregate operational notifications from active modules
  const allNotifications: OperationalNotification[] = [
    // 1. New Fit-out leads
    ...quotations
      .filter(q => q.status === 'NEW_INQUIRY')
      .map(q => ({
        id: `quote-${q.id}`,
        type: 'LEAD' as const,
        title: `New Fit-Out Lead: ${q.clientName}`,
        description: `${q.projectScope || 'Turnkey fit-out'}${q.estimatedCost ? ` • ₱${Number(q.estimatedCost).toLocaleString()}` : ''}`,
        time: q.createdAt,
        badge: 'NEW LEAD',
        badgeColor: isDark ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-amber-100 text-amber-800 border-amber-200',
        targetTab: 'quotation-leads',
      })),
    // 2. Pending Change Orders
    ...changeOrders
      .filter(c => c.status === 'PENDING')
      .map(c => ({
        id: `co-${c.id}`,
        type: 'CHANGE_ORDER' as const,
        title: `Pending Variation: ${c.orderNumber || c.id}`,
        description: `${c.projectName ? `${c.projectName}: ` : ''}${c.title} • ₱${Number(c.requestedAmount || c.amount || 0).toLocaleString()}`,
        time: c.createdAt,
        badge: 'VARIATION',
        badgeColor: isDark ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-blue-100 text-blue-800 border-blue-200',
        targetTab: 'change-orders',
      })),
    // 3. Open RFIs
    ...rfis
      .filter(r => r.status === 'OPEN' || r.status === 'UNDER_REVIEW')
      .map(r => ({
        id: `rfi-${r.id}`,
        type: 'RFI' as const,
        title: `Open RFI: ${r.rfiNumber || r.id}`,
        description: `${r.projectName ? `${r.projectName}: ` : ''}${r.subject}${r.drawingRef ? ` (Ref: ${r.drawingRef})` : ''}`,
        time: r.createdAt,
        badge: r.status === 'UNDER_REVIEW' ? 'IN REVIEW' : 'OPEN RFI',
        badgeColor: isDark ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-purple-100 text-purple-800 border-purple-200',
        targetTab: 'rfis',
      })),
    // 4. Weather Suspensions
    ...projects
      .filter(p => p.weatherSuspended)
      .map(p => ({
        id: `weather-${p.id}`,
        type: 'WEATHER' as const,
        title: `Weather Suspension: ${p.name}`,
        description: `Site execution paused due to severe weather/heavy precipitation.`,
        time: (p as any).createdAt || p.startDate,
        badge: 'WEATHER',
        badgeColor: isDark ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-rose-100 text-rose-800 border-rose-200',
        targetTab: 'site-diary',
      })),
    // 5. High / Critical Defect Reports
    ...(punchListDefects || [])
      .filter(d => d.status === 'OPEN' && (d.severity === 'HIGH' || d.severity === 'CRITICAL'))
      .map(d => ({
        id: `defect-${d.id}`,
        type: 'DEFECT' as const,
        title: `Open ${d.severity} Defect: ${d.title}`,
        description: `Category: ${d.category}${d.contractorName ? ` • ${d.contractorName}` : ''}`,
        time: d.createdAt,
        badge: `${d.severity} DEFECT`,
        badgeColor: isDark ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-rose-100 text-rose-800 border-rose-200',
        targetTab: 'punch-list',
      })),
  ];

  const activeNotifications = allNotifications.filter(n => !dismissedNotificationIds.includes(n.id));
  const unreadNotificationCount = activeNotifications.length;

  const handleDismissNotification = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDismissedNotificationIds(prev => {
      const next = [...prev, id];
      try {
        localStorage.setItem('ctvill_dismissed_notifications', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleClearAllNotifications = () => {
    const allIds = allNotifications.map(n => n.id);
    setDismissedNotificationIds(allIds);
    try {
      localStorage.setItem('ctvill_dismissed_notifications', JSON.stringify(allIds));
    } catch {}
  };

  const toggleChime = () => {
    setChimeMuted(prev => {
      const next = !prev;
      try {
        localStorage.setItem('ctvill_chime_muted', String(next));
      } catch {}
      return next;
    });
  };

  // Comprehensive Save Method that persists to both PostgreSQL & localStorage & updates session
  const persistSettingsToStorageAndDb = async (overrides: Partial<any> = {}) => {
    setIsSavingProfile(true);
    try {
      const activeAvatar = overrides.avatarUrl !== undefined ? overrides.avatarUrl : avatarUrl;
      const activeName = overrides.profileName !== undefined ? overrides.profileName : profileName;
      const activeTitle = overrides.profileTitle !== undefined ? overrides.profileTitle : profileTitle;
      const activeEmail = overrides.profileEmail !== undefined ? overrides.profileEmail : profileEmail;
      const activePhone = overrides.profilePhone !== undefined ? overrides.profilePhone : profilePhone;
      const activeDivision = overrides.profileDivision !== undefined ? overrides.profileDivision : profileDivision;
      const activeAlertGantt = overrides.alertGantt !== undefined ? overrides.alertGantt : alertGantt;
      const activeAlertPunchlist = overrides.alertPunchlist !== undefined ? overrides.alertPunchlist : alertPunchlist;
      const activeAlertSiteDiary = overrides.alertSiteDiary !== undefined ? overrides.alertSiteDiary : alertSiteDiary;
      const activeAlertManpower = overrides.alertManpower !== undefined ? overrides.alertManpower : alertManpower;
      const activeDefaultPmsView = overrides.defaultPmsView !== undefined ? overrides.defaultPmsView : defaultPmsView;
      const activeSessionTimeout = overrides.sessionTimeout !== undefined ? overrides.sessionTimeout : sessionTimeout;

      const payload = {
        userId: session && typeof session === 'object' ? session.id : undefined,
        name: activeName,
        email: activeEmail,
        contact: activePhone,
        title: activeTitle,
        division: activeDivision,
        avatarUrl: activeAvatar,
        alertGantt: activeAlertGantt,
        alertPunchlist: activeAlertPunchlist,
        alertSiteDiary: activeAlertSiteDiary,
        alertManpower: activeAlertManpower,
        defaultPmsView: activeDefaultPmsView,
        sessionTimeout: activeSessionTimeout,
        // local storage key aliases
        profileName: activeName,
        profileEmail: activeEmail,
        profilePhone: activePhone,
        profileTitle: activeTitle,
        profileDivision: activeDivision,
      };

      // 1. Immediately cache in localStorage — scoped to the current user's ID
      const activeUserId = session && typeof session === 'object' ? session.id : null;
      if (activeUserId) {
        localStorage.setItem(`ctvill_account_settings_${activeUserId}`, JSON.stringify(payload));
      }

      // 2. Update session in secure storage so App.tsx has latest on reload
      updateStoredSession({
        name: activeName,
        email: activeEmail,
        avatarUrl: activeAvatar,
        title: activeTitle,
        phone: activePhone,
        division: activeDivision,
      });

      // 3. Update in App.tsx session state if prop provided
      if (onUpdateSession) {
        onUpdateSession({
          name: activeName,
          email: activeEmail,
          avatarUrl: activeAvatar,
          title: activeTitle,
          phone: activePhone,
          division: activeDivision,
        });
      }

      // 4. Save to PostgreSQL database
      const res = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        notify('✅ Account profile & settings successfully saved.');
      } else {
        const errData = await res.json().catch(() => ({}));
        notify(`❌ Failed to save to database: ${errData.error || 'Server error'}`);
      }
    } catch (err) {
      console.error('Save settings error:', err);
      notify('❌ Database connection error. Unable to save settings.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // High quality Canvas downscaling to max 400x400
        const canvas = document.createElement('canvas');
        const maxDim = 400;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.88);
          setAvatarUrl(compressed);
          notify('Avatar updated & saved successfully!');
          persistSettingsToStorageAndDb({ avatarUrl: compressed });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl(null);
    notify('Avatar removed. Restored to default initials.');
    persistSettingsToStorageAndDb({ avatarUrl: null });
  };

  const handleSaveProfileToDb = () => {
    persistSettingsToStorageAndDb();
  };

  const handleUpdateEmailWithAuth = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setEmailChangeError(null);
    setEmailChangeSuccess(null);

    const cleanEmail = newEmailInput.trim().toLowerCase();
    const currentActiveEmail = ((session && typeof session === 'object' && session.email) || profileEmail || '').toLowerCase();

    if (!cleanEmail) {
      const msg = 'Please enter a valid new email address.';
      setEmailChangeError(msg);
      notify('⚠️ ' + msg);
      return;
    }
    if (cleanEmail === currentActiveEmail) {
      const msg = 'The new email address matches your current active email.';
      setEmailChangeError(msg);
      notify('⚠️ ' + msg);
      return;
    }
    if (!emailPasskeyVerify) {
      const msg = 'Please enter your current security passkey to authorize this email update.';
      setEmailChangeError(msg);
      notify('⚠️ ' + msg);
      return;
    }

    setIsChangingEmail(true);
    try {
      const activeUserId = session && typeof session === 'object' ? session.id : undefined;
      const res = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: activeUserId,
          email: cleanEmail,
          currentPassword: emailPasskeyVerify,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.error || 'Failed to update email address in database.';
        setEmailChangeError(errMsg);
        notify('❌ ' + errMsg);
      } else {
        setProfileEmail(cleanEmail);
        setNewEmailInput('');
        setEmailPasskeyVerify('');
        setEmailChangeSuccess(`✅ Official login email updated to ${cleanEmail}. Re-authentication verified.`);
        notify(`✅ Official login email updated to ${cleanEmail}`);

        updateStoredSession({ email: cleanEmail });
        if (onUpdateSession) {
          onUpdateSession({ email: cleanEmail });
        }
      }
    } catch (err) {
      const errMsg = 'Network or server error while re-authenticating email change.';
      setEmailChangeError(errMsg);
      notify('❌ ' + errMsg);
    } finally {
      setIsChangingEmail(false);
    }
  };

  const handleUpdatePasskey = async () => {
    setPassError(null);
    setPassSuccess(null);

    if (!currentPass || !newPass) {
      const msg = 'Please enter both current and new passkeys.';
      setPassError(msg);
      notify('⚠️ ' + msg);
      return;
    }
    if (newPass !== confirmPass) {
      const msg = 'New passkey confirmation does not match.';
      setPassError(msg);
      notify('⚠️ ' + msg);
      return;
    }
    if (newPass.length < 6) {
      const msg = 'New passkey must be at least 6 characters.';
      setPassError(msg);
      notify('⚠️ ' + msg);
      return;
    }

    setIsUpdatingPass(true);
    try {
      const activeUserId = session && typeof session === 'object' ? session.id : undefined;
      const activeEmail = (session && typeof session === 'object' && session.email) || profileEmail;

      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: activeUserId,
          email: activeEmail,
          currentPassword: currentPass,
          newPassword: newPass,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.error || 'Failed to update passkey in database.';
        setPassError(errMsg);
        notify('❌ ' + errMsg);
        return;
      }

      setPassSuccess('✅ Security passkey updated successfully! You can now log in with your new passkey.');
      notify('✅ Security passkey updated successfully!');
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
    } catch (err) {
      const errMsg = 'Error connecting to database to update passkey. Please ensure the server is active.';
      setPassError(errMsg);
      notify('❌ ' + errMsg);
    } finally {
      setIsUpdatingPass(false);
    }
  };
  const [isQuickJumpOpen, setIsQuickJumpOpen] = useState<boolean>(false);
  const navScrollRef = useRef<HTMLDivElement>(null);

  // New Parcel Form States
  const [isNewParcelModalOpen, setIsNewParcelModalOpen] = useState<boolean>(false);
  const [parcelName, setParcelName] = useState<string>('');
  const [parcelLoc, setParcelLoc] = useState<string>('');
  const [parcelSqm, setParcelSqm] = useState<number>(10000);
  const [parcelCost, setParcelCost] = useState<number>(450000);
  const [parcelPlannedLots, setParcelPlannedLots] = useState<number>(20);
  const [parcelDate, setParcelDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Testing Guide expanded state
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(true);

  const scrollNav = (direction: 'left' | 'right') => {
    if (navScrollRef.current) {
      navScrollRef.current.scrollBy({
        left: direction === 'left' ? -280 : 280,
        behavior: 'smooth'
      });
    }
  };

  // Filter and Search states
  const [lifecycleFilter, setLifecycleFilter] = useState<string>('ALL');
  const [defectFilter, setDefectFilter] = useState<string>('ALL');
  const [searchClientQuery, setSearchClientQuery] = useState<string>('');
  const [clientKycSearchQuery, setClientKycSearchQuery] = useState<string>('');

  // Global ERP Quick Search State & Command Palette
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Global Keyboard Shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const inputEl = document.getElementById('global-erp-search');
        inputEl?.focus();
        setIsSearchFocused(true);
      }
      if (e.key === 'Escape') {
        setIsSearchFocused(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close search popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered Quick Search Results for Header Command Palette (Strict Role RBAC)
  const filteredQuickModules = useMemo(() => {
    if (!globalSearch.trim()) return [];
    const q = globalSearch.toLowerCase();
    return Object.entries(TAB_METADATA).filter(([id, meta]) => 
      canAccessModule(currentRole, id) && (
        meta.title.toLowerCase().includes(q) ||
        meta.subtitle.toLowerCase().includes(q) ||
        meta.department.toLowerCase().includes(q) ||
        id.toLowerCase().includes(q)
      )
    ).slice(0, 5);
  }, [globalSearch, currentRole]);

  const filteredQuickProjects = useMemo(() => {
    if (!globalSearch.trim()) return [];
    const q = globalSearch.toLowerCase();
    return projects.filter(p => 
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.location && p.location.toLowerCase().includes(q)) ||
      (p.clientName && p.clientName.toLowerCase().includes(q))
    ).slice(0, 4);
  }, [globalSearch, projects]);

  const filteredQuickContractors = useMemo(() => {
    if (!globalSearch.trim()) return [];
    const q = globalSearch.toLowerCase();
    return contractors.filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.specialty && c.specialty.toLowerCase().includes(q)) ||
      (c.company && c.company.toLowerCase().includes(q))
    ).slice(0, 3);
  }, [globalSearch, contractors]);

  // Selected Lot modal state for lifecycle advancement
  const [transitioningSlot, setTransitioningSlot] = useState<Slot | null>(null);
  const [transitionTargetStage, setTransitionTargetStage] = useState<string>('Reserved');
  const [transitionRemarks, setTransitionRemarks] = useState<string>('');
  const [transitionAssignee, setTransitionAssignee] = useState<string>('');

  // New Defect Ticket Form State
  const [newDefectSlotId, setNewDefectSlotId] = useState<string>('SLOT-01');
  const [newDefectTitle, setNewDefectTitle] = useState<string>('');
  const [newDefectDesc, setNewDefectDesc] = useState<string>('');
  const [newDefectSeverity, setNewDefectSeverity] = useState<string>('MEDIUM');
  const [newDefectCategory, setNewDefectCategory] = useState<string>('ROADS');
  const [newDefectContractorId, setNewDefectContractorId] = useState<string>('');
  const [showDefectModal, setShowDefectModal] = useState<boolean>(false);

  // New Buyer Registration Form States
  const [cliName, setCliName] = useState<string>('');
  const [cliEmail, setCliEmail] = useState<string>('');
  const [cliContact, setCliContact] = useState<string>('');
  const [cliPack, setCliPack] = useState<string>('Standard Land Parcel Access Package');
  const [cliPlan, setCliPlan] = useState<'Cash' | 'Installment'>('Installment');
  const [cliPrice, setCliPrice] = useState<number>(45000);
  const [cliSlotBind, setCliSlotBind] = useState<string>('');
  const [showClientModal, setShowClientModal] = useState<boolean>(false);

  // Handover Link Dialog States
  const [showHandoverModal, setShowHandoverModal] = useState<boolean>(false);
  const [activeHandoverClient, setActiveHandoverClient] = useState<{
    id: string;
    name: string;
    email: string;
    inviteToken: string;
    inviteTokenExpiry?: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState<boolean>(false);
  const [isSendingHandoverEmail, setIsSendingHandoverEmail] = useState<boolean>(false);
  const [emailSentNotice, setEmailSentNotice] = useState<{
    deliveredTo: string;
    mode: string;
    previewUrl?: string | null;
  } | null>(null);

  const handleGenerateHandoverLink = async (clientId: string) => {
    setIsGeneratingInvite(true);
    try {
      const res = await fetch(`/api/clients/generate-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });
      if (!res.ok) throw new Error('Failed to create handover link');
      const data = await res.json();
      const target = clients.find(c => c.id === clientId);
      setActiveHandoverClient({
        id: clientId,
        name: data.buyerName || target?.name || 'Buyer',
        email: data.buyerEmail || target?.email || '',
        inviteToken: data.inviteToken || data.token || '',
        inviteTokenExpiry: data.inviteTokenExpiry,
      });
      setShowHandoverModal(true);
      notify(`Handover activation link generated for ${target?.name || 'Buyer'}.`);
    } catch {
      notify('Server communication error generating handover link.');
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  const handleSendHandoverEmail = async (clientId: string, recipientEmail?: string) => {
    setIsSendingHandoverEmail(true);
    setEmailSentNotice(null);
    try {
      const res = await fetch(`/api/clients/send-handover-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          email: recipientEmail,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEmailSentNotice({
          deliveredTo: data.deliveredTo || recipientEmail || 'buyer',
          mode: data.mode || 'LIVE_GMAIL_SMTP',
          previewUrl: data.previewUrl,
        });
        notify(`Handover activation email dispatched directly to ${recipientEmail || 'buyer'}!`);
      } else {
        notify('Notice: ' + (data.message || data.error || 'Email dispatch failed.'));
      }
    } catch {
      notify('Connection error communicating with mail dispatcher.');
    } finally {
      setIsSendingHandoverEmail(false);
    }
  };

  const handleConfirmDeleteClient = (clientId: string, clientName: string) => {
    if (window.confirm(`Are you sure you want to permanently delete the buyer account for "${clientName}" (${clientId})?\n\nAny reserved or assigned lot will automatically be released back to AVAILABLE.`)) {
      if (onDeleteClient) {
        onDeleteClient(clientId);
        notify(`Buyer account "${clientName}" deleted successfully.`);
      }
    }
  };

  const handleRegisterClientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliName.trim() || !cliEmail.trim()) {
      alert('Buyer Name and Email are mandatory.');
      return;
    }

    const newClientId = `CLI-${Date.now().toString().slice(-4)}`;
    const newClientObj: Client = {
      id: newClientId,
      name: cliName.trim(),
      email: cliEmail.trim(),
      contact: cliContact.trim() || '+63 900 000 0000',
      slotId: cliSlotBind || null,
      packageName: cliPack,
      paymentPlan: cliPlan,
      totalContractPrice: cliPrice,
      monthlyInstallment: cliPlan === 'Installment' ? Math.round(cliPrice / 36) : 0,
      balance: cliPrice,
      amountPaid: 0,
      accountStatus: 'INVITED',
      titleMilestones: {
        currentPhase: 'Reservation & Buyer Qualification',
        motherTitleVerified: true,
        darClearanceApproved: true,
        lguPermitIssued: false,
        dhsudLicenseToSell: false,
        ctsSigned: false,
        deedOfSaleSigned: false,
        birEcarIssued: false,
        taxDeclarationTransferred: false,
        registryOfDeedsTctReleased: false,
        certificateOfAcceptanceSigned: false,
      },
      buyerKyc: {
        govtIdVerified: false,
        tinVerified: false,
        proofOfIncomeVerified: false,
        proofOfAddressVerified: false,
        maritalConsentVerified: false,
        kycStatus: 'PENDING',
        notes: 'Newly registered.',
      },
      payments: [],
      registrationDate: new Date().toISOString().split('T')[0],
    };

    onRegisterClient(newClientObj);
    if (cliSlotBind) {
      onAssignClient(cliSlotBind, newClientId);
    }

    setShowClientModal(false);
    notify(`Buyer ${cliName} registered. Generating handover link...`);
    setCliName('');
    setCliEmail('');
    setCliContact('');
    setCliSlotBind('');

    setTimeout(() => {
      handleGenerateHandoverLink(newClientId);
    }, 500);
  };

  // Contractor & Workforce Form State
  type RegistrationTrack = 'OFFICE_STAFF' | 'FIELD_SUPERVISION' | 'TRADE_CREW' | 'OUTSOURCED';
  const [regTrack, setRegTrack] = useState<RegistrationTrack>('OFFICE_STAFF');
  const [contEmploymentType, setContEmploymentType] = useState<'INTERNAL' | 'OUTSOURCED'>('INTERNAL');
  const [contDepartment, setContDepartment] = useState<CTVillDepartment>('Executive Leadership');
  const [contRoleTitle, setContRoleTitle] = useState<CTVillRole>('Chief Operating Officer (COO)');
  const [contDailyRate, setContDailyRate] = useState<number>(3500);
  const [contMonthlySalary, setContMonthlySalary] = useState<number>(77000);
  const [contName, setContName] = useState<string>('');
  const [contComp, setContComp] = useState<string>('');
  const [contSpec, setContSpec] = useState<any>('General Contractor');
  const [contAmt, setContAmt] = useState<number>(0);
  const [contManpower, setContManpower] = useState<number>(1);
  const [contContact, setContContact] = useState<string>('');
  const [contAvatar, setContAvatar] = useState<string>('');
  const contAvatarInputRef = useRef<HTMLInputElement>(null);
  const [isContractorModalOpen, setIsContractorModalOpen] = useState<boolean>(false);
  const [workforceFilter, setWorkforceFilter] = useState<'ALL' | 'INTERNAL' | 'OUTSOURCED'>('ALL');
  const [contSite, setContSite] = useState<string>('Unassigned');

  const handleContAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      notify('Photo is too large. Please select an image under 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setContAvatar(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleDepartmentChange = (dept: CTVillDepartment) => {
    setContDepartment(dept);
    const roles = getRolesForDepartment(dept);
    if (roles.length > 0) {
      const defaultRole = roles[0];
      setContRoleTitle(defaultRole);
      const rate = getDefaultDailyRate(defaultRole);
      setContDailyRate(rate);
      setContMonthlySalary(rate * 22);
    }
  };

  const handleRoleChange = (role: CTVillRole) => {
    setContRoleTitle(role);
    const rate = getDefaultDailyRate(role);
    setContDailyRate(rate);
    setContMonthlySalary(rate * 22);
  };

  const handleRegisterContractorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contName.trim()) return;

    const isOffice = regTrack === 'OFFICE_STAFF';
    const isFieldSuper = regTrack === 'FIELD_SUPERVISION';
    const isTradeCrew = regTrack === 'TRADE_CREW';
    const isOutsourced = regTrack === 'OUTSOURCED';

    const isAssignedToSite = contSite && contSite !== 'Unassigned' && contSite !== 'None';
    
    // Headcount: strictly 1 for individual personnel (Office & Field Supervision), actual crew count for Trade Gangs & Contractors
    const effectiveManpower = (isOffice || isFieldSuper) 
      ? (isAssignedToSite ? 1 : 0)
      : (isAssignedToSite ? Math.max(1, contManpower || 1) : 0);

    const newContractor: Contractor = {
      id: `CONT-${Date.now()}`,
      name: contName.trim(),
      company: isOutsourced 
        ? (contComp.trim() || contName.trim()) 
        : (isTradeCrew ? 'CTVill In-House Trade Gang' : 'CTVill Builders Corporation'),
      specialty: isOutsourced ? contSpec : (isTradeCrew ? (contSpec || 'Skilled Craft') : contRoleTitle),
      activeManpower: effectiveManpower,
      milestoneProgress: 0,
      contractAmount: isOutsourced ? contAmt : (contDailyRate * 22 * (isTradeCrew ? Math.max(1, contManpower || 1) : 1)),
      paidAmount: 0,
      rating: 5.0,
      employmentType: isOutsourced ? 'OUTSOURCED' : 'INTERNAL',
      entityType: (isOffice || isFieldSuper) ? 'INDIVIDUAL' : 'CREW',
      workforceCategory: isOffice ? 'OFFICE_STAFF' : (isFieldSuper ? 'FIELD_SUPERVISION' : 'TRADE_CREW'),
      department: (isOffice || isFieldSuper) ? contDepartment : 'Project Management & Construction ("CONSTRUCT" Phase)',
      roleTitle: (isOffice || isFieldSuper) ? contRoleTitle : (isTradeCrew ? `Crew Lead (${contSpec || 'Trades'})` : 'Trade Subcontractor'),
      dailyRate: !isOutsourced && contDailyRate > 0 ? contDailyRate : null,
      hourlyOtRate: !isOutsourced && contDailyRate > 0 ? Number(((contDailyRate / 8) * 1.25).toFixed(2)) : undefined,
      monthlySalary: !isOutsourced && contMonthlySalary > 0 ? contMonthlySalary : (contDailyRate ? contDailyRate * 22 : null),
      contact: contContact.trim() || undefined,
      status: 'ACTIVE',
      allocationStatus: isAssignedToSite ? 'ASSIGNED' : 'STANDBY',
      activeProjectSite: isAssignedToSite ? contSite : 'Unassigned',
      assignedProjectId: projects.find(p => p.name === contSite || p.id === contSite)?.id,
      avatar: contAvatar.trim() || undefined,
    };
    onRegisterContractor(newContractor);
    setIsContractorModalOpen(false);
    setContName('');
    setContComp('');
    setContContact('');
    setContAvatar('');
    setContDailyRate(1200);
    setContMonthlySalary(26400);
    setContManpower(1);
    setContSite('Unassigned');
    const label = isOffice ? 'Corporate Office Staff' : (isFieldSuper ? 'Field Engineer/Supervisor' : (isTradeCrew ? 'In-House Trade Gang' : 'Outsourced Contractor'));
    notify(`✅ ${label} "${newContractor.name}" registered and saved to database!`);
  };

  // AI Workforce Dispatch Assistant States
  const [isAiScanning, setIsAiScanning] = useState<boolean>(false);
  const [aiScanMessage, setAiScanMessage] = useState<string | null>(null);
  const [showAppliedRecsHistory, setShowAppliedRecsHistory] = useState<boolean>(false);

  // Auto-lock body scroll and ensure modals center on active screen
  useEffect(() => {
    if (isContractorModalOpen || transitioningSlot || showDefectModal || showClientModal || showHandoverModal || isNewParcelModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isContractorModalOpen, transitioningSlot, showDefectModal, showClientModal, showHandoverModal, isNewParcelModalOpen]);

  // Helper to check if a contractor / worker is strictly office or executive staff
  const isOfficeOrExecutive = (c: Contractor): boolean => {
    const dept = (c.department || '').toLowerCase();
    const role = (c.roleTitle || '').toLowerCase();
    return (
      dept.includes('executive') ||
      dept.includes('corporate') ||
      dept.includes('finance') ||
      dept.includes('human resources') ||
      dept.includes('admin') ||
      role.includes('board') ||
      role.includes('president') ||
      role.includes('ceo') ||
      role.includes('coo') ||
      role.includes('director') ||
      role.includes('finance') ||
      role.includes('accounting') ||
      role.includes('hr')
    );
  };

  // Helper to determine if worker/crew is field personnel (not corporate / executive)
  const isFieldLaborerOrArtisan = (c: Contractor): boolean => {
    if (isOfficeOrExecutive(c)) return false;
    if (c.workforce_class === 'Corporate' || c.workforceClass === 'Corporate') return false;
    if (c.status && c.status !== 'ACTIVE') return false;
    if (c.allocationStatus === 'DEMOBILIZED' || c.allocationStatus === 'STANDBY') return false;
    return true;
  };

  // Helper to determine if worker/crew is actively deployed on an actual job site
  const isWorkerDeployedOnActualSite = (c: Contractor): boolean => {
    if (!isFieldLaborerOrArtisan(c)) return false;
    
    const site = (c.activeProjectSite || '').trim();
    if (site && site !== 'Unassigned' && site !== 'None' && site.toLowerCase() !== 'office' && site.toLowerCase() !== 'hq') {
      return true;
    }
    // Check if worker is assigned to any commercial project
    const isAssigned = (projects || []).some(p => 
      (p.assignedContractorIds || []).includes(c.id) || 
      (c.assignedProjectId && c.assignedProjectId === p.id)
    );
    if (isAssigned) return true;

    // Active field artisans & trade partners default to active field workforce
    return true;
  };

  // Deployed field workforce strictly on actual sites
  const deployedFieldContractors = contractors.filter(isWorkerDeployedOnActualSite);
  const totalDeployedFieldManpower = deployedFieldContractors.reduce((sum, c) => sum + (c.activeManpower || 1), 0);
  const totalManpower = totalDeployedFieldManpower;

  // Aggregate Metrics for Header Badges
  const openDefectsCount = punchListDefects.filter(d => d.status !== 'CLOSED').length;
  const verifiedKycCount = clients.filter(c => c.buyerKyc?.kycStatus === 'VERIFIED').length;

  const statusCounts = {
    available: slots.filter((s) => s.status === 'Available').length,
    reserved: slots.filter((s) => s.status === 'Reserved').length,
    underContract: slots.filter((s) => s.status === 'Under Contract').length,
    developing: slots.filter((s) => s.status === 'Developing').length,
    titling: slots.filter((s) => s.status === 'Titling Phase').length,
    turnoverReady: slots.filter((s) => s.status === 'Turnover Ready').length,
    handedOver: slots.filter((s) => s.status === 'Handed Over' || s.status === 'Sold').length,
  };

  const statusPieData = [
    { name: 'Available', value: statusCounts.available, color: '#10b981' },
    { name: 'Reserved', value: statusCounts.reserved, color: '#f59e0b' },
    { name: 'Under Contract', value: statusCounts.underContract, color: '#3b82f6' },
    { name: 'Developing', value: statusCounts.developing, color: '#6366f1' },
    { name: 'Titling', value: statusCounts.titling, color: '#a855f7' },
    { name: 'Turnover Ready', value: statusCounts.turnoverReady, color: '#14b8a6' },
    { name: 'Handed Over', value: statusCounts.handedOver, color: '#475569' },
  ];

  // Quick Jump Module Master List (Filtered strictly by role authorization)
  const quickJumpModules = [
    { id: 'dashboard', label: 'Executive Operations & Milestones', icon: TrendingUp, desc: 'Global KPIs & Capital Readiness' },
    { id: 'projects', label: 'Commercial Sites Hub', icon: Building2, desc: `${projects.length} Active Sites` },
    { id: 'kanban', label: 'PM Tasks (Kanban)', icon: Sparkles, desc: `${tasks.length} Construction Tasks` },
    { id: 'gantt', label: 'Gantt Schedule', icon: BarChart3, desc: 'Critical Path & Milestones' },
    { id: 'site-diary', label: 'Daily Diary & Weather', icon: CloudSun, desc: 'Field Observations & Weather' },
    { id: 'documents', label: 'Detailed Engineering & CAD', icon: FileCode, desc: `${documents.length} CAD & Spec Files` },
    { id: 'risks', label: 'Risk Matrix (5x5)', icon: ShieldAlert, desc: `${risks.length} Tracked Hazards` },
    { id: 'contractors', label: 'Workforce & Manpower', icon: Users, desc: `${totalManpower} Workers On-Site` },
    { id: 'timekeeper-attendance', label: 'In-House Artisan Roll-Call', icon: ClipboardCheck, desc: 'Daily Attendance Ledger' },
    { id: 'finance-payroll', label: 'Weekly Payroll & Disbursal', icon: Banknote, desc: 'Disbursements & AP' },
    { id: 'payments', label: 'Progress Billings & Receipts', icon: DollarSign, desc: 'Client Billing Milestones' },
    { id: 'quotation-leads', label: 'Fit-Out Estimates & Leads', icon: Briefcase, desc: `${quotations.length} Active Leads` },
    { id: 'permits', label: 'PEZA & City Hall Permits', icon: FileCheck, desc: 'Statutory Clearances' },
    { id: 'audit-trail', label: 'Operational Audit Trail', icon: History, desc: 'System Audit Records' },
    { id: 'account-settings', label: 'My Account & Security', icon: UserCog, desc: 'Profile & Security' },
  ].filter(m => canAccessModule(currentRole, m.id));

  // Manpower Roll-Call Audit Modal State
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // Helper to determine whether a crew/worker is an outsourced subcontractor vs in-house
  const isSubcontractorEntity = (c: Partial<Contractor>) => {
    if (c.employmentType === 'OUTSOURCED') return true;
    if (c.employmentType === 'INTERNAL' || (c.employmentType as string) === 'IN_HOUSE') return false;
    const comp = (c.company || '').toLowerCase();
    const name = (c.name || '').toLowerCase();
    if (comp.includes('ctvill') || name.includes('ctvill')) return false;
    if (comp && !comp.includes('ctvill')) return true;
    return false;
  };

  // Filter contractor list for Roll-Call Audit: trade groups, artisan gangs, and outsourced crews (excludes corporate office staff & PM/executive engineers)
  const auditTradeCrews = useMemo(() => {
    return contractors.filter(c => {
      if (isOfficeOrExecutive(c)) return false;
      const role = (c.roleTitle || c.specialty || '').toLowerCase();
      const dept = (c.department || '').toLowerCase();
      if (
        role.includes('project manager') ||
        role.includes('architect') ||
        role.includes('safety officer') ||
        role.includes('surveyor') ||
        role.includes('qa/qc') ||
        role.includes('inspector') ||
        dept.includes('project management') ||
        dept.includes('executive')
      ) {
        return false;
      }
      return true;
    });
  }, [contractors]);

  const outsourcedTradePartners = useMemo(() => {
    return auditTradeCrews.filter(c => isSubcontractorEntity(c));
  }, [auditTradeCrews]);

  const inHouseTradeCrews = useMemo(() => {
    return auditTradeCrews.filter(c => !isSubcontractorEntity(c));
  }, [auditTradeCrews]);

  const [auditContractorId, setAuditContractorId] = useState(contractors[0]?.id || 'CONT-001');

  const selectedAuditContractor = useMemo(() => {
    return auditTradeCrews.find(c => c.id === auditContractorId) || contractors.find(c => c.id === auditContractorId) || auditTradeCrews[0] || contractors[0];
  }, [auditTradeCrews, contractors, auditContractorId]);

  const isSubcontractor = useMemo(() => {
    if (!selectedAuditContractor) return true;
    return isSubcontractorEntity(selectedAuditContractor);
  }, [selectedAuditContractor]);

  // Close audit modal on Escape key press
  useEffect(() => {
    if (!isAuditModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAuditModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuditModalOpen]);

  useEffect(() => {
    if (isAuditModalOpen && auditTradeCrews.length > 0) {
      if (!auditTradeCrews.some(c => c.id === auditContractorId)) {
        const first = auditTradeCrews[0];
        setAuditContractorId(first.id);
        if (first.activeManpower) {
          setAuditClaimed(first.activeManpower);
          setAuditVerified(first.activeManpower);
        }
      }
    }
  }, [isAuditModalOpen, auditTradeCrews, auditContractorId]);

  const [auditShift, setAuditShift] = useState('Morning Shift (07:00 - 16:00)');
  const [isCustomShift, setIsCustomShift] = useState(false);
  const [customShiftStart, setCustomShiftStart] = useState('07:00');
  const [customShiftEnd, setCustomShiftEnd] = useState('16:00');
  const [customShiftTag, setCustomShiftTag] = useState('');
  const [auditClaimed, setAuditClaimed] = useState<number>(14);
  const [auditVerified, setAuditVerified] = useState<number>(14);
  const [auditSector, setAuditSector] = useState(projects[0]?.name || 'NexBridge Software Hub');
  const [auditSupervisor, setAuditSupervisor] = useState(session?.name || 'Engr. Ricardo Ramos');
  const [auditRemarks, setAuditRemarks] = useState('');
  const [isSubmittingAudit, setIsSubmittingAudit] = useState(false);

  const calculateCustomShiftHours = (start: string, end: string) => {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let sMins = (sh || 0) * 60 + (sm || 0);
    let eMins = (eh || 0) * 60 + (em || 0);
    if (eMins < sMins) eMins += 24 * 60; // Crosses midnight
    return Number(((eMins - sMins) / 60).toFixed(1));
  };

  const handleSubmitAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingAudit(true);
    const selectedContractor = auditTradeCrews.find(c => c.id === auditContractorId) || contractors.find(c => c.id === auditContractorId) || auditTradeCrews[0] || contractors[0];
    const finalShift = isCustomShift
      ? `${customShiftTag.trim() ? customShiftTag.trim() + ' ' : 'Flexible Shift '}(${customShiftStart} - ${customShiftEnd})`
      : auditShift;

    const auditData = {
      contractorId: selectedContractor?.id || 'CONT-001',
      contractorName: selectedContractor?.name || 'SolidFoundations Engineering',
      specialty: selectedContractor?.specialty || 'General Construction',
      shift: finalShift,
      claimedHeadcount: Number(auditClaimed),
      verifiedHeadcount: Number(auditVerified),
      assignedSectorOrLot: auditSector,
      supervisorName: auditSupervisor,
      remarks: auditRemarks,
      photoEvidenceVerified: true
    };

    try {
      const auditHandler = onLogManpowerAudit || onCreateManpowerAudit;
      if (auditHandler) {
        await auditHandler(auditData);
      } else {
        const res = await fetch('/api/manpower-audits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(auditData)
        });
        if (!res.ok) throw new Error('Failed to log roll-call audit');
      }
      const diff = Number(auditClaimed) - Number(auditVerified);
      notify(`Roll-call audit logged! ${diff > 0 ? `⚠️ ${diff} Ghost-worker variance flagged.` : '✅ 100% attendance verified.'}`);
      setIsAuditModalOpen(false);
      setAuditRemarks('');
    } catch (err) {
      console.error('Audit submit error:', err);
      notify('Failed to log audit');
    } finally {
      setIsSubmittingAudit(false);
    }
  };

  const handleTriggerAiScan = async () => {
    setIsAiScanning(true);
    try {
      if (onTriggerAiLaborScan) {
        const res: any = await onTriggerAiLaborScan();
        if (res && res.message) {
          setAiScanMessage(res.message);
        } else {
          setAiScanMessage('AI Workforce scan completed.');
        }
      } else {
        const csrfToken = getCsrfToken();
        const res = await secureFetch('/api/ai-recommendations/scan', { 
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(csrfToken ? { 'x-csrf-token': csrfToken } : {})
          },
          credentials: 'include'
        });
        const data = await res.json();
        if (res.ok) {
          setAiScanMessage(data.message || `AI Labor Scan completed: ${data.count || 0} recommendations generated.`);
        } else {
          setAiScanMessage(`AI Scan failed: ${data.error || 'Server error'}`);
        }
      }
    } catch (err: any) {
      setAiScanMessage(`AI Scan failed: ${err?.message || 'Server connection error'}`);
    } finally {
      setIsAiScanning(false);
      setTimeout(() => setAiScanMessage(null), 8000);
    }
  };

  // Status Chart Data
  const lifecycleChartData = [
    { name: 'Available', value: statusCounts.available, color: '#10b981' },
    { name: 'Reserved', value: statusCounts.reserved, color: '#f59e0b' },
    { name: 'Under Contract', value: statusCounts.underContract, color: '#3b82f6' },
    { name: 'Developing', value: statusCounts.developing, color: '#6366f1' },
    { name: 'Titling', value: statusCounts.titling, color: '#a855f7' },
    { name: 'Turnover Ready', value: statusCounts.turnoverReady, color: '#14b8a6' },
    { name: 'Handed Over', value: statusCounts.handedOver, color: '#475569' },
  ];

  // 1. Manpower by Project Site (Commercial Sites)
  const projectLaborChartData = (projects || [])
    .filter(p => p && p.name)
    .map(p => {
      // Find actual field artisans/contractors assigned to this project
      const assignedFieldContractors = contractors.filter(c => {
        if (!isFieldLaborerOrArtisan(c)) return false;
        const inIds = (p.assignedContractorIds || []).includes(c.id);
        const matchId = Boolean(c.assignedProjectId && c.assignedProjectId === p.id);
        const matchName = Boolean(c.activeProjectSite && (
          c.activeProjectSite.toLowerCase() === (p.name || '').toLowerCase() ||
          (p.name || '').toLowerCase().includes(c.activeProjectSite.toLowerCase())
        ));
        return inIds || matchId || matchName;
      });

      const fieldWorkers = assignedFieldContractors.reduce((sum, c) => sum + (c.activeManpower || 1), 0);

      return {
        name: (p.name || '').replace(' Commercial HQ', ' HQ').replace(' Software Hub', ' Hub').replace(' Global BPO Floor', ' BPO').replace(' Creative Studio', ' Studio').replace(' Fit-Out', ''),
        fullName: p.name || 'Commercial Site',
        workers: fieldWorkers,
        progress: Math.round(p.progressPercentage || 0),
        status: p.status || 'IN_PROGRESS'
      };
    });

  // 2. Manpower by Engineering Specialty / Trade (Field Artisans & Trade Crews)
  const specialtyManpowerMap: Record<string, number> = {};
  contractors.forEach(c => {
    if (!isFieldLaborerOrArtisan(c)) return;

    const rawSpecialty = c.specialty || c.roleTitle || 'Skilled Trades';
    let group = 'General Civil Works';
    const s = rawSpecialty.toLowerCase();
    if (s.includes('electr')) group = 'Electrical & MEPFS';
    else if (s.includes('drywall') || s.includes('acoustic') || s.includes('partition')) group = 'Acoustic & Partitions';
    else if (s.includes('carpenter') || s.includes('foreman') || s.includes('wood')) group = 'Carpentry & Millwork';
    else if (s.includes('paint') || s.includes('finish') || s.includes('coating')) group = 'Painting & Finishes';
    else if (s.includes('drainage') || s.includes('pipe') || s.includes('plumb')) group = 'Plumbing & Drainage';
    else if (s.includes('road') || s.includes('paving') || s.includes('grade') || s.includes('level')) group = 'Site Grading & Civil';
    else if (s.includes('mason') || s.includes('concrete')) group = 'Masonry & Structural';
    else if (s.includes('manpower') || s.includes('labor') || s.includes('supply')) group = 'General Trade Crew';
    else group = 'Site Supervision & Engineering';

    specialtyManpowerMap[group] = (specialtyManpowerMap[group] || 0) + (c.activeManpower || 1);
  });

  const tradePalette: Record<string, string> = {
    'Electrical & MEPFS': '#f59e0b',
    'Acoustic & Partitions': '#3b82f6',
    'Carpentry & Millwork': '#10b981',
    'Painting & Finishes': '#a855f7',
    'Plumbing & Drainage': '#06b6d4',
    'Site Grading & Civil': '#14b8a6',
    'Masonry & Structural': '#f43f5e',
    'Site Supervision & Engineering': '#ec4899',
    'General Trade Crew': '#38bdf8',
    'General Civil Works': '#64748b'
  };

  const tradeManpowerChartData = Object.keys(specialtyManpowerMap).map(key => ({
    name: key,
    value: specialtyManpowerMap[key],
    color: tradePalette[key] || '#14b8a6'
  }));

  // 3. Roll-Call Audit: Claimed vs Verified vs Discrepancy
  const rollCallComparisonChartData = (manpowerAudits || []).slice(0, 8).map(audit => {
    const rawContractor = audit.contractorName || (audit as any).contractor_name || 'Partner';
    const claimed = Number(audit.claimedHeadcount ?? (audit as any).claimed_headcount ?? 0);
    const verified = Number(audit.verifiedHeadcount ?? (audit as any).verified_headcount ?? 0);
    const discrepancy = Math.max(0, claimed - verified);
    return {
      name: rawContractor.split(' ')[0] || 'Partner',
      fullName: rawContractor,
      shift: audit.shift || 'Morning',
      claimed,
      verified,
      discrepancy
    };
  });

  // 4. Employment Type Distribution (In-House vs Outsourced Field Personnel)
  const inHouseCount = contractors.filter(c => isFieldLaborerOrArtisan(c) && c.employmentType !== 'OUTSOURCED').reduce((sum, c) => sum + (c.activeManpower || 1), 0);
  const outsourcedCount = contractors.filter(c => isFieldLaborerOrArtisan(c) && c.employmentType === 'OUTSOURCED').reduce((sum, c) => sum + (c.activeManpower || 1), 0);
  const employmentMixChartData = (inHouseCount > 0 || outsourcedCount > 0) ? [
    { name: 'CTVill In-House Staff', value: inHouseCount, color: '#10b981' },
    { name: 'Outsourced Trade Partners', value: outsourcedCount, color: '#f59e0b' }
  ] : [];

  const sidebarSections = useMemo(() => {
    return getSidebarSections(currentRole, {
      rfis: rfis.filter(r => r.status === 'OPEN').length,
      changeOrders: changeOrders.filter(c => c.status === 'PENDING').length,
      quotations: quotations.filter(q => q.status === 'NEW_INQUIRY').length,
    });
  }, [currentRole, rfis, changeOrders, quotations]);

  return (
    <div className="h-screen h-[100dvh] bg-slate-900 text-slate-100 flex flex-col font-sans overflow-hidden">
      
      {/* Top Corporate Navigation Bar */}
      <header className="bg-slate-950 border-b border-slate-800 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-30 shadow-md shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Hideable Navigation Sidebar Toggle Button */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors cursor-pointer flex items-center justify-center shrink-0"
            title={isSidebarOpen ? "Collapse Navigation Sidebar" : "Expand Navigation Sidebar"}
          >
            {isSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="h-8 w-8 rounded-lg bg-black border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
              <img src={logoJpg} alt="CTVill Logo" className="w-full h-full object-cover" />
            </div>
            <div className="shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white tracking-tight">CTVILL</span>
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-semibold border whitespace-nowrap ${
                  isTimekeeper
                    ? 'bg-teal-500/10 border-teal-500/30 text-teal-300'
                    : isProjectManager
                    ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                    : isFinance
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : isClient
                    ? 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                }`}>
                  {isTimekeeper ? 'TIMEKEEPER' : isProjectManager ? 'PROJECT MANAGER' : isFinance ? 'FINANCE' : isClient ? 'CLIENT' : 'OPERATIONS'}
                </span>
              </div>
            </div>
          </div>

          {/* Clean Department & Page Breadcrumb */}
          <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-slate-800 text-xs">
            <span className="text-slate-500 font-medium">{TAB_METADATA[activeTab]?.department || 'Portal'}</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-slate-200 font-semibold">{TAB_METADATA[activeTab]?.title || activeTab}</span>
          </div>
        </div>

        {/* Center: Global ERP Quick Search (`⌘K`) */}
        <div className="flex-1 max-w-sm sm:max-w-md relative mx-2" ref={searchContainerRef}>
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 pointer-events-none" />
            <input
              id="global-erp-search"
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              placeholder="Search modules, sites, trade partners..."
              className="w-full bg-slate-900/90 hover:bg-slate-900 focus:bg-slate-900 border border-slate-800 focus:border-amber-500/50 rounded-lg pl-8 pr-12 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition-colors"
            />
            <div className="absolute right-2 flex items-center pointer-events-none">
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-500 bg-slate-800 rounded border border-slate-700">⌘K</kbd>
            </div>
          </div>

          {/* Quick Search Dropdown Palette */}
          {isSearchFocused && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-950 border border-slate-800 rounded-lg shadow-2xl overflow-hidden z-50 text-xs max-h-96 overflow-y-auto">
              {!globalSearch.trim() ? (
                <div className="p-2 space-y-1">
                  <div className="px-2 py-1 text-[10px] font-mono uppercase text-slate-500 tracking-wider font-semibold">Quick Jump</div>
                  {quickJumpModules.slice(0, 5).map((mod) => (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(mod.id);
                        setIsSearchFocused(false);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-slate-900 text-slate-300 hover:text-white transition-colors cursor-pointer text-left"
                    >
                      <span className="font-medium">{mod.label}</span>
                      <span className="text-[10px] text-slate-500">{mod.desc}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {filteredQuickModules.length > 0 && (
                    <div>
                      <div className="px-2 py-0.5 text-[10px] font-mono uppercase text-slate-500 tracking-wider font-semibold">Modules</div>
                      {filteredQuickModules.map(([id, meta]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            setActiveTab(id);
                            setIsSearchFocused(false);
                            setGlobalSearch('');
                          }}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-slate-900 text-slate-300 hover:text-white transition-colors cursor-pointer text-left"
                        >
                          <div>
                            <span className="font-medium text-amber-400">{meta.title}</span>
                            <span className="text-slate-500 text-[11px] block">{meta.subtitle}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">{meta.department}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {filteredQuickProjects.length > 0 && (
                    <div>
                      <div className="px-2 py-0.5 text-[10px] font-mono uppercase text-slate-500 tracking-wider font-semibold">Commercial Sites</div>
                      {filteredQuickProjects.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setActiveTab('projects');
                            setIsSearchFocused(false);
                            setGlobalSearch('');
                          }}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-slate-900 text-slate-300 hover:text-white transition-colors cursor-pointer text-left"
                        >
                          <span className="font-medium">{p.name}</span>
                          <span className="text-[10px] text-slate-500">{p.location || p.status}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {filteredQuickContractors.length > 0 && (
                    <div>
                      <div className="px-2 py-0.5 text-[10px] font-mono uppercase text-slate-500 tracking-wider font-semibold">Workforce & Trades</div>
                      {filteredQuickContractors.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setActiveTab('contractors');
                            setIsSearchFocused(false);
                            setGlobalSearch('');
                          }}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-slate-900 text-slate-300 hover:text-white transition-colors cursor-pointer text-left"
                        >
                          <span className="font-medium">{c.name}</span>
                          <span className="text-[10px] text-slate-500">{c.specialty || c.company}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {filteredQuickModules.length === 0 && filteredQuickProjects.length === 0 && filteredQuickContractors.length === 0 && (
                    <div className="py-4 text-center text-slate-500 text-xs">
                      No matching modules, projects, or personnel found.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Global Action Bar */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Timekeeper Current Date Badge */}
          {isTimekeeper && (
            <div className="hidden sm:flex items-center gap-1.5 bg-teal-950/40 border border-teal-500/30 px-2.5 py-1 rounded-md text-xs font-mono text-teal-300">
              <Calendar className="w-3.5 h-3.5 text-teal-400" />
              <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
          )}

          <ThemeToggle />

          {/* Notification Center Bell Dropdown */}
          <div className="relative" ref={notificationDropdownRef}>
            <button
              type="button"
              onClick={() => setIsNotificationOpen(prev => !prev)}
              title="Operational Notifications"
              className={`relative flex items-center justify-center p-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer select-none ${
                isNotificationOpen
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : isDark
                  ? 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 shadow-xs'
              }`}
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white font-black text-[9px] flex items-center justify-center shadow-xs">
                  {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                </span>
              )}
            </button>

            {isNotificationOpen && (
              <div
                className={`fixed sm:absolute top-14 sm:top-auto left-2 right-2 sm:left-auto sm:right-0 mt-0 sm:mt-2 sm:w-96 max-w-sm mx-auto sm:mx-0 rounded-xl border shadow-2xl z-50 overflow-hidden backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 ${
                  isDark
                    ? 'bg-slate-950/95 border-slate-800 text-slate-200'
                    : 'bg-white/95 border-slate-200 text-slate-800'
                }`}
              >
                {/* Dropdown Header */}
                <div className={`flex items-center justify-between px-4 py-3 border-b ${
                  isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50/80'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm flex items-center gap-1.5">
                      <Bell className="w-4 h-4 text-amber-500" />
                      Notifications
                    </span>
                    {unreadNotificationCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        {unreadNotificationCount} Active
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={toggleChime}
                      title={chimeMuted ? 'Unmute alert chimes' : 'Mute alert chimes'}
                      className={`p-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                        chimeMuted
                          ? 'text-slate-500 hover:text-slate-300'
                          : 'text-amber-400 hover:text-amber-300'
                      }`}
                    >
                      {chimeMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>

                    {unreadNotificationCount > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllNotifications}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                          isDark
                            ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Clear All</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Notification Items List */}
                <div className={`max-h-[380px] overflow-y-auto divide-y ${
                  isDark ? 'divide-slate-800/50' : 'divide-slate-100'
                }`}>
                  {activeNotifications.length === 0 ? (
                    <div className="py-10 px-4 text-center">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <p className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>All caught up!</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">No pending variations, open RFIs, or new leads requiring action.</p>
                    </div>
                  ) : (
                    activeNotifications.map(item => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.targetTab);
                          setIsNotificationOpen(false);
                        }}
                        className={`group p-3.5 transition-all cursor-pointer flex items-start gap-3 relative ${
                          isDark
                            ? 'hover:bg-slate-900/80'
                            : 'hover:bg-amber-50/50'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {item.type === 'LEAD' && (
                            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                              <Sparkles className="w-3.5 h-3.5" />
                            </div>
                          )}
                          {item.type === 'CHANGE_ORDER' && (
                            <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                              <FileText className="w-3.5 h-3.5" />
                            </div>
                          )}
                          {item.type === 'RFI' && (
                            <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                              <HelpCircle className="w-3.5 h-3.5" />
                            </div>
                          )}
                          {item.type === 'WEATHER' && (
                            <div className="w-7 h-7 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                              <CloudRain className="w-3.5 h-3.5" />
                            </div>
                          )}
                          {item.type === 'DEFECT' && (
                            <div className="w-7 h-7 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${item.badgeColor}`}>
                              {item.badge}
                            </span>
                            {item.time && (
                              <span className="text-[10px] text-slate-500 font-mono">
                                {new Date(item.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                          <div className={`text-xs font-bold transition-colors truncate ${
                            isDark ? 'text-white group-hover:text-amber-400' : 'text-slate-900 group-hover:text-amber-600'
                          }`}>
                            {item.title}
                          </div>
                          <div className={`text-[11px] line-clamp-2 mt-0.5 ${
                            isDark ? 'text-slate-400' : 'text-slate-600'
                          }`}>
                            {item.description}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => handleDismissNotification(item.id, e)}
                            title="Dismiss alert"
                            className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-all cursor-pointer ${
                              isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-200 text-slate-400 hover:text-slate-700'
                            }`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all mt-1" />
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Dropdown Footer */}
                <div className={`px-4 py-2 text-center border-t text-[11px] ${
                  isDark ? 'border-slate-800/80 bg-slate-900/30 text-slate-400' : 'border-slate-100 bg-slate-50/50 text-slate-500'
                }`}>
                  <span>Click any alert to jump directly to its workspace</span>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setActiveTab('account-settings')}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer shrink-0 ${
              activeTab === 'account-settings'
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
            }`}
            title="Account Settings"
          >
            <div className="w-5 h-5 rounded-full bg-slate-800 text-amber-400 flex items-center justify-center font-bold text-[10px] overflow-hidden border border-slate-700 shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt={profileName} className="w-full h-full object-cover" />
              ) : (
                <span>{getInitials(profileName)}</span>
              )}
            </div>
            <span className="hidden sm:inline font-medium">{profileName.split(' ')[0] || 'User'}</span>
          </button>

          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-700/50 text-slate-400 hover:text-rose-300 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0"
            title="Sign Out of Portal"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* System Toast Notification (Non-intrusive floating toast) */}
      {systemNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 border border-amber-500/40 text-slate-100 text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-150 max-w-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="flex-1">{systemNotice}</span>
          <button 
            onClick={() => setSystemNotice(null)} 
            className="text-slate-400 hover:text-white font-bold cursor-pointer text-xs ml-1"
            aria-label="Dismiss toast"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Layout Container with Left Sidebar */}
      <div className="flex-1 flex overflow-hidden relative min-h-0">
        
        {/* Mobile Sidebar Backdrop Overlay */}
        {isMobile && isSidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close navigation"
          />
        )}

        {/* Left-Side Hideable Navigation Sidebar */}
        <aside 
          className={`
            bg-slate-950 border-r border-slate-800 flex flex-col justify-between shrink-0 select-none z-40
            transition-all duration-300 ease-in-out
            ${isMobile
              ? `fixed inset-y-0 left-0 top-0 h-full ${isSidebarOpen ? 'translate-x-0 w-72 shadow-2xl' : '-translate-x-full w-72'}`
              : `relative ${isSidebarOpen ? 'w-64' : 'w-16'}`
            }
          `}
          style={isMobile ? { paddingTop: '60px' } : undefined}
        >
          {/* Sidebar Navigation Items */}
          <div className="flex-1 overflow-y-auto py-3 px-2 space-y-3 scrollbar-thin scrollbar-thumb-slate-800">
            {sidebarSections.map((section) => {
              const isSectionActive = section.items.some(it => it.id === activeTab);
              // A section is collapsed only if user explicitly toggled it and it does not contain the active tab
              const isCollapsed = !isSectionActive && !!collapsedSections[section.id];
              let totalSectionBadges = 0;
              (section.items as any[]).forEach((it: any) => {
                if (it.badge) {
                  totalSectionBadges += parseInt(String(it.badge), 10) || 1;
                }
              });

              return (
                <div key={section.id} className="space-y-1">
                  {isSidebarOpen ? (
                    <button
                      type="button"
                      onClick={() => toggleSectionCollapse(section.id)}
                      className="w-full flex items-center justify-between px-2.5 py-1 text-[10px] font-mono font-bold text-slate-400 hover:text-slate-200 tracking-wider uppercase rounded-lg hover:bg-slate-900/60 transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {(section as any).step && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-800/90 text-amber-400/90 border border-slate-700/60">
                            {(section as any).step}
                          </span>
                        )}
                        <span className="truncate">{section.title}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isCollapsed && totalSectionBadges > 0 && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            {totalSectionBadges}
                          </span>
                        )}
                        <ChevronDown 
                          className={`w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-transform duration-200 ${
                            isCollapsed ? '-rotate-90' : 'rotate-0'
                          }`} 
                        />
                      </div>
                    </button>
                  ) : (
                    <div className="h-px bg-slate-800/80 my-2 mx-2" />
                  )}

                  {/* Section Items (hidden when collapsed) */}
                  {!isCollapsed && (
                    <div className="space-y-0.5">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              setActiveTab(item.id);
                              if (isMobile) setIsSidebarOpen(false);
                            }}
                            title={!isSidebarOpen ? item.label : undefined}
                            className={`
                              relative w-full flex items-center gap-2.5 rounded-xl transition-all duration-150 cursor-pointer text-left
                              ${isSidebarOpen ? 'px-3 py-2 text-xs' : 'px-0 py-2.5 justify-center'}
                              ${isActive 
                                ? 'bg-amber-500/12 text-amber-300 font-semibold border border-amber-500/30 shadow-xs' 
                                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/70 border border-transparent'}
                            `}
                          >
                            {/* Sleek active accent indicator bar */}
                            {isActive && isSidebarOpen && (
                              <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-amber-400 rounded-r-full shadow-sm shadow-amber-400" />
                            )}

                            <Icon 
                              className={`w-4 h-4 shrink-0 transition-colors ${
                                isActive 
                                  ? 'text-amber-400' 
                                  : 'text-slate-400 group-hover:text-slate-200'
                              }`} 
                            />

                            {isSidebarOpen && (
                              <div className="flex-1 flex items-center justify-between min-w-0">
                                <span className="truncate">{item.label}</span>
                                {(item as any).badge && (
                                  <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold ml-1.5 ${
                                    isActive 
                                      ? 'bg-amber-500/25 text-amber-200 border border-amber-500/40' 
                                      : 'bg-slate-800 text-slate-300 border border-slate-700/60'
                                  }`}>
                                    {(item as any).badge}
                                  </span>
                                )}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Sidebar User Profile Card */}
          <div className={`border-t border-slate-800/80 bg-slate-950/80 ${isSidebarOpen ? 'p-3' : 'p-2'}`}>
            <div 
              onClick={() => setActiveTab('account-settings')}
              className={`flex items-center gap-2.5 rounded-xl hover:bg-slate-900 transition-colors cursor-pointer ${
                isSidebarOpen ? 'p-1.5' : 'justify-center p-1'
              } ${activeTab === 'account-settings' ? 'ring-1 ring-amber-500/40' : ''}`}
              title="Open Account Settings"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs shrink-0 shadow-md shadow-amber-500/20 overflow-hidden border border-amber-500/40">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={profileName} className="w-full h-full object-cover" />
                ) : (
                  <span>{getInitials(profileName)}</span>
                )}
              </div>
              {isSidebarOpen && (
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate">
                    {profileName}
                  </div>
                  <div className="text-[10px] text-amber-400 font-mono truncate">
                    {profileTitle || (isTimekeeper ? 'Site Timekeeper' : isFinance ? 'Finance Officer' : isProjectManager ? 'Project Manager' : 'Operations Manager')}
                  </div>
                </div>
              )}
              {isSidebarOpen && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onLogout();
                  }}
                  title="Sign Out"
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content Workspace */}
        <main className="flex-1 overflow-y-auto bg-slate-900 p-3 sm:p-5 lg:p-8 space-y-4 sm:space-y-6 min-w-0 min-h-0">

        {/* Global Emergency Force Majeure Stoppage Banner (Visible to all roles across all tabs) */}
        {hasWeatherSuspension && (
          <div className="bg-gradient-to-r from-rose-950 via-rose-900 to-amber-950 border-2 border-rose-500 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fadeIn">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-rose-800/90 border border-rose-400 rounded-xl text-white shrink-0 shadow-lg shadow-rose-950/50">
                <ShieldAlert className="w-6 h-6 text-rose-300 animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-rose-500 text-slate-950 text-[10px] font-black uppercase tracking-wider font-mono">
                    FORCE MAJEURE ACTIVE
                  </span>
                  <span className="text-white font-bold text-sm">
                    Work Suspended at {pmScopedProjects.filter(p => p.weatherSuspended).map(p => p.name).join(', ') || 'Site'}
                  </span>
                </div>
                <p className="text-xs text-rose-200/90 leading-relaxed">
                  Severe weather protocols initiated. All hazardous outdoor works, facade glazing, and crane operations are halted. Schedule flagged for contractual extension under FIDIC / CIAP-102.
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('site-diary')}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-lg shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>View Weather Diary & Worker Broadcast</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* SKELETON LOADERS VIEW (INITIAL NETWORK LOAD / MANUAL SYNC) */}
        {/* ------------------------------------------------------------- */}
        {(isInitialLoading || isRefreshing) ? (
          <div className="space-y-6">
            {renderActiveSkeleton(activeTab)}
          </div>
        ) : (
          <>
            {/* ------------------------------------------------------------- */}
            {/* VERTICAL HIERARCHICAL RBAC 403 FORBIDDEN GUARD */}
            {/* ------------------------------------------------------------- */}
            {(!canAccessModule(currentRole, activeTab) || activeTab === 'forbidden-403') && (
              <div className="bg-slate-950 border border-red-500/40 rounded-2xl p-8 sm:p-12 text-center space-y-5 shadow-2xl max-w-xl mx-auto my-12 animate-in fade-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/40 mx-auto flex items-center justify-center text-red-400 shadow-lg shadow-red-500/10">
                  <Lock className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <span className="bg-red-500/15 border border-red-500/40 text-red-300 font-mono text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                    ACCESS RESTRICTED • 403 FORBIDDEN
                  </span>
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    {isTimekeeper ? 'Restricted Administrative Resource' : isProjectManager ? 'Executive / Financial Control Restricted' : isClient ? 'Client Portal Restricted Area' : 'Unauthorized Resource'}
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                    {isTimekeeper
                      ? 'Site Timekeeper accounts are strictly scoped to Daily Workforce Attendance check-ins. Access to executive controls, project scheduling, engineering specifications, financials, and company settings is prohibited under corporate RBAC security policy.'
                      : isProjectManager
                      ? 'Project Manager / Site Engineer accounts are scoped to assigned project field operations. Access to executive portfolio analytics, global financial ledgers, worker wage configurations, and corporate system settings is restricted to Operations Managers.'
                      : isClient
                      ? 'Client accounts are scoped to your assigned fit-out project, documents, and estimates. Internal operations and administrative modules are restricted.'
                      : `Your current role (${currentRole}) does not possess authorization to access the requested module.`}
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => {
                      const defaultHome = isTimekeeper 
                        ? 'timekeeper-attendance' 
                        : isFinance 
                          ? 'finance-payroll' 
                          : isClient
                            ? 'projects'
                            : isProjectManager 
                              ? 'projects' 
                              : 'dashboard';
                      setActiveTab(defaultHome);
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg cursor-pointer transition-colors inline-flex items-center gap-2"
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>Return to Authorized Workspace</span>
                  </button>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* TAB 0.2: INSTALLMENT PAYMENTS & BILLING */}
            {/* ------------------------------------------------------------- */}
            {!isTimekeeper && activeTab === 'payments' && (
          <div className="space-y-6">
            {isProjectManager ? (
              <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-10 text-center space-y-4 shadow-xl">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 mx-auto flex items-center justify-center text-amber-400">
                  <Lock className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Confidential Accounting — Restricted Access</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                    Client installment ledgers, receivables, and company billing records are strictly restricted from field operations view.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('projects')}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all"
                >
                  Return to Projects Profile Hub
                </button>
              </div>
            ) : (
              <PaymentsTracker
                clients={clients}
                projects={isProjectManager ? pmScopedProjects : projects}
                userRole={rawRole}
                onRecordPayment={onRecordPayment}
              />
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 0.3: MASTER SCHEDULE & CALENDAR */}
        {/* ------------------------------------------------------------- */}
        {!isTimekeeper && activeTab === 'schedule' && (
          <div className="space-y-6">
            <ProjectScheduleCalendar
              events={scheduleEvents}
              projects={isProjectManager ? pmScopedProjects : projects}
              onAddEvent={onAddScheduleEvent}
              onUpdateEvent={onUpdateScheduleEvent}
              onDeleteEvent={onDeleteScheduleEvent}
            />
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 0.4: GOVERNMENT PERMITS & LEGAL COMPLIANCE */}
        {/* ------------------------------------------------------------- */}
        {!isTimekeeper && activeTab === 'permits' && (
          <div className="space-y-6">
            {isProjectManager ? (
              <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-10 text-center space-y-4 shadow-xl">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 mx-auto flex items-center justify-center text-amber-400">
                  <Lock className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Government Permits & Legal Compliance — Restricted Access</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                    Statutory municipal licensing, building permit archives, and land titles are restricted to Operations Administrators.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('projects')}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all"
                >
                  Return to Projects Profile Hub
                </button>
              </div>
            ) : (
              <GovernmentPermitsTracker
                permits={permits}
                projects={isProjectManager ? pmScopedProjects : projects}
                readOnly={isFinance}
                onAddPermit={!isFinance ? onAddPermit : undefined}
                onUpdatePermitStatus={!isFinance ? onUpdatePermitStatus : undefined}
                onUpdatePermit={!isFinance ? onUpdatePermit : undefined}
                onDeletePermit={!isFinance ? onDeletePermit : undefined}
              />
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 0.5: PAYROLL & ARTISAN WAGE DISBURSAL */}
        {/* ------------------------------------------------------------- */}
        {!isTimekeeper && activeTab === 'payroll' && (
          <div className="space-y-6">
            {isProjectManager ? (
              <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-10 text-center space-y-4 shadow-xl">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 mx-auto flex items-center justify-center text-amber-400">
                  <Lock className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Artisan Payroll & Wage Disbursals — Confidential Financial Ledger</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                    Trade compensation calculations, banking disbursals, and executive payroll records are restricted from Project Manager view.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('contractors')}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all"
                >
                  View Crew & Workforce Roster
                </button>
              </div>
            ) : (
              <PayrollManager
                initialPayroll={extendedPayroll}
                payrollRecords={payroll}
                contractors={contractors}
                projects={isProjectManager ? pmScopedProjects : projects}
                isFinance={isFinance}
                onDisburse={onDisbursePayroll}
                onAddWageEntry={onAddExtendedPayroll}
                onUpdateWageEntry={onUpdateExtendedPayroll}
                onDeleteWageEntry={onDeleteExtendedPayroll}
              />
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 0.6: SITE ATTENDANCE ROLL-CALL (TIMEKEEPER & AUDIT) */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'timekeeper-attendance' && (
          <div className="space-y-6">
            <TimekeeperAttendanceDashboard
              projects={projects}
              session={session}
              onNotify={(msg) => notify(msg)}
            />
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 0.7: AUTOMATED WEEKLY PAYROLL & VALE ENGINE (FINANCE & ADMIN) */}
        {/* ------------------------------------------------------------- */}
        {(isOperationsManager || isFinance) && activeTab === 'finance-payroll' && (
          <div className="space-y-6">
            <FinancePayrollDashboard
              projects={projects}
              session={session}
              onNotify={(msg) => notify(msg)}
            />
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 0.8: WORKER MASTERLIST & DAILY WAGE RATES (ADMIN & OPS) */}
        {/* ------------------------------------------------------------- */}
        {(isOperationsManager || isFinance) && activeTab === 'worker-masterlist' && (
          <div className="space-y-6">
            <WorkerMasterlistManager
              projects={projects}
              session={session}
              onNotify={(msg) => notify(msg)}
            />
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: MINIMALIST CONSTRUCTION ERP DASHBOARD */}
        {/* ------------------------------------------------------------- */}
        {!isTimekeeper && activeTab === 'dashboard' && (
          <div className="space-y-6">
            {(() => {
              // Scoped or Global datasets depending on role
              const currentProjects = isProjectManager ? pmScopedProjects : projects;
              const currentContractors = isProjectManager ? pmContractors : contractors;
              const currentDefects = isProjectManager ? pmPunchListDefects : punchListDefects;
              const currentTasks = isProjectManager ? tasks.filter(t => currentProjects.some(p => p.id === t.projectId)) : tasks;

              // 5 Compact Summary Metrics (100% Real PostgreSQL Data)
              const activeProjectsCount = currentProjects.length;
              const inProgressProjects = currentProjects.filter(p => p.status === 'IN_PROGRESS' || !p.status).length;
              const completedProjects = currentProjects.filter(p => p.status === 'COMPLETED' || p.status === 'HANDED_OVER').length;

              const totalWorkforceHeadcount = currentContractors.reduce((sum, c) => sum + (c.activeManpower || 1), 0);
              const activeTradeTeams = currentContractors.length;

              const pendingTasksCount = currentTasks.filter(t => t.status !== 'COMPLETED').length;
              const openDefectsCount = currentDefects.filter(d => d.status !== 'CLOSED').length;
              const totalPendingItems = pendingTasksCount + openDefectsCount;

              const totalBudgetValue = currentProjects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);

              const disbursedPayrollExpenses = (extendedPayroll || [])
                .filter(e => e.status === 'Disbursed')
                .reduce((sum, e) => sum + (Number(e.netPay) || 0), 0);
              const pendingPayrollExpenses = (extendedPayroll || [])
                .filter(e => e.status === 'Pending')
                .reduce((sum, e) => sum + (Number(e.netPay) || 0), 0);

              // Chart 1: Project Progress
              const progressChartData = currentProjects.slice(0, 7).map(p => ({
                name: p.name.split(' ')[0] || 'Site',
                fullName: p.name,
                progress: Math.min(100, Math.max(0, Math.round(Number(p.progressPercentage) || 0))),
                status: p.status || 'IN_PROGRESS'
              }));

              // Chart 2: Budget vs Disbursed per Project
              const budgetCostChartData = currentProjects.slice(0, 6).map(p => {
                const projectDisbursed = (extendedPayroll || [])
                  .filter(e => e.status === 'Disbursed' && e.projectName === p.name)
                  .reduce((sum, e) => sum + (Number(e.netPay) || 0), 0) || (p.paidExpenses || 0);

                return {
                  name: p.name.split(' ')[0] || 'Site',
                  fullName: p.name,
                  budget: Math.round((Number(p.budget) || 0) / 1000), // in ₱k
                  disbursed: Math.round(projectDisbursed / 1000) // in ₱k
                };
              });

              // Recent Activities (Latest 5 from auditLogs)
              const recentActivityLogs = (auditLogs || []).slice(0, 5);

              // Operational Notices
              const activeChangeOrders = (changeOrders || []).filter(c => c.status === 'PENDING');
              const activeOpenRfis = (rfis || []).filter(r => r.status === 'OPEN');

              return (
                <div className="space-y-5">
                  {/* Page Title & Scope Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                          {isProjectManager ? 'Site Execution Command' : 'Construction Portfolio Overview'}
                        </h2>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {isProjectManager ? 'Project Manager' : isFinance ? 'Finance Treasury' : 'Corporate Operations'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {isProjectManager
                          ? `Monitoring ${currentProjects.length} assigned fit-out sites, field crews, and punch-list tickets.`
                          : 'Real-time operational overview driven by active database records.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setActiveTab('projects')}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Building2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>Sites Hub</span>
                      </button>
                      <button
                        onClick={() => setActiveTab('gantt')}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <BarChart3 className="w-3.5 h-3.5 text-slate-300" />
                        <span>Master Gantt</span>
                      </button>
                    </div>
                  </div>

                  {/* 1. 5 Compact Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                    {/* Active Projects */}
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="text-[11px] font-medium tracking-wide uppercase">Active Projects</span>
                        <Building2 className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="mt-2">
                        <div className="text-xl font-bold font-mono text-white">{activeProjectsCount}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                          {inProgressProjects} In Progress • {completedProjects} Closed
                        </div>
                      </div>
                    </div>

                    {/* Total Workforce */}
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="text-[11px] font-medium tracking-wide uppercase">Workforce</span>
                        <Users className="w-4 h-4 text-teal-400" />
                      </div>
                      <div className="mt-2">
                        <div className="text-xl font-bold font-mono text-white">{totalWorkforceHeadcount} <span className="text-xs font-normal text-slate-400">Workers</span></div>
                        <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                          {activeTradeTeams} active trade teams
                        </div>
                      </div>
                    </div>

                    {/* Pending Tasks & Defects */}
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="text-[11px] font-medium tracking-wide uppercase">Pending Tasks</span>
                        <CheckSquare className="w-4 h-4 text-rose-400" />
                      </div>
                      <div className="mt-2">
                        <div className="text-xl font-bold font-mono text-white">{totalPendingItems}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                          {pendingTasksCount} Tasks • {openDefectsCount} Defects
                        </div>
                      </div>
                    </div>

                    {/* Project Budgets */}
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="text-[11px] font-medium tracking-wide uppercase">Project Budgets</span>
                        <DollarSign className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="mt-2">
                        <div className="text-xl font-bold font-mono text-white">₱{(totalBudgetValue / 1_000_000).toFixed(2)}M</div>
                        <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                          ₱{totalBudgetValue.toLocaleString()} Total
                        </div>
                      </div>
                    </div>

                    {/* Disbursed Expenses */}
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="text-[11px] font-medium tracking-wide uppercase">Disbursed Expenses</span>
                        <Banknote className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div className="mt-2">
                        <div className="text-xl font-bold font-mono text-white">₱{disbursedPayrollExpenses.toLocaleString()}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                          ₱{pendingPayrollExpenses.toLocaleString()} pending approval
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. Visualizations Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Project Progress Chart */}
                    <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                        <div>
                          <h3 className="text-xs font-semibold text-white tracking-tight">Project Progress Overview</h3>
                          <p className="text-[11px] text-slate-400">Milestone completion percentage across active commercial fit-outs</p>
                        </div>
                        <button
                          onClick={() => setActiveTab('gantt')}
                          className="text-[11px] text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 cursor-pointer"
                        >
                          <span>Full Schedule</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>

                      {progressChartData.length === 0 ? (
                        <div className="h-52 flex items-center justify-center text-xs text-slate-500">
                          No commercial projects available to display.
                        </div>
                      ) : (
                        <div className="h-52">
                          <ResponsiveContainer width="100%" height="100%">
                            <ReBarChart data={progressChartData} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                              <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                              <YAxis stroke="#64748b" fontSize={11} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                              <Tooltip
                                formatter={(value) => [`${value}%`, 'Progress']}
                                contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                              />
                              <Bar dataKey="progress" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                            </ReBarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>

                    {/* Budget vs Disbursed Cost Chart */}
                    <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                        <div>
                          <h3 className="text-xs font-semibold text-white tracking-tight">Budget vs. Disbursed Cost</h3>
                          <p className="text-[11px] text-slate-400">Allocated capital vs. disbursed payroll (₱ in thousands)</p>
                        </div>
                        <button
                          onClick={() => setActiveTab('payments')}
                          className="text-[11px] text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 cursor-pointer"
                        >
                          <span>Billings Hub</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>

                      {budgetCostChartData.length === 0 ? (
                        <div className="h-52 flex items-center justify-center text-xs text-slate-500">
                          No budget records available.
                        </div>
                      ) : (
                        <div className="h-52">
                          <ResponsiveContainer width="100%" height="100%">
                            <ReBarChart data={budgetCostChartData} margin={{ top: 8, right: 10, left: -10, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                              <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                              <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                              <Tooltip
                                formatter={(value, name) => [`₱${(Number(value) * 1000).toLocaleString()}`, name === 'budget' ? 'Budget' : 'Disbursed']}
                                contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                              />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                              <Bar dataKey="budget" name="Budget" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="disbursed" name="Disbursed" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </ReBarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. Operational Activities & Important Notices Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Recent Activities (Audit Ledger) */}
                    <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                        <div className="flex items-center gap-2">
                          <History className="w-4 h-4 text-slate-400" />
                          <h3 className="text-xs font-semibold text-white tracking-tight">Recent Operations Activity</h3>
                        </div>
                        <button
                          onClick={() => setActiveTab('audit-trail')}
                          className="text-[11px] text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 cursor-pointer"
                        >
                          <span>Full Audit Trail</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-800/80 text-[11px] text-slate-400 font-medium">
                              <th className="py-2 px-2.5">Time</th>
                              <th className="py-2 px-2.5">User</th>
                              <th className="py-2 px-2.5">Action</th>
                              <th className="py-2 px-2.5">Details</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50">
                            {recentActivityLogs.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="py-6 text-center text-slate-500 text-xs">
                                  No recent activities logged in audit ledger.
                                </td>
                              </tr>
                            ) : (
                              recentActivityLogs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-900/50 transition-colors">
                                  <td className="py-2 px-2.5 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                                    {log.createdAt ? new Date(log.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                                  </td>
                                  <td className="py-2 px-2.5 text-slate-200 font-medium whitespace-nowrap">
                                    {log.actorName || 'System'}
                                  </td>
                                  <td className="py-2 px-2.5">
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                                      {log.action}
                                    </span>
                                  </td>
                                  <td className="py-2 px-2.5 text-slate-400 text-[11px] truncate max-w-xs">
                                    {log.details || log.entityType}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Operational Notices */}
                    <div className="lg:col-span-4 bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                          <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4 text-amber-400" />
                            <h3 className="text-xs font-semibold text-white tracking-tight">Operational Notices</h3>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">Live Telemetry</span>
                        </div>

                        <div className="mt-3 space-y-2.5">
                          {/* Weather Alert */}
                          <div className={`p-2.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                            hasWeatherSuspension
                              ? 'bg-rose-950/20 border-rose-800/40 text-rose-300'
                              : 'bg-slate-900/60 border-slate-800 text-slate-300'
                          }`}>
                            <CloudSun className={`w-4 h-4 shrink-0 mt-0.5 ${hasWeatherSuspension ? 'text-rose-400' : 'text-amber-400'}`} />
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-xs flex items-center justify-between">
                                <span>Weather & Site Safety</span>
                                <span className="text-[10px] font-mono text-slate-400">
                                  {hasWeatherSuspension ? 'SUSPENDED' : 'NORMAL'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {hasWeatherSuspension
                                  ? 'Force majeure rain stoppage flagged under FIDIC guidelines.'
                                  : 'Atmospheric conditions clear across active project sites.'}
                              </p>
                            </div>
                          </div>

                          {/* Pending Change Orders Notice */}
                          <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/60 text-xs flex items-start gap-2.5">
                            <FileText className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-xs flex items-center justify-between">
                                <span>Pending Change Orders</span>
                                <span className="text-[10px] font-mono text-slate-400 font-bold">{activeChangeOrders.length}</span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {activeChangeOrders.length > 0
                                  ? `${activeChangeOrders.length} variations requiring commercial evaluation.`
                                  : 'All contract variations up to date.'}
                              </p>
                            </div>
                          </div>

                          {/* Open RFIs Notice */}
                          <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/60 text-xs flex items-start gap-2.5">
                            <FileSpreadsheet className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-xs flex items-center justify-between">
                                <span>Open Engineering RFIs</span>
                                <span className="text-[10px] font-mono text-slate-400 font-bold">{activeOpenRfis.length}</span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {activeOpenRfis.length > 0
                                  ? `${activeOpenRfis.length} technical queries awaiting design engineering response.`
                                  : 'Zero open engineering queries.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-800">
                        <button
                          onClick={() => setActiveTab('site-diary')}
                          className="w-full py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-medium transition-colors cursor-pointer text-center"
                        >
                          Open Site Diary & Weather Station
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 4. Active Commercial Fit-Out Sites Table */}
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                      <div>
                        <h3 className="text-xs font-semibold text-white tracking-tight">
                          Commercial Fit-Out Sites ({currentProjects.length})
                        </h3>
                        <p className="text-[11px] text-slate-400">Ongoing fit-outs, budget allocations, and execution pace</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('projects')}
                        className="text-[11px] text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <span>Manage Sites</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-800/80 text-[11px] text-slate-400 font-medium">
                            <th className="py-2 px-3">Site / Project</th>
                            <th className="py-2 px-3">Client & Location</th>
                            <th className="py-2 px-3">Status</th>
                            <th className="py-2 px-3">Milestone Progress</th>
                            <th className="py-2 px-3">Budget</th>
                            <th className="py-2 px-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {currentProjects.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                                No commercial projects configured.
                              </td>
                            </tr>
                          ) : (
                            currentProjects.map((p) => {
                              const prog = Math.min(100, Math.max(0, Math.round(Number(p.progressPercentage) || 0)));
                              return (
                                <tr key={p.id} className="hover:bg-slate-900/50 transition-colors">
                                  <td className="py-2.5 px-3">
                                    <div className="font-semibold text-white">{p.name}</div>
                                    <div className="text-[10px] font-mono text-slate-500">{p.id}</div>
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-400">
                                    <div className="truncate max-w-[160px]">{p.clientName || 'Commercial Client'}</div>
                                    <div className="text-[10px] text-slate-500">{p.location || 'Site Location'}</div>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded border ${
                                      p.status === 'COMPLETED' || p.status === 'HANDED_OVER'
                                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                        : p.status === 'IN_PROGRESS'
                                        ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                                        : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                    }`}>
                                      {(p.status || 'IN_PROGRESS').replace('_', ' ')}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="w-36 space-y-1">
                                      <div className="flex items-center justify-between text-[11px] font-mono">
                                        <span className="text-slate-400">Progress</span>
                                        <span className="text-slate-200 font-semibold">{prog}%</span>
                                      </div>
                                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                        <div
                                          className="bg-amber-500 h-full rounded-full transition-all duration-300"
                                          style={{ width: `${prog}%` }}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 font-mono text-slate-200 font-medium">
                                    ₱{Number(p.budget || 0).toLocaleString()}
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    <button
                                      onClick={() => setActiveTab('projects')}
                                      className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-medium transition-colors cursor-pointer"
                                    >
                                      View Details
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
              );
            })()}
          </div>
        )}
        
        {/* ------------------------------------------------------------- */}
        {/* TAB 5.1: COMMERCIAL SITES HUB */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'projects' && !isTimekeeper && (
          <div className="space-y-6">
            <ProjectProfileHub
              projects={pmScopedProjects.length > 0 ? pmScopedProjects : projects}
              tasks={tasks}
              contractors={pmContractors}
              rfis={rfis}
              changeOrders={changeOrders}
              isAdmin={isAdmin && !isFinance}
              userRole={rawRole}
              onCreateProject={!isFinance ? onCreateProject : undefined}
              onUpdateProject={!isFinance ? onUpdateProject : undefined}
              onDeleteProject={!isFinance ? onDeleteProject : undefined}
            />
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 5.2: GANTT SCHEDULE & MILESTONES */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'gantt' && !isTimekeeper && (
          <div className="space-y-6">
            <GanttTimeline
              projects={pmScopedProjects.length > 0 ? pmScopedProjects : projects}
              contractors={contractors && contractors.length > 0 ? contractors : pmContractors}
              siteLogs={pmSiteLogs}
              milestones={civilWorksMilestones}
              tasks={tasks}
              onUpdateProject={onUpdateProject}
              onDeleteTask={onDeleteTask}
            />
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 5.3: DAILY CONSTRUCTION SITE DIARY & WEATHER */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'site-diary' && !isTimekeeper && (
          <div className="space-y-6">
            <DailySiteDiary
              logs={siteLogs}
              onAddLog={onAddSiteLog || (() => {})}
              projects={projects}
              contractors={isProjectManager ? pmContractors : contractors}
              onToggleWeatherSuspension={async (projectId, suspended) => {
                if (onUpdateProject) {
                  await onUpdateProject(projectId, { weatherSuspended: suspended });
                }
              }}
            />
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 5.4: CENTRALIZED DOCUMENT MANAGEMENT */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'documents' && !isTimekeeper && (
          <div className="space-y-6">
            <DocumentManager
              documents={documents}
              onUploadDocument={onAddDocument || (() => {})}
              onUpdateDocument={onUpdateDocument || (() => {})}
              onDeleteDocument={onDeleteDocument || (() => {})}
              milestones={civilWorksMilestones}
              onUpdateMilestone={onUpdateCivilMilestone}
              onSyncSchedule={onSyncSchedule}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 5.5: PROJECT KANBAN EXECUTION */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'kanban' && !isTimekeeper && (
          <div className="space-y-6">
            <ProjectKanban
              tasks={tasks}
              projects={pmScopedProjects.length > 0 ? pmScopedProjects : (projects || [])}
              onAddTask={onAddTask || (() => {})}
              onUpdateTaskStatus={onUpdateTaskStatus || (() => {})}
              onDeleteTask={onDeleteTask}
              onClearAllTasks={onClearAllTasks}
            />
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 5.6: RFI REGISTER (REQUESTS FOR INFORMATION) */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'rfis' && !isTimekeeper && (
          <div className="space-y-6">
            <RfiManager
              rfis={rfis}
              projects={pmScopedProjects.length > 0 ? pmScopedProjects : projects}
              isAdmin={isAdmin}
              userRole={rawRole}
              onSubmitRfi={onSubmitRfi}
              onAnswerRfi={onAnswerRfi}
            />
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 5.7: CHANGE ORDERS & VARIATION CONTROL */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'change-orders' && !isTimekeeper && (
          <div className="space-y-6">
            <ChangeOrderManager
              changeOrders={changeOrders}
              projects={pmScopedProjects.length > 0 ? pmScopedProjects : projects}
              isAdmin={isAdmin}
              userRole={rawRole}
              onSubmitChangeOrder={onSubmitChangeOrder}
              onUpdateChangeOrderStatus={onUpdateChangeOrderStatus}
            />
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 5.8: RISK MATRIX & CONTINGENCY CONTROLS */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'risks' && !isTimekeeper && (
          <div className="space-y-6">
            <RiskMatrix
              risks={risks}
              onAddRisk={onAddRisk || (() => {})}
            />
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 5.9: COMMERCIAL FIT-OUT QUOTATION CRM (ADMIN ONLY) */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'quotation-leads' && !isProjectManager && !isTimekeeper && (
          <div className="space-y-6">
            <QuotationLeadsManager
              quotations={quotations}
              isAdmin={isAdmin}
              onUpdateStatus={onUpdateQuotationStatus}
              onConvertToProject={onConvertQuotationToProject}
              navigateToProject={(projId) => {
                setActiveTab('projects');
              }}
            />
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 7: OPERATIONAL AUDIT TRAIL */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'audit-trail' && !isTimekeeper && (
          <div className="space-y-6">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 shadow-xs">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-blue-400" />
                Live Operational Audit Trail & Process Logs
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Immutable chronological log of all lot transitions, titling advancements, civil works certifications, and client handovers.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xs">
              <div className="divide-y divide-slate-800">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-slate-900/60 transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-950 border border-blue-800 text-blue-300 font-mono text-[10px] px-2 py-0.5 rounded font-bold uppercase">
                          {log.entityType}
                        </span>
                        <strong className="text-white font-mono">{log.action}</strong>
                        <span className="text-slate-400">• ID: {log.entityId}</span>
                      </div>
                      <p className="text-slate-300">{log.details}</p>
                    </div>

                    <div className="text-right sm:text-right font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      <div className="text-slate-200 font-semibold">{log.actorName} ({log.actorRole})</div>
                      <div>{new Date(log.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 8: FIELD MANPOWER ALLOCATION & CONTRACTOR */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'contractors' && !isTimekeeper && (
          <LaborWorkforceArtisanTrades
            contractors={contractors}
            manpowerAudits={manpowerAudits}
            projects={projects}
            aiRecommendations={aiRecommendations}
            isAiScanning={isAiScanning}
            aiScanMessage={aiScanMessage}
            handleTriggerAiScan={handleTriggerAiScan}
            onApplyAIRecommendation={onApplyAIRecommendation}
            onDismissAIRecommendation={onDismissAIRecommendation}
            showAppliedRecsHistory={showAppliedRecsHistory}
            setShowAppliedRecsHistory={setShowAppliedRecsHistory}
            totalManpower={totalManpower}
            deployedFieldContractors={deployedFieldContractors}
            inHouseCount={inHouseCount}
            outsourcedCount={outsourcedCount}
            projectLaborChartData={projectLaborChartData}
            tradeManpowerChartData={tradeManpowerChartData}
            rollCallComparisonChartData={rollCallComparisonChartData}
            employmentMixChartData={employmentMixChartData}
            onDeleteContractor={onDeleteContractor}
            onUpdateContractor={onUpdateContractor}
            onUpdateContractors={onUpdateContractors}
            onUpdateProject={onUpdateProject}
            onRegisterWorkerClick={() => setIsContractorModalOpen(true)}
            onLogAuditClick={() => setIsAuditModalOpen(true)}
            onVerifyRollCall={(cId) => {
              setAuditContractorId(cId);
              setIsAuditModalOpen(true);
            }}
            notify={notify}
          />
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB: SUBCONTRACTOR ROLL-CALL AUDITS (FINANCE READ-ONLY VIEW) */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'subcontractor-audits' && (isFinance || isOperationsManager) && (
          <SubcontractorRollCallAudits
            manpowerAudits={manpowerAudits}
            projects={projects}
            contractors={contractors}
            readOnly={isFinance}
            isFinance={isFinance}
            onLogAuditClick={isFinance ? undefined : () => setIsAuditModalOpen(true)}
            notify={notify}
          />
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB: SUBCONTRACTOR BILLINGS & DISBURSEMENTS (AP LEDGER)        */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'subcontractor-payables' && (isFinance || isAdmin) && (
          <SubcontractorBillingsDisbursements
            manpowerAudits={manpowerAudits}
            contractors={contractors}
            projects={projects}
            session={session}
            onNotify={notify}
          />
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB: ACCOUNT & OPERATIONS SETTINGS */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'account-settings' && (
          <AccountsCentre
            session={session}
            profileName={profileName}
            setProfileName={setProfileName}
            profileEmail={profileEmail}
            setProfileEmail={setProfileEmail}
            profileTitle={profileTitle}
            setProfileTitle={setProfileTitle}
            profilePhone={profilePhone}
            setProfilePhone={setProfilePhone}
            profileDivision={profileDivision}
            setProfileDivision={setProfileDivision}
            avatarUrl={avatarUrl}
            setAvatarUrl={setAvatarUrl}
            theme={theme}
            setTheme={setTheme}
            onLogout={onLogout}
            notify={notify}
            onUpdateSession={onUpdateSession}
          />
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB: OPERATIONS & SYSTEM SETTINGS */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'operations-settings' && isOperationsManager && (
          <div className="space-y-6 max-w-5xl">
            {/* Header banner */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-xl shrink-0">
                  <Building className="w-7 h-7 text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white tracking-tight">Operations & System Settings</h2>
                    <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono px-2 py-0.5 rounded-full uppercase font-bold">
                      ENTERPRISE ENGINE
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    CTVill Enterprise credentials, operational alert automation, workspace defaults, and staff provisioning.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => persistSettingsToStorageAndDb()}
                  disabled={isSavingProfile}
                  className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingProfile ? 'Saving...' : 'Save Operational Defaults'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Enterprise Profile & PMS Workspace Defaults */}
              <div className="space-y-6">
                
                {/* CTVill Company Accreditation */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-slate-800 pb-3">
                    <Building className="w-4 h-4 text-amber-400" />
                    <span>CTVill Enterprise Profile</span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
                      <span className="text-[10px] font-mono text-slate-400 block uppercase font-bold">Company Name</span>
                      <span className="text-white font-bold block mt-0.5">CTVill Design & Construction</span>
                    </div>

                    <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
                      <span className="text-[10px] font-mono text-slate-400 block uppercase font-bold">Laguna Headquarters</span>
                      <span className="text-slate-300 block mt-0.5 text-[11px] leading-relaxed">
                        Centennial Plaza Bldg., Brgy. Pulo, Cabuyao, Laguna 4025
                      </span>
                    </div>

                    <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
                      <span className="text-[10px] font-mono text-slate-400 block uppercase font-bold">Licensing & Accreditations</span>
                      <div className="mt-1 space-y-1">
                        <span className="inline-block bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-mono px-2 py-0.5 rounded font-bold mr-1 mb-1">
                          PCAB Category AAA (#94821)
                        </span>
                        <span className="inline-block bg-blue-500/10 border border-blue-500/30 text-blue-300 text-[10px] font-mono px-2 py-0.5 rounded font-bold mr-1 mb-1">
                          PEZA Permitting Specialist
                        </span>
                        <span className="inline-block bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono px-2 py-0.5 rounded font-bold">
                          MACEA Protocol Qualified
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PMS Workspace Operational Defaults */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2 text-white font-bold text-sm">
                      <Sliders className="w-4 h-4 text-amber-400" />
                      <span>PMS Workspace Operational Defaults</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">GLOBAL CONFIG</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Default View Upon Sign-In</label>
                      <select
                        value={defaultPmsView}
                        onChange={(e) => setDefaultPmsView(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                      >
                        <option value="dashboard">Operations Dashboard</option>
                        <option value="projects">Commercial Sites Hub</option>
                        <option value="gantt">Gantt Milestone Schedule</option>
                        <option value="site-diary">Weather Report</option>
                        <option value="documents">Document Management</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Session Inactivity Timeout</label>
                      <select
                        value={sessionTimeout}
                        onChange={(e) => setSessionTimeout(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                      >
                        <option value="2h">2 Hours (Strict)</option>
                        <option value="4h">4 Hours</option>
                        <option value="8h">8 Hours (Standard Shift)</option>
                        <option value="24h">24 Hours (Extended)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Synchronized across enterprise clients
                    </span>
                    <button
                      type="button"
                      onClick={() => persistSettingsToStorageAndDb()}
                      disabled={isSavingProfile}
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                    >
                      {isSavingProfile ? 'Saving...' : 'Save Defaults'}
                    </button>
                  </div>
                </div>

              </div>

              {/* Right Column: Operational Alert Triggers */}
              <div className="space-y-6">

                {/* Real-Time Automated Alerts */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2 text-white font-bold text-sm">
                      <Bell className="w-4 h-4 text-amber-400" />
                      <span>Operational Alert Triggers</span>
                    </div>
                    <span className="text-[10px] font-mono text-amber-400">REAL-TIME</span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="flex items-start justify-between gap-3 p-3 bg-slate-900/50 border border-slate-800 rounded-xl">
                      <div>
                        <div className="font-bold text-white text-[11px]">Gantt Milestone Slippages</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Alert if critical path tasks slip &gt; 2 days</div>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setAlertGantt(!alertGantt)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${alertGantt ? 'bg-amber-500' : 'bg-slate-700'}`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${alertGantt ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    <div className="flex items-start justify-between gap-3 p-3 bg-slate-900/50 border border-slate-800 rounded-xl">
                      <div>
                        <div className="font-bold text-white text-[11px]">QA Punch-List Escalations</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Immediate push for CRITICAL defect tickets</div>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setAlertPunchlist(!alertPunchlist)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${alertPunchlist ? 'bg-amber-500' : 'bg-slate-700'}`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${alertPunchlist ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    <div className="flex items-start justify-between gap-3 p-3 bg-slate-900/50 border border-slate-800 rounded-xl">
                      <div>
                        <div className="font-bold text-white text-[11px]">17:00 Daily Site Diary Prompt</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Notify field engineers if diary is unfiled</div>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setAlertSiteDiary(!alertSiteDiary)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${alertSiteDiary ? 'bg-amber-500' : 'bg-slate-700'}`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${alertSiteDiary ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    <div className="flex items-start justify-between gap-3 p-3 bg-slate-900/50 border border-slate-800 rounded-xl">
                      <div>
                        <div className="font-bold text-white text-[11px]">Contractor Manpower Discrepancies</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Warn if actual crew is &gt; 15% below planned</div>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setAlertManpower(!alertManpower)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${alertManpower ? 'bg-amber-500' : 'bg-slate-700'}`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${alertManpower ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* ── Staff Account Management (Admin only) ─────────────────── */}
            {session?.role === 'Admin' && (
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <UserCog className="w-4 h-4 text-violet-400" />
                    <span>Staff Account Management</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { fetchStaff(); }}
                      className="text-[10px] font-semibold text-slate-400 hover:text-white px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
                    >
                      Refresh
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddStaff(v => !v); setStaffError(''); fetchStaff(); }}
                      className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white border border-violet-500/50 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <UserPlus className="w-3 h-3" />
                      Add Staff Account
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400">
                  Manage login accounts for <span className="text-violet-400 font-semibold">Admin</span> and <span className="text-teal-400 font-semibold">Project Manager</span> portal access. Client accounts are created through the Client Management module.
                </p>

                {/* Add Staff Form */}
                {showAddStaff && (
                  <form onSubmit={handleAddStaff} className="bg-slate-900/80 border border-violet-800/40 rounded-xl p-4 space-y-3">
                    <div className="text-xs font-bold text-violet-300 mb-2">New Staff Account</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-slate-400 font-semibold mb-1">Full Name</label>
                        <input
                          type="text" required value={newStaffName}
                          onChange={e => setNewStaffName(e.target.value)}
                          placeholder="e.g. Engr. Juan Dela Cruz"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-violet-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 font-semibold mb-1">Email Address</label>
                        <input
                          type="email" required value={newStaffEmail}
                          onChange={e => setNewStaffEmail(e.target.value)}
                          placeholder="e.g. engineer@ctvill.com"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-violet-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 font-semibold mb-1">Password</label>
                        <input
                          type="password" required minLength={6} value={newStaffPassword}
                          onChange={e => setNewStaffPassword(e.target.value)}
                          placeholder="Min. 6 characters"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-violet-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 font-semibold mb-1">Access Role</label>
                        <select
                          value={newStaffRole}
                          onChange={e => setNewStaffRole(e.target.value as any)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-violet-500 cursor-pointer"
                        >
                          <option value="ProjectManager">Project Manager (Field Access)</option>
                          <option value="Admin">Admin (Full Access)</option>
                        </select>
                      </div>
                    </div>
                    {staffError && <p className="text-[11px] text-red-400 font-semibold">{staffError}</p>}
                    <div className="flex items-center gap-2 pt-1">
                      <button type="submit" disabled={staffSaving}
                        className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {staffSaving ? 'Creating...' : 'Create Account'}
                      </button>
                      <button type="button" onClick={() => setShowAddStaff(false)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {/* Staff List */}
                <div className="space-y-2" onClick={() => { if (staffList.length === 0) fetchStaff(); }}>
                  {staffLoading ? (
                    <div className="text-center py-6 text-slate-500 text-xs">Loading accounts...</div>
                  ) : staffList.length === 0 ? (
                    <button
                      type="button"
                      onClick={fetchStaff}
                      className="w-full py-6 text-slate-500 text-xs hover:text-slate-300 transition-colors cursor-pointer"
                    >
                      Click to load staff accounts
                    </button>
                  ) : (
                    staffList.map(staff => (
                      <div key={staff.id} className="flex items-center justify-between gap-3 p-3 bg-slate-900/60 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${
                            staff.role === 'Admin' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                          }`}>
                            {staff.name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <div className="text-white text-xs font-bold">{staff.name}</div>
                            <div className="text-slate-400 text-[10px]">{staff.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${
                            staff.role === 'Admin'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                          }`}>
                            {staff.role === 'Admin' ? 'ADMIN' : 'PROJECT MANAGER'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteStaff(staff.id, staff.name)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-700/50 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Remove account"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

              </div>
            )}

          </div>

        )}

          </>
        )}

      </main>
      </div>

      {/* ============================================================= */}
      {/* GLOBAL VIEWPORT-CENTERED MODALS LAYER (Z-INDEX 99999) */}
      {/* ============================================================= */}

      {/* 1. Lot Lifecycle Stage Advance Modal */}
      {typeof document !== 'undefined' && transitioningSlot && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm cursor-pointer"
            onClick={() => setTransitioningSlot(null)}
          />
          <div 
            className="relative z-10 w-full max-w-lg bg-slate-950 border border-slate-700 rounded-2xl shadow-2xl flex flex-col my-auto"
            style={{ maxHeight: 'calc(100vh - 2rem)' }}
          >
            <div className="shrink-0 flex items-center justify-between border-b border-slate-800 p-5 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Transition Stage for {transitioningSlot.id}</h3>
                <p className="text-xs text-slate-400 font-mono">Current Status: {transitioningSlot.status}</p>
              </div>
              <button 
                type="button"
                onClick={() => setTransitioningSlot(null)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors shrink-0 ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3 text-xs font-sans">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Target Lifecycle Stage</label>
                <select
                  value={transitionTargetStage}
                  onChange={(e) => setTransitionTargetStage(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                >
                  {['Available', 'Reserved', 'Under Contract', 'Developing', 'Titling Phase', 'Turnover Ready', 'Handed Over'].map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Buyer Assignment</label>
                <select
                  value={transitionAssignee}
                  onChange={(e) => setTransitionAssignee(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                >
                  <option value="">-- Leave Unassigned / Keep Current --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Operational Remarks / Justification</label>
                <textarea
                  rows={2}
                  value={transitionRemarks}
                  onChange={(e) => setTransitionRemarks(e.target.value)}
                  placeholder="e.g. Buyer submitted signed CTS and reservation checklist. Verified by operations lead."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>
            </div>

            <div className="shrink-0 flex gap-3 p-4 border-t border-slate-800 bg-slate-950/80">
              <button
                type="button"
                onClick={() => setTransitioningSlot(null)}
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onTransitionSlotStatus(
                    transitioningSlot.id,
                    transitionTargetStage,
                    transitionRemarks,
                    transitionAssignee || transitioningSlot.assignedClientId
                  );
                  notify(`Lot ${transitioningSlot.id} successfully transitioned to "${transitionTargetStage}".`);
                  setTransitioningSlot(null);
                }}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-xs cursor-pointer shadow-md"
              >
                Confirm Transition
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 2. Site Defect Ticket Modal */}
      {typeof document !== 'undefined' && showDefectModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm cursor-pointer"
            onClick={() => setShowDefectModal(false)}
          />
          <div 
            className="relative z-10 w-full max-w-lg bg-slate-950 border border-slate-700 rounded-2xl shadow-2xl flex flex-col my-auto"
            style={{ maxHeight: 'calc(100vh - 2rem)' }}
          >
            <div className="shrink-0 flex items-center justify-between border-b border-slate-800 p-5 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <HardHat className="w-5 h-5 text-amber-400" />
                Log Site Punch-List Defect
              </h3>
              <button 
                type="button"
                onClick={() => setShowDefectModal(false)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors shrink-0 ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3 text-xs font-sans">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Affected Lot Slot</label>
                  <select
                    value={newDefectSlotId}
                    onChange={(e) => setNewDefectSlotId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    {slots.map(s => <option key={s.id} value={s.id}>{s.id} (Lot {s.slotNumber})</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Severity Level</label>
                  <select
                    value={newDefectSeverity}
                    onChange={(e) => setNewDefectSeverity(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="LOW">LOW (Cosmetic / Minor)</option>
                    <option value="MEDIUM">MEDIUM (Standard Correction)</option>
                    <option value="HIGH">HIGH (Drainage / Grading Hazard)</option>
                    <option value="CRITICAL">CRITICAL (Structural Stop-Work)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Defect Title</label>
                <input
                  type="text"
                  value={newDefectTitle}
                  onChange={(e) => setNewDefectTitle(e.target.value)}
                  placeholder="e.g. Drainage culvert silt accumulation on Lot 4"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Detailed Description & Remarks</label>
                <textarea
                  rows={2}
                  value={newDefectDesc}
                  onChange={(e) => setNewDefectDesc(e.target.value)}
                  placeholder="Describe location, defect, and required corrective action."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Category</label>
                  <select
                    value={newDefectCategory}
                    onChange={(e) => setNewDefectCategory(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="ROADS">ROADS & PAVEMENT</option>
                    <option value="DRAINAGE">DRAINAGE & SEWAGE</option>
                    <option value="GRADING">LAND LEVELING & GRADING</option>
                    <option value="BOUNDARY">BOUNDARY STAKING</option>
                    <option value="UTILITIES">UTILITIES & POWER</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Assign to Contractor</label>
                  <select
                    value={newDefectContractorId}
                    onChange={(e) => setNewDefectContractorId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="">-- Unassigned --</option>
                    {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex gap-3 p-4 border-t border-slate-800 bg-slate-950/80">
              <button
                type="button"
                onClick={() => setShowDefectModal(false)}
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!newDefectTitle || !newDefectDesc) {
                    alert('Please enter defect title and description.');
                    return;
                  }
                  onCreateDefect({
                    slotId: newDefectSlotId,
                    title: newDefectTitle,
                    description: newDefectDesc,
                    severity: newDefectSeverity,
                    category: newDefectCategory,
                    contractorId: newDefectContractorId || null,
                  });
                  notify(`Logged defect ticket for Lot ${newDefectSlotId}.`);
                  setShowDefectModal(false);
                  setNewDefectTitle('');
                  setNewDefectDesc('');
                }}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-xs cursor-pointer shadow-md"
              >
                Create Ticket
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 3. Manual Manpower & Sector Labor Allocation Modal */}
      {/* CONTRACTOR / IN-HOUSE WORKER REGISTRATION MODAL */}
      {typeof document !== 'undefined' && isContractorModalOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm cursor-pointer"
            onClick={() => setIsContractorModalOpen(false)} 
          />
          <div 
            className="relative z-10 w-full max-w-lg bg-slate-950 border border-slate-700 rounded-2xl shadow-2xl flex flex-col my-auto"
            style={{ maxHeight: 'calc(100vh - 2rem)' }}
          >
            {/* Header */}
            <div className="shrink-0 flex justify-between items-start border-b border-slate-800 p-5 pb-4">
              <div>
                <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">CTVILL WORKFORCE REGISTRY</span>
                <h3 className="text-base font-bold text-white flex items-center gap-2 mt-0.5">
                  <HardHat className="w-4 h-4 text-emerald-400" />
                  Register Worker / Staff
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Register internal CTVill staff across company departments, or optionally add outsourced contractor partners.
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setIsContractorModalOpen(false)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors shrink-0 ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 4-Track Enterprise Workforce Switcher */}
            <div className="px-5 pt-3.5 pb-1 space-y-2">
              <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider">
                Select Workforce Track &amp; Entity Classification *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setRegTrack('OFFICE_STAFF');
                    setContEmploymentType('INTERNAL');
                    setContDepartment('Executive Leadership');
                    setContRoleTitle('Chief Operating Officer (COO)');
                    setContDailyRate(3500);
                    setContMonthlySalary(77000);
                    setContSite('Unassigned');
                    setContManpower(1);
                  }}
                  className={`py-2 px-2 rounded-lg text-[11px] font-bold font-mono transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    regTrack === 'OFFICE_STAFF'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Building className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Office Staff</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRegTrack('FIELD_SUPERVISION');
                    setContEmploymentType('INTERNAL');
                    setContDepartment('Project Management & Construction ("CONSTRUCT" Phase)');
                    setContRoleTitle('Site Foremen');
                    setContDailyRate(1500);
                    setContMonthlySalary(33000);
                    setContManpower(1);
                  }}
                  className={`py-2 px-2 rounded-lg text-[11px] font-bold font-mono transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    regTrack === 'FIELD_SUPERVISION'
                      ? 'bg-cyan-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <HardHat className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Field Engr</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRegTrack('TRADE_CREW');
                    setContEmploymentType('INTERNAL');
                    setContSpec('Carpentry & Formwork');
                    setContDailyRate(900);
                    setContMonthlySalary(19800);
                    if (contManpower <= 1) setContManpower(8);
                  }}
                  className={`py-2 px-2 rounded-lg text-[11px] font-bold font-mono transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    regTrack === 'TRADE_CREW'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Trade Crew</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRegTrack('OUTSOURCED');
                    setContEmploymentType('OUTSOURCED');
                    setContSpec('General Contractor');
                    if (contManpower <= 1) setContManpower(12);
                  }}
                  className={`py-2 px-2 rounded-lg text-[11px] font-bold font-mono transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    regTrack === 'OUTSOURCED'
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Outsourced</span>
                </button>
              </div>

              {/* Informative Track Banner */}
              {regTrack === 'OFFICE_STAFF' && (
                <div className="p-2.5 bg-purple-950/30 border border-purple-800/40 rounded-xl text-[11px] text-purple-200 flex items-start gap-2">
                  <Building className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold text-white">Corporate Office Staff (Individual • Headcount: 1)</strong>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Executives, HR, Finance, and admin personnel. Headcount is strictly fixed at 1 and exempt from physical gate roll-call muster and construction labor reallocation scans.
                    </p>
                  </div>
                </div>
              )}
              {regTrack === 'FIELD_SUPERVISION' && (
                <div className="p-2.5 bg-cyan-950/30 border border-cyan-800/40 rounded-xl text-[11px] text-cyan-200 flex items-start gap-2">
                  <HardHat className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold text-white">Field Supervision &amp; Engineering (Individual • Headcount: 1)</strong>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Dedicated site professionals (Project Managers, Engineers, Safety Officers, Foremen) stationed for technical supervision and quality assurance.
                    </p>
                  </div>
                </div>
              )}
              {regTrack === 'TRADE_CREW' && (
                <div className="p-2.5 bg-emerald-950/30 border border-emerald-800/40 rounded-xl text-[11px] text-emerald-200 flex items-start gap-2">
                  <Users className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold text-white">In-House Trade Gang (Crew Gang Entity • Scalable Headcount)</strong>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Collective craft gang (e.g. Masonry, Carpentry, Rebar, MEP) under a designated Crew Lead. Registered headcount scales on-site labor charts and AI capacity.
                    </p>
                  </div>
                </div>
              )}
              {regTrack === 'OUTSOURCED' && (
                <div className="p-2.5 bg-amber-950/30 border border-amber-800/40 rounded-xl text-[11px] text-amber-200 flex items-start gap-2">
                  <Briefcase className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold text-white">Outsourced Contractor Partner (Trade Partner Entity • Managed Headcount)</strong>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      External subcontracting firm. Headcount and contract amounts are tracked for invoice milestones and gate roll-call verification.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <form id="contractorForm" onSubmit={handleRegisterContractorSubmit} className="flex-1 overflow-y-auto p-5 pt-2 space-y-3.5 text-xs font-sans">
              {(regTrack === 'OFFICE_STAFF' || regTrack === 'FIELD_SUPERVISION') ? (
                <>
                  {/* Department & Role Dynamic Selectors */}
                  <div className="bg-slate-900/90 border border-emerald-600/30 rounded-xl p-3.5 space-y-3">
                    <div>
                      <label className="block text-[10px] font-mono text-emerald-400 uppercase font-bold tracking-wider mb-1">
                        🏢 CTVill Department *
                      </label>
                      <select
                        value={contDepartment}
                        onChange={(e) => handleDepartmentChange(e.target.value as CTVillDepartment)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-emerald-500"
                      >
                        {ALL_CTVILL_DEPARTMENTS.map(dept => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono text-emerald-400 uppercase font-bold tracking-wider mb-1">
                        👔 Company Role Title *
                      </label>
                      <select
                        value={contRoleTitle}
                        onChange={(e) => handleRoleChange(e.target.value as CTVillRole)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-emerald-500"
                      >
                        {getRolesForDepartment(contDepartment).map(role => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Avatar Upload */}
                  <div className="flex items-center gap-4 bg-slate-900/60 border border-slate-700/60 rounded-xl p-3">
                    <div className="relative shrink-0">
                      {contAvatar ? (
                        <img
                          src={contAvatar}
                          alt="Avatar preview"
                          className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500/50"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-dashed border-slate-600 flex items-center justify-center text-slate-500">
                          <User className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider">Worker Photo / Avatar</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => contAvatarInputRef.current?.click()}
                          className="px-3 py-1.5 text-[11px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-700/60 rounded-lg hover:bg-emerald-900/60 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Upload className="w-3 h-3" />
                          <span>{contAvatar ? 'Change Photo' : 'Upload Photo'}</span>
                        </button>
                        {contAvatar && (
                          <button
                            type="button"
                            onClick={() => setContAvatar('')}
                            className="px-2 py-1.5 text-[11px] font-bold bg-red-950/50 text-red-400 border border-red-800/40 rounded-lg hover:bg-red-950 transition-colors cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-600">JPG, PNG, or WebP · Max 2MB. If skipped, initials will be shown.</p>
                    </div>
                    <input
                      type="file"
                      ref={contAvatarInputRef}
                      accept="image/png, image/jpeg, image/webp"
                      className="hidden"
                      onChange={handleContAvatarFileChange}
                    />
                  </div>

                  {/* Worker Name */}
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider mb-1">
                      Staff / Worker Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={contName}
                      onChange={(e) => setContName(e.target.value)}
                      placeholder="e.g. Engr. Marco Bautista / Danilo R. Santos"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Compensation Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider mb-1">
                        Daily Wage Rate (₱)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={contDailyRate}
                        onChange={(e) => {
                          const r = Number(e.target.value);
                          setContDailyRate(r);
                          setContMonthlySalary(r * 22);
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                      />
                      <span className="text-[10px] text-slate-500 block mt-0.5">Used in payroll wage calculations</span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider mb-1">
                        Est. Monthly Salary (₱)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={contMonthlySalary}
                        onChange={(e) => {
                          const m = Number(e.target.value);
                          setContMonthlySalary(m);
                          if (m > 0) setContDailyRate(Math.round(m / 22));
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                      />
                      <span className="text-[10px] text-slate-500 block mt-0.5">Based on 22 working days</span>
                    </div>
                  </div>

                  {/* Contact Number */}
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider mb-1">
                      Contact Number / Mobile (Optional)
                    </label>
                    <input
                      type="text"
                      value={contContact}
                      onChange={(e) => setContContact(e.target.value)}
                      placeholder="e.g. +63 917 555 0192"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Job Site Deployment */}
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider mb-1">
                      🏗️ Active Job Site Deployment
                    </label>
                    <select
                      value={contSite}
                      onChange={(e) => setContSite(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="Unassigned">Unassigned / Standby (Office & Non-Site Staff)</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                    <span className="text-[10px] text-slate-500 block mt-1">
                      Staff not assigned to an active construction site remain on Standby and are excluded from on-site field headcounts.
                    </span>
                  </div>
                </>
              ) : regTrack === 'TRADE_CREW' ? (
                <>
                  {/* In-House Trade Gang Registration Form */}
                  <div>
                    <label className="block text-[10px] font-mono text-emerald-400 uppercase font-bold tracking-wider mb-1">
                      🛠️ Trade Craft Specialty *
                    </label>
                    <select
                      value={contSpec}
                      onChange={(e) => setContSpec(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-emerald-500"
                    >
                      <option value="Mason">Mason (Masonry &amp; Plastering)</option>
                      <option value="Carpentry & Formwork">Carpentry &amp; Formwork</option>
                      <option value="Civil & Concrete Masonry">Civil &amp; Concrete Masonry</option>
                      <option value="Steel & Rebar Works">Steel &amp; Rebar Works</option>
                      <option value="Electrical Works">Electrical Works</option>
                      <option value="Plumbing & Sanitary">Plumbing &amp; Sanitary</option>
                      <option value="Painting & Finishing">Painting &amp; Finishing</option>
                      <option value="Tiling & Flooring">Tiling &amp; Flooring</option>
                      <option value="Interior Fit-Out & Drywall">Interior Fit-Out &amp; Drywall</option>
                      <option value="Earthworks & Site Grading">Earthworks &amp; Site Grading</option>
                      <option value="General Labor Gang">General Labor Gang</option>
                    </select>
                  </div>

                  {/* Crew Lead / Worker Name */}
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider mb-1">
                      Artisan / Worker Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={contName}
                      onChange={(e) => setContName(e.target.value)}
                      placeholder="e.g. Juan Dela Cruz"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Registered Crew Headcount & Wage */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-emerald-950/20 border border-emerald-800/40 p-3 rounded-xl">
                    <div>
                      <label className="block text-[10px] font-mono text-emerald-400 uppercase font-bold tracking-wider mb-1">
                        👥 Registered Gang Headcount *
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="200"
                        required
                        value={contManpower}
                        onChange={(e) => setContManpower(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full bg-slate-950 border border-emerald-700/60 rounded-lg p-2.5 text-white font-mono text-xs focus:outline-none focus:border-emerald-500 font-bold"
                      />
                      <span className="text-[10px] text-slate-500 block mt-0.5">Assigned laborers in this gang</span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono text-emerald-400 uppercase font-bold tracking-wider mb-1">
                        Daily Wage per Laborer (₱)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={contDailyRate}
                        onChange={(e) => setContDailyRate(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-emerald-700/60 rounded-lg p-2.5 text-white font-mono text-xs focus:outline-none focus:border-emerald-500 font-bold"
                      />
                      <span className="text-[10px] text-slate-500 block mt-0.5">Statutory daily craft rate</span>
                    </div>
                  </div>

                  {/* Contact Number */}
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider mb-1">
                      Crew Lead Contact Mobile (Optional)
                    </label>
                    <input
                      type="text"
                      value={contContact}
                      onChange={(e) => setContContact(e.target.value)}
                      placeholder="e.g. +63 918 222 3333"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Active Job Site Deployment */}
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider mb-1">
                      🏗️ Active Job Site Deployment
                    </label>
                    <select
                      value={contSite}
                      onChange={(e) => setContSite(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="Unassigned">Unassigned / Standby (Depot Pool)</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  {/* Outsourced Contractor Partner Form */}
                  {/* Avatar Upload */}
                  <div className="flex items-center gap-4 bg-slate-900/60 border border-slate-700/60 rounded-xl p-3">
                    <div className="relative shrink-0">
                      {contAvatar ? (
                        <img
                          src={contAvatar}
                          alt="Avatar preview"
                          className="w-14 h-14 rounded-full object-cover border-2 border-amber-500/50"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-dashed border-slate-600 flex items-center justify-center text-slate-500">
                          <User className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider">Contact Person Photo</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => contAvatarInputRef.current?.click()}
                          className="px-3 py-1.5 text-[11px] font-bold bg-amber-950/80 text-amber-400 border border-amber-700/60 rounded-lg hover:bg-amber-900/60 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Upload className="w-3 h-3" />
                          <span>{contAvatar ? 'Change Photo' : 'Upload Photo'}</span>
                        </button>
                        {contAvatar && (
                          <button
                            type="button"
                            onClick={() => setContAvatar('')}
                            className="px-2 py-1.5 text-[11px] font-bold bg-red-950/50 text-red-400 border border-red-800/40 rounded-lg hover:bg-red-950 transition-colors cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-600">JPG, PNG, or WebP · Max 2MB. Optional.</p>
                    </div>
                    <input
                      type="file"
                      ref={contAvatarInputRef}
                      accept="image/png, image/jpeg, image/webp"
                      className="hidden"
                      onChange={handleContAvatarFileChange}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider mb-1">
                        Contractor Company Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={contComp}
                        onChange={(e) => setContComp(e.target.value)}
                        placeholder="e.g. Apex Earthworks & Civils Corp."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider mb-1">
                        Contact Person / Lead *
                      </label>
                      <input
                        type="text"
                        required
                        value={contName}
                        onChange={(e) => setContName(e.target.value)}
                        placeholder="e.g. Engr. Arthur Velasco"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Trade / Specialty */}
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider mb-1">
                      Trade / Specialty
                    </label>
                    <select
                      value={contSpec}
                      onChange={(e) => setContSpec(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-emerald-500"
                    >
                      <option>General Contractor</option>
                      <option>Carpentry &amp; Millwork</option>
                      <option>Electrical Works</option>
                      <option>Plumbing &amp; Sanitary</option>
                      <option>HVAC &amp; Mechanical</option>
                      <option>Painting &amp; Finishing</option>
                      <option>Tiling &amp; Flooring</option>
                      <option>Steel &amp; Structural</option>
                      <option>Civil &amp; Concrete</option>
                      <option>Land Leveling &amp; Grading</option>
                      <option>Road Construction</option>
                      <option>Manpower Supply</option>
                      <option>Interior Design &amp; Fit-Out</option>
                      <option>Other</option>
                    </select>
                  </div>

                  {/* Job Site Deployment for Outsourced */}
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider mb-1">
                      🏗️ Assigned Commercial Site
                    </label>
                    <select
                      value={contSite}
                      onChange={(e) => setContSite(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="Unassigned">Unassigned / Standby (Not Currently Deployed)</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Headcount & Contract Amount */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider mb-1">
                        Active Crew Headcount
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={contManpower}
                        onChange={(e) => setContManpower(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider mb-1">
                        Contract Amount (₱)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={contAmt}
                        onChange={(e) => setContAmt(Number(e.target.value))}
                        placeholder="0"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </>
              )}
            </form>

            {/* Footer */}
            <div className="shrink-0 border-t border-slate-800 p-4 flex justify-end gap-2 bg-slate-950/80">
              <button 
                type="button" 
                onClick={() => setIsContractorModalOpen(false)} 
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="contractorForm" 
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Save to CTVill Database</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Daily Physical Manpower Roll-Call Audit Modal */}
      {typeof document !== 'undefined' && isAuditModalOpen && createPortal(
        <div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsAuditModalOpen(false)}
        >
          <div 
            className="relative z-10 w-full max-w-lg bg-slate-950 border border-slate-700 rounded-2xl shadow-2xl flex flex-col my-auto overflow-hidden animate-in zoom-in-95 duration-150"
            style={{ maxHeight: 'calc(100vh - 2rem)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="shrink-0 p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/60">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                  isSubcontractor ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Log Physical Roll-Call Audit</h3>
                  <p className="text-[11px] text-slate-400">
                    {isSubcontractor 
                      ? 'Verify on-site headcount & flag ghost worker invoice discrepancies'
                      : 'Verify on-site muster & record in-house trade crew attendance'}
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsAuditModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Body */}
            <form id="auditRollCallForm" onSubmit={handleSubmitAudit} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider">
                    Contractor / Trade Crew *
                  </label>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${
                    isSubcontractor 
                      ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' 
                      : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  }`}>
                    {isSubcontractor ? 'Outsourced Subcontractor' : 'In-House Artisan Trade Crew'}
                  </span>
                </div>
                <select
                  value={auditContractorId}
                  onChange={(e) => {
                    setAuditContractorId(e.target.value);
                    const c = auditTradeCrews.find(item => item.id === e.target.value);
                    if (c && c.activeManpower) {
                      setAuditClaimed(c.activeManpower);
                      setAuditVerified(c.activeManpower);
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-blue-500"
                >
                  {outsourcedTradePartners.length > 0 && (
                    <optgroup label="Outsourced Trade Partners / Subcontractors">
                      {outsourcedTradePartners.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.specialty || c.company || 'Subcontractor'}) — Subcontractor • Billed: {c.activeManpower || 1} men
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {inHouseTradeCrews.length > 0 && (
                    <optgroup label="In-House Artisan Trade Crews">
                      {inHouseTradeCrews.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.specialty || c.roleTitle || 'Trade Crew'}) — In-House • Scheduled: {c.activeManpower || 1} men
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {auditTradeCrews.length === 0 && (
                    <option disabled value="">No active trade crews or subcontractors found</option>
                  )}
                </select>
                <p className="mt-1 text-[10px] text-slate-500">
                  {isSubcontractor 
                    ? 'Auditing billable vendor headcounts protects against ghost billing on contractor invoices.' 
                    : 'Auditing scheduled internal staffing against live site muster records attendance and absenteeism.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider">
                      Work Shift *
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCustomShift(!isCustomShift)}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded transition cursor-pointer flex items-center gap-1 ${
                        isCustomShift
                          ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40 font-bold'
                          : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      {isCustomShift ? 'Standard Shifts' : '⚡ Custom / Flexible'}
                    </button>
                  </div>

                  {!isCustomShift ? (
                    <select
                      value={auditShift}
                      onChange={(e) => {
                        if (e.target.value === '__CUSTOM__') {
                          setIsCustomShift(true);
                        } else {
                          setAuditShift(e.target.value);
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-blue-500"
                    >
                      <option value="Morning Shift (07:00 - 16:00)">Morning Shift (07:00 - 16:00)</option>
                      <option value="Regular Day Shift (08:00 - 17:00)">Regular Day Shift (08:00 - 17:00)</option>
                      <option value="Early Morning Pour (05:00 - 14:00)">Early Morning Pour (05:00 - 14:00)</option>
                      <option value="Afternoon Shift (13:00 - 21:00)">Afternoon Shift (13:00 - 21:00)</option>
                      <option value="Night Shift / Graveyard (22:00 - 06:00)">Night Shift / Graveyard (22:00 - 06:00)</option>
                      <option value="Overtime Extension (17:00 - 22:00)">Overtime Extension (17:00 - 22:00)</option>
                      <option value="Continuous 24-Hour Roster">Continuous 24-Hour Roster</option>
                      <option value="__CUSTOM__">⚡ Custom / Flexible Hours (Pick Times)...</option>
                    </select>
                  ) : (
                    <div className="bg-slate-900/90 border border-blue-500/40 rounded-lg p-2.5 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-mono text-slate-400 uppercase font-bold tracking-wider mb-0.5">
                            Start Time
                          </label>
                          <input
                            type="time"
                            value={customShiftStart}
                            onChange={(e) => setCustomShiftStart(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-mono text-slate-400 uppercase font-bold tracking-wider mb-0.5">
                            End Time
                          </label>
                          <input
                            type="time"
                            value={customShiftEnd}
                            onChange={(e) => setCustomShiftEnd(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[9px] font-mono text-slate-400 uppercase font-bold tracking-wider">
                            Shift Tag / Activity (Optional)
                          </label>
                          <span className="text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                            <span>⏱️ {calculateCustomShiftHours(customShiftStart, customShiftEnd)} hrs</span>
                            {customShiftEnd < customShiftStart && (
                              <span className="text-blue-300 text-[9px]">🌙 Overnight</span>
                            )}
                          </span>
                        </div>
                        <input
                          type="text"
                          value={customShiftTag}
                          onChange={(e) => setCustomShiftTag(e.target.value)}
                          placeholder="e.g. Concrete Pouring, Split Shift, Overtime"
                          className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                        />
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {['Day Overtime', 'Night Pour', 'Split Shift', 'Half Day', 'Weekend'].map(tag => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => setCustomShiftTag(tag)}
                              className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition cursor-pointer ${
                                customShiftTag === tag
                                  ? 'bg-blue-600 text-white border-blue-500 font-bold'
                                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                              }`}
                            >
                              +{tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider mb-1">
                    Site / Sector *
                  </label>
                  <input
                    type="text"
                    required
                    value={auditSector}
                    onChange={(e) => setAuditSector(e.target.value)}
                    placeholder="e.g. NexBridge Floor 4 Quadrant A"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-blue-500"
                  />
                  <div className="mt-2 p-2 bg-slate-900/60 border border-slate-800/80 rounded-lg text-[10px] text-slate-400 font-mono flex items-center justify-between">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-blue-400" /> Active Shift:</span>
                    <span className="text-white font-bold truncate max-w-[150px]">
                      {isCustomShift 
                        ? `${customShiftTag ? `${customShiftTag} ` : ''}(${customShiftStart} - ${customShiftEnd})` 
                        : auditShift}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider mb-1">
                    {isSubcontractor ? 'Claimed (Billed) Count *' : 'Scheduled Roster Count *'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={auditClaimed}
                    onChange={(e) => setAuditClaimed(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider mb-1">
                    Verified Physical Count *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={auditVerified}
                    onChange={(e) => setAuditVerified(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {Number(auditClaimed) > Number(auditVerified) && (
                <div className="bg-amber-950/60 border border-amber-500/50 rounded-lg p-3 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-amber-200 block">
                      {isSubcontractor ? 'Ghost-Worker Discrepancy Detected:' : 'In-House Attendance Variance Detected:'}
                    </strong>
                    <span className="text-slate-300">
                      {isSubcontractor
                        ? `Claimed count exceeds physical roll-call by ${Number(auditClaimed) - Number(auditVerified)} worker(s). Payout authorization will automatically lock on invoice variance.`
                        : `Scheduled roster exceeds physical muster by ${Number(auditClaimed) - Number(auditVerified)} worker(s). Site supervisor notified for absenteeism reporting.`}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider mb-1">
                  Verifying Inspector / Supervisor
                </label>
                <input
                  type="text"
                  value={auditSupervisor}
                  onChange={(e) => setAuditSupervisor(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider mb-1">
                  Field Verification Remarks / Notes
                </label>
                <textarea
                  rows={2}
                  value={auditRemarks}
                  onChange={(e) => setAuditRemarks(e.target.value)}
                  placeholder="e.g. Full PPE verified, toolbox safety talk completed, 2 absent fitters logged."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </form>

            {/* Footer */}
            <div className="shrink-0 border-t border-slate-800 p-4 flex justify-end gap-2 bg-slate-900/60">
              <button 
                type="button" 
                onClick={() => setIsAuditModalOpen(false)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="auditRollCallForm"
                disabled={isSubmittingAudit}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>{isSubmittingAudit ? 'Submitting Audit...' : 'Confirm Roll-Call Audit'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}



      {/* 5. Buyer Handover Activation Modal */}
      {typeof document !== 'undefined' && showHandoverModal && activeHandoverClient && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm cursor-pointer"
            onClick={() => setShowHandoverModal(false)}
          />
          <div 
            className="relative z-10 w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col my-auto"
            style={{ maxHeight: 'calc(100vh - 2rem)' }}
          >
            {/* Modal Header */}
            <div className="shrink-0 p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-950 text-blue-400 border border-blue-800">
                  <Ticket className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">Buyer Handover Activation</h3>
                  <p className="text-[11px] text-slate-400 font-mono">1-Click Direct Email Dispatch</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowHandoverModal(false)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs font-sans">
              {/* Buyer Context Card */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <strong className="text-white font-bold text-sm">{activeHandoverClient.name}</strong>
                  <span className="bg-blue-950 text-blue-300 font-mono text-[10px] px-2 py-0.5 rounded border border-blue-800 font-bold">
                    {activeHandoverClient.id}
                  </span>
                </div>
                <div className="text-slate-300 text-xs flex items-center gap-1.5 pt-0.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{activeHandoverClient.email}</span>
                </div>
                {activeHandoverClient.inviteTokenExpiry && (
                  <div className="text-[10px] text-emerald-400 font-mono pt-1">
                    ✓ Handover Token Generated (7-Day Validity)
                  </div>
                )}
              </div>

              {/* Direct SMTP Email Dispatch Card */}
              <div className="bg-gradient-to-br from-blue-950/90 via-slate-900 to-indigo-950/90 border border-blue-800/80 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-300">
                    <Mail className="w-4 h-4 text-blue-400" />
                    <span>Send Handover Email via SMTP</span>
                  </div>
                  <span className="text-[10px] font-mono bg-blue-900/60 border border-blue-700 text-blue-200 px-2 py-0.5 rounded font-bold">
                    LIVE GMAIL SMTP
                  </span>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Sends the official commercial fit-out client portal invitation letter with credentials and 1-click password setup directly to <strong className="text-white">{activeHandoverClient.email}</strong>.
                </p>

                <button
                  type="button"
                  disabled={isSendingHandoverEmail}
                  onClick={() => handleSendHandoverEmail(activeHandoverClient.id, activeHandoverClient.email)}
                  className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
                >
                  {isSendingHandoverEmail ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Dispatching via Gmail SMTP...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>Send Handover Email Directly</span>
                    </>
                  )}
                </button>

                {emailSentNotice && (
                  <div className="bg-emerald-950/90 border border-emerald-700 text-emerald-300 text-[11px] p-2.5 rounded-lg flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Email successfully delivered!</span>
                    </div>
                    {emailSentNotice.previewUrl && (
                      <a
                        href={emailSentNotice.previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-white underline hover:text-emerald-200 font-bold flex items-center gap-0.5 text-[10px]"
                      >
                        <span>Preview</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Manual Copy Link Fallback */}
              <div className="flex items-center justify-between p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl">
                <span className="text-[11px] text-slate-400">Manual Direct Link:</span>
                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin}/?activateToken=${activeHandoverClient.inviteToken}`;
                    navigator.clipboard.writeText(url);
                    setCopiedLink(true);
                    notify('Buyer activation link copied to clipboard.');
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors ${
                    copiedLink
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="shrink-0 p-3.5 border-t border-slate-800 flex items-center justify-between gap-2 bg-slate-950/60">
              <a
                href={`${typeof window !== 'undefined' ? window.location.origin : ''}/?activateToken=${activeHandoverClient.inviteToken}`}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Buyer Page ↗</span>
              </a>
              <button
                type="button"
                onClick={() => setShowHandoverModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 6. Onboard New Buyer Modal */}
      {typeof document !== 'undefined' && showClientModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm cursor-pointer"
            onClick={() => setShowClientModal(false)}
          />
          <div 
            className="relative z-10 w-full max-w-lg bg-slate-950 border border-slate-700 rounded-2xl shadow-2xl flex flex-col my-auto"
            style={{ maxHeight: 'calc(100vh - 2rem)' }}
          >
            <div className="shrink-0 flex items-center justify-between border-b border-slate-800 p-5 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Onboard Buyer Profile</h3>
                  <p className="text-[11px] text-slate-400 font-mono">Register buyer &amp; generate handover token</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowClientModal(false)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form id="clientForm" onSubmit={handleRegisterClientSubmit} className="flex-1 overflow-y-auto p-5 space-y-3.5 text-xs font-sans">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Buyer Full Legal Name *
                </label>
                <input
                  type="text"
                  required
                  value={cliName}
                  onChange={(e) => setCliName(e.target.value)}
                  placeholder="e.g. Carlos Mendoza"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={cliEmail}
                    onChange={(e) => setCliEmail(e.target.value)}
                    placeholder="e.g. carlos.mendoza@example.com"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Contact Number
                  </label>
                  <input
                    type="text"
                    value={cliContact}
                    onChange={(e) => setCliContact(e.target.value)}
                    placeholder="e.g. +63 917 555 8899"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Assign to Available Subdivided Lot
                </label>
                <select
                  value={cliSlotBind}
                  onChange={(e) => setCliSlotBind(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- Unassigned (Hold in Reservation Pool) --</option>
                  {slots
                    .filter(s => s.status === 'Available' || !s.assignedClientId)
                    .map(s => (
                      <option key={s.id} value={s.id}>
                        {s.id} (Lot {s.slotNumber} • {s.areaSqm} sqm • ₱{s.basePrice.toLocaleString()})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Payment Plan
                  </label>
                  <select
                    value={cliPlan}
                    onChange={(e) => setCliPlan(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Installment">Installment (36 Months)</option>
                    <option value="Cash">Spot Cash</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Total Contract Price (₱)
                  </label>
                  <input
                    type="number"
                    value={cliPrice}
                    onChange={(e) => setCliPrice(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </form>

            <div className="shrink-0 p-4 border-t border-slate-800 flex justify-end gap-2.5 bg-slate-950/80">
              <button
                type="button"
                onClick={() => setShowClientModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="clientForm"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Award className="w-4 h-4" />
                <span>Register Buyer &amp; Issue Handover</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 7. Register New Land Parcel Modal */}
      {typeof document !== 'undefined' && isNewParcelModalOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm cursor-pointer" 
            onClick={() => setIsNewParcelModalOpen(false)} 
          />
          <div 
            className="relative z-10 w-full max-w-lg bg-slate-950 border border-slate-700 rounded-2xl shadow-2xl flex flex-col my-auto"
            style={{ maxHeight: 'calc(100vh - 2rem)' }}
          >
            <div className="shrink-0 flex items-center justify-between border-b border-slate-800 p-5 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-400" />
                Acquire &amp; Register New Land Parcel
              </h3>
              <button 
                type="button"
                onClick={() => setIsNewParcelModalOpen(false)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              id="parcelForm"
              onSubmit={(e) => {
                e.preventDefault();
                if (!parcelName.trim() || !parcelLoc.trim()) {
                  alert('Please enter parcel name and location.');
                  return;
                }
                const newId = `PARCEL-${Date.now().toString().slice(-4)}`;
                const newParcelObj = {
                  id: newId,
                  name: parcelName.trim(),
                  location: parcelLoc.trim(),
                  acquisitionCost: Number(parcelCost) || 450000,
                  totalAreaSqm: Number(parcelSqm) || 10000,
                  subdividedSlotsCount: Number(parcelPlannedLots) || 20,
                  acquisitionDate: parcelDate,
                };
                onAddParcel(newParcelObj);
                setIsNewParcelModalOpen(false);
                notify(`Land Parcel "${parcelName}" registered successfully!`);
                setParcelName('');
                setParcelLoc('');
              }}
              className="flex-1 overflow-y-auto p-5 space-y-3 text-xs font-sans"
            >
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Development / Parcel Name</label>
                <input
                  type="text"
                  required
                  value={parcelName}
                  onChange={(e) => setParcelName(e.target.value)}
                  placeholder="e.g. NexBridge Software Hub Phase 2"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Geographic Location</label>
                <input
                  type="text"
                  required
                  value={parcelLoc}
                  onChange={(e) => setParcelLoc(e.target.value)}
                  placeholder="e.g. Cabuyao Technopark, Laguna"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Total Tract Area (sqm)</label>
                  <input
                    type="number"
                    required
                    value={parcelSqm}
                    onChange={(e) => setParcelSqm(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Acquisition Cost (₱)</label>
                  <input
                    type="number"
                    required
                    value={parcelCost}
                    onChange={(e) => setParcelCost(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Planned Subdivision Lots</label>
                  <input
                    type="number"
                    required
                    value={parcelPlannedLots}
                    onChange={(e) => setParcelPlannedLots(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Acquisition Date</label>
                  <input
                    type="date"
                    required
                    value={parcelDate}
                    onChange={(e) => setParcelDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono"
                  />
                </div>
              </div>
            </form>

            <div className="shrink-0 p-4 border-t border-slate-800 flex justify-end gap-2 bg-slate-950/80">
              <button
                type="button"
                onClick={() => setIsNewParcelModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="parcelForm"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-blue-500/20"
              >
                Save &amp; Acquire Parcel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
