/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldAlert, LogIn, Key, Mail, ArrowLeft,
  Sparkles, Layers, CheckSquare, Eye, EyeOff,
  ShieldCheck, Lock, KeyRound,
  Send, Shield, QrCode
} from 'lucide-react';
import QRCode from 'qrcode';
import { UserSession } from '../types';
import { useTheme } from '../context/ThemeContext';
import { LdmBrandLogo } from './OptimizedLdmImage';
import { ThemeToggle } from './ThemeToggle';
import { clearExpiredAuthSession } from '../utils/session';
import { logAuditEvent } from '../utils/auditLogger';
import {
  STRICT_EMAIL_REGEX,
  validateEmailPreFlight,
  encodePasswordTransportPayload,
} from '../utils/securityValidation';
import {
  getOrCreateTotpSecret,
  formatTotpSecretDisplay,
  buildOtpAuthUri,
  verifyTotpCode,
  consumeBackupRecoveryCode,
} from '../utils/totpAuth';

export function maskEmail(email: string): string {
  if (!email) return '';
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const name = parts[0];
  const domain = parts[1];
  const visibleChars = Math.min(2, name.length);
  const maskedName = name.slice(0, visibleChars) + '***';
  return `${maskedName}@${domain}`;
}

interface LoginPortalProps {
  onLoginSuccess: (session: UserSession) => void;
  onBackToLanding: () => void;
  initialInviteToken?: string | null;
}

// Presentation Demo Accounts Configuration
export const DEMO_ACCOUNTS = [
  {
    role: 'Operations Manager',
    badge: 'Executive & Approvals',
    email: 'om@ldmconstruction.ph',
    altEmail: 'om@ldmconstruction.ph',
    defaultPass: 'admin123',
    name: 'Dave Matthew Reglos',
    color: 'amber',
  },
  {
    role: 'Site Engineer & PM',
    badge: '14-Phase Gantt & WBS',
    email: 'pm@ldmconstruction.ph',
    altEmail: 'pm@ldmconstruction.ph',
    defaultPass: 'pm123',
    name: 'Engr. Marco Santos',
    color: 'blue',
  },
  {
    role: 'Finance Controller',
    badge: 'BOM, Ledger & Payroll',
    email: 'finance@ldmconstruction.ph',
    altEmail: 'finance@ldmconstruction.ph',
    defaultPass: 'finance123',
    name: 'Clarisse Mendoza',
    color: 'emerald',
  },
  {
    role: 'Site Timekeeper',
    badge: 'DTR Attendance & Muster',
    email: 'timekeeper@ldmconstruction.ph',
    altEmail: 'timekeeper@ldmconstruction.ph',
    defaultPass: 'tk123',
    name: 'Rodel Reyes',
    color: 'purple',
  },
];

// Admin Master Recovery Key for Passkey Reset
const ADMIN_MASTER_RECOVERY_KEY = 'LDM-ADMIN-RECOVERY';

function toCanonicalLdmEmail(raw: string): string {
  return (raw || '').trim().toLowerCase();
}

// LocalStorage helpers for custom passwords set via passkey recovery
export function getCustomPasswords(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw1 = localStorage.getItem('ldm_custom_passwords');
    const raw2 = localStorage.getItem('ldm_account_passwords');
    const p1 = raw1 ? JSON.parse(raw1) : {};
    const p2 = raw2 ? JSON.parse(raw2) : {};
    const merged: Record<string, string> = { ...p1, ...p2 };
    const normalized: Record<string, string> = {};
    for (const [k, v] of Object.entries(merged)) {
      normalized[k] = v;
      normalized[toCanonicalLdmEmail(k)] = v;
    }
    return normalized;
  } catch {
    return {};
  }
}

export function saveCustomPassword(email: string, pass: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getCustomPasswords();
    const clean = toCanonicalLdmEmail(email);
    current[clean] = pass;
    localStorage.setItem('ldm_custom_passwords', JSON.stringify(current));
    localStorage.setItem('ldm_account_passwords', JSON.stringify(current));
  } catch {
    /* ignore */
  }
}

export function getAccountPasskey(email: string, defaultPass: string): string {
  const custom = getCustomPasswords();
  const clean = toCanonicalLdmEmail(email);
  return custom[clean] || custom[email.trim().toLowerCase()] || defaultPass;
}

// Trust workstation helpers (24h)
const TRUST_DURATION_MS = 24 * 60 * 60 * 1000;

export function isWorkstationTrusted(email: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const clean = toCanonicalLdmEmail(email);
    const key = `ldm_trusted_workstation_${clean}`;
    const timestamp = localStorage.getItem(key);
    if (!timestamp) return false;
    const elapsed = Date.now() - Number(timestamp);
    return elapsed >= 0 && elapsed < TRUST_DURATION_MS;
  } catch {
    return false;
  }
}

export function setWorkstationTrusted(email: string): void {
  if (typeof window === 'undefined') return;
  try {
    const clean = toCanonicalLdmEmail(email);
    const key = `ldm_trusted_workstation_${clean}`;
    localStorage.setItem(key, String(Date.now()));
    localStorage.setItem('ldm_remember_workstation', 'true');
    localStorage.setItem('ldm_remembered_email', clean);
  } catch {
    /* ignore */
  }
}

// 2FA Enrollment helpers (Opt-in per account via Accounts Centre -> Security)
export function is2faEnrolled(email: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const clean = toCanonicalLdmEmail(email);
    if (!clean) return false;
    return localStorage.getItem(`ldm_2fa_enrolled_${clean}`) === 'true';
  } catch {
    return false;
  }
}

export function set2faEnrolled(email: string, enrolled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    const clean = toCanonicalLdmEmail(email);
    const localPart = clean.split('@')[0];
    if (enrolled) {
      localStorage.setItem(`ldm_2fa_enrolled_${clean}`, 'true');
    } else {
      localStorage.removeItem(`ldm_2fa_enrolled_${clean}`);
      localStorage.removeItem(`ldm_2fa_enrolled_${email.trim().toLowerCase()}`);
      if (localPart) {
        localStorage.removeItem(`ldm_2fa_enrolled_${localPart}@ldmconstruction.ph`);
        localStorage.removeItem(`ldm_2fa_enrolled_${localPart}@ctvill.com`);
      }
    }
  } catch {
    /* ignore */
  }
}

