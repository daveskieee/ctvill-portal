/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import { 
  FileText, Upload, Download, Eye, CheckCircle2, 
  Clock, ShieldAlert, Folder, Filter, Plus, X, FileCode,
  Edit3, Trash2, Check, AlertTriangle, FileSpreadsheet,
  Maximize2, ZoomIn, ZoomOut, RotateCcw, Layers, MapPin,
  BarChart3, RefreshCw, SlidersHorizontal, ArrowRight,
  ExternalLink, Sparkles, FolderKanban, CheckCheck, Compass,
  LayoutGrid, List, ArrowUpDown, ArrowUp, ArrowDown,
  HardDrive, ChevronDown, CheckSquare, Square, Search,
  Calendar, User, Tag, FileCheck, FileArchive,
  Database, AlertCircle
} from 'lucide-react';
import { ProjectDocument, CivilWorksMilestone } from '../types';

interface DocumentManagerProps {
  documents: ProjectDocument[];
  onUploadDocument: (doc: Omit<ProjectDocument, 'id' | 'createdAt'>) => void;
  onUpdateDocument?: (id: string, doc: Partial<ProjectDocument>) => void;
  onDeleteDocument?: (id: string) => void;
  milestones?: CivilWorksMilestone[];
  onUpdateMilestone?: (milestoneId: string, currentPercentage: number, status: string, inspectorSignOff: boolean, remarks?: string) => void;
  onSyncSchedule?: (tasks: any[]) => void;
  onNavigateTab?: (tab: string) => void;
}

interface ScheduleRow {
  id: string;
  wbs: string;
  taskName: string;
  category: string;
  contractor: string;
  durationWeeks: number;
  progress: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
}

export type SortField = 'title' | 'createdAt' | 'fileSize' | 'category' | 'status';
export type SortDirection = 'asc' | 'desc';
export type ViewMode = 'list' | 'grid';

export const DEFAULT_SEED_DOCUMENTS: ProjectDocument[] = [
  {
    id: 'doc-arch-finishes-v2',
    title: 'Architectural Floor Plan & Interior Finishes Schedule v2.pdf',
    category: 'ARCHITECTURAL',
    fileUrl: '/documents/Architectural_Floor_Plan_Interior_Finishes_v2.pdf',
    fileSize: '12.4 MB',
    version: '2.0',
    status: 'APPROVED',
    uploadedBy: 'Ar. Jonathan Dela Cruz',
    notes: 'Architectural layout, ceiling reflected plan, and material specifications schedule.',
    createdAt: '2026-09-24T08:30:00.000Z'
  },
  {
    id: 'doc-mepfs-singleline',
    title: 'MEPFS Single Line Diagram & Load Calculations.dwg',
    category: 'STRUCTURAL_PLAN',
    fileUrl: '/documents/MEPFS_Single_Line_Diagram_Load_Calc.dwg',
    fileSize: '18.6 MB',
    version: '1.4',
    status: 'APPROVED',
    uploadedBy: 'Engr. Carlos Mendoza',
    notes: 'Electrical single-line diagram, HVAC load calculations, and sanitary plumbing layout.',
    createdAt: '2026-09-22T14:15:00.000Z'
  },
  {
    id: 'doc-boq-prj4693',
    title: 'Detailed Bill of Quantities (BOQ) - PRJ-4693.xlsx',
    category: 'SPECIFICATIONS',
    fileUrl: '/documents/Detailed_BOQ_PRJ_4693.xlsx',
    fileSize: '4.8 MB',
    version: '3.1',
    status: 'APPROVED',
    uploadedBy: 'Engr. Ricardo Ramos',
    notes: 'Full itemized turnkey fit-out bill of quantities with materials breakdown and labor costings.',
    createdAt: '2026-09-25T11:00:00.000Z'
  },
  {
    id: 'doc-permit-barangay-clearance',
    title: 'Barangay & City Hall Building Clearance Endorsement.pdf',
    category: 'LGU_CLEARANCE',
    fileUrl: '/documents/Barangay_City_Hall_Clearance_Endorsement.pdf',
    fileSize: '2.1 MB',
    version: '1.0',
    status: 'APPROVED',
    uploadedBy: 'Mauro R. Principe Jr.',
    notes: 'Approved local government building clearance and zoning endorsement certificate.',
    createdAt: '2026-09-20T09:45:00.000Z'
  },
  {
    id: 'doc-two-story-plans',
    title: 'Two story house plans.dwg',
    category: 'CAD_DRAWING',
    fileUrl: '/documents/Two_story_house_plans.dwg',
    fileSize: '0.3 MB',
    version: '1.0',
    status: 'IN_REVIEW',
    uploadedBy: 'Operations',
    notes: 'Minor revisions changes upon client request.',
    createdAt: '2026-09-26T16:20:00.000Z'
  }
];

// Database maximum capacity thresholds (PostgreSQL / Express API)
export const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_UPLOAD_SIZE_LABEL = '50 MB';

// Enterprise Database & Cloud Archive Total Storage Capacity (10 GB Standard Enterprise Quota)
export const TOTAL_STORAGE_QUOTA_MB = 10240; // 10 GB
export const TOTAL_STORAGE_QUOTA_BYTES = TOTAL_STORAGE_QUOTA_MB * 1024 * 1024;

