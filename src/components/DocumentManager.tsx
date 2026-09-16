/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  FileText, Upload, Download, Eye, CheckCircle2, 
  Clock, ShieldAlert, Folder, Filter, Plus, X, FileCode,
  Edit3, Trash2, Check, AlertTriangle, FileSpreadsheet,
  Maximize2, ZoomIn, ZoomOut, RotateCcw, Layers, MapPin,
  BarChart3, RefreshCw, SlidersHorizontal, ArrowRight,
  ExternalLink, Sparkles, FolderKanban, CheckCheck, Compass
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
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Modals state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [editDoc, setEditDoc] = useState<ProjectDocument | null>(null);
  const [deleteConfirmDoc, setDeleteConfirmDoc] = useState<ProjectDocument | null>(null);
  const [previewDoc, setPreviewDoc] = useState<ProjectDocument | null>(null);

  // Upload Form State
  const [uploadTitle, setUploadTitle] = useState<string>('');
  const [uploadCategory, setUploadCategory] = useState<ProjectDocument['category']>('CAD_DRAWING');
  const [uploadVersion, setUploadVersion] = useState<string>('1.0');
  const [uploadStatus, setUploadStatus] = useState<ProjectDocument['status']>('APPROVED');
  const [uploadFileSize, setUploadFileSize] = useState<string>('3.2 MB');
  const [uploadNotes, setUploadNotes] = useState<string>('');
  const [selectedFileName, setSelectedFileName] = useState<string>('');

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

  // Detect file type for specialized previewer
  const isCadDocument = (doc: ProjectDocument) => {
    const title = doc.title.toLowerCase();
    return doc.category === 'CAD_DRAWING' || title.endsWith('.dxf') || title.endsWith('.dwg') || title.includes('cad') || title.includes('plan') || title.includes('blueprint');
  };

  const isExcelScheduleDocument = (doc: ProjectDocument) => {
    const title = doc.title.toLowerCase();
    return title.endsWith('.xlsx') || title.endsWith('.csv') || title.endsWith('.xls') || title.includes('schedule') || title.includes('gantt') || title.includes('boq') || title.includes('wbs') || title.includes('timeline');
  };

  // Handle File Input Selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFileName(file.name);
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
    setIsUploadModalOpen(false);
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
  };

  // Confirm Delete
  const handleConfirmDelete = () => {
    if (deleteConfirmDoc && onDeleteDocument) {
      onDeleteDocument(deleteConfirmDoc.id);
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

  const filteredDocs = useMemo(() => {
    return documents.filter((d) => {
      const matchesCategory = activeCategory === 'ALL' || d.category === activeCategory;
      const matchesSearch = !searchQuery || d.title.toLowerCase().includes(searchQuery.toLowerCase()) || (d.notes && d.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [documents, activeCategory, searchQuery]);

  return (
    <div className="space-y-6">
      
      {/* Header Bar */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-[10px] font-mono text-teal-400 font-bold uppercase tracking-wider">
              CENTRALIZED PROJECT ARCHIVE
            </span>
          </div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-teal-400" />
            Document Management System
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Centralized database for CAD blueprints, Excel schedules, architectural sheets, and permits with interactive previewing.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />

          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-lg shadow-teal-950 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Document</span>
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-800">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeCategory === cat.id
                ? 'bg-teal-600 text-white shadow-md shadow-teal-950'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDocs.map((doc) => {
          const isCad = isCadDocument(doc);
          const isExcel = isExcelScheduleDocument(doc);

          return (
            <div
              key={doc.id}
              className="bg-slate-900/90 border border-slate-800 hover:border-teal-700/60 rounded-2xl p-4 shadow-lg hover:shadow-xl transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold border ${
                      isCad ? 'bg-amber-950/80 border-amber-800 text-amber-400' :
                      isExcel ? 'bg-emerald-950/80 border-emerald-800 text-emerald-400' :
                      'bg-teal-950/80 border-teal-800 text-teal-400'
                    }`}>
                      {isCad ? <FileCode className="w-4 h-4" /> : isExcel ? <FileSpreadsheet className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-teal-400 font-bold uppercase block">
                        {isCad ? 'CAD BLUEPRINT' : isExcel ? 'EXCEL SCHEDULE' : doc.category.replace('_', ' ')}
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
                <span className="text-[11px] text-slate-500 font-medium truncate max-w-[110px]">
                  By: {doc.uploadedBy.split(' ')[0]}
                </span>

                <div className="flex items-center gap-1.5">
                  {/* Preview Button */}
                  <button
                    onClick={() => setPreviewDoc(doc)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-400 hover:text-teal-300 transition-colors cursor-pointer flex items-center gap-1 text-[11px] px-2 font-semibold"
                    title="Interactive Preview"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
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

        {filteredDocs.length === 0 && (
          <div className="col-span-full h-44 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-500 space-y-2">
            <FolderKanban className="w-8 h-8 text-slate-600" />
            <p className="text-xs font-semibold text-slate-400">No documents found in this category.</p>
            <p className="text-[11px] text-slate-500">Upload a CAD floor plan, Excel schedule, or project blueprint to start.</p>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. UPLOAD DOCUMENT MODAL (CENTRALIZED DATABASE) */}
      {/* ------------------------------------------------------------- */}
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
                onClick={() => setIsUploadModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-3.5">
              
              {/* File Drag/Pick Box */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select File (.dxf, .dwg, .xlsx, .csv, .pdf)</label>
                <div className="border border-dashed border-slate-700 hover:border-teal-500/80 rounded-xl p-3 text-center bg-slate-950/60 cursor-pointer relative">
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="space-y-1">
                    <Upload className="w-5 h-5 text-teal-400 mx-auto" />
                    <div className="text-xs text-slate-300">
                      {selectedFileName ? <strong className="text-teal-300">{selectedFileName}</strong> : 'Click or drop blueprint/spreadsheet file here'}
                    </div>
                    <div className="text-[10px] text-slate-500">AutoCAD DXF/DWG, Excel XLSX/CSV, or PDF drawings</div>
                  </div>
                </div>
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
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 shadow-lg shadow-teal-950 cursor-pointer transition-all"
                >
                  Save to Centralized Archive
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. EDIT DOCUMENT MODAL (CENTRALIZED DATABASE UPDATE) */}
      {/* ------------------------------------------------------------- */}
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
                <label className="block text-xs font-semibold text-slate-300 mb-1">Document Title *</label>
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
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Version / Revision</label>
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
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 shadow-lg shadow-amber-500/20 cursor-pointer transition-all"
                >
                  Save Changes
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. DELETE CONFIRMATION MODAL (CENTRALIZED DATABASE) */}
      {/* ------------------------------------------------------------- */}
      {deleteConfirmDoc && (
        <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950 border border-rose-800 flex items-center justify-center text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Delete Document?</h3>
                <p className="text-xs text-slate-400">This action will remove the file from the centralized database.</p>
              </div>
            </div>

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

      {/* ------------------------------------------------------------- */}
      {/* 4. INTERACTIVE PREVIEW MODAL (CAD OR EXCEL GANTT SCHEDULE) */}
      {/* ------------------------------------------------------------- */}
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
                {/* Cross-module jump shortcuts */}

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

            {/* Preview Workspace Body */}
            <div className="flex-1 overflow-hidden bg-slate-950 flex flex-col">
              
              {/* --- 4A. INTERACTIVE CAD BLUEPRINT PREVIEWER --- */}
              {isCadDocument(previewDoc) && (
                <div className="flex-1 flex flex-col overflow-hidden relative">
                  
                  {/* CAD Canvas Controls Toolbar */}
                  <div className="p-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-400 uppercase font-bold flex items-center gap-1">
                        <Compass className="w-3.5 h-3.5 text-amber-400" />
                        Vector Blueprint Viewport
                      </span>
                      <span className="text-slate-600">|</span>
                      <span className="text-[11px] text-slate-400 font-mono">Scale 1:100 • 440 sqm Floorplate</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setCadZoom(prev => Math.min(prev + 0.25, 2.5))}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"
                        title="Zoom In"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setCadZoom(prev => Math.max(prev - 0.25, 0.5))}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"
                        title="Zoom Out"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setCadZoom(1)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"
                        title="Reset View"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-slate-600">|</span>
                      <button
                        onClick={() => setCadShowGrid(!cadShowGrid)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold ${cadShowGrid ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-slate-800 text-slate-400'}`}
                      >
                        Grid
                      </button>
                      <button
                        onClick={() => setCadShowMep(!cadShowMep)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold ${cadShowMep ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' : 'bg-slate-800 text-slate-400'}`}
                      >
                        MEPFS
                      </button>
                      <button
                        onClick={() => setCadShowFurniture(!cadShowFurniture)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold ${cadShowFurniture ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'}`}
                      >
                        Layout
                      </button>
                    </div>
                  </div>

                  {/* Interactive CAD Canvas Rendering */}
                  <div className="flex-1 overflow-auto flex items-center justify-center p-6 bg-[#030712] relative select-none">
                    
                    <div 
                      className="transition-transform duration-200 origin-center"
                      style={{ transform: `scale(${cadZoom})` }}
                    >
                      <svg width="760" height="460" viewBox="0 0 760 460" className="border border-slate-800 rounded-2xl bg-[#090d16] shadow-2xl">
                        {/* Grid Layer */}
                        {cadShowGrid && (
                          <g stroke="#1e293b" strokeWidth="0.5" strokeDasharray="4,4">
                            {Array.from({ length: 19 }).map((_, i) => (
                              <line key={`v-${i}`} x1={i * 40} y1="0" x2={i * 40} y2="460" />
                            ))}
                            {Array.from({ length: 12 }).map((_, i) => (
                              <line key={`h-${i}`} x1="0" y1={i * 40} x2="760" y2={i * 40} />
                            ))}
                          </g>
                        )}

                        {/* Outer Building Structural Perimeter Walls */}
                        <rect x="50" y="40" width="660" height="380" fill="#0f172a" stroke="#cbd5e1" strokeWidth="4" rx="4" />

                        {/* Room Enclosures: Executive Boardroom */}
                        <rect x="50" y="40" width="220" height="180" fill="#1e293b" stroke="#94a3b8" strokeWidth="2.5" />
                        <text x="160" y="130" fill="#f8fafc" fontSize="13" fontWeight="bold" textAnchor="middle">Executive Boardroom</text>
                        <text x="160" y="148" fill="#94a3b8" fontSize="10" textAnchor="middle">44.0 sqm • Acoustic Partition</text>

                        {/* Room Enclosure: Server & Network Hub */}
                        <rect x="270" y="40" width="160" height="140" fill="#172554" stroke="#60a5fa" strokeWidth="2" strokeDasharray="3,3" />
                        <text x="350" y="105" fill="#93c5fd" fontSize="12" fontWeight="bold" textAnchor="middle">Server & Telecom</text>
                        <text x="350" y="122" fill="#60a5fa" fontSize="9" textAnchor="middle">Precision Cooling Zone</text>

                        {/* Meeting Pod 1 & 2 */}
                        <rect x="430" y="40" width="140" height="140" fill="#1e293b" stroke="#94a3b8" strokeWidth="2" />
                        <text x="500" y="115" fill="#f8fafc" fontSize="11" fontWeight="bold" textAnchor="middle">Meeting Pod A</text>

                        <rect x="570" y="40" width="140" height="140" fill="#1e293b" stroke="#94a3b8" strokeWidth="2" />
                        <text x="640" y="115" fill="#f8fafc" fontSize="11" fontWeight="bold" textAnchor="middle">Meeting Pod B</text>

                        {/* Open Plan Workstation Bays */}
                        <rect x="50" y="220" width="460" height="200" fill="#090f1e" stroke="#334155" strokeWidth="1.5" />
                        <text x="280" y="320" fill="#e2e8f0" fontSize="14" fontWeight="bold" textAnchor="middle">Open Collaboration & Desking Hub</text>
                        <text x="280" y="338" fill="#64748b" fontSize="11" textAnchor="middle">32 Ergonomic Workstations • Exposed Deck</text>

                        {/* Pantry & Breakout Lounge */}
                        <rect x="510" y="220" width="200" height="200" fill="#1e293b" stroke="#94a3b8" strokeWidth="2" />
                        <text x="610" y="315" fill="#f8fafc" fontSize="12" fontWeight="bold" textAnchor="middle">Breakout Pantry</text>
                        <text x="610" y="332" fill="#94a3b8" fontSize="10" textAnchor="middle">Wet Utilities & Island</text>

                        {/* Optional Furniture Layout Layer */}
                        {cadShowFurniture && (
                          <g stroke="#38bdf8" fill="#0284c7" fillOpacity="0.2" strokeWidth="1">
                            {/* Boardroom Table */}
                            <rect x="100" y="90" width="120" height="50" rx="20" />
                            {/* Workstation Pods */}
                            <rect x="100" y="250" width="100" height="40" rx="3" />
                            <rect x="230" y="250" width="100" height="40" rx="3" />
                            <rect x="360" y="250" width="100" height="40" rx="3" />
                            <rect x="100" y="350" width="100" height="40" rx="3" />
                            <rect x="230" y="350" width="100" height="40" rx="3" />
                            <rect x="360" y="350" width="100" height="40" rx="3" />
                          </g>
                        )}

                        {/* Optional MEPFS Conduits & Fire Sprinkler Layer */}
                        {cadShowMep && (
                          <g stroke="#f59e0b" strokeWidth="2" strokeDasharray="6,3" fill="none">
                            <path d="M 50 110 L 710 110" />
                            <path d="M 350 40 L 350 420" />
                            <circle cx="160" cy="110" r="6" fill="#f59e0b" />
                            <circle cx="350" cy="110" r="6" fill="#f59e0b" />
                            <circle cx="500" cy="110" r="6" fill="#f59e0b" />
                            <circle cx="640" cy="110" r="6" fill="#f59e0b" />
                            <circle cx="350" cy="270" r="6" fill="#f59e0b" />
                            <circle cx="350" cy="370" r="6" fill="#f59e0b" />
                          </g>
                        )}

                        {/* Architectural Dimensions Markers */}
                        <line x1="50" y1="25" x2="710" y2="25" stroke="#f59e0b" strokeWidth="1.5" />
                        <text x="380" y="20" fill="#f59e0b" fontSize="11" fontWeight="bold" textAnchor="middle">24.50 METERS</text>
                        <line x1="725" y1="40" x2="725" y2="420" stroke="#f59e0b" strokeWidth="1.5" />
                        <text x="735" y="235" fill="#f59e0b" fontSize="11" fontWeight="bold" textAnchor="middle" transform="rotate(90, 735, 235)">18.00 METERS</text>
                      </svg>
                    </div>

                  </div>
                </div>
              )}

              {/* --- 4B. INTERACTIVE EXCEL SPREADSHEET & GANTT PROGRESS EDITOR --- */}
              {isExcelScheduleDocument(previewDoc) && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  
                  {/* Spreadsheet Header Controls */}
                  <div className="p-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-emerald-400 font-bold uppercase flex items-center gap-1">
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        Interactive Schedule Workbook ({scheduleData.length} Tasks)
                      </span>
                      <span className="text-slate-600">|</span>
                      <span className="text-[11px] text-slate-400">Edit progress sliders below to sync with project schedule</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSyncToGantt}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950 cursor-pointer transition-all"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Sync with Gantt Schedule</span>
                      </button>

                      <button
                        onClick={handleOpenInGantt}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <span>Open in Gantt</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Spreadsheet Table Grid */}
                  <div className="flex-1 overflow-auto p-4">
                    <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/80 shadow-xl">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-950 border-b border-slate-800 text-[11px] font-mono text-slate-400">
                            <th className="py-3 px-3 w-16">WBS</th>
                            <th className="py-3 px-4">Milestone Task Name</th>
                            <th className="py-3 px-3">Trade Category</th>
                            <th className="py-3 px-3">Assigned Contractor</th>
                            <th className="py-3 px-3 w-28">Duration</th>
                            <th className="py-3 px-4 w-48">Execution Progress (%)</th>
                            <th className="py-3 px-3 w-32">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80">
                          {scheduleData.map((row) => (
                            <tr key={row.id} className="hover:bg-slate-800/50 transition-colors group">
                              <td className="py-3 px-3 font-mono text-slate-500 font-bold">{row.wbs}</td>
                              <td className="py-3 px-4 font-bold text-white group-hover:text-emerald-300 transition-colors">
                                {row.taskName}
                              </td>
                              <td className="py-3 px-3">
                                <span className="text-[10px] font-mono bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded">
                                  {row.category}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-slate-400 font-medium">{row.contractor}</td>
                              <td className="py-3 px-3 font-mono text-slate-400">{row.durationWeeks} Weeks</td>
                              
                              {/* Interactive Progress Slider */}
                              <td className="py-3 px-4">
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-xs font-mono">
                                    <span className="text-emerald-400 font-bold">{row.progress}%</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={row.progress}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      setScheduleData(prev => prev.map(r => r.id === row.id ? { 
                                        ...r, 
                                        progress: val,
                                        status: val === 100 ? 'COMPLETED' : val > 0 ? 'IN_PROGRESS' : 'NOT_STARTED'
                                      } : r));
                                    }}
                                    className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                                  />
                                </div>
                              </td>

                              {/* Interactive Status Selector */}
                              <td className="py-3 px-3">
                                <select
                                  value={row.status}
                                  onChange={(e) => {
                                    const st = e.target.value as any;
                                    setScheduleData(prev => prev.map(r => r.id === row.id ? { 
                                      ...r, 
                                      status: st,
                                      progress: st === 'COMPLETED' ? 100 : st === 'NOT_STARTED' ? 0 : r.progress
                                    } : r));
                                  }}
                                  className={`text-[10px] font-mono font-bold rounded-lg px-2 py-1 border bg-slate-950 focus:outline-none cursor-pointer ${
                                    row.status === 'COMPLETED' ? 'text-emerald-400 border-emerald-800' :
                                    row.status === 'IN_PROGRESS' ? 'text-amber-400 border-amber-800' :
                                    'text-slate-400 border-slate-700'
                                  }`}
                                >
                                  <option value="NOT_STARTED">NOT_STARTED</option>
                                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                                  <option value="COMPLETED">COMPLETED</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

              {/* --- 4C. GENERAL DOCUMENT VIEWER (PDF / SPECS) --- */}
              {!isCadDocument(previewDoc) && !isExcelScheduleDocument(previewDoc) && (
                <div className="flex-1 overflow-auto p-8 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-3xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                    <FileText className="w-8 h-8" />
                  </div>
                  
                  <div className="max-w-md space-y-1">
                    <h3 className="text-lg font-bold text-white">{previewDoc.title}</h3>
                    <p className="text-xs text-slate-400 font-mono">
                      Category: {previewDoc.category} • Revision: v{previewDoc.version} • Size: {previewDoc.fileSize || '3.2 MB'}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-300 max-w-lg leading-relaxed text-left">
                    <strong className="block text-white mb-1 font-mono text-[11px] uppercase text-teal-400">Archived Document Details:</strong>
                    {previewDoc.notes || 'Official project document archived in centralized repository.'}
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => alert(`Downloading verified copy of ${previewDoc.title}`)}
                      className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow-lg shadow-teal-950"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Archive Copy</span>
                    </button>
                  </div>
                </div>
              )}

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
