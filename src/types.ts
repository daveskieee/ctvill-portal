/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface LandParcel {
  id: string;
  name: string; // e.g., "Cavinti Highland Crest"
  location: string;
  totalAreaSqm: number;
  acquisitionCost: number;
  subdividedSlotsCount: number;
  acquisitionDate: string;
}

export type SlotStatus = 
  | 'Available' 
  | 'Reserved' 
  | 'Under Contract' 
  | 'Developing' 
  | 'Titling Phase' 
  | 'Turnover Ready' 
  | 'Handed Over'
  | 'Sold';

export interface SlotPoint {
  x: number;
  y: number;
}

export interface Slot {
  id: string; // e.g., "SLOT-01"
  parcelId: string;
  slotNumber: number;
  areaSqm: number;
  basePrice: number;
  status: SlotStatus;
  row: number; // For the interactive grid render
  col: number; // For the interactive grid render
  polygonPoints?: SlotPoint[] | string | null; // Vertex coordinates from AutoCAD/DXF
  blockName?: string | null;
  assignedClientId: string | null;
}

export interface TitleMilestones {
  currentPhase?: string;
  motherTitleVerified?: boolean;
  darClearanceApproved?: boolean;
  lguPermitIssued?: boolean;
  dhsudLicenseToSell?: boolean;
  legalPermitsApproved?: boolean;
  ctsSigned?: boolean;
  deedOfSaleSigned?: boolean;
  birEcarIssued?: boolean;
  taxDeclarationTransferred?: boolean;
  landTitleReleased?: boolean;
  registryOfDeedsTctReleased?: boolean;
  certificateOfAcceptanceSigned?: boolean;
  tctNumber?: string | null;
  taxDecNumber?: string | null;
}

export interface BuyerKyc {
  govtIdVerified: boolean;
  tinVerified: boolean;
  proofOfIncomeVerified: boolean;
  proofOfAddressVerified: boolean;
  maritalConsentVerified: boolean;
  kycStatus: 'PENDING' | 'UNDER_REVIEW' | 'VERIFIED';
  verifiedAt?: string | null;
  notes?: string | null;
}

export interface PaymentItem {
  id: string;
  dueDate: string;
  amount: number;
  status: 'Paid' | 'Pending';
  paidDate?: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  contact: string;
  accountStatus?: 'INVITED' | 'ACTIVE' | 'SUSPENDED';
  inviteToken?: string | null;
  inviteTokenExpiry?: string | null;
  slotId: string | null; // Selected lot
  packageName: string; // e.g., "Standard Package (Land + Subgraded Access)"
  paymentPlan: 'Installment' | 'Cash';
  totalContractPrice: number;
  monthlyInstallment: number;
  balance: number;
  amountPaid: number;
  titleMilestones: TitleMilestones;
  buyerKyc?: BuyerKyc;
  payments: PaymentItem[];
  registrationDate: string;
}

export interface QALog {
  id: string;
  date: string;
  inspectorName: string;
  slotId: string;
  complianceStatus: 'Compliant' | 'Corrective Action Required';
  progressPercentage: number;
  structuralCheck: 'Pass' | 'Fail';
  safetyCheck: 'Pass' | 'Fail';
  remarks: string;
  siteActivity: 'Excavation' | 'Leveling' | 'Road Subgrade' | 'Drainage Install' | 'Ready';
}

