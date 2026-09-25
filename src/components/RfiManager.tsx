/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  HelpCircle, Plus, CheckCircle2, Clock, AlertTriangle, 
  Search, Filter, ShieldCheck, User, Calendar, X, Check, 
  ArrowRight, Building2, FileText, Send, MessageSquare, Download, Printer
} from 'lucide-react';
import { ProjectRFI, ProjectProfile } from '../types';
import { exportToCsv, printRegisterTable } from '../utils/exportUtils';

interface RfiManagerProps {
  rfis: ProjectRFI[];
  projects?: ProjectProfile[];
  isAdmin?: boolean;
  userRole?: string;
  onSubmitRfi?: (rfi: Partial<ProjectRFI>) => Promise<void> | void;
  onAnswerRfi?: (id: string, answer: string, status?: ProjectRFI['status']) => Promise<void> | void;
}

export default function RfiManager({
  rfis = [],
  projects = [],
  isAdmin = true,
  userRole = 'ADMIN',
  onSubmitRfi,
  onAnswerRfi
}: RfiManagerProps) {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Modals
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [selectedRfi, setSelectedRfi] = useState<ProjectRFI | null>(null);
  const [answerRfiModal, setAnswerRfiModal] = useState<ProjectRFI | null>(null);

  // Submit Form
  const [formSubject, setFormSubject] = useState('');
  const [formProject, setFormProject] = useState(projects[0]?.name || 'NexBridge Software Hub');
  const [formQuestion, setFormQuestion] = useState('');
  const [formSuggested, setFormSuggested] = useState('');
  const [formDrawingRef, setFormDrawingRef] = useState('');
  const [formPriority, setFormPriority] = useState<ProjectRFI['priority']>('MEDIUM');
  const [formAssignee, setFormAssignee] = useState('Principal Architect Maria Santos');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Answer Form
  const [answerText, setAnswerText] = useState('');
  const [answerStatus, setAnswerStatus] = useState<ProjectRFI['status']>('ANSWERED');
  const [isAnswering, setIsAnswering] = useState(false);

  const filteredRfis = rfis.filter(r => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (priorityFilter !== 'ALL' && r.priority !== priorityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        r.rfiNumber.toLowerCase().includes(q) ||
        r.subject.toLowerCase().includes(q) ||
        r.question.toLowerCase().includes(q) ||
        (r.drawingRef && r.drawingRef.toLowerCase().includes(q)) ||
        (r.submittedBy && r.submittedBy.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalRfis = rfis.length;
  const openCount = rfis.filter(r => r.status === 'OPEN' || r.status === 'UNDER_REVIEW').length;
  const answeredCount = rfis.filter(r => r.status === 'ANSWERED' || r.status === 'CLOSED').length;
  const criticalCount = rfis.filter(r => r.priority === 'CRITICAL' && (r.status === 'OPEN' || r.status === 'UNDER_REVIEW')).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSubject.trim() || !formQuestion.trim()) return;

    setIsSubmitting(true);
    try {
      const newRfi: Partial<ProjectRFI> = {
        rfiNumber: `RFI-${new Date().getFullYear()}-${String(rfis.length + 1).padStart(3, '0')}`,
        projectName: formProject,
        subject: formSubject.trim(),
        question: formQuestion.trim(),
        suggestedSolution: formSuggested.trim() || undefined,
        drawingRef: formDrawingRef.trim() || 'General Architectural Plans',
        priority: formPriority,
        assignedTo: formAssignee,
        submittedBy: userRole === 'ADMIN' ? 'Operations Director' : 'Site Project Engineer',
        status: 'OPEN'
      };

      if (onSubmitRfi) {
        await onSubmitRfi(newRfi);
      }

      setFormSubject('');
      setFormQuestion('');
      setFormSuggested('');
      setFormDrawingRef('');
      setShowSubmitModal(false);
    } catch (err) {
      console.error('Failed to submit RFI:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answerRfiModal || !answerText.trim()) return;

    setIsAnswering(true);
    try {
      if (onAnswerRfi) {
        await onAnswerRfi(answerRfiModal.id, answerText.trim(), answerStatus);
      }
      setAnswerRfiModal(null);
      setAnswerText('');
    } catch (err) {
      console.error('Failed to answer RFI:', err);
    } finally {
      setIsAnswering(false);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'RFI Number', 'Subject', 'Project Site', 'Priority', 'Status',
      'Submitted By', 'Assigned Architect/Engineer', 'Drawing Ref',
      'Due Date', 'Technical Question', 'Suggested Solution', 'Official Answer'
    ];
    const rows = filteredRfis.map(r => [
      r.rfiNumber,
      r.subject,
      r.projectName,
      r.priority,
      r.status,
      r.submittedBy,
      r.assignedTo || '',
      r.drawingRef || '',
      r.dueDate || '',
      r.question,
      r.suggestedSolution || '',
      r.answer || ''
    ]);
    exportToCsv('CTVill_Engineering_RFIs_Register', headers, rows);
  };

  const handlePrint = () => {
    const headers = [
      'RFI #', 'Subject', 'Project', 'Priority', 'Status', 'Submitted By', 'Drawing Ref', 'Due Date'
    ];
    const rows = filteredRfis.map(r => [
      r.rfiNumber,
      r.subject,
      r.projectName,
      r.priority,
      r.status,
      r.submittedBy,
      r.drawingRef || 'General',
      r.dueDate || 'Standard'
    ]);
    printRegisterTable('Engineering Request For Information (RFI) Register', 'Architectural Clarifications, MEPFS Coordination & Site Queries', headers, rows);
  };

  return (
    <div className="space-y-6 max-w-full min-w-0">
      {/* Header Banner */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse"></span>
            <span className="text-[10px] font-mono text-blue-400 font-bold uppercase tracking-wider">
              ENGINEERING COORDINATION & CLARIFICATION
            </span>
          </div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-blue-400" />
            Request for Information (RFI) Register
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Formal technical inquiries between site foremen, project engineers, and lead architects to resolve drawing ambiguities before construction.
          </p>
        </div>

        <button
          onClick={() => setShowSubmitModal(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer transition-all self-start sm:self-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Raise New RFI</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
            <span>TOTAL RFIS LOGGED</span>
            <MessageSquare className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">{totalRfis}</div>
          <span className="text-[10px] text-slate-400 block font-mono">Engineering Queries</span>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
            <span>OPEN / UNDER REVIEW</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-300">{openCount}</div>
          <span className="text-[10px] text-amber-400 block font-mono">Awaiting Architect Response</span>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
            <span>ANSWERED & RESOLVED</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-300">{answeredCount}</div>
          <span className="text-[10px] text-emerald-400 block font-mono">Drawing Clarifications Closed</span>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
            <span>CRITICAL BLOCKERS</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400">{criticalCount}</div>
          <span className="text-[10px] text-rose-400 block font-mono">High-Priority Site Hold</span>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 max-w-full">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap max-w-full">
          <div className="flex items-center gap-1.5 flex-wrap max-w-full">
            <Filter className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="text-xs font-mono text-slate-500 uppercase shrink-0">Status:</span>
            {['ALL', 'OPEN', 'UNDER_REVIEW', 'ANSWERED', 'CLOSED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer shrink-0 ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {st === 'UNDER_REVIEW' ? 'UNDER REVIEW' : st}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap max-w-full">
            <span className="text-xs font-mono text-slate-500 uppercase shrink-0">Priority:</span>
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((pr) => (
              <button
                key={pr}
                onClick={() => setPriorityFilter(pr)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all cursor-pointer shrink-0 ${
                  priorityFilter === pr
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {pr}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search RFI #, subject, sheet..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            onClick={handleExportCsv}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            title="Export filtered RFIs to CSV"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden md:inline">Export CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            title="Print or Save PDF report"
          >
            <Printer className="w-3.5 h-3.5 text-slate-300" />
            <span className="hidden md:inline">Print / PDF</span>
          </button>
        </div>
      </div>

      {/* RFI Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-sm max-w-full">
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4 whitespace-nowrap">RFI Number</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Subject & Query</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Drawing Reference</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Assigned Architect/Engr</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">Priority</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">Status</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredRfis.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-0">
                    <div className="sticky left-0 w-full py-12 text-center text-slate-500 flex flex-col items-center justify-center">
                      <HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm font-medium">No RFIs found</p>
                      <p className="text-xs text-slate-600 mt-0.5">Click "Raise New RFI" to log an engineering query.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRfis.map((rfi) => {
                  return (
                    <tr key={rfi.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-400">
                        {rfi.rfiNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white max-w-xs sm:max-w-md truncate">{rfi.subject}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-xs sm:max-w-md mt-0.5">
                          {rfi.question}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300 text-[11px]">
                        {rfi.drawingRef || 'General Plans'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 font-medium">
                        {rfi.assignedTo || 'Lead Architect'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                            rfi.priority === 'CRITICAL'
                              ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                              : rfi.priority === 'HIGH'
                              ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {rfi.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${
                            rfi.status === 'ANSWERED' || rfi.status === 'CLOSED'
                              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                              : 'bg-amber-950/80 text-amber-400 border-amber-800 animate-pulse'
                          }`}
                        >
                          {rfi.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedRfi(rfi)}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-medium transition cursor-pointer border border-slate-800"
                          >
                            View
                          </button>
                          {rfi.status !== 'CLOSED' && (
                            <button
                              onClick={() => {
                                setAnswerRfiModal(rfi);
                                setAnswerText(rfi.answer || '');
                              }}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
                            >
                              <Send className="w-3 h-3" />
                              <span>{rfi.answer ? 'Edit Answer' : 'Answer'}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Raise RFI Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 animate-scaleUp">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-blue-400" />
                Raise Request for Information (RFI)
              </h4>
              <button onClick={() => setShowSubmitModal(false)} className="text-slate-500 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">RFI Subject</label>
                <input
                  type="text"
                  required
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  placeholder="e.g., Transformer Clearance vs Overhead Chilled Water Line Conflict"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Project Site</label>
                  <select
                    value={formProject}
                    onChange={(e) => setFormProject(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Drawing Reference</label>
                  <input
                    type="text"
                    required
                    value={formDrawingRef}
                    onChange={(e) => setFormDrawingRef(e.target.value)}
                    placeholder="e.g., Sheet MEPFS-201 Grid C-4"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Priority Urgency</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="CRITICAL">CRITICAL (Site Hold)</option>
                    <option value="HIGH">HIGH (Work in 48h)</option>
                    <option value="MEDIUM">MEDIUM (Upcoming Phase)</option>
                    <option value="LOW">LOW (Informational)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Assigned Architect / Lead</label>
                  <input
                    type="text"
                    required
                    value={formAssignee}
                    onChange={(e) => setFormAssignee(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Technical Question / Ambiguity</label>
                <textarea
                  required
                  rows={3}
                  value={formQuestion}
                  onChange={(e) => setFormQuestion(e.target.value)}
                  placeholder="Detail the exact dimension conflict, MEP collision, or specification doubt on site..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 leading-relaxed"
                ></textarea>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Site Team Suggested Solution (Optional)</label>
                <input
                  type="text"
                  value={formSuggested}
                  onChange={(e) => setFormSuggested(e.target.value)}
                  placeholder="e.g., Reroute 4-inch chilled line along Grid D soffit"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-md"
                >
                  {isSubmitting ? 'Submitting...' : 'Dispatch RFI'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Answer RFI Modal */}
      {answerRfiModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-emerald-400" />
                Technical Resolution for {answerRfiModal.rfiNumber}
              </h4>
              <button onClick={() => setAnswerRfiModal(null)} className="text-slate-500 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 text-xs">
              <div className="font-bold text-white">{answerRfiModal.subject}</div>
              <p className="text-slate-400 leading-relaxed">{answerRfiModal.question}</p>
              {answerRfiModal.suggestedSolution && (
                <div className="text-[11px] text-blue-400 pt-1">
                  💡 Suggested by site: {answerRfiModal.suggestedSolution}
                </div>
              )}
            </div>

            <form onSubmit={handleConfirmAnswer} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Architect / Lead Engineer Direct Response</label>
                <textarea
                  required
                  rows={4}
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="State the approved architectural/structural instruction, revised dimension, or authorized specification change..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500 leading-relaxed"
                ></textarea>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Update Status</label>
                <select
                  value={answerStatus}
                  onChange={(e) => setAnswerStatus(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="ANSWERED">ANSWERED (Ready for Field Implementation)</option>
                  <option value="CLOSED">CLOSED (Formally Signed Off)</option>
                  <option value="UNDER_REVIEW">UNDER_REVIEW (Requires Structural Calculation)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAnswerRfiModal(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAnswering}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl cursor-pointer"
                >
                  {isAnswering ? 'Saving...' : 'Publish Answer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {selectedRfi && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-blue-400 font-bold">{selectedRfi.rfiNumber}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  selectedRfi.status === 'ANSWERED' || selectedRfi.status === 'CLOSED'
                    ? 'bg-emerald-950 text-emerald-300'
                    : 'bg-amber-950 text-amber-300'
                }`}>
                  {selectedRfi.status}
                </span>
              </div>
              <button onClick={() => setSelectedRfi(null)} className="text-slate-500 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Subject</span>
                <strong className="text-white text-sm">{selectedRfi.subject}</strong>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                <div>
                  <span className="text-slate-500 block text-[11px]">Drawing Reference</span>
                  <span className="text-slate-200 font-mono">{selectedRfi.drawingRef}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Assigned Engineer</span>
                  <span className="text-slate-200 font-medium">{selectedRfi.assignedTo}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px]">Question Details</span>
                <p className="text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800/80 leading-relaxed">
                  {selectedRfi.question}
                </p>
              </div>

              {selectedRfi.answer && (
                <div>
                  <span className="text-emerald-400 font-bold block text-[11px]">Architectural Clarification / Answer</span>
                  <p className="text-emerald-200 bg-emerald-950/40 p-3 rounded-xl border border-emerald-800/60 leading-relaxed">
                    {selectedRfi.answer}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedRfi(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
