/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ShieldAlert, LogIn, Key, Mail, ArrowLeft,
  Sparkles, Layers, CheckSquare
} from 'lucide-react';
import { UserSession } from '../types';
import logoJpg from '../assets/images/ctvill/logo.jpg';
import { ThemeToggle } from './ThemeToggle';

interface LoginPortalProps {
  onLoginSuccess: (session: UserSession) => void;
  onBackToLanding: () => void;
  initialInviteToken?: string | null;
}

export default function LoginPortal({ onLoginSuccess, onBackToLanding }: LoginPortalProps) {
  // Login State
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // --- LOGIN HANDLER ---
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Authentication failed. Please verify your credentials.');
      } else if (data.session) {
        onLoginSuccess({ ...data.session, rememberMe });
      }
    } catch (err) {
      setErrorMsg('Connection error. Could not reach authentication server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden select-none font-sans selection:bg-amber-500 selection:text-slate-950">
      
      {/* Dynamic Background Ambient Glow */}
      <div className="absolute inset-0 z-0 opacity-25 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[550px] h-[550px] bg-gradient-to-tr from-amber-500 to-orange-600 rounded-full blur-[140px] animate-pulseGlow"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:36px_36px]"></div>
      </div>

      <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative z-10 grid grid-cols-1 lg:grid-cols-12 animate-slideUp">
        
        {/* Left Column: Brand Identity & PMS Overview */}
        <div className="lg:col-span-7 bg-slate-950 p-6 sm:p-8 lg:p-10 border-b border-slate-800 lg:border-b-0 lg:border-r text-white flex flex-col justify-between">
          <div className="space-y-6">
            
            {/* Top Bar */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={onBackToLanding}
                className="text-xs text-slate-400 hover:text-amber-400 flex items-center gap-1.5 transition-colors cursor-pointer"
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
              <div className="h-12 w-12 rounded-xl bg-black border border-slate-800 flex items-center justify-center shadow-xl overflow-hidden shrink-0">
                <img 
                  src={logoJpg} 
                  alt="CTVill Logo" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <span className="font-sans font-black text-xl text-white tracking-tight block leading-tight">
                  CTVILL
                </span>
                <span className="text-[10px] text-amber-400 font-mono tracking-widest block uppercase font-bold">
                  Design & Construction Hub
                </span>
              </div>
            </div>

            <div>
              <h2 className="font-sans font-black text-2xl lg:text-3xl tracking-tight leading-tight text-white">
                Turnkey Fit-Out Operations Portal
              </h2>
              <p className="text-xs text-slate-400 mt-2 font-medium leading-relaxed">
                Centralized Project Management System for commercial fit-outs: Gantt timelines, Kanban tasks, daily site diaries, architectural blueprints, QA punch-list defect logs, and risk matrices.
              </p>
            </div>

            {/* 3 Pillars Flow Graphic Box */}
            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-2 text-amber-400">
                  <Sparkles className="w-4 h-4" />
                  <span>Commercial Fit-Out PMS Lifecycle</span>
                </div>
                <span className="text-[10px] font-mono text-slate-500">CABUYAO, LAGUNA</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-amber-400 font-bold block">1. CREATE</span>
                  <span className="text-slate-400">Gantt & Blueprint Specs</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-blue-400 font-bold block">2. CONSTRUCT</span>
                  <span className="text-slate-400">Site Diaries & Kanban</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-emerald-400 font-bold block">3. AFTER CARE</span>
                  <span className="text-slate-400">Defect Punch-Lists</span>
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
                    Unified left-sidebar navigation with full control over fit-out milestones, contractor manpower allocations, and document approvals.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start p-3 bg-slate-900/40 border border-slate-800/80 rounded-xl">
                <div className="bg-emerald-950 text-emerald-400 p-2 rounded-lg border border-emerald-800 shrink-0">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="font-bold text-xs text-emerald-300">QA Inspection & Punch-List Tracking</h5>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Integrated quality defect logging, photo evidence verification, and contractor defect resolution workflows.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-900 text-[10px] font-mono text-slate-500 flex justify-between items-center">
            <span>CTVILL DESIGN & CONSTRUCTION PMS</span>
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
              <div className="w-12 h-12 rounded-2xl bg-black border border-slate-800 flex items-center justify-center mx-auto shadow-lg overflow-hidden">
                <img src={logoJpg} alt="CTVill Logo" className="w-full h-full object-cover" />
              </div>
              <h3 className="font-bold text-white text-lg mt-3">Operations Sign-In</h3>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Authorized Operations Managers & Project Staff
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4 mt-6 text-xs">
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
                    placeholder="name@ctvill.com"
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
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl font-bold shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2 mt-4"
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