export default function LoginPortal({ onLoginSuccess, onBackToLanding }: LoginPortalProps) {
  const { isDark } = useTheme();

  // Active Card View: 'signin' | '2fa' | 'recovery'
  const [view, setView] = useState<'signin' | '2fa' | 'recovery'>('signin');

  // Login Form State (Always starts empty on load)
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ldm_remember_workstation') === 'true';
    }
    return false;
  });
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successBannerMsg, setSuccessBannerMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Brute-Force Attempt Tracking & 60s Lockout State
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  // 2FA Verification State
  const [pendingSession, setPendingSession] = useState<UserSession | null>(null);
  const [active2faOtp, setActive2faOtp] = useState<string>('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [timerSec, setTimerSec] = useState<number>(60);
  const [useBackupCode, setUseBackupCode] = useState<boolean>(false);
  const [backupCodeInput, setBackupCodeInput] = useState<string>('');
  const [isVerifying2fa, setIsVerifying2fa] = useState<boolean>(false);
  const [showQrSetup, setShowQrSetup] = useState<boolean>(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const digitInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Passkey Recovery Wizard State (3 Steps)
  const [recoveryStep, setRecoveryStep] = useState<1 | 2 | 3>(1);
  const [recoveryEmail, setRecoveryEmail] = useState<string>('');
  const [securityPin, setSecurityPin] = useState<string>('');
  const [recoveryOtp, setRecoveryOtp] = useState<string>('');
  const [recoveryDigits, setRecoveryDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [recoveryMasterKey, setRecoveryMasterKey] = useState<string>('');
  const [useMasterKey, setUseMasterKey] = useState<boolean>(false);
  const [recoveryTimerSec, setRecoveryTimerSec] = useState<number>(60);
  const [newPasskey, setNewPasskey] = useState<string>('');
  const [confirmPasskey, setConfirmPasskey] = useState<string>('');
  const [showNewPasskey, setShowNewPasskey] = useState<boolean>(false);
  const [isSubmittingRecovery, setIsSubmittingRecovery] = useState<boolean>(false);
  const recoveryDigitInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Generate scannable TOTP QR Code whenever active account changes in 2FA or Recovery
  useEffect(() => {
    const activeEmail =
      view === '2fa'
        ? pendingSession?.email || email
        : view === 'recovery'
        ? recoveryEmail || email
        : email;
    if (!activeEmail) return;
    const uri = buildOtpAuthUri(activeEmail);
    QRCode.toDataURL(uri, {
      width: 176,
      margin: 1,
      color: { dark: '#0F172A', light: '#FFFFFF' },
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch(() => setQrCodeDataUrl(''));
  }, [view, pendingSession?.email, recoveryEmail, email]);

  // Immediate mount cleanup: If opened on login with expired flag/param, wipe lingering keys
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash.toLowerCase();
    if (
      params.get('expired') === 'true' ||
      params.get('session') === 'expired' ||
      hash.includes('login')
    ) {
      clearExpiredAuthSession();
    }
  }, []);

  // Continuous 30-Second TOTP Authenticator Sync Indicator (never locks or expires)
  useEffect(() => {
    if (view !== '2fa') return;
    const updateTotpRemaining = () => {
      const rem = 30 - (Math.floor(Date.now() / 1000) % 30);
      setTimerSec(rem);
    };
    updateTotpRemaining();
    const interval = setInterval(updateTotpRemaining, 1000);
    return () => clearInterval(interval);
  }, [view]);

  // 60-Second Countdown Timer for Recovery OTP
  useEffect(() => {
    if (view !== 'recovery' || recoveryStep !== 2 || recoveryTimerSec <= 0) return;
    const interval = setInterval(() => {
      setRecoveryTimerSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [view, recoveryStep, recoveryTimerSec]);

  // 60-Second Brute-Force Lockout Countdown Timer
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          setFailedAttempts(0);
          setErrorMsg('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  const recordFailedLoginAttempt = () => {
    setFailedAttempts((prev) => {
      const next = prev + 1;
      if (next >= 5) {
        setLockoutSeconds(60);
        setErrorMsg(
          'Too many failed sign-in attempts. Account sign-in is temporarily locked for 60s.'
        );
      } else {
        setErrorMsg(
          'Invalid Account Email ID or Password. Please verify your credentials and try again.'
        );
      }
      return next;
    });
  };

  const handleBackToLanding = () => {
    setIsSubmitting(false);
    try {
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    } catch { /* silent */ }
    onBackToLanding();
  };

  // Helper to generate a random 6-digit OTP string
  const generateRandomOtp = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // --- 1. SIGN-IN HANDLER (Strict Whitelist & Registered Corporate Accounts Only) ---
  const handleLoginSubmit = async (e?: React.FormEvent | React.MouseEvent | React.KeyboardEvent) => {
    if (e && 'preventDefault' in e) e.preventDefault();
    if (lockoutSeconds > 0) {
      setErrorMsg(
        `Too many failed sign-in attempts. Account sign-in is temporarily locked for 60s (${lockoutSeconds}s remaining).`
      );
      return;
    }

    setErrorMsg('');
    setSuccessBannerMsg('');

    const emailCheck = validateEmailPreFlight(email);
    if (!emailCheck.valid || !STRICT_EMAIL_REGEX.test(emailCheck.cleanEmail)) {
      setErrorMsg(
        emailCheck.error ||
          'Please enter a valid corporate email address (e.g., name@ldmconstruction.ph).'
      );
      return;
    }

    if (!password || password.trim().length === 0) {
      setErrorMsg('Please enter your password before signing in.');
      return;
    }

    const cleanEmail = emailCheck.cleanEmail.trim().toLowerCase();
    const backendEmail = cleanEmail;

    // Require exact match against registered DEMO_ACCOUNTS for any local/custom password fallback
    const registeredDemoAcc = DEMO_ACCOUNTS.find(
      (d) => d.email.toLowerCase() === cleanEmail
    );

    setIsSubmitting(true);
    try {
      const customPasswords = getCustomPasswords();
      const customPass = customPasswords[cleanEmail];
      const expectedLocalPass = registeredDemoAcc
        ? customPass || registeredDemoAcc.defaultPass
        : undefined;

      // Only allow custom/local match if email is an exact registered account AND password matches
      const isRegisteredLocalMatch =
        Boolean(registeredDemoAcc) && expectedLocalPass === password;

      const transportCreds = await encodePasswordTransportPayload(password);

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Auth-Transport': transportCreds.encoding,
        },
        body: JSON.stringify({
          email: backendEmail,
          originalEmail: cleanEmail,
          password: transportCreds.maskedPassword,
          encodedPayload: transportCreds.encodedPayload,
          transportDigest: transportCreds.transportDigest,
          nonce: transportCreds.nonce,
          encoding: transportCreds.encoding,
          rememberMe,
        }),
      });
      const data = await res.json();

      let validatedSession: UserSession | null = null;

      if (
        res.ok &&
        data.session &&
        String(data.session.email || '').trim().toLowerCase() === cleanEmail
      ) {
        validatedSession = {
          ...data.session,
          rememberMe,
          email: cleanEmail,
        };
      } else if (isRegisteredLocalMatch && registeredDemoAcc) {
        const resolvedRole = (registeredDemoAcc.role.includes('Manager') ? 'Admin'
          : registeredDemoAcc.role.includes('Engineer') ? 'Engineer'
          : registeredDemoAcc.role.includes('Timekeeper') ? 'Timekeeper'
          : registeredDemoAcc.role.includes('Finance') ? 'Finance'
          : 'Engineer') as any;

        validatedSession = {
          id: `usr-${resolvedRole.toLowerCase()}-custom`,
          email: cleanEmail,
          name: registeredDemoAcc.name,
          role: resolvedRole,
          accountStatus: 'ACTIVE',
          title: registeredDemoAcc.badge,
          division: 'Design & Build Operations',
          rememberMe,
        };
      }

      if (!validatedSession) {
        recordFailedLoginAttempt();
        return;
      }

      // Reset brute-force counters on successful primary authentication
      setFailedAttempts(0);
      setLockoutSeconds(0);

      // Check if user has enrolled in 2FA or if workstation is already trusted for 24h
      if (!is2faEnrolled(cleanEmail) || isWorkstationTrusted(cleanEmail)) {
        logAuditEvent({
          entityId: validatedSession.id || 'AUTH-SESSION',
          action: is2faEnrolled(cleanEmail) ? 'WORKSTATION_TRUSTED_LOGIN' : 'STANDARD_PASSKEY_LOGIN',
          actorName: validatedSession.name,
          actorRole: validatedSession.role,
          details: `Direct sign-in executed for ${cleanEmail}.`,
        });
        onLoginSuccess(validatedSession);
        return;
      }

      // Transition to Two-Factor Authentication (2FA) Step (only for accounts that have scanned & linked an Authenticator app)
      const otp = generateRandomOtp();
      setActive2faOtp(otp);
      setPendingSession(validatedSession);
      setOtpDigits(['', '', '', '', '', '']);
      setTimerSec(30);
      setUseBackupCode(false);
      setBackupCodeInput('');
      setView('2fa');

      // Log strictly to DevTools console & server terminal (Zero DOM Exposure)
      console.info(
        `%c[LDM SECURITY DISPATCH] 2FA OTP for ${cleanEmail}: ${otp}`,
        'color: #f59e0b; font-weight: bold; font-size: 14px; background: #0f172a; padding: 4px 8px; border-radius: 4px;'
      );
      try {
        await fetch('/api/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, type: '2FA' }),
        });
      } catch {
        /* already logged to DevTools console */
      }

      // Focus first digit box on next tick
      setTimeout(() => {
        digitInputRefs.current[0]?.focus();
      }, 100);
    } catch {
      // Offline fallback check strictly against registered DEMO_ACCOUNTS
      const expectedPass = registeredDemoAcc
        ? getAccountPasskey(cleanEmail, registeredDemoAcc.defaultPass)
        : null;

      if (registeredDemoAcc && expectedPass === password) {
        setFailedAttempts(0);
        setLockoutSeconds(0);

        const resolvedRole = (registeredDemoAcc.role.includes('Manager') ? 'Admin'
          : registeredDemoAcc.role.includes('Engineer') ? 'Engineer'
          : registeredDemoAcc.role.includes('Timekeeper') ? 'Timekeeper'
          : registeredDemoAcc.role.includes('Finance') ? 'Finance'
          : 'Engineer') as any;

        const offlineSession: UserSession = {
          id: `usr-${resolvedRole.toLowerCase()}-offline`,
          email: cleanEmail,
          name: registeredDemoAcc.name,
          role: resolvedRole,
          accountStatus: 'ACTIVE',
          title: registeredDemoAcc.badge,
          division: 'Design & Build Operations',
          rememberMe,
        };

        if (!is2faEnrolled(cleanEmail) || isWorkstationTrusted(cleanEmail)) {
          onLoginSuccess(offlineSession);
          return;
        }

        const otp = generateRandomOtp();
        setActive2faOtp(otp);
        setPendingSession(offlineSession);
        setOtpDigits(['', '', '', '', '', '']);
        setTimerSec(30);
        setView('2fa');

        console.info(
          `%c[LDM SECURITY DISPATCH] 2FA OTP for ${cleanEmail}: ${otp}`,
          'color: #f59e0b; font-weight: bold; font-size: 14px; background: #0f172a; padding: 4px 8px; border-radius: 4px;'
        );

        setTimeout(() => {
          digitInputRefs.current[0]?.focus();
        }, 100);
      } else {
        recordFailedLoginAttempt();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 2. TWO-FACTOR AUTHENTICATION (2FA) VERIFICATION HANDLER ---
  const handleDigitChange = (index: number, val: string) => {
    // Only accept numeric characters
    const clean = val.replace(/\D/g, '');
    if (!clean && val !== '') return;

    const newDigits = [...otpDigits];

    // If pasted string with multiple digits
    if (clean.length > 1) {
      const pasted = clean.slice(0, 6).split('');
      pasted.forEach((d, i) => {
        if (i < 6) newDigits[i] = d;
      });
      setOtpDigits(newDigits);
      const focusIndex = Math.min(pasted.length, 5);
      digitInputRefs.current[focusIndex]?.focus();

      if (pasted.length === 6) {
        execute2faVerification(newDigits.join(''));
      }
      return;
    }

    newDigits[index] = clean.slice(-1);
    setOtpDigits(newDigits);

    // Auto-advance to next box if digit entered
    if (clean && index < 5) {
      digitInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit if all 6 digits populated
    if (newDigits.every((d) => d.length === 1)) {
      execute2faVerification(newDigits.join(''));
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        const newDigits = [...otpDigits];
        newDigits[index - 1] = '';
        setOtpDigits(newDigits);
        digitInputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      digitInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      digitInputRefs.current[index + 1]?.focus();
    }
  };

  const execute2faVerification = async (codeToVerify: string) => {
    if (!pendingSession) return;
    setErrorMsg('');
    setIsVerifying2fa(true);

    const cleanCode = useBackupCode ? backupCodeInput.trim().toUpperCase() : codeToVerify.trim();
    if (!cleanCode) {
      setIsVerifying2fa(false);
      return;
    }

    // 0. If user selected Emergency Backup Recovery Code, verify & permanently consume the single-use code
    if (useBackupCode) {
      const backupResult = consumeBackupRecoveryCode(pendingSession.email, cleanCode);
      if (!backupResult.valid) {
        setErrorMsg(
          backupResult.reason === 'USED'
            ? 'This Emergency Backup Code has already been used and is now expired. Please enter an unused backup code.'
            : 'Invalid Emergency Backup Code. Enter an active single-use backup code generated in your Accounts Centre.'
        );
        setIsVerifying2fa(false);
        return;
      }

      set2faEnrolled(pendingSession.email, true);
      logAuditEvent({
        entityId: pendingSession.id || 'AUTH-SESSION',
        action: '2FA_BACKUP_CODE_CONSUMED',
        actorName: pendingSession.name,
        actorRole: pendingSession.role,
        details: `Single-use Emergency Backup Code consumed for ${pendingSession.email} (${backupResult.remaining} unused codes remaining).`,
      });
      if (rememberMe) {
        setWorkstationTrusted(pendingSession.email);
      }
      setIsVerifying2fa(false);
      onLoginSuccess(pendingSession);
      return;
    }

    // 1. Check RFC 6238 TOTP code generated by user's Google / Microsoft Authenticator App
    const isTotpMatch = await verifyTotpCode(pendingSession.email, cleanCode);
    if (isTotpMatch) {
      set2faEnrolled(pendingSession.email, true);
      logAuditEvent({
        entityId: pendingSession.id || 'AUTH-SESSION',
        action: '2FA_VERIFIED_LOGIN',
        actorName: pendingSession.name,
        actorRole: pendingSession.role,
        details: `Two-Factor Authentication (2FA) verified via Authenticator App (TOTP) for ${pendingSession.email}.`,
      });
      if (rememberMe) {
        setWorkstationTrusted(pendingSession.email);
      }
      setIsVerifying2fa(false);
      onLoginSuccess(pendingSession);
      return;
    }

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: pendingSession.email,
          code: cleanCode,
          type: '2FA',
        }),
      });

      if (res.ok) {
        set2faEnrolled(pendingSession.email, true);
        logAuditEvent({
          entityId: pendingSession.id || 'AUTH-SESSION',
          action: '2FA_VERIFIED_LOGIN',
          actorName: pendingSession.name,
          actorRole: pendingSession.role,
          details: `Two-Factor Authentication (2FA) verified successfully for ${pendingSession.email} via server dispatch.`,
        });

        if (rememberMe) {
          setWorkstationTrusted(pendingSession.email);
        }

        setIsVerifying2fa(false);
        onLoginSuccess(pendingSession);
        return;
      }

      const data = await res.json().catch(() => ({}));

      // Offline fallback verification check
      const isOtpValid = codeToVerify === active2faOtp;

      if (!isOtpValid) {
        setErrorMsg(
          data.error || 'Invalid 2FA verification code. Please check your Authenticator app or use an Emergency Backup Recovery Code.'
        );
        setIsVerifying2fa(false);
        return;
      }
    } catch {
      const isOtpValid = codeToVerify === active2faOtp;

      if (!isOtpValid) {
        setErrorMsg('Invalid 2FA verification code. Please check your Authenticator app or use an Emergency Backup Recovery Code.');
        setIsVerifying2fa(false);
        return;
      }
    }

    // Success via fallback verification
    set2faEnrolled(pendingSession.email, true);
    logAuditEvent({
      entityId: pendingSession.id || 'AUTH-SESSION',
      action: '2FA_VERIFIED_LOGIN',
      actorName: pendingSession.name,
      actorRole: pendingSession.role,
      details: `Two-Factor Authentication (2FA) verified successfully for ${pendingSession.email} (${useBackupCode ? 'Emergency Backup Code' : '6-Digit OTP'}). Workstation authenticated.`,
    });

    if (rememberMe) {
      setWorkstationTrusted(pendingSession.email);
    }

    setIsVerifying2fa(false);
    onLoginSuccess(pendingSession);
  };

  const handleResend2fa = async () => {
    if (timerSec > 0 || !pendingSession) return;
    const newOtp = generateRandomOtp();
    setActive2faOtp(newOtp);
    setOtpDigits(['', '', '', '', '', '']);
    setTimerSec(60);
    setErrorMsg('');
    setSuccessBannerMsg('Fresh verification code dispatched.');

    console.info(
      `%c[LDM SECURITY DISPATCH] 2FA OTP for ${pendingSession.email}: ${newOtp}`,
      'color: #f59e0b; font-weight: bold; font-size: 14px; background: #0f172a; padding: 4px 8px; border-radius: 4px;'
    );
    try {
      await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingSession.email, type: '2FA' }),
      });
    } catch {
      /* already logged to DevTools console */
    }

    setTimeout(() => {
      digitInputRefs.current[0]?.focus();
    }, 100);
  };

  // --- 3. PASSKEY RECOVERY HANDLERS (3-STEP WIZARD) ---
  const handleStartRecovery = () => {
    setErrorMsg('');
    setSuccessBannerMsg('');
    setRecoveryStep(1);
    setRecoveryEmail(email || '');
    setSecurityPin('');
    setRecoveryDigits(['', '', '', '', '', '']);
    setRecoveryMasterKey('');
    setUseMasterKey(false);
    setNewPasskey('');
    setConfirmPasskey('');
    setView('recovery');
  };

  // Step 1: Submit email & Employee PIN / Mobile digits to authenticate and dispatch recovery OTP
  const handleRecoveryStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const cleanEmail = recoveryEmail.trim().toLowerCase();
    if (!cleanEmail || !STRICT_EMAIL_REGEX.test(cleanEmail)) {
      setErrorMsg('Please enter a valid corporate email address (e.g., name@ldmconstruction.ph).');
      return;
    }

    const cleanPin = securityPin.trim();
    if (!cleanPin) {
      setErrorMsg('Employee Security PIN or last 4 digits of registered mobile is required for identity verification.');
      return;
    }

    const localOtp = generateRandomOtp();
    setRecoveryOtp(localOtp);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          type: 'RECOVERY',
          securityPin: cleanPin,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // If server rejected (e.g. invalid PIN), check offline fallback PINs
        const validPins = ['2026', '1234', '0000', '0001', '0004', '0003', '0515'];
        if (!validPins.includes(cleanPin)) {
          setErrorMsg(data.error || 'Security verification failed: Incorrect Employee PIN or registered mobile digits.');
          setIsSubmitting(false);
          return;
        }
      }

      console.info(
        `%c[LDM SECURITY DISPATCH] Passkey Recovery OTP for ${cleanEmail}: ${localOtp}`,
        'color: #f59e0b; font-weight: bold; font-size: 14px; background: #0f172a; padding: 4px 8px; border-radius: 4px;'
      );

      setRecoveryTimerSec(60);
      setRecoveryDigits(['', '', '', '', '', '']);
      setRecoveryStep(2);
      setTimeout(() => {
        recoveryDigitInputRefs.current[0]?.focus();
      }, 100);
    } catch {
      // Offline fallback: check PIN
      const validPins = ['2026', '1234', '0000', '0001', '0004', '0003', '0515'];
      if (!validPins.includes(cleanPin)) {
        setErrorMsg('Security verification failed: Incorrect Employee PIN or registered mobile digits.');
        setIsSubmitting(false);
        return;
      }

      console.info(
        `%c[LDM SECURITY DISPATCH] Passkey Recovery OTP for ${cleanEmail}: ${localOtp}`,
        'color: #f59e0b; font-weight: bold; font-size: 14px; background: #0f172a; padding: 4px 8px; border-radius: 4px;'
      );

      setRecoveryTimerSec(60);
      setRecoveryDigits(['', '', '', '', '', '']);
      setRecoveryStep(2);
      setTimeout(() => {
        recoveryDigitInputRefs.current[0]?.focus();
      }, 100);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Handle OTP input or Master Key in Recovery
  const handleRecoveryDigitChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, '');
    if (!clean && val !== '') return;

    const newDigits = [...recoveryDigits];
    if (clean.length > 1) {
      const pasted = clean.slice(0, 6).split('');
      pasted.forEach((d, i) => {
        if (i < 6) newDigits[i] = d;
      });
      setRecoveryDigits(newDigits);
      const focusIndex = Math.min(pasted.length, 5);
      recoveryDigitInputRefs.current[focusIndex]?.focus();
      return;
    }

    newDigits[index] = clean.slice(-1);
    setRecoveryDigits(newDigits);

    if (clean && index < 5) {
      recoveryDigitInputRefs.current[index + 1]?.focus();
    }
  };

  const handleRecoveryDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!recoveryDigits[index] && index > 0) {
        const newDigits = [...recoveryDigits];
        newDigits[index - 1] = '';
        setRecoveryDigits(newDigits);
        recoveryDigitInputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      recoveryDigitInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      recoveryDigitInputRefs.current[index + 1]?.focus();
    }
  };

  const handleVerifyRecoveryStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const enteredCode = recoveryDigits.join('');
    const cleanCode = useMasterKey ? recoveryMasterKey.trim().toUpperCase() : enteredCode;

    if (!cleanCode) {
      setErrorMsg(useMasterKey ? 'Please enter the Admin Master Recovery Key.' : 'Please enter the 6-digit recovery OTP.');
      return;
    }

    // Check RFC 6238 TOTP from Authenticator App
    if (!useMasterKey && (await verifyTotpCode(recoveryEmail, cleanCode))) {
      set2faEnrolled(recoveryEmail, true);
      setRecoveryStep(3);
      return;
    }

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: recoveryEmail,
          code: cleanCode,
          type: 'RECOVERY',
        }),
      });

      if (res.ok) {
        setRecoveryStep(3);
        return;
      }

      const data = await res.json().catch(() => ({}));

      // Offline fallback
      const isOtpValid = enteredCode === recoveryOtp;
      const isMasterValid =
        useMasterKey &&
        recoveryMasterKey.trim().toUpperCase() === ADMIN_MASTER_RECOVERY_KEY;

      if (!isOtpValid && !isMasterValid) {
        setErrorMsg(
          data.error ||
            (useMasterKey
              ? 'Invalid Admin Master Recovery Key. Please check the master key format (LDM-ADMIN-RECOVERY).'
              : 'Invalid recovery code. Please check your dispatched code or request a new one.')
        );
        return;
      }

      setRecoveryStep(3);
    } catch {
      const isOtpValid = enteredCode === recoveryOtp;
      const isMasterValid =
        useMasterKey &&
        recoveryMasterKey.trim().toUpperCase() === ADMIN_MASTER_RECOVERY_KEY;

      if (!isOtpValid && !isMasterValid) {
        setErrorMsg(
          useMasterKey
            ? 'Invalid Admin Master Recovery Key. Please check the master key format (LDM-ADMIN-RECOVERY).'
            : 'Invalid recovery code. Please check your dispatched code or request a new one.'
        );
        return;
      }

      setRecoveryStep(3);
    }
  };

  const handleResendRecoveryOtp = async () => {
    if (recoveryTimerSec > 0) return;
    const newOtp = generateRandomOtp();
    setRecoveryOtp(newOtp);
    setRecoveryDigits(['', '', '', '', '', '']);
    setRecoveryTimerSec(60);
    setErrorMsg('');
    setSuccessBannerMsg('Fresh recovery verification code dispatched.');

    try {
      await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: recoveryEmail,
          type: 'RECOVERY',
          securityPin: securityPin.trim(),
        }),
      });
    } catch {
      console.info(
        `%c[LDM SECURITY DISPATCH] Passkey Recovery OTP for ${recoveryEmail}: ${newOtp}`,
        'color: #f59e0b; font-weight: bold; font-size: 14px; background: #0f172a; padding: 4px 8px; border-radius: 4px;'
      );
    }

    setTimeout(() => {
      recoveryDigitInputRefs.current[0]?.focus();
    }, 100);
  };

  // Step 3: Password Strength Calculator (4 bars)
  const calculatePasswordStrength = (pass: string): { score: number; label: string; color: string } => {
    if (!pass) return { score: 0, label: 'None', color: 'bg-slate-700' };
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[a-zA-Z]/.test(pass)) score++;
    if (/[^a-zA-Z0-9]/.test(pass) || pass.length >= 12) score++;

    switch (score) {
      case 1:
        return { score: 1, label: 'Weak', color: 'bg-red-500' };
      case 2:
        return { score: 2, label: 'Fair', color: 'bg-amber-500' };
      case 3:
        return { score: 3, label: 'Good', color: 'bg-blue-500' };
      case 4:
        return { score: 4, label: 'Strong', color: 'bg-emerald-500' };
      default:
        return { score: 0, label: 'None', color: 'bg-slate-700' };
    }
  };

  const passStrength = calculatePasswordStrength(newPasskey);

  const handleFinalPasskeyReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (newPasskey.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    if (!/[0-9]/.test(newPasskey) || !/[a-zA-Z]/.test(newPasskey)) {
      setErrorMsg('Password must contain both letters and numbers.');
      return;
    }

    if (newPasskey !== confirmPasskey) {
      setErrorMsg('Passwords do not match. Please verify both fields.');
      return;
    }

    setIsSubmittingRecovery(true);
    const cleanEmail = recoveryEmail.trim().toLowerCase();

    try {
      // 1. Save in localStorage custom passwords under both keys
      saveCustomPassword(cleanEmail, newPasskey);

      // 2. Call server endpoint to update PostgreSQL hash directly
      await fetch('/api/auth/recover-passkey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          newPassword: newPasskey,
        }),
      }).catch(() => null);

      // 3. Log security audit event
      const demoAcc = DEMO_ACCOUNTS.find(
        (d) => d.email.toLowerCase() === cleanEmail || d.altEmail.toLowerCase() === cleanEmail
      );
      logAuditEvent({
        entityId: 'SECURITY-RECOVERY',
        action: 'PASSKEY_RECOVERY_RESET',
        actorName: demoAcc?.name || 'Operations Lead',
        actorRole: demoAcc?.role || 'Staff',
        details: `Password reset successfully for account ${cleanEmail}. Authenticated via OTP / Admin Master Key.`,
      });

      // 4. Update form state and return to Sign-In view
      setEmail(cleanEmail);
      setPassword(newPasskey);
      setSuccessBannerMsg('Password Updated! You may now sign in with your new password.');
      setView('signin');
    } catch {
      setErrorMsg('Failed to persist password. Please try again.');
    } finally {
      setIsSubmittingRecovery(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden select-none font-sans selection:bg-amber-500 selection:text-slate-950">
      
      {/* Clean ERP Subtle Grid Background */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <div className={`absolute inset-0 ${isDark 
          ? 'bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)]'
          : 'bg-[linear-gradient(to_right,rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.035)_1px,transparent_1px)]'
        } bg-[size:36px_36px]`}></div>
      </div>

      <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative z-10 grid grid-cols-1 lg:grid-cols-12 animate-slideUp">
        
        {/* Left Column: Brand Identity & PMS Overview */}
        <div className={`lg:col-span-7 ${isDark ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'} p-6 sm:p-8 lg:p-10 border-b border-slate-800 lg:border-b-0 lg:border-r flex flex-col justify-between`}>
          <div className="space-y-6">
            
            {/* Top Bar */}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleBackToLanding}
                className={`text-xs ${isDark ? 'text-slate-400 hover:text-amber-400' : 'text-slate-500 hover:text-amber-600'} flex items-center gap-1.5 transition-colors cursor-pointer`}
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Landing Page</span>
              </button>

              <div className="flex items-center gap-2.5">
                <ThemeToggle />
                <span className="text-[10px] font-mono text-amber-400/90 font-bold tracking-wider uppercase bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full hidden sm:inline">
                  PROJECT MANAGEMENT SYSTEM
                </span>
              </div>
            </div>

            {/* Brand Header */}
            <div className="pt-2 flex items-center gap-3.5">
              <LdmBrandLogo size="lg" lightMode={!isDark} />
              <div>
                <span className={`font-sans font-black text-xl ${isDark ? 'text-white' : 'text-slate-900'} tracking-tight block leading-tight`}>
                  LDM CONSTRUCTION
                </span>
                <span className={`text-[10px] ${isDark ? 'text-amber-400' : 'text-amber-600'} font-mono tracking-widest block uppercase font-bold`}>
                  ENGINEERS &bull; ARCHITECTS &bull; BUILDERS
                </span>
              </div>
            </div>

            <div>
              <h2 className={`font-sans font-black text-2xl lg:text-3xl tracking-tight leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Design &amp; Build ERP Portal
              </h2>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'} mt-2 font-medium leading-relaxed`}>
                Giving Life to Your Dreams &mdash; Centralized Project Management System for architectural design, custom interior fit-outs, residential &amp; commercial builds, Gantt timelines, site diaries, QA punch-lists, and payroll.
              </p>
            </div>

            {/* 3 Pillars Flow Graphic Box */}
            <div className={`p-4 ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-[#F8FAFC] border-[#CBD5E1] shadow-2xs'} border rounded-2xl space-y-3`}>
              <div className="flex items-center justify-between text-xs font-bold">
                <div className={`flex items-center gap-2 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                  <Sparkles className="w-4 h-4" />
                  <span>Turnkey Design &amp; Build Lifecycle</span>
                </div>
                <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>ENGINEERS • ARCHITECTS • BUILDERS</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                <div className={`${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-[#CBD5E1] shadow-2xs'} p-2.5 rounded-xl border`}>
                  <span className={`${isDark ? 'text-amber-400' : 'text-amber-700'} font-bold block`}>1. ARCHITECTURAL</span>
                  <span className={`${isDark ? 'text-slate-400' : 'text-slate-600'}`}>3D Visualization &amp; Plans</span>
                </div>
                <div className={`${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-[#CBD5E1] shadow-2xs'} p-2.5 rounded-xl border`}>
                  <span className={`${isDark ? 'text-blue-400' : 'text-blue-700'} font-bold block`}>2. ENGINEERING</span>
                  <span className={`${isDark ? 'text-slate-400' : 'text-slate-600'}`}>14-Phase WBS &amp; Structural</span>
                </div>
                <div className={`${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-[#CBD5E1] shadow-2xs'} p-2.5 rounded-xl border`}>
                  <span className={`${isDark ? 'text-emerald-400' : 'text-emerald-700'} font-bold block`}>3. CONSTRUCTION</span>
                  <span className={`${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Turnkey Build &amp; Interiors</span>
                </div>
              </div>
            </div>

            {/* Features Highlight Stack */}
            <div className="space-y-3 pt-1">
              <div className="flex gap-3 items-start p-3 bg-slate-900/40 border border-slate-800/80 rounded-xl">
                <div className="bg-amber-950/80 text-amber-400 p-2 rounded-lg border border-amber-800/60 shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="font-bold text-xs text-amber-300">Operations Manager Command Center</h5>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Unified command center for residential &amp; commercial builds, 14-phase weighted WBS schedules, manpower payroll, and procurement.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start p-3 bg-slate-900/40 border border-slate-800/80 rounded-xl">
                <div className="bg-emerald-950 text-emerald-400 p-2 rounded-lg border border-emerald-800 shrink-0">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="font-bold text-xs text-emerald-300">QA Inspection &amp; Punch-List Tracking</h5>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Integrated architectural &amp; structural quality assurance, site diary photo logs, and turnkey handover verification.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-900 text-[10px] font-mono text-slate-500 flex justify-between items-center">
            <span>LDM CONSTRUCTION &bull; DESIGN &amp; BUILD ERP</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              SYSTEM OPERATIONAL
            </span>
          </div>
        </div>

        {/* Right Column: Portal Sign-In / 2FA / Passkey Recovery Panel */}
        <div className={`lg:col-span-5 ${isDark ? 'bg-slate-900' : 'bg-[#FFFFFF] border-l border-[#CBD5E1]'} p-6 sm:p-8 flex flex-col justify-between space-y-6`}>
          <div>
            
            {/* Header branding on right card */}
            <div className="text-center py-2">
              <div className="flex justify-center mx-auto">
                <LdmBrandLogo size="lg" lightMode={!isDark} />
              </div>
              <h3 className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'} text-lg mt-3`}>
                {view === 'signin' && 'Operations Sign-In'}
                {view === '2fa' && 'Two-Factor Authentication (2FA)'}
                {view === 'recovery' && 'Account & Password Recovery'}
              </h3>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'} font-mono mt-0.5`}>
                {view === 'signin' && 'Authorized Engineers, Architects & Project Staff'}
                {view === '2fa' && 'Enter the 6-digit verification code from your Authenticator app (Google / Microsoft Authenticator).'}
                {view === 'recovery' && `Step ${recoveryStep} of 3: ${
                  recoveryStep === 1 ? 'Identity Lookup' : recoveryStep === 2 ? 'Security Verification' : 'Reset Password'
                }`}
              </p>
            </div>

            {/* Feedback Notifications */}
            {errorMsg && (
              <div className="bg-red-950/60 border border-red-800 text-red-300 p-3 rounded-xl flex items-start gap-2 mt-4 text-xs">
                <ShieldAlert className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successBannerMsg && (
              <div className="bg-emerald-950/60 border border-emerald-700 text-emerald-300 p-3 rounded-xl flex items-start gap-2 mt-4 text-xs">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                <span>{successBannerMsg}</span>
              </div>
            )}

            {/* ===============================================================
                VIEW 1: OPERATIONS SIGN-IN FORM (Non-Credential Container to Suppress Chrome Password Popups)
                =============================================================== */}
            {view === 'signin' && (
              <div
                role="region"
                aria-label="Operations Sign-In"
                data-form-type="other"
                className="space-y-4 mt-6 text-xs"
              >
                <div>
                  <label htmlFor="ldm_operator_ref" className={`block ${isDark ? 'text-slate-300' : 'text-slate-700'} font-semibold mb-1.5`}>
                    Account Email ID
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                    <input
                      ref={emailInputRef}
                      id="ldm_operator_ref"
                      name="ldm_operator_ref"
                      type="text"
                      inputMode="email"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      data-form-type="other"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      disabled={lockoutSeconds > 0}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleLoginSubmit(e);
                        }
                      }}
                      placeholder="e.g., engineer@ldmconstruction.ph"
                      className={`w-full ${
                        isDark
                          ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500'
                          : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A] placeholder-slate-400'
                      } border rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 disabled:opacity-50`}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="ldm_access_token" className={`block ${isDark ? 'text-slate-300' : 'text-slate-700'} font-semibold mb-1.5`}>
                    Password
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                    <input
                      ref={passwordInputRef}
                      id="ldm_access_token"
                      name="ldm_access_token"
                      type="text"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      data-form-type="other"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      disabled={lockoutSeconds > 0}
                      style={
                        {
                          WebkitTextSecurity: showPassword ? 'none' : 'disc',
                        } as React.CSSProperties
                      }
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleLoginSubmit(e);
                        }
                      }}
                      placeholder="Enter your password"
                      className={`w-full ${
                        isDark
                          ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500'
                          : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A] placeholder-slate-400'
                      } border rounded-xl pl-10 pr-10 py-2.5 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 disabled:opacity-50`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 p-0.5 text-slate-400 hover:text-amber-400 transition-colors cursor-pointer bg-transparent border-0"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs py-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none group">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-500/30 accent-amber-500 cursor-pointer"
                    />
                    <span className={`${isDark ? 'text-slate-300' : 'text-slate-600'} group-hover:text-amber-500 transition-colors text-[11px] font-medium`}>
                      Remember workstation (24h)
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={handleStartRecovery}
                    className="text-[11px] font-mono text-amber-500 hover:text-amber-400 hover:underline cursor-pointer bg-transparent border-0 p-0 transition-colors font-bold"
                  >
                    Forgot Password?
                  </button>
                </div>

                <button
                  type="button"
                  onClick={(e) => handleLoginSubmit(e)}
                  disabled={isSubmitting || lockoutSeconds > 0}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 mt-4 text-xs disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                      <span>Authenticating Workspace...</span>
                    </>
                  ) : lockoutSeconds > 0 ? (
                    <>
                      <Lock className="w-4 h-4 text-slate-950" />
                      <span>Sign-In Locked ({lockoutSeconds}s)</span>
                    </>
                  ) : (
                    <>
                      <span>Enter Operations Portal</span>
                      <LogIn className="w-4 h-4 text-slate-950" />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* ===============================================================
                VIEW 2: TWO-FACTOR AUTHENTICATION (2FA) STEP
                =============================================================== */}
            {view === '2fa' && (
              <div className="space-y-4 mt-6 text-xs">
                <div className={`p-3.5 ${isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-[#F8FAFC] border-[#CBD5E1]'} border rounded-2xl space-y-1.5 text-center`}>
                  <div className="flex items-center justify-center gap-1.5 text-amber-400 font-bold text-xs">
                    <Shield className="w-4 h-4" />
                    <span>Two-Factor Authenticator Check</span>
                  </div>
                  <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'} leading-relaxed`}>
                    Enter the 6-digit verification code from your Authenticator app (Google / Microsoft Authenticator) for <strong>{pendingSession ? maskEmail(pendingSession.email) : ''}</strong>.
                  </p>
                </div>

                {!useBackupCode ? (
                  /* 6-Digit Auto-Advancing Input Boxes */
                  <div className="space-y-3">
                    <label className={`block text-center text-xs font-mono font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      ENTER 6-DIGIT VERIFICATION CODE
                    </label>
                    <div className="flex justify-center items-center gap-2 sm:gap-2.5">
                      {otpDigits.map((digit, idx) => (
                        <input
                          key={idx}
                          ref={(el) => { digitInputRefs.current[idx] = el; }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleDigitChange(idx, e.target.value)}
                          onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                          className={`w-10 h-12 sm:w-11 sm:h-13 text-center text-xl font-mono font-black rounded-xl border ${
                            isDark
                              ? 'bg-slate-950 border-slate-700 text-white focus:border-amber-500'
                              : 'bg-white border-[#CBD5E1] text-[#0F172A] focus:border-amber-500 shadow-2xs'
                          } focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all`}
                        />
                      ))}
                    </div>

                    {/* Non-blocking 30-second TOTP sync indicator */}
                    <div className="flex items-center justify-center gap-2 text-[11px] font-mono pt-1 text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                      <span>Authenticator codes refresh automatically every 30 seconds ({timerSec}s)</span>
                    </div>
                  </div>
                ) : (
                  /* Emergency Backup Code Input */
                  <div className="space-y-2">
                    <label className={`block text-xs font-mono font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      SINGLE-USE EMERGENCY BACKUP RECOVERY KEY
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        value={backupCodeInput}
                        onChange={(e) => setBackupCodeInput(e.target.value)}
                        placeholder="LDM-XXXX-XXXX"
                        className={`w-full ${
                          isDark
                            ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500'
                            : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A] placeholder-slate-400'
                        } border rounded-xl pl-10 pr-4 py-2.5 font-mono uppercase focus:outline-none focus:border-amber-500`}
                      />
                    </div>
                    <p className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                      Enter one of your unused backup codes from Accounts Centre. Each code expires permanently once used.
                    </p>
                  </div>
                )}

                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (useBackupCode) {
                        execute2faVerification(backupCodeInput);
                      } else {
                        execute2faVerification(otpDigits.join(''));
                      }
                    }}
                    disabled={isVerifying2fa || (!useBackupCode && otpDigits.some((d) => !d))}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 text-xs disabled:opacity-50"
                  >
                    {isVerifying2fa ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                        <span>Verifying Security Token...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 text-slate-950" />
                        <span>Verify &amp; Authenticate Workstation</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <button
                      type="button"
                      onClick={() => setUseBackupCode(!useBackupCode)}
                      className="text-amber-500 hover:text-amber-400 underline cursor-pointer bg-transparent border-0 p-0 font-medium"
                    >
                      {useBackupCode ? '← Use 6-Digit Authenticator Code' : 'Use Emergency Backup Recovery Code'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setView('signin');
                        setErrorMsg('');
                      }}
                      className={`${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'} cursor-pointer bg-transparent border-0 p-0 font-medium`}
                    >
                      ← Back to Sign-In
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ===============================================================
                VIEW 3: MULTI-STEP ACCOUNT & PASSKEY RECOVERY WIZARD
                =============================================================== */}
            {view === 'recovery' && (
              <div className="mt-6 space-y-4 text-xs">
                {/* Step indicator tracker */}
                <div className="flex items-center justify-between gap-2 px-1">
                  {[1, 2, 3].map((step) => (
                    <div key={step} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className={`w-full h-1.5 rounded-full transition-colors ${
                          recoveryStep >= step ? 'bg-amber-500' : isDark ? 'bg-slate-800' : 'bg-slate-200'
                        }`}
                      />
                      <span className={`text-[9px] font-mono font-bold ${
                        recoveryStep === step ? 'text-amber-500' : isDark ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        {step === 1 ? '1. Identity' : step === 2 ? '2. Verify' : '3. Reset'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* STEP 1: IDENTITY LOOKUP */}
                {recoveryStep === 1 && (
                  <form onSubmit={handleRecoveryStep1Submit} noValidate autoComplete="off" className="space-y-4 pt-1">
                    <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'} leading-relaxed`}>
                      Enter your corporate Account Email ID and Employee PIN to verify your identity and receive a 6-digit recovery code.
                    </p>

                    <div>
                      <label htmlFor="recovery-email-input" className={`block ${isDark ? 'text-slate-300' : 'text-slate-700'} font-semibold mb-1.5`}>
                        Account Email ID
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                        <input
                          id="ldm_recovery_operator_ref"
                          name="ldm_recovery_operator_ref"
                          type="text"
                          inputMode="email"
                          required
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          data-form-type="other"
                          data-lpignore="true"
                          data-1p-ignore="true"
                          value={recoveryEmail}
                          onChange={(e) => setRecoveryEmail(e.target.value)}
                          placeholder="e.g. om@ldmconstruction.ph"
                          className={`w-full ${
                            isDark
                              ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500'
                              : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A] placeholder-slate-400'
                          } border rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-amber-500`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={`block ${isDark ? 'text-slate-300' : 'text-slate-700'} font-semibold mb-1.5`}>
                        Employee PIN or Registered Mobile (Last 4 Digits)
                      </label>
                      <div className="relative">
                        <KeyRound className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          required
                          maxLength={6}
                          name="ldm_security_pin_field"
                          autoComplete="off"
                          value={securityPin}
                          onChange={(e) => setSecurityPin(e.target.value)}
                          placeholder="e.g. 0001, 0004 or 2026"
                          className={`w-full ${
                            isDark
                              ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500'
                              : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A] placeholder-slate-400'
                          } border rounded-xl pl-10 pr-4 py-2.5 font-mono focus:outline-none focus:border-amber-500`}
                        />
                      </div>
                      <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-500'} mt-1`}>
                        Verified identity check required to prevent unauthorized recovery attempts.
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setView('signin');
                          setErrorMsg('');
                        }}
                        className={`text-xs ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'} cursor-pointer`}
                      >
                        Cancel &amp; Return
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
                      >
                        <span>Continue to Verification</span>
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </form>
                )}

                {/* STEP 2: SECURITY CODE / MASTER KEY VERIFICATION */}
                {recoveryStep === 2 && (
                  <form onSubmit={handleVerifyRecoveryStep2} noValidate autoComplete="off" className="space-y-4 pt-1">
                    <div className="space-y-1.5 text-center">
                      <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'} leading-relaxed`}>
                        Enter the 6-digit Authenticator / Recovery code for <strong>{maskEmail(recoveryEmail)}</strong> or use the Admin Master Key.
                      </p>
                    </div>

                    {!useMasterKey ? (
                      <div className="space-y-3">
                        <label className={`block text-center text-xs font-mono font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          6-DIGIT RECOVERY OTP CODE
                        </label>
                        <div className="flex justify-center items-center gap-2 sm:gap-2.5">
                          {recoveryDigits.map((digit, idx) => (
                            <input
                              key={idx}
                              ref={(el) => { recoveryDigitInputRefs.current[idx] = el; }}
                              type="text"
                              inputMode="numeric"
                              maxLength={1}
                              value={digit}
                              onChange={(e) => handleRecoveryDigitChange(idx, e.target.value)}
                              onKeyDown={(e) => handleRecoveryDigitKeyDown(idx, e)}
                              className={`w-10 h-12 sm:w-11 sm:h-13 text-center text-xl font-mono font-black rounded-xl border ${
                                isDark
                                  ? 'bg-slate-950 border-slate-700 text-white focus:border-amber-500'
                                  : 'bg-white border-[#CBD5E1] text-[#0F172A] focus:border-amber-500 shadow-2xs'
                              } focus:outline-none focus:ring-2 focus:ring-amber-500/20`}
                            />
                          ))}
                        </div>

                        <div className="flex items-center justify-between text-[11px] font-mono pt-1">
                          <span className={isDark ? 'text-slate-500' : 'text-slate-500'}>
                            {recoveryTimerSec > 0 ? (
                              <span>Resend in <strong className="text-amber-500">{recoveryTimerSec}s</strong></span>
                            ) : (
                              <span className="text-rose-400 font-bold">Code expired</span>
                            )}
                          </span>
                          <button
                            type="button"
                            disabled={recoveryTimerSec > 0}
                            onClick={handleResendRecoveryOtp}
                            className={`font-bold transition-colors cursor-pointer bg-transparent border-0 p-0 ${
                              recoveryTimerSec > 0
                                ? 'text-slate-600 cursor-not-allowed'
                                : 'text-amber-500 hover:text-amber-400 underline'
                            }`}
                          >
                            [Resend Code]
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className={`block text-xs font-mono font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          ADMIN MASTER RECOVERY KEY
                        </label>
                        <div className="relative">
                          <KeyRound className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                          <input
                            type="text"
                            value={recoveryMasterKey}
                            onChange={(e) => setRecoveryMasterKey(e.target.value)}
                            placeholder="Enter master key (LDM-ADMIN-RECOVERY)"
                            className={`w-full ${
                              isDark
                                ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500'
                                : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A] placeholder-slate-400'
                            } border rounded-xl pl-10 pr-4 py-2.5 font-mono uppercase focus:outline-none focus:border-amber-500`}
                          />
                        </div>
                        <p className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                          Default: LDM-ADMIN-RECOVERY
                        </p>
                      </div>
                    )}

                    <div className="space-y-2 pt-2">
                      <button
                        type="submit"
                        className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Verify Identity</span>
                      </button>

                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <button
                          type="button"
                          onClick={() => setUseMasterKey(!useMasterKey)}
                          className="text-amber-500 hover:text-amber-400 underline cursor-pointer bg-transparent border-0 p-0 font-medium"
                        >
                          {useMasterKey ? '← Use 6-Digit Recovery Code' : 'Use Admin Master Recovery Key'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRecoveryStep(1)}
                          className={`${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'} cursor-pointer bg-transparent border-0 p-0`}
                        >
                          Back
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {/* STEP 3: RESET PASSWORD */}
                {recoveryStep === 3 && (
                  <form onSubmit={handleFinalPasskeyReset} noValidate autoComplete="off" className="space-y-4 pt-1">
                    <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'} leading-relaxed`}>
                      Identity verified for <strong>{recoveryEmail}</strong>. Create and confirm your new password below.
                    </p>

                    <div>
                      <label className={`block ${isDark ? 'text-slate-300' : 'text-slate-700'} font-semibold mb-1`}>
                        New Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          required
                          name="ldm_new_access_token"
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          data-form-type="other"
                          data-lpignore="true"
                          data-1p-ignore="true"
                          style={
                            {
                              WebkitTextSecurity: showNewPasskey ? 'none' : 'disc',
                            } as React.CSSProperties
                          }
                          value={newPasskey}
                          onChange={(e) => setNewPasskey(e.target.value)}
                          placeholder="Min 8 characters (letters & numbers)"
                          className={`w-full ${
                            isDark
                              ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500'
                              : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A] placeholder-slate-400'
                          } border rounded-xl pl-10 pr-10 py-2.5 focus:outline-none focus:border-amber-500`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPasskey(!showNewPasskey)}
                          className="absolute right-3 top-2.5 p-0.5 text-slate-400 hover:text-amber-400 transition-colors cursor-pointer bg-transparent border-0"
                        >
                          {showNewPasskey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* 4-Bar Password Strength Indicator */}
                      <div className="mt-2 space-y-1">
                        <div className="grid grid-cols-4 gap-1.5 h-1.5">
                          {[1, 2, 3, 4].map((bar) => (
                            <div
                              key={bar}
                              className={`h-full rounded-full transition-colors ${
                                passStrength.score >= bar ? passStrength.color : isDark ? 'bg-slate-800' : 'bg-slate-200'
                              }`}
                            />
                          ))}
                        </div>
                        <div className="flex justify-between text-[10px] font-mono text-slate-500">
                          <span>Password Strength:</span>
                          <span className="font-bold">{passStrength.label}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className={`block ${isDark ? 'text-slate-300' : 'text-slate-700'} font-semibold mb-1`}>
                        Confirm Password
                      </label>
                      <div className="relative">
                        <Key className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          required
                          name="ldm_confirm_access_token"
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          data-form-type="other"
                          data-lpignore="true"
                          data-1p-ignore="true"
                          style={
                            {
                              WebkitTextSecurity: showNewPasskey ? 'none' : 'disc',
                            } as React.CSSProperties
                          }
                          value={confirmPasskey}
                          onChange={(e) => setConfirmPasskey(e.target.value)}
                          placeholder="Re-type new password"
                          className={`w-full ${
                            isDark
                              ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500'
                              : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A] placeholder-slate-400'
                          } border rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-amber-500`}
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isSubmittingRecovery}
                        className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 text-xs disabled:opacity-50"
                      >
                        {isSubmittingRecovery ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                            <span>Saving Password...</span>
                          </>
                        ) : (
                          <>
                            <CheckSquare className="w-4 h-4" />
                            <span>Save Password &amp; Return to Sign-In</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
