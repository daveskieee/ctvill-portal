/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { Role, SlotStatus, PaymentMethod, PaymentStatus, PayrollRole, DisbursementType, PayrollStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { prisma, pool } from '../db';
import { broadcastChange, setCacheInvalidator } from '../events';
import { getMailTransporter } from '../email';

export const legacyParcelsRouter = Router();

// Helper function to map DB SlotStatus to Frontend SlotStatus string
export function mapDbStatusToString(status: SlotStatus): string {
  switch (status) {
    case SlotStatus.AVAILABLE: return 'Available';
    case SlotStatus.RESERVED: return 'Reserved';
    case SlotStatus.UNDER_CONTRACT: return 'Under Contract';
    case SlotStatus.DEVELOPING: return 'Developing';
    case SlotStatus.TITLING_PHASE: return 'Titling Phase';
    case SlotStatus.TURNOVER_READY: return 'Turnover Ready';
    case SlotStatus.HANDED_OVER: return 'Handed Over';
    case SlotStatus.SOLD: return 'Under Contract';
    default: return 'Available';
  }
}

// Helper function to map Frontend SlotStatus string to DB SlotStatus
export function mapStringToDbStatus(status: string): SlotStatus {
  const s = status.toLowerCase();
  if (s.includes('reserve')) return SlotStatus.RESERVED;
  if (s.includes('contract')) return SlotStatus.UNDER_CONTRACT;
  if (s.includes('develop')) return SlotStatus.DEVELOPING;
  if (s.includes('titl')) return SlotStatus.TITLING_PHASE;
  if (s.includes('turnover') || s.includes('ready')) return SlotStatus.TURNOVER_READY;
  if (s.includes('hand') || s.includes('over')) return SlotStatus.HANDED_OVER;
  if (s.includes('sold')) return SlotStatus.SOLD;
  return SlotStatus.AVAILABLE;
}

// Helper function to map DB Client to Frontend Client structure
export async function mapUserToClient(user: any) {
  const pkg = user.clientPackage;
  const ledgers = pkg?.installmentLedgers || [];
  const tracker = pkg?.titlePermitTracker;
  const kyc = user.buyerKyc;
  
  const totalContractPrice = Number(pkg?.price || 0);
  
  const paidLedgers = ledgers.filter((l: any) => l.status === PaymentStatus.PAID);
  const amountPaid = paidLedgers.reduce((sum: number, l: any) => sum + Number(l.amountPaid || 0), 0);
  const balance = Math.max(totalContractPrice - amountPaid, 0);

  const monthlyInstallment = ledgers.length > 0 ? Number(ledgers[0].amountDue) : 0;

  const payments = ledgers.map((l: any) => ({
    id: l.id,
    dueDate: l.dueDate.toISOString().split('T')[0],
    amount: Number(l.amountDue),
    status: l.status === PaymentStatus.PAID ? 'Paid' : 'Pending',
    paidDate: l.paymentDate ? l.paymentDate.toISOString().split('T')[0] : undefined,
  }));

  const titleMilestones = {
    currentPhase: tracker?.currentPhase || 'Reservation & Buyer Qualification',
    motherTitleVerified: tracker?.motherTitleVerified ?? true,
    darClearanceApproved: tracker?.darClearanceApproved ?? true,
    lguPermitIssued: tracker?.lguPermitIssued ?? false,
    dhsudLicenseToSell: tracker?.dhsudLicenseToSell ?? false,
    ctsSigned: tracker?.ctsSigned ?? false,
    deedOfSaleSigned: tracker?.deedOfSaleSigned ?? false,
    birEcarIssued: tracker?.birEcarIssued ?? false,
    taxDeclarationTransferred: tracker?.taxDeclarationTransferred ?? false,
    registryOfDeedsTctReleased: tracker?.registryOfDeedsTctReleased ?? false,
    certificateOfAcceptanceSigned: tracker?.certificateOfAcceptanceSigned ?? false,
    tctNumber: tracker?.tctNumber || null,
    taxDecNumber: tracker?.taxDecNumber || null,
  };

  const buyerKyc = kyc ? {
    govtIdVerified: kyc.govtIdVerified,
    tinVerified: kyc.tinVerified,
    proofOfIncomeVerified: kyc.proofOfIncomeVerified,
    proofOfAddressVerified: kyc.proofOfAddressVerified,
    maritalConsentVerified: kyc.maritalConsentVerified,
    kycStatus: kyc.kycStatus as 'PENDING' | 'UNDER_REVIEW' | 'VERIFIED',
    verifiedAt: kyc.verifiedAt ? kyc.verifiedAt.toISOString() : null,
    notes: kyc.notes || '',
  } : {
    govtIdVerified: false,
    tinVerified: false,
    proofOfIncomeVerified: false,
    proofOfAddressVerified: false,
    maritalConsentVerified: false,
    kycStatus: 'PENDING' as const,
    verifiedAt: null,
    notes: '',
  };

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    contact: user.contact || '',
    accountStatus: user.accountStatus || 'ACTIVE',
    inviteToken: user.inviteToken || null,
    inviteTokenExpiry: user.inviteTokenExpiry ? user.inviteTokenExpiry.toISOString() : null,
    slotId: pkg?.slotId || null,
    packageName: pkg?.packageType || '',
    paymentPlan: pkg?.paymentMethod === PaymentMethod.INSTALLMENT ? 'Installment' : 'Cash',
    totalContractPrice,
    monthlyInstallment,
    balance,
    amountPaid,
    titleMilestones,
    buyerKyc,
    payments,
    registrationDate: user.createdAt.toISOString().split('T')[0],
  };
}

// In-Memory Performance Cache for /api/all-data
let allDataCache: any = null;
let allDataCacheTime = 0;
const ALL_DATA_CACHE_TTL = 1500;

export function invalidateAllDataCache() {
  allDataCache = null;
  allDataCacheTime = 0;
}

setCacheInvalidator(invalidateAllDataCache);

