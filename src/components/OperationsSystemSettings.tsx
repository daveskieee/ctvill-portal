import React, { useState } from 'react';
import { Sliders, Bell, Database, HardDrive, Save } from 'lucide-react';
import { DelayedLoader } from './common/DelayedLoader';
import { FormSettingsSkeleton } from './common/Skeletons';

interface OperationsSystemSettingsProps {
  isLoading?: boolean;
  onSaveConfig?: (config: any) => Promise<void> | void;
}

export const OperationsSystemSettings: React.FC<OperationsSystemSettingsProps> = ({
  isLoading = false,
  onSaveConfig
}) => {
  const [telemetry, setTelemetry] = useState(true);
  const [autoReconcile, setAutoReconcile] = useState(true);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(60);

  if (isLoading) {
    return (
      <DelayedLoader delayMs={180} fallback={<div className="p-6 text-slate-500 font-mono text-xs">Loading operational parameters...</div>}>
        <FormSettingsSkeleton />
      </DelayedLoader>
    );
  }

  return (
    <div className="p-6 max-w-4xl space-y-6 animate-fadeIn">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">Operations & System Settings</h2>
        <p className="text-xs text-slate-400 mt-1">
          Configure real-time jobsite telemetry, automated audit intervals, and ERP system parameters.
        </p>
      </div>

      <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-5 shadow-xl">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center gap-3">
              <HardDrive className="w-4 h-4 text-amber-400" />
              <div>
                <p className="text-xs font-semibold text-white">Live Jobsite Telemetry & Weather Sync</p>
                <p className="text-[11px] text-slate-400">Sync OpenWeatherMap telemetry for active commercial fit-out projects automatically.</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={telemetry}
              onChange={(e) => setTelemetry(e.target.checked)}
              className="accent-amber-500 w-4 h-4 rounded"
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center gap-3">
              <Database className="w-4 h-4 text-cyan-400" />
              <div>
                <p className="text-xs font-semibold text-white">Automated Headcount Reconciliation</p>
                <p className="text-[11px] text-slate-400">Verify biometric attendance rolls against subcontractor payables prior to approval.</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={autoReconcile}
              onChange={(e) => setAutoReconcile(e.target.checked)}
              className="accent-cyan-500 w-4 h-4 rounded"
            />
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
            <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" /> Executive Session Idle Timeout (Minutes)
            </label>
            <input
              type="number"
              value={sessionTimeoutMinutes}
              onChange={(e) => setSessionTimeoutMinutes(Number(e.target.value))}
              min={15}
              max={480}
              className="w-48 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={() => onSaveConfig && onSaveConfig({ telemetry, autoReconcile, sessionTimeoutMinutes })}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs shadow-lg transition cursor-pointer"
          >
            <Save className="w-4 h-4" /> Save System Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default OperationsSystemSettings;
