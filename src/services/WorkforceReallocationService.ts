/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Contractor, ProjectProfile, WorkforceReallocationRecommendation } from '../types';
import { getWorkforceCategory } from '../data/ctvillWorkforce';

/**
 * Generates automated cross-project workforce reallocation recommendations.
 * Triggered when projects reach >= 90% completion or turnover readiness,
 * identifying surplus workers to reassign to behind-schedule or early-stage projects.
 */
export function generateReallocationRecommendations(
  projects: ProjectProfile[],
  contractors: Contractor[]
): WorkforceReallocationRecommendation[] {
  const recommendations: WorkforceReallocationRecommendation[] = [];

  if (!projects || projects.length === 0 || !contractors || contractors.length === 0) {
    return recommendations;
  }

  // 1. Identify donor projects: >= 90% progress or in turnover/completed stages
  const donorProjects = projects.filter(p => 
    p.progressPercentage >= 90 || 
    p.status === 'HANDED_OVER' || 
    p.status === 'COMPLETED'
  );

  // 2. Identify recipient candidate projects: prioritize BEHIND_SCHEDULE, early civil phases (Land Clearing, Road Subgrade)
  const isEarlyCivilPhase = (p: ProjectProfile) => {
    const text = (p.name + ' ' + (p.description || '')).toLowerCase();
    return p.progressPercentage <= 30 || text.includes('clearing') || text.includes('subgrade') || text.includes('earthwork');
  };

  const recipientProjects = projects.filter(p => 
    p.status !== 'HANDED_OVER' && 
    p.status !== 'COMPLETED' && 
    p.progressPercentage < 85
  ).sort((a, b) => {
    const aBehind = (a.status as string) === 'BEHIND_SCHEDULE' || a.weatherSuspended ? 1 : 0;
    const bBehind = (b.status as string) === 'BEHIND_SCHEDULE' || b.weatherSuspended ? 1 : 0;
    if (aBehind !== bBehind) return bBehind - aBehind;

    const aEarly = isEarlyCivilPhase(a) ? 1 : 0;
    const bEarly = isEarlyCivilPhase(b) ? 1 : 0;
    if (aEarly !== bEarly) return bEarly - aEarly;

    return a.progressPercentage - b.progressPercentage;
  });

  if (donorProjects.length === 0 || recipientProjects.length === 0) {
    return recommendations;
  }

  // 3. For each donor project, identify assigned or available workforce
  donorProjects.forEach(donor => {
    // Match contractors assigned to this project site
    const assignedWorkers = contractors.filter(c => {
      const siteMatch = c.activeProjectSite && (
        c.activeProjectSite.toLowerCase().includes(donor.name.toLowerCase()) ||
        donor.name.toLowerCase().includes(c.activeProjectSite.toLowerCase())
      );
      return siteMatch || c.allocationStatus === 'STANDBY' || c.allocationStatus === 'REALLOCATED';
    });

    const candidateWorkers = assignedWorkers.length > 0 
      ? assignedWorkers 
      : contractors.slice(0, 3); // Fallback to candidate crew members if no explicit name match

    candidateWorkers.forEach((worker, wIdx) => {
      // Pick best target project based on role category and project needs
      const target = recipientProjects[wIdx % recipientProjects.length];
      if (!target || target.id === donor.id) return;

      const category = worker.workforceCategory || getWorkforceCategory(worker.roleTitle || worker.specialty);
      const isTargetBehind = (target.status as string) === 'BEHIND_SCHEDULE' || target.weatherSuspended;
      const isEarlyPhase = isEarlyCivilPhase(target);
      
      let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
      let rationale = '';

      if (isTargetBehind) {
        priority = 'HIGH';
        rationale = `CRITICAL: Project "${target.name}" is marked BEHIND_SCHEDULE (${target.progressPercentage}% complete). Transfer surplus resource ${worker.name} (${worker.roleTitle || worker.specialty}) from "${donor.name}" (${donor.progressPercentage}% complete) to recover timeline.`;
      } else if (isEarlyPhase && (category === 'SKILLED' || category === 'GENERAL_LABOR')) {
        priority = 'HIGH';
        rationale = `Target project "${target.name}" is in early civil phase (${target.progressPercentage}%, Land Clearing/Road Subgrade). Deploy surplus ${worker.name} (${category}) from ${donor.progressPercentage}% complete "${donor.name}".`;
      } else if (donor.progressPercentage >= 95 || donor.status === 'HANDED_OVER') {
        priority = 'HIGH';
        rationale = `Project "${donor.name}" is at ${donor.progressPercentage}% completion (Handover stage). ${worker.name} (${worker.roleTitle || worker.specialty}) is surplus and ready for redeployment to "${target.name}".`;
      } else {
        priority = 'MEDIUM';
        rationale = `Optimal allocation: Reassign ${worker.name} (${category}) from ${donor.progressPercentage}% complete "${donor.name}" to accelerate "${target.name}".`;
      }

      recommendations.push({
        id: `REC-${donor.id}-${target.id}-${worker.id}`,
        workerId: worker.id,
        workerName: worker.name,
        roleTitle: worker.roleTitle || worker.specialty || 'Trade Specialist',
        workforceCategory: category,
        originProjectId: donor.id,
        originProjectName: donor.name,
        originProgress: donor.progressPercentage,
        targetProjectId: target.id,
        targetProjectName: target.name,
        targetStatus: target.status,
        targetProgress: target.progressPercentage,
        rationale,
        priority,
        applied: worker.allocationStatus === 'REALLOCATED'
      });
    });
  });

  return recommendations;
}