// Helper to format bytes into readable KB, MB, or GB string
export const formatBytesToReadable = (bytes: number): string => {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${bytes} B`;
};

// Helper to convert size string to bytes for precise mathematical sorting
const parseFileSizeToBytes = (sizeStr?: string): number => {
  if (!sizeStr) return 0;
  const match = sizeStr.match(/([\d.]+)\s*(MB|KB|GB|B)/i);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === 'GB') return num * 1024 * 1024 * 1024;
  if (unit === 'MB') return num * 1024 * 1024;
  if (unit === 'KB') return num * 1024;
  return num;
};

// Formats file date to readable OneDrive format
const formatOneDriveDate = (dateStr?: string): string => {
  if (!dateStr) return 'Recently';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return `Today, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (diffDays === 1) return `Yesterday, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

export default function DocumentManager({ 
  documents, 
  onUploadDocument,
  onUpdateDocument,
  onDeleteDocument,
  milestones = [],
  onUpdateMilestone,
  onSyncSchedule,
  onNavigateTab
}: DocumentManagerProps) {
  // Navigation & Category state
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPROVED' | 'IN_REVIEW' | 'DRAFT'>('ALL');

  // OneDrive View & Sorting Controls
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const stored = localStorage.getItem('ctvill_doc_view_mode');
      return (stored === 'grid' || stored === 'list') ? stored : 'list';
    } catch {
      return 'list';
    }
  });

  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState<boolean>(false);

  // Modals state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [editDoc, setEditDoc] = useState<ProjectDocument | null>(null);
  const [deleteConfirmDoc, setDeleteConfirmDoc] = useState<ProjectDocument | null>(null);
  const [previewDoc, setPreviewDoc] = useState<ProjectDocument | null>(null);
  const [toastNotification, setToastNotification] = useState<string | null>(null);

  // Upload Form State
  const [uploadTitle, setUploadTitle] = useState<string>('');
  const [uploadCategory, setUploadCategory] = useState<ProjectDocument['category']>('CAD_DRAWING');
  const [uploadVersion, setUploadVersion] = useState<string>('1.0');
  const [uploadStatus, setUploadStatus] = useState<ProjectDocument['status']>('APPROVED');
  const [uploadFileSize, setUploadFileSize] = useState<string>('3.2 MB');
  const [uploadNotes, setUploadNotes] = useState<string>('');
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [selectedFileSizeBytes, setSelectedFileSizeBytes] = useState<number>(0);
  const [fileSizeError, setFileSizeError] = useState<string | null>(null);

  // Edit Form State
  const [editTitle, setEditTitle] = useState<string>('');
  const [editCategory, setEditCategory] = useState<ProjectDocument['category']>('CAD_DRAWING');
  const [editVersion, setEditVersion] = useState<string>('1.0');
  const [editStatus, setEditStatus] = useState<ProjectDocument['status']>('APPROVED');
  const [editNotes, setEditNotes] = useState<string>('');

  // CAD Preview Controls State
  const [cadZoom, setCadZoom] = useState<number>(1);
  const [cadShowGrid, setCadShowGrid] = useState<boolean>(true);
  const [cadShowMep, setCadShowMep] = useState<boolean>(true);
  const [cadShowFurniture, setCadShowFurniture] = useState<boolean>(true);

  // Excel / Gantt Schedule Preview State derived directly from live database milestones
  const [scheduleData, setScheduleData] = useState<ScheduleRow[]>(() => {
    if (milestones && milestones.length > 0) {
      return milestones.map((m, idx) => ({
        id: m.id,
        wbs: `1.${idx + 1}`,
        taskName: m.phaseName,
        category: 'Commercial Fit-Out',
        contractor: 'Assigned Trade Partner',
        durationWeeks: 4,
        progress: Math.round(m.currentPercentage),
        status: m.status === 'COMPLETED' ? 'COMPLETED' : m.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'NOT_STARTED'
      }));
    }
    return [];
  });

  React.useEffect(() => {
    if (milestones && milestones.length > 0) {
      setScheduleData(milestones.map((m, idx) => ({
        id: m.id,
        wbs: `1.${idx + 1}`,
        taskName: m.phaseName,
        category: 'Commercial Fit-Out',
        contractor: 'Assigned Trade Partner',
        durationWeeks: 4,
        progress: Math.round(m.currentPercentage),
        status: m.status === 'COMPLETED' ? 'COMPLETED' : m.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'NOT_STARTED'
      })));
    }
  }, [milestones]);

  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const categories = [
    { id: 'ALL', label: 'All Documents' },
    { id: 'CAD_DRAWING', label: 'CAD & Floor Plans' },
    { id: 'ARCHITECTURAL', label: 'Architectural & Interior' },
    { id: 'STRUCTURAL_PLAN', label: 'MEPFS & Engineering' },
    { id: 'SPECIFICATIONS', label: 'Excel Schedules & BOQ' },
    { id: 'LGU_CLEARANCE', label: 'Permits & Clearances' },
  ];

  const showToast = (msg: string) => {
    setToastNotification(msg);
    setTimeout(() => setToastNotification(null), 3500);
  };

  const handleToggleViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('ctvill_doc_view_mode', mode);
    } catch { /* silent */ }
  };

  // Detect file type for specialized previewer
  const isCadDocument = (doc: ProjectDocument) => {
    const title = doc.title.toLowerCase();
    return doc.category === 'CAD_DRAWING' || title.endsWith('.dxf') || title.endsWith('.dwg') || title.includes('cad') || title.includes('plan') || title.includes('blueprint');
  };

  const isExcelScheduleDocument = (doc: ProjectDocument) => {
    const title = doc.title.toLowerCase();
    return title.endsWith('.xlsx') || title.endsWith('.csv') || title.endsWith('.xls') || title.includes('schedule') || title.includes('gantt') || title.includes('boq') || title.includes('wbs') || title.includes('timeline');
  };

  const isPdfDocument = (doc: ProjectDocument) => {
    const title = doc.title.toLowerCase();
    return title.endsWith('.pdf') || doc.category === 'LGU_CLEARANCE';
  };

  // Helper for OneDrive-style file icon and colors
  const getFileIconConfig = (doc: ProjectDocument) => {
    const title = doc.title.toLowerCase();
    if (title.endsWith('.pdf')) {
      return {
        icon: FileText,
        bgColor: 'bg-rose-950/80',
        borderColor: 'border-rose-700/60',
        textColor: 'text-rose-400',
        label: 'PDF',
      };
    }
    if (title.endsWith('.xlsx') || title.endsWith('.xls') || title.endsWith('.csv') || doc.category === 'SPECIFICATIONS') {
      return {
        icon: FileSpreadsheet,
        bgColor: 'bg-emerald-950/80',
        borderColor: 'border-emerald-700/60',
        textColor: 'text-emerald-400',
        label: 'XLSX',
      };
    }
    if (title.endsWith('.dwg') || title.endsWith('.dxf') || doc.category === 'CAD_DRAWING' || doc.category === 'STRUCTURAL_PLAN') {
      return {
        icon: FileCode,
        bgColor: 'bg-amber-950/80',
        borderColor: 'border-amber-700/60',
        textColor: 'text-amber-400',
        label: 'CAD',
      };
    }
    return {
      icon: FileText,
      bgColor: 'bg-blue-950/80',
      borderColor: 'border-blue-700/60',
      textColor: 'text-blue-400',
      label: 'DOC',
    };
  };

  // Real download trigger
  const handleDownloadFile = (doc: ProjectDocument) => {
    const dummyContent = `CTVill Construction ERP Centralized Project Archive\nDocument: ${doc.title}\nVersion: ${doc.version}\nCategory: ${doc.category}\nStatus: ${doc.status}\nAuthor: ${doc.uploadedBy}\nNotes: ${doc.notes || 'None'}\nExported: ${new Date().toISOString()}`;
    const blob = new Blob([dummyContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = doc.title;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Downloaded: ${doc.title}`);
  };

  // Handle File Input Selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFileName(file.name);
      setSelectedFileSizeBytes(file.size);

      // Validate against the database max upload threshold (50 MB)
      if (file.size > MAX_UPLOAD_SIZE_BYTES) {
        const actualMb = (file.size / (1024 * 1024)).toFixed(1);
        setFileSizeError(`File size (${actualMb} MB) exceeds the maximum database limit of ${MAX_UPLOAD_SIZE_LABEL}. Please choose an asset under 50 MB.`);
      } else {
        setFileSizeError(null);
      }

      if (!uploadTitle.trim()) {
        setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setUploadFileSize(`${sizeMb} MB`);

      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'dxf' || ext === 'dwg') {
        setUploadCategory('CAD_DRAWING');
      } else if (ext === 'xlsx' || ext === 'csv' || ext === 'xls') {
        setUploadCategory('SPECIFICATIONS');
      } else if (ext === 'pdf') {
        setUploadCategory('LGU_CLEARANCE');
      }
    }
  };

  // Upload Submission
  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim()) return;

    if (fileSizeError || selectedFileSizeBytes > MAX_UPLOAD_SIZE_BYTES) {
      showToast('Cannot upload: File exceeds the maximum database limit of 50 MB');
      return;
    }

    onUploadDocument({
      title: uploadTitle.trim(),
      category: uploadCategory,
      version: uploadVersion.trim() || '1.0',
      status: uploadStatus,
      uploadedBy: 'Operations Director',
      fileSize: uploadFileSize,
      notes: uploadNotes.trim() || 'Uploaded to project centralized document vault.',
    });

    setUploadTitle('');
    setUploadNotes('');
    setSelectedFileName('');
    setSelectedFileSizeBytes(0);
    setFileSizeError(null);
    setIsUploadModalOpen(false);
    showToast(`Uploaded "${uploadTitle.trim()}" to project archive`);
  };

  // Open Edit Modal
  const handleOpenEdit = (doc: ProjectDocument) => {
    setEditDoc(doc);
    setEditTitle(doc.title);
    setEditCategory(doc.category);
    setEditVersion(doc.version);
    setEditStatus(doc.status);
    setEditNotes(doc.notes || '');
  };

  // Submit Edit
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDoc || !onUpdateDocument) return;

    onUpdateDocument(editDoc.id, {
      title: editTitle.trim(),
      category: editCategory,
      version: editVersion.trim(),
      status: editStatus,
      notes: editNotes.trim(),
    });

    setEditDoc(null);
    showToast(`Updated document details`);
  };

  // Confirm Delete
  const handleConfirmDelete = () => {
    if (deleteConfirmDoc && onDeleteDocument) {
      onDeleteDocument(deleteConfirmDoc.id);
      showToast(`Deleted document "${deleteConfirmDoc.title}"`);
      setDeleteConfirmDoc(null);
    }
  };

  // Sync Schedule Spreadsheet Progress to Project Gantt Schedule (Database Sync)
  const handleSyncToGantt = () => {
    if (onSyncSchedule) {
      onSyncSchedule(scheduleData);
    } else if (milestones && milestones.length > 0 && onUpdateMilestone) {
      scheduleData.forEach((row, idx) => {
        if (milestones[idx]) {
          onUpdateMilestone(
            milestones[idx].id,
            row.progress,
            row.status,
            row.status === 'COMPLETED',
            `Synchronized from Document Management: ${row.taskName}`
          );
        }
      });
    }

    setSyncNotice(`Progress successfully synchronized with project database & Gantt timeline!`);
    setTimeout(() => setSyncNotice(null), 4000);
  };

  // Open Directly in Gantt Timeline
  const handleOpenInGantt = () => {
    handleSyncToGantt();
    if (onNavigateTab) {
      onNavigateTab('gantt');
    }
  };

  // Merge seed documents if not present
  const effectiveDocuments = useMemo(() => {
    const list = [...(documents || [])];
    for (const seed of DEFAULT_SEED_DOCUMENTS) {
      const exists = list.some(d => d.id === seed.id || d.category === seed.category || d.title.toLowerCase() === seed.title.toLowerCase());
      if (!exists) {
        list.push(seed);
      }
    }
    return list;
  }, [documents]);

  // Total Storage Metric Calculation (Used, Maximum Quota, Available)
  const storageMetrics = useMemo(() => {
    let totalBytes = 0;
    const catCounts: Record<string, number> = { CAD: 0, Excel: 0, PDF: 0, Other: 0 };
    for (const doc of effectiveDocuments) {
      totalBytes += parseFileSizeToBytes(doc.fileSize);
      const title = doc.title.toLowerCase();
      if (title.endsWith('.dwg') || title.endsWith('.dxf') || doc.category === 'CAD_DRAWING' || doc.category === 'STRUCTURAL_PLAN') {
        catCounts.CAD += 1;
      } else if (title.endsWith('.xlsx') || title.endsWith('.csv') || doc.category === 'SPECIFICATIONS') {
        catCounts.Excel += 1;
      } else if (title.endsWith('.pdf') || doc.category === 'LGU_CLEARANCE' || doc.category === 'ARCHITECTURAL') {
        catCounts.PDF += 1;
      } else {
        catCounts.Other += 1;
      }
    }
    const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);
    const usedBytes = totalBytes;
    const usedLabel = formatBytesToReadable(usedBytes);
    const maxBytes = TOTAL_STORAGE_QUOTA_BYTES;
    const maxLabel = formatBytesToReadable(maxBytes);
    const availableBytes = Math.max(0, TOTAL_STORAGE_QUOTA_BYTES - usedBytes);
    const availableLabel = formatBytesToReadable(availableBytes);
    const percentageUsedNum = Math.min(100, (usedBytes / TOTAL_STORAGE_QUOTA_BYTES) * 100);
    const percentageUsed = percentageUsedNum.toFixed(1);
    const percentageAvailable = Math.max(0, 100 - percentageUsedNum).toFixed(1);

    return { 
      totalMb, 
      usedBytes,
      usedLabel,
      maxBytes,
      maxLabel,
      availableBytes,
      availableLabel,
      percentageUsed,
      percentageAvailable,
      totalCount: effectiveDocuments.length, 
      catCounts 
    };
  }, [effectiveDocuments]);

  // Sorting Handler
  const handleSortChange = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'createdAt' || field === 'fileSize' ? 'desc' : 'asc');
    }
  };

  // Filtered & Sorted Documents
  const filteredAndSortedDocs = useMemo(() => {
    const filtered = effectiveDocuments.filter((d) => {
      const matchesCategory = activeCategory === 'ALL' || d.category === activeCategory;
      const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        d.title.toLowerCase().includes(q) || 
        (d.notes && d.notes.toLowerCase().includes(q)) ||
        d.uploadedBy.toLowerCase().includes(q) ||
        d.version.toLowerCase().includes(q);
      return matchesCategory && matchesStatus && matchesSearch;
    });

    return filtered.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'title') {
        comparison = a.title.localeCompare(b.title);
      } else if (sortField === 'createdAt') {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        comparison = timeA - timeB;
      } else if (sortField === 'fileSize') {
        const bytesA = parseFileSizeToBytes(a.fileSize);
        const bytesB = parseFileSizeToBytes(b.fileSize);
        comparison = bytesA - bytesB;
      } else if (sortField === 'category') {
        comparison = a.category.localeCompare(b.category);
      } else if (sortField === 'status') {
        comparison = a.status.localeCompare(b.status);
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [effectiveDocuments, activeCategory, statusFilter, searchQuery, sortField, sortDirection]);

  // Selection Logic
  const handleToggleSelectDoc = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedDocIds.size === filteredAndSortedDocs.length) {
      setSelectedDocIds(new Set());
    } else {
      setSelectedDocIds(new Set(filteredAndSortedDocs.map(d => d.id)));
    }
  };

  const handleBatchDownload = () => {
    const selected = filteredAndSortedDocs.filter(d => selectedDocIds.has(d.id));
    if (selected.length === 0) return;
    selected.forEach(doc => handleDownloadFile(doc));
    showToast(`Triggered batch download of ${selected.length} files`);
  };

  const handleBatchApprove = () => {
    if (!onUpdateDocument) return;
    const selected = filteredAndSortedDocs.filter(d => selectedDocIds.has(d.id));
    selected.forEach(doc => {
      onUpdateDocument(doc.id, { status: 'APPROVED' });
    });
    setSelectedDocIds(new Set());
    showToast(`Marked ${selected.length} document(s) as Approved`);
  };

  const activeSortLabel = useMemo(() => {
    switch (sortField) {
      case 'title': return sortDirection === 'asc' ? 'Name (A to Z)' : 'Name (Z to A)';
      case 'createdAt': return sortDirection === 'desc' ? 'Modified (Newest)' : 'Modified (Oldest)';
      case 'fileSize': return sortDirection === 'desc' ? 'Size (Largest)' : 'Size (Smallest)';
      case 'category': return 'File Category';
      case 'status': return 'Approval Status';
      default: return 'Sort';
    }
  }, [sortField, sortDirection]);

  return (
    <div className="space-y-4">
      
      {/* Toast Notification */}
      {toastNotification && (
        <div className="fixed top-5 right-5 z-[999999] bg-slate-900 border border-teal-500/50 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-teal-400" />
          <span>{toastNotification}</span>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. ONEDRIVE COMMAND BAR & ARCHIVE STORAGE STATUS             */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Title & Drive Storage Metric */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-500/10 text-teal-400 rounded-xl border border-teal-500/20 shadow-sm shrink-0">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Project Document Cloud
                </h2>
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              </div>
              <p className="text-xs text-slate-400">
                Centralized vault for AutoCAD blueprints, Excel schedules, and permits
              </p>
            </div>
          </div>

          {/* Clean Integrated OneDrive Storage Bar */}
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 pl-0.5 flex-wrap">
            <HardDrive className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span className="text-white font-semibold">{storageMetrics.usedLabel} used</span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-400">{storageMetrics.maxLabel}</span>
            <span className="text-slate-600">•</span>
            <span className="text-emerald-400 font-medium">{storageMetrics.availableLabel} available</span>
            
            {/* Visual mini progress bar */}
            <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden mx-1 hidden sm:inline-block" title={`${storageMetrics.percentageUsed}% of ${storageMetrics.maxLabel} used`}>
              <div 
                className="bg-gradient-to-r from-teal-500 to-emerald-400 h-1.5 rounded-full transition-all duration-300" 
                style={{ width: `${Math.max(4, Math.min(100, parseFloat(storageMetrics.percentageUsed)))}%` }} 
              />
            </div>

            <span className="text-slate-600 hidden sm:inline">•</span>
            <span className="text-slate-400 hidden sm:inline">{storageMetrics.totalCount} assets</span>
          </div>
        </div>

        {/* Toolbar & Search Controls */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-7 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/60 w-44 sm:w-56 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Menu Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsSortDropdownOpen(prev => !prev)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-teal-400" />
              <span className="hidden sm:inline">Sort:</span>
              <span className="text-teal-400 font-mono">{activeSortLabel}</span>
              <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
            </button>

            {isSortDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsSortDropdownOpen(false)} 
                />
                <div className="absolute right-0 top-full mt-1.5 z-50 w-56 bg-slate-950 border border-slate-800 rounded-xl p-1.5 shadow-2xl space-y-1 text-xs">
                  <div className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase text-slate-400 tracking-wider">
                    Sort Management
                  </div>
                  <button
                    onClick={() => { setSortField('title'); setSortDirection('asc'); setIsSortDropdownOpen(false); }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                      sortField === 'title' && sortDirection === 'asc' ? 'bg-teal-500/20 text-teal-300 font-bold' : 'text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    <span>Name (A to Z)</span>
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => { setSortField('title'); setSortDirection('desc'); setIsSortDropdownOpen(false); }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                      sortField === 'title' && sortDirection === 'desc' ? 'bg-teal-500/20 text-teal-300 font-bold' : 'text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    <span>Name (Z to A)</span>
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => { setSortField('createdAt'); setSortDirection('desc'); setIsSortDropdownOpen(false); }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                      sortField === 'createdAt' && sortDirection === 'desc' ? 'bg-teal-500/20 text-teal-300 font-bold' : 'text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    <span>Modified (Newest First)</span>
                    <Clock className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => { setSortField('createdAt'); setSortDirection('asc'); setIsSortDropdownOpen(false); }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                      sortField === 'createdAt' && sortDirection === 'asc' ? 'bg-teal-500/20 text-teal-300 font-bold' : 'text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    <span>Modified (Oldest First)</span>
                    <Clock className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => { setSortField('fileSize'); setSortDirection('desc'); setIsSortDropdownOpen(false); }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                      sortField === 'fileSize' && sortDirection === 'desc' ? 'bg-teal-500/20 text-teal-300 font-bold' : 'text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    <span>File Size (Largest First)</span>
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => { setSortField('fileSize'); setSortDirection('asc'); setIsSortDropdownOpen(false); }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                      sortField === 'fileSize' && sortDirection === 'asc' ? 'bg-teal-500/20 text-teal-300 font-bold' : 'text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    <span>File Size (Smallest First)</span>
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => { setSortField('status'); setSortDirection('asc'); setIsSortDropdownOpen(false); }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                      sortField === 'status' ? 'bg-teal-500/20 text-teal-300 font-bold' : 'text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    <span>Approval Status</span>
                    <FileCheck className="w-3 h-3" />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* View Mode Toggle (OneDrive List vs Grid) */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5">
            <button
              onClick={() => handleToggleViewMode('list')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-teal-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="OneDrive Table / List View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleToggleViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-teal-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="OneDrive Tiles / Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {/* Primary Upload Button */}
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-md shadow-amber-500/20 cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Document</span>
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. ONEDRIVE FOLDER / CATEGORY BARS & BATCH SELECTION TOOLBAR */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-800">
          {categories.map((cat) => {
            const count = cat.id === 'ALL' 
              ? effectiveDocuments.length 
              : effectiveDocuments.filter(d => d.category === cat.id).length;

            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeCategory === cat.id
                    ? 'bg-teal-500 text-slate-950 font-bold shadow-sm shadow-teal-500/20'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <span>{cat.label}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  activeCategory === cat.id ? 'bg-slate-950/30 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Status Filter Dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-teal-500/60 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="APPROVED">Approved Only</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="DRAFT">Draft</option>
          </select>
        </div>
      </div>

      {/* Multi-Select Action Banner (Appears when 1+ documents checked) */}
      {selectedDocIds.size > 0 && (
        <div className="bg-teal-950/80 border border-teal-500/40 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 text-xs animate-fadeIn shadow-lg">
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-teal-300 bg-teal-500/20 px-2 py-0.5 rounded border border-teal-500/40">
              {selectedDocIds.size} Selected
            </span>
            <span className="text-slate-300 hidden sm:inline">OneDrive Batch Actions:</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBatchDownload}
              className="px-3 py-1 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Selected</span>
            </button>
            <button
              onClick={handleBatchApprove}
              className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/40 font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Mark Approved</span>
            </button>
            <button
              onClick={() => setSelectedDocIds(new Set())}
              className="px-2 py-1 text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. DOCUMENT ARCHIVE: ONEDRIVE LIST / TABLE VIEW              */}
      {/* ───────────────────────────────────────────────────────────── */}
      {viewMode === 'list' && (
        <div className="bg-slate-900/95 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/90 border-b border-slate-800 text-slate-400 font-mono text-[11px] select-none">
                  {/* Select All Checkbox */}
                  <th className="py-3 px-3 w-10 text-center">
                    <button 
                      type="button"
                      onClick={handleSelectAll} 
                      className="text-slate-400 hover:text-white cursor-pointer"
                      title="Select all"
                    >
                      {selectedDocIds.size > 0 && selectedDocIds.size === filteredAndSortedDocs.length ? (
                        <CheckSquare className="w-4 h-4 text-teal-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>

                  {/* Document Name */}
                  <th 
                    onClick={() => handleSortChange('title')}
                    className="py-3 px-3 font-semibold text-slate-300 hover:text-white cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Document Name</span>
                      {sortField === 'title' && (
                        sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-teal-400" /> : <ArrowDown className="w-3.5 h-3.5 text-teal-400" />
                      )}
                    </div>
                  </th>

                  {/* Category / Discipline */}
                  <th 
                    onClick={() => handleSortChange('category')}
                    className="py-3 px-3 font-semibold text-slate-300 hover:text-white cursor-pointer transition-colors hidden md:table-cell"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Category</span>
                      {sortField === 'category' && (
                        sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-teal-400" /> : <ArrowDown className="w-3.5 h-3.5 text-teal-400" />
                      )}
                    </div>
                  </th>

                  {/* Date Modified */}
                  <th 
                    onClick={() => handleSortChange('createdAt')}
                    className="py-3 px-3 font-semibold text-slate-300 hover:text-white cursor-pointer transition-colors hidden sm:table-cell"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Date Modified</span>
                      {sortField === 'createdAt' && (
                        sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-teal-400" /> : <ArrowDown className="w-3.5 h-3.5 text-teal-400" />
                      )}
                    </div>
                  </th>

                  {/* Uploaded By */}
                  <th className="py-3 px-3 font-semibold text-slate-300 hidden lg:table-cell">
                    <span>Modified By</span>
                  </th>

                  {/* File Size */}
                  <th 
                    onClick={() => handleSortChange('fileSize')}
                    className="py-3 px-3 font-semibold text-slate-300 hover:text-white cursor-pointer transition-colors text-right"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>File Size</span>
                      {sortField === 'fileSize' && (
                        sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-teal-400" /> : <ArrowDown className="w-3.5 h-3.5 text-teal-400" />
                      )}
                    </div>
                  </th>

                  {/* Approval Status */}
                  <th 
                    onClick={() => handleSortChange('status')}
                    className="py-3 px-3 font-semibold text-slate-300 hover:text-white cursor-pointer transition-colors text-center hidden md:table-cell"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Status</span>
                      {sortField === 'status' && (
                        sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-teal-400" /> : <ArrowDown className="w-3.5 h-3.5 text-teal-400" />
                      )}
                    </div>
                  </th>

                  {/* Actions */}
                  <th className="py-3 px-4 text-right">
                    <span>Actions</span>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/80">
                {filteredAndSortedDocs.map((doc) => {
                  const iconCfg = getFileIconConfig(doc);
                  const Icon = iconCfg.icon;
                  const isSelected = selectedDocIds.has(doc.id);

                  return (
                    <tr
                      key={doc.id}
                      onClick={() => setPreviewDoc(doc)}
                      className={`group hover:bg-slate-800/50 transition-colors cursor-pointer ${
                        isSelected ? 'bg-teal-950/30' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td 
                        className="py-3 px-3 text-center"
                        onClick={(e) => handleToggleSelectDoc(doc.id, e)}
                      >
                        <button type="button" className="text-slate-400 hover:text-white cursor-pointer">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-teal-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
                          )}
                        </button>
                      </td>

                      {/* File Name & Icon */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${iconCfg.bgColor} ${iconCfg.borderColor} ${iconCfg.textColor}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-white group-hover:text-teal-300 transition-colors truncate block">
                              {doc.title}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                              <span className="text-teal-400/90 font-bold">v{doc.version}</span>
                              {doc.notes && (
                                <span className="truncate max-w-[280px] text-slate-400">{doc.notes}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3 hidden md:table-cell">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800 uppercase font-semibold">
                          {doc.category.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* Date Modified */}
                      <td className="py-3 px-3 text-slate-400 font-mono text-[11px] hidden sm:table-cell">
                        {formatOneDriveDate(doc.createdAt)}
                      </td>

                      {/* Author */}
                      <td className="py-3 px-3 text-slate-400 text-[11px] truncate max-w-[140px] hidden lg:table-cell">
                        {doc.uploadedBy}
                      </td>

                      {/* Size */}
                      <td className="py-3 px-3 text-right font-mono text-slate-300 text-[11px]">
                        {doc.fileSize || '2.5 MB'}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center hidden md:table-cell">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${
                          doc.status === 'APPROVED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 
                          doc.status === 'IN_REVIEW' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                          'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}>
                          {doc.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td 
                        className="py-3 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setPreviewDoc(doc)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-400 hover:text-teal-300 transition-colors cursor-pointer"
                            title="Interactive Preview"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDownloadFile(doc)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                            title="Download File"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(doc)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                            title="Edit Details"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmDoc(doc)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Delete File"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredAndSortedDocs.length === 0 && (
            <div className="py-16 text-center text-slate-500 space-y-2">
              <FolderKanban className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-300">No documents match the current search or filters.</p>
              <p className="text-xs text-slate-500">Try adjusting your filters, sort order, or search query.</p>
              <button
                onClick={() => { setActiveCategory('ALL'); setSearchQuery(''); setStatusFilter('ALL'); }}
                className="mt-2 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-teal-400 text-xs rounded-lg cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. DOCUMENT ARCHIVE: ONEDRIVE TILES / GRID VIEW              */}
      {/* ───────────────────────────────────────────────────────────── */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSortedDocs.map((doc) => {
            const iconCfg = getFileIconConfig(doc);
            const Icon = iconCfg.icon;
            const isCad = isCadDocument(doc);
            const isExcel = isExcelScheduleDocument(doc);
            const isSelected = selectedDocIds.has(doc.id);

            return (
              <div
                key={doc.id}
                onClick={() => setPreviewDoc(doc)}
                className={`bg-slate-900/90 border rounded-2xl p-4 shadow-lg hover:shadow-2xl transition-all flex flex-col justify-between group cursor-pointer ${
                  isSelected ? 'border-teal-500 bg-slate-900' : 'border-slate-800 hover:border-teal-700/60'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={(e) => handleToggleSelectDoc(doc.id, e)}
                        className="text-slate-400 hover:text-white"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-teal-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
                        )}
                      </button>

                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold border ${iconCfg.bgColor} ${iconCfg.borderColor} ${iconCfg.textColor}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-teal-400 font-bold uppercase block">
                          {isCad ? 'CAD BLUEPRINT' : isExcel ? 'EXCEL SCHEDULE' : doc.category.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">v{doc.version} • {doc.fileSize || '2.5 MB'}</span>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      doc.status === 'APPROVED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 
                      doc.status === 'IN_REVIEW' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                      'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}>
                      {doc.status}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white group-hover:text-teal-300 transition-colors leading-snug mb-1.5">
                    {doc.title}
                  </h4>

                  {doc.notes && (
                    <p className="text-xs text-slate-400 leading-relaxed mb-3 line-clamp-2">
                      {doc.notes}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-slate-400 font-medium truncate max-w-[120px]">
                      By: {doc.uploadedBy.split(' ')[0]}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {formatOneDriveDate(doc.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {/* Preview Button */}
                    <button
                      onClick={() => setPreviewDoc(doc)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-400 hover:text-teal-300 transition-colors cursor-pointer flex items-center gap-1 text-[11px] px-2 font-semibold"
                      title="Interactive Preview"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </button>

                    {/* Download Button */}
                    <button
                      onClick={() => handleDownloadFile(doc)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                      title="Download File"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    {/* Edit Button */}
                    <button
                      onClick={() => handleOpenEdit(doc)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                      title="Edit Document Metadata"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => setDeleteConfirmDoc(doc)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Delete Document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredAndSortedDocs.length === 0 && (
            <div className="col-span-full h-44 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-500 space-y-2">
              <FolderKanban className="w-8 h-8 text-slate-600" />
              <p className="text-xs font-semibold text-slate-400">No documents found matching current filters.</p>
              <button
                onClick={() => { setActiveCategory('ALL'); setSearchQuery(''); setStatusFilter('ALL'); }}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-teal-400 text-xs rounded-lg cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5. UPLOAD DOCUMENT MODAL (CENTRALIZED DATABASE)              */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4 animate-fadeIn">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-teal-500/10 text-teal-400 rounded-xl border border-teal-500/20">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Upload to Centralized Archive</h3>
                  <p className="text-xs text-slate-400">Save CAD, schedule spreadsheet, or project document</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setSelectedFileSizeBytes(0);
                  setFileSizeError(null);
                  setSelectedFileName('');
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-3.5">
              
              {/* File Drag/Pick Box with Database Limit Indicator */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Select File (.dxf, .dwg, .xlsx, .csv, .pdf)
                  </label>
                  <div className="flex items-center gap-1 text-[10px] font-mono font-semibold text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-full">
                    <Database className="w-3 h-3 text-teal-400" />
                    <span>Max DB Limit: 50 MB</span>
                  </div>
                </div>

                <div className={`border border-dashed rounded-xl p-3.5 text-center bg-slate-950/60 cursor-pointer relative transition-all ${
                  fileSizeError 
                    ? 'border-rose-500/80 bg-rose-950/20' 
                    : selectedFileName 
                      ? 'border-teal-500/80 bg-teal-950/10' 
                      : 'border-slate-700 hover:border-teal-500/80'
                }`}>
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="space-y-1">
                    <Upload className={`w-5 h-5 mx-auto ${fileSizeError ? 'text-rose-400' : 'text-teal-400'}`} />
                    <div className="text-xs text-slate-300">
                      {selectedFileName ? (
                        <span className={fileSizeError ? 'text-rose-300 font-bold' : 'text-teal-300 font-semibold'}>
                          {selectedFileName}
                        </span>
                      ) : (
                        'Click or drop blueprint/spreadsheet file here'
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      AutoCAD DXF/DWG, Excel XLSX/CSV, or PDF drawings (Database Max Cap: 50 MB)
                    </div>
                  </div>
                </div>

                {/* Database Capacity Gauge / Validation Feedback */}
                {fileSizeError ? (
                  <div className="mt-2.5 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-2.5 text-xs animate-fadeIn">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-bold text-rose-200">Database Upload Cap Exceeded</div>
                      <p className="text-[11px] text-rose-300/90 leading-relaxed">
                        {fileSizeError}
                      </p>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden mt-1">
                        <div className="bg-rose-500 h-1.5 rounded-full w-full" />
                      </div>
                    </div>
                  </div>
                ) : selectedFileSizeBytes > 0 ? (
                  <div className="mt-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Database className="w-3 h-3 text-teal-400" />
                        Database Payload Capacity
                      </span>
                      <span className="font-mono text-slate-300">
                        <strong className="text-teal-300">{(selectedFileSizeBytes / (1024 * 1024)).toFixed(1)} MB</strong> / {MAX_UPLOAD_SIZE_LABEL} ({Math.min(100, Math.round((selectedFileSizeBytes / MAX_UPLOAD_SIZE_BYTES) * 100))}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          (selectedFileSizeBytes / MAX_UPLOAD_SIZE_BYTES) > 0.8 
                            ? 'bg-amber-400' 
                            : 'bg-teal-400'
                        }`}
                        style={{ width: `${Math.min(100, (selectedFileSizeBytes / MAX_UPLOAD_SIZE_BYTES) * 100)}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center justify-between">
                      <span className="text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Within safe database payload threshold
                      </span>
                      <span>Archive Free: {storageMetrics.availableLabel} of {storageMetrics.maxLabel}</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 font-mono px-1">
                    <span className="flex items-center gap-1">
                      <HardDrive className="w-2.5 h-2.5 text-teal-400" /> Storage: <strong className="text-slate-300">{storageMetrics.usedLabel}</strong> of <strong className="text-slate-300">{storageMetrics.maxLabel}</strong> ({storageMetrics.availableLabel} available)
                    </span>
                    <span className="text-teal-400 flex items-center gap-1">
                      <Database className="w-2.5 h-2.5" /> Max 50 MB / file
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Document Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Architectural Fit-Out Level 3 Floor Plan"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    <option value="CAD_DRAWING">CAD & Floor Plans</option>
                    <option value="SPECIFICATIONS">Excel Schedule & BOQ</option>
                    <option value="ARCHITECTURAL">Architectural & Interior</option>
                    <option value="STRUCTURAL_PLAN">MEPFS & Engineering</option>
                    <option value="LGU_CLEARANCE">Permits & Clearances</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Revision / Version</label>
                  <input
                    type="text"
                    placeholder="e.g. 1.0, Rev B"
                    value={uploadVersion}
                    onChange={(e) => setUploadVersion(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Approval Status</label>
                <select
                  value={uploadStatus}
                  onChange={(e) => setUploadStatus(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                >
                  <option value="APPROVED">APPROVED (Official As-Built)</option>
                  <option value="IN_REVIEW">IN_REVIEW (Pending Sign-Off)</option>
                  <option value="DRAFT">DRAFT (Preliminary)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Technical Notes & Scope</label>
                <textarea
                  rows={2}
                  placeholder="Notes on revisions, engineering changes, or milestone linkages..."
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    setSelectedFileSizeBytes(0);
                    setFileSizeError(null);
                    setSelectedFileName('');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={Boolean(fileSizeError || selectedFileSizeBytes > MAX_UPLOAD_SIZE_BYTES)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    fileSizeError || selectedFileSizeBytes > MAX_UPLOAD_SIZE_BYTES
                      ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                      : 'text-white bg-teal-600 hover:bg-teal-500 shadow-lg shadow-teal-950 cursor-pointer'
                  }`}
                >
                  Save to Centralized Archive
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 6. EDIT DOCUMENT MODAL                                       */}
      {/* ───────────────────────────────────────────────────────────── */}
      {editDoc && (
        <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-fadeIn">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Edit Document Metadata</h3>
                  <p className="text-xs text-slate-400">Update centralized project record</p>
                </div>
              </div>
              <button
                onClick={() => setEditDoc(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Document Title</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="CAD_DRAWING">CAD & Floor Plans</option>
                    <option value="SPECIFICATIONS">Excel Schedule & BOQ</option>
                    <option value="ARCHITECTURAL">Architectural & Interior</option>
                    <option value="STRUCTURAL_PLAN">MEPFS & Engineering</option>
                    <option value="LGU_CLEARANCE">Permits & Clearances</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Version</label>
                  <input
                    type="text"
                    value={editVersion}
                    onChange={(e) => setEditVersion(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Approval Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="APPROVED">APPROVED (Official As-Built)</option>
                  <option value="IN_REVIEW">IN_REVIEW (Pending Sign-Off)</option>
                  <option value="DRAFT">DRAFT (Preliminary)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditDoc(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 7. DELETE CONFIRMATION MODAL                                  */}
      {/* ───────────────────────────────────────────────────────────── */}
      {deleteConfirmDoc && (
        <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-3">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-white">Delete Document?</h3>
            </div>
            <p className="text-xs text-slate-400">
              Are you sure you want to remove this document from the centralized database?
            </p>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 font-mono">
              {deleteConfirmDoc.title} (v{deleteConfirmDoc.version})
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmDoc(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 8. INTERACTIVE PREVIEW MODAL (CAD OR EXCEL GANTT SCHEDULE)    */}
      {/* ───────────────────────────────────────────────────────────── */}
      {previewDoc && (
        <div className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-fadeIn">
            
            {/* Top Preview Bar */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold border ${
                  isCadDocument(previewDoc) ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                  isExcelScheduleDocument(previewDoc) ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                  'bg-teal-500/10 border-teal-500/30 text-teal-400'
                }`}>
                  {isCadDocument(previewDoc) ? <FileCode className="w-5 h-5" /> : 
                   isExcelScheduleDocument(previewDoc) ? <FileSpreadsheet className="w-5 h-5" /> : 
                   <FileText className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">{previewDoc.title}</h3>
                    <span className="text-[10px] font-mono font-bold bg-slate-800 text-teal-400 px-2 py-0.5 rounded">
                      v{previewDoc.version}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {isCadDocument(previewDoc) ? 'AutoCAD DXF/Vector Format' : isExcelScheduleDocument(previewDoc) ? 'Spreadsheet Schedule Grid' : 'Document Sheet'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">{previewDoc.notes || 'Centralized Document Repository'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadFile(previewDoc)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>

                {isExcelScheduleDocument(previewDoc) && (
                  <button
                    onClick={handleOpenInGantt}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Open in Gantt Schedule</span>
                  </button>
                )}

                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Notification Banner if synced */}
            {syncNotice && (
              <div className="bg-emerald-950 border-b border-emerald-800 text-emerald-300 text-xs px-4 py-2 flex items-center gap-2 animate-fadeIn shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{syncNotice}</span>
              </div>
            )}

            {/* Content Display: CAD Vector Canvas OR Excel Spreadsheet */}
            <div className="flex-1 overflow-auto bg-slate-950 relative p-4 flex flex-col items-center justify-center">
              
              {/* Specialized A: AutoCAD / Blueprint Interactive Vector Viewer */}
              {isCadDocument(previewDoc) && (
                <div className="w-full h-full flex flex-col">
                  {/* Floating Toolbar */}
                  <div className="flex items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 backdrop-blur-md rounded-2xl px-4 py-2 mb-3 shadow-lg">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Compass className="w-4 h-4 text-amber-400" />
                      <span className="font-semibold text-slate-200">Scale 1:100</span>
                      <span>•</span>
                      <span>Coordinates: 14.2789° N, 121.1245° E</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCadZoom(prev => Math.max(0.6, prev - 0.2))}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                        title="Zoom Out"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-mono text-amber-400 font-bold px-1.5">{Math.round(cadZoom * 100)}%</span>
                      <button
                        onClick={() => setCadZoom(prev => Math.min(2.5, prev + 0.2))}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                        title="Zoom In"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setCadZoom(1)}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer ml-1"
                        title="Reset View"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Layers Toggle */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCadShowGrid(prev => !prev)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold cursor-pointer transition-colors ${
                          cadShowGrid ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        Grid
                      </button>
                      <button
                        onClick={() => setCadShowMep(prev => !prev)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold cursor-pointer transition-colors ${
                          cadShowMep ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        MEPFS
                      </button>
                      <button
                        onClick={() => setCadShowFurniture(prev => !prev)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold cursor-pointer transition-colors ${
                          cadShowFurniture ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        Furniture
                      </button>
                    </div>
                  </div>

                  {/* High-Fidelity SVG AutoCAD Vector Blueprint Simulation */}
                  <div className="flex-1 w-full bg-[#030712] rounded-2xl border border-slate-800 relative overflow-hidden flex items-center justify-center shadow-inner">
                    <svg
                      viewBox="0 0 900 550"
                      className="w-full h-full transition-transform duration-200"
                      style={{ transform: `scale(${cadZoom})` }}
                    >
                      <defs>
                        <pattern id="cadGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                          <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#1e293b" strokeWidth="0.8" opacity="0.6" />
                        </pattern>
                      </defs>

                      {cadShowGrid && <rect width="900" height="550" fill="url(#cadGrid)" />}

                      {/* Structural Perimeter Walls */}
                      <rect x="120" y="80" width="660" height="380" fill="none" stroke="#f59e0b" strokeWidth="3" />
                      <rect x="126" y="86" width="648" height="368" fill="#0f172a" fillOpacity="0.5" stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 2" />

                      {/* Rooms / Partition Layout */}
                      {/* Conference Room */}
                      <rect x="120" y="80" width="240" height="180" fill="#1e293b" fillOpacity="0.4" stroke="#94a3b8" strokeWidth="2" />
                      <text x="170" y="170" fill="#94a3b8" fontSize="12" fontFamily="monospace" fontWeight="bold">BOARDROOM (35 sqm)</text>

                      {/* Executive Offices */}
                      <rect x="120" y="260" width="240" height="200" fill="#1e293b" fillOpacity="0.4" stroke="#94a3b8" strokeWidth="2" />
                      <text x="150" y="360" fill="#94a3b8" fontSize="12" fontFamily="monospace" fontWeight="bold">EXECUTIVE SUITE (42 sqm)</text>

                      {/* Open Plan Workstation Hub */}
                      <rect x="360" y="80" width="420" height="260" fill="#1e293b" fillOpacity="0.2" stroke="#94a3b8" strokeWidth="2" />
                      <text x="470" y="190" fill="#cbd5e1" fontSize="14" fontFamily="monospace" fontWeight="bold">OPEN OFFICE WORKSTATIONS (88 sqm)</text>

                      {/* Pantry & Collaboration Lounge */}
                      <rect x="360" y="340" width="260" height="120" fill="#1e293b" fillOpacity="0.4" stroke="#94a3b8" strokeWidth="2" />
                      <text x="390" y="405" fill="#94a3b8" fontSize="12" fontFamily="monospace" fontWeight="bold">PANTRY & LOUNGE (28 sqm)</text>

                      {/* Server Room & MEPFS Utility */}
                      <rect x="620" y="340" width="160" height="120" fill="#312e81" fillOpacity="0.5" stroke="#6366f1" strokeWidth="2" />
                      <text x="640" y="405" fill="#a5b4fc" fontSize="11" fontFamily="monospace" fontWeight="bold">IDF / SERVER (16 sqm)</text>

                      {/* MEPFS Layer: Cable Tray / Sprinkler / HVAC Run */}
                      {cadShowMep && (
                        <g id="mepLayer">
                          {/* Main HVAC Duct */}
                          <line x1="200" y1="170" x2="700" y2="170" stroke="#06b6d4" strokeWidth="3" strokeDasharray="8 4" />
                          <line x1="480" y1="170" x2="480" y2="400" stroke="#06b6d4" strokeWidth="3" strokeDasharray="8 4" />
                          <circle cx="200" cy="170" r="7" fill="#06b6d4" />
                          <circle cx="480" cy="170" r="7" fill="#06b6d4" />
                          <circle cx="700" cy="170" r="7" fill="#06b6d4" />
                          <text x="715" y="174" fill="#06b6d4" fontSize="10" fontFamily="monospace">HVAC RETURN</text>

                          {/* Sprinkler Run */}
                          <line x1="160" y1="130" x2="740" y2="130" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="5 3" />
                          <line x1="160" y1="300" x2="740" y2="300" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="5 3" />
                          <circle cx="300" cy="130" r="4" fill="#ef4444" />
                          <circle cx="500" cy="130" r="4" fill="#ef4444" />
                          <circle cx="680" cy="130" r="4" fill="#ef4444" />
                        </g>
                      )}

                      {/* Furniture Layout Layer */}
                      {cadShowFurniture && (
                        <g id="furnitureLayer">
                          {/* Boardroom Table */}
                          <ellipse cx="240" cy="165" rx="60" ry="25" fill="none" stroke="#64748b" strokeWidth="2" />
                          <circle cx="200" cy="130" r="5" fill="#475569" />
                          <circle cx="240" cy="130" r="5" fill="#475569" />
                          <circle cx="280" cy="130" r="5" fill="#475569" />
                          <circle cx="200" cy="200" r="5" fill="#475569" />
                          <circle cx="240" cy="200" r="5" fill="#475569" />
                          <circle cx="280" cy="200" r="5" fill="#475569" />

                          {/* Workstation Clusters */}
                          <rect x="420" y="110" width="70" height="40" fill="none" stroke="#64748b" strokeWidth="1.5" />
                          <rect x="520" y="110" width="70" height="40" fill="none" stroke="#64748b" strokeWidth="1.5" />
                          <rect x="620" y="110" width="70" height="40" fill="none" stroke="#64748b" strokeWidth="1.5" />

                          <rect x="420" y="210" width="70" height="40" fill="none" stroke="#64748b" strokeWidth="1.5" />
                          <rect x="520" y="210" width="70" height="40" fill="none" stroke="#64748b" strokeWidth="1.5" />
                          <rect x="620" y="210" width="70" height="40" fill="none" stroke="#64748b" strokeWidth="1.5" />
                        </g>
                      )}

                      {/* Dimension Marks */}
                      <line x1="120" y1="50" x2="780" y2="50" stroke="#f59e0b" strokeWidth="1" />
                      <line x1="120" y1="45" x2="120" y2="55" stroke="#f59e0b" strokeWidth="1" />
                      <line x1="780" y1="45" x2="780" y2="55" stroke="#f59e0b" strokeWidth="1" />
                      <text x="430" y="45" fill="#f59e0b" fontSize="12" fontFamily="monospace" fontWeight="bold">22.00 METERS</text>

                      <line x1="795" y1="80" x2="795" y2="460" stroke="#f59e0b" strokeWidth="1" />
                      <line x1="790" y1="80" x2="800" y2="80" stroke="#f59e0b" strokeWidth="1" />
                      <line x1="790" y1="460" x2="800" y2="460" stroke="#f59e0b" strokeWidth="1" />
                      <text x="805" y="275" fill="#f59e0b" fontSize="12" fontFamily="monospace" fontWeight="bold">12.50 M</text>
                    </svg>
                  </div>
                </div>
              )}

              {/* Specialized B: Excel / BOQ Interactive Schedule Spreadsheet */}
              {isExcelScheduleDocument(previewDoc) && (
                <div className="w-full h-full flex flex-col">
                  {/* Spreadsheet Header Toolbar */}
                  <div className="flex items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2.5 mb-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-white">Live Project BOQ & Milestones Matrix</span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                        Spreadsheet Mode
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSyncToGantt}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Sync Changes to Gantt</span>
                      </button>
                    </div>
                  </div>

                  {/* Interactive Spreadsheet Grid */}
                  <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-auto shadow-inner">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                          <th className="py-2.5 px-3 w-16">WBS</th>
                          <th className="py-2.5 px-3">Work Package / Task Name</th>
                          <th className="py-2.5 px-3">Discipline</th>
                          <th className="py-2.5 px-3 w-28 text-center">Duration</th>
                          <th className="py-2.5 px-3 w-36">Progress (%)</th>
                          <th className="py-2.5 px-3 w-28">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {scheduleData.map((row, idx) => (
                          <tr key={row.id} className="hover:bg-slate-800/60 transition-colors">
                            <td className="py-2.5 px-3 font-mono text-emerald-400 font-bold">{row.wbs}</td>
                            <td className="py-2.5 px-3 font-semibold text-white">
                              <input
                                type="text"
                                value={row.taskName}
                                onChange={(e) => {
                                  const updated = [...scheduleData];
                                  updated[idx].taskName = e.target.value;
                                  setScheduleData(updated);
                                }}
                                className="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-emerald-500 focus:outline-none w-full text-white"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-slate-400">{row.category}</td>
                            <td className="py-2.5 px-3 text-center font-mono text-slate-300">{row.durationWeeks} wks</td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={row.progress}
                                  onChange={(e) => {
                                    const updated = [...scheduleData];
                                    const val = parseInt(e.target.value, 10);
                                    updated[idx].progress = val;
                                    if (val === 100) updated[idx].status = 'COMPLETED';
                                    else if (val > 0) updated[idx].status = 'IN_PROGRESS';
                                    else updated[idx].status = 'NOT_STARTED';
                                    setScheduleData(updated);
                                  }}
                                  className="w-20 accent-emerald-500 cursor-pointer"
                                />
                                <span className="font-mono text-[11px] font-bold text-emerald-400 w-8">{row.progress}%</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                row.status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                                row.status === 'IN_PROGRESS' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                                'bg-slate-800 text-slate-400'
                              }`}>
                                {row.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Specialized C: PDF / Document Clearance Sheet Preview */}
              {!isCadDocument(previewDoc) && !isExcelScheduleDocument(previewDoc) && (
                <div className="w-full h-full flex flex-col items-center justify-center space-y-4 text-center max-w-md p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
                  <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white mb-1">{previewDoc.title}</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {previewDoc.notes || 'Official Project Document Record and Compliance Clearances.'}
                    </p>
                  </div>
                  <div className="text-xs font-mono text-slate-400 space-y-1">
                    <div>Author: <span className="text-slate-200">{previewDoc.uploadedBy}</span></div>
                    <div>File Size: <span className="text-slate-200">{previewDoc.fileSize || '2.1 MB'}</span></div>
                    <div>Status: <span className="text-emerald-400 font-bold">{previewDoc.status}</span></div>
                  </div>
                  <button
                    onClick={() => handleDownloadFile(previewDoc)}
                    className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow-md"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Official Document</span>
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
