import React, { useState } from 'react';
import { Lock, ShieldCheck, KeyRound, Save, Eye, EyeOff } from 'lucide-react';
import { DelayedLoader } from './common/DelayedLoader';
import { FormSettingsSkeleton } from './common/Skeletons';

interface PasswordSecuritySettingsProps {
  isLoading?: boolean;
  onUpdatePassword?: (current: string, updated: string) => Promise<void> | void;
}

export const PasswordSecuritySettings: React.FC<PasswordSecuritySettingsProps> = ({
  isLoading = false,
  onUpdatePassword
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (isLoading) {
    return (
      <DelayedLoader delayMs={180} fallback={<div className="p-6 text-slate-500 font-mono text-xs">Loading security configuration...</div>}>
        <FormSettingsSkeleton />
      </DelayedLoader>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setStatusMessage('New passwords do not match');
      return;
    }
    if (onUpdatePassword) {
      onUpdatePassword(currentPassword, newPassword);
    }
    setStatusMessage('Password updated successfully.');
  };

  return (
    <div className="p-6 max-w-4xl space-y-6 animate-fadeIn">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">Password & Authentication Security</h2>
        <p className="text-xs text-slate-400 mt-1">
          Enforce strong cryptographic passwords, dual-factor authentication tokens, and session expiry rules.
        </p>
      </div>

      <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-5 shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" /> Current Master Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-cyan-400" /> New Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Confirm New Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-400 font-mono"
              />
            </div>
          </div>

          {statusMessage && (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-amber-400">
              {statusMessage}
            </div>
          )}

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-bold text-xs shadow-lg transition cursor-pointer"
            >
              <Save className="w-4 h-4" /> Update Security Credentials
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PasswordSecuritySettings;
