/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { prisma, pool } from '../db';
import { broadcastChange, invalidateAllDataCache } from '../events';

export const workforceRouter = Router();

// ============================================================================
// CONTRACTORS & ARTISAN WORKFORCE DIRECTORY
// ============================================================================

// Helper to determine if worker/personnel is office, executive, or corporate support
export function isOfficeOrExecutiveWorker(c: any): boolean {
  if (!c) return false;
  const workforceClass = c.workforce_class || c.workforceClass;
  if (workforceClass === 'Corporate') return true;
  if (c.workforceCategory === 'OFFICE_STAFF') return true;
  const dept = (c.department || '').toLowerCase();
  const role = (c.roleTitle || c.specialty || c.role || '').toLowerCase();
  return (
    dept.includes('executive') ||
    dept.includes('corporate') ||
    dept.includes('finance') ||
    dept.includes('accounting') ||
    dept.includes('human resources') ||
    dept.includes('admin') ||
    dept.includes('legal') ||
    dept.includes('procurement') ||
    role.includes('board') ||
    role.includes('president') ||
    role.includes('ceo') ||
    role.includes('coo') ||
    role.includes('director') ||
    role.includes('finance') ||
    role.includes('accounting') ||
    role.includes('accountant') ||
    role.includes('hr') ||
    role.includes('recruiter') ||
    role.includes('legal') ||
    role.includes('buyer')
  );
}

// Strictly determine if worker is eligible for manual artisan trade swaps/reallocations
// Excludes corporate staff, office personnel, architects, project managers, engineers, and permanent safety inspectors (e.g. EHSO)
export function isEligibleForArtisanReallocation(c: any): boolean {
  if (!c) return false;
  const name = (c.name || '').toLowerCase();
  if (name.includes('builders') || name.includes('corporation') || name.includes('inc.') || name.includes('corp.')) {
    return false;
  }
  const workforceClass = c.workforce_class || c.workforceClass;
  if (workforceClass === 'Corporate') return false;
  if (c.workforceCategory === 'OFFICE_STAFF') return false;
  if (isOfficeOrExecutiveWorker(c)) return false;

  const role = (c.roleTitle || c.specialty || c.role || '').toLowerCase();
  const dept = (c.department || '').toLowerCase();

  // Exclude architects & pre-construction designers
  if (role.includes('architect') || role.includes('designer') || dept.includes('design') || dept.includes('pre-construction')) {
    return false;
  }

  // Exclude project managers, site engineers, and coordinators
  if (
    role.includes('project manager') ||
    role.includes('pm') ||
    role.includes('construction manager') ||
    role.includes('site manager') ||
    role.includes('site engineer') ||
    role.includes('project engineer') ||
    role.includes('engineer') ||
    role.includes('qa/qc') ||
    role.includes('consultant') ||
    role.includes('coordinator') ||
    role.includes('director') ||
    role.includes('executive')
  ) {
    return false;
  }

  // Exclude permanent safety inspectors (EHSO) & officers
  if (
    role.includes('safety') ||
    role.includes('ehso') ||
    role.includes('inspector') ||
    dept.includes('safety') ||
    dept.includes('inspection')
  ) {
    return false;
  }

  if (role.includes('officer') && !role.includes('artisan')) {
    return false;
  }

  return true;
}

