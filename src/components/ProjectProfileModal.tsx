/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Building2, MapPin, HardHat, DollarSign, ShieldCheck } from 'lucide-react';
import { ProjectProfile, ProjectTask } from '../types';
import { calculateProjectProgress } from './ProjectProfileHub';
import { useTheme } from '../context/ThemeContext';

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
  const { isDark } = useTheme();
  if (!isOpen || !project) return null;

  const rawProgress = 
    project.cpmProgress !== undefined && project.cpmProgress !== null ? project.cpmProgress :
    project.overallProgress !== undefined && project.overallProgress !== null ? project.overallProgress :
    project.progress !== undefined && project.progress !== null ? project.progress :
    project.progressPercentage || 0;
  const progress = calculateProjectProgress(project.id, tasks, Number(rawProgress));
  const effectiveStatus = progress > 0 && (project.status === 'PLANNING' || !project.status) ? 'IN_PROGRESS' : project.status;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className={`${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-2xl'} border rounded-2xl max-w-2xl w-full p-6 space-y-4 animate-scaleUp overflow-y-auto max-h-[90vh]`}>
        {/* Header */}
        <div className={`p-4 pb-3 flex items-center justify-between border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{project.name}</h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{project.clientName} • {project.location}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'} transition-colors cursor-pointer`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Read-Only Auto-Synced Progress Bar */}
        <div className={`${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} p-4 rounded-xl border space-y-2`}>
          <div className="flex justify-between items-center text-xs font-mono">
            <span className={`${isDark ? 'text-slate-300' : 'text-slate-700'} font-bold uppercase tracking-wider`}>Overall Site Progress</span>
            <span className="text-amber-500 font-bold text-sm">{progress}% Complete</span>
          </div>
          <div className={`w-full ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-200 border-slate-300'} rounded-full h-3 overflow-hidden border`}>
            <div
              className="bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center gap-2 pt-1 text-xs text-amber-500 font-mono font-medium">
            <span>⚡ Auto-Synced from Master CPM Gantt &amp; Task Kanban</span>
          </div>
        </div>

        {/* Status & PM Details */}
        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
          <div className={`${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} p-3 rounded-xl border`}>
            <span className={`${isDark ? 'text-slate-400' : 'text-slate-500'} block text-[10px] uppercase font-semibold`}>Status</span>
            <span className="text-emerald-500 font-bold">{effectiveStatus}</span>
          </div>
          <div className={`${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} p-3 rounded-xl border`}>
            <span className={`${isDark ? 'text-slate-400' : 'text-slate-500'} block text-[10px] uppercase font-semibold`}>Assigned PM</span>
            <span className={`${isDark ? 'text-white' : 'text-slate-900'} font-medium truncate block`}>{project.assignedProjectManagerName || 'Unassigned'}</span>
          </div>
        </div>

        {/* Financial Overview */}
        <div className={`${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} p-4 rounded-xl border grid grid-cols-2 gap-3 text-xs font-mono`}>
          <div>
            <span className={`${isDark ? 'text-slate-400' : 'text-slate-500'} block text-[10px] uppercase font-semibold`}>Contract Budget</span>
            <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>₱{project.budget.toLocaleString()}</span>
          </div>
          <div>
            <span className={`${isDark ? 'text-slate-400' : 'text-slate-500'} block text-[10px] uppercase font-semibold`}>Collected</span>
            <span className="text-sm font-bold text-emerald-500">₱{project.fundsCollected.toLocaleString()}</span>
          </div>
        </div>

        <div className={`flex justify-end pt-2 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'} rounded-xl text-xs font-bold cursor-pointer transition-colors`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectProfileModal;
