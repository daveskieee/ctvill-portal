import React, { useState, useEffect } from 'react';
import { Building2, ShieldCheck, Database, HardHat, CheckCircle2, Lock } from 'lucide-react';
import { UserSession } from '../types';
import { useTheme } from '../context/ThemeContext';
import { PRIMARY_LDM_LOGO } from '../utils/ldmAssets';

interface LoadingScreenProps {
  session: UserSession | null;
  mode: 'login' | 'logout';
  onComplete: () => void;
}

export default function LoadingScreen({ session, mode, onComplete }: LoadingScreenProps) {
  const { isDark } = useTheme();
  const isLight = !isDark;

  const [stepIndex, setStepIndex] = useState<number>(0);
  const [progress, setProgress] = useState<number>(10);

  const loginSteps = [
    { label: 'Verifying credentials & role privileges...', icon: Lock },
    { label: 'Connecting to Secure Enterprise Cloud (SSL)...', icon: Database },
    { label: 'Loading Turnkey Design & Build Architecture & WBS...', icon: HardHat },
    { label: `Launching ${session?.role || 'User'} Operations Workspace...`, icon: ShieldCheck },
  ];

  const logoutSteps = [
    { label: 'Committing active workspace transactions...', icon: Database },
    { label: 'Revoking temporary session credentials...', icon: Lock },
    { label: 'Session closed securely. Goodbye!', icon: CheckCircle2 },
  ];

  const steps = mode === 'login' ? loginSteps : logoutSteps;

  useEffect(() => {
    const totalDuration = mode === 'login' ? 1600 : 1000;
    const intervalTime = totalDuration / steps.length;

    const stepInterval = setInterval(() => {
      setStepIndex((prev) => {
        if (prev < steps.length - 1) return prev + 1;
        return prev;
      });
    }, intervalTime);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 95) return prev + 5;
        return 100;
      });
    }, totalDuration / 20);

    const timer = setTimeout(() => {
      setProgress(100);
      setTimeout(onComplete, 250);
    }, totalDuration);

    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
      clearTimeout(timer);
    };
  }, [mode, onComplete, steps.length]);

  const CurrentIcon = steps[stepIndex]?.icon || Building2;

  return (
    <div 
      id="loading-screen-overlay"
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center p-6 overflow-hidden select-none transition-colors duration-300 ${
        isLight ? 'bg-[#F0F2F5] text-slate-900' : 'bg-slate-950 text-white'
      }`}
    >
      {/* Dynamic Animated Ambient Backdrop */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {isLight ? (
          <>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-amber-400 via-orange-300 to-amber-200 rounded-full blur-[140px] opacity-25 animate-pulse"></div>
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.035)_1px,transparent_1px)] bg-[size:32px_32px]"></div>
          </>
        ) : (
          <>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 rounded-full blur-[120px] opacity-25 animate-pulse"></div>
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:32px_32px] opacity-40"></div>
          </>
        )}
      </div>

      <div className="relative z-10 max-w-md w-full flex flex-col items-center text-center space-y-6 animate-slideUp">
        
        {/* Glowing Animated LDM Logo Badge */}
        <div className="relative">
          <div className="w-24 h-24 rounded-2xl bg-white shadow-2xl relative z-10 p-3 border border-slate-200/90 flex items-center justify-center transform-gpu">
            <img src={PRIMARY_LDM_LOGO} alt="LDM Construction" className="w-16 h-16 object-contain" />
          </div>
          <div className="absolute -inset-2 rounded-2xl blur-md animate-ping bg-amber-400/20"></div>
          <div className="absolute -inset-4 rounded-3xl border border-amber-500/30 animate-spin" style={{ animationDuration: '8s' }}></div>
        </div>

        {/* Text Details */}
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <span className={`text-[10px] font-mono font-bold px-3 py-0.5 rounded-full uppercase tracking-wider ${
              isLight
                ? 'bg-amber-100 border border-amber-300 text-amber-900 shadow-xs'
                : 'bg-blue-900/60 border border-blue-700/80 text-blue-300'
            }`}>
              {mode === 'login' ? `AUTHENTICATING • ${session?.role || 'CLIENT'}` : 'SIGNING OUT'}
            </span>
          </div>
          
          <h2 className={`text-xl sm:text-2xl font-bold tracking-tight font-sans ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}>
            {mode === 'login' ? `Welcome, ${session?.name || 'User'}` : 'Closing Workspace Session'}
          </h2>

          <p className={`text-xs font-mono h-5 flex items-center justify-center gap-2 ${
            isLight ? 'text-slate-600' : 'text-slate-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full animate-ping ${
              isLight ? 'bg-amber-500' : 'bg-blue-400'
            }`}></span>
            <span>{steps[stepIndex]?.label}</span>
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full space-y-2 pt-2">
          <div className={`w-full h-2 rounded-full overflow-hidden p-0.5 shadow-inner ${
            isLight ? 'bg-slate-200 border border-slate-300' : 'bg-slate-900 border border-slate-800'
          }`}>
            <div 
              className={`h-full rounded-full transition-all duration-300 ease-out shadow-sm ${
                isLight 
                  ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500' 
                  : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400'
              }`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className={`flex justify-between text-[10px] font-mono ${
            isLight ? 'text-slate-500' : 'text-slate-500'
          }`}>
            <span>LDM Construction ERP · Enterprise Cloud</span>
            <span className="font-bold">{progress}%</span>
          </div>
        </div>

      </div>

    </div>
  );
}

