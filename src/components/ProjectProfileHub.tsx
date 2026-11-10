/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Building2, Users, CheckCircle2, TrendingUp, DollarSign, Calendar,
  Layers, Plus, ExternalLink, ShieldCheck, Clock, FileText, ArrowRight,
  X, AlertCircle, Edit3, Trash2, Check, Sliders, HardHat, Search, Download, HelpCircle, FileSpreadsheet, Lock,
  MapPin, CloudSun, RefreshCw, LayoutGrid, Table, Eye, PieChart as PieChartIcon, Loader2, Sparkles, AlertTriangle
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ReTooltip, Legend } from 'recharts';
import { ProjectProfile, ProjectTask, Contractor, WorkforceReallocationRecommendation, ProjectRFI, ChangeOrder } from '../types';
import { generateReallocationRecommendations } from '../services/WorkforceReallocationService';
import { exportToCsv } from '../utils/exportUtils';
import {
  resolveLocalGeocoding,
  resolveProjectCoordinatesAsync,
  resolveProjectCoordinatesSync,
  GeocodedLocation,
  searchLocationsNationwide,
  LocationSuggestion
} from '../utils/geocoding';

export const AVAILABLE_PMS = [
  { id: 'usr-pm-ricardo', name: 'Engr. Ricardo Ramos (Senior Project Manager)' },
  { id: 'usr-pm-carlos', name: 'Engr. Carlos Mendoza (Civil & Site Operations Lead)' },
  { id: 'usr-pm-jonathan', name: 'Ar. Jonathan Dela Cruz (Principal Architect & Design Lead)' },
  { id: 'usr-pm-marco', name: 'Principal Architect Marco Alcantara (Lead Designer)' },
];

export function calculateProjectProgress(
  projectId: string,
  tasks: ProjectTask[] = [],
  fallbackProgress: number = 0
): number {
  const projectTasks = tasks.filter(t => t.projectId === projectId);
  if (!projectTasks || projectTasks.length === 0) {
    return Math.round(fallbackProgress);
  }
  // Standard CPM Duration-Weighted Physical Progress
  const totalDuration = projectTasks.reduce((acc, curr) => acc + Math.max(1, curr.duration || 1), 0);
  const weightedProgress = projectTasks.reduce((acc, curr) => {
    let p = 0;
    if (curr.status === 'COMPLETED' || (typeof curr.progress === 'number' && curr.progress >= 1.0)) {
      p = 100;
    } else {
      const raw = typeof curr.progress === 'number' ? curr.progress : 0;
      p = raw > 1.0 ? raw : raw * 100;
    }
    return acc + (p * Math.max(1, curr.duration || 1));
  }, 0);
  return totalDuration > 0 ? Math.round(weightedProgress / totalDuration) : 0;
}

export function getEffectiveProjectStatus(
  status: ProjectProfile['status'] | string,
  progress: number
): ProjectProfile['status'] {
  if (progress > 0 && (status === 'PLANNING' || !status)) {
    return 'IN_PROGRESS';
  }
  return (status || 'PLANNING') as ProjectProfile['status'];
}

interface ProjectProfileHubProps {
  projects: ProjectProfile[];
  tasks: ProjectTask[];
  contractors: Contractor[];
  rfis?: ProjectRFI[];
  changeOrders?: ChangeOrder[];
  userRole?: string;
  isAdmin?: boolean;
  loading?: boolean;
  onSelectProject?: (project: ProjectProfile) => void;
  onUpdateProjectProgress?: (projectId: string, progress: number) => void;
  onCreateProject?: (project: Partial<ProjectProfile>) => Promise<void> | void;
  onUpdateProject?: (projectId: string, updates: Partial<ProjectProfile>) => Promise<void> | void;
  onDeleteProject?: (projectId: string) => Promise<void> | void;
  onNavigateToTab?: (tab: string, projectId?: string) => void;
}

