/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, Building2, ShieldCheck, Award, Sparkles, Phone, Mail, 
  MapPin, Activity, FileText, CheckCircle2, Calendar, Calculator, 
  Compass, Layers, Eye, X, Check, Send, ChevronLeft, ChevronRight, HardHat, 
  Scale, Briefcase, Ruler, Clock, ExternalLink, Hammer, Wrench,
  CheckSquare, FileCheck, Users, HelpCircle, AlertTriangle, RefreshCw, Star, MessageSquarePlus, Globe
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from '../context/ThemeContext';
import { OptimizedLdmImage, LdmBrandLogo } from './OptimizedLdmImage';
import {
  allLdmPortfolioAssets,
  ldmArchitecturalAssets,
  ldmInteriorAssets,
  ldmSiteConstructionAssets,
  ldmHeroShowcaseAssets,
  getPaginatedLdmAssets,
  LdmPortfolioAsset,
  PRIMARY_LDM_LOGO,
  LDM_COMPANY_LOCATION,
} from '../utils/ldmAssets';

export { LDM_COMPANY_LOCATION };
import {
  getEstimatorConfig,
  ESTIMATOR_CONFIG_EVENT,
  EstimatorConfig,
  SpaceCategoryKey,
  FinishTierKey,
} from '../utils/estimatorConfig';
import {
  getClientReviews,
  submitClientReview,
  getReviewCooldownRemainingSeconds,
  CLIENT_REVIEWS_EVENT,
  ClientReviewItem,
} from '../utils/clientReviews';
import {
  STRICT_EMAIL_REGEX,
  validateEmailPreFlight,
} from '../utils/securityValidation';


import { UserSession } from '../types';

interface LandingPageProps {
  onEnterPortal: () => void;
  session?: UserSession | null;
}

const DYK_FACTS = [
  {
    icon: Layers,
    tag: 'COGNITIVE ARCHITECTURE',
    title: 'High Ceilings Foster Abstract Innovation; Focused Low Ceilings Enhance Precision',
    body: 'Cognitive architectural studies demonstrate that high ceiling volumes encourage broader abstract synthesis (ideal for brainstorm nooks and design studios), while lower structural drops foster sharp detail orientation. We calibrate every elevation to the exact tasks performed within.'
  },
  {
    icon: Activity,
    tag: 'ACOUSTIC ENGINEERING',
    title: 'Targeted Acoustic Baffles Reduce Cognitive Fatigue by Up to 40%',
    body: 'Speech intelligibility in open-plan offices is the #1 driver of worker distraction. Strategic NRC 0.85+ ceiling baffles and wall panels absorb flanking sound waves, dramatically lowering stress hormones while preserving open team collaboration.'
  },
  {
    icon: Sparkles,
    tag: 'CIRCADIAN LIGHTING',
    title: 'Dynamic 6,500K to 2,700K Kelvin Tuning Boosts Alertness by 16%',
    body: 'Cool 6,500K daylight-mimicking LEDs trigger dopamine and alertness during peak mid-day sprints, while transitioning to warm 2,700K fixtures at dusk supports natural melatonin cycles. Our MEP engineers design human-centric lighting schemes for every shift.'
  },
  {
    icon: Compass,
    tag: 'BIOPHILIC PSYCHOLOGY',
    title: 'Natural Textures & Living Elements Lower Workplace Stress by 37%',
    body: 'Integrating real timber grain, slate textures, and live foliage reduces sympathetic nervous system arousal. Commercial workspaces with biophilic elements report 15% higher wellbeing and lower absenteeism compared to sterile cubicle layouts.'
  },
  {
    icon: Ruler,
    tag: 'ERGONOMIC ENGINEERING',
    title: 'Task-Calibrated Workstations Reduce Repetitive Strain by 54%',
    body: 'Proper desk clearances, ANSI/BIFMA-rated task chairs, and 105° visual angles prevent musculoskeletal strain in high-density office and tech setups. We optimize physical circulation paths to encourage subconscious movement breaks.'
  },
  {
    icon: Eye,
    tag: 'CHROMATIC PSYCHOLOGY',
    title: 'High-Contrast Amber & Deep Slate Accelerates Visual Focus',
    body: 'Warm amber accents paired with deep charcoal surfaces provide warm focal grounding without visual glare. This chromatic balance sharpens executive attention spans during high-stakes boardroom negotiations and agile scrums.'
  }
];