// GET /api/contractors-list
workforceRouter.get('/contractors-list', async (req: Request, res: Response) => {
  try {
    const dbContractors = await prisma.contractor.findMany({
      orderBy: { name: 'asc' }
    });
    
    const presencesRes = await pool.query('SELECT id, active_presence, status FROM contractors').catch(() => ({ rows: [] }));
    const presenceMap = new Map((presencesRes.rows || []).map((r: any) => [r.id, r.active_presence || r.status]));

    const contractors = dbContractors.map(c => {
      const rawP = presenceMap.get(c.id) || (c as any).status || 'ACTIVE';
      const activePresence = (rawP === 'BREAK' || rawP === 'ON_BREAK') ? 'BREAK'
        : (rawP === 'OFFLINE' || rawP === 'INACTIVE' || rawP === 'ON_LEAVE') ? 'OFFLINE'
        : 'ONLINE';

      const dept = ((c as any).department || '').toLowerCase();
      const role = ((c as any).roleTitle || c.specialty || '').toLowerCase();
      const cat = ((c as any).workforceCategory || '').toUpperCase();
      const isCorporate = (
        cat === 'OFFICE_STAFF' ||
        dept.includes('executive') ||
        dept.includes('corporate') ||
        dept.includes('office') ||
        dept.includes('finance') ||
        dept.includes('accounting') ||
        dept.includes('human resources') ||
        dept.includes('hr') ||
        dept.includes('legal') ||
        dept.includes('procurement') ||
        dept.includes('admin') ||
        role.includes('coo') ||
        role.includes('ceo') ||
        role.includes('chief') ||
        role.includes('director') ||
        role.includes('finance') ||
        role.includes('hr') ||
        role.includes('accounting') ||
        role.includes('clerk') ||
        role.includes('admin')
      ) && !role.includes('safety') && !role.includes('ehso');

      const workforceClass = isCorporate 
        ? 'Corporate' 
        : ((c as any).employmentType === 'OUTSOURCED' || Number(c.activeManpower || 1) > 1) 
          ? 'Trade Crew' 
          : 'Artisan';

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
        workforce_class: workforceClass,
        workforceClass,
      };
    });
    res.json(contractors);
  } catch (error) {
    console.error('Error fetching contractors:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/contractors
workforceRouter.post('/contractors', async (req: Request, res: Response) => {
  try {
    const {
      id,
      name,
      company,
      specialty,
      activeManpower,
      milestoneProgress,
      contractAmount,
      paidAmount,
      rating,
      employmentType,
      department,
      roleTitle,
      dailyRate,
      monthlySalary,
      status,
      activePresence,
      avatar,
      contact,
      activeProjectSite,
      assignedZone,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const contractorId = id || `CONT-${Date.now()}`;
    const newContractor = await prisma.contractor.create({
      data: {
        id: contractorId,
        name: name.trim(),
        company: company && company.trim() ? company.trim() : (employmentType === 'OUTSOURCED' ? name.trim() : 'CTVill Builders Corporation'),
        specialty: specialty || roleTitle || 'General Contractor',
        activeManpower: activeManpower !== undefined && activeManpower !== null ? Number(activeManpower) : 1,
        milestoneProgress: milestoneProgress !== undefined && milestoneProgress !== null ? Number(milestoneProgress) : 0,
        contractAmount: contractAmount !== undefined && contractAmount !== null ? Number(contractAmount) : 0,
        paidAmount: paidAmount !== undefined && paidAmount !== null ? Number(paidAmount) : 0,
        rating: rating !== undefined && rating !== null ? Number(rating) : 5.0,
        employmentType: employmentType || 'INTERNAL',
        department: department || null,
        roleTitle: roleTitle || null,
        dailyRate: dailyRate !== undefined && dailyRate !== null && dailyRate !== '' ? Number(dailyRate) : null,
        monthlySalary: monthlySalary !== undefined && monthlySalary !== null && monthlySalary !== '' ? Number(monthlySalary) : null,
        status: status || 'ACTIVE',
        avatar: avatar || null,
        contact: contact ? contact.trim() : null,
        activeProjectSite: activeProjectSite || null,
        assignedZone: assignedZone || null,
      },
    });

    if (activePresence) {
      await pool.query('UPDATE contractors SET active_presence = $1 WHERE id = $2', [activePresence, contractorId]);
    }

    // --- SYNCHRONIZE DIRECTLY WITH PRIMARY WORKERS TABLE ---
    const effectiveDailyRate = dailyRate !== undefined && dailyRate !== null && dailyRate !== '' ? Number(dailyRate) : 600;
    const effectiveOtRate = Number(((effectiveDailyRate / 8) * 1.25).toFixed(2));
    const workerTrade = specialty || roleTitle || 'Artisan';
    const workerPosition = roleTitle || specialty || 'Artisan';
    const workerStatus = (status && status.toUpperCase() === 'INACTIVE') ? 'Inactive' : 'Active';

    // Match assigned commercial project by ID or Name
    let assignedProjectId: string | null = null;
    if (activeProjectSite && activeProjectSite !== 'Unassigned' && activeProjectSite !== 'None') {
      const projRes = await pool.query(
        'SELECT id FROM commercial_projects WHERE id = $1 OR LOWER(name) = LOWER($1) LIMIT 1',
        [activeProjectSite]
      );
      if (projRes.rows.length > 0) {
        assignedProjectId = projRes.rows[0].id;
      }
    }

    const trimmedName = name.trim();
    const parts = trimmedName.split(' ');
    const fName = parts[0] || trimmedName;
    const lName = parts.slice(1).join(' ') || fName;

    await pool.query(`
      INSERT INTO workers (id, name, first_name, last_name, trade, position, daily_rate, hourly_ot_rate, assigned_project_id, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        trade = EXCLUDED.trade,
        position = EXCLUDED.position,
        daily_rate = EXCLUDED.daily_rate,
        hourly_ot_rate = EXCLUDED.hourly_ot_rate,
        assigned_project_id = EXCLUDED.assigned_project_id,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
    `, [contractorId, trimmedName, fName, lName, workerTrade, workerPosition, effectiveDailyRate, effectiveOtRate, assignedProjectId, workerStatus]);

    if (assignedProjectId) {
      await pool.query(`
        INSERT INTO project_worker_assignments (id, project_id, worker_id, assigned_at, status)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 'ACTIVE')
        ON CONFLICT (project_id, worker_id) DO UPDATE SET status = 'ACTIVE'
      `, [`PWA-${assignedProjectId}-${contractorId}`, assignedProjectId, contractorId]);
    }

    broadcastChange('contractors');
    broadcastChange('workers');
    invalidateAllDataCache();
    res.status(201).json({
      ...newContractor,
      contractAmount: Number(newContractor.contractAmount || 0),
      paidAmount: Number(newContractor.paidAmount || 0),
      dailyRate: newContractor.dailyRate ? Number(newContractor.dailyRate) : null,
      monthlySalary: newContractor.monthlySalary ? Number(newContractor.monthlySalary) : null,
      activePresence: activePresence || 'ONLINE',
      avatar: newContractor.avatar || null,
    });
  } catch (error) {
    console.error('Error creating contractor/worker:', error);
    res.status(500).json({ error: 'Failed to register contractor/worker' });
  }
});

// POST /api/contractors/update-progress
workforceRouter.post('/contractors/update-progress', async (req: Request, res: Response) => {
  try {
    const { contractors } = req.body;
    if (Array.isArray(contractors)) {
      for (const c of contractors) {
        if (c.id) {
          const statusVal = c.status || (c.activePresence === 'BREAK' ? 'BREAK' : c.activePresence === 'OFFLINE' ? 'OFFLINE' : 'ACTIVE');
          await prisma.contractor.update({
            where: { id: c.id },
            data: {
              activeManpower: c.activeManpower !== undefined ? Number(c.activeManpower) : undefined,
              milestoneProgress: c.milestoneProgress !== undefined ? Number(c.milestoneProgress) : undefined,
              rating: c.rating !== undefined ? Number(c.rating) : undefined,
              contractAmount: c.contractAmount !== undefined ? Number(c.contractAmount) : undefined,
              paidAmount: c.paidAmount !== undefined ? Number(c.paidAmount) : undefined,
              status: statusVal,
            }
          });
          if (c.activePresence) {
            await pool.query('UPDATE contractors SET active_presence = $1, status = $2 WHERE id = $3', [c.activePresence, statusVal, c.id]);
          }
        }
      }
      broadcastChange('contractors');
      invalidateAllDataCache();
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating contractors:', error);
    res.status(500).json({ error: 'Failed to update contractors' });
  }
});

// PUT /api/contractors/:id
workforceRouter.put('/contractors/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const statusVal = data.status || (data.activePresence === 'BREAK' ? 'BREAK' : data.activePresence === 'OFFLINE' ? 'OFFLINE' : 'ACTIVE');
    const updated = await prisma.contractor.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name.trim() : undefined,
        company: data.company !== undefined ? data.company.trim() : undefined,
        specialty: data.specialty || undefined,
        activeProjectSite: data.activeProjectSite !== undefined ? data.activeProjectSite : undefined,
        assignedZone: data.assignedZone !== undefined ? data.assignedZone : undefined,
        activeManpower: data.activeManpower !== undefined ? Number(data.activeManpower) : undefined,
        milestoneProgress: data.milestoneProgress !== undefined ? Number(data.milestoneProgress) : undefined,
        contractAmount: data.contractAmount !== undefined ? Number(data.contractAmount) : undefined,
        paidAmount: data.paidAmount !== undefined ? Number(data.paidAmount) : undefined,
        rating: data.rating !== undefined ? Number(data.rating) : undefined,
        employmentType: data.employmentType || undefined,
        department: data.department !== undefined ? data.department : undefined,
        roleTitle: data.roleTitle !== undefined ? data.roleTitle : undefined,
        dailyRate: data.dailyRate !== undefined && data.dailyRate !== null && data.dailyRate !== '' ? Number(data.dailyRate) : undefined,
        monthlySalary: data.monthlySalary !== undefined && data.monthlySalary !== null && data.monthlySalary !== '' ? Number(data.monthlySalary) : undefined,
        status: statusVal,
        avatar: data.avatar !== undefined ? data.avatar : undefined,
        contact: data.contact !== undefined ? data.contact : undefined,
      }
    });

    if (data.activePresence) {
      await pool.query('UPDATE contractors SET active_presence = $1, status = $2 WHERE id = $3', [data.activePresence, statusVal, id]);
    }

    // --- SYNCHRONIZE UPDATES TO WORKERS TABLE ---
    const updateClauses: string[] = [];
    const updateParams: any[] = [];
    let uIdx = 1;

    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      const parts = trimmed.split(' ');
      updateClauses.push(`name = $${uIdx++}`, `first_name = $${uIdx++}`, `last_name = $${uIdx++}`);
      updateParams.push(trimmed, parts[0] || trimmed, parts.slice(1).join(' ') || parts[0] || trimmed);
    }
    if (data.specialty !== undefined || data.roleTitle !== undefined) {
      const pos = data.roleTitle || data.specialty;
      updateClauses.push(`position = $${uIdx++}`, `trade = $${uIdx++}`);
      updateParams.push(pos, pos);
    }
    if (data.dailyRate !== undefined && data.dailyRate !== null && data.dailyRate !== '') {
      const dRate = Number(data.dailyRate);
      const otRate = Number(((dRate / 8) * 1.25).toFixed(2));
      updateClauses.push(`daily_rate = $${uIdx++}`, `hourly_ot_rate = $${uIdx++}`);
      updateParams.push(dRate, otRate);
    }
    if (data.status !== undefined || statusVal !== undefined) {
      const st = (data.status || statusVal).toUpperCase() === 'INACTIVE' ? 'Inactive' : 'Active';
      updateClauses.push(`status = $${uIdx++}`);
      updateParams.push(st);
    }
    if (data.activeProjectSite !== undefined) {
      let assignedProjId: string | null = null;
      if (data.activeProjectSite && data.activeProjectSite !== 'Unassigned' && data.activeProjectSite !== 'None') {
        const pMatch = await pool.query(
          'SELECT id FROM commercial_projects WHERE id = $1 OR LOWER(name) = LOWER($1) LIMIT 1',
          [data.activeProjectSite]
        );
        if (pMatch.rows.length > 0) {
          assignedProjId = pMatch.rows[0].id;
        }
      }
      updateClauses.push(`assigned_project_id = $${uIdx++}`);
      updateParams.push(assignedProjId);

      // Also sync project_worker_assignments & commercial_projects
      if (assignedProjId) {
        // Remove from any other project assignments so worker strictly belongs to the new site
        await pool.query('DELETE FROM project_worker_assignments WHERE worker_id = $1 AND project_id != $2', [id, assignedProjId]);
        await pool.query(`
          INSERT INTO project_worker_assignments (id, project_id, worker_id, assigned_at, status)
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 'ACTIVE')
          ON CONFLICT (project_id, worker_id) DO UPDATE SET status = 'ACTIVE'
        `, [`PWA-${assignedProjId}-${id}`, assignedProjId, id]);

        // Synchronize commercial_projects.assigned_contractor_ids
        await pool.query(`
          UPDATE commercial_projects
          SET assigned_contractor_ids = array_remove(assigned_contractor_ids, $1)
          WHERE id != $2 AND $1 = ANY(assigned_contractor_ids)
        `, [id, assignedProjId]);
        await pool.query(`
          UPDATE commercial_projects
          SET assigned_contractor_ids = array_append(array_remove(assigned_contractor_ids, $1), $1)
          WHERE id = $2
        `, [id, assignedProjId]);
      } else {
        await pool.query('DELETE FROM project_worker_assignments WHERE worker_id = $1', [id]);
        await pool.query(`
          UPDATE commercial_projects
          SET assigned_contractor_ids = array_remove(assigned_contractor_ids, $1)
          WHERE $1 = ANY(assigned_contractor_ids)
        `, [id]);
      }
    }

    if (updateClauses.length > 0) {
      updateClauses.push('updated_at = CURRENT_TIMESTAMP');
      updateParams.push(id);
      await pool.query(
        `UPDATE workers SET ${updateClauses.join(', ')} WHERE id = $${uIdx}`,
        updateParams
      );
    }

    broadcastChange('contractors');
    broadcastChange('workers');
    broadcastChange('projects');
    broadcastChange('attendance');
    invalidateAllDataCache();
    res.json(updated);
  } catch (error) {
    console.error('Error updating contractor:', error);
    res.status(500).json({ error: 'Failed to update contractor' });
  }
});

