/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { prisma, pool } from '../db';
import { broadcastChange, invalidateAllDataCache } from '../events';

export const siteDiaryRouter = Router();

// ============================================================================
// DAILY SITE LOGS (WEATHER, EQUIPMENT, CREW, SAFETY & TOOLBOX)
// ============================================================================

// GET /api/site-logs
siteDiaryRouter.get('/site-logs', async (req: Request, res: Response) => {
  try {
    const logs = await prisma.dailySiteLog.findMany({ orderBy: { date: 'desc' } });
    res.json(logs);
  } catch (error) {
    console.error('Error fetching site logs:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/site-logs
siteDiaryRouter.post('/site-logs', async (req: Request, res: Response) => {
  const { weather, temperature, activeHeadcount, equipmentOnSite, toolboxTopic, workCompleted, delaysOrIssues, supervisorName } = req.body;
  try {
    const siteLog = await prisma.dailySiteLog.create({
      data: {
        date: new Date(),
        weather: weather || 'SUNNY',
        temperature,
        activeHeadcount: Number(activeHeadcount) || 0,
        equipmentOnSite,
        toolboxTopic,
        workCompleted,
        delaysOrIssues,
        supervisorName: supervisorName || 'Engr. Ricardo Gomez',
      }
    });

    await prisma.processAuditLog.create({
      data: {
        entityType: 'CIVIL_WORKS',
        entityId: siteLog.id,
        action: 'DAILY_SITE_LOG_POSTED',
        actorName: supervisorName || 'Engr. Ricardo Gomez',
        actorRole: 'PROJECT_MANAGER',
        details: `Recorded daily site diary (${weather}, ${activeHeadcount} workers).`,
      }
    });

    broadcastChange('siteLogs');
    broadcastChange('auditLogs');
    invalidateAllDataCache();
    res.json(siteLog);
  } catch (error) {
    console.error('Error creating site log:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ============================================================================
// LIVE PHILIPPINE SITE WEATHER TELEMETRY
// ============================================================================

// GET /api/weather/live
siteDiaryRouter.get('/weather/live', async (req: Request, res: Response) => {
  try {
    const lat = req.query.lat || '14.2547';
    const lon = req.query.lon || '121.5056';
    const siteKey = (req.query.siteKey as string) || `site_${lat}_${lon}`;
    const forceFresh = req.query.fresh === 'true';

    // 1. Check local PostgreSQL cache (valid for 10 minutes unless forced fresh)
    if (!forceFresh) {
      const cached = await pool.query(
        "SELECT * FROM weather_cache WHERE site_key = $1 AND cached_at > NOW() - INTERVAL '10 minutes'",
        [siteKey]
      );

      if (cached.rows && cached.rows.length > 0) {
        return res.json({
          ...cached.rows[0].weather_data,
          source: 'POSTGRES_CACHE',
          cachedAt: cached.rows[0].cached_at
        });
      }
    }

    // 2. Fetch from Open-Meteo external service with hourly telemetry
    try {
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=Asia%2FManila`;
      
      const response = await fetch(weatherUrl);
      if (response.ok) {
        const data = await response.json();
        
        await pool.query(
          `INSERT INTO weather_cache (site_key, weather_data, cached_at) 
           VALUES ($1, $2, NOW()) 
           ON CONFLICT (site_key) DO UPDATE SET weather_data = $2, cached_at = NOW()`,
          [siteKey, JSON.stringify(data)]
        ).catch(err => console.warn('Weather cache write failed:', err));

        return res.json({
          ...data,
          source: 'LIVE_OPEN_METEO'
        });
      }
    } catch (fetchErr) {
      console.warn('Open-Meteo fetch error, falling back to older cache or defaults:', fetchErr);
    }

    // 3. Fallback to older cache if exists
    const staleCache = await pool.query('SELECT * FROM weather_cache WHERE site_key = $1', [siteKey]);
    if (staleCache.rows && staleCache.rows.length > 0) {
      return res.json({
        ...staleCache.rows[0].weather_data,
        source: 'STALE_CACHE',
        cachedAt: staleCache.rows[0].cached_at
      });
    }

    // 4. Default manual fallback data (Tropical Philippine site conditions with hourly rain curve)
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const mockHourlyTimes: string[] = [];
    const mockHourlyRainProb: number[] = [];
    const mockHourlyPrecip: number[] = [];
    const mockHourlyCodes: number[] = [];
    const mockHourlyTemps: number[] = [];

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const d = new Date(now.getTime() + dayOffset * 86400000);
      const dStr = d.toISOString().split('T')[0];
      for (let h = 0; h < 24; h++) {
        const hStr = h < 10 ? `0${h}:00` : `${h}:00`;
        mockHourlyTimes.push(`${dStr}T${hStr}`);
        if (h >= 13 && h <= 16) {
          mockHourlyRainProb.push(dayOffset === 0 ? 85 : 70 - dayOffset * 5);
          mockHourlyPrecip.push(dayOffset === 0 ? 4.5 : 2.0);
          mockHourlyCodes.push(dayOffset === 0 ? 95 : 61);
          mockHourlyTemps.push(28);
        } else if (h >= 11 && h <= 18) {
          mockHourlyRainProb.push(35);
          mockHourlyPrecip.push(0.5);
          mockHourlyCodes.push(51);
          mockHourlyTemps.push(30);
        } else {
          mockHourlyRainProb.push(10);
          mockHourlyPrecip.push(0.0);
          mockHourlyCodes.push(1);
          mockHourlyTemps.push(26);
        }
      }
    }

    res.json({
      source: 'MANUAL_FALLBACK',
      current: {
        temperature_2m: 30.5,
        apparent_temperature: 34.0,
        relative_humidity_2m: 78,
        precipitation: 0.0,
        weather_code: 1,
        wind_speed_10m: 12.5,
        wind_direction_10m: 75,
        surface_pressure: 1012,
        time: now.toISOString()
      },
      hourly: {
        time: mockHourlyTimes,
        precipitation_probability: mockHourlyRainProb,
        precipitation: mockHourlyPrecip,
        weather_code: mockHourlyCodes,
        temperature_2m: mockHourlyTemps
      },
      daily: {
        time: [todayStr],
        weather_code: [1],
        temperature_2m_max: [33.0],
        temperature_2m_min: [25.0],
        precipitation_probability_max: [85],
        wind_speed_10m_max: [18.0]
      }
    });
  } catch (error) {
    console.error('Error handling weather telemetry:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ============================================================================
// PUNCH-LIST DEFECTS & HANDOVER AUDITS
// ============================================================================

// GET /api/punch-lists
siteDiaryRouter.get('/punch-lists', async (req: Request, res: Response) => {
  try {
    const dbDefects = await prisma.punchListDefect.findMany({
      include: { inspector: true, contractor: true },
      orderBy: { createdAt: 'desc' }
    });
    const punchListDefects = dbDefects.map(d => ({
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
    }));
    res.json(punchListDefects);
  } catch (error) {
    console.error('Error fetching punch lists:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/punch-lists
siteDiaryRouter.post('/punch-lists', async (req: Request, res: Response) => {
  const { slotId, inspectorId, contractorId, title, description, severity, category, targetDate } = req.body;
  try {
    const projectManager = await prisma.user.findFirst({
      where: { role: Role.PROJECT_MANAGER }
    });

    const defect = await prisma.punchListDefect.create({
      data: {
        slotId,
        inspectorId: inspectorId || projectManager?.id || 'ricardo-gomez',
        contractorId: contractorId || null,
        title,
        description,
        severity: severity || 'MEDIUM',
        status: 'OPEN',
        category: category || 'ROADS',
        targetDate: targetDate ? new Date(targetDate) : null,
      },
      include: { inspector: true, contractor: true }
    });

    await prisma.processAuditLog.create({
      data: {
        entityType: 'DEFECT',
        entityId: defect.id,
        action: 'DEFECT_TICKET_LOGGED',
        actorName: defect.inspector?.name || 'Project Manager',
        actorRole: 'PROJECT_MANAGER',
        details: `Logged [${severity}] defect on Unit/Lot ${slotId}: "${title}". Assigned to: ${defect.contractor?.name || 'Unassigned'}.`,
      }
    });

    broadcastChange('punchLists');
    broadcastChange('auditLogs');
    invalidateAllDataCache();
    res.json({
      id: defect.id,
      slotId: defect.slotId,
      inspectorId: defect.inspectorId,
      inspectorName: defect.inspector?.name || 'Site Monitor',
      contractorId: defect.contractorId,
      contractorName: defect.contractor?.name || 'Unassigned Contractor',
      title: defect.title,
      description: defect.description,
      severity: defect.severity,
      status: defect.status,
      category: defect.category,
      resolutionNotes: defect.resolutionNotes || '',
      targetDate: defect.targetDate ? defect.targetDate.toISOString().split('T')[0] : null,
      createdAt: defect.createdAt.toISOString(),
      updatedAt: defect.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Error creating defect ticket:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PATCH /api/punch-lists/:id
siteDiaryRouter.patch('/punch-lists/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, resolutionNotes, contractorId, actorName, actorRole } = req.body;
  try {
    const updateData: any = {};
    if (status) updateData.status = status;
    if (resolutionNotes !== undefined) updateData.resolutionNotes = resolutionNotes;
    if (contractorId) updateData.contractorId = contractorId;

    const updated = await prisma.punchListDefect.update({
      where: { id },
      data: updateData,
      include: { inspector: true, contractor: true }
    });

    await prisma.processAuditLog.create({
      data: {
        entityType: 'DEFECT',
        entityId: id,
        action: `DEFECT_${status || 'UPDATED'}`,
        actorName: actorName || 'Field Team',
        actorRole: actorRole || 'PROJECT_MANAGER',
        details: `Defect "${updated.title}" updated to status ${status}. Notes: ${resolutionNotes || 'None'}.`,
      }
    });

    broadcastChange('punchLists');
    broadcastChange('auditLogs');
    invalidateAllDataCache();
    res.json({
      id: updated.id,
      slotId: updated.slotId,
      inspectorId: updated.inspectorId,
      inspectorName: updated.inspector?.name || 'Site Monitor',
      contractorId: updated.contractorId,
      contractorName: updated.contractor?.name || 'Unassigned Contractor',
      title: updated.title,
      description: updated.description,
      severity: updated.severity,
      status: updated.status,
      category: updated.category,
      resolutionNotes: updated.resolutionNotes || '',
      targetDate: updated.targetDate ? updated.targetDate.toISOString().split('T')[0] : null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Error updating defect ticket:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ============================================================================
// CIVIL & TURNKEY MILESTONES & QA INSPECTION LOGS
// ============================================================================

// GET /api/civil-milestones
siteDiaryRouter.get('/civil-milestones', async (req: Request, res: Response) => {
  try {
    const dbMilestones = await prisma.civilWorksMilestone.findMany({
      orderBy: { phaseName: 'asc' }
    });
    const civilWorksMilestones = dbMilestones.map(m => ({
      id: m.id,
      parcelId: m.parcelId,
      phaseName: m.phaseName,
      targetPercentage: m.targetPercentage,
      currentPercentage: m.currentPercentage,
      status: m.status,
      inspectorSignOff: m.inspectorSignOff,
      signOffDate: m.signOffDate ? m.signOffDate.toISOString().split('T')[0] : null,
      remarks: m.remarks || '',
    }));
    res.json(civilWorksMilestones);
  } catch (error) {
    console.error('Error fetching civil milestones:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/civil-works/update-milestone
siteDiaryRouter.post('/civil-works/update-milestone', async (req: Request, res: Response) => {
  const { milestoneId, currentPercentage, status, inspectorSignOff, remarks, actorName } = req.body;
  try {
    const updateData: any = {};
    if (currentPercentage !== undefined) updateData.currentPercentage = currentPercentage;
    if (status) updateData.status = status;
    if (inspectorSignOff !== undefined) {
      updateData.inspectorSignOff = inspectorSignOff;
      if (inspectorSignOff) updateData.signOffDate = new Date();
    }
    if (remarks !== undefined) updateData.remarks = remarks;

    const updated = await prisma.civilWorksMilestone.update({
      where: { id: milestoneId },
      data: updateData
    });

    await prisma.processAuditLog.create({
      data: {
        entityType: 'CIVIL_WORKS',
        entityId: milestoneId,
        action: 'CIVIL_MILESTONE_UPDATED',
        actorName: actorName || 'Engr. Ricardo Gomez',
        actorRole: 'PROJECT_MANAGER',
        details: `${updated.phaseName} updated to ${updated.currentPercentage}%. Status: ${updated.status}. Sign-off: ${updated.inspectorSignOff ? 'APPROVED' : 'PENDING'}.`,
      }
    });

    broadcastChange('civilMilestones');
    broadcastChange('auditLogs');
    invalidateAllDataCache();
    res.json({
      id: updated.id,
      parcelId: updated.parcelId,
      phaseName: updated.phaseName,
      targetPercentage: updated.targetPercentage,
      currentPercentage: updated.currentPercentage,
      status: updated.status,
      inspectorSignOff: updated.inspectorSignOff,
      signOffDate: updated.signOffDate ? updated.signOffDate.toISOString().split('T')[0] : null,
      remarks: updated.remarks || '',
    });
  } catch (error) {
    console.error('Error updating civil works milestone:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/civil-works/sync-schedule
siteDiaryRouter.post('/civil-works/sync-schedule', async (req: Request, res: Response) => {
  const { tasks } = req.body;
  try {
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ error: 'No tasks provided for sync' });
    }

    let parcel = await prisma.landParcel.findFirst();
    if (!parcel) {
      parcel = await prisma.landParcel.create({
        data: {
          name: 'CTVill Primary Project',
          location: 'BGC Taguig, Metro Manila',
          totalAreaSqm: 5000,
          purchaseCost: 150000000,
          totalSlots: 0,
          acquisitionDate: new Date(),
        }
      });
    }

    const existing = await prisma.civilWorksMilestone.findMany({
      where: { parcelId: parcel.id },
      orderBy: { phaseName: 'asc' }
    });

    if (existing.length === 0) {
      for (const t of tasks) {
        await prisma.civilWorksMilestone.create({
          data: {
            parcelId: parcel.id,
            phaseName: t.taskName || t.phaseName,
            targetPercentage: 100.0,
            currentPercentage: Number(t.progress) || 0.0,
            status: t.status || 'IN_PROGRESS',
            inspectorSignOff: t.status === 'COMPLETED',
            remarks: `Imported from schedule.`,
          }
        });
      }
    } else {
      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        if (existing[i]) {
          await prisma.civilWorksMilestone.update({
            where: { id: existing[i].id },
            data: {
              phaseName: t.taskName || existing[i].phaseName,
              currentPercentage: Number(t.progress) !== undefined ? Number(t.progress) : existing[i].currentPercentage,
              status: t.status || existing[i].status,
              inspectorSignOff: t.status === 'COMPLETED',
              remarks: `Synced from schedule.`,
            }
          });
        } else {
          await prisma.civilWorksMilestone.create({
            data: {
              parcelId: parcel.id,
              phaseName: t.taskName || t.phaseName,
              targetPercentage: 100.0,
              currentPercentage: Number(t.progress) || 0.0,
              status: t.status || 'IN_PROGRESS',
              inspectorSignOff: t.status === 'COMPLETED',
              remarks: `Imported from schedule.`,
            }
          });
        }
      }
    }

    await prisma.processAuditLog.create({
      data: {
        entityType: 'CIVIL_WORKS',
        entityId: parcel.id,
        action: 'SCHEDULE_SYNCHRONIZED',
        actorName: 'Operations Lead',
        actorRole: 'ADMIN',
        details: `Synchronized ${tasks.length} schedule tasks with project milestones.`,
      }
    });

    broadcastChange('civilMilestones');
    broadcastChange('auditLogs');
    invalidateAllDataCache();

    const updatedMilestones = await prisma.civilWorksMilestone.findMany({
      where: { parcelId: parcel.id },
      orderBy: { phaseName: 'asc' }
    });

    res.json(updatedMilestones);
  } catch (error) {
    console.error('Error syncing schedule to database:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/qa-logs
siteDiaryRouter.post('/qa-logs', async (req: Request, res: Response) => {
  const { slotId, complianceStatus, progressPercentage, structuralCheck, safetyCheck, remarks, siteActivity } = req.body;
  try {
    const projectManager = await prisma.user.findFirst({
      where: { role: Role.PROJECT_MANAGER }
    });

    if (!projectManager) {
      return res.status(400).json({ error: 'No Project Manager user found in database' });
    }

    const log = await prisma.weeklyProgressLog.create({
      data: {
        slotId,
        inspectorId: projectManager.id,
        complianceStatus,
        percentageComplete: progressPercentage,
        structuralCheck,
        safetyCheck,
        notes: remarks,
        materialsUsed: 'Standard fitout finishing materials, gypsum, conduit, LED panels',
        siteActivity,
      },
      include: { inspector: true }
    });

    await prisma.processAuditLog.create({
      data: {
        entityType: 'SLOT',
        entityId: slotId,
        action: 'QA_INSPECTION_RECORDED',
        actorName: projectManager.name,
        actorRole: 'PROJECT_MANAGER',
        details: `QA Log submitted for Unit/Lot ${slotId}: ${progressPercentage}% complete. Compliance: ${complianceStatus}.`,
      }
    });

    broadcastChange('qaLogs');
    broadcastChange('auditLogs');
    invalidateAllDataCache();
    res.json({
      id: log.id,
      date: log.date.toISOString().split('T')[0],
      inspectorName: log.inspector.name,
      slotId: log.slotId,
      complianceStatus: log.complianceStatus || 'Compliant',
      progressPercentage: log.percentageComplete,
      structuralCheck: log.structuralCheck || 'Pass',
      safetyCheck: log.safetyCheck || 'Pass',
      remarks: log.notes,
      siteActivity: log.siteActivity || 'Ready',
    });
  } catch (error) {
    console.error('Error submitting QA log:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