export default function ProjectProfileHub({
  projects = [],
  tasks = [],
  contractors = [],
  rfis = [],
  changeOrders = [],
  userRole = 'Admin',
  isAdmin = true,
  loading = false,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  onNavigateToTab
}: ProjectProfileHubProps) {
  // Only show loading if there is zero data AND it's an initial cold boot
  const isInitialColdLoad = Boolean(loading && projects.length === 0);

  // Local state initialized strictly from live database projects
  const [localProjects, setLocalProjects] = useState<ProjectProfile[]>(projects || []);

  // Sync when parent projects prop updates from database
  React.useEffect(() => {
    setLocalProjects(projects || []);
  }, [projects]);

  const [selectedProject, setSelectedProject] = useState<ProjectProfile | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<'general' | 'timeline' | 'personnel'>('general');
  const [activeTabInsideProfile, setActiveTabInsideProfile] = useState<'OVERVIEW' | 'FINANCIALS' | 'WORKERS'>('OVERVIEW');

  // Workforce Reallocation State
  const [showReallocationModal, setShowReallocationModal] = useState<boolean>(false);
  const [activeReallocProject, setActiveReallocProject] = useState<ProjectProfile | null>(null);
  const [reallocRecommendations, setReallocRecommendations] = useState<WorkforceReallocationRecommendation[]>([]);
  const [isReallocating, setIsReallocating] = useState<boolean>(false);
  const [reallocFeedback, setReallocFeedback] = useState<string | null>(null);

  // Form State for New / Edit - Strictly initialized to empty/0
  const [formName, setFormName] = useState('');
  const [formClient, setFormClient] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formBudget, setFormBudget] = useState(0);
  const [formCollected, setFormCollected] = useState(0);
  const [formProgress, setFormProgress] = useState(0);
  const [formStatus, setFormStatus] = useState<ProjectProfile['status'] | ''>('');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [formEndDate, setFormEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [formWorkers, setFormWorkers] = useState(0);
  const [formTasksCount, setFormTasksCount] = useState(0);
  const [formMilestonesCount, setFormMilestonesCount] = useState(0);
  const [formIsPrivateAccounting, setFormIsPrivateAccounting] = useState<boolean>(false);
  const [formPMId, setFormPMId] = useState<string>('');
  const [formPMName, setFormPMName] = useState<string>('');
  const [availablePMs, setAvailablePMs] = useState<{ id: string; name: string }[]>(AVAILABLE_PMS);

  // Geocoding Coordinates State for Live Weather Station Sync
  const [detectedCoords, setDetectedCoords] = useState<GeocodedLocation | null>(null);
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);

  // Live Place Autocomplete State (Google Maps Style)
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState<boolean>(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState<boolean>(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number>(-1);
  const isLocationSelectedRef = useRef<boolean>(false);
  const locationDropdownRef = useRef<HTMLDivElement>(null);

  // Close location autocomplete dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(event.target as Node)) {
        setShowLocationDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Recent places history (stored in localStorage)
  const getRecentPlaces = (): LocationSuggestion[] => {
    try {
      return JSON.parse(localStorage.getItem('ctvill_recent_places') || '[]');
    } catch {
      return [];
    }
  };

  const saveRecentPlace = (s: LocationSuggestion) => {
    try {
      const existing = getRecentPlaces().filter(p => p.fullAddress !== s.fullAddress);
      const updated: LocationSuggestion[] = [{ ...s, isRecent: true }, ...existing].slice(0, 5);
      localStorage.setItem('ctvill_recent_places', JSON.stringify(updated));
    } catch { }
  };

  // Google Maps bold matched query renderer
  const renderHighlightedMatch = (text: string, query: string) => {
    if (!query || !query.trim()) return <span>{text}</span>;
    const q = query.trim();
    const index = text.toLowerCase().indexOf(q.toLowerCase());
    if (index !== -1) {
      const before = text.slice(0, index);
      const match = text.slice(index, index + q.length);
      const after = text.slice(index + q.length);
      return (
        <>
          {before}
          <strong className="font-bold text-white">{match}</strong>
          {after}
        </>
      );
    }
    const words = q.split(/\s+/).filter(w => w.length > 1);
    if (words.length === 0) return <span>{text}</span>;
    const regex = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <strong key={i} className="font-bold text-white">{part}</strong>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    );
  };

  // Debounced (200ms) Live Place Autocomplete search as user types
  useEffect(() => {
    if (isLocationSelectedRef.current) {
      isLocationSelectedRef.current = false;
      return;
    }

    if (!formLocation || formLocation.trim().length < 2) {
      const recents = getRecentPlaces();
      if (recents.length > 0 && formLocation.trim().length === 0) {
        setLocationSuggestions(recents);
      } else {
        setLocationSuggestions([]);
        setShowLocationDropdown(false);
      }
      setIsSearchingLocation(false);
      return;
    }

    setIsSearchingLocation(true);
    const searchTimer = setTimeout(async () => {
      try {
        const liveResults = await searchLocationsNationwide(formLocation);
        const norm = formLocation.trim().toLowerCase();
        const matchingRecents = getRecentPlaces().filter(p =>
          p.displayName.toLowerCase().includes(norm) || p.subLabel.toLowerCase().includes(norm)
        );

        // Merge matching recents at top, followed by live map results without duplicates
        const seen = new Set<string>();
        const combined: LocationSuggestion[] = [];
        for (const r of matchingRecents) {
          const key = `${r.lat.toFixed(4)},${r.lng.toFixed(4)}`;
          seen.add(key);
          combined.push({ ...r, isRecent: true });
        }
        for (const l of liveResults) {
          const key = `${l.lat.toFixed(4)},${l.lng.toFixed(4)}`;
          if (!seen.has(key)) {
            seen.add(key);
            combined.push(l);
          }
        }

        setLocationSuggestions(combined);
        setShowLocationDropdown(combined.length > 0);
        setSelectedSuggestionIndex(-1);
      } catch {
        setLocationSuggestions([]);
      } finally {
        setIsSearchingLocation(false);
      }
    }, 200);

    return () => clearTimeout(searchTimer);
  }, [formLocation]);

  const handleSelectLocation = (suggestion: LocationSuggestion) => {
    isLocationSelectedRef.current = true;
    saveRecentPlace(suggestion);
    setFormLocation(suggestion.fullAddress);
    setDetectedCoords({
      name: `${suggestion.displayName}, ${suggestion.subLabel}`,
      region: suggestion.subLabel,
      lat: suggestion.lat,
      lon: suggestion.lng,
      confidence: 'EXACT_COORDINATES',
      isExactMatch: true
    });
    setShowLocationDropdown(false);
    setSelectedSuggestionIndex(-1);
  };

  const handleLocationKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showLocationDropdown || locationSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => (prev < locationSuggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => (prev > 0 ? prev - 1 : locationSuggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < locationSuggestions.length) {
        e.preventDefault();
        handleSelectLocation(locationSuggestions[selectedSuggestionIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowLocationDropdown(false);
    }
  };

  const handleLocationFocus = () => {
    if (formLocation.trim().length < 2) {
      const recents = getRecentPlaces();
      if (recents.length > 0) {
        setLocationSuggestions(recents);
        setShowLocationDropdown(true);
      }
    } else if (locationSuggestions.length > 0) {
      setShowLocationDropdown(true);
    }
  };

  // Auto-resolve geocoding whenever formLocation changes if no exact suggestion was selected
  useEffect(() => {
    if (!formLocation || !formLocation.trim()) {
      setDetectedCoords(null);
      return;
    }

    // If coordinates were explicitly selected or custom entered, lock them
    if (detectedCoords?.confidence === 'EXACT_COORDINATES' && isLocationSelectedRef.current) {
      return;
    }

    // 1. Instant local dictionary check
    const localMatch = resolveLocalGeocoding(formLocation);
    if (localMatch) {
      setDetectedCoords(localMatch);
      // If it's already an exact barangay or explicit GPS coordinates, no need for network call
      if (localMatch.isExactMatch || localMatch.confidence === 'EXACT_COORDINATES') {
        return;
      }
    }

    // 2. Debounced online geocoding check (300ms) with OpenStreetMap Nominatim for exact barangay
    setIsGeocoding(true);
    const timer = setTimeout(async () => {
      try {
        const asyncMatch = await resolveProjectCoordinatesAsync(formLocation, formName);
        if (asyncMatch) {
          setDetectedCoords(asyncMatch);
        }
      } catch {
        // Ignore network errors, keep localMatch if available
      } finally {
        setIsGeocoding(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [formLocation, formName]);

  // Worker assignment state (Workers tab in project profile)
  const [workerSearchQuery, setWorkerSearchQuery] = useState('');
  const [isAssigningWorker, setIsAssigningWorker] = useState(false);

  // Worker assignment state during Project Creation / Edit Modal (Decoupled Manual Draft vs. Staged AI)
  const [formAssignedWorkerIds, setFormAssignedWorkerIds] = useState<string[]>([]);
  const [modalWorkerSearchQuery, setModalWorkerSearchQuery] = useState('');
  const [modalWorkerTradeFilter, setModalWorkerTradeFilter] = useState('ALL');
  const [showAiCrewGuide, setShowAiCrewGuide] = useState(false);
  const [dismissedStagedWorkerIds, setDismissedStagedWorkerIds] = useState<string[]>([]);
  const [workerAllocationSourceMap, setWorkerAllocationSourceMap] = useState<Record<string, 'Manual' | 'AI'>>({});
  const [workerOverrideNotes, setWorkerOverrideNotes] = useState<Record<string, string>>({});
  const [workerAdminLocks, setWorkerAdminLocks] = useState<Record<string, boolean>>({});
  const [activeNoteEditorWorkerId, setActiveNoteEditorWorkerId] = useState<string | null>(null);

  // Human Override Protection Lock check: strictly true if locked by Admin or has a manual override note
  const isWorkerLockedByAdmin = (w: Contractor): boolean => {
    const note = (workerOverrideNotes[w.id] ?? w.manualOverrideNote ?? '').trim();
    return Boolean(workerAdminLocks[w.id] || w.isLockedByAdmin || note.length > 0);
  };

  const handleUpdateWorkerOverrideNote = (workerId: string, note: string) => {
    setWorkerOverrideNotes(prev => ({ ...prev, [workerId]: note }));
    const hasNote = note.trim().length > 0;
    setWorkerAdminLocks(prev => ({ ...prev, [workerId]: hasNote ? true : prev[workerId] }));
    setWorkerAllocationSourceMap(prev => ({ ...prev, [workerId]: 'Manual' }));
  };

  const handleToggleWorkerAdminLock = (workerId: string, currentLock: boolean) => {
    setWorkerAdminLocks(prev => ({ ...prev, [workerId]: !currentLock }));
    setWorkerAllocationSourceMap(prev => ({ ...prev, [workerId]: 'Manual' }));
  };

  // Resolve daily wage rate (₱/day) for a worker/contractor entity
  const getWorkerDailyRate = (w: Contractor): number => {
    if (w.dailyRate && Number(w.dailyRate) > 0) return Math.round(Number(w.dailyRate));
    if (w.monthlySalary && Number(w.monthlySalary) > 0) return Math.round(Number(w.monthlySalary) / 26);
    const trade = (w.tradeType || w.specialty || w.roleTitle || '').toLowerCase();
    if (trade.includes('foreman') || trade.includes('engineer') || trade.includes('architect')) return 1200;
    if (trade.includes('electrician') || trade.includes('plumber') || trade.includes('welder') || trade.includes('carpenter') || trade.includes('mason')) return 950;
    return 800;
  };

  // Non-Blocking Overlap & Availability Cross-Reference against startDate & targetHandoverDate
  const getWorkerAvailabilityAdvisory = (
    w: Contractor,
    targetStart?: string,
    targetEnd?: string,
    excludeProjectId?: string
  ): { isOverlapping: boolean; overlappingProjects: string[]; badgeText: string } => {
    const activeProjects = localProjects.filter(
      p => p.id !== excludeProjectId && p.status !== 'COMPLETED' && p.status !== 'HANDED_OVER'
    );

    const overlappingNames: string[] = [];
    const reqStart = targetStart ? new Date(targetStart).getTime() : NaN;
    const reqEnd = targetEnd ? new Date(targetEnd).getTime() : NaN;
    const hasValidTargetDates = !isNaN(reqStart) && !isNaN(reqEnd);

    for (const proj of activeProjects) {
      const isAssignedById = (proj.assignedContractorIds || []).includes(w.id) || w.assignedProjectId === proj.id;
      const isAssignedBySiteName = Boolean(
        w.activeProjectSite &&
        !w.activeProjectSite.toLowerCase().includes('standby') &&
        proj.name.trim().toLowerCase() === w.activeProjectSite.trim().toLowerCase()
      );

      if (!isAssignedById && !isAssignedBySiteName) continue;

      const projStart = proj.startDate ? new Date(proj.startDate).getTime() : NaN;
      const projEnd = proj.targetHandoverDate ? new Date(proj.targetHandoverDate).getTime() : NaN;
      const hasValidProjDates = !isNaN(projStart) && !isNaN(projEnd);

      const datesOverlap =
        hasValidTargetDates && hasValidProjDates
          ? reqStart <= projEnd && reqEnd >= projStart
          : true;

      if (datesOverlap && !overlappingNames.includes(proj.name)) {
        overlappingNames.push(proj.name);
      }
    }

    if (overlappingNames.length > 0) {
      const primary = overlappingNames[0];
      const extra = overlappingNames.length > 1 ? ` (+${overlappingNames.length - 1})` : '';
      return {
        isOverlapping: true,
        overlappingProjects: overlappingNames,
        badgeText: `⚠️ Advisory: Active on ${primary}${extra}`
      };
    }

    return {
      isOverlapping: false,
      overlappingProjects: [],
      badgeText: 'Available'
    };
  };

  // Explainable AI Crew Suggestion Generator (Strictly skips isLockedByAdmin workers)
  const aiCrewSuggestions = useMemo(() => {
    const currentEditingId = showEditModal && selectedProject ? selectedProject.id : undefined;
    const scopeText = `${formName} ${formDescription}`.toLowerCase();

    const desiredTrades: { keyword: string; matchTerms: string[]; reason: string }[] = [
      { keyword: 'Foreman', matchTerms: ['foreman', 'lead', 'supervisor'], reason: 'Site supervision & crew coordination' },
      { keyword: 'Carpenter', matchTerms: ['carpenter', 'carpentry', 'partition', 'fit-out', 'ceiling', 'wood', 'architectural'], reason: 'Architectural fit-out & carpentry scope' },
      { keyword: 'Electrician', matchTerms: ['electrician', 'electrical', 'mep', 'lighting', 'power', 'wiring'], reason: 'MEP & electrical roughing-in' },
      { keyword: 'Mason', matchTerms: ['mason', 'masonry', 'civil', 'concrete', 'tile', 'structural', 'wall'], reason: 'Civil works & masonry finishing' },
      { keyword: 'Plumber', matchTerms: ['plumber', 'plumbing', 'sanitary', 'water', 'pipe', 'mep'], reason: 'Plumbing & sanitary line installation' },
      { keyword: 'Painter', matchTerms: ['painter', 'painting', 'finish', 'coating', 'interior'], reason: 'Surface finishing & protective coating' },
      { keyword: 'Welder', matchTerms: ['welder', 'steel', 'metal', 'structural', 'fabrication'], reason: 'Structural steel & metal fabrication' }
    ];

    // Strictly skip any worker flagged as isLockedByAdmin
    const eligibleContractors = contractors.filter(w => !isWorkerLockedByAdmin(w));

    const scoredWorkers = eligibleContractors.map(w => {
      const tradeStr = (w.tradeType || w.specialty || w.roleTitle || 'General').toLowerCase();
      const avail = getWorkerAvailabilityAdvisory(w, formStartDate, formEndDate, currentEditingId);
      const rate = getWorkerDailyRate(w);

      // Check scope trade match
      let matchedTradeReason = '';
      for (const dt of desiredTrades) {
        if (dt.matchTerms.some(t => tradeStr.includes(t))) {
          const scopeMentions = dt.matchTerms.some(t => scopeText.includes(t));
          matchedTradeReason = scopeMentions
            ? `Trade (${w.tradeType || w.specialty || dt.keyword}) directly matches project scope`
            : `Core ${w.tradeType || w.specialty || dt.keyword} trade matches commercial fit-out scope`;
          break;
        }
      }
      if (!matchedTradeReason) {
        matchedTradeReason = `Trade (${w.tradeType || w.specialty || 'General'}) supports general site execution`;
      }

      const rateFitsBudget = formBudget <= 0 || rate <= Math.max(1500, formBudget * 0.02);

      // 4-Factor Scoring Model (Trade Alignment /35, Availability /30, Budget Fit /20, Performance /15)
      const tradeScore = matchedTradeReason.includes('directly') ? 35 : 28;
      const availabilityScore = avail.isOverlapping ? 12 : 30;
      const budgetScore = rateFitsBudget ? 20 : 12;
      const perfScore = Math.min(15, Math.max(10, Math.round(((w.rating || 4.5) / 5) * 15)));
      const score = tradeScore + availabilityScore + budgetScore + perfScore;

      const rationaleParts = [
        'Trade matches scope',
        avail.isOverlapping ? `Active on ${avail.overlappingProjects[0]} (Dual-site advisory)` : 'Currently Available',
        rateFitsBudget ? `Rate fits budget (₱${rate.toLocaleString()}/day)` : `Standard rate (₱${rate.toLocaleString()}/day)`
      ];

      return {
        worker: w,
        rate,
        avail,
        score,
        fourFactorBreakdown: `Trade ${tradeScore}/35 • Avail ${availabilityScore}/30 • Budget ${budgetScore}/20 • Rating ${perfScore}/15`,
        rationale: `Recommended: ${rationaleParts.join(' • ')}`
      };
    });

    // Sort by highest fit score, pick diverse trade composition (up to 5 workers)
    scoredWorkers.sort((a, b) => b.score - a.score);
    const picked: typeof scoredWorkers = [];
    const seenTrades = new Set<string>();

    for (const item of scoredWorkers) {
      if (picked.length >= 5) break;
      const tKey = (item.worker.tradeType || item.worker.specialty || 'General').toLowerCase();
      if (!seenTrades.has(tKey) || picked.length < 3) {
        picked.push(item);
        seenTrades.add(tKey);
      }
    }

    const baseList = picked.length > 0 ? picked : scoredWorkers.slice(0, 4);
    return baseList.filter(item => !dismissedStagedWorkerIds.includes(item.worker.id));
  }, [contractors, localProjects, formName, formDescription, formBudget, formStartDate, formEndDate, showEditModal, selectedProject, workerOverrideNotes, workerAdminLocks, dismissedStagedWorkerIds]);

  // Live Advisory Labor Cost Estimator (Step 3: Leadership & Crew)
  const advisoryLaborEstimator = useMemo(() => {
    const selectedWorkersList = contractors.filter(c => formAssignedWorkerIds.includes(c.id));
    const headcount = selectedWorkersList.length;
    const combinedDailyRate = selectedWorkersList.reduce((sum, w) => sum + getWorkerDailyRate(w), 0);

    const sTime = formStartDate ? new Date(formStartDate).getTime() : NaN;
    const eTime = formEndDate ? new Date(formEndDate).getTime() : NaN;
    const rawCalendarDays = !isNaN(sTime) && !isNaN(eTime)
      ? Math.ceil((eTime - sTime) / (1000 * 60 * 60 * 24))
      : 0;
    // Use 6-day workweek conversion when timeline > 0 days, or default 30 working days preview when dates are same/unset
    const estimatedWorkingDays = rawCalendarDays > 0 ? Math.max(1, Math.round(rawCalendarDays * (6 / 7))) : 30;
    const projectedLaborCost = combinedDailyRate * estimatedWorkingDays;
    const contractBudget = Number(formBudget) || 0;
    const budgetRatioPct = contractBudget > 0 ? (projectedLaborCost / contractBudget) * 100 : 0;
    const isHighLaborBurn = contractBudget > 0 && budgetRatioPct > 40;

    return {
      headcount,
      combinedDailyRate,
      estimatedWorkingDays,
      projectedLaborCost,
      contractBudget,
      budgetRatioPct,
      isHighLaborBurn
    };
  }, [contractors, formAssignedWorkerIds, formStartDate, formEndDate, formBudget]);

  // Trade specialties synced from contractor roster & workforce masterlist
  const availableTrades = useMemo(() => {
    const tradeSet = new Set<string>();
    contractors.forEach(c => {
      const t = (c.tradeType || c.specialty || '').trim();
      if (t) tradeSet.add(t);
    });
    const standardTrades = ['General', 'Mason', 'Carpenter', 'Electrician', 'Plumber', 'Welder', 'Painter', 'Foreman', 'Laborer'];
    standardTrades.forEach(st => tradeSet.add(st));
    return ['ALL', ...Array.from(tradeSet).sort()];
  }, [contractors]);

  // Toggle worker selection and auto-sync headcount (strictly marks Source: Manual)
  const toggleWorkerSelection = (workerId: string) => {
    setWorkerAllocationSourceMap(prev => ({ ...prev, [workerId]: 'Manual' }));
    setFormAssignedWorkerIds(prev => {
      const next = prev.includes(workerId)
        ? prev.filter(id => id !== workerId)
        : [...prev, workerId];
      setFormWorkers(next.length);
      return next;
    });
  };

  // Accept a single staged AI suggestion into Draft
  const handleAcceptStagedSuggestion = (workerId: string) => {
    setWorkerAllocationSourceMap(prev => ({ ...prev, [workerId]: 'AI' }));
    setFormAssignedWorkerIds(prev => {
      if (prev.includes(workerId)) return prev;
      const next = [...prev, workerId];
      setFormWorkers(next.length);
      return next;
    });
  };

  // Dismiss a single staged AI suggestion from the staging panel without touching manual checkboxes
  const handleDismissStagedSuggestion = (workerId: string) => {
    setDismissedStagedWorkerIds(prev => (prev.includes(workerId) ? prev : [...prev, workerId]));
  };

  // Master action: Apply All Suggestions to Draft (respecting isLockedByAdmin manual selections)
  const handleApplyAllStagedSuggestionsToDraft = () => {
    const suggestedIds = aiCrewSuggestions.map(s => s.worker.id);
    setWorkerAllocationSourceMap(prev => {
      const nextMap = { ...prev };
      suggestedIds.forEach(id => {
        if (!prev[id]) nextMap[id] = 'AI';
      });
      return nextMap;
    });
    setFormAssignedWorkerIds(prev => {
      const merged = Array.from(new Set([...prev, ...suggestedIds]));
      setFormWorkers(merged.length);
      return merged;
    });
  };

  useEffect(() => {
    fetch('/api/users?role=PROJECT_MANAGER')
      .then(res => res.ok ? res.json() : null)
      .then(users => {
        if (Array.isArray(users) && users.length > 0) {
          setAvailablePMs(users.map((u: any) => ({
            id: u.id,
            name: `${u.name} (Project Manager)`
          })));
        }
      })
      .catch(() => { });
  }, []);

  const synchronizedProjects = React.useMemo(() => {
    return localProjects.map(p => {
      const rawFallback =
        p.cpmProgress !== undefined && p.cpmProgress !== null ? p.cpmProgress :
          p.overallProgress !== undefined && p.overallProgress !== null ? p.overallProgress :
            p.progress !== undefined && p.progress !== null ? p.progress :
              p.progressPercentage;

      const computedProg = calculateProjectProgress(p.id, tasks, Number(rawFallback || 0));
      const computedStatus = getEffectiveProjectStatus(p.status, computedProg);
      return {
        ...p,
        cpmProgress: computedProg,
        overallProgress: computedProg,
        progress: computedProg,
        progressPercentage: computedProg,
        status: computedStatus
      };
    });
  }, [localProjects, tasks]);

  const filteredProjects = synchronizedProjects.filter(p => {
    const matchesStatus = filterStatus === 'ALL' || p.status === filterStatus;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query ||
      p.name.toLowerCase().includes(query) ||
      p.clientName.toLowerCase().includes(query) ||
      p.location.toLowerCase().includes(query) ||
      p.id.toLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  });

  const totalPortfolioBudget = synchronizedProjects.reduce((acc, p) => acc + p.budget, 0);
  const totalFundsCollected = synchronizedProjects.reduce((acc, p) => acc + p.fundsCollected, 0);
  const avgPortfolioProgress = Math.round(
    synchronizedProjects.reduce((acc, p) => acc + p.progressPercentage, 0) / (synchronizedProjects.length || 1)
  );
  const totalSiteManpower = synchronizedProjects.reduce((acc, p) => acc + (p.assignedWorkersCount || 0), 0);

  // 3Cs Metrics: RFIs and Change Orders
  const totalOpenRfis = rfis.filter(r => r.status === 'OPEN' || r.status === 'UNDER_REVIEW').length;
  const pendingChangeOrders = changeOrders.filter(co => co.status === 'PENDING');
  const totalPendingCOValue = pendingChangeOrders.reduce((sum, co) => sum + (Number(co.requestedAmount ?? co.amount ?? 0) || 0), 0);

  const handleExportCsv = () => {
    const headers = [
      'Project ID', 'Project Name', 'Client', 'Location', 'Status',
      'Contract Budget (PHP)', 'Funds Collected (PHP)', 'Progress %',
      'Start Date', 'Target Handover', 'Assigned Workers', 'Open RFIs', 'Pending Change Orders'
    ];
    const rows = localProjects.map(p => {
      const pRfis = rfis.filter(r => r.projectId === p.id || (r.projectName && r.projectName.toLowerCase() === p.name.toLowerCase()));
      const openRfis = pRfis.filter(r => r.status === 'OPEN' || r.status === 'UNDER_REVIEW').length;
      const pCOs = changeOrders.filter(co => co.projectId === p.id || (co.projectName && co.projectName.toLowerCase() === p.name.toLowerCase()));
      const pendingCOs = pCOs.filter(co => co.status === 'PENDING').length;
      return [
        p.id,
        p.name,
        p.clientName,
        p.location,
        p.status,
        p.budget,
        p.fundsCollected,
        `${p.progressPercentage}%`,
        p.startDate,
        p.targetHandoverDate,
        p.assignedWorkersCount,
        openRfis,
        pendingCOs
      ];
    });
    exportToCsv('CTVill_Commercial_Sites_Portfolio', headers, rows);
  };

  const openNewModal = () => {
    // Reset all dummy/pre-filled defaults strictly to 0 or empty strings
    setFormName('');
    setFormClient('');
    setFormDescription('');
    setFormLocation('');
    setDetectedCoords(null);
    setLocationSuggestions([]);
    setShowLocationDropdown(false);
    setSelectedSuggestionIndex(-1);
    isLocationSelectedRef.current = false;
    setFormBudget(0);
    setFormCollected(0);
    setFormProgress(0);
    setFormStatus('');
    setFormStartDate(new Date().toISOString().split('T')[0]);
    setFormEndDate(new Date().toISOString().split('T')[0]);
    setFormWorkers(0);
    setFormTasksCount(0);
    setFormMilestonesCount(0);
    setFormIsPrivateAccounting(false);
    setFormPMId('');
    setFormPMName('');
    setFormAssignedWorkerIds([]);
    setModalWorkerSearchQuery('');
    setModalWorkerTradeFilter('ALL');
    setShowAiCrewGuide(false);
    setDismissedStagedWorkerIds([]);
    setActiveNoteEditorWorkerId(null);
    setModalTab('general');
    setShowNewModal(true);
  };

  const openEditModal = (p: ProjectProfile) => {
    setFormName(p.name);
    setFormClient(p.clientName);
    setFormDescription(p.description);
    setFormLocation(p.location);
    setLocationSuggestions([]);
    setShowLocationDropdown(false);
    setSelectedSuggestionIndex(-1);
    isLocationSelectedRef.current = true;
    if (p.latitude && p.longitude) {
      setDetectedCoords({
        name: p.location,
        lat: Number(p.latitude),
        lon: Number(p.longitude),
        confidence: 'EXACT_COORDINATES'
      });
    } else {
      const localMatch = resolveLocalGeocoding(p.location || p.name);
      setDetectedCoords(localMatch);
    }
    setFormBudget(p.budget);
    setFormCollected(p.fundsCollected);
    const rawFallback =
      p.cpmProgress !== undefined && p.cpmProgress !== null ? p.cpmProgress :
        p.overallProgress !== undefined && p.overallProgress !== null ? p.overallProgress :
          p.progress !== undefined && p.progress !== null ? p.progress :
            p.progressPercentage;
    const computedProg = calculateProjectProgress(p.id, tasks, Number(rawFallback || 0));
    setFormProgress(computedProg);
    setFormStatus(getEffectiveProjectStatus(p.status, computedProg));
    setFormStartDate(p.startDate);
    setFormEndDate(p.targetHandoverDate);
    setFormWorkers(p.assignedWorkersCount);
    setFormTasksCount(p.tasksCount);
    setFormMilestonesCount(p.milestonesCount);
    setFormIsPrivateAccounting(Boolean(p.isPrivateAccounting));
    setFormPMId(p.assignedProjectManagerId || '');
    setFormPMName(p.assignedProjectManagerName || '');
    const assignedIds = p.assignedContractorIds || [];
    setFormAssignedWorkerIds(assignedIds);
    const initSources: Record<string, 'Manual' | 'AI'> = {};
    assignedIds.forEach(id => { initSources[id] = 'Manual'; });
    setWorkerAllocationSourceMap(initSources);
    setFormWorkers(assignedIds.length > 0 ? assignedIds.length : (p.assignedWorkersCount || 0));
    setModalWorkerSearchQuery('');
    setModalWorkerTradeFilter('ALL');
    setShowAiCrewGuide(false);
    setDismissedStagedWorkerIds([]);
    setActiveNoteEditorWorkerId(null);
    setModalTab('general');
    setShowEditModal(true);
  };

  // Shared Renderer for Step 3 (Leadership & Crew) Safe "Draft-Review-Commit" Workflow
  const renderCrewAssignmentDecisionSupport = (excludeProjectId?: string) => (
    <div className="space-y-3">
      {/* Header Row with Staged AI Scan / Crew Guide Trigger Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label className="text-xs font-mono text-slate-400 uppercase font-semibold">
            Assign Personnel ({formAssignedWorkerIds.length} Selected in Draft)
          </label>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-teal-300 font-semibold">
            Source: Manual
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setDismissedStagedWorkerIds([]);
              setShowAiCrewGuide(true);
            }}
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold font-mono transition cursor-pointer flex items-center gap-1.5 border bg-slate-900 hover:bg-indigo-950/80 text-indigo-300 border-indigo-700/70"
            title="Stage AI multi-skill recommendations without overwriting manual checkboxes"
          >
            <RefreshCw className="w-3 h-3 text-indigo-400" />
            <span>Run AI Multi-Skill Scan</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDismissedStagedWorkerIds([]);
              setShowAiCrewGuide(prev => !prev);
            }}
            className={`px-3 py-1 rounded-lg text-xs font-semibold font-mono transition cursor-pointer flex items-center gap-1.5 border ${showAiCrewGuide
                ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm shadow-indigo-500/20'
                : 'bg-indigo-950/80 hover:bg-indigo-900/80 text-indigo-300 border-indigo-700/70'
              }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>✨ AI Crew Guide</span>
          </button>
        </div>
      </div>

      {/* Staged AI Proposal Diff Panel (Never auto-checks boxes until Admin clicks Accept / Apply All) */}
      {showAiCrewGuide && (
        <div className="p-3.5 rounded-xl bg-indigo-950/50 border border-indigo-500/40 space-y-2.5 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-800/60 pb-2">
            <div>
              <div className="text-xs font-bold text-indigo-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>AI Proposal Staging Panel (Draft-Review-Commit)</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Staged recommendations scored on 4 factors. Workers flagged <code className="text-amber-300">isLockedByAdmin</code> are strictly skipped.
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleApplyAllStagedSuggestionsToDraft}
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition cursor-pointer flex items-center gap-1"
              >
                <Check className="w-3 h-3 stroke-[3]" />
                <span>Apply All Suggestions to Draft</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAiCrewGuide(false)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-mono transition cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>

          {aiCrewSuggestions.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-400 font-mono">
              No remaining staged proposals (all candidates either accepted, dismissed, or locked by Admin).
            </div>
          ) : (
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {aiCrewSuggestions.map(({ worker, rate, avail, score, fourFactorBreakdown, rationale }) => {
                const isAlreadyInDraft = formAssignedWorkerIds.includes(worker.id);
                return (
                  <div
                    key={worker.id}
                    className={`p-2.5 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition ${isAlreadyInDraft
                        ? 'bg-indigo-900/40 border-amber-500/40 text-white'
                        : 'bg-slate-950/70 border-slate-800/80 hover:border-indigo-700/60 text-slate-200'
                      }`}
                  >
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white">{worker.name}</span>
                        <span className="text-[10px] font-mono text-amber-300">
                          ({worker.tradeType || worker.specialty || 'General'})
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          ₱{rate.toLocaleString()}/day
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-950 border border-indigo-700 text-indigo-300 font-bold">
                          4-Factor Score: {score}/100
                        </span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border whitespace-nowrap ${avail.isOverlapping
                              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 font-semibold'
                              : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-semibold'
                            }`}
                        >
                          {avail.badgeText}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {fourFactorBreakdown}
                      </div>
                      <div className="text-[11px] text-indigo-200/90 font-mono">
                        {rationale}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleAcceptStagedSuggestion(worker.id)}
                        disabled={isAlreadyInDraft}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold transition cursor-pointer flex items-center gap-1 ${isAlreadyInDraft
                            ? 'bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 cursor-default'
                            : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                          }`}
                      >
                        <Check className="w-3 h-3 stroke-[2.5]" />
                        <span>{isAlreadyInDraft ? 'Accepted' : 'Accept'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDismissStagedSuggestion(worker.id)}
                        className="px-2 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700 text-[11px] font-mono transition cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Search Bar & Specialty Dropdown */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          placeholder="Filter available contractors..."
          value={modalWorkerSearchQuery}
          onChange={(e) => setModalWorkerSearchQuery(e.target.value)}
          className="flex-1 bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none"
        />
        <select
          value={modalWorkerTradeFilter}
          onChange={(e) => setModalWorkerTradeFilter(e.target.value)}
          aria-label="Filter contractors by trade specialty"
          className="bg-slate-950 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none cursor-pointer sm:w-44"
        >
          {availableTrades.map(t => (
            <option key={t} value={t}>{t === 'ALL' ? 'All Trades' : t}</option>
          ))}
        </select>
      </div>

      {/* Trade Specialty Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {['ALL', 'General', 'Mason', 'Carpenter', 'Electrician', 'Plumber'].map(trade => (
          <button
            key={trade}
            type="button"
            onClick={() => setModalWorkerTradeFilter(trade)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono whitespace-nowrap transition cursor-pointer border ${modalWorkerTradeFilter === trade
                ? 'bg-amber-500 text-slate-950 font-bold border-amber-500'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
              }`}
          >
            {trade === 'ALL' ? 'All Trades' : trade}
          </button>
        ))}
      </div>

      {/* Manual Worker Selection Checklist with Source: Manual Badge & Human Override Protection Lock */}
      <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 border border-slate-800 rounded-lg p-2 bg-slate-950/60">
        {contractors
          .filter(w => {
            if (modalWorkerTradeFilter !== 'ALL' && modalWorkerTradeFilter !== '') {
              const wTrade = (w.tradeType || w.specialty || 'General').toLowerCase();
              const filterTrade = modalWorkerTradeFilter.toLowerCase();
              if (!wTrade.includes(filterTrade) && !filterTrade.includes(wTrade)) {
                return false;
              }
            }
            if (!modalWorkerSearchQuery.trim()) return true;
            const q = modalWorkerSearchQuery.toLowerCase();
            return w.name.toLowerCase().includes(q) ||
              (w.tradeType || '').toLowerCase().includes(q) ||
              (w.specialty || '').toLowerCase().includes(q);
          })
          .map(worker => {
            const isSelected = formAssignedWorkerIds.includes(worker.id);
            const avail = getWorkerAvailabilityAdvisory(worker, formStartDate, formEndDate, excludeProjectId);
            const dailyRate = getWorkerDailyRate(worker);
            const isLocked = isWorkerLockedByAdmin(worker);
            const overrideNote = workerOverrideNotes[worker.id] ?? worker.manualOverrideNote ?? '';
            const sourceLabel = workerAllocationSourceMap[worker.id] === 'AI' && !isLocked ? 'Source: AI' : 'Source: Manual';
            const isNoteEditorOpen = activeNoteEditorWorkerId === worker.id || overrideNote.trim().length > 0;

            return (
              <div
                key={worker.id}
                className={`p-2 rounded-lg text-xs transition border space-y-1.5 ${isSelected
                    ? 'bg-amber-500/10 border-amber-500/30 text-white'
                    : 'border-slate-800/60 hover:bg-slate-800/60 text-slate-300'
                  }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleWorkerSelection(worker.id)}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-0 bg-slate-900 border-slate-700 cursor-pointer shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-white truncate">{worker.name}</span>
                        <span className="text-[11px] text-slate-400">
                          ({worker.tradeType || worker.specialty || 'General'})
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          • ₱{dailyRate.toLocaleString()}/day
                        </span>
                      </div>
                    </div>
                  </label>

                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                    {/* Audit Source Badge */}
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-teal-300 font-semibold">
                      {sourceLabel}
                    </span>

                    {/* Human Override Protection Lock Toggle */}
                    <button
                      type="button"
                      onClick={() => {
                        handleToggleWorkerAdminLock(worker.id, isLocked);
                        setActiveNoteEditorWorkerId(prev => (prev === worker.id ? null : worker.id));
                      }}
                      title={isLocked ? 'Locked by Admin (isLockedByAdmin = true). AI optimizer strictly skips this worker.' : 'Lock assignment or add manual override note'}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border flex items-center gap-1 transition cursor-pointer ${isLocked
                          ? 'bg-rose-950/80 border-rose-500/50 text-rose-300 font-bold'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                    >
                      <Lock className="w-2.5 h-2.5" />
                      <span>{isLocked ? 'Locked by Admin' : 'Override / Lock'}</span>
                    </button>

                    {/* Non-Blocking Availability / Overlap Status Badge */}
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border shrink-0 ${avail.isOverlapping
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 font-semibold'
                          : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-semibold'
                        }`}
                    >
                      {avail.badgeText}
                    </span>
                  </div>
                </div>

                {/* Manual Override Note Input (Automatically flags isLockedByAdmin = true) */}
                {isNoteEditorOpen && (
                  <div className="pl-6 pt-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={overrideNote}
                      onChange={(e) => handleUpdateWorkerOverrideNote(worker.id, e.target.value)}
                      placeholder="Manual override note (automatically sets isLockedByAdmin & locks from AI)..."
                      className="flex-1 bg-slate-900 border border-slate-700 focus:border-amber-500 rounded px-2.5 py-1 text-[11px] text-slate-200 font-mono focus:outline-none"
                    />
                    {isLocked && (
                      <span className="text-[10px] font-mono text-rose-300 shrink-0">
                        isLockedByAdmin: true
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Live Read-Only Advisory Labor Burn Preview */}
      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
          <span className="text-[11px] font-mono uppercase text-slate-400 font-bold flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-amber-400" />
            Advisory Labor Burn Preview (Read-Only)
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            Est. {advisoryLaborEstimator.estimatedWorkingDays} Working Days
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs font-mono">
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-2">
            <span className="text-[10px] text-slate-400 block uppercase">Selected Headcount</span>
            <span className="text-sm font-bold text-white">{advisoryLaborEstimator.headcount} Crew</span>
          </div>
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-2">
            <span className="text-[10px] text-slate-400 block uppercase">Combined Crew Rate</span>
            <span className="text-sm font-bold text-amber-400">
              ₱{advisoryLaborEstimator.combinedDailyRate.toLocaleString()}/day
            </span>
          </div>
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-2">
            <span className="text-[10px] text-slate-400 block uppercase">Projected Labor vs Budget</span>
            <span className={`text-sm font-bold ${advisoryLaborEstimator.isHighLaborBurn ? 'text-amber-300' : 'text-emerald-400'}`}>
              ₱{advisoryLaborEstimator.projectedLaborCost.toLocaleString()}
              {advisoryLaborEstimator.contractBudget > 0 && (
                <span className="text-[10px] ml-1">
                  ({advisoryLaborEstimator.budgetRatioPct.toFixed(1)}%)
                </span>
              )}
            </span>
          </div>
        </div>

        {advisoryLaborEstimator.isHighLaborBurn && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-mono">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Advisory: Selected crew daily rate is high relative to contract budget</span>
          </div>
        )}
      </div>
    </div>
  );

  const openReallocationModal = (proj: ProjectProfile) => {
    setActiveReallocProject(proj);
    const recs = generateReallocationRecommendations(localProjects, contractors);
    const relevant = recs.filter(r => r.originProjectId === proj.id);
    setReallocRecommendations(relevant.length > 0 ? relevant : recs);
    setReallocFeedback(null);
    setShowReallocationModal(true);
  };

  const handleExecuteReallocation = async (rec: WorkforceReallocationRecommendation) => {
    setIsReallocating(true);
    try {
      const res = await fetch('/api/workforce/reallocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: rec.workerId,
          targetProjectId: rec.targetProjectId,
          targetProjectName: rec.targetProjectName
        })
      });
      if (res.ok) {
        setReallocFeedback(`✅ Successfully transferred ${rec.workerName} to "${rec.targetProjectName}".`);
        setReallocRecommendations(prev => prev.map(r => r.id === rec.id ? { ...r, applied: true } : r));
        // Update local project counts
        setLocalProjects(prev => prev.map(p => {
          if (p.id === rec.originProjectId) {
            return { ...p, assignedWorkersCount: Math.max(0, p.assignedWorkersCount - 1) };
          }
          if (p.id === rec.targetProjectId) {
            return { ...p, assignedWorkersCount: p.assignedWorkersCount + 1 };
          }
          return p;
        }));
      }
    } catch (err) {
      setReallocFeedback('❌ Failed to execute reallocation.');
    } finally {
      setIsReallocating(false);
    }
  };

  // Timeline validation: targetHandoverDate cannot precede startDate
  const isTimelineInvalid = Boolean(
    formStartDate && formEndDate && new Date(formEndDate) < new Date(formStartDate)
  );

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || isTimelineInvalid) return;

    // Resolve coordinates for project site weather synchronization
    const syncCoords = resolveProjectCoordinatesSync(formLocation.trim(), formName.trim());
    const finalLat = detectedCoords?.lat ?? syncCoords.lat;
    const finalLon = detectedCoords?.lon ?? syncCoords.lon;

    const newProj: ProjectProfile = {
      id: `PRJ-${Date.now().toString().slice(-4)}`,
      name: formName.trim(),
      clientName: formClient.trim(),
      description: formDescription.trim(),
      location: formLocation.trim(),
      latitude: finalLat,
      longitude: finalLon,
      budget: Number(formBudget) || 0,
      fundsCollected: 0,
      progressPercentage: 0,
      status: (formStatus || 'PLANNING') as ProjectProfile['status'],
      targetHandoverDate: formEndDate,
      startDate: formStartDate,
      assignedWorkersCount: formAssignedWorkerIds.length || Number(formWorkers) || 0,
      assignedContractorIds: formAssignedWorkerIds,
      isPrivateAccounting: formIsPrivateAccounting,
      tasksCount: Number(formTasksCount) || 0,
      milestonesCount: Number(formMilestonesCount) || 0,
      assignedProjectManagerId: formPMId || undefined,
      assignedProjectManagerName: formPMName || undefined,
    };

    setLocalProjects(prev => [...prev, newProj]);

    if (onCreateProject) {
      await onCreateProject(newProj);
    } else {
      fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProj)
      }).catch(console.error);
    }

    // Sync newly assigned workers to this project site
    if (formAssignedWorkerIds.length > 0) {
      for (const wId of formAssignedWorkerIds) {
        fetch(`/api/projects/${newProj.id}/workers`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workerId: wId, action: 'add' })
        }).catch(console.error);
      }
    }

    setShowNewModal(false);
    setSelectedProject(newProj);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    // Resolve coordinates for project site weather synchronization
    const syncCoords = resolveProjectCoordinatesSync(formLocation.trim(), formName.trim(), selectedProject.latitude, selectedProject.longitude);
    const finalLat = detectedCoords?.lat ?? syncCoords.lat;
    const finalLon = detectedCoords?.lon ?? syncCoords.lon;

    const updated: ProjectProfile = {
      ...selectedProject,
      name: formName.trim(),
      clientName: formClient.trim(),
      description: formDescription.trim(),
      location: formLocation.trim(),
      latitude: finalLat,
      longitude: finalLon,
      budget: Number(formBudget),
      fundsCollected: selectedProject.fundsCollected ?? Number(formCollected) ?? 0,
      progressPercentage: calculateProjectProgress(selectedProject.id, tasks, selectedProject.progressPercentage),
      // Auto-advance status: if progress > 0 and status is still PLANNING, bump to IN_PROGRESS
      status: (() => {
        const currentCpmProg = calculateProjectProgress(selectedProject.id, tasks, selectedProject.progressPercentage);
        const rawStatus = (formStatus || selectedProject.status || 'PLANNING') as ProjectProfile['status'];
        if (currentCpmProg > 0 && rawStatus === 'PLANNING') return 'IN_PROGRESS' as ProjectProfile['status'];
        return rawStatus;
      })(),
      targetHandoverDate: formEndDate,
      startDate: formStartDate,
      assignedWorkersCount: formAssignedWorkerIds.length || Number(formWorkers),
      assignedContractorIds: formAssignedWorkerIds,
      tasksCount: Number(formTasksCount),
      milestonesCount: Number(formMilestonesCount),
      isPrivateAccounting: formIsPrivateAccounting,
      assignedProjectManagerId: formPMId || undefined,
      assignedProjectManagerName: formPMName || undefined,
    };

    setLocalProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    setSelectedProject(updated);

    if (onUpdateProject) {
      await onUpdateProject(updated.id, updated);
    } else {
      fetch(`/api/projects/${updated.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      }).catch(console.error);
    }

    setShowEditModal(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this project profile?')) return;
    setLocalProjects(prev => prev.filter(p => p.id !== id));
    if (selectedProject?.id === id) setSelectedProject(null);

    if (onDeleteProject) {
      await onDeleteProject(id);
    } else {
      fetch(`/api/projects/${id}`, { method: 'DELETE' }).catch(console.error);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold tracking-wider uppercase">
              Operational Command Hub
            </span>
            <span className="text-xs text-slate-400">Enterprise Fit-Out Portfolio</span>
          </div>
          <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-400" />
            Projects Profile Hub
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Central hub for project-specific tracking: budget vs. collected funds, live progress %, assigned workers, tasks, and milestones.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 sm:w-52">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search projects, client, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg pl-8 pr-2.5 py-1.5 focus:outline-none focus:border-amber-500 placeholder:text-slate-500"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full sm:w-auto bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">All Project Statuses</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="PUNCHLIST_QA">Punchlist & QA</option>
            <option value="PLANNING">Planning Phase</option>
            <option value="HANDED_OVER">Handed Over</option>
          </select>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1 ${viewMode === 'table'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-white'
                }`}
              title="Compact Table View (Default)"
            >
              <Table className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1 ${viewMode === 'cards'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-white'
                }`}
              title="Card Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">Cards</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleExportCsv}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer text-xs"
              title="Export Commercial Sites to CSV"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Export CSV</span>
            </button>

            {isAdmin && (
              <button
                onClick={openNewModal}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer text-xs"
              >
                <Plus className="w-4 h-4" />
                <span>New Project</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Portfolio Overview KPIs — Open RFIs & Pending COs Removed per Civil Engineer Consultation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Total Budget</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-white mt-1 font-mono">
            ₱{totalPortfolioBudget.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {localProjects.length} Fit-Out Sites
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Collected</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-white mt-1 font-mono">
            ₱{totalFundsCollected.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {totalPortfolioBudget > 0 ? Math.round((totalFundsCollected / totalPortfolioBudget) * 100) : 0}% Collection Pace
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Avg Progress</span>
            <CheckCircle2 className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-white mt-1 font-mono">
            {avgPortfolioProgress}%
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
            <div className="bg-amber-500 h-full rounded-full" style={{ width: `${avgPortfolioProgress}%` }} />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Field Labor</span>
            <Users className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-xl font-bold text-white mt-1 font-mono">
            {totalSiteManpower} Artisans
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            On-Site Deployments
          </div>
        </div>
      </div>

      {/* Projects Table, Cards, Cold Load Inline Spinner, or Empty State */}
      {isInitialColdLoad ? (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Code / Project</th>
                  <th className="py-3 px-3">Location & Lead PM</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Progress</th>
                  <th className="py-3 px-3">Budget & Collected</th>
                  <th className="py-3 px-3">Target Handover</th>
                  <th className="py-3 px-3">Signals & Crew</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2.5">
                      <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-mono text-slate-400 tracking-wide">
                        Synchronizing commercial sites & fit-out projects...
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white mb-1">No Projects Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
            There are currently no projects matching your filter in the database. Create a new commercial project profile to get started.
          </p>
          {isAdmin && (
            <button
              onClick={openNewModal}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-2 cursor-pointer transition shadow-lg shadow-amber-500/10"
            >
              <Plus className="w-4 h-4" />
              Create Project Profile
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Code / Project</th>
                  <th className="py-3 px-3">Location & Lead PM</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Progress</th>
                  <th className="py-3 px-3">Budget & Collected</th>
                  <th className="py-3 px-3">Target Handover</th>
                  <th className="py-3 px-3">Signals & Crew</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredProjects.map((project) => {
                  const collectionRate = project.budget > 0 ? Math.round((project.fundsCollected / project.budget) * 100) : 0;
                  const pRfis = rfis.filter(r => r.projectId === project.id || (r.projectName && r.projectName.toLowerCase() === project.name.toLowerCase()));
                  const openRfis = pRfis.filter(r => r.status === 'OPEN' || r.status === 'UNDER_REVIEW');
                  const pCOs = changeOrders.filter(co => co.projectId === project.id || (co.projectName && co.projectName.toLowerCase() === project.name.toLowerCase()));
                  const pendingCOs = pCOs.filter(co => co.status === 'PENDING');

                  // 1. Resolve true progress: check cpmProgress, overallProgress, and progress
                  const rawProgress =
                    project.cpmProgress !== undefined && project.cpmProgress !== null ? project.cpmProgress :
                      project.overallProgress !== undefined && project.overallProgress !== null ? project.overallProgress :
                        project.progress !== undefined && project.progress !== null ? project.progress :
                          project.progressPercentage || 0;

                  const displayProgress = Math.round(Number(rawProgress));

                  // 2. Resolve status: if progress > 0 and status is PLANNING, display active execution
                  const displayStatus: string =
                    displayProgress > 0 && (project.status === 'PLANNING' || !project.status)
                      ? 'IN_PROGRESS'
                      : project.status || 'PLANNING';

                  return (
                    <tr
                      key={project.id}
                      onClick={() => setSelectedProject(project)}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold shrink-0">
                            {project.id}
                          </span>
                          <div className="min-w-0">
                            <div className="font-bold text-white group-hover:text-amber-400 transition-colors truncate max-w-[200px] sm:max-w-[260px]">
                              {project.name}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                              {project.clientName}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="truncate max-w-[170px] text-slate-300 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate">{project.location}</span>
                        </div>
                        <div className="text-[11px] text-amber-300/80 font-mono truncate max-w-[170px] flex items-center gap-1 mt-0.5">
                          <HardHat className="w-3 h-3 text-amber-400 shrink-0" />
                          <span className="truncate">{project.assignedProjectManagerName ? project.assignedProjectManagerName.split('(')[0].trim() : 'Unassigned'}</span>
                        </div>
                      </td>

                      {/* STATUS BADGE */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide uppercase ${displayStatus === 'IN_PROGRESS' || displayStatus === 'EXECUTION'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                              : displayStatus === 'COMPLETED'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                        >
                          {displayStatus === 'IN_PROGRESS' ? 'IN PROGRESS' : displayStatus.replace('_', ' ')}
                        </span>
                      </td>

                      {/* PROGRESS COLUMN */}
                      <td className="px-4 py-3 min-w-[120px]">
                        <div className="flex flex-col gap-1 min-w-[120px]">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-slate-200">{displayProgress}%</span>
                            {displayProgress > 0 && (
                              <span className="text-[10px] text-cyan-400 font-mono flex items-center gap-0.5">
                                ⚡ CPM Auto
                              </span>
                            )}
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${displayProgress >= 100
                                  ? 'bg-emerald-500'
                                  : displayProgress > 0
                                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500'
                                    : 'bg-slate-700'
                                }`}
                              style={{ width: `${Math.min(Math.max(displayProgress, 0), 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-mono text-white font-bold text-[11px]">
                          ₱{project.budget.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-emerald-400 font-mono">
                          ₱{project.fundsCollected.toLocaleString()} ({collectionRate}%)
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                        {project.targetHandoverDate}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              try { localStorage.setItem('ctvill_selected_workforce_project', project.id); } catch { }
                              onNavigateToTab?.('contractors', project.id);
                            }}
                            title="Open Labor Workforce & Artisan Trades for this site"
                            className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950/70 hover:bg-purple-900 text-purple-300 border border-purple-700/60 flex items-center gap-1 cursor-pointer transition"
                          >
                            <Users className="w-2.5 h-2.5" />
                            <span>{project.assignedWorkersCount || (project.assignedContractorIds || []).length} Crew</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-75" />
                          </button>
                          {project.isPrivateAccounting && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800">
                              Private
                            </span>
                          )}
                          {(displayProgress >= 90 || displayStatus === 'HANDED_OVER' || displayStatus === 'COMPLETED') && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800">
                              Surplus
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {(displayProgress >= 90 || displayStatus === 'HANDED_OVER' || displayStatus === 'COMPLETED') && (
                            <button
                              onClick={() => openReallocationModal(project)}
                              className="p-1.5 bg-indigo-950/90 hover:bg-indigo-900 border border-indigo-700 text-indigo-300 rounded-lg transition cursor-pointer"
                              title="Reallocate Surplus Workforce"
                            >
                              <Users className="w-3.5 h-3.5 text-indigo-400" />
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedProject(project)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition cursor-pointer"
                            title="View Project Profile"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => {
                                setSelectedProject(project);
                                openEditModal(project);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition cursor-pointer"
                              title="Edit Project Profile"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => handleDelete(project.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                              title="Delete Project"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProjects.map((project) => {
            const collectionRate = project.budget > 0 ? Math.round((project.fundsCollected / project.budget) * 100) : 0;
            const pRfis = rfis.filter(r => r.projectId === project.id || (r.projectName && r.projectName.toLowerCase() === project.name.toLowerCase()));
            const openRfis = pRfis.filter(r => r.status === 'OPEN' || r.status === 'UNDER_REVIEW');
            const pCOs = changeOrders.filter(co => co.projectId === project.id || (co.projectName && co.projectName.toLowerCase() === project.name.toLowerCase()));
            const pendingCOs = pCOs.filter(co => co.status === 'PENDING');

            // 1. Resolve true progress: check cpmProgress, overallProgress, and progress
            const rawProgress =
              project.cpmProgress !== undefined && project.cpmProgress !== null ? project.cpmProgress :
                project.overallProgress !== undefined && project.overallProgress !== null ? project.overallProgress :
                  project.progress !== undefined && project.progress !== null ? project.progress :
                    project.progressPercentage || 0;

            const displayProgress = Math.round(Number(rawProgress));

            // 2. Resolve status: if progress > 0 and status is PLANNING, display active execution
            const displayStatus: string =
              displayProgress > 0 && (project.status === 'PLANNING' || !project.status)
                ? 'IN_PROGRESS'
                : project.status || 'PLANNING';

            return (
              <div
                key={project.id}
                className="group bg-slate-900/70 border border-slate-800 hover:border-amber-500/50 rounded-xl p-5 transition-all duration-200 hover:shadow-lg relative overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
                        {project.id}
                      </span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${displayStatus === 'COMPLETED' ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800' :
                          displayStatus === 'PUNCHLIST_QA' ? 'bg-purple-950/80 text-purple-300 border-purple-800' :
                            displayStatus === 'IN_PROGRESS' || displayStatus === 'EXECUTION' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' :
                              displayStatus === 'PLANNING' ? 'bg-blue-950/80 text-blue-300 border-blue-800' :
                                'bg-amber-950/80 text-amber-300 border-amber-800'
                        }`}>
                        {displayStatus === 'IN_PROGRESS' ? 'IN PROGRESS' : displayStatus.replace('_', ' ')}
                      </span>
                      {openRfis.length > 0 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800 font-semibold flex items-center gap-1">
                          <HelpCircle className="w-3 h-3 text-cyan-400" />
                          <span>{openRfis.length} RFI</span>
                        </span>
                      )}
                      {pendingCOs.length > 0 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800 font-semibold flex items-center gap-1">
                          <FileSpreadsheet className="w-3 h-3 text-amber-400" />
                          <span>{pendingCOs.length} CO</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {(displayProgress >= 90 || displayStatus === 'HANDED_OVER' || displayStatus === 'COMPLETED') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openReallocationModal(project);
                          }}
                          className="px-2 py-1 bg-indigo-950/90 hover:bg-indigo-900 border border-indigo-700 text-indigo-300 text-[10px] font-bold rounded-lg flex items-center gap-1 transition cursor-pointer"
                          title="Surplus Workforce Detected — Click to Reassign"
                        >
                          <Users className="w-3 h-3 text-indigo-400" />
                          <span>Reallocate</span>
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProject(project);
                            openEditModal(project);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition cursor-pointer"
                          title="Edit Project Profile"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(project.id);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                          title="Delete Project"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <h3
                    onClick={() => setSelectedProject(project)}
                    className="text-base font-bold text-white group-hover:text-amber-400 transition-colors cursor-pointer"
                  >
                    {project.name}
                  </h3>
                  <div className="text-xs text-amber-400/90 font-medium">{project.clientName}</div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{project.location}</span>
                  </div>

                  <div className="mt-4 space-y-1">
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="text-slate-400">Progress</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-200 font-bold">{displayProgress}%</span>
                        {displayProgress > 0 && (
                          <span className="text-[10px] text-cyan-400 font-mono flex items-center gap-0.5">
                            ⚡ CPM Auto
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${displayProgress >= 100
                            ? 'bg-emerald-500'
                            : displayProgress > 0
                              ? 'bg-gradient-to-r from-cyan-500 to-blue-500'
                              : 'bg-slate-700'
                          }`}
                        style={{ width: `${Math.min(Math.max(displayProgress, 0), 100)}%` }}
                      />
                    </div>
                  </div>

                  {project.isPrivateAccounting && !isAdmin ? (
                    <div className="mt-3 bg-rose-950/40 p-2.5 rounded-lg border border-rose-800/70 text-xs text-rose-300 font-mono">
                      Confidential Accounting
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 mt-3 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block">Budget</span>
                        <span className="font-bold text-white">₱{project.budget.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block">Collected</span>
                        <span className="font-bold text-emerald-400">₱{project.fundsCollected.toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span className="font-mono text-[11px]">Due: {project.targetHandoverDate}</span>
                  <button
                    onClick={() => setSelectedProject(project)}
                    className="flex items-center gap-1 text-amber-400 font-medium hover:text-amber-300 transition-colors cursor-pointer text-xs"
                  >
                    View Details <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}


      {/* Detailed Project Profile Modal with Tabs */}
      {selectedProject && !showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[calc(100dvh-1rem)] sm:max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 pb-4 border-b border-slate-800 relative bg-slate-900/90">
              <button
                onClick={() => setSelectedProject(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer z-10"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-8 sm:pr-0">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                      {selectedProject.id}
                    </span>
                    <span className="text-xs text-slate-400">Commercial Fit-Out Profile</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{selectedProject.name}</h2>
                  <p className="text-xs sm:text-sm text-amber-400 font-medium">{selectedProject.clientName}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${selectedProject.status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-300 border-emerald-800' :
                      selectedProject.status === 'PUNCHLIST_QA' ? 'bg-purple-950 text-purple-300 border-purple-800' :
                        'bg-amber-950 text-amber-300 border-amber-800'
                    }`}>
                    {selectedProject.status.replace('_', ' ')}
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => openEditModal(selectedProject)}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold transition cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>
                  )}
                </div>
              </div>

              {/* Sub-meta */}
              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  {selectedProject.location}
                </span>
                <span className="flex items-center gap-1.5 text-amber-300/90 font-mono">
                  <HardHat className="w-3.5 h-3.5 text-amber-400" />
                  <span>PM: {selectedProject.assignedProjectManagerName ? selectedProject.assignedProjectManagerName.split('(')[0].trim() : 'Unassigned'}</span>
                </span>
                <span className="flex items-center gap-1.5 text-slate-400 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Handover: {selectedProject.targetHandoverDate}</span>
                </span>
              </div>

              {/* Logical Tabs Navigation */}
              <div className="flex items-center gap-1 mt-4 border-t border-slate-800/80 pt-3">
                <button
                  type="button"
                  onClick={() => setActiveTabInsideProfile('OVERVIEW')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${activeTabInsideProfile === 'OVERVIEW'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Overview & Milestones</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTabInsideProfile('FINANCIALS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${activeTabInsideProfile === 'FINANCIALS'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Financial Summary</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTabInsideProfile('WORKERS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${activeTabInsideProfile === 'WORKERS'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Assigned Crew ({(selectedProject.assignedContractorIds || []).length})</span>
                </button>
              </div>
            </div>

            {/* Modal Body - Tab Content */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
              {activeTabInsideProfile === 'OVERVIEW' && (
                <div className="space-y-5">
                  {/* Scope & Description */}
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                    <h4 className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-1.5">Fit-Out Scope & Architectural Brief</h4>
                    <p className="text-sm text-slate-300 leading-relaxed">{selectedProject.description || 'No detailed scope description provided.'}</p>
                  </div>

                  {/* Site Progress */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono text-slate-300 font-bold uppercase tracking-wider">Overall Site Progress</span>
                      <span className="text-sm font-bold text-amber-400 font-mono">
                        {calculateProjectProgress(selectedProject.id, tasks, selectedProject.progressPercentage)}% Complete
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
                      <div
                        className="bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 h-full rounded-full transition-all"
                        style={{ width: `${calculateProjectProgress(selectedProject.id, tasks, selectedProject.progressPercentage)}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-0.5 text-xs text-amber-400 font-mono font-medium">
                      <span>⚡ Auto-Synced from Master CPM Gantt & Task Kanban</span>
                    </div>
                  </div>

                  {/* Operational Site Command Cards (4-Card Grid per Civil Engineer Consultation) */}
                  <div>
                    <h4 className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-400" />
                      Live Site Operations & Resource Command
                    </h4>
                    {(() => {
                      const livePct = calculateProjectProgress(selectedProject.id, tasks, selectedProject.progressPercentage);
                      const activePhaseLabel =
                        livePct < 15 ? 'Earthworks & Concreting Works' :
                          livePct < 35 ? 'Reinforcing Bar & Formworks' :
                            livePct < 60 ? 'Masonry & Roof Works' :
                              livePct < 85 ? 'Finishing, Tiling & MEP Works' :
                                'Painting, Fixtures & Handover QA';
                      const assignedCrewList = contractors.filter(c =>
                        (selectedProject.assignedContractorIds || []).includes(c.id) ||
                        (selectedProject.assignedWorkforceIds || []).includes(c.id) ||
                        (c.assignedProjects || []).includes(selectedProject.id) ||
                        (c.assignedProjectIds || []).includes(selectedProject.id)
                      );
                      const crewHeadcount = assignedCrewList.length || selectedProject.assignedWorkersCount || 0;
                      const dailyLaborBurn = assignedCrewList.reduce((acc, w) => acc + Number(w.dailyRatePhp || 750), 0) || (crewHeadcount * 780);
                      const siteRequests = rfis.filter(r => r.projectId === selectedProject.id || (r.projectName && r.projectName.toLowerCase() === selectedProject.name.toLowerCase()));
                      const pendingReqCount = siteRequests.filter(r => r.status === 'OPEN' || r.status === 'UNDER_REVIEW').length || 2;

                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                          {/* 1. Current Phase & Milestone */}
                          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-semibold">1. Phase & Milestone</span>
                                <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              </div>
                              <div className="text-xs font-bold text-white leading-snug">{activePhaseLabel}</div>
                              <div className="w-full bg-slate-900 rounded-full h-1.5 mt-2.5 overflow-hidden">
                                <div className="h-full rounded-full bg-amber-400" style={{ width: `${livePct}%` }} />
                              </div>
                            </div>
                            <span className="text-[10px] font-mono text-emerald-400 mt-2 font-semibold">
                              {livePct}% Phase Completion
                            </span>
                          </div>

                          {/* 2. Materials */}
                          <div
                            onClick={() => {
                              setSelectedProject(null);
                              onNavigateToTab?.('rfis', selectedProject.id);
                            }}
                            className="bg-slate-950 hover:bg-slate-900 p-3.5 rounded-xl border border-slate-800 hover:border-cyan-500/50 flex flex-col justify-between cursor-pointer transition group"
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-semibold">2. Materials</span>
                                <ExternalLink className="w-3.5 h-3.5 text-cyan-400 opacity-70 group-hover:opacity-100 shrink-0" />
                              </div>
                              <div className="text-xs font-bold text-white">Stock & Deliveries</div>
                              <p className="text-[11px] text-slate-400 mt-1">
                                Cement, Rebar, CHB & Finishing inventory
                              </p>
                            </div>
                            <span className="text-[10px] font-mono text-cyan-400 mt-2 flex items-center gap-1 font-semibold">
                              <span>Open Procurement Hub</span>
                              <ArrowRight className="w-3 h-3" />
                            </span>
                          </div>

                          {/* 3. Labor */}
                          <div
                            onClick={() => {
                              try { localStorage.setItem('ctvill_selected_workforce_project', selectedProject.id); } catch { }
                              setSelectedProject(null);
                              onNavigateToTab?.('contractors', selectedProject.id);
                            }}
                            className="bg-slate-950 hover:bg-slate-900 p-3.5 rounded-xl border border-slate-800 hover:border-teal-500/50 flex flex-col justify-between cursor-pointer transition group"
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-mono uppercase tracking-wider text-teal-400 font-semibold">3. Site Labor</span>
                                <Users className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                              </div>
                              <div className="text-xs font-bold text-white font-mono">{crewHeadcount} Assigned Artisans</div>
                              <p className="text-[11px] text-slate-400 mt-1 font-mono">
                                ₱{dailyLaborBurn.toLocaleString()}/day burn rate
                              </p>
                            </div>
                            <span className="text-[10px] font-mono text-teal-400 mt-2 flex items-center gap-1 font-semibold">
                              <span>Manage Site Crew</span>
                              <ArrowRight className="w-3 h-3" />
                            </span>
                          </div>

                          {/* 4. Requests */}
                          <div
                            onClick={() => {
                              setSelectedProject(null);
                              onNavigateToTab?.('rfis', selectedProject.id);
                            }}
                            className="bg-slate-950 hover:bg-slate-900 p-3.5 rounded-xl border border-slate-800 hover:border-indigo-500/50 flex flex-col justify-between cursor-pointer transition group"
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-semibold">4. Requests</span>
                                <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              </div>
                              <div className="text-xs font-bold text-white font-mono">{pendingReqCount} Pending Requests</div>
                              <p className="text-[11px] text-slate-400 mt-1">
                                Material & Purchase Approvals
                              </p>
                            </div>
                            <span className="text-[10px] font-mono text-indigo-400 mt-2 flex items-center gap-1 font-semibold">
                              <span>Review Approvals Inbox</span>
                              <ArrowRight className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {activeTabInsideProfile === 'FINANCIALS' && (
                <div className="space-y-4">
                  {selectedProject.isPrivateAccounting && !isAdmin ? (
                    <div className="p-5 bg-rose-950/40 border border-rose-800/80 rounded-xl flex items-center gap-3.5">
                      <ShieldCheck className="w-7 h-7 text-rose-400 shrink-0" />
                      <div>
                        <h4 className="text-sm font-bold text-rose-300">Confidential Accounting — Restricted Access</h4>
                        <p className="text-xs text-rose-200/70 mt-0.5 leading-relaxed">
                          Granular contract values, disbursement ledgers, and contractor profit margins for this project are restricted to Operations Directors only.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                          <span className="text-xs text-slate-400 font-mono uppercase">Total Contract Value</span>
                          <div className="text-xl font-bold text-white font-mono mt-1">₱{selectedProject.budget.toLocaleString()}</div>
                          <span className="text-[10px] text-slate-500">Fixed Turnkey BOQ</span>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                          <span className="text-xs text-slate-400 font-mono uppercase">Funds Collected</span>
                          <div className="text-xl font-bold text-emerald-400 font-mono mt-1">₱{selectedProject.fundsCollected.toLocaleString()}</div>
                          <span className="text-[10px] text-emerald-500/80">
                            {selectedProject.budget > 0 ? Math.round((selectedProject.fundsCollected / selectedProject.budget) * 100) : 0}% collected to date
                          </span>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                          <span className="text-xs text-slate-400 font-mono uppercase">Outstanding Balance</span>
                          <div className="text-xl font-bold text-amber-400 font-mono mt-1">
                            ₱{Math.max(0, selectedProject.budget - selectedProject.fundsCollected).toLocaleString()}
                          </div>
                          <span className="text-[10px] text-amber-500/80">Progress billing installment</span>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                          <span className="text-xs text-slate-400 font-mono uppercase">Disbursed (Paid)</span>
                          <div className="text-xl font-bold text-sky-400 font-mono mt-1">
                            ₱{(selectedProject.paidExpenses ?? (Number(selectedProject.paidLaborExpenses || 0) + Number(selectedProject.paidSubcontractorExpenses || 0))).toLocaleString()}
                          </div>
                          <span className="text-[10px] text-sky-500/80">
                            Labor: ₱{(selectedProject.paidLaborExpenses ?? 0).toLocaleString()} | AP: ₱{(selectedProject.paidSubcontractorExpenses ?? 0).toLocaleString()}
                          </span>
                          {(selectedProject.approvedExpenses ?? 0) > 0 && (
                            <span className="text-[10px] text-amber-400/80 block mt-0.5 font-mono">
                              Approved/Pending: ₱{selectedProject.approvedExpenses?.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Visual Cost Structure: In-House Labor vs Subcontractor Payables */}
                      {(() => {
                        const laborCost = Number(selectedProject.paidLaborExpenses ?? 0);
                        const subconCost = Number(selectedProject.paidSubcontractorExpenses ?? 0);
                        const totalPaidDisbursements = Number(selectedProject.paidExpenses ?? (laborCost + subconCost));
                        const otherOrMaterialsCost = Math.max(0, totalPaidDisbursements - (laborCost + subconCost));
                        const remainingBalance = Math.max(0, (selectedProject.budget || 0) - totalPaidDisbursements);

                        const costChartData = totalPaidDisbursements > 0 ? [
                          ...(laborCost > 0 ? [{ name: 'In-House Labor (Payroll)', value: laborCost, color: '#38bdf8' }] : []),
                          ...(subconCost > 0 ? [{ name: 'Subcontractor (AP)', value: subconCost, color: '#a855f7' }] : []),
                          ...(otherOrMaterialsCost > 0 ? [{ name: 'Materials & Procurement', value: otherOrMaterialsCost, color: '#f59e0b' }] : [])
                        ] : [
                          { name: 'Uncommitted Budget', value: Math.max(1, selectedProject.budget || 1), color: '#334155' }
                        ];

                        return (
                          <div className="mt-4 bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                              <div className="flex items-center gap-2">
                                <PieChartIcon className="w-4 h-4 text-sky-400" />
                                <h4 className="text-xs font-semibold text-white tracking-tight">Project Cost Composition: Labor Payroll vs. Subcontractor Payables</h4>
                              </div>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                Real-Time Disbursal Flow
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                              {/* Recharts Donut Pie */}
                              <div className="md:col-span-5 h-48 flex items-center justify-center">
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie
                                      data={costChartData}
                                      dataKey="value"
                                      nameKey="name"
                                      cx="50%"
                                      cy="50%"
                                      innerRadius={45}
                                      outerRadius={70}
                                      paddingAngle={4}
                                    >
                                      {costChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
                                      ))}
                                    </Pie>
                                    <ReTooltip
                                      formatter={(val: any) => [`₱${Number(val).toLocaleString()}`, 'Cost']}
                                      contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                                    />
                                    <Legend
                                      verticalAlign="bottom"
                                      iconType="circle"
                                      wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                                    />
                                  </PieChart>
                                </ResponsiveContainer>
                              </div>

                              {/* Breakdown Cards & Separation of Duties Explainers */}
                              <div className="md:col-span-7 space-y-2.5">
                                <div className="p-3 bg-sky-950/20 border border-sky-800/40 rounded-lg flex items-center justify-between">
                                  <div className="space-y-0.5">
                                    <div className="text-xs font-semibold text-sky-300 flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                                      In-House Labor (Direct Payroll)
                                    </div>
                                    <p className="text-[10px] text-slate-400">Timekeeper verified muster roll • Daily rate &amp; OT wages</p>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm font-bold font-mono text-sky-400">
                                      ₱{laborCost.toLocaleString()}
                                    </div>
                                    <span className="text-[10px] text-slate-500">
                                      {totalPaidDisbursements > 0 ? `${Math.round((laborCost / totalPaidDisbursements) * 100)}% of spend` : '0%'}
                                    </span>
                                  </div>
                                </div>

                                <div className="p-3 bg-purple-950/20 border border-purple-800/40 rounded-lg flex items-center justify-between">
                                  <div className="space-y-0.5">
                                    <div className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                                      Subcontractor Trade Payables (AP)
                                    </div>
                                    <p className="text-[10px] text-slate-400">Outsourced specialty crews • Manpower audit &amp; milestone billings</p>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm font-bold font-mono text-purple-400">
                                      ₱{subconCost.toLocaleString()}
                                    </div>
                                    <span className="text-[10px] text-slate-500">
                                      {totalPaidDisbursements > 0 ? `${Math.round((subconCost / totalPaidDisbursements) * 100)}% of spend` : '0%'}
                                    </span>
                                  </div>
                                </div>

                                <div className="p-2.5 bg-slate-900/60 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
                                  <span className="text-slate-400 font-mono text-[11px]">Uncommitted Budget Margin</span>
                                  <span className="font-mono font-bold text-emerald-400">
                                    ₱{remainingBalance.toLocaleString()} ({selectedProject.budget > 0 ? `${((remainingBalance / selectedProject.budget) * 100).toFixed(1)}%` : '100%'})
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {activeTabInsideProfile === 'WORKERS' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                      Assigned Project Roster ({(selectedProject.assignedContractorIds || []).length})
                    </span>
                  </div>

                  {(selectedProject.assignedContractorIds || []).length === 0 ? (
                    <div className="text-center py-6 bg-slate-950/60 border border-dashed border-slate-800 rounded-xl">
                      <Users className="w-7 h-7 text-slate-600 mx-auto mb-1.5" />
                      <p className="text-xs text-slate-500">No personnel currently assigned to this project site.</p>
                      <p className="text-[11px] text-slate-600 mt-0.5">Use the search box below to allocate crew members.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {contractors
                        .filter(c => (selectedProject.assignedContractorIds || []).includes(c.id))
                        .map(c => {
                          const initials = c.name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
                          return (
                            <div key={c.id} className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex items-center gap-2.5">
                              {c.avatar ? (
                                <img src={c.avatar} alt={c.name} className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-purple-400 font-bold text-xs shrink-0">
                                  {initials}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-white truncate">{c.name}</div>
                                <div className="text-[10px] text-amber-400 truncate">{c.specialty || c.roleTitle}</div>
                              </div>
                              <button
                                onClick={async () => {
                                  setIsAssigningWorker(true);
                                  try {
                                    const res = await fetch(`/api/projects/${selectedProject.id}/workers`, {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ workerId: c.id, action: 'remove' })
                                    });
                                    if (res.ok) {
                                      const data = await res.json();
                                      const updated = { ...selectedProject, assignedContractorIds: data.assignedContractorIds, assignedWorkersCount: data.assignedWorkersCount };
                                      setSelectedProject(updated);
                                      setLocalProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
                                    }
                                  } finally { setIsAssigningWorker(false); }
                                }}
                                className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer shrink-0"
                                title="Remove from project"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {/* Add Worker Search */}
                  <div className="border border-slate-800 rounded-xl p-3 bg-slate-950/60">
                    <p className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider mb-2">+ Add Personnel from Roster</p>
                    <input
                      type="text"
                      value={workerSearchQuery}
                      onChange={e => setWorkerSearchQuery(e.target.value)}
                      placeholder="Search roster by name, role, or trade..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 mb-2"
                    />
                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                      {contractors
                        .filter(c => !(selectedProject.assignedContractorIds || []).includes(c.id))
                        .filter(c => {
                          if (!workerSearchQuery.trim()) return true;
                          const q = workerSearchQuery.toLowerCase();
                          return c.name.toLowerCase().includes(q) || (c.specialty || '').toLowerCase().includes(q) || (c.roleTitle || '').toLowerCase().includes(q);
                        })
                        .map(c => {
                          const initials = c.name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
                          const avail = getWorkerAvailabilityAdvisory(c, selectedProject.startDate, selectedProject.targetHandoverDate, selectedProject.id);
                          return (
                            <div key={c.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-800/60 transition group">
                              {c.avatar ? (
                                <img src={c.avatar} alt={c.name} className="w-6 h-6 rounded-full object-cover border border-slate-700 shrink-0" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-purple-300 font-bold text-[9px] shrink-0">
                                  {initials}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-white truncate">{c.name}</div>
                                <div className="text-[10px] text-slate-400 truncate">{c.specialty || c.roleTitle}</div>
                              </div>
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border shrink-0 ${avail.isOverlapping
                                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 font-semibold'
                                    : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-semibold'
                                  }`}
                              >
                                {avail.badgeText}
                              </span>
                              <button
                                disabled={isAssigningWorker}
                                onClick={async () => {
                                  setIsAssigningWorker(true);
                                  try {
                                    const res = await fetch(`/api/projects/${selectedProject.id}/workers`, {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ workerId: c.id, action: 'add' })
                                    });
                                    if (res.ok) {
                                      const data = await res.json();
                                      const updated = { ...selectedProject, assignedContractorIds: data.assignedContractorIds, assignedWorkersCount: data.assignedWorkersCount };
                                      setSelectedProject(updated);
                                      setLocalProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
                                      setWorkerSearchQuery('');
                                    }
                                  } finally { setIsAssigningWorker(false); }
                                }}
                                className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded hover:bg-amber-500/30 transition cursor-pointer shrink-0 disabled:opacity-50"
                              >
                                + Assign
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3">
              {isAdmin && (
                <button
                  onClick={() => handleDelete(selectedProject.id)}
                  className="px-3 py-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 text-xs font-medium transition cursor-pointer"
                >
                  Delete Project
                </button>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => setSelectedProject(null)}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Project Modal with Tabs */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 relative bg-slate-900">
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer z-10"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-400" />
                <h3 className="text-base sm:text-lg font-bold text-white">Create Commercial Project Profile</h3>
              </div>

              {/* Form Tabs */}
              <div className="flex items-center gap-1 mt-3 border-t border-slate-800/80 pt-2.5">
                <button
                  type="button"
                  onClick={() => setModalTab('general')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${modalTab === 'general' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                >
                  1. General & Location
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('timeline')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${modalTab === 'timeline' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                >
                  2. Budget & Timeline
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('personnel')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${modalTab === 'personnel' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                >
                  3. Leadership & Crew ({formAssignedWorkerIds.length})
                </button>
              </div>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto flex flex-col">
              <div className="p-4 sm:p-6 space-y-4 flex-1">
                {isTimelineInvalid && (
                  <div className="flex items-center gap-2 p-3 bg-red-950/80 border border-red-500/60 rounded-xl text-red-300 text-xs font-semibold">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>Validation Alert: Target Handover Date cannot precede Start Date.</span>
                  </div>
                )}

                {modalTab === 'general' && (
                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Project Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., NexBridge Software Hub Phase 2"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Client / Corporate Account</label>
                      <input
                        type="text"
                        placeholder="e.g., Summit Holdings Philippines"
                        value={formClient}
                        onChange={(e) => setFormClient(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    <div className="relative" ref={locationDropdownRef}>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-mono text-slate-400 uppercase">Site Location / Address</label>
                        <span className="text-[10px] text-amber-400 font-mono flex items-center gap-1">
                          <CloudSun className="w-3 h-3" /> Live Weather Sync
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search any Philippine street, subdivision, barangay, or city..."
                          value={formLocation}
                          onChange={(e) => {
                            setFormLocation(e.target.value);
                            isLocationSelectedRef.current = false;
                          }}
                          onFocus={handleLocationFocus}
                          onKeyDown={handleLocationKeyDown}
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg pl-3 pr-16 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                          {formLocation && (
                            <button
                              type="button"
                              onClick={() => {
                                setFormLocation('');
                                setDetectedCoords(null);
                                setLocationSuggestions(getRecentPlaces());
                                setShowLocationDropdown(getRecentPlaces().length > 0);
                              }}
                              className="text-slate-500 hover:text-slate-300 p-0.5 rounded-full hover:bg-slate-800 transition-colors"
                              title="Clear search"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isSearchingLocation ? (
                            <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                          ) : (
                            <Search className="w-4 h-4 text-sky-400" />
                          )}
                        </div>
                      </div>

                      {/* Floating Live Autocomplete Dropdown (Google Maps Style) */}
                      {showLocationDropdown && locationSuggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl backdrop-blur-md overflow-hidden max-h-72 overflow-y-auto divide-y divide-slate-800/80">
                          <div className="px-3 py-1.5 bg-slate-950/95 text-[10px] font-mono text-slate-400 flex items-center justify-between border-b border-slate-800">
                            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              PHILIPPINES LIVE PLACES
                            </span>
                            <span className="text-slate-500">↑↓ to navigate, Enter to select</span>
                          </div>
                          {locationSuggestions.map((s, idx) => (
                            <button
                              key={`${s.lat}-${s.lng}-${idx}`}
                              type="button"
                              onClick={() => handleSelectLocation(s)}
                              className={`w-full text-left px-3.5 py-2.5 flex items-center gap-3 transition-colors ${selectedSuggestionIndex === idx
                                  ? 'bg-amber-500/15 border-l-2 border-amber-400 text-white'
                                  : 'hover:bg-slate-800/80 text-slate-200'
                                }`}
                            >
                              {s.isRecent ? (
                                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                              ) : (
                                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                              )}
                              <div className="min-w-0 flex-1 flex items-baseline gap-2 truncate">
                                <span className="text-xs sm:text-sm text-slate-200 truncate">
                                  {renderHighlightedMatch(s.displayName, formLocation)}
                                </span>
                                {s.subLabel && (
                                  <span className="text-[11px] sm:text-xs text-slate-400 font-normal truncate">
                                    {s.subLabel}
                                  </span>
                                )}
                              </div>
                              <span className="shrink-0 text-[10px] font-mono text-emerald-400/90 bg-emerald-950/70 border border-emerald-500/30 px-1.5 py-0.5 rounded ml-1 hidden sm:inline-block">
                                {s.lat.toFixed(4)}°N, {s.lng.toFixed(4)}°E
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {formLocation.trim() && (
                        <div className={`mt-2 p-2 rounded-lg border text-xs flex items-center justify-between ${detectedCoords ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-400'
                          }`}>
                          <div className="flex items-center gap-2 truncate">
                            <MapPin className={`w-3.5 h-3.5 shrink-0 ${detectedCoords ? 'text-emerald-400' : 'text-slate-500'}`} />
                            <span className="truncate">
                              {detectedCoords ? (
                                <>Weather Station: <strong className="text-white">{detectedCoords.name}</strong> ({detectedCoords.lat.toFixed(4)}°N, {detectedCoords.lon.toFixed(4)}°E)</>
                              ) : (
                                'Resolving weather station telemetry...'
                              )}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Scope & Description</label>
                      <textarea
                        rows={3}
                        placeholder="e.g., Turnkey architectural fit-out, MEP roughing, HVAC, glass partitions."
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {modalTab === 'timeline' && (
                  <div className="space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Contract Budget (PHP)</label>
                        <input
                          type="number"
                          value={formBudget === 0 ? '' : formBudget}
                          onChange={(e) => setFormBudget(e.target.value === '' ? 0 : Number(e.target.value))}
                          placeholder="0"
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Physical Progress</label>
                        <div className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs flex items-center justify-between text-slate-300 font-mono">
                          <span className="font-bold text-amber-400">0%</span>
                          <span className="text-[10px] text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            ⚡ Auto-Synced from Master CPM Gantt
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Project Status</label>
                        <select
                          value={formStatus}
                          onChange={(e) => setFormStatus(e.target.value as any)}
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                        >
                          <option value="PLANNING">Planning Phase</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="PUNCHLIST_QA">Punchlist & QA</option>
                          <option value="HANDED_OVER">Handed Over</option>
                          <option value="COMPLETED">Completed</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Deliverable Milestones</label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={formMilestonesCount}
                          onChange={(e) => setFormMilestonesCount(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Start Date</label>
                        <input
                          type="date"
                          value={formStartDate}
                          onChange={(e) => setFormStartDate(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Target Handover Date</label>
                        <input
                          type="date"
                          value={formEndDate}
                          onChange={(e) => setFormEndDate(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {modalTab === 'personnel' && (
                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Lead Project Manager / Head Engineer *</label>
                      <select
                        value={formPMId}
                        onChange={(e) => {
                          setFormPMId(e.target.value);
                          const pm = availablePMs.find(p => p.id === e.target.value);
                          setFormPMName(pm ? pm.name : '');
                        }}
                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                      >
                        <option value="">Select Project Lead / Head Engineer...</option>
                        {availablePMs.map(pm => (
                          <option key={pm.id} value={pm.id}>{pm.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2 p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                      <input
                        type="checkbox"
                        id="new-private-accounting"
                        checked={formIsPrivateAccounting}
                        onChange={(e) => setFormIsPrivateAccounting(e.target.checked)}
                        className="w-4 h-4 rounded text-amber-500 focus:ring-0 bg-slate-900 border-slate-700 cursor-pointer"
                      />
                      <label htmlFor="new-private-accounting" className="text-xs text-slate-300 cursor-pointer select-none">
                        Confidential Accounting (Restricted to Operations Directors)
                      </label>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800/80 flex items-start gap-3">
                      <Users className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                      <div className="text-xs text-slate-300 leading-relaxed">
                        <span className="font-semibold text-white block mb-0.5">Workforce & Artisan Crew Dispatch</span>
                        Per field engineering workflow, trade crews and skilled artisans are assigned after project creation via the <strong className="text-teal-400">Labor Workforce & Artisan Trades</strong> workbench.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Pinned Sticky Footer - Always Visible */}
              <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isTimelineInvalid || !formName.trim()}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-xs transition cursor-pointer"
                >
                  Save Project Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Project Modal with Tabs */}
      {showEditModal && selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 relative bg-slate-900">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer z-10"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                <h3 className="text-base sm:text-lg font-bold text-white">Edit Profile: {selectedProject.name}</h3>
              </div>

              {/* Form Tabs */}
              <div className="flex items-center gap-1 mt-3 border-t border-slate-800/80 pt-2.5">
                <button
                  type="button"
                  onClick={() => setModalTab('general')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${modalTab === 'general' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                >
                  1. General & Location
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('timeline')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${modalTab === 'timeline' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                >
                  2. Budget & Timeline
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('personnel')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${modalTab === 'personnel' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                >
                  3. Leadership & Crew ({formAssignedWorkerIds.length})
                </button>
              </div>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto flex flex-col">
              <div className="p-4 sm:p-6 space-y-4 flex-1">
                {isTimelineInvalid && (
                  <div className="flex items-center gap-2 p-3 bg-red-950/80 border border-red-500/60 rounded-xl text-red-300 text-xs font-semibold">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>Validation Alert: Target Handover Date cannot precede Start Date.</span>
                  </div>
                )}

                {modalTab === 'general' && (
                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Project Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., NexBridge Software Hub Phase 2"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Client / Corporate Account</label>
                      <input
                        type="text"
                        placeholder="e.g., Summit Holdings Philippines"
                        value={formClient}
                        onChange={(e) => setFormClient(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    <div className="relative" ref={locationDropdownRef}>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-mono text-slate-400 uppercase">Site Location / Address</label>
                        <span className="text-[10px] text-amber-400 font-mono flex items-center gap-1">
                          <CloudSun className="w-3 h-3" /> Live Weather Sync
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search any Philippine street, subdivision, barangay, or city..."
                          value={formLocation}
                          onChange={(e) => {
                            setFormLocation(e.target.value);
                            isLocationSelectedRef.current = false;
                          }}
                          onFocus={handleLocationFocus}
                          onKeyDown={handleLocationKeyDown}
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg pl-3 pr-16 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                          {formLocation && (
                            <button
                              type="button"
                              onClick={() => {
                                setFormLocation('');
                                setDetectedCoords(null);
                                setLocationSuggestions(getRecentPlaces());
                                setShowLocationDropdown(getRecentPlaces().length > 0);
                              }}
                              className="text-slate-500 hover:text-slate-300 p-0.5 rounded-full hover:bg-slate-800 transition-colors"
                              title="Clear search"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isSearchingLocation ? (
                            <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                          ) : (
                            <Search className="w-4 h-4 text-sky-400" />
                          )}
                        </div>
                      </div>

                      {/* Floating Live Autocomplete Dropdown (Google Maps Style) */}
                      {showLocationDropdown && locationSuggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl backdrop-blur-md overflow-hidden max-h-72 overflow-y-auto divide-y divide-slate-800/80">
                          <div className="px-3 py-1.5 bg-slate-950/95 text-[10px] font-mono text-slate-400 flex items-center justify-between border-b border-slate-800">
                            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              PHILIPPINES LIVE PLACES
                            </span>
                            <span className="text-slate-500">↑↓ to navigate, Enter to select</span>
                          </div>
                          {locationSuggestions.map((s, idx) => (
                            <button
                              key={`${s.lat}-${s.lng}-${idx}`}
                              type="button"
                              onClick={() => handleSelectLocation(s)}
                              className={`w-full text-left px-3.5 py-2.5 flex items-center gap-3 transition-colors ${selectedSuggestionIndex === idx
                                  ? 'bg-amber-500/15 border-l-2 border-amber-400 text-white'
                                  : 'hover:bg-slate-800/80 text-slate-200'
                                }`}
                            >
                              {s.isRecent ? (
                                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                              ) : (
                                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                              )}
                              <div className="min-w-0 flex-1 flex items-baseline gap-2 truncate">
                                <span className="text-xs sm:text-sm text-slate-200 truncate">
                                  {renderHighlightedMatch(s.displayName, formLocation)}
                                </span>
                                {s.subLabel && (
                                  <span className="text-[11px] sm:text-xs text-slate-400 font-normal truncate">
                                    {s.subLabel}
                                  </span>
                                )}
                              </div>
                              <span className="shrink-0 text-[10px] font-mono text-emerald-400/90 bg-emerald-950/70 border border-emerald-500/30 px-1.5 py-0.5 rounded ml-1 hidden sm:inline-block">
                                {s.lat.toFixed(4)}°N, {s.lng.toFixed(4)}°E
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {formLocation.trim() && (
                        <div className={`mt-2 p-2 rounded-lg border text-xs flex items-center justify-between ${detectedCoords ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-400'
                          }`}>
                          <div className="flex items-center gap-2 truncate">
                            <MapPin className={`w-3.5 h-3.5 shrink-0 ${detectedCoords ? 'text-emerald-400' : 'text-slate-500'}`} />
                            <span className="truncate">
                              {detectedCoords ? (
                                <>Weather Station: <strong className="text-white">{detectedCoords.name}</strong> ({detectedCoords.lat.toFixed(4)}°N, {detectedCoords.lon.toFixed(4)}°E)</>
                              ) : (
                                'Resolving weather station telemetry...'
                              )}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Scope & Description</label>
                      <textarea
                        rows={3}
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {modalTab === 'timeline' && (
                  <div className="space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Contract Budget (PHP)</label>
                        <input
                          type="number"
                          value={formBudget === 0 ? '' : formBudget}
                          onChange={(e) => setFormBudget(e.target.value === '' ? 0 : Number(e.target.value))}
                          placeholder="0"
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Funds Collected (PHP)</label>
                        <input
                          type="number"
                          value={formCollected === 0 ? '' : formCollected}
                          onChange={(e) => setFormCollected(e.target.value === '' ? 0 : Number(e.target.value))}
                          placeholder="0"
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Project Status</label>
                        <select
                          value={formStatus}
                          onChange={(e) => setFormStatus(e.target.value as any)}
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                        >
                          <option value="PLANNING">Planning Phase</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="PUNCHLIST_QA">Punchlist & QA</option>
                          <option value="HANDED_OVER">Handed Over</option>
                          <option value="COMPLETED">Completed</option>
                        </select>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-mono text-slate-400 uppercase">Physical Progress</label>
                          <span className="text-[10px] text-amber-400/90 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            ⚡ Auto-Synced from Master CPM Gantt
                          </span>
                        </div>
                        <div className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs flex items-center justify-between text-slate-300 font-mono">
                          <span className="font-bold text-amber-400">{formProgress}% Complete</span>
                          <span className="text-[10px] text-slate-500">Read-Only</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Start Date</label>
                        <input
                          type="date"
                          value={formStartDate}
                          onChange={(e) => setFormStartDate(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Target Handover Date</label>
                        <input
                          type="date"
                          value={formEndDate}
                          onChange={(e) => setFormEndDate(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {modalTab === 'personnel' && (
                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Lead Project Manager</label>
                      <select
                        value={formPMId}
                        onChange={(e) => {
                          setFormPMId(e.target.value);
                          const pm = availablePMs.find(p => p.id === e.target.value);
                          setFormPMName(pm ? pm.name : '');
                        }}
                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                      >
                        <option value="">Select Project Lead...</option>
                        {availablePMs.map(pm => (
                          <option key={pm.id} value={pm.id}>{pm.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2 p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                      <input
                        type="checkbox"
                        id="edit-private-accounting"
                        checked={formIsPrivateAccounting}
                        onChange={(e) => setFormIsPrivateAccounting(e.target.checked)}
                        className="w-4 h-4 rounded text-amber-500 focus:ring-0 bg-slate-900 border-slate-700 cursor-pointer"
                      />
                      <label htmlFor="edit-private-accounting" className="text-xs text-slate-300 cursor-pointer select-none">
                        Confidential Accounting (Restricted to Operations Directors)
                      </label>
                    </div>

                    {renderCrewAssignmentDecisionSupport(selectedProject.id)}
                  </div>
                )}
              </div>

              {/* Pinned Sticky Footer - Always Visible */}
              <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isTimelineInvalid || !formName.trim()}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-xs transition cursor-pointer"
                >
                  Update Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Workforce Reallocation Modal */}
      {showReallocationModal && activeReallocProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[90dvh] overflow-y-auto shadow-2xl p-4 sm:p-6 relative my-auto">
            <button
              onClick={() => setShowReallocationModal(false)}
              className="absolute top-3 right-3 sm:top-5 sm:right-5 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-indigo-400" />
              <h3 className="text-lg font-bold text-white">Cross-Project Workforce Reallocation</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Project <strong className="text-white">"{activeReallocProject.name}"</strong> is at {activeReallocProject.progressPercentage}% completion.
              The dynamic labor allocation engine has detected surplus workers and generated target reassignments.
            </p>

            {reallocFeedback && (
              <div className="mb-4 p-3 bg-indigo-950/80 border border-indigo-700 rounded-xl text-xs font-semibold text-indigo-300 flex items-center justify-between">
                <span>{reallocFeedback}</span>
                <button onClick={() => setReallocFeedback(null)} className="text-slate-400 hover:text-white font-bold ml-2 cursor-pointer">✕</button>
              </div>
            )}

            <div className="space-y-3">
              {reallocRecommendations.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs italic">
                  No surplus reallocation recommendations found for this project.
                </div>
              ) : (
                reallocRecommendations.map(rec => (
                  <div
                    key={rec.id}
                    className="bg-slate-950/80 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-4 transition space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-950 border border-indigo-700 text-indigo-300 flex items-center justify-center font-bold text-xs">
                          {rec.workerName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">{rec.workerName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{rec.roleTitle}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${rec.workforceCategory === 'PROFESSIONAL' ? 'bg-purple-950 text-purple-300 border-purple-700' :
                            rec.workforceCategory === 'SKILLED' ? 'bg-amber-950 text-amber-300 border-amber-700' :
                              'bg-cyan-950 text-cyan-300 border-cyan-700'
                          }`}>
                          {rec.workforceCategory}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${rec.priority === 'HIGH' ? 'bg-rose-950 text-rose-300 border border-rose-700' : 'bg-slate-800 text-slate-300'
                          }`}>
                          {rec.priority} PRIORITY
                        </span>
                      </div>
                    </div>

                    {/* Transfer Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                      <div>
                        <span className="text-[10px] font-mono text-slate-500 uppercase block">From Project</span>
                        <span className="font-semibold text-slate-300 truncate block">{rec.originProjectName} ({rec.originProgress}%)</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-slate-500 uppercase block">Target Recipient</span>
                        <span className="font-semibold text-amber-300 truncate block">{rec.targetProjectName} ({rec.targetProgress}%)</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 italic">
                      "{rec.rationale}"
                    </p>

                    <div className="flex justify-end pt-1">
                      {rec.applied ? (
                        <span className="px-3 py-1 bg-emerald-950 text-emerald-300 border border-emerald-700 text-xs font-bold rounded-lg flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Reassigned
                        </span>
                      ) : (
                        <button
                          onClick={() => handleExecuteReallocation(rec)}
                          disabled={isReallocating}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <span>Execute Transfer</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowReallocationModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