// DELETE /api/contractors/:id
workforceRouter.delete('/contractors/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.punchListDefect.updateMany({
      where: { contractorId: id },
      data: { contractorId: null }
    });
    await prisma.projectTask.updateMany({
      where: { assignedContractorId: id },
      data: { assignedContractorId: null }
    });
    await pool.query('DELETE FROM labor_allocations WHERE contractor_id = $1', [id]);
    await pool.query('DELETE FROM project_worker_assignments WHERE worker_id = $1', [id]);
    await pool.query('DELETE FROM workers WHERE id = $1', [id]);
    await prisma.contractor.delete({ where: { id } });
    broadcastChange('contractors');
    broadcastChange('workers');
    invalidateAllDataCache();
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting contractor:', error);
    res.status(500).json({ error: 'Failed to delete contractor' });
  }
});

// ============================================================================
// LABOR ALLOCATIONS
// ============================================================================

// GET /api/labor-allocations
workforceRouter.get('/labor-allocations', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM labor_allocations ORDER BY sector_name ASC');
    const allocations = (result.rows || []).map(r => ({
      id: r.id,
      contractorId: r.contractor_id,
      contractorName: r.contractor_name,
      sectorName: r.sector_name,
      targetLots: r.target_lots,
      assignedHeadcount: Number(r.assigned_headcount || 0),
      workScope: r.work_scope,
      status: r.status,
      notes: r.notes || '',
      updatedAt: r.updated_at ? r.updated_at.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    }));
    res.json(allocations);
  } catch (error) {
    console.error('Error fetching labor allocations:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/labor-allocations
workforceRouter.post('/labor-allocations', async (req: Request, res: Response) => {
  try {
    const { id, contractorId, contractorName, sectorName, targetLots, assignedHeadcount, workScope, status, notes } = req.body;
    const allocId = id || `ALLOC-${Date.now()}`;
    await pool.query(
      `INSERT INTO labor_allocations (id, contractor_id, contractor_name, sector_name, target_lots, assigned_headcount, work_scope, status, notes, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_DATE)
       ON CONFLICT (id) DO UPDATE SET
         contractor_id = EXCLUDED.contractor_id,
         contractor_name = EXCLUDED.contractor_name,
         sector_name = EXCLUDED.sector_name,
         target_lots = EXCLUDED.target_lots,
         assigned_headcount = EXCLUDED.assigned_headcount,
         work_scope = EXCLUDED.work_scope,
         status = EXCLUDED.status,
         notes = EXCLUDED.notes,
         updated_at = CURRENT_DATE`,
      [allocId, contractorId, contractorName, sectorName, targetLots, assignedHeadcount, workScope, status || 'ACTIVE', notes || '']
    );

    if (contractorId) {
      await pool.query('UPDATE contractors SET "activeManpower" = $1 WHERE id = $2', [assignedHeadcount, contractorId]);
    }

    broadcastChange('laborAllocations');
    broadcastChange('contractors');
    res.json({ success: true, id: allocId });
  } catch (error) {
    console.error('Error saving labor allocation:', error);
    res.status(500).json({ error: 'Failed to save labor allocation' });
  }
});

// ============================================================================
// AI MANPOWER OPTIMIZATION & REALLOCATION
// ============================================================================

// GET /api/ai-recommendations
workforceRouter.get('/ai-recommendations', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM ai_manpower_recommendations WHERE dismissed = false ORDER BY created_at DESC');
    const recs = (result.rows || []).map(r => {
      // Derive concise category tag
      let conciseCategory = r.category_tag;
      if (!conciseCategory) {
        const isStandby = (r.donor_project_name || '').toLowerCase().includes('standby') || (r.rationale || '').toLowerCase().includes('standby') || (r.rationale || '').toLowerCase().includes('idle');
        const isTimeline = (r.rationale || '').toLowerCase().includes('completion') || (r.rationale || '').toLowerCase().includes('timeline') || (r.rationale || '').toLowerCase().includes('compress');
        const isCritical = r.priority === 'HIGH' || (r.rationale || '').toLowerCase().includes('critical') || (r.rationale || '').toLowerCase().includes('expedite');
        conciseCategory = isStandby ? 'Idle Labor Mitigation' : isTimeline ? 'Timeline Compression' : isCritical ? 'Critical Path Expedite' : 'Trade Deficit Offset';
      }

      return {
        id: r.id,
        title: r.title,
        targetLots: r.target_project_name || r.target_lots || 'Target Project',
        targetSector: r.target_project_name || r.target_lots || 'Target Project',
        contractorId: r.contractor_id,
        contractorName: r.contractor_name,
        currentHeadcount: Number(r.current_headcount || 0),
        recommendedHeadcount: Number(r.recommended_headcount || 0),
        rationale: r.rationale,
        suggestedScope: conciseCategory,
        priority: r.priority || 'MEDIUM',
        impact: 'High Efficiency Gain',
        applied: Boolean(r.applied),
        dismissed: Boolean(r.dismissed),
        donorProjectId: r.donor_project_id,
        donorProjectName: r.donor_project_name || 'General Standby Pool',
        targetProjectId: r.target_project_id,
        targetProjectName: r.target_project_name || r.target_lots,
        workerId: r.worker_id || r.contractor_id,
        workerName: r.worker_name || r.contractor_name,
        tradeType: r.trade_type || 'Artisan'
      };
    });

    // Exclude corporate office staff, PMs, and permanent safety inspectors (EHSO)
    const filteredRecs = recs.filter(r => {
      const trade = (r.tradeType || '').toLowerCase();
      const worker = (r.workerName || '').toLowerCase();
      if (
        trade.includes('safety') ||
        trade.includes('ehso') ||
        trade.includes('inspector') ||
        trade.includes('project manager') ||
        trade.includes('pm') ||
        (trade.includes('officer') && !trade.includes('artisan')) ||
        worker.includes('coo') ||
        worker.includes('president') ||
        worker.includes('hr') ||
        worker.includes('finance')
      ) {
        return false;
      }
      return true;
    });

    res.json(filteredRecs);
  } catch (error) {
    console.error('Error fetching AI recommendations:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/labor-allocations/apply-ai-rec
workforceRouter.post('/labor-allocations/apply-ai-rec', async (req: Request, res: Response) => {
  try {
    const { recId } = req.body;
    const recRes = await pool.query('SELECT * FROM ai_manpower_recommendations WHERE id = $1', [recId]);
    if (recRes.rows.length === 0) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }
    const rec = recRes.rows[0];
    await pool.query('UPDATE ai_manpower_recommendations SET applied = true WHERE id = $1', [recId]);

    const targetProjId = rec.target_project_id;
    const donorProjId = rec.donor_project_id;
    const targetWorkerId = rec.worker_id || rec.contractor_id;

    if (targetProjId && targetWorkerId) {
      const targetProjRes = await pool.query('SELECT * FROM commercial_projects WHERE id = $1', [targetProjId]);
      if (targetProjRes.rows.length > 0) {
        const targetProj = targetProjRes.rows[0];
        const curIds: string[] = targetProj.assigned_contractor_ids || [];
        if (!curIds.includes(targetWorkerId)) {
          const nextIds = [...curIds, targetWorkerId];
          await pool.query(
            'UPDATE commercial_projects SET assigned_contractor_ids = $1, assigned_workers_count = $2 WHERE id = $3',
            [nextIds, nextIds.length, targetProj.id]
          );
        }
        await pool.query(
          'UPDATE contractors SET "activeProjectSite" = $1, "status" = \'ACTIVE\' WHERE id = $2',
          [targetProj.name, targetWorkerId]
        );
      }

      if (donorProjId && donorProjId !== targetProjId) {
        const donorProjRes = await pool.query('SELECT * FROM commercial_projects WHERE id = $1', [donorProjId]);
        if (donorProjRes.rows.length > 0) {
          const donorProj = donorProjRes.rows[0];
          const donorIds = (donorProj.assigned_contractor_ids || []).filter((id: string) => id !== targetWorkerId);
          await pool.query(
            'UPDATE commercial_projects SET assigned_contractor_ids = $1, assigned_workers_count = $2 WHERE id = $3',
            [donorIds, donorIds.length, donorProj.id]
          );
        }
      }
    }

    await pool.query(`
      INSERT INTO ai_workforce_learning_history 
      (id, recommendation_id, action, donor_project_name, target_project_name, worker_name, trade_type, headcount_change, rationale)
      VALUES ($1, $2, 'ACCEPTED', $3, $4, $5, $6, $7, $8)
    `, [
      `HIST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      rec.id,
      rec.donor_project_name || 'General Standby Pool',
      rec.target_project_name || rec.target_lots,
      rec.worker_name || rec.contractor_name,
      rec.trade_type || 'Artisan',
      (rec.recommended_headcount || 0) - (rec.current_headcount || 0),
      rec.rationale
    ]);

    broadcastChange('projects');
    broadcastChange('contractors');
    broadcastChange('laborAllocations');
    broadcastChange('aiRecommendations');
    res.json({ success: true });
  } catch (error) {
    console.error('Error applying AI recommendation:', error);
    res.status(500).json({ error: 'Failed to apply recommendation' });
  }
});

// POST /api/ai-recommendations/dismiss
workforceRouter.post('/ai-recommendations/dismiss', async (req: Request, res: Response) => {
  try {
    const { recId, reason } = req.body;
    const recRes = await pool.query('SELECT * FROM ai_manpower_recommendations WHERE id = $1', [recId]);
    if (recRes.rows.length === 0) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }
    const rec = recRes.rows[0];
    await pool.query('UPDATE ai_manpower_recommendations SET dismissed = true WHERE id = $1', [recId]);

    await pool.query(`
      INSERT INTO ai_workforce_learning_history 
      (id, recommendation_id, action, donor_project_name, target_project_name, worker_name, trade_type, headcount_change, rationale, manager_notes)
      VALUES ($1, $2, 'DISMISSED', $3, $4, $5, $6, $7, $8, $9)
    `, [
      `HIST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      rec.id,
      rec.donor_project_name || 'General Standby Pool',
      rec.target_project_name || rec.target_lots,
      rec.worker_name || rec.contractor_name,
      rec.trade_type || 'Artisan',
      (rec.recommended_headcount || 0) - (rec.current_headcount || 0),
      rec.rationale,
      reason || 'Dismissed by Project Manager'
    ]);

    broadcastChange('aiRecommendations');
    res.json({ success: true });
  } catch (error) {
    console.error('Error dismissing AI recommendation:', error);
    res.status(500).json({ error: 'Failed to dismiss recommendation' });
  }
});

// POST /api/ai-recommendations/scan
workforceRouter.post('/ai-recommendations/scan', async (req: Request, res: Response) => {
  try {
    // Ensure category_tag column exists
    await pool.query('ALTER TABLE ai_manpower_recommendations ADD COLUMN IF NOT EXISTS category_tag TEXT;').catch(() => {});

    const dbProjectsRes = await pool.query('SELECT * FROM commercial_projects ORDER BY created_at ASC');
    const dbContractors = await prisma.contractor.findMany({ where: { status: { not: 'INACTIVE' } } });
    const dbHistoryRes = await pool.query('SELECT * FROM ai_workforce_learning_history ORDER BY created_at DESC LIMIT 50');

    const projects = dbProjectsRes.rows || [];
    const learningHistory = dbHistoryRes.rows || [];

    const dismissedPairs = new Set(
      learningHistory
        .filter((h: any) => h.action === 'DISMISSED')
        .map((h: any) => `${(h.worker_name || '').toLowerCase()}|${(h.target_project_name || '').toLowerCase()}`)
    );

    let newRecommendations: any[] = [];

    // Filter strictly for eligible trade artisans (excluding corporate staff, PMs, permanent safety inspectors)
    const eligibleWorkers = dbContractors.filter((c: any) => isEligibleForArtisanReallocation(c));

    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 20) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const prompt = `You are an expert Commercial Construction Workforce Optimization AI for CTVill Builders Corporation.
Analyze active fit-out projects and artisan workforce to generate 6 to 12 targeted, actionable labor reallocation recommendations.
Only include field trade artisans and laborers. Strictly EXCLUDE corporate executives, office staff, finance, HR, legal, project managers (PMs), and permanent safety officers (EHSO).

ACTIVE PROJECTS:
${JSON.stringify(projects.map((p: any) => ({
  id: p.id,
  name: p.name,
  location: p.location,
  progressPercentage: Number(p.progress_percentage || 0),
  status: p.status,
  assignedWorkersCount: Number(p.assigned_workers_count || 0),
  weatherSuspended: Boolean(p.weather_suspended)
})))}

WORKFORCE ROSTER (ARTISANS ONLY):
${JSON.stringify(eligibleWorkers.map((c: any) => ({
  id: c.id,
  name: c.name,
  trade: c.tradeType || c.specialty || 'General Artisan',
  activeSite: c.activeProjectSite || 'Unassigned / Standby',
  status: c.status
})))}

Return a strict JSON array of objects with fields:
- donorProjectId: string or null
- donorProjectName: string
- targetProjectId: string
- targetProjectName: string
- workerId: string
- workerName: string
- tradeType: string
- recommendedHeadcount: number
- currentHeadcount: number
- rationale: string
- categoryTag: "Trade Deficit Offset" | "Idle Labor Mitigation" | "Timeline Compression" | "Critical Path Expedite"
- priority: "HIGH" | "MEDIUM"
`;
        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: prompt,
          config: { responseMimeType: 'application/json' }
        });
        if (response.text) {
          const parsed = JSON.parse(response.text);
          if (Array.isArray(parsed) && parsed.length > 0) {
            newRecommendations = parsed.map((item: any) => ({
              id: `REC-GEMINI-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              title: `Deploy ${item.workerName} (${item.tradeType}) to "${item.targetProjectName}"`,
              donorProjectId: item.donorProjectId || null,
              donorProjectName: item.donorProjectName || 'General Standby Pool',
              targetProjectId: item.targetProjectId,
              targetProjectName: item.targetProjectName,
              workerId: item.workerId,
              workerName: item.workerName,
              tradeType: item.tradeType,
              contractorId: item.workerId,
              contractorName: item.workerName,
              currentHeadcount: Number(item.currentHeadcount || 1),
              recommendedHeadcount: Number(item.recommendedHeadcount || 3),
              rationale: item.rationale,
              categoryTag: item.categoryTag || 'Trade Deficit Offset',
              priority: item.priority || 'MEDIUM'
            }));
          }
        }
      } catch (geminiError: any) {
        console.log('Gemini API bypassed, running local heuristic engine:', geminiError?.message || geminiError);
      }
    }

    if (newRecommendations.length === 0 && projects.length > 0 && eligibleWorkers.length > 0) {
      const recipientProjects = projects.filter((p: any) => 
        p.status !== 'COMPLETED' && 
        p.status !== 'HANDED_OVER' &&
        Number(p.progress_percentage || 0) < 95
      ).sort((a: any, b: any) => {
        const aUrgent = a.weather_suspended || a.status === 'BEHIND_SCHEDULE' ? 2 : 0;
        const bUrgent = b.weather_suspended || b.status === 'BEHIND_SCHEDULE' ? 2 : 0;
        if (aUrgent !== bUrgent) return bUrgent - aUrgent;
        return Number(a.progress_percentage || 0) - Number(b.progress_percentage || 0);
      });

      // Generate a rich queue of 6-12 cross-project recommendations across eligible artisans
      const candidatePool = [...eligibleWorkers];
      const maxQueueItems = Math.min(12, Math.max(6, candidatePool.length));

      for (let i = 0; i < candidatePool.length && newRecommendations.length < maxQueueItems; i++) {
        const worker = candidatePool[i] as any;
        const trade = worker.tradeType || worker.specialty || 'General Trade';
        const isStandby = !worker.activeProjectSite || worker.activeProjectSite === 'STANDBY' || worker.allocationStatus === 'STANDBY';

        // Find matching recipient project that is NOT the worker's current active site
        const targetProj = recipientProjects.find((p: any) => 
          !worker.activeProjectSite || p.name.toLowerCase().trim() !== worker.activeProjectSite.toLowerCase().trim()
        ) || recipientProjects[i % Math.max(1, recipientProjects.length)];

        if (!targetProj) continue;

        const pairKey = `${(worker.name || '').toLowerCase()}|${(targetProj.name || '').toLowerCase()}`;
        if (dismissedPairs.has(pairKey)) {
          continue;
        }

        const donorProj = projects.find((p: any) => 
          worker.activeProjectSite && p.name && p.name.toLowerCase().trim() === worker.activeProjectSite.toLowerCase().trim()
        );

        const donorName = donorProj ? donorProj.name : 'General Standby Pool';
        const donorId = donorProj ? donorProj.id : null;
        const targetProgress = Math.round(Number(targetProj.progress_percentage || 0));
        const isTargetBehind = targetProj.weather_suspended || targetProj.status === 'BEHIND_SCHEDULE';

        // Concise Category Tags: "Idle Labor Mitigation" | "Timeline Compression" | "Critical Path Expedite" | "Trade Deficit Offset"
        let categoryTag = 'Trade Deficit Offset';
        let rationale = '';

        if (isStandby) {
          categoryTag = 'Idle Labor Mitigation';
          rationale = `${worker.name} (${trade}) is idle in standby pool. Reallocating to "${targetProj.name}" accelerates critical fit-out execution.`;
        } else if (donorProj && Number(donorProj.progress_percentage || 0) >= 80) {
          categoryTag = 'Timeline Compression';
          rationale = `Donor site "${donorProj.name}" is near completion (${donorProj.progress_percentage}%). Reallocating ${worker.name} (${trade}) compresses delivery timeline on "${targetProj.name}".`;
        } else if (isTargetBehind) {
          categoryTag = 'Critical Path Expedite';
          rationale = `Target site "${targetProj.name}" requires trade surge. Deploying ${worker.name} (${trade}) expedites delayed milestones.`;
        } else {
          categoryTag = 'Trade Deficit Offset';
          rationale = `Offsets specialized trade deficit: Deploys ${worker.name} (${trade}) from "${donorName}" to reinforce "${targetProj.name}".`;
        }

        const priority: 'HIGH' | 'MEDIUM' = (isTargetBehind || isStandby || newRecommendations.length % 2 === 0) ? 'HIGH' : 'MEDIUM';
        const recId = `REC-${donorId || 'STANDBY'}-${targetProj.id}-${worker.id}`;

        const isCrew = (worker.activeManpower || 1) > 1 || 
          worker.workforceCategory === 'TRADE_CREW' || 
          worker.entityType === 'CREW' ||
          (worker.specialty || '').toLowerCase().includes('crew') || 
          (worker.specialty || '').toLowerCase().includes('gang') ||
          (worker.specialty || '').toLowerCase().includes('supply');

        newRecommendations.push({
          id: recId,
          title: `Deploy ${worker.name} (${trade}) to "${targetProj.name}"`,
          donorProjectId: donorId,
          donorProjectName: donorName,
          targetProjectId: targetProj.id,
          targetProjectName: targetProj.name,
          workerId: worker.id,
          workerName: worker.name,
          tradeType: trade,
          contractorId: worker.id,
          contractorName: worker.company || worker.name,
          currentHeadcount: worker.activeManpower || 1,
          recommendedHeadcount: isCrew ? Math.max(2, (worker.activeManpower || 1) + 2) : 1,
          rationale,
          categoryTag,
          priority
        });
      }
    }

    await pool.query('DELETE FROM ai_manpower_recommendations WHERE applied = false OR dismissed = true');

    for (const rec of newRecommendations) {
      await pool.query(`
        INSERT INTO ai_manpower_recommendations 
        (id, title, target_lots, contractor_id, contractor_name, current_headcount, recommended_headcount, rationale, priority, applied, dismissed,
         donor_project_id, donor_project_name, target_project_id, target_project_name, worker_id, worker_name, trade_type, category_tag)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, false, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          target_lots = EXCLUDED.target_lots,
          recommended_headcount = EXCLUDED.recommended_headcount,
          rationale = EXCLUDED.rationale,
          donor_project_id = EXCLUDED.donor_project_id,
          donor_project_name = EXCLUDED.donor_project_name,
          target_project_id = EXCLUDED.target_project_id,
          target_project_name = EXCLUDED.target_project_name,
          worker_id = EXCLUDED.worker_id,
          worker_name = EXCLUDED.worker_name,
          trade_type = EXCLUDED.trade_type,
          category_tag = EXCLUDED.category_tag
      `, [
        rec.id,
        rec.title,
        rec.targetProjectName,
        rec.contractorId,
        rec.contractorName,
        rec.currentHeadcount,
        rec.recommendedHeadcount,
        rec.rationale,
        rec.priority,
        rec.donorProjectId || null,
        rec.donorProjectName,
        rec.targetProjectId,
        rec.targetProjectName,
        rec.workerId,
        rec.workerName,
        rec.tradeType,
        rec.categoryTag || 'Trade Deficit Offset'
      ]);
    }

    broadcastChange('aiRecommendations');

    const updatedRecs = await pool.query('SELECT * FROM ai_manpower_recommendations WHERE dismissed = false ORDER BY created_at DESC');
    const returnedRecs = (updatedRecs.rows || []).map((r: any) => ({
      id: r.id,
      title: r.title,
      targetLots: r.target_project_name || r.target_lots,
      targetSector: r.target_project_name || r.target_lots,
      contractorId: r.contractor_id,
      contractorName: r.contractor_name,
      currentHeadcount: Number(r.current_headcount),
      recommendedHeadcount: Number(r.recommended_headcount),
      rationale: r.rationale,
      suggestedScope: r.category_tag || 'Trade Deficit Offset',
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
    }));

    res.json({
      success: true,
      count: returnedRecs.length,
      recommendations: returnedRecs
    });
  } catch (error) {
    console.error('Error running AI scan:', error);
    res.status(500).json({ error: 'AI scan failed' });
  }
});

// GET /api/manpower-audits & /api/subcontractor-audits
const handleGetManpowerAudits = async (req: Request, res: Response) => {
  try {
    const audits = await prisma.dailyManpowerAudit.findMany({
      orderBy: { date: 'desc' },
      take: 100
    });
    res.json(audits.map(a => ({
      ...a,
      date: a.date ? (a.date instanceof Date ? a.date.toISOString().split('T')[0] : String(a.date).split('T')[0]) : new Date().toISOString().split('T')[0]
    })));
  } catch (error) {
    console.error('Error fetching manpower audits:', error);
    res.status(500).json({ error: 'Failed to fetch manpower audits' });
  }
};
workforceRouter.get('/manpower-audits', handleGetManpowerAudits);
workforceRouter.get('/subcontractor-audits', handleGetManpowerAudits);

// POST /api/manpower-audits
workforceRouter.post('/manpower-audits', async (req: Request, res: Response) => {
  try {
    const {
      contractorId,
      contractorName,
      specialty,
      shift,
      claimedHeadcount,
      verifiedHeadcount,
      assignedSectorOrLot,
      supervisorName,
      gpsCoordinates,
      photoEvidenceVerified,
      remarks,
      productivityIndex
    } = req.body;

    const claimed = Number(claimedHeadcount) || 0;
    const verified = Number(verifiedHeadcount) || 0;
    const discrepancy = claimed - verified;
    const id = `AUD-${Date.now()}`;

    const newAudit = await prisma.dailyManpowerAudit.create({
      data: {
        id,
        contractorId: contractorId || 'CONT-001',
        contractorName: contractorName || 'SolidFoundations Engineering',
        specialty: specialty || 'General Construction',
        shift: shift || 'Morning',
        claimedHeadcount: claimed,
        verifiedHeadcount: verified,
        discrepancy,
        assignedSectorOrLot: assignedSectorOrLot || 'Active Site',
        supervisorName: supervisorName || 'Site Supervisor',
        gpsCoordinates: gpsCoordinates || '14.2789° N, 121.1245° E (Site Geofence)',
        verificationStatus: discrepancy === 0 ? 'VERIFIED_MATCH' : 'DISCREPANCY_FLAGGED',
        photoEvidenceVerified: photoEvidenceVerified !== undefined ? Boolean(photoEvidenceVerified) : true,
        remarks: remarks || 'Roll-call muster audit verified.',
        productivityIndex: Number(productivityIndex) || 95.0
      }
    });

    if (contractorId) {
      await prisma.contractor.update({
        where: { id: contractorId },
        data: { activeManpower: verified }
      }).catch(() => null);
    }

    invalidateAllDataCache();
    broadcastChange('manpowerAudits');
    res.json({
      ...newAudit,
      date: newAudit.date ? (newAudit.date instanceof Date ? newAudit.date.toISOString().split('T')[0] : String(newAudit.date).split('T')[0]) : new Date().toISOString().split('T')[0]
    });
  } catch (error) {
    console.error('Error recording manpower audit:', error);
    res.status(500).json({ error: 'Failed to record manpower audit' });
  }
});

// GET /api/workforce/reallocation-suggestions
workforceRouter.get('/workforce/reallocation-suggestions', async (req: Request, res: Response) => {
  try {
    const dbProjects = await pool.query('SELECT * FROM commercial_projects ORDER BY progress_percentage DESC');
    const projects = (dbProjects.rows || []).map(p => ({
      id: p.id,
      name: p.name,
      clientName: p.client_name || '',
      description: p.description || '',
      location: p.location || '',
      budget: Number(p.budget || 0),
      fundsCollected: Number(p.funds_collected || 0),
      progressPercentage: Number(p.progress_percentage || 0),
      status: p.status || 'IN_PROGRESS',
      targetHandoverDate: p.target_handover_date ? p.target_handover_date.toISOString().split('T')[0] : '2026-12-31',
      startDate: p.start_date ? p.start_date.toISOString().split('T')[0] : '2026-01-01',
      assignedWorkersCount: Number(p.assigned_workers_count || 0),
      tasksCount: Number(p.tasks_count || 0),
      milestonesCount: Number(p.milestones_count || 0),
      isPrivateAccounting: Boolean(p.is_private_accounting),
    }));

    const contractors = await prisma.contractor.findMany();

    const donorProjects = projects.filter(p => p.progressPercentage >= 90 || p.status === 'HANDED_OVER');
    const recipientProjects = projects.filter(p => p.status !== 'HANDED_OVER' && p.progressPercentage < 80);

    const suggestions: any[] = [];
    if (donorProjects.length > 0 && recipientProjects.length > 0) {
      donorProjects.forEach(donor => {
        const assignedWorkers = contractors.filter(c => 
          !isOfficeOrExecutiveWorker(c) && (
            (c.activeProjectSite && donor.name && c.activeProjectSite.toLowerCase().includes(donor.name.toLowerCase())) ||
            (c as any).allocationStatus === 'STANDBY'
          )
        );

        const tradePool = contractors.filter(c => !isOfficeOrExecutiveWorker(c));
        const candidates = assignedWorkers.length > 0 ? assignedWorkers : tradePool.slice(0, 3);
        candidates.forEach((worker, idx) => {
          const target = recipientProjects[idx % recipientProjects.length];
          if (!target || target.id === donor.id) return;

          const role = worker.roleTitle || worker.specialty || 'Worker';
          const cat = (worker as any).workforceCategory || 'SKILLED';

          suggestions.push({
            id: `REC-${donor.id}-${target.id}-${worker.id}`,
            workerId: worker.id,
            workerName: worker.name,
            roleTitle: role,
            workforceCategory: cat,
            originProjectId: donor.id,
            originProjectName: donor.name,
            originProgress: donor.progressPercentage,
            targetProjectId: target.id,
            targetProjectName: target.name,
            targetStatus: target.status,
            targetProgress: target.progressPercentage,
            rationale: `Project "${donor.name}" has reached ${donor.progressPercentage}% completion. Resource ${worker.name} (${role}) recommended for transfer to accelerate "${target.name}" (${target.progressPercentage}% complete).`,
            priority: donor.progressPercentage >= 95 ? 'HIGH' : 'MEDIUM',
            applied: (worker as any).allocationStatus === 'REALLOCATED'
          });
        });
      });
    }

    res.json(suggestions);
  } catch (error) {
    console.error('Error generating reallocation suggestions:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/workforce/reallocate
workforceRouter.post('/workforce/reallocate', async (req: Request, res: Response) => {
  try {
    const { workerId, targetProjectId, targetProjectName } = req.body;
    if (!workerId || !targetProjectName) {
      return res.status(400).json({ error: 'workerId and targetProjectName are required' });
    }

    const worker = await prisma.contractor.findUnique({ where: { id: workerId } });
    if (!worker) {
      return res.status(404).json({ error: 'Worker/Contractor not found' });
    }

    const originSite = worker.activeProjectSite || 'Previous Project';

    await prisma.contractor.update({
      where: { id: workerId },
      data: {
        activeProjectSite: targetProjectName,
        allocationStatus: 'REALLOCATED'
      } as any
    });

    if (targetProjectId) {
      await pool.query(
        'UPDATE commercial_projects SET assigned_workers_count = assigned_workers_count + 1 WHERE id = $1',
        [targetProjectId]
      ).catch(() => {});
    }

    await prisma.processAuditLog.create({
      data: {
        entityType: 'CONTRACTOR',
        entityId: workerId,
        action: 'WORKFORCE_REALLOCATED',
        actorName: 'Operations Director',
        actorRole: 'ADMIN',
        details: `Reallocated ${worker.name} (${worker.roleTitle || worker.specialty}) from "${originSite}" to "${targetProjectName}".`,
      }
    }).catch(() => {});

    broadcastChange('contractors');
    broadcastChange('projects');
    broadcastChange('auditLogs');

    res.json({ 
      success: true, 
      message: `Successfully reallocated ${worker.name} to ${targetProjectName}.` 
    });
  } catch (error) {
    console.error('Error executing workforce reallocation:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
