/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AttendanceStatusType = 'PRESENT' | 'ABSENT' | 'HALF_DAY';

export interface WorkerRateInfo {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  position: string;
  dailyRate: number;
  hourlyOtRate: number;
  status: string;
}

export interface AttendanceEntry {
  id?: string;
  workerId: string;
  date: string | Date;
  status: AttendanceStatusType | string;
  overtimeHours: number;
  isLocked?: boolean;
}

export interface CashAdvanceEntry {
  id: string;
  workerId: string;
  amount: number;
  dateIssued: string | Date;
  status: 'PENDING' | 'DEDUCTED' | string;
  notes?: string | null;
}

export interface WorkerPayrollBreakdown {
  workerId: string;
  workerName: string;
  position: string;
  dailyRate: number;
  hourlyOtRate: number;
  daysWorked: number;
  presentCount: number;
  halfDayCount: number;
  absentCount: number;
  otHours: number;
  basePay: number;
  otPay: number;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  appliedCashAdvanceIds: string[];
  cashAdvances: CashAdvanceEntry[];
}

export interface PayrollRunCalculation {
  projectId: string;
  periodStart: string;
  periodEnd: string;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  workerCount: number;
  items: WorkerPayrollBreakdown[];
}

/**
 * Days worked calculation:
 * PRESENT = 1.0 day
 * HALF_DAY = 0.5 day
 * ABSENT = 0 days
 */
export function getDaysWorkedMultiplier(status: string): number {
  const norm = (status || '').toUpperCase().trim();
  if (norm === 'PRESENT') return 1.0;
  if (norm === 'HALF_DAY') return 0.5;
  return 0.0; // ABSENT or unknown
}

/**
 * Standard construction overtime rate: (Daily Rate / 8 hours) * 1.25
 */
export function computeDefaultHourlyOtRate(dailyRate: number): number {
  return Number(((dailyRate / 8) * 1.25).toFixed(2));
}

/**
 * Calculate weekly payroll breakdown for a single worker
 */
export function calculateWorkerPayroll(
  worker: WorkerRateInfo,
  logs: AttendanceEntry[],
  advances: CashAdvanceEntry[]
): WorkerPayrollBreakdown {
  let daysWorked = 0;
  let presentCount = 0;
  let halfDayCount = 0;
  let absentCount = 0;
  let totalOtHours = 0;

  for (const log of logs) {
    const norm = (log.status || '').toUpperCase().trim();
    if (norm === 'PRESENT') {
      presentCount++;
      daysWorked += 1.0;
    } else if (norm === 'HALF_DAY') {
      halfDayCount++;
      daysWorked += 0.5;
    } else {
      absentCount++;
    }
    totalOtHours += Number(log.overtimeHours || 0);
  }

  const dailyRate = Number(worker.dailyRate || 0);
  const hourlyOtRate = worker.hourlyOtRate > 0 
    ? Number(worker.hourlyOtRate) 
    : computeDefaultHourlyOtRate(dailyRate);

  // Business Logic Formulas
  // Base Pay = Total Days Worked * worker.daily_rate
  const basePay = Number((daysWorked * dailyRate).toFixed(2));
  
  // OT Pay = Total OT Hours * worker.hourly_ot_rate
  const otPay = Number((totalOtHours * hourlyOtRate).toFixed(2));
  
  // Gross Pay = Base Pay + OT Pay
  const grossPay = Number((basePay + otPay).toFixed(2));
  
  // Deductions = Sum of pending CashAdvances within the pay cycle
  const applicableAdvances = advances.filter(a => a.status === 'PENDING' && Number(a.amount) > 0);
  const totalDeductions = Number(applicableAdvances.reduce((sum, a) => sum + Number(a.amount), 0).toFixed(2));
  
  // Net Pay = Gross Pay - Deductions
  const netPay = Number(Math.max(0, grossPay - totalDeductions).toFixed(2));

  return {
    workerId: worker.id,
    workerName: worker.name || `${worker.firstName || ''} ${worker.lastName || ''}`.trim() || 'Artisan',
    position: worker.position,
    dailyRate,
    hourlyOtRate,
    daysWorked,
    presentCount,
    halfDayCount,
    absentCount,
    otHours: totalOtHours,
    basePay,
    otPay,
    grossPay,
    totalDeductions,
    netPay,
    appliedCashAdvanceIds: applicableAdvances.map(a => a.id),
    cashAdvances: applicableAdvances
  };
}

/**
 * Calculate weekly payroll draft given project, date range, workers, logs, and cash advances
 */
export function calculateProjectPayrollRun(params: {
  projectId: string;
  periodStart: string;
  periodEnd: string;
  workers: WorkerRateInfo[];
  attendanceLogs: AttendanceEntry[];
  cashAdvances: CashAdvanceEntry[];
}): PayrollRunCalculation {
  const { projectId, periodStart, periodEnd, workers, attendanceLogs, cashAdvances } = params;

  // Group attendance logs by workerId
  const logsByWorker = new Map<string, AttendanceEntry[]>();
  for (const log of attendanceLogs) {
    if (!logsByWorker.has(log.workerId)) {
      logsByWorker.set(log.workerId, []);
    }
    logsByWorker.get(log.workerId)!.push(log);
  }

  // Group pending cash advances by workerId
  const advancesByWorker = new Map<string, CashAdvanceEntry[]>();
  for (const adv of cashAdvances) {
    if (!advancesByWorker.has(adv.workerId)) {
      advancesByWorker.set(adv.workerId, []);
    }
    advancesByWorker.get(adv.workerId)!.push(adv);
  }

  const items: WorkerPayrollBreakdown[] = [];
  let totalGross = 0;
  let totalDeductions = 0;
  let totalNet = 0;

  for (const worker of workers) {
    const workerLogs = logsByWorker.get(worker.id) || [];
    const workerAdvances = advancesByWorker.get(worker.id) || [];

    // Calculate payroll item
    const item = calculateWorkerPayroll(worker, workerLogs, workerAdvances);
    items.push(item);

    totalGross += item.grossPay;
    totalDeductions += item.totalDeductions;
    totalNet += item.netPay;
  }

  return {
    projectId,
    periodStart,
    periodEnd,
    totalGross: Number(totalGross.toFixed(2)),
    totalDeductions: Number(totalDeductions.toFixed(2)),
    totalNet: Number(totalNet.toFixed(2)),
    workerCount: items.length,
    items
  };
}
