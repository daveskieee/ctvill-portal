/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { Role, PaymentMethod, PaymentStatus, PayrollRole, DisbursementType, PayrollStatus } from '@prisma/client';
import { prisma, pool } from '../db';
import { broadcastChange, invalidateAllDataCache } from '../events';
import { sendFitOutQuotationEmail } from '../email';

export const financeRouter = Router();

// ============================================================================
// COMMERCIAL FIT-OUT QUOTATIONS & CRM LEADS
// ============================================================================

// GET /api/quotations
financeRouter.get('/quotations', async (req: Request, res: Response) => {
  try {
    const dbQuotationsRes = await pool.query('SELECT * FROM fitout_quotations ORDER BY created_at DESC');
    const quotations = (dbQuotationsRes.rows || []).map((q: any) => ({
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
    }));
    res.json(quotations);
  } catch (error) {
    console.error('Error fetching quotations:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/quotations
financeRouter.post('/quotations', async (req: Request, res: Response) => {
  const {
    id, clientName, clientEmail, clientPhone, projectScope,
    estimatedCost, estimatedWeeks, estimatorArea,
    spaceType, finishTier, projectNotes, status
  } = req.body;

  if (!clientName || !clientEmail) {
    return res.status(400).json({ error: 'clientName and clientEmail are required' });
  }

  const quoteId = id || `CTV-QT-${Date.now().toString(36).toUpperCase()}`;

  try {
    await pool.query(`
      INSERT INTO fitout_quotations 
      (id, client_name, client_email, client_phone, project_scope, estimated_cost, estimated_weeks, estimator_area, space_type, finish_tier, project_notes, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      quoteId,
      clientName.trim(),
      clientEmail.trim().toLowerCase(),
      clientPhone || '',
      projectScope || 'Turnkey Fit-Out',
      Number(estimatedCost) || 0,
      Number(estimatedWeeks) || 0,
      Number(estimatorArea) || 0,
      spaceType || '',
      finishTier || '',
      projectNotes || '',
      status || 'NEW_INQUIRY'
    ]);

    broadcastChange('quotations');
    invalidateAllDataCache();

    res.json({ success: true, id: quoteId });
  } catch (error: any) {
    console.error('Error creating quotation:', error);
    res.status(500).json({ error: 'Internal Server Error: ' + (error?.message || '') });
  }
});

// POST /api/quotations/submit (Public Web Lead Submission & Email Dispatch)
financeRouter.post('/quotations/submit', async (req: Request, res: Response) => {
  const {
    clientName, clientEmail, clientPhone, projectScope,
    estimatedCost, estimatedWeeks, estimatorArea,
    spaceType, finishTier, projectNotes
  } = req.body;

  if (!clientName || !clientEmail) {
    return res.status(400).json({ error: 'Name and email address are required.' });
  }

  const quoteId = `CTV-QT-${Date.now().toString(36).toUpperCase()}`;

  try {
    await pool.query(`
      INSERT INTO fitout_quotations 
      (id, client_name, client_email, client_phone, project_scope, estimated_cost, estimated_weeks, estimator_area, space_type, finish_tier, project_notes, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'NEW_INQUIRY')
    `, [
      quoteId,
      clientName.trim(),
      clientEmail.trim().toLowerCase(),
      clientPhone || '',
      projectScope || 'Turnkey Fit-Out',
      Number(estimatedCost) || 0,
      Number(estimatedWeeks) || 0,
      Number(estimatorArea) || 0,
      spaceType || '',
      finishTier || '',
      projectNotes || ''
    ]);

    await prisma.processAuditLog.create({
      data: {
        entityType: 'CLIENT',
        entityId: quoteId,
        action: 'QUOTATION_REQUESTED',
        actorName: clientName.trim(),
        actorRole: 'CLIENT',
        details: `Commercial fit-out quotation inquiry submitted: ${projectScope}. Inquirer: ${clientName} (${clientEmail}). Cost: ₱${Number(estimatedCost || 0).toLocaleString()}. Ref: ${quoteId}.`,
      }
    }).catch(() => {});

    broadcastChange('auditLogs');
    broadcastChange('quotations');
    invalidateAllDataCache();

    const emailResult = await sendFitOutQuotationEmail({
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim().toLowerCase(),
      clientPhone,
      projectScope,
      estimatedCost: Number(estimatedCost) || 0,
      estimatedWeeks: Number(estimatedWeeks) || 0,
      estimatorArea: Number(estimatorArea) || 0,
      spaceType,
      finishTier,
      projectNotes,
      quoteId,
    });

    res.json({
      success: true,
      quoteId,
      delivered: emailResult.delivered,
      message: `Quotation request successfully submitted! A confirmation copy has been dispatched to ${clientEmail}.`
    });
  } catch (error: any) {
    console.error('Error handling quotation submission:', error);
    res.status(500).json({ error: 'Failed to process quotation request: ' + (error?.message || 'Server error') });
  }
});

// PATCH /api/quotations/:id
financeRouter.patch('/quotations/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, projectNotes } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (status !== undefined) { updates.push(`status = $${idx++}`); values.push(status); }
    if (projectNotes !== undefined) { updates.push(`project_notes = $${idx++}`); values.push(projectNotes); }

    if (updates.length > 0) {
      values.push(id);
      await pool.query(`UPDATE fitout_quotations SET ${updates.join(', ')} WHERE id = $${idx}`, values);
    }

    broadcastChange('quotations');
    invalidateAllDataCache();
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error updating quotation:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/quotations/:id/convert-to-project
financeRouter.post('/quotations/:id/convert-to-project', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const qRes = await pool.query('SELECT * FROM fitout_quotations WHERE id = $1', [id]);
    if (!qRes.rows || qRes.rows.length === 0) {
      return res.status(404).json({ error: 'Quotation not found' });
    }
    const q = qRes.rows[0];
    const newProjId = `PRJ-${Date.now().toString().slice(-4)}`;
    const handoverDate = new Date();
    handoverDate.setDate(handoverDate.getDate() + (Number(q.estimated_weeks || 10) * 7));

    await pool.query(`
      INSERT INTO commercial_projects 
      (id, name, client_name, description, location, budget, funds_collected, progress_percentage, status, target_handover_date, start_date, assigned_workers_count, tasks_count, milestones_count)
      VALUES 
      ($1, $2, $3, $4, $5, $6, $7, 0, 'IN_PROGRESS', $8, CURRENT_DATE, 12, 10, 4)
    `, [
      newProjId,
      `${q.client_name} Fit-Out`,
      q.client_name,
      q.project_scope || 'Commercial Turnkey Fit-Out',
      'Laguna / Metro Manila Prime Commercial Zone',
      Number(q.estimated_cost) || 3500000,
      0,
      handoverDate
    ]);

    await pool.query('UPDATE fitout_quotations SET status = $1, converted_project_id = $2 WHERE id = $3', ['CONVERTED', newProjId, id]);
    broadcastChange('quotations');
    broadcastChange('projects');
    invalidateAllDataCache();

    res.json({ 
      success: true, 
      projectId: newProjId, 
      message: `Quotation converted to Commercial Project ${newProjId}!` 
    });
  } catch (error) {
    console.error('Error converting quotation to project:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ============================================================================
// EXTENDED PAYROLL REST API
// ============================================================================

// GET /api/extended-payroll
financeRouter.get('/extended-payroll', async (req: Request, res: Response) => {
  try {
    const dbRows = await pool.query('SELECT * FROM extended_payroll ORDER BY created_at DESC');
    const records = (dbRows.rows || []).map(p => ({
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
    }));
    res.json(records);
  } catch (error) {
    console.error('Error fetching extended payroll:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/extended-payroll
financeRouter.post('/extended-payroll', async (req: Request, res: Response) => {
  try {
    const {
      workerName,
      contractorCompany,
      projectName,
      role,
      hoursWorked,
      daysWorked,
      dailyRate,
      overtimeHours,
      grossPay,
      deductions,
      netPay,
      status,
      paymentMethod
    } = req.body;

    if (!workerName || !projectName) {
      return res.status(400).json({ error: 'Worker name and project are required' });
    }

    const id = `PAY-${Date.now().toString().slice(-4)}`;
    await pool.query(
      `INSERT INTO extended_payroll 
       (id, worker_name, contractor_company, project_name, role, hours_worked, days_worked, daily_rate, overtime_hours, gross_pay, deductions, net_pay, status, payment_method)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        id,
        workerName,
        contractorCompany || 'Trade Crew',
        projectName,
        role || 'Artisan',
        hoursWorked || 80,
        daysWorked || 10,
        dailyRate || 900,
        overtimeHours || 0,
        grossPay || 9000,
        deductions || 500,
        netPay || 8500,
        status || 'Pending',
        paymentMethod || 'Bank Transfer'
      ]
    );

    broadcastChange('extendedPayroll');
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error creating extended payroll record:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PATCH /api/extended-payroll/:id
financeRouter.patch('/extended-payroll/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      workerName,
      role,
      dailyRate,
      daysWorked,
      overtimeHours,
      grossPay,
      deductions,
      netPay,
      status,
      disbursementDate
    } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (workerName !== undefined) { updates.push(`worker_name = $${idx++}`); values.push(workerName); }
    if (role !== undefined) { updates.push(`role = $${idx++}`); values.push(role); }
    if (dailyRate !== undefined) { updates.push(`daily_rate = $${idx++}`); values.push(dailyRate); }
    if (daysWorked !== undefined) { updates.push(`days_worked = $${idx++}`); values.push(daysWorked); }
    if (overtimeHours !== undefined) { updates.push(`overtime_hours = $${idx++}`); values.push(overtimeHours); }
    if (grossPay !== undefined) { updates.push(`gross_pay = $${idx++}`); values.push(grossPay); }
    if (deductions !== undefined) { updates.push(`deductions = $${idx++}`); values.push(deductions); }
    if (netPay !== undefined) { updates.push(`net_pay = $${idx++}`); values.push(netPay); }
    if (status !== undefined) { updates.push(`status = $${idx++}`); values.push(status); }
    if (disbursementDate !== undefined) { updates.push(`disbursement_date = $${idx++}`); values.push(disbursementDate || null); }

    if (updates.length > 0) {
      values.push(id);
      await pool.query(`UPDATE extended_payroll SET ${updates.join(', ')} WHERE id = $${idx}`, values);
    }

    broadcastChange('extendedPayroll');
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error updating extended payroll record:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/extended-payroll/:id
financeRouter.delete('/extended-payroll/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM extended_payroll WHERE id = $1', [id]);
    broadcastChange('extendedPayroll');
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting extended payroll record:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ============================================================================
// PAYROLL RECORDS & DISBURSAL
// ============================================================================

// GET /api/payroll-records
financeRouter.get('/payroll-records', async (req: Request, res: Response) => {
  try {
    const dbPayroll = await prisma.payrollRecord.findMany({
      orderBy: { date: 'desc' }
    });
    const payroll = dbPayroll.map(p => ({
      id: p.id,
      date: p.date.toISOString().split('T')[0],
      payeeName: p.payeeName,
      role: p.role === PayrollRole.INTERNAL_STAFF ? 'Internal Staff' : p.role === PayrollRole.SITE_MONITOR ? 'Site Monitor' : 'Contractor',
      disbursementType: p.disbursementType === DisbursementType.SALARY ? 'Salary' : 'Contract Milestone',
      amount: Number(p.amount),
      status: p.status === PayrollStatus.DISBURSED ? 'Disbursed' : 'Pending',
      paymentMethod: p.paymentMethod,
    }));
    res.json(payroll);
  } catch (error) {
    console.error('Error fetching payroll:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/payroll/disburse
financeRouter.post('/payroll/disburse', async (req: Request, res: Response) => {
  try {
    const { id, all } = req.body;

    if (all) {
      await prisma.payrollRecord.updateMany({
        where: { status: PayrollStatus.PENDING },
        data: { status: PayrollStatus.DISBURSED }
      });

      await prisma.processAuditLog.create({
        data: {
          entityType: 'PAYROLL',
          entityId: 'ALL_BATCH',
          action: 'PAYROLL_BATCH_DISBURSED',
          actorName: 'Executive Finance',
          actorRole: 'ADMIN',
          details: 'Disbursed all pending contractor and site worker payroll records.',
        }
      }).catch(() => {});
    } else if (id) {
      await prisma.payrollRecord.update({
        where: { id },
        data: { status: PayrollStatus.DISBURSED }
      });

      await prisma.processAuditLog.create({
        data: {
          entityType: 'PAYROLL',
          entityId: id,
          action: 'PAYROLL_RECORD_DISBURSED',
          actorName: 'Executive Finance',
          actorRole: 'ADMIN',
          details: `Disbursed payroll wage record ${id}.`,
        }
      }).catch(() => {});
    }

    broadcastChange('payroll');
    broadcastChange('auditLogs');
    res.json({ success: true });
  } catch (error) {
    console.error('Error disbursing payroll:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ============================================================================
// CLIENT PROGRESS PAYMENTS & INVOICING
// ============================================================================

// POST /api/payments/record
financeRouter.post('/payments/record', async (req: Request, res: Response) => {
  try {
    const { clientId, amount, paymentMethod, reference } = req.body;
    if (!clientId || !amount) {
      return res.status(400).json({ error: 'Missing clientId or amount' });
    }

    let clientUser = await prisma.user.findUnique({
      where: { id: clientId },
      include: {
        clientPackage: {
          include: {
            installmentLedgers: { orderBy: { dueDate: 'asc' } }
          }
        }
      }
    });

    if (!clientUser) {
      clientUser = await prisma.user.findFirst({
        where: { name: clientId },
        include: {
          clientPackage: {
            include: {
              installmentLedgers: { orderBy: { dueDate: 'asc' } }
            }
          }
        }
      });
    }

    // Check if clientId corresponds to a project ID, project name, or project client
    let targetProject = null;
    try {
      const targetProjectRes = await pool.query(
        'SELECT * FROM commercial_projects WHERE id = $1 OR name = $1 OR client_name = $1 LIMIT 1',
        [clientId]
      );
      targetProject = targetProjectRes.rows?.[0] || null;
      if (targetProject) {
        await pool.query(
          'UPDATE commercial_projects SET funds_collected = COALESCE(funds_collected, 0) + $1 WHERE id = $2',
          [Number(amount), targetProject.id]
        );
        broadcastChange('projects');
      }
    } catch (e) {
      console.warn('Error checking commercial_projects for payment:', e);
    }

    if (!clientUser) {
      const clientName = targetProject?.client_name || clientId;
      try {
        clientUser = await prisma.user.create({
          data: {
            name: clientName,
            email: `${clientName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'client'}_${Date.now()}@client.ctvill.internal`,
            role: 'CLIENT',
            passwordHash: 'CLIENT_NOPASS'
          },
          include: {
            clientPackage: {
              include: {
                installmentLedgers: { orderBy: { dueDate: 'asc' } }
              }
            }
          }
        });
      } catch (userErr) {
        console.warn('Fallback client creation notice:', userErr);
      }
    }

    if (!clientUser) {
      // If still unable to create User, return success if project was updated
      if (targetProject) {
        broadcastChange('projects');
        broadcastChange('auditLogs');
        return res.json({ success: true, amount: Number(amount), projectId: targetProject.id });
      }
      return res.status(404).json({ error: 'Client user not found' });
    }

    const paymentAmount = Number(amount);
    let packageId = clientUser.clientPackage?.id;
    if (!packageId) {
      const newPkg = await prisma.clientPackage.create({
        data: {
          userId: clientUser.id,
          price: paymentAmount,
          packageType: 'Commercial Fit-Out & Architectural Works',
          paymentMethod: PaymentMethod.INSTALLMENT
        }
      });
      packageId = newPkg.id;
    }

    const pendingLedger = clientUser.clientPackage?.installmentLedgers?.find(
      l => l.status === PaymentStatus.PENDING
    );

    if (pendingLedger) {
      await prisma.installmentLedger.update({
        where: { id: pendingLedger.id },
        data: {
          status: PaymentStatus.PAID,
          amountPaid: paymentAmount,
          paymentDate: new Date()
        }
      });
    } else {
      await prisma.installmentLedger.create({
        data: {
          clientPackageId: packageId,
          dueDate: new Date(),
          amountDue: paymentAmount,
          amountPaid: paymentAmount,
          status: PaymentStatus.PAID,
          paymentDate: new Date()
        }
      });
    }

    await prisma.processAuditLog.create({
      data: {
        entityType: 'PAYMENT',
        entityId: clientId,
        action: 'PAYMENT_RECEIVED',
        actorName: 'Treasury / Finance Lead',
        actorRole: 'ADMIN',
        details: `Recorded payment of ₱${paymentAmount.toLocaleString()} via ${paymentMethod || 'Bank Transfer'} for ${clientUser.name}. ${reference ? `Ref: ${reference}` : ''}`,
      }
    }).catch(() => {});

    broadcastChange('clients');
    broadcastChange('auditLogs');
    res.json({ success: true, amount: paymentAmount });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/payments/installment
financeRouter.post('/payments/installment', async (req: Request, res: Response) => {
  try {
    const { clientId, clientName, amount, dueDate, projectName } = req.body;
    if (!amount) {
      return res.status(400).json({ error: 'Missing required amount' });
    }

    let user = clientId ? await prisma.user.findUnique({
      where: { id: clientId },
      include: { clientPackage: true }
    }) : null;

    if (!user && clientName) {
      user = await prisma.user.findFirst({
        where: { name: clientName.trim() },
        include: { clientPackage: true }
      });
    }

    if (!user) {
      const cleanName = (clientName || 'Commercial Client').trim();
      const cleanEmail = `client.${Date.now()}@ctvill.internal`;
      user = await prisma.user.create({
        data: {
          name: cleanName,
          email: cleanEmail,
          role: Role.CLIENT,
          accountStatus: 'ACTIVE',
          clientPackage: {
            create: {
              price: Number(amount) * 3,
              packageType: projectName || 'Commercial Fit-Out & Architectural Works',
              paymentMethod: PaymentMethod.INSTALLMENT
            }
          }
        },
        include: { clientPackage: true }
      });
    } else if (!user.clientPackage) {
      await prisma.clientPackage.create({
        data: {
          userId: user.id,
          price: Number(amount) * 3,
          packageType: projectName || 'Commercial Fit-Out & Architectural Works',
          paymentMethod: PaymentMethod.INSTALLMENT
        }
      });
      user = await prisma.user.findUnique({
        where: { id: user.id },
        include: { clientPackage: true }
      });
    }

    const packageId = user!.clientPackage!.id;
    const due = dueDate ? new Date(dueDate) : new Date();

    const ledger = await prisma.installmentLedger.create({
      data: {
        clientPackageId: packageId,
        dueDate: due,
        amountDue: Number(amount),
        amountPaid: 0,
        status: PaymentStatus.PENDING
      }
    });

    await prisma.processAuditLog.create({
      data: {
        entityType: 'PAYMENT',
        entityId: ledger.id,
        action: 'INVOICE_GENERATED',
        actorName: 'Finance Department',
        actorRole: 'ADMIN',
        details: `Created invoice / progress installment of ₱${Number(amount).toLocaleString()} for ${user!.name} (Due: ${due.toISOString().split('T')[0]}).`,
      }
    }).catch(() => {});

    broadcastChange('clients');
    broadcastChange('auditLogs');
    res.json(ledger);
  } catch (error) {
    console.error('Error creating installment ledger:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PATCH /api/payments/installment/:id
financeRouter.patch('/payments/installment/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, amountPaid, paymentDate } = req.body;

    const existing = await prisma.installmentLedger.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Installment ledger record not found' });
    }

    const isPaid = status === 'Paid' || status === PaymentStatus.PAID;
    const updated = await prisma.installmentLedger.update({
      where: { id },
      data: {
        status: isPaid ? PaymentStatus.PAID : PaymentStatus.PENDING,
        amountPaid: isPaid ? (amountPaid !== undefined ? Number(amountPaid) : existing.amountDue) : 0,
        paymentDate: isPaid ? (paymentDate ? new Date(paymentDate) : new Date()) : null
      }
    });

    broadcastChange('clients');
    res.json(updated);
  } catch (error) {
    console.error('Error updating installment ledger:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/payments/installment/:id
financeRouter.delete('/payments/installment/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.installmentLedger.delete({ where: { id } });
    broadcastChange('clients');
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting installment ledger:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ============================================================================
// SUBCONTRACTOR PAYABLES (AP - Accounts Payable / Contractor Disbursements)
// ============================================================================

const ensureSubcontractorPayablesTable = async () => {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS subcontractor_payables (
      id TEXT PRIMARY KEY,
      disbursement_date DATE,
      payee_contractor_id TEXT,
      payee_contractor_name TEXT NOT NULL,
      trade_specialty TEXT NOT NULL DEFAULT 'General Trade',
      project_site TEXT NOT NULL,
      audit_id TEXT,
      verified_headcount INTEGER DEFAULT 0,
      claimed_headcount INTEGER DEFAULT 0,
      billed_days NUMERIC DEFAULT 0,
      rate_per_day NUMERIC DEFAULT 0,
      billed_amount NUMERIC NOT NULL DEFAULT 0,
      approved_amount NUMERIC,
      disbursed_amount NUMERIC,
      payment_method TEXT DEFAULT 'Bank Wire',
      reference_no TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING_AUDIT',
      remarks TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`
  );

  const countRes = await pool.query('SELECT count(*) FROM subcontractor_payables');
  if (parseInt(countRes.rows[0].count, 10) === 0) {
    await pool.query(
      `INSERT INTO subcontractor_payables
       (id, disbursement_date, payee_contractor_id, payee_contractor_name, trade_specialty, project_site, audit_id,
        verified_headcount, claimed_headcount, billed_days, rate_per_day, billed_amount,
        approved_amount, disbursed_amount, payment_method, reference_no, status, remarks, created_by, created_at)
       VALUES 
       ('SPY-001', '2026-09-26', 'CONT-1789598922028', 'Brent', 'Concrete Pouring & Structural Works', 'NexBridge Software Hub', 'AUD-1790357393677',
        15, 15, 3, 1000, 45000, NULL, NULL, 'Bank Wire', NULL, 'PENDING_AUDIT', '15 Men Verified on-site for NexBridge Concrete Pouring shift. Gate muster 100% matched, pending fund release.', 'Finance Department', NOW()),
       ('SPY-002', '2026-09-20', 'CONT-1789599140157', 'Paul', 'Skilled Trade Crews (Electricians, Carpenters, Painters, Masons)', 'NexBridge Software Hub', 'AUD-67542',
        10, 10, 2, 1400, 28000, 28000, NULL, 'Check', 'CHK-2026-0981', 'APPROVED', 'Quadrant B electrical rough-ins and conduit works verified with GPS photo proof. Approved for payout.', 'Finance Department', NOW() - INTERVAL '6 days'),
       ('SPY-003', '2026-09-18', 'CONT-1789599064683', 'Lizter', 'Site Foremen & General Labor Muster', 'NexBridge Software Hub', 'AUD-08944',
        50, 50, 2.5, 1000, 125000, 125000, 125000, 'Bank Wire', 'BW-889123-BDO', 'PAID', 'Full 50-man field supervision gang verified across all NexBridge levels. Disbursed via BDO wire.', 'Finance Department', NOW() - INTERVAL '8 days')
       ON CONFLICT (id) DO NOTHING`
    );
  }
};

const formatToISODateString = (val: any): string | null => {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().split('T')[0];
  }
  const s = String(val).trim();
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return s;
};

// GET /api/subcontractor-payables
financeRouter.get('/subcontractor-payables', async (req: Request, res: Response) => {
  try {
    await ensureSubcontractorPayablesTable();
    const result = await pool.query(
      `SELECT * FROM subcontractor_payables ORDER BY created_at DESC`
    );
    const records = (result.rows || []).map((r: any) => ({
      id: r.id,
      disbursementDate: formatToISODateString(r.disbursement_date),
      payeeContractorId: r.payee_contractor_id || undefined,
      payeeContractorName: r.payee_contractor_name,
      tradeSpecialty: r.trade_specialty,
      projectSite: r.project_site,
      auditId: r.audit_id || undefined,
      verifiedHeadcount: Number(r.verified_headcount || 0),
      claimedHeadcount: Number(r.claimed_headcount || 0),
      billedDays: Number(r.billed_days || 0),
      ratePerDay: Number(r.rate_per_day || 0),
      billedAmount: Number(r.billed_amount || 0),
      approvedAmount: r.approved_amount !== null && r.approved_amount !== undefined ? Number(r.approved_amount) : undefined,
      disbursedAmount: r.disbursed_amount !== null && r.disbursed_amount !== undefined ? Number(r.disbursed_amount) : undefined,
      paymentMethod: r.payment_method || 'Bank Wire',
      referenceNo: r.reference_no || undefined,
      status: r.status || 'PENDING_AUDIT',
      remarks: r.remarks || undefined,
      createdBy: r.created_by || undefined,
      createdAt: r.created_at ? (r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at)) : undefined,
    }));
    res.json(records);
  } catch (error: any) {
    console.warn('subcontractor_payables fetch warning:', error?.message);
    res.json([]);
  }
});

// POST /api/subcontractor-payables  - Create new disbursement record
financeRouter.post('/subcontractor-payables', async (req: Request, res: Response) => {
  try {
    const {
      payeeContractorId, payeeContractorName, tradeSpecialty, projectSite,
      auditId, verifiedHeadcount, claimedHeadcount, billedDays, ratePerDay,
      billedAmount, approvedAmount, paymentMethod, referenceNo, status, remarks, createdBy
    } = req.body;

    if (!payeeContractorName || !projectSite || !billedAmount) {
      return res.status(400).json({ error: 'payeeContractorName, projectSite, and billedAmount are required.' });
    }

    // Auto-create table if it does not exist
    await pool.query(
      `CREATE TABLE IF NOT EXISTS subcontractor_payables (
        id TEXT PRIMARY KEY,
        disbursement_date DATE,
        payee_contractor_id TEXT,
        payee_contractor_name TEXT NOT NULL,
        trade_specialty TEXT NOT NULL DEFAULT 'General Trade',
        project_site TEXT NOT NULL,
        audit_id TEXT,
        verified_headcount INTEGER DEFAULT 0,
        claimed_headcount INTEGER DEFAULT 0,
        billed_days NUMERIC DEFAULT 0,
        rate_per_day NUMERIC DEFAULT 0,
        billed_amount NUMERIC NOT NULL DEFAULT 0,
        approved_amount NUMERIC,
        disbursed_amount NUMERIC,
        payment_method TEXT DEFAULT 'Bank Wire',
        reference_no TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING_AUDIT',
        remarks TEXT,
        created_by TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`
    );

    const id = `SPY-${Date.now()}`;
    const billedAmt = Number(billedAmount) || (Number(billedDays || 0) * Number(ratePerDay || 0));
    await pool.query(
      `INSERT INTO subcontractor_payables
       (id, payee_contractor_id, payee_contractor_name, trade_specialty, project_site, audit_id,
        verified_headcount, claimed_headcount, billed_days, rate_per_day, billed_amount,
        approved_amount, payment_method, reference_no, status, remarks, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        id, payeeContractorId || null, payeeContractorName, tradeSpecialty || 'General Trade',
        projectSite, auditId || null, Number(verifiedHeadcount || 0), Number(claimedHeadcount || 0),
        Number(billedDays || 0), Number(ratePerDay || 0), billedAmt,
        approvedAmount !== undefined && approvedAmount !== null ? Number(approvedAmount) : null,
        paymentMethod || 'Bank Wire', referenceNo || null,
        status || 'PENDING_AUDIT', remarks || null, createdBy || null,
      ]
    );

    // Record in Process Audit Log
    try {
      await prisma.processAuditLog.create({
        data: {
          entityType: 'SUBCONTRACTOR_PAYABLE',
          entityId: id,
          action: 'INVOICE_GENERATED',
          actorName: (req as any).user?.name || createdBy || 'Finance Department',
          actorRole: 'FINANCE',
          details: `Logged subcontractor payable invoice for ${payeeContractorName} (${projectSite}) for ₱${Number(billedAmount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Headcount basis: ${verifiedHeadcount} verified / ${claimedHeadcount} claimed. Linked Audit: ${auditId || 'None'}.`,
        }
      });
      broadcastChange('auditLogs');
    } catch (auditErr: any) {
      console.warn('Process audit log error for new payable:', auditErr?.message);
    }

    broadcastChange('subcontractorPayables');
    res.json({ success: true, id });
  } catch (error: any) {
    console.error('Error creating subcontractor payable:', error);
    res.status(500).json({ error: 'Internal Server Error: ' + (error?.message || '') });
  }
});

// PATCH /api/subcontractor-payables/:id  - Update status / disburse
financeRouter.patch('/subcontractor-payables/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      status, disbursementDate, approvedAmount, disbursedAmount,
      paymentMethod, referenceNo, remarks
    } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (status !== undefined) { updates.push(`status = $${idx++}`); values.push(status); }
    if (disbursementDate !== undefined) { updates.push(`disbursement_date = $${idx++}`); values.push(disbursementDate || null); }
    if (approvedAmount !== undefined) { updates.push(`approved_amount = $${idx++}`); values.push(Number(approvedAmount)); }
    if (disbursedAmount !== undefined) { updates.push(`disbursed_amount = $${idx++}`); values.push(Number(disbursedAmount)); }
    if (paymentMethod !== undefined) { updates.push(`payment_method = $${idx++}`); values.push(paymentMethod); }
    if (referenceNo !== undefined) { updates.push(`reference_no = $${idx++}`); values.push(referenceNo); }
    if (remarks !== undefined) { updates.push(`remarks = $${idx++}`); values.push(remarks); }

    if (updates.length > 0) {
      values.push(id);
      await pool.query(`UPDATE subcontractor_payables SET ${updates.join(', ')} WHERE id = $${idx}`, values);

      // Record in Process Audit Log on status transition
      try {
        const curRes = await pool.query('SELECT * FROM subcontractor_payables WHERE id = $1', [id]);
        const cur = curRes.rows[0];
        const payeeName = cur?.payee_contractor_name || 'Subcontractor';
        const project = cur?.project_site || 'Project Site';

        if (status === 'PAID') {
          const finalAmount = disbursedAmount ?? cur?.disbursed_amount ?? cur?.approved_amount ?? cur?.billed_amount ?? 0;
          const finalRef = referenceNo || cur?.reference_no || 'N/A';
          const method = paymentMethod || cur?.payment_method || 'Bank Wire';

          await prisma.processAuditLog.create({
            data: {
              entityType: 'SUBCONTRACTOR_PAYABLE',
              entityId: id,
              action: 'DISBURSEMENT_RELEASED',
              actorName: (req as any).user?.name || 'Finance Officer',
              actorRole: 'FINANCE',
              details: `Subcontractor disbursement released to ${payeeName} (${project}). Amount: ₱${Number(finalAmount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} via ${method} (Ref: #${finalRef}). Linked Audit: ${cur?.audit_id || 'N/A'}.`,
            }
          });
          broadcastChange('auditLogs');
        } else if (status === 'APPROVED') {
          const appAmount = approvedAmount ?? cur?.approved_amount ?? cur?.billed_amount ?? 0;
          await prisma.processAuditLog.create({
            data: {
              entityType: 'SUBCONTRACTOR_PAYABLE',
              entityId: id,
              action: 'PAYABLE_APPROVED',
              actorName: (req as any).user?.name || 'Finance Officer',
              actorRole: 'FINANCE',
              details: `Subcontractor payable invoice approved for ${payeeName} (${project}). Approved payout amount: ₱${Number(appAmount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Linked Audit: ${cur?.audit_id || 'N/A'}.`,
            }
          });
          broadcastChange('auditLogs');
        } else if (status === 'DISPUTED') {
          await prisma.processAuditLog.create({
            data: {
              entityType: 'SUBCONTRACTOR_PAYABLE',
              entityId: id,
              action: 'PAYABLE_DISPUTED',
              actorName: (req as any).user?.name || 'Finance Officer',
              actorRole: 'FINANCE',
              details: `Subcontractor payable invoice for ${payeeName} (${project}) flagged as DISPUTED. Audit verification discrepancy detected.`,
            }
          });
          broadcastChange('auditLogs');
        }
      } catch (auditErr: any) {
        console.warn('Process audit log error for payable patch:', auditErr?.message);
      }
    }

    broadcastChange('subcontractorPayables');
    res.json({ success: true, id });
  } catch (error: any) {
    console.error('Error updating subcontractor payable:', error);
    res.status(500).json({ error: 'Internal Server Error: ' + (error?.message || '') });
  }
});
