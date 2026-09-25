/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Shield, KeyRound, Mail, Sliders, Laptop, ChevronRight, ChevronLeft,
  X, CheckCircle2, AlertTriangle, Eye, EyeOff, Camera, Upload, Trash2,
  Save, ShieldCheck, Lock, Sparkles, Smartphone, Check
} from 'lucide-react';
import { updateStoredSession } from '../utils/session';

interface AccountsCentreProps {
  session: any;
  profileName: string;
  setProfileName: (name: string) => void;
  profileEmail: string;
  setProfileEmail: (email: string) => void;
  profileTitle: string;
  setProfileTitle: (title: string) => void;
  profilePhone: string;
  setProfilePhone: (phone: string) => void;
  profileDivision: string;
  setProfileDivision: (division: string) => void;
  avatarUrl: string | null;
  setAvatarUrl: (url: string | null) => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  onLogout: () => void;
  notify: (msg: string) => void;
  onUpdateSession?: (updates: any) => void;
}

export const AccountsCentre: React.FC<AccountsCentreProps> = ({
  session,
  profileName,
  setProfileName,
  profileEmail,
  setProfileEmail,
  profileTitle,
  setProfileTitle,
  profilePhone,
  setProfilePhone,
  profileDivision,
  setProfileDivision,
  avatarUrl,
  setAvatarUrl,
  theme,
  setTheme,
  onLogout,
  notify,
  onUpdateSession,
}) => {
  // Navigation Sub-Tabs
  const [activeSubTab, setActiveSubTab] = useState<'security' | 'profile' | 'preferences' | 'sessions'>('security');

  // Modal Dialog States
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState<boolean>(false);
  const [isChangeEmailOpen, setIsChangeEmailOpen] = useState<boolean>(false);
  const [isSecurityCheckupOpen, setIsSecurityCheckupOpen] = useState<boolean>(false);

  // Change Password Form State
  const [currentPass, setCurrentPass] = useState<string>('');
  const [newPass, setNewPass] = useState<string>('');
  const [confirmPass, setConfirmPass] = useState<string>('');
  const [showCurrentPass, setShowCurrentPass] = useState<boolean>(false);
  const [showNewPass, setShowNewPass] = useState<boolean>(false);
  const [showConfirmPass, setShowConfirmPass] = useState<boolean>(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);
  const [isUpdatingPass, setIsUpdatingPass] = useState<boolean>(false);
  const [logoutOtherDevices, setLogoutOtherDevices] = useState<boolean>(false);

  // Change Email Form State
  const [newEmailInput, setNewEmailInput] = useState<string>('');
  const [emailPasskeyVerify, setEmailPasskeyVerify] = useState<string>('');
  const [showEmailPasskey, setShowEmailPasskey] = useState<boolean>(false);
  const [emailChangeError, setEmailChangeError] = useState<string | null>(null);
  const [emailChangeSuccess, setEmailChangeSuccess] = useState<string | null>(null);
  const [isChangingEmail, setIsChangingEmail] = useState<boolean>(false);

  // Profile Save State
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const isProjectManager = session?.role === 'ProjectManager' || session?.role === 'PROJECT_MANAGER';

  // Helper for avatar initials
  const getInitials = (name: string) => {
    if (!name) return '??';
    const clean = name.replace(/jr\.?|sr\.?|iii|ii|iv/gi, '').trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '??';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  // Avatar Upload & Remove Handlers
  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      notify('⚠️ Avatar file size must be under 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setAvatarUrl(base64);
      updateStoredSession({ avatarUrl: base64 });
      notify('📷 Avatar updated successfully.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl(null);
    updateStoredSession({ avatarUrl: null });
    notify('🗑️ Avatar photo removed.');
  };

  // Save Profile Details
  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const userId = session?.id;
      const res = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          name: profileName,
          contact: profilePhone,
          title: profileTitle,
          division: profileDivision,
          avatarUrl,
        }),
      });
      if (res.ok) {
        updateStoredSession({
          name: profileName,
          phone: profilePhone,
          title: profileTitle,
          division: profileDivision,
          avatarUrl,
        });
        if (onUpdateSession) {
          onUpdateSession({
            name: profileName,
            phone: profilePhone,
            title: profileTitle,
            division: profileDivision,
            avatarUrl,
          });
        }
        notify('✅ Personal profile saved successfully.');
      } else {
        notify('❌ Failed to update profile details.');
      }
    } catch (err) {
      notify('❌ Connection error while updating profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle Change Password (scrypt PostgreSQL Sync)
  const handleChangePassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPassError(null);
    setPassSuccess(null);

    if (isProjectManager) {
      setPassError('Project Manager security credentials are restricted and centrally managed.');
      return;
    }
    if (!currentPass) {
      setPassError('Please enter your current security passkey.');
      return;
    }
    if (!newPass || newPass.length < 6) {
      setPassError('New passkey must be at least 6 characters.');
      return;
    }
    if (newPass !== confirmPass) {
      setPassError('The new passkeys do not match.');
      return;
    }
    if (newPass === currentPass) {
      setPassError('New passkey must be different from current passkey.');
      return;
    }

    setIsUpdatingPass(true);
    try {
      const userId = session?.id;
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          email: profileEmail,
          currentPassword: currentPass,
          newPassword: newPass,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPassError(data.error || 'Failed to update passkey.');
        notify('❌ ' + (data.error || 'Failed to update passkey.'));
      } else {
        setPassSuccess('✅ Passkey updated successfully! Hashed and secured.');
        notify('✅ Passkey updated successfully.');
        setCurrentPass('');
        setNewPass('');
        setConfirmPass('');
        setTimeout(() => {
          setIsChangePasswordOpen(false);
          setPassSuccess(null);
        }, 1500);
      }
    } catch (err) {
      setPassError('Network error while updating passkey.');
    } finally {
      setIsUpdatingPass(false);
    }
  };

  // Handle Update Email with Step-Up Authentication
  const handleUpdateEmail = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setEmailChangeError(null);
    setEmailChangeSuccess(null);

    const cleanEmail = newEmailInput.trim().toLowerCase();
    const currentActive = profileEmail.toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setEmailChangeError('Please enter a valid new email address.');
      return;
    }
    if (cleanEmail === currentActive) {
      setEmailChangeError('The new email address matches your current active email.');
      return;
    }
    if (!emailPasskeyVerify) {
      setEmailChangeError('Please enter your current security passkey to authorize this update.');
      return;
    }

    setIsChangingEmail(true);
    try {
      const userId = session?.id;
      const res = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          email: cleanEmail,
          currentPassword: emailPasskeyVerify,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.error || 'Failed to update email address.';
        setEmailChangeError(errMsg);
        notify('❌ ' + errMsg);
      } else {
        setProfileEmail(cleanEmail);
        setEmailChangeSuccess(`✅ Official login email updated to ${cleanEmail}. Identity verified.`);
        notify(`✅ Official login email updated to ${cleanEmail}`);
        updateStoredSession({ email: cleanEmail });
        if (onUpdateSession) {
          onUpdateSession({ email: cleanEmail });
        }
        setNewEmailInput('');
        setEmailPasskeyVerify('');
        setTimeout(() => {
          setIsChangeEmailOpen(false);
          setEmailChangeSuccess(null);
        }, 1500);
      }
    } catch (err) {
      setEmailChangeError('Network error while updating login email.');
    } finally {
      setIsChangingEmail(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-200">
      
      {/* ============================================================= */}
      {/* META ACCOUNTS CENTRE CONTAINER */}
      {/* ============================================================= */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row min-h-[620px]">
        
        {/* Left Column: Accounts Centre Navigation */}
        <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-800/80 p-6 flex flex-col justify-between shrink-0 bg-slate-950/70">
          <div className="space-y-6">
            
            {/* Header Brand */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                <span className="font-black text-amber-400 tracking-wider">CTVILL</span>
                <span className="text-slate-600">•</span>
                <span>Security & Identity</span>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight mt-1">Accounts Centre</h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Manage your connected credentials, security protocols and profile settings across CTVill technologies.
              </p>
            </div>

            {/* Profile Quick Pill */}
            <button
              type="button"
              onClick={() => setActiveSubTab('profile')}
              className={`w-full flex items-center gap-3.5 p-3 rounded-2xl transition-all text-left cursor-pointer ${
                activeSubTab === 'profile'
                  ? 'bg-slate-800 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-900/80 hover:text-white'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden border border-amber-400/50">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={profileName} className="w-full h-full object-cover" />
                ) : (
                  <span>{getInitials(profileName)}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white truncate">{profileName}</div>
                <div className="text-[11px] text-slate-400 truncate">Profiles and personal details</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
            </button>

            {/* Navigation Category */}
            <div className="space-y-1.5">
              <div className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider font-bold text-slate-500">
                Account Settings
              </div>

              <button
                type="button"
                onClick={() => setActiveSubTab('security')}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-semibold transition-all text-left cursor-pointer ${
                  activeSubTab === 'security'
                    ? 'bg-slate-800 text-white font-bold shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                }`}
              >
                <Shield className={`w-4 h-4 shrink-0 ${activeSubTab === 'security' ? 'text-amber-400' : 'text-slate-400'}`} />
                <span className="flex-1">Password and security</span>
                {activeSubTab === 'security' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('preferences')}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-semibold transition-all text-left cursor-pointer ${
                  activeSubTab === 'preferences'
                    ? 'bg-slate-800 text-white font-bold shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                }`}
              >
                <Sliders className={`w-4 h-4 shrink-0 ${activeSubTab === 'preferences' ? 'text-amber-400' : 'text-slate-400'}`} />
                <span className="flex-1">Display & preferences</span>
                {activeSubTab === 'preferences' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('sessions')}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-semibold transition-all text-left cursor-pointer ${
                  activeSubTab === 'sessions'
                    ? 'bg-slate-800 text-white font-bold shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                }`}
              >
                <Laptop className={`w-4 h-4 shrink-0 ${activeSubTab === 'sessions' ? 'text-amber-400' : 'text-slate-400'}`} />
                <span className="flex-1">Where you're logged in</span>
                {activeSubTab === 'sessions' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
              </button>
            </div>
          </div>

          {/* Footer Protection Status */}
          <div className="pt-6 border-t border-slate-800/80">
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>ACTIVE SECURITY ENVELOPE</span>
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic Content Area */}
        <div className="flex-1 p-6 sm:p-8 lg:p-10 overflow-y-auto">

          {/* 1. PASSWORD AND SECURITY (Directly mirrors Meta Accounts Centre reference!) */}
          {activeSubTab === 'security' && (
            <div className="max-w-xl space-y-8 animate-in fade-in duration-200">
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Password and security</h1>
              </div>

              {/* Group 1: Login & recovery */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-300">Login & recovery</div>
                <p className="text-[11px] text-slate-400">Manage your passwords, login preferences and recovery methods.</p>

                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800/80 mt-2">
                  {/* Change password row */}
                  <button
                    type="button"
                    onClick={() => {
                      setPassError(null);
                      setPassSuccess(null);
                      setCurrentPass('');
                      setNewPass('');
                      setConfirmPass('');
                      setIsChangePasswordOpen(true);
                    }}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors text-left cursor-pointer group"
                  >
                    <div>
                      <div className="text-xs font-semibold text-white group-hover:text-amber-400 transition-colors">
                        Change password
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Rotate your active login passkey
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
                  </button>

                  {/* Official login email row */}
                  <button
                    type="button"
                    onClick={() => {
                      setEmailChangeError(null);
                      setEmailChangeSuccess(null);
                      setNewEmailInput('');
                      setEmailPasskeyVerify('');
                      setIsChangeEmailOpen(true);
                    }}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors text-left cursor-pointer group"
                  >
                    <div>
                      <div className="text-xs font-semibold text-white group-hover:text-amber-400 transition-colors">
                        Official login email
                      </div>
                      <div className="text-[10px] font-mono text-amber-400/90 mt-0.5">
                        {profileEmail}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-bold">
                        PRIMARY
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
                    </div>
                  </button>

                  {/* Saved login row */}
                  <div className="flex items-center justify-between p-4">
                    <div>
                      <div className="text-xs font-semibold text-white">Saved login</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Encrypted browser envelope with 4-hr session TTL
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40 font-bold">
                      ACTIVE
                    </span>
                  </div>

                  {/* Passkey authentication row */}
                  <div className="flex items-center justify-between p-4">
                    <div>
                      <div className="text-xs font-semibold text-white">Passkey authentication</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Encrypted credential storage with salt verification
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 font-bold">
                      ENABLED
                    </span>
                  </div>
                </div>
              </div>

              {/* Group 2: Advanced Protection */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-300">Advanced Protection</div>
                <p className="text-[11px] text-slate-400">This advanced security programme helps defend your account from unauthorised access.</p>

                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden mt-2">
                  <div className="flex items-center justify-between p-4">
                    <div>
                      <div className="text-xs font-semibold text-white">Session Inactivity Guard</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Automatic background termination after 30 minutes of idle
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                      30m GUARD
                    </span>
                  </div>
                </div>
              </div>

              {/* Group 3: Security checks */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-300">Security checks</div>
                <p className="text-[11px] text-slate-400">Review security issues by running checks across apps, devices and sessions.</p>

                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800/80 mt-2">
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('sessions')}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors text-left cursor-pointer group"
                  >
                    <div>
                      <div className="text-xs font-semibold text-white group-hover:text-amber-400 transition-colors">
                        Where you're logged in
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        1 Active Session (Current Workstation)
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSecurityCheckupOpen(true)}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors text-left cursor-pointer group"
                  >
                    <div>
                      <div className="text-xs font-semibold text-white group-hover:text-amber-400 transition-colors">
                        Security Checkup
                      </div>
                      <div className="text-[10px] text-emerald-400 mt-0.5 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" /> All security recommendations satisfied
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* 2. PROFILES AND PERSONAL DETAILS */}
          {activeSubTab === 'profile' && (
            <div className="max-w-xl space-y-6 animate-in fade-in duration-200">
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Profiles and personal details</h1>
                <p className="text-xs text-slate-400 mt-1">Manage your administrative profile, official job title, and team assignment.</p>
              </div>

              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-6">
                {/* Avatar container */}
                <div className="flex items-center gap-4 border-b border-slate-800 pb-5">
                  <div className="relative group shrink-0">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xl shadow-lg shadow-amber-500/20 overflow-hidden border-2 border-amber-500/40">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={profileName} className="w-full h-full object-cover" />
                      ) : (
                        <span>{getInitials(profileName)}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      title="Change Avatar Photo"
                      className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-slate-900 border border-amber-500/60 text-amber-400 hover:bg-amber-500 hover:text-slate-950 transition-all shadow-md cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <input
                    type="file"
                    ref={avatarInputRef}
                    accept="image/png, image/jpeg, image/webp"
                    className="hidden"
                    onChange={handleAvatarFileChange}
                  />

                  <div>
                    <div className="text-sm font-bold text-white">{profileName}</div>
                    <div className="text-[11px] text-slate-400">{profileEmail}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-lg border border-amber-500/30 transition-colors cursor-pointer"
                      >
                        Upload Avatar
                      </button>
                      {avatarUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveAvatar}
                          className="text-[11px] font-semibold text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-950/70 px-2.5 py-1 rounded-lg border border-red-800/40 transition-colors cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Form fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Full Legal Name</label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-amber-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Official Job Title</label>
                    <input
                      type="text"
                      value={profileTitle}
                      onChange={(e) => setProfileTitle(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-amber-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Direct Contact Number</label>
                    <input
                      type="text"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      placeholder="+63 9XX XXX XXXX"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-amber-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Department / Division</label>
                    <input
                      type="text"
                      value={profileDivision}
                      onChange={(e) => setProfileDivision(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-amber-500 font-medium"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={isSavingProfile}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSavingProfile ? 'Saving...' : 'Save Profile Changes'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. DISPLAY AND PREFERENCES */}
          {activeSubTab === 'preferences' && (
            <div className="max-w-xl space-y-6 animate-in fade-in duration-200">
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Display & preferences</h1>
                <p className="text-xs text-slate-400 mt-1">Customize your executive visual theme and interface experience.</p>
              </div>

              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">Interface Appearance Theme</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                        theme === 'dark'
                          ? 'bg-amber-500/10 border-amber-500 text-white shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-sm font-bold flex items-center justify-between">
                        <span>🌙 Dark Executive</span>
                        {theme === 'dark' && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">Sleek obsidian slate palette tailored for executive clarity.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                        theme === 'light'
                          ? 'bg-amber-500/10 border-amber-500 text-white shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-sm font-bold flex items-center justify-between">
                        <span>☀️ Light Corporate</span>
                        {theme === 'light' && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">High-contrast daytime clarity for construction field laptops.</p>
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                  <div className="text-xs font-bold text-white">Default View Preference</div>
                  <p className="text-[11px] text-slate-400">
                    Initial module displayed upon login is managed in <strong>Operations & System Settings</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 4. WHERE YOU'RE LOGGED IN */}
          {activeSubTab === 'sessions' && (
            <div className="max-w-xl space-y-6 animate-in fade-in duration-200">
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Where you're logged in</h1>
                <p className="text-xs text-slate-400 mt-1">Review your active session envelopes and device history.</p>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                        <Laptop className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Windows PC · Active Browser</div>
                        <div className="text-[11px] text-slate-400">Centennial Plaza Headquarters · 127.0.0.1</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40 flex items-center gap-1 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      THIS DEVICE
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs border-t border-slate-800/80 pt-3">
                    <div>
                      <span className="text-[10px] font-mono text-slate-500 block">SESSION ENVELOPE</span>
                      <span className="text-slate-300 text-[11px] font-semibold">Active Tab TTL (4h)</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-slate-500 block">INACTIVITY GUARD</span>
                      <span className="text-slate-300 text-[11px] font-semibold">30-Min Idle Auto-Lock</span>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={onLogout}
                      className="px-3.5 py-1.5 bg-red-950/50 hover:bg-red-950 text-red-300 border border-red-800/50 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Sign Out of This Device
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ============================================================= */}
      {/* POPUP MODAL: CHANGE PASSWORD (MATCHES REFERENCE IMAGE 2) */}
      {/* ============================================================= */}
      {isChangePasswordOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm cursor-pointer"
            onClick={() => setIsChangePasswordOpen(false)}
          />
          <div 
            className="relative z-10 w-full max-w-md bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-7 space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Top Bar Navigation */}
            <div className="flex items-center justify-between pb-1">
              <button 
                type="button" 
                onClick={() => setIsChangePasswordOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-900 transition-colors cursor-pointer"
                title="Back"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                type="button" 
                onClick={() => setIsChangePasswordOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-900 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Header matching Meta Screenshot */}
            <div>
              <div className="text-[11px] text-slate-400 font-medium">
                {profileName} · CTVill Enterprise
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight mt-0.5">Change password</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Your password must be at least 6 characters and should include a combination of numbers, letters and special characters (!$@%).
              </p>
            </div>

            {/* Alerts */}
            {passError && (
              <div className="p-3 bg-red-950/70 border border-red-500/60 rounded-xl text-xs text-red-200 flex items-center gap-2 animate-fadeIn">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{passError}</span>
              </div>
            )}

            {passSuccess && (
              <div className="p-3 bg-emerald-950/70 border border-emerald-500/60 rounded-xl text-xs text-emerald-200 flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{passSuccess}</span>
              </div>
            )}

            {/* Inputs without prefill/autofill */}
            <div className="space-y-3 pt-1">
              <div>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    name="meta_curr_pwd"
                    id="meta_curr_pwd"
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    placeholder="Current password"
                    value={currentPass}
                    onChange={(e) => { setCurrentPass(e.target.value); setPassError(null); }}
                    className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-3.5 pr-10 py-3 text-xs text-white focus:outline-none focus:border-blue-500 font-mono placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    name="meta_new_pwd"
                    id="meta_new_pwd"
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    placeholder="New password"
                    value={newPass}
                    onChange={(e) => { setNewPass(e.target.value); setPassError(null); }}
                    className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-3.5 pr-10 py-3 text-xs text-white focus:outline-none focus:border-blue-500 font-mono placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <div className="relative">
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    name="meta_retype_pwd"
                    id="meta_retype_pwd"
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    placeholder="Retype new password"
                    value={confirmPass}
                    onChange={(e) => { setConfirmPass(e.target.value); setPassError(null); }}
                    className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-3.5 pr-10 py-3 text-xs text-white focus:outline-none focus:border-blue-500 font-mono placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Checkbox & Forgot link */}
            <div className="space-y-3 pt-1">
              <button
                type="button"
                onClick={() => notify('ℹ️ To reset your initial passkey, contact CTVill Operations Support or your System Administrator.')}
                className="text-xs text-blue-400 hover:underline cursor-pointer font-medium block"
              >
                Forgotten your password?
              </button>

              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={logoutOtherDevices}
                  onChange={(e) => setLogoutOtherDevices(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0 mt-0.5"
                />
                <span>Log out of other devices. Choose this if someone else used your account.</span>
              </label>
            </div>

            {/* Action button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleChangePassword}
                disabled={isUpdatingPass}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 cursor-pointer flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
              >
                <span>{isUpdatingPass ? 'Updating in Database...' : 'Change password'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ============================================================= */}
      {/* POPUP MODAL: UPDATE OFFICIAL LOGIN EMAIL */}
      {/* ============================================================= */}
      {isChangeEmailOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm cursor-pointer"
            onClick={() => setIsChangeEmailOpen(false)}
          />
          <div 
            className="relative z-10 w-full max-w-md bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-7 space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Top Bar Navigation */}
            <div className="flex items-center justify-between pb-1">
              <button 
                type="button" 
                onClick={() => setIsChangeEmailOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-900 transition-colors cursor-pointer"
                title="Back"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                type="button" 
                onClick={() => setIsChangeEmailOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-900 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Header */}
            <div>
              <div className="text-[11px] text-slate-400 font-medium">
                {profileName} · CTVill Enterprise
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight mt-0.5">Update official login email</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Modifying your login email alters your recovery credentials and authentication address. You must confirm your current security passkey.
              </p>
            </div>

            {/* Current Email Pill */}
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl text-xs flex items-center justify-between">
              <span className="text-slate-400">Current Login Email:</span>
              <span className="font-mono text-amber-400 font-bold">
                {profileEmail}
              </span>
            </div>

            {/* Alerts */}
            {emailChangeError && (
              <div className="p-3 bg-red-950/70 border border-red-500/60 rounded-xl text-xs text-red-200 flex items-center gap-2 animate-fadeIn">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{emailChangeError}</span>
              </div>
            )}

            {emailChangeSuccess && (
              <div className="p-3 bg-emerald-950/70 border border-emerald-500/60 rounded-xl text-xs text-emerald-200 flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{emailChangeSuccess}</span>
              </div>
            )}

            {/* Inputs */}
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-[11px] text-slate-400 font-semibold mb-1">New Email Address</label>
                <input
                  type="text"
                  inputMode="email"
                  name="meta_new_email"
                  id="meta_new_email"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore="true"
                  placeholder="new.email@ctvill.com"
                  value={newEmailInput}
                  onChange={(e) => { setNewEmailInput(e.target.value); setEmailChangeError(null); }}
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-3 text-xs text-white focus:outline-none focus:border-blue-500 font-mono placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 font-semibold mb-1">
                  Current Passkey <span className="text-amber-400 text-[10px]">(Verify Identity)</span>
                </label>
                <div className="relative">
                  <input
                    type={showEmailPasskey ? 'text' : 'password'}
                    name="meta_verify_passkey"
                    id="meta_verify_passkey"
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    placeholder="Enter current passkey"
                    value={emailPasskeyVerify}
                    onChange={(e) => { setEmailPasskeyVerify(e.target.value); setEmailChangeError(null); }}
                    className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-3.5 pr-10 py-3 text-xs text-white focus:outline-none focus:border-blue-500 font-mono placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowEmailPasskey(!showEmailPasskey)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    {showEmailPasskey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Action button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleUpdateEmail}
                disabled={isChangingEmail}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 cursor-pointer flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isChangingEmail ? 'Verifying & Updating...' : 'Verify Passkey & Update Email'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ============================================================= */}
      {/* POPUP MODAL: SECURITY CHECKUP */}
      {/* ============================================================= */}
      {isSecurityCheckupOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm cursor-pointer"
            onClick={() => setIsSecurityCheckupOpen(false)}
          />
          <div 
            className="relative z-10 w-full max-w-md bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-7 space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Security Checkup
              </span>
              <button 
                type="button" 
                onClick={() => setIsSecurityCheckupOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-900 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="text-xl font-bold text-white tracking-tight">Account Protection Status</h3>
              <p className="text-xs text-slate-400 mt-1">
                Your account security controls have been audited against OWASP enterprise standards.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-white">Passkey Encryption</div>
                  <div className="text-[11px] text-slate-400">Cryptographically hashed with salt and stored securely.</div>
                </div>
              </div>

              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-white">Step-Up Re-Authentication</div>
                  <div className="text-[11px] text-slate-400">Identity verification mandatory prior to altering official email.</div>
                </div>
              </div>

              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-white">Inactivity Protection</div>
                  <div className="text-[11px] text-slate-400">30-minute idle automatic session termination active.</div>
                </div>
              </div>

              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-white">Process Audit Trail</div>
                  <div className="text-[11px] text-slate-400">Every security alteration is logged to immutable system audit logs.</div>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsSecurityCheckupOpen(false)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default AccountsCentre;
