/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Building2, MapPin, HardHat, DollarSign, ShieldCheck } from 'lucide-react';
import { ProjectProfile, ProjectTask } from '../types';
import { calculateProjectProgress } from './ProjectProfileHub';

export interface ProjectProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectProfile | null;
  tasks?: ProjectTask[];
  isAdmin?: boolean;
}

export const ProjectProfileModal: React.FC<ProjectProfileModalProps> = ({
  isOpen,
  onClose,
  project,
  tasks = [],
  isAdmin = true
}) => {
  if (!isOpen || !project) return null;

  const progress = calculateProjectProgress(project.id, tasks, project.progressPercentage);
  const effectiveStatus = progress > 0 && project.status === 'PLANNING' ? 'IN_PROGRESS' : project.status;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 animate-scaleUp overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="p-4 pb-3 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-base font-bold text-white">{project.name}</h3>
              <p className="text-xs text-slate-400">{project.clientName} • {project.location}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Read-Only Auto-Synced Progress Bar */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-slate-300 font-bold uppercase tracking-wider">Overall Site Progress</span>
            <span className="text-amber-400 font-bold text-sm">{progress}% Complete</span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center gap-2 pt-1 text-xs text-amber-400 font-mono font-medium">
            <span>⚡ Auto-Synced from Master CPM Gantt & Task Kanban</span>
          </div>
        </div>

        {/* Status & PM Details */}
        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase">Status</span>
            <span className="text-emerald-400 font-bold">{effectiveStatus}</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase">Assigned PM</span>
            <span className="text-white font-medium truncate">{project.assignedProjectManagerName || 'Unassigned'}</span>
          </div>
        </div>

        {/* Financial Overview */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 grid grid-cols-2 gap-3 text-xs font-mono">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Contract Budget</span>
            <span className="text-sm font-bold text-white">₱{project.budget.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Collected</span>
            <span className="text-sm font-bold text-emerald-400">₱{project.fundsCollected.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectProfileModal;
