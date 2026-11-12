/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, LogIn, Key, Mail, ArrowLeft,
  Sparkles, Layers, CheckSquare
} from 'lucide-react';
import { UserSession } from '../types';
import { useTheme } from '../context/ThemeContext';
import { LdmBrandLogo } from './OptimizedLdmImage';
import { ThemeToggle } from './ThemeToggle';
import { clearExpiredAuthSession } from '../utils/session';
import {
  STRICT_EMAIL_REGEX,
  validateEmailPreFlight,
  encodePasswordTransportPayload,
} from '../utils/securityValidation';

interface LoginPortalProps {
  onLoginSuccess: (session: UserSession) => void;
  onBackToLanding: () => void;
  initialInviteToken?: string | null;
}

export default function LoginPortal({ onLoginSuccess, onBackToLanding }: LoginPortalProps) {
  const { isDark } = useTheme();
  // Login State with default prefilled operational account
  const [email, setEmail] = useState<string>('om@ldmconstruction.ph');
  const [password, setPassword] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Immediate mount cleanup: If opened on login with expired flag/param, wipe lingering keys and prevent auto-redirect
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

  // --- LOGIN HANDLER (Strict Pre-Flight Validation & Payload Hardening) ---
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const emailCheck = validateEmailPreFlight(email);
    if (!emailCheck.valid || !STRICT_EMAIL_REGEX.test(emailCheck.cleanEmail)) {
      // Block network request completely if email is blank or missing valid domain (.com, .ph, etc.)
      setErrorMsg(
        emailCheck.error ||
          'Invalid email format. Please enter a complete email address with domain (e.g., name@ldmconstruction.ph).'
      );
      return;
    }

    if (!password || password.trim().length === 0) {
      // Block network request completely if password is empty
      setErrorMsg('Please enter your security passkey before signing in.');
      return;
    }

    const cleanEmail = emailCheck.cleanEmail;
    // Normalize @ldmconstruction.ph to @ctvill.com for existing backend database accounts
    const backendEmail = cleanEmail.toLowerCase().endsWith('@ldmconstruction.ph')
      ? cleanEmail.replace(/@ldmconstruction\.ph$/i, '@ctvill.com')
      : cleanEmail;

    setIsSubmitting(true);
    try {
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

      if (!res.ok) {
        setErrorMsg(data.error || 'Authentication failed. Please verify your credentials.');
      } else if (data.session) {
        const finalSession = {
          ...data.session,
          rememberMe,
          email: cleanEmail.toLowerCase().endsWith('@ldmconstruction.ph') ? cleanEmail : data.session.email,
        };
        onLoginSuccess(finalSession);
      }
    } catch (err) {
      setErrorMsg('Connection error. Could not reach authentication server.');
    } finally {
      setIsSubmitting(false);
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

        {/* Right Column: Portal Sign-In Form */}
        <div className="lg:col-span-5 bg-slate-900 p-6 sm:p-8 flex flex-col justify-between space-y-6">
          <div>
            <div className="text-center py-2">
              <div className="flex justify-center mx-auto">
                <LdmBrandLogo size="lg" />
              </div>
              <h3 className="font-bold text-white text-lg mt-3">Operations Sign-In</h3>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Authorized Engineers, Architects &amp; Project Staff
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} noValidate autoComplete="off" className="space-y-4 mt-6 text-xs">
              {errorMsg && (
                <div className="bg-red-950/60 border border-red-800 text-red-300 p-3 rounded-xl flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                  <span className="text-xs">{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Account Email ID
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@ldmconstruction.ph"
                    autoComplete="off"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Security Passkey
                </label>
                <div className="relative">
                  <Key className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="off"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 py-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-500/30 accent-amber-500 cursor-pointer"
                  />
                  <span className="text-slate-300 group-hover:text-amber-400 transition-colors text-[11px] font-medium">
                    Remember workstation (24h)
                  </span>
                </label>
                <span className="text-[10px] font-mono text-slate-500">
                  {rememberMe ? 'Persistent Device' : 'Single Session'}
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 mt-4 text-xs"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                    <span>Authenticating Workspace...</span>
                  </>
                ) : (
                  <>
                    <span>Enter Operations Portal</span>
                    <LogIn className="w-4 h-4" />
                  </>
                )}
              </button>


            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