// GET /api/all-data: Fetches operational models concurrently
legacyParcelsRouter.get('/all-data', async (req: Request, res: Response) => {
  try {
    const bypassCache = req.query.nocache === 'true' || req.headers['cache-control'] === 'no-cache';
    if (!bypassCache && allDataCache && (Date.now() - allDataCacheTime < ALL_DATA_CACHE_TTL)) {
      return res.json(allDataCache);
    }

    const [
      dbParcels,
      dbSlots,
      dbClients,
      dbContractors,
      dbQaLogs,
      dbDefects,
      dbCivilMilestones,
      dbAuditLogs,
      dbPayroll,
      ledgerPaidSum,
      clientPackagesCount,
      dbManpowerAudits,
      dbTasks,
      dbSiteLogs,
      dbDocs,
      dbRisks,
      dbCOs,
      dbPermitsRes,
      dbEventsRes,
      dbProjectsRes,
      dbExtPayrollRes,
      dbAllocRes,
      dbRecRes,
      dbContractorPresencesRes,
      dbRfisRes,
      dbQuotationsRes
    ] = await Promise.all([
      prisma.landParcel.findMany({
        include: { slots: true, civilWorksMilestones: { orderBy: { phaseName: 'asc' } } }
      }),
      prisma.slot.findMany({
        include: { clientPackage: true },
        orderBy: { slotNumber: 'asc' }
      }),
      prisma.user.findMany({
        where: { role: Role.CLIENT },
        include: {
          buyerKyc: true,
          clientPackage: {
            include: {
              installmentLedgers: { orderBy: { dueDate: 'asc' } },
              titlePermitTracker: true
            }
          }
        }
      }),
      prisma.contractor.findMany({ orderBy: { name: 'asc' } }),
      prisma.weeklyProgressLog.findMany({
        include: { inspector: true },
        orderBy: { date: 'desc' }
      }),
      prisma.punchListDefect.findMany({
        include: { inspector: true, contractor: true },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.civilWorksMilestone.findMany({
        orderBy: { phaseName: 'asc' }
      }),
      prisma.processAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50
      }),
      prisma.payrollRecord.findMany({
        orderBy: { date: 'desc' }
      }),
      prisma.installmentLedger.aggregate({
        _sum: { amountPaid: true }
      }),
      prisma.clientPackage.count(),
      prisma.dailyManpowerAudit.findMany({
        orderBy: { date: 'desc' },
        take: 50
      }).catch(() => [] as any[]),
      prisma.projectTask.findMany({ 
        include: { assignedContractor: true },
        orderBy: { createdAt: 'desc' } 
      }),
      prisma.dailySiteLog.findMany({ orderBy: { date: 'desc' }, take: 30 }),
      prisma.projectDocument.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.projectRisk.findMany({ orderBy: { riskScore: 'desc' } }),
      prisma.changeOrder.findMany({ orderBy: { createdAt: 'desc' } }),
      pool.query('SELECT * FROM government_permits ORDER BY expiry_date ASC NULLS LAST, created_at DESC').catch(() => ({ rows: [] })),
      pool.query('SELECT * FROM schedule_events ORDER BY event_date ASC, start_time ASC').catch(() => ({ rows: [] })),
      pool.query('SELECT * FROM commercial_projects ORDER BY created_at ASC').catch(() => ({ rows: [] })),
      pool.query('SELECT * FROM extended_payroll ORDER BY created_at DESC').catch(() => ({ rows: [] })),
      pool.query('SELECT * FROM labor_allocations ORDER BY sector_name ASC').catch(() => ({ rows: [] })),
      pool.query('SELECT * FROM ai_manpower_recommendations WHERE dismissed = false ORDER BY created_at DESC').catch(() => ({ rows: [] })),
      pool.query('SELECT id, active_presence, status FROM contractors').catch(() => ({ rows: [] })),
      pool.query('SELECT * FROM project_rfis ORDER BY created_at DESC').catch(() => ({ rows: [] })),
      pool.query('SELECT * FROM fitout_quotations ORDER BY created_at DESC').catch(() => ({ rows: [] }))
    ]);

    const presenceMap = new Map((dbContractorPresencesRes.rows || []).map((r: any) => [r.id, r.active_presence || r.status]));

    const parcels = dbParcels.map(p => ({
      id: p.id,
      name: p.name,
      location: p.location,
      totalAreaSqm: p.totalAreaSqm,
      acquisitionCost: Number(p.purchaseCost),
      subdividedSlotsCount: p.totalSlots,
      acquisitionDate: p.acquisitionDate.toISOString().split('T')[0],
      civilWorksMilestones: p.civilWorksMilestones.map(m => ({
        id: m.id,
        parcelId: m.parcelId,
        phaseName: m.phaseName,
        targetPercentage: m.targetPercentage,
        currentPercentage: m.currentPercentage,
        status: m.status,
        inspectorSignOff: m.inspectorSignOff,
        signOffDate: m.signOffDate ? m.signOffDate.toISOString().split('T')[0] : null,
        remarks: m.remarks || '',
      })),
    }));

    const slots = dbSlots.map(s => ({
      id: s.id,
      parcelId: s.parcelId,
      slotNumber: s.slotNumber,
      areaSqm: s.sizeSqm,
      basePrice: Number(s.price),
      status: mapDbStatusToString(s.status),
      row: s.row,
      col: s.col,
      polygonPoints: s.polygonPoints,
      blockName: s.blockName,
      assignedClientId: s.clientPackage?.userId || null,
    }));

    const clients = await Promise.all(dbClients.map(c => mapUserToClient(c)));

    const contractors = dbContractors.map(c => {
      const rawP = presenceMap.get(c.id) || (c as any).status || 'ACTIVE';
      const activePresence = (rawP === 'BREAK' || rawP === 'ON_BREAK') ? 'BREAK'
        : (rawP === 'OFFLINE' || rawP === 'INACTIVE' || rawP === 'ON_LEAVE') ? 'OFFLINE'
        : 'ONLINE';

      return {
        id: c.id,
        name: c.name,
        company: c.company || '',
        specialty: c.specialty || 'General Contractor',
        contact: c.contact || null,
        activeProjectSite: c.activeProjectSite || null,
        assignedZone: c.assignedZone || null,
        avatar: (c as any).avatar || null,
        contractAmount: Number(c.contractAmount || 0),
        paidAmount: Number(c.paidAmount || 0),
        activeManpower: c.activeManpower,
        milestoneProgress: c.milestoneProgress,
        rating: c.rating || 0,
        employmentType: (c as any).employmentType || 'INTERNAL',
        department: (c as any).department || null,
        roleTitle: (c as any).roleTitle || null,
        dailyRate: (c as any).dailyRate !== null && (c as any).dailyRate !== undefined ? Number((c as any).dailyRate) : null,
        monthlySalary: (c as any).monthlySalary !== null && (c as any).monthlySalary !== undefined ? Number((c as any).monthlySalary) : null,
        status: (c as any).status || 'ACTIVE',
        activePresence,
      };
    });

    const responsePayload = {
      parcels,
      slots,
      clients,
      contractors,
      qaLogs: dbQaLogs.map(q => ({
        id: q.id,
        date: q.date.toISOString().split('T')[0],
        inspectorName: q.inspector.name,
        slotId: q.slotId,
        complianceStatus: q.complianceStatus || 'Compliant',
        progressPercentage: q.percentageComplete,
        structuralCheck: q.structuralCheck || 'Pass',
        safetyCheck: q.safetyCheck || 'Pass',
        remarks: q.notes,
        siteActivity: q.siteActivity || 'Ready',
      })),
      punchListDefects: dbDefects.map(d => ({
        id: d.id,
        slotId: d.slotId,
        inspectorId: d.inspectorId,
        inspectorName: d.inspector?.name || 'Site Monitor',
        contractorId: d.contractorId,
        contractorName: d.contractor?.name || 'Unassigned Contractor',
        title: d.title,
        description: d.description,
        severity: d.severity,
        status: d.status,
        category: d.category,
        resolutionNotes: d.resolutionNotes || '',
        targetDate: d.targetDate ? d.targetDate.toISOString().split('T')[0] : null,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      })),
      civilWorksMilestones: dbCivilMilestones.map(m => ({
        id: m.id,
        parcelId: m.parcelId,
        phaseName: m.phaseName,
        targetPercentage: m.targetPercentage,
        currentPercentage: m.currentPercentage,
        status: m.status,
        inspectorSignOff: m.inspectorSignOff,
        signOffDate: m.signOffDate ? m.signOffDate.toISOString().split('T')[0] : null,
        remarks: m.remarks || '',
      })),
      auditLogs: dbAuditLogs.map(a => ({
        id: a.id,
        entityType: a.entityType,
        entityId: a.entityId,
        action: a.action,
        actorName: a.actorName,
        actorRole: a.actorRole,
        details: a.details,
        createdAt: a.createdAt.toISOString(),
      })),
      payroll: dbPayroll.map(p => ({
        id: p.id,
        date: p.date.toISOString().split('T')[0],
        payeeName: p.payeeName,
        role: p.role === PayrollRole.INTERNAL_STAFF ? 'Internal Staff' : p.role === PayrollRole.SITE_MONITOR ? 'Site Monitor' : 'Contractor',
        disbursementType: p.disbursementType === DisbursementType.SALARY ? 'Salary' : 'Contract Milestone',
        amount: Number(p.amount),
        status: p.status === PayrollStatus.DISBURSED ? 'Disbursed' : 'Pending',
        paymentMethod: p.paymentMethod,
      })),
      tasks: dbTasks.map(t => ({
        id: t.id,
        title: t.title || t.text,
        description: t.description || t.text,
        assigneeName: t.assigneeName || t.assignedContractor?.name || '',
        assigneeRole: t.assigneeRole || t.assignedContractor?.roleTitle || '',
        priority: t.priority || 'MEDIUM',
        status: t.status || ((t.progress || 0) >= 1 ? 'COMPLETED' : (t.progress || 0) > 0 ? 'IN_PROGRESS' : 'TODO'),
        dueDate: t.dueDate ? t.dueDate.toISOString().split('T')[0] : (t.endDate ? t.endDate.toISOString().split('T')[0] : ''),
        startDate: t.startDate ? t.startDate.toISOString().split('T')[0] : '',
        estimatedHours: (t.duration || 1) * 8,
        actualHours: Math.round((t.progress || 0) * 100),
        category: t.category || (t.type === 'milestone' ? 'QA' : 'CIVIL_WORKS'),
        milestonePhase: t.milestonePhase || t.wbsCode || '',
        subtasks: t.subtasksJson ? JSON.parse(t.subtasksJson) : [],
        tags: t.tags ? (typeof t.tags === 'string' ? t.tags.split(',') : t.tags) : [t.wbsCode || '', t.type || 'task'],
        createdAt: t.createdAt.toISOString(),
      })),
      siteLogs: dbSiteLogs,
      documents: dbDocs,
      risks: dbRisks,
      changeOrders: dbCOs.map(c => ({
        id: c.id,
        orderNumber: c.orderNumber,
        title: c.title,
        contractorName: c.contractorName,
        requestedAmount: Number(c.requestedAmount || 0),
        approvedAmount: c.approvedAmount ? Number(c.approvedAmount) : null,
        status: c.status,
        justification: c.justification,
        approvedBy: c.approvedBy || '',
        createdAt: c.createdAt.toISOString()
      })),
      permits: (dbPermitsRes.rows || []).map((p: any) => ({
        id: p.id,
        projectId: p.project_id,
        projectName: p.project_name,
        permitName: p.permit_name,
        permitType: p.permit_type,
        issuingAgency: p.issuing_agency,
        referenceNo: p.reference_no,
        status: p.status,
        applicationDate: p.application_date ? (p.application_date instanceof Date ? p.application_date.toISOString().split('T')[0] : String(p.application_date).split('T')[0]) : null,
        approvalDate: p.approval_date ? (p.approval_date instanceof Date ? p.approval_date.toISOString().split('T')[0] : String(p.approval_date).split('T')[0]) : null,
        expiryDate: p.expiry_date ? (p.expiry_date instanceof Date ? p.expiry_date.toISOString().split('T')[0] : String(p.expiry_date).split('T')[0]) : null,
        notes: p.notes || '',
        documentUrl: p.document_url || '',
        createdAt: p.created_at ? (p.created_at instanceof Date ? p.created_at.toISOString() : String(p.created_at)) : new Date().toISOString(),
      })),
      scheduleEvents: (dbEventsRes.rows || []).map((e: any) => ({
        id: e.id,
        projectId: e.project_id,
        projectName: e.project_name,
        title: e.title,
        eventType: e.event_type,
        eventDate: e.event_date ? (e.event_date instanceof Date ? e.event_date.toISOString().split('T')[0] : String(e.event_date).split('T')[0]) : new Date().toISOString().split('T')[0],
        startTime: e.start_time || '09:00',
        endTime: e.end_time || '10:00',
        location: e.location || 'Site Office',
        attendees: e.attendees || '',
        notes: e.notes || '',
        status: e.status || 'SCHEDULED',
        createdAt: e.created_at ? (e.created_at instanceof Date ? e.created_at.toISOString() : String(e.created_at)) : new Date().toISOString(),
      })),
      projects: (dbProjectsRes.rows || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        clientName: p.client_name || '',
        description: p.description || '',
        location: p.location || '',
        budget: Number(p.budget || 0),
        fundsCollected: Number(p.funds_collected || 0),
        progressPercentage: Number(p.progress_percentage || 0),
        status: p.status || 'IN_PROGRESS',
        targetHandoverDate: p.target_handover_date ? (p.target_handover_date instanceof Date ? p.target_handover_date.toISOString().split('T')[0] : String(p.target_handover_date).split('T')[0]) : '2026-12-31',
        startDate: p.start_date ? (p.start_date instanceof Date ? p.start_date.toISOString().split('T')[0] : String(p.start_date).split('T')[0]) : '2026-01-01',
        assignedWorkersCount: Number(p.assigned_workers_count || 0),
        assignedContractorIds: Array.isArray(p.assigned_contractor_ids) ? p.assigned_contractor_ids : [],
        tasksCount: Number(p.tasks_count || 0),
        milestonesCount: Number(p.milestones_count || 0),
        isPrivateAccounting: Boolean(p.is_private_accounting),
        assignedProjectManagerId: p.assigned_project_manager_id || '',
        assignedProjectManagerName: p.assigned_project_manager_name || '',
        latitude: p.latitude !== null && p.latitude !== undefined ? Number(p.latitude) : undefined,
        longitude: p.longitude !== null && p.longitude !== undefined ? Number(p.longitude) : undefined,
        weatherSuspended: Boolean(p.weather_suspended),
        createdAt: p.created_at ? (p.created_at instanceof Date ? p.created_at.toISOString() : String(p.created_at)) : new Date().toISOString()
      })),
      extendedPayroll: (dbExtPayrollRes.rows || []).map((p: any) => ({
        id: p.id,
        workerName: p.worker_name,
        contractorCompany: p.contractor_company,
        projectName: p.project_name,
        role: p.role,
        hoursWorked: Number(p.hours_worked || 0),
        daysWorked: Number(p.days_worked || 0),
        dailyRate: Number(p.daily_rate || 0),
        overtimeHours: Number(p.overtime_hours || 0),
        grossPay: Number(p.gross_pay || 0),
        deductions: Number(p.deductions || 0),
        netPay: Number(p.net_pay || 0),
        status: p.status || 'Pending',
        disbursementDate: p.disbursement_date ? (p.disbursement_date instanceof Date ? p.disbursement_date.toISOString().split('T')[0] : String(p.disbursement_date).split('T')[0]) : null,
        paymentMethod: p.payment_method || 'Bank Transfer'
      })),
      laborAllocations: (dbAllocRes.rows || []).map((r: any) => ({
        id: r.id,
        contractorId: r.contractor_id,
        contractorName: r.contractor_name,
        sectorName: r.sector_name,
        targetLots: r.target_lots,
        assignedHeadcount: Number(r.assigned_headcount || 0),
        workScope: r.work_scope,
        status: r.status,
        notes: r.notes || '',
        updatedAt: r.updated_at ? (r.updated_at instanceof Date ? r.updated_at.toISOString().split('T')[0] : String(r.updated_at).split('T')[0]) : new Date().toISOString().split('T')[0]
      })),
      aiRecommendations: (dbRecRes.rows || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        targetLots: r.target_project_name || r.target_lots,
        targetSector: r.target_project_name || r.target_lots,
        contractorId: r.contractor_id,
        contractorName: r.contractor_name,
        currentHeadcount: Number(r.current_headcount),
        recommendedHeadcount: Number(r.recommended_headcount),
        rationale: r.rationale,
        suggestedScope: r.rationale,
        priority: r.priority,
        impact: 'High Velocity Schedule Protection',
        applied: Boolean(r.applied),
        dismissed: Boolean(r.dismissed),
        donorProjectId: r.donor_project_id,
        donorProjectName: r.donor_project_name || 'General Standby Pool',
        targetProjectId: r.target_project_id,
        targetProjectName: r.target_project_name || r.target_lots,
        workerId: r.worker_id || r.contractor_id,
        workerName: r.worker_name || r.contractor_name,
        tradeType: r.trade_type || 'Artisan'
      })),
      manpowerAudits: ((Array.isArray(dbManpowerAudits) ? dbManpowerAudits : (dbManpowerAudits as any)?.rows) || []).map((a: any) => ({
        id: a.id,
        date: a.date ? (a.date instanceof Date ? a.date.toISOString().split('T')[0] : String(a.date).split('T')[0]) : new Date().toISOString().split('T')[0],
        contractorId: a.contractorId || a.contractor_id,
        contractorName: a.contractorName || a.contractor_name,
        specialty: a.specialty,
        shift: a.shift || 'Morning',
        claimedHeadcount: Number(a.claimedHeadcount ?? a.claimed_headcount ?? 0),
        verifiedHeadcount: Number(a.verifiedHeadcount ?? a.verified_headcount ?? 0),
        discrepancy: Number(a.discrepancy ?? (Number(a.claimedHeadcount ?? a.claimed_headcount ?? 0) - Number(a.verifiedHeadcount ?? a.verified_headcount ?? 0))),
        assignedSectorOrLot: a.assignedSectorOrLot || a.assigned_sector_or_lot || 'Active Site',
        supervisorName: a.supervisorName || a.supervisor_name || 'Site Supervisor',
        gpsCoordinates: a.gpsCoordinates || a.gps_coordinates || '14.2789° N, 121.1245° E (Site Geofence)',
        verificationStatus: a.verificationStatus || a.verification_status || 'VERIFIED_MATCH',
        photoEvidenceVerified: Boolean(a.photoEvidenceVerified ?? a.photo_evidence_verified ?? true),
        remarks: a.remarks || '',
        productivityIndex: Number(a.productivityIndex ?? a.productivity_index ?? 90)
      })),
      rfis: (dbRfisRes.rows || []).map((r: any) => ({
        id: r.id,
        rfiNumber: r.rfi_number,
        projectId: r.project_id,
        projectName: r.project_name,
        subject: r.subject,
        discipline: r.discipline,
        priority: r.priority,
        status: r.status,
        question: r.question,
        suggestedSolution: r.suggested_solution || '',
        officialAnswer: r.official_answer || '',
        submittedBy: r.submitted_by,
        assignedTo: r.assigned_to,
        dateSubmitted: r.date_submitted ? (r.date_submitted instanceof Date ? r.date_submitted.toISOString().split('T')[0] : String(r.date_submitted).split('T')[0]) : new Date().toISOString().split('T')[0],
        dateAnswered: r.date_answered ? (r.date_answered instanceof Date ? r.date_answered.toISOString().split('T')[0] : String(r.date_answered).split('T')[0]) : null,
        costImpact: Boolean(r.cost_impact),
        scheduleImpactDays: Number(r.schedule_impact_days || 0),
        attachments: Array.isArray(r.attachments) ? r.attachments : [],
        createdAt: r.created_at ? (r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at)) : new Date().toISOString()
      })),
      quotations: (dbQuotationsRes.rows || []).map((q: any) => ({
        id: q.id,
        clientName: q.client_name,
        clientEmail: q.client_email,
        clientPhone: q.client_phone,
        projectScope: q.project_scope,
        estimatedCost: Number(q.estimated_cost || 0),
        estimatedWeeks: Number(q.estimated_weeks || 0),
        estimatorArea: Number(q.estimator_area || 0),
        spaceType: q.space_type,
        finishTier: q.finish_tier,
        projectNotes: q.project_notes,
        status: q.status === 'PENDING' ? 'NEW_INQUIRY' : (q.status || 'NEW_INQUIRY'),
        convertedProjectId: q.converted_project_id || undefined,
        createdAt: q.created_at ? (q.created_at instanceof Date ? q.created_at.toISOString() : String(q.created_at)) : undefined,
      })),
    };

    allDataCache = responsePayload;
    allDataCacheTime = Date.now();

    res.json(responsePayload);
  } catch (error) {
    console.error('Error fetching all data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/clients
legacyParcelsRouter.get('/clients', async (req: Request, res: Response) => {
  try {
    const dbClients = await prisma.user.findMany({
      where: { role: Role.CLIENT },
      include: {
        buyerKyc: true,
        clientPackage: {
          include: {
            installmentLedgers: { orderBy: { dueDate: 'asc' } },
            titlePermitTracker: true
          }
        }
      }
    });
    const clients = await Promise.all(dbClients.map(c => mapUserToClient(c)));
    res.json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/slots
legacyParcelsRouter.get('/slots', async (req: Request, res: Response) => {
  try {
    const dbSlots = await prisma.slot.findMany({
      include: { clientPackage: true },
      orderBy: { slotNumber: 'asc' }
    });
    const slots = dbSlots.map(s => ({
      id: s.id,
      parcelId: s.parcelId,
      slotNumber: s.slotNumber,
      areaSqm: s.sizeSqm,
      basePrice: Number(s.price),
      status: mapDbStatusToString(s.status),
      row: s.row,
      col: s.col,
      polygonPoints: s.polygonPoints,
      blockName: s.blockName,
      assignedClientId: s.clientPackage?.userId || null,
    }));
    res.json(slots);
  } catch (error) {
    console.error('Error fetching slots:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/audit-logs
legacyParcelsRouter.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const dbAuditLogs = await prisma.processAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    const auditLogs = dbAuditLogs.map(a => ({
      id: a.id,
      entityType: a.entityType,
      entityId: a.entityId,
      action: a.action,
      actorName: a.actorName,
      actorRole: a.actorRole,
      details: a.details,
      createdAt: a.createdAt.toISOString(),
    }));
    res.json(auditLogs);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/parcels
legacyParcelsRouter.post('/parcels', async (req: Request, res: Response) => {
  const { id, name, location, acquisitionCost, totalAreaSqm, subdividedSlotsCount, acquisitionDate } = req.body;
  try {
    const parcel = await prisma.landParcel.create({
      data: {
        id,
        name,
        location,
        purchaseCost: acquisitionCost,
        totalAreaSqm,
        totalSlots: subdividedSlotsCount,
        acquisitionDate: new Date(acquisitionDate),
      }
    });

    const defaultPhases = [
      'Phase A: Boundary Staking & Land Grading',
      'Phase B: Road Network & Concrete Curbing',
      'Phase C: Storm Drainage & RCBC Culverts',
      'Phase D: Water Reticulation & Power Grid Post Lines',
      'Phase E: Security Perimeter & Subdivision Gate',
    ];
    for (const phaseName of defaultPhases) {
      await prisma.civilWorksMilestone.create({
        data: {
          parcelId: parcel.id,
          phaseName,
          targetPercentage: 100,
          currentPercentage: 0,
          status: 'NOT_STARTED',
        }
      });
    }

    broadcastChange('parcels');
    broadcastChange('slots');
    invalidateAllDataCache();
    res.json(parcel);
  } catch (error) {
    console.error('Error creating parcel:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/parcels/:id
legacyParcelsRouter.delete('/parcels/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const parcelSlots = await prisma.slot.findMany({ where: { parcelId: id }, select: { id: true } });
    const slotIds = parcelSlots.map(s => s.id);
    if (slotIds.length > 0) {
      await prisma.clientPackage.updateMany({
        where: { slotId: { in: slotIds } },
        data: { slotId: null }
      });
      await prisma.slot.deleteMany({ where: { parcelId: id } });
    }

    await prisma.civilWorksMilestone.deleteMany({ where: { parcelId: id } });
    await prisma.landParcel.delete({ where: { id } });

    broadcastChange('parcels');
    broadcastChange('slots');
    invalidateAllDataCache();
    res.json({ success: true, message: `Parcel ${id} removed.` });
  } catch (error) {
    console.error('Error deleting parcel:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/slots/subdivide
legacyParcelsRouter.post('/slots/subdivide', async (req: Request, res: Response) => {
  const { parcelId, areaSqm, price, startLotNumber } = req.body;
  try {
    const createdSlots = [];
    for (let idx = 0; idx < 5; idx++) {
      const slotNum = startLotNumber + idx;
      const slot = await prisma.slot.create({
        data: {
          id: `SLOT-${slotNum.toString().padStart(2, '0')}`,
          parcelId,
          slotNumber: slotNum,
          sizeSqm: areaSqm,
          price,
          status: SlotStatus.AVAILABLE,
          row: Math.ceil(slotNum / 5),
          col: ((slotNum - 1) % 5) + 1,
        }
      });
      createdSlots.push(slot);
    }

    broadcastChange('slots');
    invalidateAllDataCache();
    res.json(createdSlots);
  } catch (error) {
    console.error('Error subdividing slots:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/slots/import-cad
legacyParcelsRouter.post('/slots/import-cad', async (req: Request, res: Response) => {
  const { parcelId = 'PARCEL-CST', lots = [] } = req.body;
  try {
    if (!Array.isArray(lots) || lots.length === 0) {
      return res.status(400).json({ error: 'Please provide an array of parsed CAD lots.' });
    }

    let targetParcelId = parcelId;
    const existingParcel = await prisma.landParcel.findFirst({
      where: { id: targetParcelId }
    });
    if (!existingParcel) {
      const firstParcel = await prisma.landParcel.findFirst();
      if (firstParcel) {
        targetParcelId = firstParcel.id;
      } else {
        const defaultParcel = await prisma.landParcel.create({
          data: {
            id: 'PARCEL-CST',
            name: 'Cavinti Highland Phase 1',
            location: 'Cavinti, Laguna, Philippines',
            totalAreaSqm: 10000,
            purchaseCost: 450000,
            totalSlots: lots.length,
            acquisitionDate: new Date(),
          }
        });
        targetParcelId = defaultParcel.id;
      }
    }

    const createdSlots = [];
    for (const lot of lots) {
      const slotId = `SLOT-${Number(lot.slotNumber).toString().padStart(2, '0')}`;
      const pointsJson = lot.points ? JSON.stringify(lot.points) : null;
      const row = Math.ceil(lot.slotNumber / 5);
      const col = ((lot.slotNumber - 1) % 5) + 1;

      const slot = await prisma.slot.upsert({
        where: { id: slotId },
        update: {
          parcelId: targetParcelId,
          sizeSqm: lot.areaSqm || 500,
          price: lot.basePrice || (lot.areaSqm || 500) * 100,
          polygonPoints: pointsJson,
          blockName: lot.blockName || 'Phase 1',
        },
        create: {
          id: slotId,
          parcelId: targetParcelId,
          slotNumber: lot.slotNumber,
          sizeSqm: lot.areaSqm || 500,
          price: lot.basePrice || (lot.areaSqm || 500) * 100,
          status: SlotStatus.AVAILABLE,
          row,
          col,
          polygonPoints: pointsJson,
          blockName: lot.blockName || 'Phase 1',
        }
      });
      createdSlots.push(slot);
    }

    broadcastChange('slots');
    invalidateAllDataCache();
    res.json({ success: true, count: createdSlots.length, slots: createdSlots });
  } catch (error) {
    console.error('Error importing CAD lots:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/slots/clear-all
legacyParcelsRouter.delete('/slots/clear-all', async (req: Request, res: Response) => {
  try {
    await prisma.clientPackage.updateMany({
      data: { slotId: null }
    });
    await prisma.slot.deleteMany({});
    broadcastChange('slots');
    broadcastChange('clients');
    invalidateAllDataCache();
    res.json({ success: true, message: 'All lots cleared successfully.' });
  } catch (error) {
    console.error('Error clearing lots:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/slots/transition-status
legacyParcelsRouter.post('/slots/transition-status', async (req: Request, res: Response) => {
  const { slotId, newStatus, actorName, actorRole, notes, clientId } = req.body;
  try {
    const dbStatus = mapStringToDbStatus(newStatus);
    
    const updatedSlot = await prisma.slot.update({
      where: { id: slotId },
      data: { status: dbStatus }
    });

    if (dbStatus === SlotStatus.AVAILABLE) {
      await prisma.clientPackage.updateMany({
        where: { slotId },
        data: { slotId: null }
      });
    } else if (clientId) {
      await prisma.clientPackage.updateMany({
        where: { userId: clientId },
        data: { slotId }
      });
    }

    broadcastChange('slots');
    broadcastChange('clients');
    invalidateAllDataCache();
    res.json({
      slot: {
        ...updatedSlot,
        status: mapDbStatusToString(updatedSlot.status),
      }
    });
  } catch (error) {
    console.error('Error transitioning slot status:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/clients
legacyParcelsRouter.post('/clients', async (req: Request, res: Response) => {
  const { id, name, email, contact, packageName, paymentPlan, totalContractPrice, slotId, registrationDate } = req.body;
  try {
    const inviteToken = crypto.randomBytes(24).toString('hex');
    const inviteTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanSlotId = slotId && typeof slotId === 'string' && slotId.trim().length > 0 ? slotId.trim() : null;

    const user = await prisma.user.upsert({
      where: { email: cleanEmail },
      update: {
        name,
        contact: contact || undefined,
        inviteToken,
        inviteTokenExpiry,
        accountStatus: 'INVITED',
      },
      create: {
        id: id || `CLI-${Date.now().toString().slice(-4)}`,
        name,
        email: cleanEmail,
        contact: contact || '',
        role: Role.CLIENT,
        accountStatus: 'INVITED',
        inviteToken,
        inviteTokenExpiry,
        createdAt: new Date(registrationDate || Date.now()),
      }
    });

    const clientPackage = await prisma.clientPackage.upsert({
      where: { userId: user.id },
      update: {
        slotId: cleanSlotId,
        price: totalContractPrice || 45000,
        packageType: packageName || 'Standard Land Parcel Access Package',
        paymentMethod: paymentPlan === 'Installment' ? PaymentMethod.INSTALLMENT : PaymentMethod.SPOT_CASH,
      },
      create: {
        userId: user.id,
        slotId: cleanSlotId,
        price: totalContractPrice || 45000,
        packageType: packageName || 'Standard Land Parcel Access Package',
        paymentMethod: paymentPlan === 'Installment' ? PaymentMethod.INSTALLMENT : PaymentMethod.SPOT_CASH,
      }
    });

    if (cleanSlotId) {
      await prisma.slot.updateMany({
        where: { id: cleanSlotId },
        data: { status: SlotStatus.RESERVED }
      });
    }

    await prisma.titlePermitTracker.upsert({
      where: { clientPackageId: clientPackage.id },
      update: {},
      create: {
        clientPackageId: clientPackage.id,
        currentPhase: 'Reservation & Buyer KYC Verification',
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
      }
    });

    await prisma.buyerKyc.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        govtIdVerified: false,
        tinVerified: false,
        proofOfIncomeVerified: false,
        proofOfAddressVerified: false,
        maritalConsentVerified: false,
        kycStatus: 'PENDING',
        notes: 'Client account created. Pending document submission.',
      }
    });

    const fullClientData = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        buyerKyc: true,
        clientPackage: {
          include: {
            installmentLedgers: { orderBy: { dueDate: 'asc' } },
            titlePermitTracker: true
          }
        }
      }
    });

    const mapped = await mapUserToClient(fullClientData);
    broadcastChange('clients');
    broadcastChange('slots');
    invalidateAllDataCache();
    res.json(mapped);
  } catch (error) {
    console.error('Error registering client:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/clients/assign-slot
legacyParcelsRouter.post('/clients/assign-slot', async (req: Request, res: Response) => {
  const { clientId, slotId } = req.body;
  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: clientId },
          { email: clientId.toLowerCase() }
        ]
      }
    });

    if (!user) {
      return res.status(404).json({ error: `Buyer record ${clientId} not found.` });
    }

    const cleanSlotId = slotId && typeof slotId === 'string' && slotId.trim().length > 0 ? slotId.trim() : null;

    if (cleanSlotId) {
      await prisma.clientPackage.updateMany({
        where: { slotId: cleanSlotId, userId: { not: user.id } },
        data: { slotId: null }
      });
    }

    const clientPackage = await prisma.clientPackage.upsert({
      where: { userId: user.id },
      update: { slotId: cleanSlotId },
      create: {
        userId: user.id,
        slotId: cleanSlotId,
        price: 48000,
        packageType: 'Cavinti Highland Crest Land Parcel',
        paymentMethod: PaymentMethod.INSTALLMENT,
      }
    });

    let updatedSlot = null;
    if (cleanSlotId) {
      updatedSlot = await prisma.slot.update({
        where: { id: cleanSlotId },
        data: { status: SlotStatus.RESERVED }
      });
    }

    broadcastChange('clients');
    broadcastChange('slots');
    invalidateAllDataCache();
    res.json({ clientPackage, slot: updatedSlot ? { ...updatedSlot, status: mapDbStatusToString(updatedSlot.status) } : null });
  } catch (error) {
    console.error('Error assigning client to slot:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/clients/:id
legacyParcelsRouter.delete('/clients/:id', async (req: Request, res: Response) => {
  const clientId = req.params.id;
  try {
    const user = await prisma.user.findUnique({
      where: { id: clientId },
      include: {
        clientPackage: true,
        buyerKyc: true,
      }
    });

    if (!user) {
      return res.status(404).json({ error: `Client account ${clientId} not found.` });
    }

    const assignedSlotId = user.clientPackage?.slotId;

    if (assignedSlotId) {
      await prisma.slot.updateMany({
        where: { id: assignedSlotId },
        data: { status: SlotStatus.AVAILABLE }
      });
    }

    if (user.clientPackage) {
      await prisma.installmentLedger.deleteMany({
        where: { clientPackageId: user.clientPackage.id }
      });
      await prisma.titlePermitTracker.deleteMany({
        where: { clientPackageId: user.clientPackage.id }
      });
    }
    await prisma.clientPackage.deleteMany({
      where: { userId: user.id }
    });

    await prisma.buyerKyc.deleteMany({
      where: { userId: user.id }
    });

    await prisma.user.deleteMany({
      where: { id: user.id }
    });

    broadcastChange('clients');
    broadcastChange('slots');
    invalidateAllDataCache();
    res.json({ success: true, message: `Buyer account ${user.name} deleted successfully.` });
  } catch (error) {
    console.error('Error deleting client account:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/clients/delete
legacyParcelsRouter.post('/clients/delete', async (req: Request, res: Response) => {
  const { clientId } = req.body;
  if (!clientId) {
    return res.status(400).json({ error: 'Client ID is required.' });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: clientId },
      include: {
        clientPackage: true,
        buyerKyc: true,
      }
    });

    if (!user) {
      return res.status(404).json({ error: `Client account ${clientId} not found.` });
    }

    const assignedSlotId = user.clientPackage?.slotId;

    if (assignedSlotId) {
      await prisma.slot.updateMany({
        where: { id: assignedSlotId },
        data: { status: SlotStatus.AVAILABLE }
      });
    }

    if (user.clientPackage) {
      await prisma.installmentLedger.deleteMany({
        where: { clientPackageId: user.clientPackage.id }
      });
      await prisma.titlePermitTracker.deleteMany({
        where: { clientPackageId: user.clientPackage.id }
      });
    }
    await prisma.clientPackage.deleteMany({
      where: { userId: user.id }
    });

    await prisma.buyerKyc.deleteMany({
      where: { userId: user.id }
    });

    await prisma.user.deleteMany({
      where: { id: user.id }
    });

    broadcastChange('clients');
    broadcastChange('slots');
    invalidateAllDataCache();
    res.json({ success: true, message: `Buyer account ${user.name} deleted successfully.` });
  } catch (error) {
    console.error('Error deleting client account:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/clients/update-title-pipeline
legacyParcelsRouter.post('/clients/update-title-pipeline', async (req: Request, res: Response) => {
  const { clientId, stepKey, value, tctNumber, taxDecNumber } = req.body;
  try {
    const clientPackage = await prisma.clientPackage.findUnique({
      where: { userId: clientId },
      include: { titlePermitTracker: true, slot: true }
    });

    if (!clientPackage || !clientPackage.titlePermitTracker) {
      return res.status(404).json({ error: 'Client Package or Titling Tracker Not Found' });
    }

    const updatePayload: any = {};
    if (stepKey !== undefined) {
      updatePayload[stepKey] = value;
    }
    if (tctNumber !== undefined) updatePayload.tctNumber = tctNumber;
    if (taxDecNumber !== undefined) updatePayload.taxDecNumber = taxDecNumber;

    const updated = await prisma.titlePermitTracker.update({
      where: { id: clientPackage.titlePermitTracker.id },
      data: updatePayload
    });

    let currentPhase = 'Reservation & Buyer KYC Verification';
    if (updated.certificateOfAcceptanceSigned) {
      currentPhase = 'Title Transferred & Property Handed Over';
    } else if (updated.registryOfDeedsTctReleased) {
      currentPhase = 'Registry of Deeds TCT Released (Turnover Ready)';
    } else if (updated.taxDeclarationTransferred) {
      currentPhase = 'Assessor Tax Declaration Transferred';
    } else if (updated.birEcarIssued) {
      currentPhase = 'BIR eCAR & Capital Gains Tax Clearance';
    } else if (updated.deedOfSaleSigned) {
      currentPhase = 'Deed of Absolute Sale (DOAS) Executed';
    } else if (updated.ctsSigned) {
      currentPhase = 'Contract to Sell (CTS) Executed';
    } else if (updated.dhsudLicenseToSell && updated.lguPermitIssued) {
      currentPhase = 'LGU & DHSUD Project Permitting Approved';
    }

    await prisma.titlePermitTracker.update({
      where: { id: updated.id },
      data: { currentPhase }
    });

    if (updated.registryOfDeedsTctReleased && clientPackage.slotId) {
      const currentSlot = await prisma.slot.findUnique({ where: { id: clientPackage.slotId } });
      if (currentSlot && (currentSlot.status === SlotStatus.TITLING_PHASE || currentSlot.status === SlotStatus.UNDER_CONTRACT || currentSlot.status === SlotStatus.RESERVED)) {
        await prisma.slot.update({
          where: { id: clientPackage.slotId },
          data: { status: SlotStatus.TURNOVER_READY }
        });
      }
    }

    broadcastChange('clients');
    broadcastChange('slots');
    invalidateAllDataCache();
    res.json({ ...updated, currentPhase });
  } catch (error) {
    console.error('Error updating titling pipeline:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/clients/verify-kyc
legacyParcelsRouter.post('/clients/verify-kyc', async (req: Request, res: Response) => {
  const { clientId, docKey, verified, notes } = req.body;
  try {
    let kyc = await prisma.buyerKyc.findUnique({ where: { userId: clientId } });
    if (!kyc) {
      kyc = await prisma.buyerKyc.create({
        data: { userId: clientId, kycStatus: 'PENDING' }
      });
    }

    const updateData: any = { [docKey]: verified };
    if (notes) updateData.notes = notes;

    const prospectiveState = { ...kyc, ...updateData };
    const allVerified = prospectiveState.govtIdVerified && prospectiveState.tinVerified && prospectiveState.proofOfIncomeVerified && prospectiveState.proofOfAddressVerified;
    updateData.kycStatus = allVerified ? 'VERIFIED' : 'UNDER_REVIEW';
    if (allVerified) updateData.verifiedAt = new Date();

    const updatedKyc = await prisma.buyerKyc.update({
      where: { userId: clientId },
      data: updateData
    });

    broadcastChange('clients');
    invalidateAllDataCache();
    res.json(updatedKyc);
  } catch (error) {
    console.error('Error verifying buyer KYC:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/clients/sign-acceptance
legacyParcelsRouter.post('/clients/sign-acceptance', async (req: Request, res: Response) => {
  const { clientId } = req.body;
  try {
    const clientPackage = await prisma.clientPackage.findUnique({
      where: { userId: clientId },
      include: { titlePermitTracker: true, slot: true }
    });

    if (!clientPackage || !clientPackage.titlePermitTracker) {
      return res.status(404).json({ error: 'Client Package or Titling Tracker Not Found' });
    }

    await prisma.titlePermitTracker.update({
      where: { id: clientPackage.titlePermitTracker.id },
      data: {
        certificateOfAcceptanceSigned: true,
        currentPhase: 'Title Transferred & Property Handed Over',
      }
    });

    if (clientPackage.slotId) {
      await prisma.slot.update({
        where: { id: clientPackage.slotId },
        data: { status: SlotStatus.HANDED_OVER }
      });
    }

    broadcastChange('clients');
    broadcastChange('slots');
    invalidateAllDataCache();
    res.json({ success: true });
  } catch (error) {
    console.error('Error signing acceptance:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/clients/generate-invite
legacyParcelsRouter.post('/clients/generate-invite', async (req: Request, res: Response) => {
  const { clientId } = req.body;
  if (!clientId) {
    return res.status(400).json({ error: 'Client ID is required.' });
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: clientId },
          { email: clientId.toLowerCase() }
        ]
      }
    });

    if (!user) {
      return res.status(404).json({ error: `Buyer record ${clientId} not found.` });
    }

    const token = crypto.randomBytes(24).toString('hex');
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        inviteToken: token,
        inviteTokenExpiry: expiry,
        accountStatus: 'INVITED',
      }
    });

    res.json({
      success: true,
      inviteToken: token,
      inviteTokenExpiry: expiry.toISOString(),
      buyerName: updatedUser.name,
      buyerEmail: updatedUser.email,
    });
  } catch (error) {
    console.error('Error generating invite token:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/clients/send-handover-email
legacyParcelsRouter.post('/clients/send-handover-email', async (req: Request, res: Response) => {
  const { clientId, email, originUrl } = req.body;
  if (!clientId) {
    return res.status(400).json({ error: 'Client ID is required.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: clientId },
      include: { clientPackage: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Buyer account not found.' });
    }

    let token = user.inviteToken;
    if (!token) {
      token = crypto.randomBytes(24).toString('hex');
      const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await prisma.user.update({
        where: { id: user.id },
        data: { inviteToken: token, inviteTokenExpiry: expiry, accountStatus: 'INVITED' }
      });
    }

    const targetEmail = email || user.email;
    const baseUrl = originUrl || process.env.APP_URL || 'http://localhost:3000';
    const activationUrl = `${baseUrl}/?activateToken=${token}`;

    const transporter = await getMailTransporter();
    if (transporter) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"CTVill Builders Corporation" <no-reply@ctvill.ph>',
        to: targetEmail,
        subject: `[CTVill Builders Corporation] Client Account Notification - ${user.name}`,
        html: `<p>Hello ${user.name},</p><p>Your account link: <a href="${activationUrl}">${activationUrl}</a></p>`,
        text: `Hello ${user.name},\nYour account link: ${activationUrl}`,
      });
    }

    res.json({ success: true, delivered: true, inviteToken: token });
  } catch (error: any) {
    console.error('Error sending handover email:', error);
    res.status(500).json({ error: error?.message || 'Internal Server Error' });
  }
});

// DELETE /api/admin/clear-all-data: Safely clears operational models while preserving user accounts
legacyParcelsRouter.delete('/admin/clear-all-data', async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM ai_manpower_recommendations');
    await pool.query('DELETE FROM labor_allocations');
    await pool.query('DELETE FROM fitout_quotations');
    await pool.query('DELETE FROM project_rfis');
    await pool.query('DELETE FROM schedule_events');
    await pool.query('DELETE FROM government_permits');
    await pool.query('DELETE FROM extended_payroll');
    await pool.query('DELETE FROM daily_manpower_audits');
    await pool.query('DELETE FROM commercial_projects');
    await pool.query('DELETE FROM weather_cache');

    await prisma.changeOrder.deleteMany();
    await prisma.processAuditLog.deleteMany();
    await prisma.weeklyProgressLog.deleteMany();
    await prisma.punchListDefect.deleteMany();
    await prisma.projectTask.deleteMany();
    await prisma.dailySiteLog.deleteMany();
    await prisma.projectDocument.deleteMany();
    await prisma.projectRisk.deleteMany();
    await prisma.civilWorksMilestone.deleteMany();
    await prisma.payrollRecord.deleteMany();
    await prisma.contractor.deleteMany();

    await prisma.installmentLedger.deleteMany();
    await prisma.titlePermitTracker.deleteMany();
    await prisma.buyerKyc.deleteMany();
    await prisma.clientPackage.deleteMany();

    await prisma.slot.deleteMany();
    await prisma.landParcel.deleteMany();

    invalidateAllDataCache();
    broadcastChange('clients');
    broadcastChange('contractors');
    res.json({ success: true, message: 'All operational data cleared. User accounts preserved.' });
  } catch (error: any) {
    console.error('Error clearing all data:', error);
    res.status(500).json({ error: 'Failed to clear data', detail: error.message });
  }
});
