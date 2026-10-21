import React from 'react';
import { User, Mail, Phone, Building, Save } from 'lucide-react';
import { DelayedLoader } from './common/DelayedLoader';
import { FormSettingsSkeleton } from './common/Skeletons';

interface UserAccountSettingsProps {
  user?: {
    name?: string;
    email?: string;
    phone?: string;
    division?: string;
    role?: string;
    avatarUrl?: string;
  };
  isLoading?: boolean;
  onSave?: (data: any) => Promise<void> | void;
}

export const UserAccountSettings: React.FC<UserAccountSettingsProps> = ({
  user,
  isLoading = false,
  onSave
}) => {
  if (isLoading) {
    return (
      <DelayedLoader delayMs={180} fallback={<div className="p-6 text-slate-500 font-mono text-xs">Initializing account settings...</div>}>
        <FormSettingsSkeleton />
      </DelayedLoader>
    );
  }

  return (
    <div className="p-6 max-w-4xl space-y-6 animate-fadeIn">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">User Account Profile</h2>
        <p className="text-xs text-slate-400 mt-1">
          Manage your personal real estate executive credentials and contact details.
        </p>
      </div>

      <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-5 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-amber-400" /> Full Name
            </label>
            <input
              type="text"
              defaultValue={user?.name || ''}
              placeholder="e.g. Director Alexander Wright"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-cyan-400" /> Official Email
            </label>
            <input
              type="email"
              defaultValue={user?.email || ''}
              placeholder="alexander@ctvill.com"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-400" /> Contact Phone
            </label>
            <input
              type="tel"
              defaultValue={user?.phone || '+63 917 889 2000'}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-400 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-indigo-400" /> Division / Department
            </label>
            <input
              type="text"
              defaultValue={user?.division || 'Commercial Operations'}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400 transition"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={() => onSave && onSave(user)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg transition cursor-pointer"
          >
            <Save className="w-4 h-4" /> Save Profile Details
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserAccountSettings;
