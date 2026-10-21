/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { History, Shield, CheckCircle2 } from 'lucide-react';
import { ProcessAuditLog } from '../types';
import { useTheme } from '../context/ThemeContext';

export interface AuditTrailQaLogsProps {
  auditLogs: ProcessAuditLog[];
}

export const AuditTrailQaLogs: React.FC<AuditTrailQaLogsProps> = ({ auditLogs = [] }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case 'USER_LOGIN_SUCCESS':
        return isDark
          ? 'bg-emerald-950/80 border-emerald-700/80 text-emerald-300'
          : 'bg-emerald-50 border-emerald-300 text-emerald-800';
      case 'PAYROLL_FINALIZED':
        return isDark
          ? 'bg-purple-950/80 border-purple-700/80 text-purple-300'
          : 'bg-purple-50 border-purple-300 text-purple-800';
      case 'ATTENDANCE_LOGGED':
        return isDark
          ? 'bg-blue-950/80 border-blue-700/80 text-blue-300'
          : 'bg-blue-50 border-blue-300 text-blue-800';
      default:
        return isDark
          ? 'bg-amber-950/80 border-amber-700/80 text-amber-300'
          : 'bg-amber-50 border-amber-300 text-amber-800';
    }
  };

  const extractIpAddress = (details: string | undefined): string | null => {
    if (!details) return null;
    const match = details.match(/(?:from|IP:?)\s*([0-9a-fA-F:.]+)/i);
    return match ? match[1] : null;
  };

  return (
    <div className="space-y-6">
      {/* Header Container */}
      <div className={`${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs'} border rounded-xl p-6 transition-all`}>
        <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'} flex items-center gap-2`}>
          <History className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
          Live Operational Audit Trail & Process Logs
        </h3>
        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'} mt-1`}>
          Immutable chronological log of all lot transitions, titling advancements, civil works certifications, and client handovers.
        </p>
      </div>

      {/* Logs Table Container */}
      <div className={`${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs'} border rounded-xl overflow-hidden`}>
        {auditLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <p className="text-xs">No audit logs recorded yet.</p>
          </div>
        ) : (
          <div className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
            {auditLogs.map((log) => {
              const ip = extractIpAddress(log.details);

              return (
                <div
                  key={log.id}
                  className={`p-4 ${isDark ? 'hover:bg-slate-900/60' : 'hover:bg-slate-50/80'} transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs`}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase border shadow-2xs ${getActionBadgeClass(log.action)}`}>
                        {log.action}
                      </span>
                      <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-semibold uppercase border ${
                        isDark ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-700'
                      }`}>
                        {log.entityType}
                      </span>
                      <span className={`${isDark ? 'text-slate-400' : 'text-slate-500'} font-mono text-xs truncate`}>
                        • ID: {log.entityId}
                      </span>
                    </div>
                    <p className={`${isDark ? 'text-slate-300' : 'text-slate-700'} text-xs leading-relaxed`}>
                      {log.details}
                    </p>
                  </div>

                  <div className="text-left sm:text-right font-mono text-xs shrink-0 space-y-0.5">
                    <div className={`${isDark ? 'text-slate-200' : 'text-slate-900'} font-semibold text-xs`}>
                      {log.actorName}
                    </div>
                    <div className={`${isDark ? 'text-slate-400' : 'text-slate-600'} font-mono text-xs`}>
                      Role: {log.actorRole}
                    </div>
                    <div className={`${isDark ? 'text-slate-400' : 'text-slate-600'} font-mono text-xs`}>
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                    {ip && (
                      <div className={`${isDark ? 'text-slate-400' : 'text-slate-600'} font-mono text-xs`}>
                        IP: {ip}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditTrailQaLogs;