export default function LandingPage({ onEnterPortal, session }: LandingPageProps) {
  const { theme, isDark } = useTheme();

  // Navigation & transition state
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState<boolean>(false);
  const [activeTourRoom, setActiveTourRoom] = useState<number>(0);
  const [isTourLoaded, setIsTourLoaded] = useState<boolean>(false);

  // 120-Asset Zero-Lag Portfolio & Lightbox State
  const [portfolioTab, setPortfolioTab] = useState<'featured' | 'architectural' | 'interior' | 'construction' | 'all'>('featured');
  const [portfolioVisibleCount, setPortfolioVisibleCount] = useState<number>(12);
  const [lightboxAsset, setLightboxAsset] = useState<LdmPortfolioAsset | null>(null);

  // Hero Background Showcase Carousel State
  const [heroSlideIdx, setHeroSlideIdx] = useState<number>(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setHeroSlideIdx((prev) => (prev + 1) % ldmHeroShowcaseAssets.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  // Did You Know? auto-rotating carousel state
  const [dykIndex, setDykIndex] = useState<number>(0);
  const [dykFade, setDykFade] = useState<boolean>(true);
  const [dykPaused, setDykPaused] = useState<boolean>(false);

  useEffect(() => {
    if (dykPaused) return;
    const timer = setInterval(() => {
      setDykFade(false);
      setTimeout(() => {
        setDykIndex((prev) => (prev + 1) % DYK_FACTS.length);
        setDykFade(true);
      }, 400);
    }, 7000);

    return () => clearInterval(timer);
  }, [dykPaused]);

  const handleSelectDykFact = (idx: number) => {
    if (idx === dykIndex) return;
    setDykFade(false);
    setTimeout(() => {
      setDykIndex(idx);
      setDykFade(true);
    }, 250);
  };

  const handlePrevDykFact = () => {
    handleSelectDykFact((dykIndex - 1 + DYK_FACTS.length) % DYK_FACTS.length);
  };

  const handleNextDykFact = () => {
    handleSelectDykFact((dykIndex + 1) % DYK_FACTS.length);
  };

  const handleConsultFromDyk = () => {
    const fact = DYK_FACTS[dykIndex];
    setProjectScope(`Commercial Fit-Out (${fact.tag})`);
    setProjectNotes(`Inquiring about ${fact.title.toLowerCase()} for our workplace layout.`);
    setShowQuoteModal(true);
  };
  
  // Quotation Modal & Pre-Flight Anti-Spam Cooldown State
  const [showQuoteModal, setShowQuoteModal] = useState<boolean>(false);
  const [quoteSubmitted, setQuoteSubmitted] = useState<boolean>(false);
  const [quoteSubmittedEmail, setQuoteSubmittedEmail] = useState<string>('');
  const [isSubmittingQuote, setIsSubmittingQuote] = useState<boolean>(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteCooldownSec, setQuoteCooldownSec] = useState<number>(0);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [projectScope, setProjectScope] = useState('Full Turnkey Fit-Out (Design + Build)');
  const [projectNotes, setProjectNotes] = useState('');

  // Client Feedback / Review Submission & Moderation Queue State
  const [clientReviews, setClientReviews] = useState<ClientReviewItem[]>(() => getClientReviews());
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [reviewClientName, setReviewClientName] = useState<string>('');
  const [reviewCompanyProject, setReviewCompanyProject] = useState<string>('');
  const [reviewEmail, setReviewEmail] = useState<string>('');
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewHoverRating, setReviewHoverRating] = useState<number>(0);
  const [reviewMessage, setReviewMessage] = useState<string>('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSubmittedSuccess, setReviewSubmittedSuccess] = useState<boolean>(false);
  const [reviewCooldownSec, setReviewCooldownSec] = useState<number>(() => getReviewCooldownRemainingSeconds());

  // Interactive Fit-Out Cost & Timeline Estimator State (Admin-Configurable)
  const [estimatorConfig, setEstimatorConfig] = useState<EstimatorConfig>(() => getEstimatorConfig());
  const [estimatorSpaceType, setEstimatorSpaceType] = useState<SpaceCategoryKey>('corporate');
  const [estimatorArea, setEstimatorArea] = useState<number>(120);
  const [estimatorTier, setEstimatorTier] = useState<FinishTierKey>('premium');

  // Subscribe to live Admin Estimator Config & Client Review updates
  useEffect(() => {
    const syncEstimator = () => setEstimatorConfig(getEstimatorConfig());
    const syncReviews = () => setClientReviews(getClientReviews());
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.includes('estimator')) syncEstimator();
      if (!e.key || e.key.includes('reviews')) syncReviews();
    };
    window.addEventListener(ESTIMATOR_CONFIG_EVENT, syncEstimator);
    window.addEventListener(CLIENT_REVIEWS_EVENT, syncReviews);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(ESTIMATOR_CONFIG_EVENT, syncEstimator);
      window.removeEventListener(CLIENT_REVIEWS_EVENT, syncReviews);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // Tick anti-spam cooldown timers
  useEffect(() => {
    if (quoteCooldownSec <= 0 && reviewCooldownSec <= 0) return;
    const t = setInterval(() => {
      setQuoteCooldownSec((prev) => Math.max(0, prev - 1));
      setReviewCooldownSec(getReviewCooldownRemainingSeconds());
    }, 1000);
    return () => clearInterval(t);
  }, [quoteCooldownSec, reviewCooldownSec]);

  // Calculation Logic for Fit-Out driven directly by Admin Estimator Config
  const currentRates = estimatorConfig.categories[estimatorSpaceType] || estimatorConfig.categories.corporate;
  const ratePerSqm = Number(currentRates[estimatorTier]) || Math.round(currentRates.baseRatePerSqm * (estimatorConfig.tierMultipliers[estimatorTier] || 1));
  const safeEstimatorArea = Math.min(5000, Math.max(1, Number(estimatorArea) || 1));
  const estimatedCost = Math.round(safeEstimatorArea * ratePerSqm);
  const estimatedWeeks = Math.max(
    3,
    Math.round(currentRates.baseWeeks + (safeEstimatorArea / 100) * currentRates.weekPer100Sqm)
  );

  const handleAreaChange = (rawVal: string | number) => {
    const parsed = typeof rawVal === 'number' ? rawVal : parseInt(String(rawVal), 10);
    if (isNaN(parsed)) {
      setEstimatorArea(1);
      return;
    }
    setEstimatorArea(Math.min(5000, Math.max(1, parsed)));
  };

  const approvedReviews = clientReviews.filter((r) => r.status === 'Approved');

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setReviewError(null);

    const remainingCooldown = getReviewCooldownRemainingSeconds();
    if (remainingCooldown > 0) {
      setReviewCooldownSec(remainingCooldown);
      setReviewError(`Anti-spam protection active: Please wait ${remainingCooldown}s before submitting another review.`);
      return;
    }

    const cleanName = reviewClientName.trim();
    const cleanCompany = reviewCompanyProject.trim();
    const cleanMsg = reviewMessage.trim();
    const cleanRevEmail = reviewEmail.trim();

    if (cleanName.length < 2) {
      setReviewError('Please enter your full name or executive title (minimum 2 characters).');
      return;
    }
    if (cleanCompany.length < 2) {
      setReviewError('Please specify your company or completed fit-out project name.');
      return;
    }
    if (cleanRevEmail && !STRICT_EMAIL_REGEX.test(cleanRevEmail)) {
      setReviewError('Please enter a valid corporate email address with a domain (e.g., client@company.com).');
      return;
    }
    if (reviewRating < 1 || reviewRating > 5) {
      setReviewError('Please select a star rating between 1 and 5 stars.');
      return;
    }
    if (cleanMsg.length < 15) {
      setReviewError('Please write a brief review message (at least 15 characters) describing your project experience.');
      return;
    }

    submitClientReview({
      clientName: cleanName,
      companyOrProject: cleanCompany,
      roleOrLocation: cleanCompany,
      rating: reviewRating,
      message: cleanMsg,
      email: cleanRevEmail || undefined,
    });

    setClientReviews(getClientReviews());
    setReviewCooldownSec(getReviewCooldownRemainingSeconds());
    setReviewSubmittedSuccess(true);
  };

  const handleSmoothEnterPortal = () => {
    setIsNavigating(true);
    setTimeout(() => {
      onEnterPortal();
    }, 280);
  };

  const scrollToSection = (e: React.MouseEvent<HTMLElement> | undefined, id: string) => {
    if (e) e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleQuoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuoteError(null);

    if (isSubmittingQuote || quoteCooldownSec > 0) {
      setQuoteError(`Submission lock active. Please wait ${quoteCooldownSec}s before sending another inquiry.`);
      return;
    }

    const cleanName = clientName.trim();
    const cleanPhone = clientPhone.trim();
    const cleanScope = projectScope.trim();
    const emailValidation = validateEmailPreFlight(clientEmail);

    // Pre-Flight Required-Field & Strict Email Regex Check BEFORE firing any network call
    if (!cleanName || cleanName.length < 2) {
      setQuoteError('Please enter your Company or Client Name before submitting.');
      return;
    }
    if (!emailValidation.valid || !STRICT_EMAIL_REGEX.test(emailValidation.cleanEmail)) {
      setQuoteError(
        emailValidation.error ||
          'Invalid email address. Please include a valid domain (e.g., operations@company.com).'
      );
      return;
    }
    if (!cleanPhone || cleanPhone.length < 7) {
      setQuoteError('Please provide a valid contact phone or mobile number.');
      return;
    }
    if (!cleanScope) {
      setQuoteError('Please specify your project scope or estimated floor area.');
      return;
    }

    const cleanEmail = emailValidation.cleanEmail;

    setIsSubmittingQuote(true);
    try {
      const res = await fetch('/api/quotations/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: cleanName,
          clientEmail: cleanEmail,
          clientPhone: cleanPhone,
          projectScope: cleanScope,
          projectNotes: projectNotes.trim(),
          estimatedCost,
          estimatedWeeks,
          estimatorArea: safeEstimatorArea,
          spaceType: estimatorSpaceType,
          finishTier: estimatorTier,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch quotation request.');
      }

      setQuoteSubmittedEmail(cleanEmail);
      setQuoteSubmitted(true);
      setQuoteCooldownSec(30);
    } catch (err: any) {
      console.error('Quotation submission error:', err);
      setQuoteError(err.message || 'Error connecting to estimating server. Please try again or reach out to ldmengineeringdesign@gmail.com directly.');
    } finally {
      setIsSubmittingQuote(false);
    }
  };

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen font-sans selection:bg-amber-500 selection:text-slate-950" id="landing-page-root">
      
      {/* MAIN HEADER NAVIGATION */}
      <header className="border-b border-slate-800/80 bg-slate-950/92 backdrop-blur-md sticky top-0 z-40 transform-gpu will-change-transform" id="home">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          
          {/* Left — Brand Identity */}
          <a href="#home" className="flex items-center gap-3.5 group cursor-pointer shrink-0">
            <img
              src={PRIMARY_LDM_LOGO}
              alt="LDM Construction"
              className="h-11 w-auto max-w-[150px] object-contain shrink-0"
              decoding="async"
            />
            <div>
              <span className="font-sans font-extrabold text-lg text-white tracking-tight block leading-tight group-hover:text-amber-400 transition-colors">
                LDM CONSTRUCTION
              </span>
              <span className="text-[10px] font-semibold tracking-[0.18em] text-amber-400 uppercase font-mono block">
                ENGINEERS • ARCHITECTS • BUILDERS
              </span>
            </div>
          </a>

          {/* Center — 5 Clean Navigation Links */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-300">
            <a
              href="#portfolio-showcase"
              onClick={(e) => scrollToSection(e, 'portfolio-showcase')}
              className="hover:text-amber-400 transition-colors cursor-pointer"
            >
              Portfolio
            </a>
            <a
              href="#virtual-tours"
              onClick={(e) => scrollToSection(e, 'virtual-tours')}
              className="hover:text-amber-400 transition-colors cursor-pointer"
            >
              360° Virtual Tours
            </a>
            <a
              href="#estimator"
              onClick={(e) => scrollToSection(e, 'estimator')}
              className="hover:text-amber-400 transition-colors cursor-pointer"
            >
              Cost Estimator
            </a>
            <a
              href="#testimonials"
              onClick={(e) => scrollToSection(e, 'testimonials')}
              className="hover:text-amber-400 transition-colors cursor-pointer"
            >
              Client Reviews
            </a>
            <a
              href="#contact"
              onClick={(e) => scrollToSection(e, 'contact')}
              className="hover:text-amber-400 transition-colors cursor-pointer"
            >
              Contact
            </a>
          </nav>

          {/* Right — Action Controls */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 flex items-center justify-center">
              <ThemeToggle />
            </div>

            <button
              onClick={() => setShowQuoteModal(true)}
              className="hidden sm:inline-flex px-4 py-2 border border-slate-700 hover:border-amber-500/60 bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-white text-xs font-semibold rounded-xl cursor-pointer transition-all items-center gap-1.5 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Get a Quote</span>
            </button>

            {/* Primary CTA button: ERP Portal or Go to Dashboard */}
            <button
              onClick={handleSmoothEnterPortal}
              disabled={isNavigating}
              id="nav-log-in-btn"
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black rounded-xl cursor-pointer shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 group"
            >
              {isNavigating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  <span>Loading...</span>
                </>
              ) : session ? (
                <>
                  <span>Go to Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </>
              ) : (
                <>
                  <span>ERP Portal</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* 3. HERO SHOWCASE SECTION */}
      <section className="relative overflow-hidden pt-14 pb-20 sm:pt-20 sm:pb-28 bg-gradient-to-b from-slate-950 via-[#0a0f1d] to-slate-950 border-b border-slate-800">
        
        {/* Dynamic Cross-Fading Hero Background Showcase (Only 1 active high-res slide eagerly loaded) */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-20">
          {ldmHeroShowcaseAssets.map((asset, idx) => (
            <div
              key={asset.id}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                idx === heroSlideIdx ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <img
                src={asset.url}
                alt={asset.title}
                className="w-full h-full object-cover scale-105 transform-gpu"
                loading={idx === 0 ? 'eager' : 'lazy'}
                fetchPriority={idx === heroSlideIdx ? 'high' : 'low'}
                decoding="async"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/90" />
            </div>
          ))}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#0ea5e915_1px,transparent_1px),linear-gradient(to_bottom,#0ea5e915_1px,transparent_1px)] bg-[size:36px_36px]"></div>
        </div>

        <div className="max-w-6xl mx-auto px-6 text-center relative z-10 space-y-8">
          
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold tracking-wider uppercase shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            LDM Construction • Engineers • Architects • Builders
          </div>

          <h1 className="font-sans font-black text-4xl sm:text-6xl lg:text-7xl text-white tracking-tight leading-[1.08] max-w-4xl mx-auto">
            Giving Life to <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-200 bg-clip-text text-transparent">Your Dreams</span>.
          </h1>

          <p className="font-sans text-slate-300 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            At <strong>LDM Construction</strong>, our licensed engineers, architects, and builders deliver full-service <strong>Architectural Design, Custom Interior Fit-Out, &amp; Turnkey Residential/Commercial Construction</strong> from concept to handover.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <button
              onClick={() => setShowQuoteModal(true)}
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-sm font-bold rounded-xl cursor-pointer shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center gap-3 group"
            >
              <span>Request Fit-Out Quotation</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
            <button
              onClick={(e) => scrollToSection(e, 'construct')}
              className="w-full sm:w-auto px-8 py-4 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              Explore Completed Projects ↓
            </button>
          </div>

          {/* Featured Hero Portfolio Preview Card */}
          <div className="max-w-5xl mx-auto mt-10 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-900/90 p-3 relative group">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              
              <div className="md:col-span-7 overflow-hidden rounded-2xl h-64 sm:h-80 relative bg-slate-950">
                <OptimizedLdmImage 
                  src={ldmHeroShowcaseAssets[0]?.url || ldmArchitecturalAssets[0]?.url || ''} 
                  alt="Proyecto Bahia & Modern Residence Collection by LDM Construction" 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  fetchPriority="high"
                />
                <div className="absolute top-3 left-3 bg-slate-950/90 border border-amber-500/40 px-3 py-1 rounded-lg text-[11px] font-mono text-amber-300 font-bold shadow-md">
                  ★ FLAGSHIP DESIGN &amp; BUILD • RESIDENTIAL &amp; INTERIOR
                </div>
              </div>

              <div className="md:col-span-5 p-4 sm:p-6 text-left space-y-4">
                <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-extrabold block">
                  SIGNATURE ARCHITECTURAL SHOWCASE
                </span>
                <h3 className="font-sans font-black text-xl sm:text-2xl text-white">
                  Proyecto Bahia &amp; Modern Residence Collection
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  "Giving Life to Your Dreams." Master-crafted Mediterranean villas, contemporary two-storey luxury residences, and bespoke turnkey homes engineered from groundbreaking to final handover with 360° virtual walkthroughs.
                </p>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 text-slate-300">
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[9px]">TOTAL PORTFOLIO</span>
                    <strong>120+ Completed Builds</strong>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[9px]">PREVIEW ACCURACY</span>
                    <strong className="text-emerald-400">360° Virtual Walkthrough</strong>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button 
                    onClick={() => {
                      const firstAsset = ldmArchitecturalAssets[0] || allLdmPortfolioAssets[0];
                      if (firstAsset) setLightboxAsset(firstAsset);
                    }}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-lg cursor-pointer transition-colors flex items-center gap-1.5"
                  >
                    <span>View Flagship Gallery</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-mono text-slate-500">LDM Construction Studio</span>
                </div>
              </div>

            </div>
          </div>

          {/* Core High-Level Credentials */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto pt-6">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xs text-left">
              <span className="font-mono text-2xl sm:text-3xl font-extrabold text-amber-400 block">120+</span>
              <span className="text-xs text-slate-400 block mt-1 font-medium">Completed Designs &amp; Builds</span>
            </div>
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xs text-left">
              <span className="font-mono text-2xl sm:text-3xl font-extrabold text-emerald-400 block">100%</span>
              <span className="text-xs text-slate-400 block mt-1 font-medium">Structural &amp; Architectural Compliance</span>
            </div>
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xs text-left">
              <span className="font-mono text-2xl sm:text-3xl font-extrabold text-cyan-400 block">360°</span>
              <span className="text-xs text-slate-400 block mt-1 font-medium">Interactive Client Virtual Previews</span>
            </div>
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xs text-left">
              <span className="font-mono text-2xl sm:text-3xl font-extrabold text-purple-400 block">Turnkey</span>
              <span className="text-xs text-slate-400 block mt-1 font-medium">Design • Engineering • Construction</span>
            </div>
          </div>

        </div>
      </section>

      {/* 4. THE 4 PILLARS OF "CREATE" */}
      <section className="py-20 bg-slate-900/60 border-b border-slate-800" id="create">
        <div className="max-w-7xl mx-auto px-6">
          
          <div className="text-center space-y-3 max-w-3xl mx-auto mb-16">
            <span className="bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-full px-4 py-1 text-xs font-mono font-bold uppercase inline-block">
              THE "CREATE" PILLAR
            </span>
            <h2 className="font-sans font-black text-3xl sm:text-4xl text-white tracking-tight">
              From In-Depth Research to Ready-to-Build Engineering
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Every project begins with comprehensive feasibility. LDM Construction aligns client operational culture with structural, mechanical, electrical, and architectural precision before breaking ground.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Phase 01 */}
            <div className="bg-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col justify-between group shadow-xl">
              <div className="h-44 overflow-hidden relative">
                <img 
                  src={ldmArchitecturalAssets[0]?.url || ''} 
                  alt="Design Conceptualization" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute top-3 left-3 w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-mono font-black flex items-center justify-center text-sm shadow-md">
                  01
                </div>
              </div>
              <div className="p-6 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-mono text-amber-400 font-bold uppercase">ARCHITECTURAL VISION</span>
                  <h3 className="font-sans font-bold text-base text-white mt-1">Design Conceptualization</h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    An integrated team effort of LDM Construction licensed architects, engineers, and master builders based on deep analysis of site topography, client aspirations, and functional living flows.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-900 text-[11px] font-mono text-slate-500">
                  Aesthetics • Space Identity • Human Factors
                </div>
              </div>
            </div>

            {/* Phase 02 */}
            <div className="bg-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col justify-between group shadow-xl">
              <div className="h-44 overflow-hidden relative">
                <img 
                  src={ldmInteriorAssets[0]?.url || ''} 
                  alt="Engineering Design" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute top-3 left-3 w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-mono font-black flex items-center justify-center text-sm shadow-md">
                  02
                </div>
              </div>
              <div className="p-6 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-mono text-amber-400 font-bold uppercase">TECHNICAL BLUEPRINTS</span>
                  <h3 className="font-sans font-bold text-base text-white mt-1">Engineering Design</h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Our licensed engineering team details all structural, electrical, mechanical (HVAC), Fire Detection and Alarm Systems (FDAS), plumbing, and sanitary layouts to guarantee safety and compliance.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-900 text-[11px] font-mono text-slate-500">
                  MEPFS • Structural Loads • Fire Safety
                </div>
              </div>
            </div>

            {/* Phase 03 */}
            <div className="bg-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col justify-between group shadow-xl">
              <div className="h-44 overflow-hidden relative">
                <img 
                  src={ldmSiteConstructionAssets[0]?.url || ''} 
                  alt="Permitting Application" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute top-3 left-3 w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-mono font-black flex items-center justify-center text-sm shadow-md">
                  03
                </div>
              </div>
              <div className="p-6 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-mono text-amber-400 font-bold uppercase">REGULATORY CLEARANCE</span>
                  <h3 className="font-sans font-bold text-base text-white mt-1">Permitting Application</h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Before mobilization, LDM Construction secures all mandatory permits to avoid stops or penalties: City Hall building permits, Barangay clearances, subdivision approvals, and engineering clearances.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-900 text-[11px] font-mono text-slate-500">
                  Building Permit • Barangay Clearance • Subdivision Approvals • LGU Clearances
                </div>
              </div>
            </div>

            {/* Phase 04 */}
            <div className="bg-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col justify-between group shadow-xl">
              <div className="h-44 overflow-hidden relative">
                <img 
                  src={ldmSiteConstructionAssets[1]?.url || ldmArchitecturalAssets[1]?.url || ''} 
                  alt="Construction Planning" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute top-3 left-3 w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-mono font-black flex items-center justify-center text-sm shadow-md">
                  04
                </div>
              </div>
              <div className="p-6 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-mono text-amber-400 font-bold uppercase">GANTT MILESTONES</span>
                  <h3 className="font-sans font-bold text-base text-white mt-1">Construction Planning</h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Rigorous operational scheduling detailing material delivery dates, specialized labor rosters, and milestone dependencies. Delivered to the client in interactive Gantt charts at least 1 week prior to mobilization.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-900 text-[11px] font-mono text-slate-500">
                  Gantt Charts • Supply Chain • Manpower
                </div>
              </div>
            </div>

          </div>

          {/* Science & Architecture Highlight Callout - Auto-Rotating "Did You Know?" */}
          <div 
            className="mt-12 bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-center gap-6 justify-between transition-all group relative overflow-hidden shadow-xl"
            onMouseEnter={() => setDykPaused(true)}
            onMouseLeave={() => setDykPaused(false)}
          >
            {/* Animated 7-Second Progress Bar at Bottom of Card */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900 overflow-hidden">
              <div
                key={dykIndex}
                className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all"
                style={{
                  width: '100%',
                  animation: 'dykProgress 7000ms linear forwards',
                  animationPlayState: dykPaused ? 'paused' : 'running'
                }}
              />
            </div>

            <div className="space-y-3 max-w-2xl w-full">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                  {React.createElement(DYK_FACTS[dykIndex].icon, { className: 'w-3.5 h-3.5' })}
                  DID YOU KNOW? • {DYK_FACTS[dykIndex].tag}
                </span>

                {/* Carousel controls: Prev, Dots, Next, Counter */}
                <div className="flex items-center gap-2" title="Hover to pause rotation">
                  <button
                    onClick={handlePrevDykFact}
                    className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
                    aria-label="Previous fact"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-1.5">
                    {DYK_FACTS.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectDykFact(idx)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          idx === dykIndex 
                            ? 'w-6 bg-amber-400' 
                            : 'w-1.5 bg-slate-700 hover:bg-slate-500'
                        }`}
                        aria-label={`Go to fact ${idx + 1}`}
                      />
                    ))}
                  </div>

                  <button
                    onClick={handleNextDykFact}
                    className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
                    aria-label="Next fact"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <span className="text-[9px] font-mono text-slate-500 ml-1 hidden sm:inline">
                    {dykIndex + 1}/{DYK_FACTS.length}
                  </span>
                </div>
              </div>

              <div className={`min-h-[120px] sm:min-h-[96px] flex flex-col justify-center transition-all duration-400 ${
                dykFade ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
              }`}>
                <h4 className="font-sans font-bold text-white text-lg sm:text-xl leading-snug">
                  {DYK_FACTS[dykIndex].title}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed mt-2">
                  {DYK_FACTS[dykIndex].body}
                </p>
              </div>
            </div>

            <button
              onClick={handleConsultFromDyk}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl whitespace-nowrap cursor-pointer transition-colors shrink-0 shadow-lg shadow-amber-500/20"
              title={`Consult with engineers regarding ${DYK_FACTS[dykIndex].tag}`}
            >
              Consult with Our Engineers ➔
            </button>
          </div>

        </div>
      </section>

      {/* 4A. PAGINATED 120-PHOTO PORTFOLIO SHOWCASE (ZERO-LAG ARCHITECTURE) */}
      <section className="py-20 bg-slate-950 border-b border-slate-800" id="portfolio-showcase">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-full px-4 py-1 text-xs font-mono font-bold uppercase inline-block">
                  LDM COMPLETE PORTFOLIO • 120+ HIGH-RESOLUTION ASSETS
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                  Zero-Lag Virtualized Grid
                </span>
              </div>
              <h2 className="font-sans font-black text-3xl sm:text-4xl text-white tracking-tight">
                Authentic Design &amp; Construction Catalog
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-2xl">
                Browse our real-world portfolio across Architectural Typologies, Bespoke Interiors, and Structural Civil Works. Cards load on demand to guarantee instant rendering.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'featured', label: 'Featured Highlights' },
                { id: 'architectural', label: `Architectural (${ldmArchitecturalAssets.length})` },
                { id: 'interior', label: `Interior Fit-Out (${ldmInteriorAssets.length})` },
                { id: 'construction', label: `Turnkey Construction (${ldmSiteConstructionAssets.length})` },
                { id: 'all', label: `All Portfolio (${allLdmPortfolioAssets.length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setPortfolioTab(tab.id as any);
                    setPortfolioVisibleCount(12);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold cursor-pointer transition-all ${
                    portfolioTab === tab.id
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : isDark
                        ? 'bg-slate-900 border border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                        : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-400 hover:text-slate-900 shadow-2xs'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Paginated 12-Card Grid */}
          {(() => {
            const { items, total, hasMore } = getPaginatedLdmAssets(portfolioTab, portfolioVisibleCount);
            return (
              <div className="space-y-10">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {items.map((asset) => (
                    <div
                      key={asset.id}
                      onClick={() => setLightboxAsset(asset)}
                      className={`group ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'} border hover:border-amber-500/60 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col justify-between cursor-pointer`}
                    >
                      <div className={`h-48 overflow-hidden relative border-b ${isDark ? 'border-slate-800/80 bg-slate-950' : 'border-slate-200 bg-slate-100'}`}>
                        <OptimizedLdmImage
                          src={asset.url}
                          alt={asset.title}
                          className="w-full h-full transform group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute top-2.5 left-2.5 preserve-dark-surface bg-slate-900/75 backdrop-blur-md text-white border border-white/20 text-[9px] font-mono font-bold px-2.5 py-0.5 rounded-full shadow-md">
                          {asset.categoryLabel}
                        </div>
                        <div className="absolute bottom-2.5 right-2.5 preserve-dark-surface bg-slate-950/80 text-white font-mono text-[9px] px-2 py-0.5 rounded flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Eye className="w-3 h-3 text-amber-400" />
                          <span>View High-Res</span>
                        </div>
                      </div>

                      <div className={`p-4 space-y-2 flex-1 flex flex-col justify-between ${isDark ? 'bg-slate-900/60 text-slate-200' : 'bg-white text-slate-900'}`}>
                        <div>
                          <h4 className={`font-sans font-bold text-xs ${isDark ? 'text-white' : 'text-slate-900'} group-hover:text-amber-500 transition-colors line-clamp-2`}>
                            {asset.title}
                          </h4>
                          <p className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'} mt-1 flex items-center gap-1.5`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80"></span>
                            Verified Project Archive
                          </p>
                        </div>
                        <div className={`pt-2 flex items-center justify-between border-t ${isDark ? 'border-slate-800/60 text-amber-400/90' : 'border-slate-200 text-amber-600'} text-[10px] font-mono`}>
                          <span>LDM Genuine Photo</span>
                          <span className={`${isDark ? 'text-slate-400' : 'text-slate-500'} group-hover:translate-x-1 transition-transform`}>➔</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Load More Bar */}
                <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-600'}`}>
                  <div className="text-xs font-mono text-slate-400">
                    Showing <span className="font-bold text-white">{items.length}</span> of{' '}
                    <span className="font-bold text-white">{total}</span> assets in{' '}
                    <span className="text-amber-400 uppercase">{portfolioTab}</span>
                  </div>

                  {hasMore && (
                    <button
                      type="button"
                      onClick={() => setPortfolioVisibleCount((prev) => prev + 12)}
                      className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Load 12 More Projects (Showing {items.length} of {total})</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* SECTION 2 — INTERACTIVE 360° VIRTUAL TOURS (KUULA INTEGRATION) */}
      <section className="py-20 bg-slate-900/60 border-b border-slate-800" id="virtual-tours">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <span className="bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-full px-4 py-1 text-xs font-mono font-bold uppercase inline-block mb-3">
                360° VIRTUAL TOURS • INTERACTIVE WALKTHROUGHS
              </span>
              <h2 className="font-sans font-black text-3xl sm:text-4xl text-white tracking-tight">
                Walk Through Your Space Before Groundbreaking
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-2xl">
                Experience full spatial depth, cove lighting schemes, and custom millwork proportions before pouring concrete. Switch between authentic LDM interactive 360° Kuula collections below.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsTourLoaded(true);
                const tourEl = document.getElementById('virtual-tours');
                if (tourEl) tourEl.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl text-xs font-black flex items-center gap-2 shrink-0 shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-slate-950" />
              <span>Explore Interactive 360° Tour</span>
            </button>
          </div>

          {(() => {
            const kuulaTours = [
              {
                id: 'tour-1',
                tabLabel: '68 SQM Seafront Condominium 360°',
                title: '68 SQM Seafront Condominium — Full Interior 360°',
                subtitle: 'Interactive 360° spatial walkthrough featuring custom fluted wood panelling, smoked-mirror dining feature wall, and modern open-plan condo layout.',
                embedUrl: 'https://kuula.co/share/collection/793SS?logo=1&info=1&fs=1&vr=0&sd=1&autorotate=0.14&autop=20&thumbs=3',
                coverImg: ldmInteriorAssets[0]?.url || ldmHeroShowcaseAssets[1]?.url || '',
                highlights: 'Custom Fluted Wood Panelling • Smoked-Mirror Dining Feature Wall • Modern Open-Plan Layout',
              },
              {
                id: 'tour-2',
                tabLabel: '2-Storey Modern Farmhouse 360°',
                title: 'Modern Farmhouse — 2nd Floor & Master Suite 360°',
                subtitle: 'Full 360° panoramic walkthrough of the 2nd-floor bedroom suites, minimalist white wardrobe millwork, and warm timber flooring.',
                embedUrl: 'https://kuula.co/share/collection/79yKn?logo=1&info=1&fs=1&vr=0&sd=1&autorotate=0.45&autop=20&thumbs=3',
                coverImg: ldmInteriorAssets[1]?.url || ldmHeroShowcaseAssets[3]?.url || '',
                highlights: '2nd-Floor Master Suite • Minimalist White Wardrobe Millwork • Warm Timber Flooring',
              },
            ];
            const currentTour = kuulaTours[activeTourRoom] || kuulaTours[0];

            return (
              <div className="preserve-dark-surface bg-[#0B0F19] border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-5 shadow-2xl" style={{ backgroundColor: '#0B0F19' }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {kuulaTours.map((tour, idx) => (
                      <button
                        key={tour.id}
                        type="button"
                        onClick={() => {
                          setActiveTourRoom(idx);
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold cursor-pointer transition-all ${
                          activeTourRoom === idx
                            ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                            : 'bg-slate-950 border border-slate-800 text-slate-300 hover:border-amber-500/40'
                        }`}
                      >
                        {tour.tabLabel}
                      </button>
                    ))}
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400 font-bold flex items-center gap-1.5">
                    <Compass className="w-4 h-4" />
                    <span>AUTHENTIC LDM KUULA 360° COLLECTION #{activeTourRoom + 1}</span>
                  </span>
                </div>

                <div className="preserve-dark-surface relative h-[420px] sm:h-[540px] rounded-2xl overflow-hidden border border-slate-800 bg-[#0B0F19]" style={{ backgroundColor: '#0B0F19' }}>
                  {isTourLoaded ? (
                    <iframe
                      key={currentTour.id}
                      src={currentTour.embedUrl}
                      title={currentTour.title}
                      className="w-full h-full border-0 rounded-2xl"
                      allowFullScreen
                      loading="lazy"
                      allow="xr-spatial-tracking; gyroscope; accelerometer; fullscreen"
                    />
                  ) : (
                    <>
                      <img
                        src={currentTour.coverImg}
                        alt={currentTour.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/40 flex flex-col items-center justify-center p-6 text-center space-y-4">
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold">
                          <Eye className="w-4 h-4" />
                          <span>INTERACTIVE 360° VIRTUAL WALKTHROUGH</span>
                        </div>
                        <div
                          className="virtual-tour-overlay preserve-dark-surface max-w-xl text-white border border-white/15 p-5 sm:p-6 rounded-2xl shadow-2xl"
                          style={{ backgroundColor: 'rgba(11, 15, 25, 0.84)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
                        >
                          <h3 className="text-xl sm:text-2xl font-black text-white">{currentTour.title}</h3>
                          <p className="tour-subtitle text-xs sm:text-sm text-[#E2E8F0] mt-1">{currentTour.subtitle}</p>
                          <p className="tour-highlights text-[11px] font-mono text-[#FBBF24] mt-2 font-bold">{currentTour.highlights}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsTourLoaded(true)}
                          className="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm rounded-xl cursor-pointer shadow-xl shadow-amber-500/25 flex items-center gap-2.5 transition-all group hover:scale-[1.02]"
                        >
                          <Eye className="w-4 h-4 text-slate-950" />
                          <span>Launch Interactive 360° Tour</span>
                          <ArrowRight className="w-4 h-4 text-slate-950 group-hover:translate-x-1 transition-transform" />
                        </button>
                        <p className="text-[10px] font-mono text-slate-400">
                          Click-to-Load facade ensures fast initial page loads • Kuula WebXR Engine
                        </p>
                      </div>
                    </>
                  )}
                </div>

                <div className="preserve-dark-surface flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#0B0F19] border border-slate-800 rounded-2xl p-3.5 text-xs text-slate-400" style={{ backgroundColor: '#0B0F19' }}>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Real-time panoramic view with gyroscope, full-screen and zoom controls.</span>
                  </div>
                  {isTourLoaded && (
                    <button
                      type="button"
                      onClick={() => setIsTourLoaded(false)}
                      className="text-amber-400 hover:text-amber-300 font-mono font-bold text-xs underline cursor-pointer bg-transparent border-0 p-0"
                    >
                      Reset / Close Embed
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* 6. "AFTER CARE" PILLAR */}
      <section className="py-20 bg-slate-900/40 border-b border-slate-800" id="aftercare">
        <div className="max-w-7xl mx-auto px-6">
          
          <div className="text-center space-y-3 max-w-2xl mx-auto mb-16">
            <span className="bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-full px-4 py-1 text-xs font-mono font-bold uppercase inline-block">
              THE "AFTER CARE" PILLAR
            </span>
            <h2 className="font-sans font-black text-3xl sm:text-4xl text-white tracking-tight">
              Turnkey Accountability After Turnover
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Our commitment never terminates when construction finishes. LDM Construction backs every residential and commercial build with contractual warranties, punch-list rectifications, and occupancy permit closeout.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            
            {/* 01 Punch List */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4 relative shadow-xl hover:border-amber-500/40 transition-colors">
              <span className="font-mono text-4xl font-black text-amber-400/40 block">01</span>
              <h3 className="font-sans font-bold text-lg text-white">Punch List Completion</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Prior to final signoff, our QA inspectors walk the space alongside your management team. Every item is logged into the system and corrected before final acceptance.
              </p>
              <div className="pt-2 text-[11px] font-mono text-amber-400 font-bold flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-amber-400" />
                <span>Subject to Client Approval</span>
              </div>
            </div>

            {/* 02 Warranty */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4 relative shadow-xl hover:border-amber-500/40 transition-colors">
              <span className="font-mono text-4xl font-black text-amber-400/40 block">02</span>
              <h3 className="font-sans font-bold text-lg text-white">Comprehensive Warranty</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                We stand behind our materials and workmanship. Any structural, electrical, or plumbing defect is serviced free of charge within the active warranty period.
              </p>
              <div className="pt-2 text-[11px] font-mono text-emerald-400 font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Free Maintenance & Repairs</span>
              </div>
            </div>

            {/* 03 Permitting Application */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4 relative shadow-xl hover:border-amber-500/40 transition-colors">
              <span className="font-mono text-4xl font-black text-amber-400/40 block">03</span>
              <h3 className="font-sans font-bold text-lg text-white">Occupancy Permitting</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                We manage the end-to-end processing of final Occupancy Permits, Fire Safety Inspection Certificates (FSIC), and LGU municipal clearances.
              </p>
              <div className="pt-2 text-[11px] font-mono text-blue-400 font-bold flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-blue-400" />
                <span>Turnkey Regulatory Clearance</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 7. INTERACTIVE COMMERCIAL FIT-OUT ESTIMATOR */}
      <section className="py-20 bg-slate-950 border-b border-slate-800" id="estimator">
        <div className="max-w-5xl mx-auto px-6">
          
          <div className="text-center space-y-3 mb-12">
            <span className="bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-full px-4 py-1 text-xs font-mono font-bold uppercase inline-block">
              COMMERCIAL TOOLS • ADMIN-CONFIGURED BENCHMARKS
            </span>
            <h2 className="font-sans font-black text-3xl sm:text-4xl text-white tracking-tight">
              LDM Project Cost &amp; Timeline Estimator
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
              Select your Design &amp; Build category, exact floor area (drag the slider or type an exact square meterage), and finish package to preview live timelines and budget estimates.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            
            {/* Input Controls */}
            <div className="md:col-span-7 space-y-6">
              
              {/* Space Type Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-mono text-slate-400 font-bold uppercase">
                  1. SELECT FACILITY TYPOLOGY
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'corporate', label: estimatorConfig.categories.corporate.label },
                      { id: 'bpo', label: estimatorConfig.categories.bpo.label },
                      { id: 'tech', label: estimatorConfig.categories.tech.label },
                      { id: 'retail', label: estimatorConfig.categories.retail.label }
                    ] as const
                  ).map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setEstimatorSpaceType(item.id)}
                      className={`p-3 rounded-xl text-xs cursor-pointer transition-all text-left flex items-center justify-between ${
                        estimatorSpaceType === item.id
                          ? isDark
                            ? 'bg-amber-500/15 border-2 border-amber-500 text-white shadow-md'
                            : 'bg-[#FFFBEB] border-2 border-[#D97706] ring-3 ring-amber-600/12 text-[#0F172A] shadow-xs'
                          : isDark
                            ? 'bg-slate-950 border border-slate-800 text-slate-400 hover:border-slate-700'
                            : 'bg-[#F8FAFC] border border-[#CBD5E1] text-[#1E293B] hover:border-slate-400 shadow-2xs'
                      }`}
                    >
                      <span className={estimatorSpaceType === item.id ? (isDark ? 'font-bold text-white' : 'font-bold text-[#0F172A]') : (isDark ? 'text-slate-400' : 'text-[#1E293B] font-semibold')}>
                        {item.label}
                      </span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${
                        estimatorSpaceType === item.id
                          ? isDark
                            ? 'bg-emerald-950/60 text-[#34D399] border border-emerald-500/30 font-bold'
                            : 'bg-[#D1FAE5] text-[#065F46] border border-[#34D399] font-bold'
                          : isDark
                            ? 'text-slate-500 font-medium'
                            : 'text-[#64748B] font-medium'
                      }`}>
                        ₱{Number(estimatorConfig.categories[item.id].baseRatePerSqm).toLocaleString()}/sqm
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dual Floor Area Control: Synchronized Slider + Exact Numeric Input */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <span className={`${isDark ? 'text-slate-400' : 'text-slate-600'} font-bold`}>2. FLOOR AREA (EXACT SQM):</span>
                  <div className="flex items-center gap-2">
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        min="25"
                        max="5000"
                        step="1"
                        value={estimatorArea}
                        onChange={(e) => handleAreaChange(e.target.value)}
                        aria-label="Exact Floor Area in Square Meters"
                        className={`w-28 ${isDark ? 'bg-slate-950 text-amber-400' : 'bg-white text-amber-600'} border border-amber-500/60 focus:border-amber-400 rounded-xl pl-3 pr-11 py-1.5 text-sm font-mono font-black text-right focus:outline-none focus:ring-2 focus:ring-amber-500/20`}
                      />
                      <span className={`absolute right-2.5 text-[10px] font-mono font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'} pointer-events-none`}>
                        SQM
                      </span>
                    </div>
                  </div>
                </div>
                <input
                  type="range"
                  min="25"
                  max="1000"
                  step="1"
                  value={Math.min(1000, Math.max(25, estimatorArea))}
                  onChange={(e) => handleAreaChange(e.target.value)}
                  className={`w-full h-2 ${isDark ? 'bg-slate-950' : 'bg-slate-200'} rounded-lg cursor-pointer accent-amber-500`}
                />
                <div className={`flex justify-between text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
                  <button type="button" onClick={() => handleAreaChange(67)} className="hover:text-amber-500 transition-colors cursor-pointer">
                    67 sqm (A-Frame / Studio)
                  </button>
                  <button type="button" onClick={() => handleAreaChange(180)} className="hover:text-amber-500 transition-colors cursor-pointer">
                    180 sqm (Standard Home)
                  </button>
                  <button type="button" onClick={() => handleAreaChange(320)} className="hover:text-amber-500 transition-colors cursor-pointer">
                    320 sqm (Luxury Villa)
                  </button>
                  <button type="button" onClick={() => handleAreaChange(500)} className="hover:text-amber-500 transition-colors cursor-pointer">
                    500+ sqm (Multi-Unit)
                  </button>
                </div>
              </div>

              {/* Quality Finish Tier */}
              <div className="space-y-2">
                <label className={`block text-xs font-mono ${isDark ? 'text-slate-400' : 'text-slate-600'} font-bold uppercase`}>
                  3. SPECIFICATION & FINISH TIER
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'standard', label: estimatorConfig.tierLabels.standard, mult: estimatorConfig.tierMultipliers.standard },
                      { id: 'premium', label: estimatorConfig.tierLabels.premium, mult: estimatorConfig.tierMultipliers.premium },
                      { id: 'bespoke', label: estimatorConfig.tierLabels.bespoke, mult: estimatorConfig.tierMultipliers.bespoke }
                    ] as const
                  ).map(tier => (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => setEstimatorTier(tier.id)}
                      className={`p-2.5 rounded-xl text-[11px] font-mono cursor-pointer transition-all text-center flex flex-col items-center justify-center gap-0.5 ${
                        estimatorTier === tier.id
                          ? isDark
                            ? 'bg-amber-500/15 border-2 border-amber-500 text-white shadow-md'
                            : 'bg-[#FFFBEB] border-2 border-[#D97706] ring-3 ring-amber-600/12 text-[#0F172A] shadow-xs'
                          : isDark
                            ? 'bg-slate-950 border border-slate-800 text-slate-400 hover:border-slate-700'
                            : 'bg-[#F8FAFC] border border-[#CBD5E1] text-[#1E293B] hover:border-slate-400 shadow-2xs'
                      }`}
                    >
                      <span className={estimatorTier === tier.id ? (isDark ? 'font-bold text-white' : 'font-bold text-[#0F172A]') : (isDark ? 'text-slate-400' : 'text-[#1E293B] font-semibold')}>
                        {tier.label}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                        estimatorTier === tier.id
                          ? isDark
                            ? 'text-[#34D399] font-bold'
                            : 'text-[#065F46] font-bold'
                          : isDark
                            ? 'text-slate-500 font-medium'
                            : 'text-[#64748B] font-medium'
                      }`}>
                        ₱{Number(currentRates[tier.id]).toLocaleString()}/sqm ({tier.mult}x)
                      </span>
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Results Preview Box */}
            <div className={`md:col-span-5 ${isDark ? 'bg-gradient-to-b from-slate-950 to-slate-900 border-slate-800' : 'bg-[#F8FAFC] border-[#CBD5E1]'} border rounded-2xl p-6 space-y-5 text-center shadow-inner`}>
              <span className={`text-[10px] font-mono uppercase tracking-wider ${isDark ? 'text-amber-400' : 'text-[#0F172A]'} font-bold block`}>
                PRELIMINARY BALLPARK ESTIMATE ({safeEstimatorArea.toLocaleString()} SQM)
              </span>

              <div className="space-y-1">
                <div className={`text-3xl sm:text-4xl font-extrabold font-mono ${isDark ? 'text-amber-400' : 'text-[#B45309]'}`}>
                  ₱{estimatedCost.toLocaleString()}
                </div>
                <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-[#475569]'} font-mono`}>
                  {safeEstimatorArea.toLocaleString()} sqm &times; ₱{ratePerSqm.toLocaleString()}/sqm ({estimatorConfig.tierLabels[estimatorTier]})
                </p>
              </div>

              <div className={`pt-3 border-t ${isDark ? 'border-slate-800 text-slate-300' : 'border-[#CBD5E1] text-slate-700'} grid grid-cols-2 gap-2 text-xs font-mono`}>
                <div className={`${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-[#CBD5E1] shadow-2xs'} p-2.5 rounded-lg border`}>
                  <span className={`text-[9px] ${isDark ? 'text-slate-500' : 'text-[#64748B]'} block`}>EST. TIMELINE</span>
                  <strong className={`${isDark ? 'text-white' : 'text-[#0F172A]'} text-sm`}>~{estimatedWeeks} Weeks</strong>
                </div>
                <div className={`${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-[#CBD5E1] shadow-2xs'} p-2.5 rounded-lg border`}>
                  <span className={`text-[9px] ${isDark ? 'text-slate-500' : 'text-[#64748B]'} block`}>RATE / SQM</span>
                  <strong className={`${isDark ? 'text-emerald-400' : 'text-[#065F46]'} text-sm`}>₱{ratePerSqm.toLocaleString()}</strong>
                </div>
              </div>

              <div className={`text-[10px] ${isDark ? 'text-slate-400 bg-slate-950/70 border-slate-800/80' : 'text-[#475569] bg-white border-[#CBD5E1]'} font-mono text-left leading-relaxed p-3 rounded-lg border`}>
                ✓ Includes Architectural Drawings & 3D Renders<br />
                ✓ Includes Structural, MEPFS & FDAS Engineering<br />
                ✓ Includes City Hall, Subdivision & LGU Permitting Support
              </div>

              <button
                onClick={() => {
                  setProjectScope(`Turnkey Fit-Out (${safeEstimatorArea} sqm ${currentRates.label} - ${estimatorConfig.tierLabels[estimatorTier]})`);
                  setShowQuoteModal(true);
                }}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs cursor-pointer shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5"
              >
                <span>Request Official Line-Item Bid</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* 8. TESTIMONIALS & DESIGN PARTNER ENDORSEMENTS (WITH MODERATED CLIENT REVIEWS) */}
      <section className="py-20 bg-slate-900/60 border-b border-slate-800" id="testimonials">
        <div className="max-w-7xl mx-auto px-6">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 max-w-5xl mx-auto mb-12">
            <div className="space-y-2 text-left">
              <span className="bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-full px-4 py-1 text-xs font-mono font-bold uppercase inline-block">
                REPUTATION & PARTNERSHIPS • VERIFIED CLIENT FEEDBACK
              </span>
              <h2 className="font-sans font-black text-3xl sm:text-4xl text-white tracking-tight">
                Endorsed by Fast-Growing Enterprises
              </h2>
              <p className="text-xs text-slate-400 max-w-xl">
                Read verified post-handover testimonials from our commercial fit-out clients and partner design studios.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setReviewSubmittedSuccess(false);
                setReviewError(null);
                setShowReviewModal(true);
              }}
              className="px-5 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 self-start md:self-auto shrink-0"
            >
              <MessageSquarePlus className="w-4 h-4" />
              <span>Leave a Client Review</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {approvedReviews.map((rev) => {
              const initials = rev.clientName
                .split(' ')
                .map((w) => w[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
              return (
                <div
                  key={rev.id}
                  className="bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-7 space-y-4 shadow-xl flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-amber-400 flex gap-0.5 text-sm" aria-label={`${rev.rating} out of 5 stars`}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span key={i} className={i < rev.rating ? 'text-amber-400' : 'text-slate-700'}>
                            ★
                          </span>
                        ))}
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                        Verified Client
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 italic leading-relaxed">
                      &ldquo;{rev.message}&rdquo;
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 font-black flex items-center justify-center text-xs shrink-0 shadow-sm">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs text-white truncate">{rev.clientName}</h4>
                      <p className="text-[10px] text-slate-400 font-mono truncate">
                        {rev.roleOrLocation || rev.companyOrProject}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* 9. CONTACT SECTION */}
      <section className="py-20 bg-slate-950 border-b border-slate-800" id="contact">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-gradient-to-tr from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl">
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              
              <div className="lg:col-span-6 space-y-6">
                <span className="bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-full px-3.5 py-1 text-xs font-mono font-bold uppercase inline-block">
                  DIRECT CONTACT & QUOTATIONS
                </span>
                <h2 className="font-sans font-black text-3xl sm:text-5xl text-white tracking-tight leading-tight">
                  Let's bring your space into reality.
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Send us your preliminary floor plan, scope of work, or leasing address. Our estimators and licensed project architects will evaluate feasibility and deliver a formal schedule and quotation.
                </p>

                <div className="space-y-3 pt-2 text-xs font-mono">
                  <div className="flex items-center gap-3 text-slate-300">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400 shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <span>LDM Construction — Engineers • Architects • Builders ("Giving Life to Your Dreams")</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-300">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400 shrink-0">
                      <Phone className="w-4 h-4" />
                    </div>
                    <span>
                      <a href="tel:+639456810515" className="hover:text-amber-400 transition-colors" title="Call / Viber / WhatsApp">(+63) 945 681 0515</a> (Phone / Viber / WhatsApp)
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-300">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400 shrink-0">
                      <Mail className="w-4 h-4" />
                    </div>
                    <span>
                      <a href="mailto:ldmengineeringdesign@gmail.com?subject=Design%20%26%20Build%20Inquiry%20-%20LDM%20Construction" className="hover:text-amber-400 transition-colors underline decoration-slate-700 hover:decoration-amber-400" title="Email LDM Construction">ldmengineeringdesign@gmail.com</a>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <a
                      href="https://www.facebook.com/ldm.designbuild"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-500/50 text-amber-300 text-[11px] flex items-center gap-1.5"
                    >
                      <span>Facebook: ldm.designbuild</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href="https://ldmconstruction.my.canva.site/ldmportfolio/interior-designs"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-500/50 text-amber-300 text-[11px] flex items-center gap-1.5"
                    >
                      <span>Design Portfolio</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Interactive Quotation Launcher Box */}
              <div className={`lg:col-span-6 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-[#F4F6F9] border-[#CBD5E1]'} border rounded-2xl p-6 sm:p-8 space-y-4`}>
                <h3 className="font-sans font-bold text-lg text-white">
                  Fast-Track Your Fit-Out Bid
                </h3>
                <p className="text-xs text-slate-400">
                  Fill in your project basics to route directly to our Laguna estimating engineering desk.
                </p>

                {quoteError && !showQuoteModal && (
                  <div className="p-3 bg-red-950/80 border border-red-500/80 rounded-xl text-xs text-red-200 flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="font-medium">{quoteError}</span>
                  </div>
                )}

                {quoteSubmitted && !showQuoteModal && (
                  <div className="p-3.5 bg-emerald-950/80 border border-emerald-600/80 rounded-xl text-xs text-emerald-200 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Quotation request dispatched to <strong>{quoteSubmittedEmail}</strong>!</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setQuoteSubmitted(false)}
                      className="text-[11px] font-mono underline text-emerald-300 hover:text-white cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                <form onSubmit={handleQuoteSubmit} noValidate className="space-y-3.5 text-xs">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Company / Client Name *</label>
                    <input 
                      type="text"
                      required
                      placeholder="e.g. Acme Tech Corporation"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Email Address (with domain) *</label>
                      <input 
                        type="email"
                        required
                        placeholder="operations@acme.com"
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Phone / Mobile *</label>
                      <input 
                        type="tel"
                        required
                        placeholder="0917-000-0000"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Scope / Space Details *</label>
                    <input 
                      type="text"
                      required
                      placeholder="e.g. 250 sqm Office Fit-Out, BGC Taguig"
                      value={projectScope}
                      onChange={(e) => setProjectScope(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingQuote || quoteCooldownSec > 0}
                    className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {isSubmittingQuote
                        ? 'Validating & Dispatching...'
                        : quoteCooldownSec > 0
                        ? `Request Sent • Cooldown (${quoteCooldownSec}s)`
                        : 'Submit to Estimating Desk (ldmengineeringdesign@gmail.com)'}
                    </span>
                  </button>
                </form>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* 10. FOOTER */}
      <footer className="preserve-dark-surface bg-[#0B0F19] text-slate-400 pt-16 pb-8 border-t border-slate-800 font-sans" id="corporate-footer" style={{ backgroundColor: '#0B0F19' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-slate-800">
            
            {/* Brand Profile */}
            <div className="lg:col-span-4 space-y-4 text-left">
              <div className="flex items-center gap-3">
                <div className="bg-white rounded-lg p-1.5 shadow-sm border border-slate-200/80 shrink-0">
                  <img src={PRIMARY_LDM_LOGO} alt="LDM Construction" className="h-9 w-auto object-contain" />
                </div>
                <div>
                  <span className="font-sans font-black text-white text-base tracking-tight block leading-tight">
                    LDM CONSTRUCTION
                  </span>
                  <span className="text-[9px] font-mono text-amber-400 uppercase tracking-widest font-bold">
                    ENGINEERS • ARCHITECTS • BUILDERS
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                "Giving Life to Your Dreams" — Full-service Architectural Design, Custom Interior Fit-Out, &amp; Turnkey Residential/Commercial Construction.
              </p>
              <div className="space-y-2 pt-2 text-xs font-mono text-slate-400">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <a href="mailto:ldmengineeringdesign@gmail.com" className="hover:text-amber-400 transition-colors truncate">
                    ldmengineeringdesign@gmail.com
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <a href="tel:+639456810515" className="hover:text-amber-400 text-slate-300 font-medium transition-colors">
                    (+63) 945 681 0515 <span className="text-slate-500 font-normal">(Viber / WhatsApp)</span>
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <a href="https://www.facebook.com/ldm.designbuild" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition-colors">
                    facebook.com/ldm.designbuild
                  </a>
                </div>
              </div>
            </div>

            {/* Operational Services */}
            <div className="lg:col-span-3 space-y-4 text-left">
              <h4 className="text-[10px] font-mono font-bold text-slate-300 tracking-wider uppercase border-l-2 border-amber-500 pl-2">
                CORE WORKFLOWS
              </h4>
              <ul className="space-y-2.5 text-xs text-slate-400">
                <li><a href="#create" className="hover:text-amber-400 transition-colors">01 Architectural Design &amp; 3D Visualization</a></li>
                <li><a href="#create" className="hover:text-amber-400 transition-colors">02 Structural Engineering &amp; BOM Estimation</a></li>
                <li><a href="#create" className="hover:text-amber-400 transition-colors">03 Permitting (City Hall &amp; LGU Approvals)</a></li>
                <li><a href="#create" className="hover:text-amber-400 transition-colors">04 Master WBS &amp; Gantt Construction Planning</a></li>
                <li><a href="#portfolio-showcase" className="hover:text-amber-400 transition-colors">05 Turnkey Construction &amp; Interior Fit-Out</a></li>
                <li><a href="#aftercare" className="hover:text-amber-400 transition-colors">06 Handover, After-Care &amp; Warranty Support</a></li>
              </ul>
            </div>

            {/* Enterprise ERP Access */}
            <div className="lg:col-span-2 space-y-4 text-left">
              <h4 className="text-[10px] font-mono font-bold text-slate-300 tracking-wider uppercase border-l-2 border-blue-500 pl-2">
                PMS WORKSPACES
              </h4>
              <ul className="space-y-3 text-xs">
                <li>
                  <button onClick={handleSmoothEnterPortal} className="group text-left cursor-pointer transition-colors bg-transparent border-none p-0 block w-full">
                    <div className="flex items-center gap-1.5 text-slate-300 group-hover:text-amber-400 transition-colors">
                      <Activity className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="font-medium">Operations Manager Hub</span>
                    </div>
                    <span className="text-[10px] text-slate-500 block pl-5 font-mono">Executive &amp; Approvals</span>
                  </button>
                </li>
                <li>
                  <button onClick={handleSmoothEnterPortal} className="group text-left cursor-pointer transition-colors bg-transparent border-none p-0 block w-full">
                    <div className="flex items-center gap-1.5 text-slate-300 group-hover:text-blue-400 transition-colors">
                      <HardHat className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="font-medium">Site Engineer &amp; PM Portal</span>
                    </div>
                    <span className="text-[10px] text-slate-500 block pl-5 font-mono">14-Phase Gantt &amp; Field Logs</span>
                  </button>
                </li>
                <li>
                  <button onClick={handleSmoothEnterPortal} className="group text-left cursor-pointer transition-colors bg-transparent border-none p-0 block w-full">
                    <div className="flex items-center gap-1.5 text-slate-300 group-hover:text-emerald-400 transition-colors">
                      <Calculator className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="font-medium">Finance &amp; BOM Commercial</span>
                    </div>
                    <span className="text-[10px] text-slate-500 block pl-5 font-mono">Quotations, Payroll &amp; Ledger</span>
                  </button>
                </li>
                <li>
                  <button onClick={handleSmoothEnterPortal} className="group text-left cursor-pointer transition-colors bg-transparent border-none p-0 block w-full">
                    <div className="flex items-center gap-1.5 text-slate-300 group-hover:text-purple-400 transition-colors">
                      <Clock className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="font-medium">Timekeeper DTR Roll-Call</span>
                    </div>
                    <span className="text-[10px] text-slate-500 block pl-5 font-mono">Artisan Attendance &amp; Muster</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* Design & Build Studio */}
            <div className="lg:col-span-3 space-y-4 text-left">
              <h4 className="text-[10px] font-mono font-bold text-slate-300 tracking-wider uppercase border-l-2 border-emerald-500 pl-2">
                LDM DESIGN & BUILD STUDIO
              </h4>
              <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center gap-2.5">
                  <div className="bg-white rounded-lg p-1.5 shadow-sm border border-slate-200/80 shrink-0">
                    <img src={PRIMARY_LDM_LOGO} alt="LDM Construction" className="h-7 w-auto object-contain" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white leading-tight">LDM Design & Build Studio</h5>
                    <p className="text-[10px] text-slate-400 font-mono">Engineers • Architects • Builders</p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Laguna / CALABARZON &amp; Metro Manila • Residential, Commercial &amp; Custom Interior Design-Build
                </p>
              </div>
            </div>

          </div>

          {/* Regulatory Badges */}
          <div className="py-6 flex flex-wrap items-center justify-between gap-6 border-b border-slate-800 text-[10px] font-mono text-slate-500">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>LGU &amp; CITY HALL BUILDING PERMIT COMPLIANCE</span>
            </div>
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400 shrink-0" />
              <span>SUBDIVISION &amp; HOA ARCHITECTURAL BOARD QUALIFIED</span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
              <span>NBCP (NATIONAL BUILDING CODE) CERTIFIED</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
              <span>FULL MEPFS &amp; FDAS CODE ADHERENCE</span>
            </div>
          </div>

          {/* Legal Notice */}
          <div className="pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] text-slate-500">
            <p>
              &copy; {new Date().getFullYear()} LDM Construction — Engineers • Architects • Builders. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center justify-center md:justify-end gap-3 font-mono">
              <a 
                href="mailto:ldmengineeringdesign@gmail.com?subject=Design%20%26%20Build%20Inquiry%20-%20LDM%20Construction"
                className="hover:text-amber-400 transition-colors cursor-pointer"
                title="Email LDM Construction"
              >
                ldmengineeringdesign@gmail.com
              </a>
              <span>•</span>
              <a 
                href="https://ldmconstruction.my.canva.site/ldmportfolio/interior-designs"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-amber-400 transition-colors cursor-pointer"
              >
                Design Portfolio
              </a>
              <span>•</span>
              <button 
                type="button"
                onClick={() => setShowPrivacyModal(true)}
                className="hover:text-amber-400 transition-colors cursor-pointer text-slate-400 underline underline-offset-2 decoration-slate-700 hover:decoration-amber-400 bg-transparent border-0 p-0 text-[10px] font-mono"
                title="View Privacy Policy & Data Protection Terms"
              >
                Privacy Policy
              </button>
            </div>
          </div>

        </div>
      </footer>

      {/* MODAL: REQUEST A QUOTE / ESTIMATION */}
      {showQuoteModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn overscroll-contain">
          <div className={`${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-2xl'} border rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 animate-slideUp transform-gpu [contain:paint]`}>
            
            <div className={`flex items-center justify-between border-b ${isDark ? 'border-slate-800' : 'border-slate-200'} pb-3`}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-500">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Request Project Quotation</h3>
                  <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'} font-mono`}>Direct to LDM Construction Estimating Desk</p>
                </div>
              </div>
              <button 
                onClick={() => setShowQuoteModal(false)}
                className={`w-8 h-8 rounded-full ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                } flex items-center justify-center text-xs font-bold cursor-pointer transition-colors`}
              >
                ✕
              </button>
            </div>

            {quoteSubmitted ? (
              <div className={`${isDark ? 'bg-emerald-950/80 border-emerald-600 text-emerald-200' : 'bg-emerald-50 border-emerald-300 text-emerald-900'} border text-xs p-6 rounded-2xl text-center space-y-4 animate-fadeIn`}>
                <CheckCircle2 className={`w-12 h-12 ${isDark ? 'text-emerald-400' : 'text-emerald-600'} mx-auto`} />
                <div>
                  <h4 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-emerald-950'}`}>Quotation Request Dispatched!</h4>
                  <p className={`text-[11px] font-mono ${isDark ? 'text-emerald-400' : 'text-emerald-700'} mt-0.5`}>Confirmation Emailed &amp; Synced to Database</p>
                </div>

                <div className={`${isDark ? 'bg-slate-950/80 border-slate-800 text-slate-300' : 'bg-white border-emerald-200 text-slate-700'} border rounded-xl p-3.5 text-left text-[11px] space-y-2`}>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>Formal quotation receipt emailed to: <strong className="text-amber-500">{quoteSubmittedEmail}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>Admin alert dispatched to: <strong className={isDark ? 'text-white' : 'text-slate-900'}>ldmengineeringdesign@gmail.com</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>Permanently logged into LDM Construction ERP System</span>
                  </div>
                </div>

                <p className={`leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Our licensed architects and estimators will review your spatial requirements and contact you within 24 hours to schedule a free ocular site survey.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setShowQuoteModal(false);
                    setQuoteSubmitted(false);
                    setClientName('');
                    setClientEmail('');
                    setClientPhone('');
                    setProjectNotes('');
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs cursor-pointer transition-colors shadow-sm"
                >
                  Close Window
                </button>
              </div>
            ) : (
              <form onSubmit={handleQuoteSubmit} noValidate className="space-y-3.5 text-xs">
                {quoteError && (
                  <div className="p-3 bg-red-950/80 border border-red-500/80 rounded-xl text-xs text-red-200 flex items-center gap-2.5 animate-fadeIn">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="font-medium">{quoteError}</span>
                  </div>
                )}

                <div>
                  <label className={`block ${isDark ? 'text-slate-400' : 'text-slate-700 font-semibold'} mb-1`}>Company or Individual Name *</label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. Engr. & Mrs. Dan Ramos (Proyecto Bahia)"
                    className={`w-full ${isDark ? 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-600' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'} border rounded-xl p-2.5 focus:outline-none focus:border-amber-500`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block ${isDark ? 'text-slate-400' : 'text-slate-700 font-semibold'} mb-1`}>Email Address (with domain) *</label>
                    <input
                      type="email"
                      required
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="hello@company.com"
                      className={`w-full ${isDark ? 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-600' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'} border rounded-xl p-2.5 focus:outline-none focus:border-amber-500 font-mono`}
                    />
                  </div>
                  <div>
                    <label className={`block ${isDark ? 'text-slate-400' : 'text-slate-700 font-semibold'} mb-1`}>Mobile / WhatsApp *</label>
                    <input
                      type="tel"
                      required
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="0917-123-4567"
                      className={`w-full ${isDark ? 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-600' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'} border rounded-xl p-2.5 focus:outline-none focus:border-amber-500`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block ${isDark ? 'text-slate-400' : 'text-slate-700 font-semibold'} mb-1`}>Project Scope / Estimated Area *</label>
                  <input
                    type="text"
                    required
                    value={projectScope}
                    onChange={(e) => setProjectScope(e.target.value)}
                    placeholder="e.g. 2-Storey Modern Residential Build / Interior Fit-Out"
                    className={`w-full ${isDark ? 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-600' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'} border rounded-xl p-2.5 focus:outline-none focus:border-amber-500`}
                  />
                </div>

                <div>
                  <label className={`block ${isDark ? 'text-slate-400' : 'text-slate-700 font-semibold'} mb-1`}>Specific Requirements / Target Move-in Date</label>
                  <textarea
                    rows={3}
                    value={projectNotes}
                    onChange={(e) => setProjectNotes(e.target.value)}
                    placeholder="Provide details such as leased building address, target handover month, or required specialized facilities..."
                    className={`w-full ${isDark ? 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-600' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'} border rounded-xl p-2.5 focus:outline-none focus:border-amber-500`}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingQuote || quoteCooldownSec > 0}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl font-black shadow-lg shadow-amber-500/20 transition-all cursor-pointer mt-2 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmittingQuote ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Dispatching & Sending Email...</span>
                    </>
                  ) : quoteCooldownSec > 0 ? (
                    <>
                      <Clock className="w-4 h-4" />
                      <span>Submission Cooldown ({quoteCooldownSec}s)</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Request to ldmengineeringdesign@gmail.com</span>
                    </>
                  )}
                </button>
              </form>
            )}

          </div>
        </div>
      )}

      {/* MODAL: LEAVE A CLIENT REVIEW (PUBLIC SUBMISSION -> ADMIN APPROVAL QUEUE) */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 animate-fadeIn overscroll-contain">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl animate-slideUp">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Star className="w-4 h-4 fill-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Submit a Client Fit-Out Review</h3>
                  <p className="text-[10px] text-slate-400 font-mono">Moderated Quality Assurance & Client Feedback</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className={`w-8 h-8 rounded-full ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                } flex items-center justify-center text-xs font-bold cursor-pointer transition-colors`}
              >
                ✕
              </button>
            </div>

            {reviewSubmittedSuccess ? (
              <div className="bg-emerald-950/80 border border-emerald-600 text-emerald-200 text-xs p-6 rounded-2xl text-center space-y-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <div>
                  <h4 className="font-bold text-lg text-white">Client Review Submitted for Verification!</h4>
                  <p className="text-[11px] font-mono text-emerald-400 mt-0.5">Status: Pending Admin Moderation</p>
                </div>
                <p className="leading-relaxed text-slate-300">
                  Thank you for sharing your experience with <strong>LDM Construction</strong>. To protect our portfolio against spam, all public reviews enter the <strong>Admin Moderation Queue</strong> and are published immediately upon verification.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowReviewModal(false);
                    setReviewSubmittedSuccess(false);
                    setReviewClientName('');
                    setReviewCompanyProject('');
                    setReviewEmail('');
                    setReviewMessage('');
                    setReviewRating(5);
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs cursor-pointer transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleReviewSubmit} noValidate className="space-y-3.5 text-xs">
                {reviewError && (
                  <div className="p-3 bg-red-950/80 border border-red-500/80 rounded-xl text-xs text-red-200 flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="font-medium">{reviewError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Client / Executive Name *</label>
                    <input
                      type="text"
                      required
                      value={reviewClientName}
                      onChange={(e) => setReviewClientName(e.target.value)}
                      placeholder="e.g. Engr. Paolo Villanueva"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Company / Residential Project *</label>
                    <input
                      type="text"
                      required
                      value={reviewCompanyProject}
                      onChange={(e) => setReviewCompanyProject(e.target.value)}
                      placeholder="e.g. Modern Villa Residence • Laguna"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Corporate Email (Optional)</label>
                    <input
                      type="email"
                      value={reviewEmail}
                      onChange={(e) => setReviewEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Overall Satisfaction Rating *</label>
                    <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const active = (reviewHoverRating || reviewRating) >= star;
                        return (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setReviewRating(star)}
                            onMouseEnter={() => setReviewHoverRating(star)}
                            onMouseLeave={() => setReviewHoverRating(0)}
                            className={`text-lg leading-none cursor-pointer transition-transform hover:scale-110 ${
                              active ? 'text-amber-400' : 'text-slate-700'
                            }`}
                            aria-label={`Rate ${star} stars`}
                          >
                            ★
                          </button>
                        );
                      })}
                      <span className="ml-auto text-[11px] font-mono font-bold text-amber-400">
                        {reviewRating}.0 / 5.0
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Project Handover &amp; Craftsmanship Review *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={reviewMessage}
                    onChange={(e) => setReviewMessage(e.target.value)}
                    placeholder="Share your feedback on our engineering execution, schedule adherence, permitting support, and post-turnover aftercare..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
                    <span>Minimum 15 characters • Reviewed by Admin before public display</span>
                    <span>{reviewMessage.trim().length} / 600</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={reviewCooldownSec > 0}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl font-black shadow-lg shadow-amber-500/20 transition-all cursor-pointer mt-2 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {reviewCooldownSec > 0
                      ? `Rate-Limit Cooldown (${reviewCooldownSec}s)`
                      : 'Submit Client Review for Admin Approval'}
                  </span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ENTERPRISE PRIVACY POLICY & DATA PROTECTION */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 z-50 animate-fadeIn overscroll-contain">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-5 sm:p-7 space-y-5 shadow-2xl animate-slideUp max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white tracking-tight">
                    Corporate Data Privacy Policy
                  </h3>
                  <p className="text-[11px] font-mono text-slate-400">
                    Republic Act No. 10173 (Data Privacy Act of 2012 Compliance)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                className={`w-8 h-8 rounded-full ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                } flex items-center justify-center transition-colors cursor-pointer`}
                title="Close Privacy Policy"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 text-xs text-slate-300 leading-relaxed font-sans scrollbar-thin scrollbar-thumb-slate-800">
              
              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5">
                <p className="font-semibold text-white">
                  Commitment to Confidentiality & Data Integrity
                </p>
                <p className="text-slate-400 text-[11px]">
                  LDM Construction (Engineers • Architects • Builders) is fully dedicated to safeguarding personal and proprietary project information entrusted by clients, corporate partners, and site contractors in accordance with Republic Act No. 10173 (Data Privacy Act of 2012) and its Implementing Rules and Regulations.
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-100 flex items-center gap-1.5 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  1. Information We Collect
                </h4>
                <p className="text-slate-400">
                  When you submit a fit-out estimation request, upload CAD plans, or engage our turnkey contracting services, we collect:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-400 text-[11px]">
                  <li><strong>Client Identification:</strong> Name, corporate business name, designated contact person, official email address, and phone numbers.</li>
                  <li><strong>Engineering & Technical Data:</strong> Building location, floor plans, CAD drawings, Bill of Quantities (BOQ), and fit-out architectural specifications.</li>
                  <li><strong>Statutory & Jobsite Records:</strong> LGU City Hall building permits, subdivision HOA clearances, contractor workforce deployment rosters, daily safety logs, and QA defect punchlists.</li>
                </ul>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-100 flex items-center gap-1.5 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  2. Purpose and Utilization of Data
                </h4>
                <p className="text-slate-400">
                  Collected information is utilized exclusively for genuine operational requirements:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-400 text-[11px]">
                  <li>Calibrating accurate commercial fit-out proposals, cost estimates, and timelines.</li>
                  <li>Processing statutory building clearances with the City Building Official, Bureau of Fire Protection (BFP), and property administration.</li>
                  <li>Managing trade craft dispatch, material procurement logistics, and QA punchlist closeout.</li>
                </ul>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-100 flex items-center gap-1.5 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  3. Non-Disclosure & Blueprint Intellectual Property
                </h4>
                <p className="text-slate-400">
                  All submitted architectural blueprints, interior designs, and construction concepts remain the intellectual property of the client or designer. LDM Construction enforces strict Non-Disclosure Agreement (NDA) protocols. We never sell, lease, or monetize client data to third parties.
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-100 flex items-center gap-1.5 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  4. Data Security & Storage Controls
                </h4>
                <p className="text-slate-400">
                  Technical and operational safeguards include SSL/TLS 256-bit encryption in transit, isolated cloud database infrastructure (Neon PostgreSQL), and restricted role-based administrative access (Operations Directorate, Field PM, and Finance).
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-100 flex items-center gap-1.5 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  5. Inquiries & Data Protection Officer (DPO)
                </h4>
                <p className="text-slate-400">
                  To request data access, correction, or inquire regarding our compliance standards, contact our compliance desk:
                </p>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[11px] text-slate-300 space-y-1">
                  <div><strong>Email:</strong> <a href="mailto:ldmengineeringdesign@gmail.com" className="text-amber-400 hover:underline">ldmengineeringdesign@gmail.com</a></div>
                  <div><strong>Phone / Viber / WhatsApp:</strong> (+63) 945 681 0515</div>
                  <div><strong>Company:</strong> LDM Construction — Engineers • Architects • Builders</div>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between shrink-0">
              <span className="text-[10px] text-slate-500 font-mono">
                SEC & PCAB Registered Commercial General Contractor
              </span>
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close & Return
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: FULL-SCREEN ZERO-LAG LIGHTBOX FOR 120-ASSET GALLERY */}
      {lightboxAsset && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-fadeIn"
          onClick={() => setLightboxAsset(null)}
        >
          <div
            className="preserve-dark-surface relative max-w-5xl w-full bg-[#0B0F19] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            style={{ backgroundColor: '#0B0F19' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lightbox Header */}
            <div className="preserve-dark-surface p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-3">
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold px-2.5 py-1 rounded-full uppercase">
                  {lightboxAsset.categoryLabel}
                </span>
                <span className="text-white font-bold text-sm hidden sm:inline">
                  {lightboxAsset.title}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold tracking-wider text-amber-400/90 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full hidden sm:inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-3 h-3 text-amber-400" />
                  LDM DESIGN &amp; BUILD • VERIFIED PORTFOLIO
                </span>
                <button
                  type="button"
                  onClick={() => setLightboxAsset(null)}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-100 hover:text-white border border-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Lightbox Active Photo (Zero Lag - mounts strictly 1 active image) */}
            <div className="relative flex-1 bg-slate-950 flex items-center justify-center overflow-hidden min-h-[300px] sm:min-h-[500px]">
              <img
                src={lightboxAsset.url}
                alt={lightboxAsset.title}
                className="max-h-[70vh] w-auto max-w-full object-contain mx-auto"
                loading="eager"
                decoding="async"
              />

              {/* Prev / Next navigation */}
              {(() => {
                const currentList =
                  portfolioTab === 'all'
                    ? allLdmPortfolioAssets
                    : portfolioTab === 'architectural'
                    ? ldmArchitecturalAssets
                    : portfolioTab === 'interior'
                    ? ldmInteriorAssets
                    : portfolioTab === 'construction'
                    ? ldmSiteConstructionAssets
                    : allLdmPortfolioAssets;
                const curIdx = currentList.findIndex((a) => a.id === lightboxAsset.id);

                const handlePrev = () => {
                  const prevIdx = (curIdx - 1 + currentList.length) % currentList.length;
                  setLightboxAsset(currentList[prevIdx]);
                };
                const handleNext = () => {
                  const nextIdx = (curIdx + 1) % currentList.length;
                  setLightboxAsset(currentList[nextIdx]);
                };

                return (
                  <>
                    <button
                      type="button"
                      onClick={handlePrev}
                      className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-900/80 hover:bg-amber-500 hover:text-slate-950 text-white border border-slate-700 transition-all cursor-pointer shadow-lg"
                      title="Previous Photo"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-900/80 hover:bg-amber-500 hover:text-slate-950 text-white border border-slate-700 transition-all cursor-pointer shadow-lg"
                      title="Next Photo"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                );
              })()}
            </div>

            {/* Lightbox Footer Actions */}
            <div className="preserve-dark-surface p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-slate-400 font-mono text-[11px] flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>LDM Construction • Engineers • Architects • Builders — Official Project Archive</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setProjectScope(`${lightboxAsset.title} (${lightboxAsset.categoryLabel})`);
                    setLightboxAsset(null);
                    setShowQuoteModal(true);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Inquire Regarding This Project ➔</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