export interface PunchListDefect {
  id: string;
  slotId: string;
  inspectorId: string;
  inspectorName: string;
  contractorId?: string | null;
  contractorName?: string | null;
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'CONTRACTOR_RECTIFIED' | 'RE_INSPECTED' | 'CLOSED';
  category: 'ROADS' | 'DRAINAGE' | 'GRADING' | 'BOUNDARY' | 'UTILITIES';
  resolutionNotes?: string | null;
  targetDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CivilWorksMilestone {
  id: string;
  parcelId: string;
  phaseName: string;
  targetPercentage: number;
  currentPercentage: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'INSPECTION_PENDING' | 'COMPLETED';
  inspectorSignOff: boolean;
  signOffDate?: string | null;
  remarks?: string | null;
}

export interface ProcessAuditLog {
  id: string;
  entityType: 'SLOT' | 'CLIENT' | 'TITLING' | 'DEFECT' | 'CIVIL_WORKS' | 'TURNOVER';
  entityId: string;
  action: string;
  actorName: string;
  actorRole: string;
  details: string;
  createdAt: string;
}

export type CTVillDepartment = 
  | 'Executive Leadership'
  | 'Design & Pre-Construction'
  | 'Project Management & Construction'
  | 'Property Management & Maintenance'
  | 'Corporate Support'
  | 'Design & Pre-Construction ("CREATE" Phase)'
  | 'Project Management & Construction ("CONSTRUCT" Phase)'
  | 'Property Management & Maintenance ("AFTER CARE" Phase)';

export type CTVillRole =
  // Executive Leadership
  | 'Board of Directors / President'
  | 'Chief Executive Officer (CEO)'
  | 'Chief Operating Officer (COO)'
  // Design & Pre-Construction ("CREATE" Phase)
  | 'Principal Architect'
  | 'Design & Interior Architects'
  | 'Lead Electrical & Mechanical Engineers'
  | 'PEZA Permitting Specialists'
  | 'Quantity Surveyors & Estimators'
  // Project Management & Construction ("CONSTRUCT" Phase)
  | 'Project Managers (PM)'
  | 'Project & Site Engineers'
  | 'Safety Officers (EHSO)'
  | 'Site Foremen'
  | 'Skilled Trade Crews (Electricians, Carpenters, Painters, Masons)'
  // Property Management & Maintenance ("AFTER CARE" Phase)
  | 'Aftercare Coordinators'
  | 'Facilities Maintenance Technicians'
  // Corporate Support
  | 'Finance & Accounting Department'
  | 'Human Resources & Admin Department'
  | 'Procurement & Logistics Department';

export interface Contractor {
  id: string;
  name: string;
  company: string;
  specialty?: string;
  tradeType?: string;
  employmentType?: 'INTERNAL' | 'OUTSOURCED';
  department?: CTVillDepartment | string;
  roleTitle?: CTVillRole | string;
  dailyRate?: number;
  monthlySalary?: number;
  status?: 'ACTIVE' | 'ON_LEAVE' | 'INACTIVE' | 'BREAK' | 'OFFLINE';
  workforceCategory?: 'PROFESSIONAL' | 'SKILLED' | 'GENERAL_LABOR';
  allocationStatus?: 'ASSIGNED' | 'STANDBY' | 'REALLOCATED' | 'DEMOBILIZED';
  contractAmount: number;
  paidAmount: number;
  activeManpower: number;
  milestoneProgress: number; // e.g., 75%
  rating: number; // Rating out of 5
  contact?: string;
  activeProjectSite?: string;
  createdAt?: string;
  avatar?: string;
  activePresence?: 'ONLINE' | 'BREAK' | 'OFFLINE';
  lastSeen?: string;
  assignedZone?: string;
  email?: string;
  phone?: string;
  shiftHours?: string;
  certifications?: string[];
  dispatchNotes?: { id: string; sender: string; text: string; timestamp: string; isSelf?: boolean }[];
}

export interface PayrollRecord {
  id: string;
  date: string;
  payeeName: string;
  role: 'Internal Staff' | 'Site Monitor' | 'Contractor';
  disbursementType: 'Salary' | 'Contract Milestone';
  amount: number;
  status: 'Disbursed' | 'Pending';
  paymentMethod: string;
}

export interface CompanyBudget {
  initialCapital: number;
  landAcquisitionCost: number;
  subdevelopmentCostPaid: number;
  collectedInstallments: number;
  currentCashReserve: number;
  roadInfrastructureFee: number;
  nextHectareCost: number;
}

export interface DailyManpowerAudit {
  id: string;
  date: string;
  contractorId: string;
  contractorName: string;
  specialty: string;
  shift: 'Morning' | 'Afternoon' | 'Full Day';
  claimedHeadcount: number;
  verifiedHeadcount: number;
  discrepancy: number; // claimedHeadcount - verifiedHeadcount
  assignedSectorOrLot: string;
  supervisorName: string;
  gpsCoordinates: string;
  verificationStatus: 'VERIFIED_MATCH' | 'DISCREPANCY_FLAGGED' | 'RESOLVED';
  photoEvidenceVerified: boolean;
  remarks: string;
  productivityIndex: number; // e.g. 92%
}

export interface LaborAllocation {
  id: string;
  contractorId: string;
  contractorName?: string;
  sectorName: string;
  targetLots: string; // e.g., "Lots 01 - 06"
  assignedHeadcount: number;
  workScope: string; // e.g., "Heavy Grading & Subbase Compaction"
  status: 'ACTIVE' | 'ON_HOLD' | 'COMPLETED';
  notes?: string;
  updatedAt?: string;
}

export interface AIManpowerRecommendation {
  id: string;
  title: string;
  rationale: string;
  targetSector: string;
  targetLots: string;
  contractorId: string;
  contractorName: string;
  recommendedHeadcount: number;
  currentHeadcount: number;
  suggestedScope: string;
  priority: 'HIGH' | 'MEDIUM' | 'OPTIMIZATION';
  impact: string;
  applied?: boolean;
}

export interface UserSession {
  id?: string;
  email: string;
  name: string;
  role: 'Admin' | 'ProjectManager' | 'Client' | string;
  clientId?: string; // If role is 'Client'
  accountStatus?: 'INVITED' | 'ACTIVE' | 'SUSPENDED';
  token?: string;
  avatarUrl?: string | null;
  title?: string;
  phone?: string;
  division?: string;
}

// --- PROJECT MANAGEMENT SYSTEM (PMS) INTERFACES ---

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED' | 'BLOCKED';

export interface TaskSubItem {
  id: string;
  title: string;
  completed: boolean;
}

export interface ProjectTask {
  id: string;
  title: string;
  description?: string;
  assigneeName?: string;
  assigneeRole?: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string;
  startDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  category?: string; // "CIVIL_WORKS" | "SURVEYING" | "PERMITTING" | "LEGAL" | "SALES" | "QA"
  milestonePhase?: string; // e.g. "Phase A: Boundary Staking & Land Grading"
  subtasks?: TaskSubItem[];
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface DailySiteLog {
  id: string;
  date: string;
  weather: 'SUNNY' | 'OVERCAST' | 'RAINY' | 'STORM';
  temperature?: string;
  activeHeadcount: number;
  equipmentOnSite?: string;
  toolboxTopic?: string;
  workCompleted: string;
  delaysOrIssues?: string;
  supervisorName: string;
  createdAt?: string;
}

export interface ProjectDocument {
  id: string;
  title: string;
  category: 'CAD_DRAWING' | 'PERMIT_DHSUD' | 'LGU_CLEARANCE' | 'STRUCTURAL_PLAN' | 'DEED_LEGAL' | 'SPECIFICATIONS' | 'ARCHITECTURAL' | 'OTHER';
  fileUrl?: string;
  fileSize?: string;
  version: string;
  status: 'APPROVED' | 'UNDER_REVIEW' | 'IN_REVIEW' | 'DRAFT' | 'ARCHIVED';
  uploadedBy: string;
  notes?: string;
  createdAt?: string;
}

export interface ProjectRisk {
  id: string;
  title: string;
  category: 'WEATHER' | 'REGULATORY' | 'SUPPLY_CHAIN' | 'TECHNICAL' | 'FINANCIAL' | 'LEGAL';
  likelihood: number; // 1 to 5
  impact: number; // 1 to 5
  riskScore: number; // likelihood * impact
  mitigationPlan: string;
  status: 'OPEN' | 'MITIGATING' | 'RESOLVED';
  ownerName: string;
  createdAt?: string;
}

export interface ChangeOrder {
  id: string;
  orderNumber: string;
  projectId?: string;
  title: string;
  contractorName: string;
  requestedAmount: number;
  approvedAmount?: number | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  justification?: string;
  approvedBy?: string;
  submittedDate?: string;
  approvedDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// --- AUTOCAD / CAD PARSER INTERFACES ---

export interface CADParsedLot {
  slotNumber: number;
  lotName?: string;
  blockName?: string;
  areaSqm: number;
  points: SlotPoint[]; // Polygon boundary vertices
  centerPoint: SlotPoint;
  basePrice?: number;
  rawLayer?: string;
}

export interface CADParseResult {
  fileName: string;
  fileType: 'DXF' | 'DWG' | 'GEOJSON' | 'SVG' | 'JSON';
  totalLotsParsed: number;
  totalAreaSqm: number;
  layers: string[];
  boundingBox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
  lots: CADParsedLot[];
  rawLines?: { start: SlotPoint; end: SlotPoint; layer?: string }[];
}

// --- CORE MODULE EXTENSIONS ---

export type PermitType = 
  | 'LGU_BUILDING_PERMIT' 
  | 'BARANGAY_CLEARANCE' 
  | 'PEZA_FITOUT_PERMIT' 
  | 'FSIC_FIRE_SAFETY' 
  | 'DOLE_CSHP' 
  | 'OCCUPANCY_PERMIT' 
  | 'SANITARY_CLEARANCE' 
  | 'OTHER';

export interface GovernmentPermit {
  id: string;
  projectId?: string;
  projectName: string;
  permitName: string;
  permitType: PermitType;
  issuingAgency: string;
  referenceNo: string;
  status: 'APPROVED' | 'PENDING' | 'UNDER_RENEWAL' | 'EXPIRED';
  applicationDate?: string | null;
  approvalDate?: string | null;
  expiryDate?: string | null;
  notes?: string;
  documentUrl?: string;
  createdAt?: string;
}

export type ScheduleEventType = 'MEETING' | 'DEADLINE' | 'MILESTONE' | 'INSPECTION';

export interface ScheduleEvent {
  id: string;
  projectId?: string;
  projectName?: string;
  title: string;
  eventType: ScheduleEventType;
  eventDate: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  attendees?: string;
  notes?: string;
  status?: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  createdAt?: string;
}

export interface ProjectProfile {
  id: string;
  name: string;
  clientName: string;
  description: string;
  location: string;
  budget: number;
  fundsCollected: number;
  progressPercentage: number;
  status: 'PLANNING' | 'IN_PROGRESS' | 'PUNCHLIST_QA' | 'HANDED_OVER' | 'COMPLETED';
  targetHandoverDate: string;
  startDate: string;
  assignedWorkersCount: number;
  assignedContractorIds: string[];
  assignedProjectManagerId?: string;
  assignedProjectManagerName?: string;
  latitude?: number;
  longitude?: number;
  weatherSuspended?: boolean;
  isPrivateAccounting?: boolean;
  tasksCount: number;
  milestonesCount: number;
}

export interface ExtendedPayrollItem {
  id: string;
  workerName: string;
  contractorCompany: string;
  projectName: string;
  role: string;
  hoursWorked: number;
  daysWorked: number;
  dailyRate: number;
  overtimeHours?: number;
  grossPay: number;
  deductions: number;
  netPay: number;
  status: 'Pending' | 'Disbursed';
  disbursementDate?: string;
  paymentMethod: string;
}

export interface WorkforceReallocationRecommendation {
  id: string;
  workerId: string;
  workerName: string;
  roleTitle: string;
  workforceCategory: 'PROFESSIONAL' | 'SKILLED' | 'GENERAL_LABOR';
  originProjectId: string;
  originProjectName: string;
  originProgress: number;
  targetProjectId: string;
  targetProjectName: string;
  targetStatus: string;
  targetProgress: number;
  rationale: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  applied: boolean;
}

export interface FeatureFlags {
  showStatutoryAndPayroll: boolean;
}

export interface ProjectRFI {
  id: string;
  rfiNumber: string;
  projectId?: string;
  projectName: string;
  subject: string;
  question: string;
  suggestedSolution?: string;
  answer?: string;
  status: 'OPEN' | 'UNDER_REVIEW' | 'ANSWERED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  assignedTo?: string;
  submittedBy: string;
  drawingRef?: string;
  dueDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FitoutQuotationItem {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  projectScope: string;
  estimatedCost: number;
  estimatedWeeks: number;
  estimatorArea: number;
  spaceType?: string;
  finishTier?: string;
  projectNotes?: string;
  status: 'NEW_INQUIRY' | 'CONTACTED' | 'PROPOSAL_SENT' | 'CONVERTED';
  createdAt?: string;
}
