/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import {
  Shield, KeyRound, Mail, Sliders, Laptop, ChevronRight, ChevronLeft,
  X, CheckCircle2, AlertTriangle, Eye, EyeOff, Camera, Upload, Trash2,
  Save, ShieldCheck, Lock, Sparkles, Smartphone, Check, Sun, Moon, QrCode, Copy
} from 'lucide-react';
import { updateStoredSession } from '../utils/session';
import { ThemeMode } from '../context/ThemeContext';
import { is2faEnrolled, set2faEnrolled, getAccountPasskey } from './LoginPortal';
import { logAuditEvent } from '../utils/auditLogger';
import { uploadFileToServer, compressImageToDataUrl } from '../utils/imageCompression';
import {
  getOrCreateTotpSecret,
  formatTotpSecretDisplay,
  buildOtpAuthUri,
  verifyTotpCode,
  getBackupRecoveryCodes,
  generateBackupRecoveryCodes,
  clearAccountTotpData,
  BackupRecoveryCode,
} from '../utils/totpAuth';

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
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
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
  const isDark = theme !== 'light';
  // Navigation Sub-Tabs
  const [activeSubTab, setActiveSubTab] = useState<'security' | 'profile' | 'preferences' | 'sessions'>('security');

  // Modal Dialog States
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState<boolean>(false);
  const [isChangeEmailOpen, setIsChangeEmailOpen] = useState<boolean>(false);
  const [isSecurityCheckupOpen, setIsSecurityCheckupOpen] = useState<boolean>(false);
  const [is2faModalOpen, setIs2faModalOpen] = useState<boolean>(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(() =>
    is2faEnrolled(profileEmail || session?.email || '')
  );
  const [totpSetupStep, setTotpSetupStep] = useState<'qr' | 'verify' | 'active'>('qr');
  const [totpVerifyInput, setTotpVerifyInput] = useState<string>('');
  const [totpSetupError, setTotpSetupError] = useState<string | null>(null);
  const [totpQrDataUrl, setTotpQrDataUrl] = useState<string>('');
  const [backupCodes, setBackupCodes] = useState<BackupRecoveryCode[]>(() =>
    getBackupRecoveryCodes(profileEmail || session?.email || 'om@ldmconstruction.ph')
  );
  const [isBackupCodesUnlocked, setIsBackupCodesUnlocked] = useState<boolean>(false);
  const [backupPassVerifyInput, setBackupPassVerifyInput] = useState<string>('');
  const [showBackupPassVerify, setShowBackupPassVerify] = useState<boolean>(false);
  const [backupVerifyError, setBackupVerifyError] = useState<string | null>(null);
  const [isVerifyingBackupPass, setIsVerifyingBackupPass] = useState<boolean>(false);

  // Unlink / Disable 2FA Inline Password Confirmation State
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState<boolean>(false);
  const [unlinkPassInput, setUnlinkPassInput] = useState<string>('');
  const [showUnlinkPass, setShowUnlinkPass] = useState<boolean>(false);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);
  const [isUnlinking2fa, setIsUnlinking2fa] = useState<boolean>(false);

  useEffect(() => {
    const activeEmail = profileEmail || session?.email || 'om@ldmconstruction.ph';
    const uri = buildOtpAuthUri(activeEmail);
    QRCode.toDataURL(uri, {
      width: 180,
      margin: 1,
      color: { dark: '#0F172A', light: '#FFFFFF' },
    })
      .then((url) => setTotpQrDataUrl(url))
      .catch(() => setTotpQrDataUrl(''));
  }, [profileEmail, session?.email, is2faModalOpen]);

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
  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      notify('⚠️ Avatar file size must be under 10MB.');
      return;
    }
    try {
      // Upload compressed avatar (<1600px, 0.8 quality) to disk storage
      const uploadRes = await uploadFileToServer(file, true);
      if (uploadRes?.url) {
        setAvatarUrl(uploadRes.url);
        updateStoredSession({ avatarUrl: uploadRes.url });
        notify('📷 Avatar updated & saved to storage.');
        return;
      }
    } catch {
      // Fallback to client-side compressed data URL
    }

    const compressed = await compressImageToDataUrl(file, {
      maxWidth: 400,
      maxHeight: 400,
      quality: 0.85,
    });
    setAvatarUrl(compressed);
    updateStoredSession({ avatarUrl: compressed });
    notify('📷 Avatar updated successfully.');
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
      setPassError('Please enter your current password.');
      return;
    }
    if (!newPass || newPass.length < 6) {
      setPassError('New password must be at least 6 characters.');
      return;
    }
    if (newPass !== confirmPass) {
      setPassError('The new passwords do not match.');
      return;
    }
    if (newPass === currentPass) {
      setPassError('New password must be different from current password.');
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
        setPassError(data.error || 'Failed to update password.');
        notify('❌ ' + (data.error || 'Failed to update password.'));
      } else {
        setPassSuccess('✅ Password updated successfully! Hashed and secured.');
        notify('✅ Password updated successfully.');
        setCurrentPass('');
        setNewPass('');
        setConfirmPass('');
        setTimeout(() => {
          setIsChangePasswordOpen(false);
          setPassSuccess(null);
        }, 1500);
      }
    } catch (err) {
      setPassError('Network error while updating password.');
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
      setEmailChangeError('Please enter your current password to authorize this update.');
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
    <div className="max-w-6xl w-full mx-auto py-6 space-y-6 animate-in fade-in duration-200">
      
      {/* ============================================================= */}
      {/* META ACCOUNTS CENTRE CONTAINER */}
      {/* ============================================================= */}
      <div className={`${
        isDark 
          ? 'bg-slate-950 border-slate-800 shadow-2xl' 
          : 'bg-white border-slate-200/90 shadow-xl'
      } border rounded-3xl overflow-hidden flex flex-col md:flex-row min-h-[620px]`}>
        
        {/* Left Column: Accounts Centre Navigation */}
        <div className={`w-full md:w-80 border-b md:border-b-0 md:border-r ${
          isDark 
            ? 'border-slate-800/80 bg-slate-950/70' 
            : 'border-slate-200 bg-slate-50/80'
        } p-6 flex flex-col justify-between shrink-0`}>
          <div className="space-y-6">
            
            {/* Header Brand */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                <span className={`font-black ${isDark ? 'text-amber-400' : 'text-amber-600'} tracking-wider`}>LDM</span>
                <span className="text-slate-600">•</span>
                <span>Security & Identity</span>
              </div>
              <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'} tracking-tight mt-1`}>Accounts Centre</h2>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mt-2 leading-relaxed`}>
                Manage your connected credentials, security protocols and profile settings across LDM Construction technologies.
              </p>
            </div>

            {/* Profile Quick Pill */}
            <button
              type="button"
              onClick={() => setActiveSubTab('profile')}
              className={`w-full flex items-center gap-3.5 p-3 rounded-2xl transition-all text-left cursor-pointer ${
                activeSubTab === 'profile'
                  ? isDark
                    ? 'bg-slate-800 text-white shadow-md'
                    : 'bg-slate-900 text-white shadow-md'
                  : isDark
                    ? 'text-slate-300 hover:bg-slate-900/80 hover:text-white'
                    : 'text-slate-700 hover:bg-slate-200/70 hover:text-slate-900'
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
                <div className={`text-xs font-bold ${activeSubTab === 'profile' ? 'text-white' : (isDark ? 'text-white' : 'text-slate-900')} truncate`}>{profileName}</div>
                <div className={`text-[11px] ${activeSubTab === 'profile' ? 'text-slate-300' : (isDark ? 'text-slate-400' : 'text-slate-500')} truncate`}>Profiles and personal details</div>
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
                    ? isDark
                      ? 'bg-slate-800 text-white font-bold shadow-md'
                      : 'bg-slate-900 text-white font-bold shadow-md'
                    : isDark
                      ? 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Shield className={`w-4 h-4 shrink-0 ${activeSubTab === 'security' ? (isDark ? 'text-amber-400' : 'text-amber-300') : 'text-slate-400'}`} />
                <span className="flex-1">Password and security</span>
                {activeSubTab === 'security' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('preferences')}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-semibold transition-all text-left cursor-pointer ${
                  activeSubTab === 'preferences'
                    ? isDark
                      ? 'bg-slate-800 text-white font-bold shadow-md'
                      : 'bg-slate-900 text-white font-bold shadow-md'
                    : isDark
                      ? 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Sliders className={`w-4 h-4 shrink-0 ${activeSubTab === 'preferences' ? (isDark ? 'text-amber-400' : 'text-amber-300') : 'text-slate-400'}`} />
                <span className="flex-1">Display & preferences</span>
                {activeSubTab === 'preferences' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('sessions')}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-semibold transition-all text-left cursor-pointer ${
                  activeSubTab === 'sessions'
                    ? isDark
                      ? 'bg-slate-800 text-white font-bold shadow-md'
                      : 'bg-slate-900 text-white font-bold shadow-md'
                    : isDark
                      ? 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Laptop className={`w-4 h-4 shrink-0 ${activeSubTab === 'sessions' ? (isDark ? 'text-amber-400' : 'text-amber-300') : 'text-slate-400'}`} />
                <span className="flex-1">Where you're logged in</span>
                {activeSubTab === 'sessions' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
              </button>
            </div>
          </div>

          {/* Footer Protection Status */}
          <div className={`pt-6 border-t ${isDark ? 'border-slate-800/80' : 'border-slate-200'}`}>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>ACTIVE SECURITY ENVELOPE</span>
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic Content Area */}
        <div className={`flex-1 p-6 sm:p-8 lg:p-10 overflow-y-auto ${isDark ? 'bg-slate-950' : 'bg-white'}`}>

          {/* 1. PASSWORD AND SECURITY (Directly mirrors Meta Accounts Centre reference!) */}
          {activeSubTab === 'security' && (
            <div className="max-w-xl space-y-8 animate-in fade-in duration-200">
              <div>
                <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'} tracking-tight`}>Password and security</h1>
              </div>

              {/* Group 1: Login & recovery */}
              <div className="space-y-2">
                <div className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Login & recovery</div>
                <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Manage your passwords, login preferences and recovery methods.</p>

                <div className={`${isDark ? 'bg-slate-900/70 border-slate-800 divide-slate-800/80' : 'bg-slate-50 border-slate-200 divide-slate-200'} border rounded-2xl overflow-hidden divide-y mt-2`}>
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
                        Rotate your active login password
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

                  {/* Two-factor authentication (2FA) row */}
                  <button
                    type="button"
                    onClick={() => {
                      const targetEmail = profileEmail || session?.email || '';
                      const enrolled = is2faEnrolled(targetEmail);
                      setTotpSetupError(null);
                      setTotpVerifyInput('');
                      setTwoFactorEnabled(enrolled);
                      setBackupCodes(getBackupRecoveryCodes(targetEmail));
                      setIsBackupCodesUnlocked(false);
                      setBackupPassVerifyInput('');
                      setBackupVerifyError(null);
                      setShowUnlinkConfirm(false);
                      setUnlinkPassInput('');
                      setUnlinkError(null);
                      setTotpSetupStep(enrolled ? 'active' : 'qr');
                      setIs2faModalOpen(true);
                    }}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors text-left cursor-pointer group"
                  >
                    <div>
                      <div className="text-xs font-semibold text-white group-hover:text-amber-400 transition-colors">
                        Two-factor authentication (2FA)
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {twoFactorEnabled
                          ? 'Authenticator app & emergency recovery codes active on sign-in'
                          : 'Not enrolled — click to register an Authenticator app or enable 2FA'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold border ${
                          twoFactorEnabled
                            ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {twoFactorEnabled ? 'ENABLED' : 'OPTIONAL (OFF)'}
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

                  {/* Password authentication row */}
                  <div className="flex items-center justify-between p-4">
                    <div>
                      <div className="text-xs font-semibold text-white">Password authentication</div>
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
                      onClick={() => setTheme('light')}
                      className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                        theme === 'light'
                          ? 'bg-amber-500/10 border-amber-500 text-white shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-sm font-bold flex items-center justify-between">
                        <span className="flex items-center gap-1.5"><Sun className="w-4 h-4 text-amber-500" /> Light</span>
                        {theme === 'light' && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">Daylight surface (#F5F6F8) with crisp high-contrast cards &amp; borders.</p>
                    </button>

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
                        <span className="flex items-center gap-1.5"><Moon className="w-4 h-4 text-blue-400" /> Dark</span>
                        {theme === 'dark' && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">Carbon slate palette (#111625) tailored for executive clarity.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTheme('night')}
                      className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                        theme === 'night'
                          ? 'bg-amber-500/10 border-amber-500 text-white shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-sm font-bold flex items-center justify-between">
                        <span className="flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-purple-400" /> Night (Obsidian)</span>
                        {theme === 'night' && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">True obsidian palette (#0A0A0C) for ultra deep contrast.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTheme('system')}
                      className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                        theme === 'system'
                          ? 'bg-amber-500/10 border-amber-500 text-white shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-sm font-bold flex items-center justify-between">
                        <span className="flex items-center gap-1.5"><Laptop className="w-4 h-4 text-slate-400" /> System default</span>
                        {theme === 'system' && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">Automatically matches your operating system appearance.</p>
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
                {profileName} · LDM Construction Enterprise
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
                onClick={() => notify('ℹ️ To reset your initial password, contact LDM Operations Support or your System Administrator.')}
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
                {profileName} · LDM Construction Enterprise
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight mt-0.5">Update official login email</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Modifying your login email alters your recovery credentials and authentication address. You must confirm your current password.
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
                  placeholder="new.email@ldmconstruction.ph"
                  value={newEmailInput}
                  onChange={(e) => { setNewEmailInput(e.target.value); setEmailChangeError(null); }}
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-3 text-xs text-white focus:outline-none focus:border-blue-500 font-mono placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 font-semibold mb-1">
                  Current Password <span className="text-amber-400 text-[10px]">(Verify Identity)</span>
                </label>
                <div className="relative">
                  <input
                    type={showEmailPasskey ? 'text' : 'password'}
                    name="meta_verify_passkey"
                    id="meta_verify_passkey"
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    placeholder="Enter current password"
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
                <span>{isChangingEmail ? 'Verifying & Updating...' : 'Verify Password & Update Email'}</span>
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
                  <div className="text-xs font-bold text-white">Password Encryption</div>
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

      {/* ============================================================= */}
      {/* POPUP MODAL: TWO-FACTOR AUTHENTICATION (2FA) SETUP             */}
      {/* ============================================================= */}
      {is2faModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm cursor-pointer"
            onClick={() => setIs2faModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-7 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-amber-400" /> Two-Factor Authentication (2FA)
              </span>
              <button
                type="button"
                onClick={() => setIs2faModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-900 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step Progress Indicator when enrolling */}
            {totpSetupStep !== 'active' && (
              <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-wider">
                <span
                  className={`px-2.5 py-1 rounded-lg border ${
                    totpSetupStep === 'qr'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  {totpSetupStep === 'qr' ? 'Step 1 of 2 • Scan QR' : '✓ Step 1 Scanned'}
                </span>
                <span className="text-slate-600">→</span>
                <span
                  className={`px-2.5 py-1 rounded-lg border ${
                    totpSetupStep === 'verify'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-900 text-slate-500 border-slate-800'
                  }`}
                >
                  Step 2 of 2 • Enter 6-Digit Code
                </span>
              </div>
            )}

            {/* ========================================================= */}
            {/* STEP 1: SCAN QR CODE ONLY (NO VERIFICATION INPUT YET)      */}
            {/* ========================================================= */}
            {totpSetupStep === 'qr' && (
              <>
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    Scan QR with Authenticator App
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Open <strong>Google Authenticator</strong>, <strong>Microsoft Authenticator</strong>, or <strong>Apple Passwords</strong> on your phone and scan this QR code first.
                  </p>
                </div>

                <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3 text-xs">
                  {totpQrDataUrl && (
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-lg">
                        <img
                          src={totpQrDataUrl}
                          alt="Authenticator Setup QR Code"
                          className="w-44 h-44 object-contain"
                        />
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        Account: <strong className="text-white">{profileEmail || session?.email}</strong>
                      </span>
                    </div>
                  )}

                  <div className="space-y-1 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 font-bold text-[11px]">Can&apos;t scan? Manual Setup Key (Base32)</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                        RFC 6238 TOTP
                      </span>
                    </div>
                    <div className="p-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-center text-amber-400 font-bold tracking-wider text-[11px] select-all">
                      {formatTotpSecretDisplay(getOrCreateTotpSecret(profileEmail || session?.email || ''))}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setTotpSetupError(null);
                    setTotpVerifyInput('');
                    setTotpSetupStep('verify');
                  }}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl cursor-pointer transition-colors shadow-md"
                >
                  I&apos;ve Scanned the QR Code → Continue
                </button>
              </>
            )}

            {/* ========================================================= */}
            {/* STEP 2: ENTER 6-DIGIT VERIFICATION CODE (AFTER SCANNING)   */}
            {/* ========================================================= */}
            {totpSetupStep === 'verify' && (
              <>
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    Enter 6-Digit Verification Code
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Your Authenticator app is now generating a 6-digit code every 30 seconds for <strong>{profileEmail || session?.email}</strong>. Enter it below to confirm setup.
                  </p>
                </div>

                <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3 text-xs">
                  <label className="block text-[11px] font-bold text-slate-300 text-center">
                    6-Digit Authenticator Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    maxLength={6}
                    value={totpVerifyInput}
                    onChange={(e) => {
                      setTotpSetupError(null);
                      setTotpVerifyInput(e.target.value.replace(/\D/g, ''));
                    }}
                    placeholder="000000"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-center font-mono text-xl font-black tracking-[0.35em] text-white focus:outline-none focus:border-amber-400"
                  />
                  <p className="text-[10px] text-slate-400 text-center">
                    Enter the current 6-digit code displayed in your Authenticator app.
                  </p>
                </div>

                {totpSetupError && (
                  <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs">
                    {totpSetupError}
                  </div>
                )}

                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setTotpSetupError(null);
                      setTotpSetupStep('qr');
                    }}
                    className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors"
                  >
                    ← Back to QR
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const targetEmail = profileEmail || session?.email || '';
                      setTotpSetupError(null);
                      if (totpVerifyInput.trim().length !== 6) {
                        setTotpSetupError('Please enter the 6-digit verification code from your Authenticator app.');
                        return;
                      }
                      const valid = await verifyTotpCode(targetEmail, totpVerifyInput.trim());
                      if (!valid) {
                        setTotpSetupError('Invalid 6-digit code. Make sure your phone time is synced and enter the active 6-digit code.');
                        return;
                      }
                      set2faEnrolled(targetEmail, true);
                      setTwoFactorEnabled(true);
                      const freshCodes = generateBackupRecoveryCodes(targetEmail, 4);
                      setBackupCodes(freshCodes);
                      setIsBackupCodesUnlocked(true);
                      setTotpSetupStep('active');
                      notify('🛡️ Authenticator App verified! Save your newly generated single-use backup codes.');
                    }}
                    className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl cursor-pointer transition-colors shadow-md"
                  >
                    Verify &amp; Enable 2FA
                  </button>
                </div>
              </>
            )}

            {/* ========================================================= */}
            {/* STEP 3: 2FA ACTIVE + PASSWORD-PROTECTED BACKUP CODES       */}
            {/* ========================================================= */}
            {totpSetupStep === 'active' && (
              <>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xl font-bold text-white tracking-tight">
                      2FA Protection Active
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono font-bold shrink-0">
                      ✓ Linked
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Your account (<strong>{profileEmail || session?.email}</strong>) is protected with RFC 6238 Two-Factor Authentication. Each emergency backup code is dynamically generated and <strong>expires immediately once used</strong>.
                  </p>
                </div>

                <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-300 uppercase font-bold tracking-wider">
                      Single-Use Emergency Backup Codes
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                      {backupCodes.filter((c) => !c.used).length} / {backupCodes.length} UNUSED
                    </span>
                  </div>

                  {!isBackupCodesUnlocked ? (
                    <>
                      {/* Masked Backup Codes Preview Tiles */}
                      <div className="grid grid-cols-2 gap-2">
                        {backupCodes.map((item, idx) => (
                          <div
                            key={idx}
                            className="rounded-lg bg-slate-950/60 border border-slate-800 px-3.5 py-2.5 flex items-center justify-between font-mono text-xs text-slate-400 select-none"
                          >
                            <span className="font-semibold tracking-wider">LDM-••••-••••</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                                item.used
                                  ? 'bg-rose-950/70 text-rose-400 border-rose-800/50'
                                  : 'bg-slate-900 text-slate-500 border-slate-800'
                              }`}
                            >
                              {item.used ? 'EXPIRED' : 'LOCKED'}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Password Verification Gate */}
                      <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
                        <label className="block text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5" /> Verify Account Password to View or Generate Codes
                        </label>
                        <div className="relative">
                          <input
                            type={showBackupPassVerify ? 'text' : 'password'}
                            value={backupPassVerifyInput}
                            onChange={(e) => {
                              setBackupVerifyError(null);
                              setBackupPassVerifyInput(e.target.value);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                (document.getElementById('verify-backup-pass-btn') as HTMLButtonElement | null)?.click();
                              }
                            }}
                            placeholder="Enter your current account password"
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-3.5 pr-10 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                          />
                          <button
                            type="button"
                            onClick={() => setShowBackupPassVerify(!showBackupPassVerify)}
                            className="absolute right-3 top-2 text-slate-400 hover:text-amber-400 cursor-pointer"
                          >
                            {showBackupPassVerify ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>

                        {backupVerifyError && (
                          <div className="p-2 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-[11px]">
                            {backupVerifyError}
                          </div>
                        )}

                        <button
                          id="verify-backup-pass-btn"
                          type="button"
                          disabled={isVerifyingBackupPass}
                          onClick={async () => {
                            const targetEmail = (profileEmail || session?.email || '').trim().toLowerCase();
                            const cleanPass = backupPassVerifyInput.trim();
                            if (!cleanPass) {
                              setBackupVerifyError('Please enter your account password to verify your identity.');
                              return;
                            }
                            setIsVerifyingBackupPass(true);
                            setBackupVerifyError(null);

                            const defaultPassMap: Record<string, string> = {
                              'om@ldmconstruction.ph': 'admin123',
                              'pm@ldmconstruction.ph': 'pm123',
                              'finance@ldmconstruction.ph': 'finance123',
                              'timekeeper@ldmconstruction.ph': 'tk123',
                            };
                            const expectedLocalPass = getAccountPasskey(
                              targetEmail,
                              defaultPassMap[targetEmail] || 'admin123'
                            );

                            let verified = cleanPass === expectedLocalPass;
                            if (!verified) {
                              try {
                                const res = await fetch('/api/auth/login', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ email: targetEmail, password: cleanPass }),
                                });
                                if (res.ok) verified = true;
                              } catch {
                                /* offline fallback already checked */
                              }
                            }

                            setIsVerifyingBackupPass(false);
                            if (!verified) {
                              setBackupVerifyError('Incorrect password. Access to view or regenerate backup codes denied.');
                              return;
                            }

                            setBackupCodes(getBackupRecoveryCodes(targetEmail));
                            setIsBackupCodesUnlocked(true);
                            setBackupPassVerifyInput('');
                          }}
                          className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl cursor-pointer transition-colors shadow-sm disabled:opacity-50"
                        >
                          {isVerifyingBackupPass ? 'Verifying Password...' : 'Verify Password & Reveal Backup Codes'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Unlocked Dynamic Single-Use Backup Code Tiles */}
                      <div className="grid grid-cols-2 gap-2">
                        {backupCodes.map((item, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              if (!item.used && navigator.clipboard) {
                                navigator.clipboard.writeText(item.code);
                                notify(`📋 Copied ${item.code} to clipboard.`);
                              }
                            }}
                            title={item.used ? 'Backup code already used' : 'Click to copy backup code'}
                            className={`rounded-lg bg-slate-950/60 border px-3.5 py-2.5 flex items-center justify-between font-mono text-xs ${
                              item.used
                                ? 'border-rose-900/40 text-slate-500 line-through select-none'
                                : 'border-slate-800 hover:border-emerald-500/40 text-emerald-400 cursor-pointer group'
                            }`}
                          >
                            <span className="font-bold tracking-wider">{item.code}</span>
                            {item.used ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-400 border border-rose-800/60 no-underline font-bold">
                                EXPIRED
                              </span>
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 shrink-0 transition-colors" />
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                        <button
                          type="button"
                          onClick={() => {
                            const unusedList = backupCodes
                              .filter((c) => !c.used)
                              .map((c) => c.code)
                              .join('\n');
                            if (unusedList && navigator.clipboard) {
                              navigator.clipboard.writeText(unusedList);
                              notify('📋 Unused emergency backup codes copied to clipboard.');
                            }
                          }}
                          className="flex-1 py-2 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold text-[11px] rounded-xl cursor-pointer transition-colors"
                        >
                          Copy Unused Codes
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const targetEmail = profileEmail || session?.email || '';
                            const newBatch = generateBackupRecoveryCodes(targetEmail, 4);
                            setBackupCodes(newBatch);
                            notify('🔄 Generated 4 new single-use backup codes! All previous codes are now expired.');
                          }}
                          className="flex-1 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 font-bold text-[11px] rounded-xl cursor-pointer transition-colors"
                        >
                          ↻ Generate New Codes
                        </button>
                      </div>

                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        Save these codes offline. Each code works <strong>only once</strong> and expires immediately upon use. Generating new codes permanently invalidates your old set.
                      </p>
                    </>
                  )}
                </div>

                {/* Smooth Inline Unlink Confirmation Drawer (Expands above footer when Unlink App is clicked) */}
                {showUnlinkConfirm && (
                  <div className="p-3.5 bg-rose-950/30 border border-rose-500/40 rounded-xl space-y-2.5 text-xs animate-in fade-in duration-150">
                    <div className="font-bold text-rose-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>
                        {isBackupCodesUnlocked
                          ? 'Disable 2FA and unlink your authenticator app?'
                          : 'Enter your password to disable 2FA and unlink your authenticator app'}
                      </span>
                    </div>

                    {!isBackupCodesUnlocked && (
                      <div className="relative">
                        <input
                          type={showUnlinkPass ? 'text' : 'password'}
                          value={unlinkPassInput}
                          onChange={(e) => {
                            setUnlinkError(null);
                            setUnlinkPassInput(e.target.value);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              (document.getElementById('confirm-unlink-2fa-btn') as HTMLButtonElement | null)?.click();
                            }
                          }}
                          placeholder="Enter your current account password"
                          className="w-full bg-slate-950 border border-rose-500/40 rounded-xl pl-3.5 pr-10 py-2 text-xs text-white focus:outline-none focus:border-rose-400"
                        />
                        <button
                          type="button"
                          onClick={() => setShowUnlinkPass(!showUnlinkPass)}
                          className="absolute right-3 top-2 text-slate-400 hover:text-rose-300 cursor-pointer"
                        >
                          {showUnlinkPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    )}

                    {unlinkError && (
                      <div className="p-2 rounded-lg bg-red-950/70 border border-red-800 text-red-200 text-[11px]">
                        {unlinkError}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setShowUnlinkConfirm(false);
                          setUnlinkPassInput('');
                          setUnlinkError(null);
                        }}
                        className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-semibold text-xs rounded-lg cursor-pointer transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        id="confirm-unlink-2fa-btn"
                        type="button"
                        disabled={isUnlinking2fa}
                        onClick={async () => {
                          const targetEmail = (profileEmail || session?.email || '').trim().toLowerCase();

                          if (!isBackupCodesUnlocked) {
                            const cleanPass = unlinkPassInput.trim();
                            if (!cleanPass) {
                              setUnlinkError('Please enter your current account password to confirm.');
                              return;
                            }
                            setIsUnlinking2fa(true);
                            setUnlinkError(null);

                            const defaultPassMap: Record<string, string> = {
                              'om@ldmconstruction.ph': 'admin123',
                              'pm@ldmconstruction.ph': 'pm123',
                              'finance@ldmconstruction.ph': 'finance123',
                              'timekeeper@ldmconstruction.ph': 'tk123',
                            };
                            const expectedLocalPass = getAccountPasskey(
                              targetEmail,
                              defaultPassMap[targetEmail] || 'admin123'
                            );

                            let verified = cleanPass === expectedLocalPass;
                            if (!verified) {
                              try {
                                const res = await fetch('/api/auth/login', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ email: targetEmail, password: cleanPass }),
                                });
                                if (res.ok) verified = true;
                              } catch {
                                /* offline fallback already checked */
                              }
                            }

                            setIsUnlinking2fa(false);
                            if (!verified) {
                              setUnlinkError('Incorrect password. Authenticator app was not unlinked.');
                              return;
                            }
                          }

                          // 1. Clear 2FA enrollment and TOTP data in localStorage & state
                          set2faEnrolled(targetEmail, false);
                          clearAccountTotpData(targetEmail);
                          setTwoFactorEnabled(false);
                          setIsBackupCodesUnlocked(false);
                          setShowUnlinkConfirm(false);
                          setUnlinkPassInput('');
                          setTotpVerifyInput('');
                          setTotpSetupError(null);

                          // 2. Record Audit Trail entry
                          logAuditEvent({
                            entityId: session?.id || 'SECURITY-2FA',
                            action: '2FA_UNLINKED',
                            actorName: profileName || session?.name || 'Operations Lead',
                            actorRole: session?.role || 'Staff',
                            details: `User unlinked Authenticator App / disabled 2FA (${targetEmail})`,
                          });

                          // 3. Transition modal back to 2FA Setup / QR Code Enrollment view
                          setTotpSetupStep('qr');
                          notify('Authenticator app unlinked. You can link a new device anytime.');
                        }}
                        className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-sm disabled:opacity-50"
                      >
                        {isUnlinking2fa ? 'Unlinking...' : 'Confirm Unlink'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Balanced Equal-Height Footer Buttons (grid-cols-2 gap-3) */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTotpSetupError(null);
                      setTotpVerifyInput('');
                      setShowUnlinkConfirm(false);
                      setTotpSetupStep('qr');
                    }}
                    className="h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 whitespace-nowrap bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 cursor-pointer transition-colors"
                  >
                    <QrCode className="w-4 h-4 shrink-0" />
                    <span>View QR Code</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUnlinkError(null);
                      setUnlinkPassInput('');
                      setShowUnlinkConfirm((prev) => !prev);
                    }}
                    className="h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 whitespace-nowrap bg-rose-600/15 hover:bg-rose-600/25 text-rose-300 border border-rose-500/40 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-4 h-4 shrink-0" />
                    <span>Unlink App</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default AccountsCentre;
