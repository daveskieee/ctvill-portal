/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { Groq } from 'groq-sdk';
import { prisma, pool } from '../db';
import { broadcastChange, invalidateAllDataCache } from '../events';
import { requireAuth, requireRole, checkUserProjectAccess } from '../middleware/auth';

export const workforceRouter = Router();

// Apply authentication to workforce endpoints
workforceRouter.use(requireAuth);

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

    const canViewFinancials = req.user?.role === 'ADMIN' || req.user?.role === 'FINANCE';

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
        contractAmount: canViewFinancials ? Number(c.contractAmount || 0) : undefined,
        paidAmount: canViewFinancials ? Number(c.paidAmount || 0) : undefined,
        activeManpower: c.activeManpower,
        milestoneProgress: c.milestoneProgress,
        rating: c.rating || 0,
        employmentType: (c as any).employmentType || 'INTERNAL',
        department: (c as any).department || null,
        roleTitle: (c as any).roleTitle || null,
        dailyRate: canViewFinancials && (c as any).dailyRate !== null && (c as any).dailyRate !== undefined ? Number((c as any).dailyRate) : undefined,
        monthlySalary: canViewFinancials && (c as any).monthlySalary !== null && (c as any).monthlySalary !== undefined ? Number((c as any).monthlySalary) : undefined,
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
workforceRouter.post('/contractors', requireRole(['ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
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
workforceRouter.post('/contractors/update-progress', requireRole(['ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
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
workforceRouter.put('/contractors/:id', requireRole(['ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
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
workforceRouter.delete('/contractors/:id', requireRole(['ADMIN']), async (req: Request, res: Response) => {
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
workforceRouter.post('/labor-allocations', requireRole(['ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
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

// Construction trade skill clusters for objective trade compatibility validation
export function checkTradeCompatibility(workerSpecialtyOrRole: string, requiredTrade: string): boolean {
  if (!workerSpecialtyOrRole || !workerSpecialtyOrRole.trim()) {
    return false; // Reject unverified or missing worker skills
  }
  const w = workerSpecialtyOrRole.toLowerCase().trim();
  if (w === 'unspecified' || w === 'unknown' || w === 'none' || w === 'general') {
    return false; // Reject unverified or generic skills
  }
  if (!requiredTrade || !requiredTrade.trim()) {
    return true; // Verified worker skill present with no specific trade constraint
  }
  const r = requiredTrade.toLowerCase().trim();

  // Direct substring match
  if (w.includes(r) || r.includes(w)) return true;

  // Recognized trade taxonomy clusters
  const clusters: { name: string; keywords: string[] }[] = [
    { name: 'electrical', keywords: ['electric', 'wiring', 'cable', 'transformer', 'conduit', 'power'] },
    { name: 'plumbing', keywords: ['plumb', 'pipe', 'drain', 'sanitary', 'valve', 'fixture'] },
    { name: 'carpentry', keywords: ['carpent', 'millwork', 'cabinet', 'wood', 'framing', 'joiner'] },
    { name: 'masonry', keywords: ['mason', 'brick', 'block', 'concrete', 'plaster', 'cement', 'civil'] },
    { name: 'painting', keywords: ['paint', 'coating', 'varnish', 'finishing', 'primer', 'epoxy'] },
    { name: 'welding', keywords: ['weld', 'steel', 'iron', 'fabricat', 'metal', 'rebar'] },
    { name: 'tile', keywords: ['tile', 'flooring', 'grout', 'marble', 'granite'] },
    { name: 'hvac', keywords: ['hvac', 'duct', 'aircon', 'mechanical', 'chiller', 'ventilation'] }
  ];

  for (const cluster of clusters) {
    const workerInCluster = cluster.keywords.some(k => w.includes(k));
    const reqInCluster = cluster.keywords.some(k => r.includes(k));
    if (workerInCluster && reqInCluster) return true;
    if (workerInCluster && !reqInCluster) {
      // Worker belongs to this trade cluster, but requirement explicitly demands a different trade
      const otherCluster = clusters.find(c => c.name !== cluster.name && c.keywords.some(k => r.includes(k)));
      if (otherCluster) {
        return false; // Mismatched trades (e.g. Electrician recommended for Masonry)
      }
    }
  }

  return true;
}

/**
 * Documented Manpower Recommendation Fit Scoring Methodology (0 - 100):
 * - Base trade skill match: 70 points (verified trade qualification)
 * - Schedule urgency: +15 points if target project is behind schedule
 * - Idle labor recovery: +10 points if worker is in standby pool
 * - Timeline compression: +5 points if donor project progress >= 80%
 */
export function calculateRecommendationFitScore(params: {
  tradeMatch: boolean;
  targetBehindSchedule: boolean;
  isFromStandby: boolean;
  donorProgress?: number;
}): number {
  let score = params.tradeMatch ? 70 : 50;
  if (params.targetBehindSchedule) score += 15;
  if (params.isFromStandby) score += 10;
  if (params.donorProgress !== undefined && params.donorProgress >= 80) score += 5;
  return Math.min(100, Math.max(50, score));
}

// Helper to validate a recommendation candidate's accuracy, trade compatibility, and ground-truth assignments
export function validateRecommendationCandidate(
  candidate: {
    workerId: string;
    targetProjectId: string;
    donorProjectId?: string | null;
    workerTrade?: string;
  },
  workerMap: Map<string, any>,
  projectMap: Map<string, any>,
  dismissedPairs: Set<string>
): { valid: boolean; reason?: string } {
  const { workerId, targetProjectId, donorProjectId, workerTrade } = candidate;

  // 1. Worker Existence & Eligibility
  const worker = workerMap.get(workerId);
  if (!worker) {
    return { valid: false, reason: `Worker ID "${workerId}" not found or inactive` };
  }
  const workerStatus = (worker.status || '').toUpperCase();
  if (workerStatus === 'INACTIVE' || workerStatus === 'ON_LEAVE' || workerStatus === 'SUSPENDED') {
    return { valid: false, reason: `Worker ${worker.name} is ${workerStatus}` };
  }
  if (!isEligibleForArtisanReallocation(worker)) {
    return { valid: false, reason: `Worker ${worker.name} is corporate/PM/safety and not eligible for artisan trade reallocation` };
  }

  // 2. Verified Trade Skill Validation
  const workerTradeStr = `${worker.specialty || ''} ${worker.roleTitle || ''}`.trim();
  if (!workerTradeStr || workerTradeStr.toLowerCase() === 'unspecified' || workerTradeStr.toLowerCase() === 'none') {
    return { valid: false, reason: `Worker ${worker.name} has unverified or missing trade skills` };
  }
  if (workerTrade) {
    if (!checkTradeCompatibility(workerTradeStr, workerTrade)) {
      return { 
        valid: false, 
        reason: `Worker trade skill (${worker.specialty || 'General'}) is incompatible with required trade (${workerTrade})` 
      };
    }
  }

  // 3. Target Project Existence & Status
  const targetProj = projectMap.get(targetProjectId);
  if (!targetProj) {
    return { valid: false, reason: `Target project ID "${targetProjectId}" not found` };
  }
  const targetStatus = (targetProj.status || '').toUpperCase();
  if (targetStatus === 'COMPLETED' || targetStatus === 'HANDED_OVER') {
    return { valid: false, reason: `Target project "${targetProj.name}" is already ${targetStatus}` };
  }

  // 4. Prevent Self-Transfer / Circular Assignment
  if (donorProjectId && donorProjectId === targetProjectId) {
    return { valid: false, reason: 'Donor and target project are identical' };
  }

  // 5. Current Assignment & Donor Project Consistency
  if (donorProjectId) {
    const donorProj = projectMap.get(donorProjectId);
    if (!donorProj) {
      return { valid: false, reason: `Donor project ID "${donorProjectId}" does not exist in ground-truth active projects` };
    }
    if (worker.activeProjectSite && donorProj.name) {
      const active = worker.activeProjectSite.toLowerCase().trim();
      const donor = donorProj.name.toLowerCase().trim();
      const donorIds: string[] = donorProj.assigned_contractor_ids || [];
      if (!donorIds.includes(workerId) && !active.includes(donor) && !donor.includes(active)) {
        return { valid: false, reason: `Worker ${worker.name} is currently assigned to "${worker.activeProjectSite}", not donor project "${donorProj.name}"` };
      }
    }
  }

  // 6. Prevent Redundant Assignment: Worker is already at target site
  const assignedWorkerIds: string[] = targetProj.assigned_contractor_ids || [];
  if (assignedWorkerIds.includes(workerId)) {
    return { valid: false, reason: `Worker ${worker.name} is already assigned to target project "${targetProj.name}"` };
  }
  const activeSite = (worker.activeProjectSite || '').trim().toLowerCase();
  const targetName = (targetProj.name || '').trim().toLowerCase();
  if (activeSite && targetName && (activeSite === targetName || targetName.includes(activeSite))) {
    return { valid: false, reason: `Worker ${worker.name} active site is already "${targetProj.name}"` };
  }

  // 7. Dismissal History Check
  const pairKey = `${(worker.name || '').toLowerCase()}|${(targetProj.name || '').toLowerCase()}`;
  if (dismissedPairs.has(pairKey)) {
    return { valid: false, reason: `Recommendation for ${worker.name} to "${targetProj.name}" was previously dismissed` };
  }

  return { valid: true };
}

// GET /api/ai-recommendations
workforceRouter.get('/ai-recommendations', async (req: Request, res: Response) => {
  try {
    // Clients have zero access to workforce recommendations
    if (req.user?.role === 'CLIENT') {
      return res.json([]);
    }

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
        tradeType: r.trade_type || 'Artisan',
        source: (r.source === 'GEMINI_AI' ? 'GEMINI_AI' : r.source === 'GROQ_AI' ? 'GROQ_AI' : 'RULE_BASED_FALLBACK') as 'GEMINI_AI' | 'GROQ_AI' | 'RULE_BASED_FALLBACK',
        provider: (r.provider || (r.source === 'GEMINI_AI' ? 'gemini' : r.source === 'GROQ_AI' ? 'groq' : 'heuristic')) as 'gemini' | 'groq' | 'heuristic',
        aiModel: r.ai_model || (r.source === 'GEMINI_AI' ? (process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite') : r.source === 'GROQ_AI' ? (process.env.GROQ_MODEL || 'openai/gpt-oss-20b') : 'heuristic-v1'),
        ruleBasedFitScore: r.confidence_score !== null && r.confidence_score !== undefined ? Number(r.confidence_score) : undefined,
        confidenceScore: r.confidence_score !== null && r.confidence_score !== undefined ? Number(r.confidence_score) : undefined,
        approvedByUserId: r.approved_by_user_id || null,
        approvedByUserName: r.approved_by_user_name || null,
        appliedAt: r.applied_at ? (r.applied_at instanceof Date ? r.applied_at.toISOString() : String(r.applied_at)) : null
      };
    });

    // Exclude corporate office staff, PMs, and permanent safety inspectors (EHSO)
    let filteredRecs = recs.filter(r => {
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

    // Role-based project scoping for engineers:
    // Engineers must have permission for BOTH target and REAL donor projects
    if (req.user?.role === 'ENGINEER') {
      const workerProjectsRes = await pool.query(`
        SELECT cp.id as project_id, unnest(cp.assigned_contractor_ids) as worker_id
        FROM commercial_projects cp
      `);
      const workerRealProjectMap = new Map<string, string>();
      for (const row of workerProjectsRes.rows) {
        if (row.worker_id && row.project_id) {
          workerRealProjectMap.set(row.worker_id, row.project_id);
        }
      }

      filteredRecs = filteredRecs.filter(r => {
        const hasTargetAccess = Boolean(r.targetProjectId && checkUserProjectAccess(req.user, r.targetProjectId));
        const realDonorProjId = (r.workerId && workerRealProjectMap.get(r.workerId)) || r.donorProjectId;
        const hasDonorAccess = !realDonorProjId || checkUserProjectAccess(req.user, realDonorProjId);
        return hasTargetAccess && hasDonorAccess;
      });
    }

    res.json(filteredRecs);
  } catch (error) {
    console.error('Error fetching AI recommendations:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/labor-allocations/apply-ai-rec
// ATOMIC TRANSACTION: Uses a dedicated PostgreSQL client with BEGIN/COMMIT/ROLLBACK and row-level locking (FOR UPDATE)
workforceRouter.post('/labor-allocations/apply-ai-rec', requireRole(['ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
  const { recId } = req.body;
  if (!recId) {
    return res.status(400).json({ error: 'recId is required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Lock the recommendation row to prevent concurrent race conditions or duplicate approvals
    const recRes = await client.query(
      'SELECT * FROM ai_manpower_recommendations WHERE id = $1 FOR UPDATE',
      [recId]
    );

    if (recRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Recommendation not found' });
    }
    const rec = recRes.rows[0];

    // Prevent duplicate application
    if (rec.applied) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Recommendation has already been approved and applied' });
    }

    const targetProjId = rec.target_project_id;
    const donorProjId = rec.donor_project_id;
    const targetWorkerId = rec.worker_id || rec.contractor_id;

    if (!targetProjId || !targetWorkerId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Recommendation is missing target project or worker ID' });
    }

    // 2. Validate worker exists in database and is active (with row lock)
    const workerRes = await client.query('SELECT * FROM contractors WHERE id = $1 FOR UPDATE', [targetWorkerId]);
    if (workerRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Worker no longer exists in database' });
    }
    const worker = workerRes.rows[0];
    const workerStatus = (worker.status || '').toUpperCase();
    if (workerStatus === 'INACTIVE' || workerStatus === 'ON_LEAVE' || workerStatus === 'SUSPENDED') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Worker ${worker.name} is currently ${workerStatus} and cannot be reallocated.` });
    }
    if (!isEligibleForArtisanReallocation(worker)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Worker ${worker.name} is not eligible for field artisan reallocation.` });
    }

    // Reject unverified or missing worker trade skills
    const workerSkill = `${worker.specialty || ''} ${worker.roleTitle || ''}`.trim();
    if (!workerSkill || workerSkill.toLowerCase() === 'unspecified' || workerSkill.toLowerCase() === 'none' || workerSkill.toLowerCase() === 'general') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Worker ${worker.name} has unverified trade skills and cannot be reallocated.` });
    }
    const requiredTrade = rec.trade_type || '';
    if (requiredTrade && !checkTradeCompatibility(workerSkill, requiredTrade)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Worker trade skill (${worker.specialty || 'General'}) is incompatible with required trade (${requiredTrade}).` });
    }

    // 3. Derive worker's REAL donor project from ground-truth database records
    const realDonorRes = await client.query(
      `SELECT id, name FROM commercial_projects 
       WHERE $1 = ANY(assigned_contractor_ids) 
          OR (LOWER(name) = LOWER($2) AND LOWER($2) NOT IN ('standby', 'general standby pool', 'unassigned', '')) 
       LIMIT 1`,
      [targetWorkerId, (worker.activeProjectSite || '').trim()]
    );
    const realDonorProject = realDonorRes.rows[0] || null;
    const effectiveDonorProjId = realDonorProject ? realDonorProject.id : (donorProjId || null);
    const effectiveDonorProjName = realDonorProject ? realDonorProject.name : (rec.donor_project_name || 'General Standby Pool');

    // 4. Role-based project authorization check for Engineers:
    // Engineers must have explicit permission for BOTH target and REAL donor projects
    if (req.user?.role === 'ENGINEER') {
      if (!checkUserProjectAccess(req.user, targetProjId)) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Forbidden: You do not have authorization to approve workforce reallocations for target project.' });
      }
      if (effectiveDonorProjId && !checkUserProjectAccess(req.user, effectiveDonorProjId)) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: `Forbidden: You do not have authorization to reallocate workers from donor project "${effectiveDonorProjName}".` });
      }
      if (donorProjId && donorProjId !== effectiveDonorProjId && !checkUserProjectAccess(req.user, donorProjId)) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Forbidden: You do not have authorization to reallocate workers from donor project.' });
      }
    }

    // 5. Validate target project exists in database and is active (with row lock)
    const targetProjRes = await client.query('SELECT * FROM commercial_projects WHERE id = $1 FOR UPDATE', [targetProjId]);
    if (targetProjRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Target project no longer exists in database' });
    }
    const targetProj = targetProjRes.rows[0];
    const targetStatus = (targetProj.status || '').toUpperCase();
    if (targetStatus === 'COMPLETED' || targetStatus === 'HANDED_OVER') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Target project "${targetProj.name}" is already ${targetStatus}.` });
    }

    const approvingUserId = req.user?.id || 'admin';
    const approvingUserName = req.user?.name || 'Administrator';
    const approvingUserRole = req.user?.role || 'ADMIN';
    const appliedTimestamp = new Date();

    // 6. Mark recommendation as applied with approving user details
    await client.query(
      `UPDATE ai_manpower_recommendations 
       SET applied = true, approved_by_user_id = $1, approved_by_user_name = $2, applied_at = $3 
       WHERE id = $4`,
      [approvingUserId, approvingUserName, appliedTimestamp, recId]
    );

    // 7. Apply allocation changes to target project
    const curIds: string[] = targetProj.assigned_contractor_ids || [];
    if (!curIds.includes(targetWorkerId)) {
      const nextIds = [...curIds, targetWorkerId];
      await client.query(
        'UPDATE commercial_projects SET assigned_contractor_ids = $1, assigned_workers_count = $2 WHERE id = $3',
        [nextIds, nextIds.length, targetProj.id]
      );
    }
    await client.query(
      'UPDATE contractors SET "activeProjectSite" = $1, "status" = \'ACTIVE\' WHERE id = $2',
      [targetProj.name, targetWorkerId]
    );

    // 8. If worker had an active donor project, remove them from donor project's assigned list
    if (effectiveDonorProjId && effectiveDonorProjId !== targetProjId) {
      const donorProjRes = await client.query('SELECT * FROM commercial_projects WHERE id = $1 FOR UPDATE', [effectiveDonorProjId]);
      if (donorProjRes.rows.length > 0) {
        const donorProj = donorProjRes.rows[0];
        const donorIds = (donorProj.assigned_contractor_ids || []).filter((id: string) => id !== targetWorkerId);
        await client.query(
          'UPDATE commercial_projects SET assigned_contractor_ids = $1, assigned_workers_count = $2 WHERE id = $3',
          [donorIds, donorIds.length, donorProj.id]
        );
      }
    }

    const recProvider = rec.provider || (rec.source === 'GEMINI_AI' ? 'gemini' : rec.source === 'GROQ_AI' ? 'groq' : 'heuristic');
    const recModel = rec.ai_model || (rec.source === 'GEMINI_AI' ? (process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite') : rec.source === 'GROQ_AI' ? (process.env.GROQ_MODEL || 'openai/gpt-oss-20b') : 'heuristic-v1');

    // 9. Record audit entry in ai_workforce_learning_history within the same transaction
    await client.query(`
      INSERT INTO ai_workforce_learning_history 
      (id, recommendation_id, action, recommendation_source, provider, ai_model, approving_user_id, approving_user_name, approving_user_role, applied_at, donor_project_name, target_project_name, worker_name, trade_type, headcount_change, rationale)
      VALUES ($1, $2, 'ACCEPTED', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `, [
      `HIST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      rec.id,
      rec.source || 'RULE_BASED_FALLBACK',
      recProvider,
      recModel,
      approvingUserId,
      approvingUserName,
      approvingUserRole,
      appliedTimestamp,
      effectiveDonorProjName,
      rec.target_project_name || rec.target_lots,
      rec.worker_name || rec.contractor_name,
      rec.trade_type || 'Artisan',
      (rec.recommended_headcount || 0) - (rec.current_headcount || 0),
      rec.rationale
    ]);

    // 10. Record system-wide process audit log within the transaction (MUST be atomic)
    await client.query(`
      INSERT INTO process_audit_logs (id, "entityType", "entityId", action, "actorName", "actorRole", details, "createdAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      'WORKFORCE_REALLOCATION',
      rec.id,
      'AI_RECOMMENDATION_APPROVED',
      approvingUserName,
      approvingUserRole,
      `Approved ${rec.source || 'AI'} (${recProvider}/${recModel}) workforce reallocation: transferred ${worker.name} (${rec.trade_type || worker.specialty}) from "${effectiveDonorProjName}" to "${targetProj.name}".`,
      appliedTimestamp
    ]);

    // 11. Commit transaction atomically
    await client.query('COMMIT');

    broadcastChange('projects');
    broadcastChange('contractors');
    broadcastChange('laborAllocations');
    broadcastChange('aiRecommendations');
    broadcastChange('auditLogs');

    res.json({ 
      success: true, 
      message: `Workforce reallocation successfully approved and recorded for ${worker.name}.`,
      recommendation: {
        id: rec.id,
        applied: true,
        approvedByUserId: approvingUserId,
        approvedByUserName: approvingUserName,
        appliedAt: appliedTimestamp.toISOString()
      }
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error applying AI recommendation in transaction:', error);
    res.status(500).json({ error: 'Failed to apply recommendation: transaction rolled back' });
  } finally {
    client.release();
  }
});

// POST /api/ai-recommendations/dismiss
workforceRouter.post('/ai-recommendations/dismiss', requireRole(['ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
  try {
    const { recId, reason } = req.body;
    if (!recId) {
      return res.status(400).json({ error: 'recId is required' });
    }

    const recRes = await pool.query('SELECT * FROM ai_manpower_recommendations WHERE id = $1', [recId]);
    if (recRes.rows.length === 0) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }
    const rec = recRes.rows[0];

    // Cannot dismiss an already applied recommendation
    if (rec.applied) {
      return res.status(409).json({ error: 'Cannot dismiss a recommendation that has already been approved and applied' });
    }

    // Role-based project scoping for engineers on dismiss (derive real donor project)
    if (req.user?.role === 'ENGINEER') {
      const targetWorkerId = rec.worker_id || rec.contractor_id;
      let realDonorProjId: string | null = rec.donor_project_id || null;
      if (targetWorkerId) {
        const workerRes = await pool.query('SELECT * FROM contractors WHERE id = $1', [targetWorkerId]).catch(() => ({ rows: [] }));
        const worker = workerRes.rows[0];
        const siteName = worker ? (worker.activeProjectSite || worker.active_project_site || '').trim() : '';
        const realDonorRes = await pool.query(
          `SELECT id FROM commercial_projects 
           WHERE $1 = ANY(assigned_contractor_ids) 
              OR (LOWER(name) = LOWER($2) AND LOWER($2) NOT IN ('standby', 'general standby pool', 'unassigned', '')) 
           LIMIT 1`,
          [targetWorkerId, siteName]
        ).catch(() => ({ rows: [] }));
        if (realDonorRes.rows.length > 0) {
          realDonorProjId = realDonorRes.rows[0].id;
        }
      }

      const hasTargetAccess = Boolean(rec.target_project_id && checkUserProjectAccess(req.user, rec.target_project_id));
      const hasDonorAccess = !realDonorProjId || checkUserProjectAccess(req.user, realDonorProjId);
      if (!hasTargetAccess || !hasDonorAccess) {
        return res.status(403).json({ error: 'Forbidden: You do not have authorization to dismiss recommendations for this project.' });
      }
    }

    await pool.query('UPDATE ai_manpower_recommendations SET dismissed = true WHERE id = $1', [recId]);

    const dismissingUserId = req.user?.id || 'admin';
    const dismissingUserName = req.user?.name || 'Administrator';
    const dismissingUserRole = req.user?.role || 'ADMIN';
    const recProvider = rec.provider || (rec.source === 'GEMINI_AI' ? 'gemini' : rec.source === 'GROQ_AI' ? 'groq' : 'heuristic');
    const recModel = rec.ai_model || (rec.source === 'GEMINI_AI' ? (process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite') : rec.source === 'GROQ_AI' ? (process.env.GROQ_MODEL || 'openai/gpt-oss-20b') : 'heuristic-v1');

    await pool.query(`
      INSERT INTO ai_workforce_learning_history 
      (id, recommendation_id, action, recommendation_source, provider, ai_model, approving_user_id, approving_user_name, approving_user_role, applied_at, donor_project_name, target_project_name, worker_name, trade_type, headcount_change, rationale, manager_notes)
      VALUES ($1, $2, 'DISMISSED', $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, $9, $10, $11, $12, $13, $14, $15)
    `, [
      `HIST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      rec.id,
      rec.source || 'RULE_BASED_FALLBACK',
      recProvider,
      recModel,
      dismissingUserId,
      dismissingUserName,
      dismissingUserRole,
      rec.donor_project_name || 'General Standby Pool',
      rec.target_project_name || rec.target_lots,
      rec.worker_name || rec.contractor_name,
      rec.trade_type || 'Artisan',
      (rec.recommended_headcount || 0) - (rec.current_headcount || 0),
      rec.rationale,
      reason || 'Dismissed by Project Manager'
    ]);

    broadcastChange('aiRecommendations');
    res.json({ success: true, message: 'Recommendation dismissed.' });
  } catch (error) {
    console.error('Error dismissing AI recommendation:', error);
    res.status(500).json({ error: 'Failed to dismiss recommendation' });
  }
});

// Safeguard against excessive API requests: 3-second cooldown per user
const lastScanTimestampByUser = new Map<string, number>();

// Promise timeout helper to prevent hanging requests
function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMsg)), ms);
  });
  return Promise.race([
    promise.then((res) => {
      clearTimeout(timer);
      return res;
    }),
    timeoutPromise.catch((err) => {
      clearTimeout(timer);
      throw err;
    })
  ]);
}

// Resilient JSON parser for LLM responses (strips markdown fences, handles JSON array or { recommendations: [...] } object)
function parseRecommendationsJson(rawText: string): any[] {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
  }
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.recommendations)) return parsed.recommendations;
    if (parsed && Array.isArray(parsed.data)) return parsed.data;
  } catch (e) {
    const startIdx = cleaned.indexOf('[');
    const endIdx = cleaned.lastIndexOf(']');
    if (startIdx !== -1 && endIdx > startIdx) {
      try {
        const sub = cleaned.substring(startIdx, endIdx + 1);
        const parsed = JSON.parse(sub);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
  }
  return [];
}

// Validate candidate items from external AI providers against ground-truth database maps
function processAndValidateCandidates(
  candidates: any[],
  source: 'GEMINI_AI' | 'GROQ_AI',
  provider: 'gemini' | 'groq',
  modelName: string,
  workerMap: Map<string, any>,
  projectMap: Map<string, any>,
  dismissedPairs: Set<string>
): any[] {
  const validated: any[] = [];
  for (const item of candidates) {
    if (!item || !item.workerId || !item.targetProjectId) continue;
    const validation = validateRecommendationCandidate(
      {
        workerId: item.workerId,
        targetProjectId: item.targetProjectId,
        donorProjectId: item.donorProjectId,
        workerTrade: item.tradeType
      },
      workerMap,
      projectMap,
      dismissedPairs
    );

    if (validation.valid) {
      const verifiedWorker = workerMap.get(item.workerId)!;
      const verifiedTarget = projectMap.get(item.targetProjectId)!;
      const verifiedDonor = item.donorProjectId ? projectMap.get(item.donorProjectId) : null;
      const verifiedTrade = item.tradeType || verifiedWorker.specialty || 'Artisan';

      const isStandby = !verifiedDonor || (verifiedDonor.name || '').toLowerCase().includes('standby');
      const isTargetBehind = Boolean(verifiedTarget.weather_suspended || verifiedTarget.status === 'BEHIND_SCHEDULE');

      validated.push({
        id: `REC-${provider.toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: `Deploy ${verifiedWorker.name} (${verifiedTrade}) to "${verifiedTarget.name}"`,
        donorProjectId: verifiedDonor ? verifiedDonor.id : null,
        donorProjectName: verifiedDonor ? verifiedDonor.name : (item.donorProjectName || 'General Standby Pool'),
        targetProjectId: verifiedTarget.id,
        targetProjectName: verifiedTarget.name,
        workerId: verifiedWorker.id,
        workerName: verifiedWorker.name,
        tradeType: verifiedTrade,
        contractorId: verifiedWorker.id,
        contractorName: verifiedWorker.company || verifiedWorker.name,
        currentHeadcount: Number(item.currentHeadcount || verifiedWorker.activeManpower || 1),
        recommendedHeadcount: Number(item.recommendedHeadcount || (verifiedWorker.activeManpower || 1)),
        rationale: item.rationale || `Deploying ${verifiedWorker.name} reinforces critical fit-out timeline at ${verifiedTarget.name}.`,
        categoryTag: item.categoryTag || (isStandby ? 'Idle Labor Mitigation' : isTargetBehind ? 'Critical Path Expedite' : 'Trade Deficit Offset'),
        priority: item.priority === 'HIGH' ? 'HIGH' : 'MEDIUM',
        source,
        provider,
        aiModel: modelName,
        confidenceScore: calculateRecommendationFitScore({
          tradeMatch: true,
          targetBehindSchedule: isTargetBehind,
          isFromStandby: isStandby,
          donorProgress: verifiedDonor ? Number(verifiedDonor.progress_percentage || 0) : undefined
        })
      });
    } else {
      console.log(`[${provider.toUpperCase()} Candidate Discarded]: ${validation.reason}`);
    }
  }
  return validated;
}

// POST /api/ai-recommendations/scan
workforceRouter.post('/ai-recommendations/scan', requireRole(['ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
  try {
    // 0. Safeguard: rate limit cooldown (3-second minimum between scans per user)
    const scanUserId = req.user?.id || 'admin';
    const now = Date.now();
    const lastScan = lastScanTimestampByUser.get(scanUserId) || 0;
    if (now - lastScan < 3000) {
      return res.status(429).json({
        error: 'Too Many Requests: Please wait at least 3 seconds between workforce scans to safeguard system resources.'
      });
    }
    lastScanTimestampByUser.set(scanUserId, now);

    // Ensure all required columns exist in database
    await pool.query(`
      ALTER TABLE ai_manpower_recommendations ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'RULE_BASED_FALLBACK';
      ALTER TABLE ai_manpower_recommendations ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'heuristic';
      ALTER TABLE ai_manpower_recommendations ADD COLUMN IF NOT EXISTS ai_model TEXT;
      ALTER TABLE ai_manpower_recommendations ADD COLUMN IF NOT EXISTS confidence_score NUMERIC DEFAULT 90;
      ALTER TABLE ai_manpower_recommendations ADD COLUMN IF NOT EXISTS approved_by_user_id TEXT;
      ALTER TABLE ai_manpower_recommendations ADD COLUMN IF NOT EXISTS approved_by_user_name TEXT;
      ALTER TABLE ai_manpower_recommendations ADD COLUMN IF NOT EXISTS applied_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE ai_manpower_recommendations ADD COLUMN IF NOT EXISTS category_tag TEXT;
      ALTER TABLE ai_workforce_learning_history ADD COLUMN IF NOT EXISTS recommendation_source TEXT DEFAULT 'RULE_BASED_FALLBACK';
      ALTER TABLE ai_workforce_learning_history ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'heuristic';
      ALTER TABLE ai_workforce_learning_history ADD COLUMN IF NOT EXISTS ai_model TEXT;
      ALTER TABLE ai_workforce_learning_history ADD COLUMN IF NOT EXISTS approving_user_id TEXT;
      ALTER TABLE ai_workforce_learning_history ADD COLUMN IF NOT EXISTS approving_user_name TEXT;
      ALTER TABLE ai_workforce_learning_history ADD COLUMN IF NOT EXISTS approving_user_role TEXT;
      ALTER TABLE ai_workforce_learning_history ADD COLUMN IF NOT EXISTS applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    `).catch(() => {});

    // Query active projects and available workforce
    const dbProjectsRes = await pool.query(`
      SELECT * FROM commercial_projects 
      WHERE status NOT IN ('COMPLETED', 'HANDED_OVER') 
      ORDER BY created_at ASC
    `);
    const dbContractors = await prisma.contractor.findMany({ 
      where: { 
        status: { notIn: ['INACTIVE', 'ON_LEAVE', 'SUSPENDED'] } 
      } 
    });
    const dbHistoryRes = await pool.query('SELECT * FROM ai_workforce_learning_history ORDER BY created_at DESC LIMIT 50');

    let projects = dbProjectsRes.rows || [];
    const learningHistory = dbHistoryRes.rows || [];

    // Role-based project scoping for engineers:
    // Engineers only scan and analyze projects they are explicitly assigned to
    if (req.user?.role === 'ENGINEER') {
      const allowed = new Set(req.user.projectIds || []);
      projects = projects.filter((p: any) => allowed.has(p.id));
      if (projects.length === 0) {
        return res.status(403).json({ 
          error: 'Forbidden: You have no assigned active projects to scan for recommendations.' 
        });
      }
    }

    const dismissedPairs = new Set(
      learningHistory
        .filter((h: any) => h.action === 'DISMISSED')
        .map((h: any) => `${(h.worker_name || '').toLowerCase()}|${(h.target_project_name || '').toLowerCase()}`)
    );

    // Filter strictly for eligible trade artisans (excluding corporate staff, PMs, permanent safety inspectors)
    const eligibleWorkers = dbContractors.filter((c: any) => isEligibleForArtisanReallocation(c));

    // Fast lookup maps for strict validation
    const workerMap = new Map<string, any>(eligibleWorkers.map(w => [w.id, w]));
    const projectMap = new Map<string, any>(projects.map(p => [p.id, p]));

    let newRecommendations: any[] = [];
    let scanSource: 'GEMINI_AI' | 'GROQ_AI' | 'RULE_BASED_FALLBACK' = 'RULE_BASED_FALLBACK';
    let usedProvider: 'gemini' | 'groq' | 'heuristic' = 'heuristic';
    let usedAiModel: string = 'heuristic-v1';
    let geminiErrorMessage: string | null = null;
    let groqErrorMessage: string | null = null;

    // Build anonymized privacy prompt: NO employee names, NO phone numbers, NO payroll/rates, NO client names, NO contract costs
    const anonymizedProjects = projects.map((p: any) => ({
      id: p.id,
      name: p.name,
      location: p.location,
      progressPercentage: Number(p.progress_percentage || 0),
      status: p.status,
      assignedWorkersCount: Number(p.assigned_workers_count || 0),
      weatherSuspended: Boolean(p.weather_suspended)
    }));

    const anonymizedWorkers = eligibleWorkers.map((c: any) => ({
      workerId: c.id,
      trade: c.tradeType || c.specialty || 'General Artisan',
      activeSite: c.activeProjectSite || 'Unassigned / Standby',
      status: c.status
    }));

    const prompt = `You are an expert Commercial Construction Workforce Optimization AI for CTVill Builders Corporation.
Analyze active commercial fit-out projects and the anonymized artisan workforce roster to generate 4 to 8 targeted, actionable labor reallocation recommendations.
Only include field trade artisans and laborers. Strictly EXCLUDE corporate executives, office staff, finance, HR, legal, project managers (PMs), and permanent safety officers (EHSO).

CRITICAL ACCURACY RULES:
1. You MUST ONLY select workerId from the provided WORKFORCE ROSTER. Never invent worker IDs.
2. You MUST ONLY select targetProjectId and donorProjectId from the provided ACTIVE PROJECTS list. Never invent project IDs.
3. Never reallocate a worker to the site they are already working on.
4. donorProjectId can be null if the worker is in standby or unassigned.

ACTIVE PROJECTS:
${JSON.stringify(anonymizedProjects)}

WORKFORCE ROSTER (ANONYMIZED FIELD ARTISANS):
${JSON.stringify(anonymizedWorkers)}

Return a strict JSON object with a "recommendations" array containing objects with:
- donorProjectId: string or null
- donorProjectName: string
- targetProjectId: string
- targetProjectName: string
- workerId: string
- tradeType: string
- recommendedHeadcount: number
- currentHeadcount: number
- rationale: string
- categoryTag: "Trade Deficit Offset" | "Idle Labor Mitigation" | "Timeline Compression" | "Critical Path Expedite"
- priority: "HIGH" | "MEDIUM"
`;

    // =========================================================================
    // LAYER 1: Primary AI Provider — Google Gemini (gemini-3.1-flash-lite)
    // =========================================================================
    const configuredGeminiModel = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
    let geminiSuccess = false;

    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 20 && projects.length > 0 && eligibleWorkers.length > 0) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        let responseText: string | null = null;

        // Max 1 retry for transient 503 only; 0 retries for 429 quota exhaustion or 401/403
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const generatePromise = ai.models.generateContent({
              model: configuredGeminiModel,
              contents: prompt,
              config: { responseMimeType: 'application/json' }
            });
            const response = await withTimeout(generatePromise, 10000, 'Gemini request timed out after 10000ms');
            if (response && response.text) {
              responseText = response.text;
              break;
            }
          } catch (callErr: any) {
            const errStr = callErr?.message || String(callErr);
            // Fail over immediately if 429 quota/rate limit or 401/403
            if (errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('quota') || errStr.includes('401') || errStr.includes('403')) {
              throw callErr;
            }
            // Retry once on 503 or transient network failure
            if (attempt === 1 && (errStr.includes('503') || errStr.includes('UNAVAILABLE') || errStr.includes('high demand') || errStr.includes('ECONNRESET'))) {
              await new Promise(r => setTimeout(r, 1200));
              continue;
            }
            throw callErr;
          }
        }

        if (responseText) {
          const candidates = parseRecommendationsJson(responseText);
          const validatedRecs = processAndValidateCandidates(
            candidates,
            'GEMINI_AI',
            'gemini',
            configuredGeminiModel,
            workerMap,
            projectMap,
            dismissedPairs
          );
          if (validatedRecs.length > 0) {
            newRecommendations = validatedRecs;
            scanSource = 'GEMINI_AI';
            usedProvider = 'gemini';
            usedAiModel = configuredGeminiModel;
            geminiSuccess = true;
          }
        }
      } catch (err: any) {
        geminiErrorMessage = err?.message || String(err);
        console.log(`[Multi-Provider AI] Primary Gemini (${configuredGeminiModel}) unavailable: ${geminiErrorMessage}. Triggering failover to Groq...`);
      }
    } else {
      geminiErrorMessage = 'Gemini API key not configured';
    }

    // =========================================================================
    // LAYER 2: Secondary AI Provider — Groq (openai/gpt-oss-20b)
    // Automatically activated upon Gemini quota exhaustion, rate limit, timeout, or error
    // =========================================================================
    const configuredGroqModel = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
    let groqSuccess = false;

    if (!geminiSuccess && process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.length > 10 && projects.length > 0 && eligibleWorkers.length > 0) {
      try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        let responseText: string | null = null;

        // Max 1 retry for transient 503/502 only; 0 retries for 429 quota or 401/403
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const chatPromise = groq.chat.completions.create({
              model: configuredGroqModel,
              messages: [
                {
                  role: 'system',
                  content: 'You are an expert Commercial Construction Workforce Optimization AI for CTVill Builders Corporation. You generate labor reallocation recommendations in valid JSON format only.'
                },
                {
                  role: 'user',
                  content: prompt
                }
              ],
              response_format: { type: 'json_object' }
            });
            const completion = await withTimeout(chatPromise, 10000, 'Groq request timed out after 10000ms');
            if (completion?.choices?.[0]?.message?.content) {
              responseText = completion.choices[0].message.content;
              break;
            }
          } catch (callErr: any) {
            const errStr = callErr?.message || String(callErr);
            if (errStr.includes('429') || errStr.includes('rate_limit') || errStr.includes('401') || errStr.includes('403')) {
              throw callErr;
            }
            if (attempt === 1 && (errStr.includes('503') || errStr.includes('502') || errStr.includes('UNAVAILABLE') || errStr.includes('ECONNRESET'))) {
              await new Promise(r => setTimeout(r, 1200));
              continue;
            }
            throw callErr;
          }
        }

        if (responseText) {
          const candidates = parseRecommendationsJson(responseText);
          const validatedRecs = processAndValidateCandidates(
            candidates,
            'GROQ_AI',
            'groq',
            configuredGroqModel,
            workerMap,
            projectMap,
            dismissedPairs
          );
          if (validatedRecs.length > 0) {
            newRecommendations = validatedRecs;
            scanSource = 'GROQ_AI';
            usedProvider = 'groq';
            usedAiModel = configuredGroqModel;
            groqSuccess = true;
          }
        }
      } catch (err: any) {
        groqErrorMessage = err?.message || String(err);
        console.log(`[Multi-Provider AI] Secondary Groq (${configuredGroqModel}) unavailable: ${groqErrorMessage}. Triggering final fallback to Rule-Based engine...`);
      }
    } else if (!geminiSuccess) {
      groqErrorMessage = !process.env.GROQ_API_KEY ? 'GROQ_API_KEY not configured' : 'Bypassed Groq';
    }

    // =========================================================================
    // LAYER 3: Final Fallback — Existing CTVILL Rule-Based Recommendation Engine
    // Automatically activated when both Gemini and Groq fail or are unavailable
    // =========================================================================
    if (!geminiSuccess && !groqSuccess && projects.length > 0 && eligibleWorkers.length > 0) {
      scanSource = 'RULE_BASED_FALLBACK';
      usedProvider = 'heuristic';
      usedAiModel = 'heuristic-v1';

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

      const candidatePool = [...eligibleWorkers];
      const maxQueueItems = Math.min(10, Math.max(4, candidatePool.length));

      for (let i = 0; i < candidatePool.length && newRecommendations.length < maxQueueItems; i++) {
        const worker = candidatePool[i] as any;
        const trade = worker.tradeType || worker.specialty || 'General Trade';
        const isStandby = !worker.activeProjectSite || worker.activeProjectSite === 'STANDBY' || worker.allocationStatus === 'STANDBY';

        const targetProj = recipientProjects.find((p: any) => {
          if (!p || !p.id) return false;
          if (worker.activeProjectSite && p.name.toLowerCase().trim() === worker.activeProjectSite.toLowerCase().trim()) {
            return false;
          }
          const assignedIds: string[] = p.assigned_contractor_ids || [];
          if (assignedIds.includes(worker.id)) {
            return false;
          }
          return true;
        }) || recipientProjects[i % Math.max(1, recipientProjects.length)];

        if (!targetProj) continue;

        const donorProj = projects.find((p: any) => 
          worker.activeProjectSite && p.name && p.name.toLowerCase().trim() === worker.activeProjectSite.toLowerCase().trim()
        );
        const donorId = donorProj ? donorProj.id : null;

        const validation = validateRecommendationCandidate(
          {
            workerId: worker.id,
            targetProjectId: targetProj.id,
            donorProjectId: donorId,
            workerTrade: trade
          },
          workerMap,
          projectMap,
          dismissedPairs
        );

        if (!validation.valid) continue;

        const donorName = donorProj ? donorProj.name : 'General Standby Pool';
        const isTargetBehind = targetProj.weather_suspended || targetProj.status === 'BEHIND_SCHEDULE';

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
          priority,
          source: 'RULE_BASED_FALLBACK',
          provider: 'heuristic',
          aiModel: 'heuristic-v1',
          confidenceScore: calculateRecommendationFitScore({
            tradeMatch: true,
            targetBehindSchedule: Boolean(isTargetBehind),
            isFromStandby: Boolean(isStandby),
            donorProgress: donorProj ? Number(donorProj.progress_percentage || 0) : undefined
          })
        });
      }
    }

    // STEP 3: Clear unapplied recommendations within authorized scope only
    if (req.user?.role === 'ADMIN') {
      // Administrators may refresh the company-wide unapplied recommendation queue
      await pool.query('DELETE FROM ai_manpower_recommendations WHERE applied = false OR dismissed = true');
    } else if (req.user?.role === 'ENGINEER') {
      // Engineers are strictly restricted from deleting or replacing company-wide recommendations
      // They may only update unapplied recommendations for their assigned projects
      const engProjectIds = req.user.projectIds || [];
      await pool.query(
        'DELETE FROM ai_manpower_recommendations WHERE (applied = false OR dismissed = true) AND target_project_id = ANY($1::text[])',
        [engProjectIds]
      );
    }

    for (const rec of newRecommendations) {
      await pool.query(`
        INSERT INTO ai_manpower_recommendations 
        (id, title, target_lots, contractor_id, contractor_name, current_headcount, recommended_headcount, rationale, priority, applied, dismissed,
         donor_project_id, donor_project_name, target_project_id, target_project_name, worker_id, worker_name, trade_type, category_tag,
         source, provider, ai_model, confidence_score)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, false, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
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
          category_tag = EXCLUDED.category_tag,
          source = EXCLUDED.source,
          provider = EXCLUDED.provider,
          ai_model = EXCLUDED.ai_model,
          confidence_score = EXCLUDED.confidence_score
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
        rec.categoryTag || 'Trade Deficit Offset',
        rec.source || 'RULE_BASED_FALLBACK',
        rec.provider || 'heuristic',
        rec.aiModel || 'heuristic-v1',
        rec.confidenceScore || 88
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
      tradeType: r.trade_type || 'Artisan',
      source: (r.source === 'GEMINI_AI' ? 'GEMINI_AI' : r.source === 'GROQ_AI' ? 'GROQ_AI' : 'RULE_BASED_FALLBACK') as 'GEMINI_AI' | 'GROQ_AI' | 'RULE_BASED_FALLBACK',
      provider: (r.provider || (r.source === 'GEMINI_AI' ? 'gemini' : r.source === 'GROQ_AI' ? 'groq' : 'heuristic')) as 'gemini' | 'groq' | 'heuristic',
      aiModel: r.ai_model || (r.source === 'GEMINI_AI' ? configuredGeminiModel : r.source === 'GROQ_AI' ? configuredGroqModel : 'heuristic-v1'),
      ruleBasedFitScore: r.confidence_score !== null && r.confidence_score !== undefined ? Number(r.confidence_score) : undefined,
      confidenceScore: r.confidence_score !== null && r.confidence_score !== undefined ? Number(r.confidence_score) : undefined,
      approvedByUserId: r.approved_by_user_id || null,
      approvedByUserName: r.approved_by_user_name || null,
      appliedAt: r.applied_at ? (r.applied_at instanceof Date ? r.applied_at.toISOString() : String(r.applied_at)) : null
    }));

    let statusMessage = '';
    if (scanSource === 'GEMINI_AI') {
      statusMessage = `Live AI Labor Optimization: ${returnedRecs.length} recommendations generated via Primary Gemini AI (${usedAiModel}).`;
    } else if (scanSource === 'GROQ_AI') {
      statusMessage = `Primary Gemini unavailable (${geminiErrorMessage || 'quota/timeout'}). Failover: ${returnedRecs.length} recommendations generated via Secondary Groq AI (${usedAiModel}).`;
    } else {
      statusMessage = `AI services unavailable (Gemini: ${geminiErrorMessage || 'quota/offline'}; Groq: ${groqErrorMessage || 'not configured/offline'}). ${returnedRecs.length} recommendations generated via Rule-Based Fallback engine.`;
    }

    res.json({
      success: true,
      source: scanSource,
      provider: usedProvider,
      aiModel: usedAiModel,
      message: statusMessage,
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
workforceRouter.post('/manpower-audits', requireRole(['ENGINEER', 'ADMIN', 'TIMEKEEPER']), async (req: Request, res: Response) => {
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
workforceRouter.post('/workforce/reallocate', requireRole(['ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
  try {
    const { workerId, targetProjectId, targetProjectName } = req.body;
    if (!workerId || !targetProjectName) {
      return res.status(400).json({ error: 'workerId and targetProjectName are required' });
    }

    if (targetProjectId && !checkUserProjectAccess(req.user, targetProjectId)) {
      return res.status(403).json({ error: 'You do not have access to reallocate workforce to this target project.' });
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
        actorName: (req as any).user?.name || 'Operations Director',
        actorRole: (req as any).user?.role || 'ADMIN',
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
