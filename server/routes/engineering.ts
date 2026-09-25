/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { prisma, pool } from '../db';
import { broadcastChange, invalidateAllDataCache } from '../events';

export const engineeringRouter = Router();

// ============================================================================
// GOVERNMENT PERMITS (PEZA, MACEA, CITY HALL, FDAS, ELECTRICAL)
// ============================================================================

// GET /api/permits
engineeringRouter.get('/permits', async (req: Request, res: Response) => {
  try {
    const dbPermits = await pool.query('SELECT * FROM government_permits ORDER BY expiry_date ASC NULLS LAST, created_at DESC');
    const permits = (dbPermits.rows || []).map(p => ({
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
    }));
    res.json(permits);
  } catch (error) {
    console.error('Error fetching permits:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/permits
engineeringRouter.post('/permits', async (req: Request, res: Response) => {
  try {
    const {
      projectName,
      permitName,
      permitType,
      issuingAgency,
      referenceNo,
      status,
      applicationDate,
      approvalDate,
      expiryDate,
      notes,
      documentUrl
    } = req.body;

    if (!projectName || !permitName || !permitType || !issuingAgency) {
      return res.status(400).json({ error: 'Missing required permit fields' });
    }

    const id = `PMT-${Date.now().toString().slice(-6)}`;
    await pool.query(
      `INSERT INTO government_permits 
       (id, project_name, permit_name, permit_type, issuing_agency, reference_no, status, application_date, approval_date, expiry_date, notes, document_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        id,
        projectName,
        permitName,
        permitType,
        issuingAgency,
        referenceNo || null,
        status || 'PENDING',
        applicationDate || null,
        approvalDate || null,
        expiryDate || null,
        notes || '',
        documentUrl || ''
      ]
    );

    await prisma.processAuditLog.create({
      data: {
        entityType: 'CIVIL_WORKS',
        entityId: id,
        action: 'PERMIT_FILED',
        actorName: 'Compliance Officer',
        actorRole: 'ADMIN',
        details: `Filed permit application "${permitName}" (${permitType}) for ${projectName}. Agency: ${issuingAgency}`,
      }
    }).catch(() => {});

    broadcastChange('permits');
    broadcastChange('auditLogs');
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error creating permit:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PATCH /api/permits/:id
engineeringRouter.patch('/permits/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      permitName, 
      projectName, 
      permitType, 
      issuingAgency, 
      referenceNo, 
      status, 
      applicationDate, 
      approvalDate, 
      expiryDate, 
      notes, 
      documentUrl 
    } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (permitName !== undefined) { updates.push(`permit_name = $${idx++}`); values.push(permitName); }
    if (projectName !== undefined) { updates.push(`project_name = $${idx++}`); values.push(projectName); }
    if (permitType !== undefined) { updates.push(`permit_type = $${idx++}`); values.push(permitType); }
    if (issuingAgency !== undefined) { updates.push(`issuing_agency = $${idx++}`); values.push(issuingAgency); }
    if (referenceNo !== undefined) { updates.push(`reference_no = $${idx++}`); values.push(referenceNo); }
    if (status !== undefined) { updates.push(`status = $${idx++}`); values.push(status); }
    if (applicationDate !== undefined) { updates.push(`application_date = $${idx++}`); values.push(applicationDate || null); }
    if (approvalDate !== undefined) { updates.push(`approval_date = $${idx++}`); values.push(approvalDate || null); }
    if (expiryDate !== undefined) { updates.push(`expiry_date = $${idx++}`); values.push(expiryDate || null); }
    if (notes !== undefined) { updates.push(`notes = $${idx++}`); values.push(notes); }
    if (documentUrl !== undefined) { updates.push(`document_url = $${idx++}`); values.push(documentUrl); }

    if (updates.length > 0) {
      values.push(id);
      await pool.query(`UPDATE government_permits SET ${updates.join(', ')} WHERE id = $${idx}`, values);
    }

    broadcastChange('permits');
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error updating permit:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/permits/:id
engineeringRouter.delete('/permits/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM government_permits WHERE id = $1', [id]);
    broadcastChange('permits');
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting permit:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ============================================================================
// ENGINEERING BLUEPRINTS & CAD DOCUMENTS
// ============================================================================

// GET /api/documents
engineeringRouter.get('/documents', async (req: Request, res: Response) => {
  try {
    const docs = await prisma.projectDocument.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(docs);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/documents
engineeringRouter.post('/documents', async (req: Request, res: Response) => {
  const { title, category, fileUrl, fileSize, version, status, uploadedBy, notes } = req.body;
  try {
    const doc = await prisma.projectDocument.create({
      data: {
        title,
        category: category || 'CAD_DRAWING',
        fileUrl,
        fileSize: fileSize || '2.4 MB',
        version: version || '1.0',
        status: status || 'APPROVED',
        uploadedBy: uploadedBy || 'Mauro R. Principe Jr.',
        notes,
      }
    });

    await prisma.processAuditLog.create({
      data: {
        entityType: 'TITLING',
        entityId: doc.id,
        action: 'DOCUMENT_UPLOADED',
        actorName: uploadedBy || 'Mauro R. Principe Jr.',
        actorRole: 'ADMIN',
        details: `Uploaded ${doc.category} document: "${doc.title}" (v${doc.version}).`,
      }
    });

    broadcastChange('documents');
    broadcastChange('auditLogs');
    res.json(doc);
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /api/documents/:id
engineeringRouter.put('/documents/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, category, fileUrl, fileSize, version, status, uploadedBy, notes } = req.body;
  try {
    const doc = await prisma.projectDocument.update({
      where: { id },
      data: {
        title,
        category,
        version,
        status,
        notes,
        ...(fileUrl ? { fileUrl } : {}),
        ...(fileSize ? { fileSize } : {}),
      }
    });

    await prisma.processAuditLog.create({
      data: {
        entityType: 'TITLING',
        entityId: doc.id,
        action: 'DOCUMENT_UPDATED',
        actorName: uploadedBy || 'Mauro R. Principe Jr.',
        actorRole: 'ADMIN',
        details: `Updated document "${doc.title}" (v${doc.version}, status: ${doc.status}).`,
      }
    });

    broadcastChange('documents');
    broadcastChange('auditLogs');
    res.json(doc);
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/documents/:id
engineeringRouter.delete('/documents/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.projectDocument.delete({ where: { id } });

    await prisma.processAuditLog.create({
      data: {
        entityType: 'TITLING',
        entityId: id,
        action: 'DOCUMENT_DELETED',
        actorName: 'Mauro R. Principe Jr.',
        actorRole: 'ADMIN',
        details: `Deleted project document ${id}.`,
      }
    }).catch(() => {});

    broadcastChange('documents');
    broadcastChange('auditLogs');
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ============================================================================
// CHANGE ORDERS REST API
// ============================================================================

// GET /api/change-orders
engineeringRouter.get('/change-orders', async (req: Request, res: Response) => {
  try {
    const dbCOs = await prisma.changeOrder.findMany({ orderBy: { createdAt: 'desc' } });
    const changeOrders = dbCOs.map((c: any) => ({
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
    }));
    res.json(changeOrders);
  } catch (error) {
    console.error('Error fetching change orders:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/change-orders
engineeringRouter.post('/change-orders', async (req: Request, res: Response) => {
  try {
    const { title, contractorName, requestedAmount, justification, orderNumber } = req.body;
    if (!title || !requestedAmount) {
      return res.status(400).json({ error: 'Title and requested amount are required' });
    }
    const count = await prisma.changeOrder.count();
    const num = orderNumber || `CO-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;
    const created = await prisma.changeOrder.create({
      data: {
        orderNumber: num,
        title: title.trim(),
        contractorName: contractorName || 'SolidFoundations Engineering',
        requestedAmount: Number(requestedAmount) || 0,
        justification: justification || '',
        status: 'PENDING'
      }
    });

    broadcastChange('changeOrders');
    invalidateAllDataCache();
    res.json(created);
  } catch (error) {
    console.error('Error creating change order:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PATCH /api/change-orders/:id
engineeringRouter.patch('/change-orders/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, approvedAmount, approvedBy } = req.body;

    const data: any = {};
    if (status !== undefined) data.status = status;
    if (approvedAmount !== undefined) data.approvedAmount = approvedAmount === null ? null : Number(approvedAmount);
    if (approvedBy !== undefined) data.approvedBy = approvedBy;

    const updated = await prisma.changeOrder.update({
      where: { id },
      data
    });

    broadcastChange('changeOrders');
    invalidateAllDataCache();
    res.json(updated);
  } catch (error) {
    console.error('Error updating change order:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ============================================================================
// RFI (REQUEST FOR INFORMATION) REST API
// ============================================================================

// GET /api/rfis
engineeringRouter.get('/rfis', async (req: Request, res: Response) => {
  try {
    const dbRfisRes = await pool.query('SELECT * FROM project_rfis ORDER BY created_at DESC');
    const rfis = (dbRfisRes.rows || []).map((r: any) => ({
      id: r.id,
      rfiNumber: r.rfi_number,
      projectId: r.project_id,
      projectName: r.project_name,
      subject: r.subject,
      question: r.question,
      suggestedSolution: r.suggested_solution,
      answer: r.answer,
      status: r.status,
      priority: r.priority,
      assignedTo: r.assigned_to,
      submittedBy: r.submitted_by,
      drawingRef: r.drawing_ref,
      dueDate: r.due_date ? (r.due_date instanceof Date ? r.due_date.toISOString().split('T')[0] : String(r.due_date).split('T')[0]) : undefined,
      createdAt: r.created_at ? (r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at)) : undefined,
      updatedAt: r.updated_at ? (r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at)) : undefined,
    }));
    res.json(rfis);
  } catch (error) {
    console.error('Error fetching RFIs:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/rfis
engineeringRouter.post('/rfis', async (req: Request, res: Response) => {
  try {
    const { rfiNumber, projectId, projectName, subject, question, suggestedSolution, priority, assignedTo, submittedBy, drawingRef, dueDate } = req.body;
    if (!subject || !question) {
      return res.status(400).json({ error: 'Subject and question are required' });
    }

    const id = `RFI-${Date.now().toString().slice(-6)}`;
    const countRes = await pool.query('SELECT count(*) FROM project_rfis');
    const num = rfiNumber || `RFI-${new Date().getFullYear()}-${String(parseInt(countRes.rows[0].count, 10) + 1).padStart(3, '0')}`;

    await pool.query(
      `INSERT INTO project_rfis 
       (id, rfi_number, project_id, project_name, subject, question, suggested_solution, status, priority, assigned_to, submitted_by, drawing_ref, due_date, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'OPEN', $8, $9, $10, $11, $12, NOW(), NOW())`,
      [
        id, 
        num, 
        projectId || null, 
        projectName || 'Commercial Fit-Out Site', 
        subject, 
        question, 
        suggestedSolution || null, 
        priority || 'MEDIUM', 
        assignedTo || 'Site Architect', 
        submittedBy || 'Project Manager', 
        drawingRef || null, 
        dueDate ? new Date(dueDate) : null
      ]
    );

    broadcastChange('rfis');
    invalidateAllDataCache();
    res.json({ success: true, id, rfiNumber: num });
  } catch (error) {
    console.error('Error submitting RFI:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PATCH /api/rfis/:id
engineeringRouter.patch('/rfis/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { answer, status, priority, assignedTo, suggestedSolution } = req.body;

    const updates: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let idx = 1;

    if (answer !== undefined) { updates.push(`answer = $${idx++}`); values.push(answer); }
    if (status !== undefined) { updates.push(`status = $${idx++}`); values.push(status); }
    if (priority !== undefined) { updates.push(`priority = $${idx++}`); values.push(priority); }
    if (assignedTo !== undefined) { updates.push(`assigned_to = $${idx++}`); values.push(assignedTo); }
    if (suggestedSolution !== undefined) { updates.push(`suggested_solution = $${idx++}`); values.push(suggestedSolution); }

    if (updates.length > 1) {
      values.push(id);
      await pool.query(`UPDATE project_rfis SET ${updates.join(', ')} WHERE id = $${idx}`, values);
    }

    broadcastChange('rfis');
    invalidateAllDataCache();
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error updating RFI:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
