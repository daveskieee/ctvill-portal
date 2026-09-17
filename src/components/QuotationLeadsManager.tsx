/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Briefcase, CheckCircle2, Clock, DollarSign, Mail, 
  Phone, Building2, User, Search, Filter, Sparkles, 
  ArrowRight, Check, X, Tag, Calculator, Award, Download, Printer
} from 'lucide-react';
import { FitoutQuotationItem } from '../types';
import { exportToCsv, printRegisterTable } from '../utils/exportUtils';

interface QuotationLeadsManagerProps {
  quotations: FitoutQuotationItem[];
  isAdmin?: boolean;
  onUpdateStatus?: (id: string, status: FitoutQuotationItem['status']) => Promise<void> | void;
  onConvertToProject?: (quotation: FitoutQuotationItem) => Promise<void> | void;
}

export default function QuotationLeadsManager({
  quotations = [],
  isAdmin = true,
  onUpdateStatus,
  onConvertToProject
}: QuotationLeadsManagerProps) {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedQuote, setSelectedQuote] = useState<FitoutQuotationItem | null>(null);
  const [isConvertingId, setIsConvertingId] = useState<string | null>(null);

  const filteredQuotes = quotations.filter(q => {
    if (statusFilter !== 'ALL' && q.status !== statusFilter) return false;
    if (searchQuery) {
      const s = searchQuery.toLowerCase();
      return (
        q.clientName.toLowerCase().includes(s) ||
        q.clientEmail.toLowerCase().includes(s) ||
        q.projectScope.toLowerCase().includes(s) ||
        (q.spaceType && q.spaceType.toLowerCase().includes(s))
      );
    }
    return true;
  });

  const totalQuotes = quotations.length;
  const pipelineValue = quotations.reduce((sum, q) => sum + (Number(q.estimatedCost) || 0), 0);
  const convertedCount = quotations.filter(q => q.status === 'CONVERTED').length;
  const newCount = quotations.filter(q => q.status === 'NEW_INQUIRY').length;

  const handleConvert = async (quote: FitoutQuotationItem) => {
    setIsConvertingId(quote.id);
    try {
      if (onConvertToProject) {
        await onConvertToProject(quote);
      }
    } catch (err) {
      console.error('Failed to convert quotation to project:', err);
    } finally {
      setIsConvertingId(null);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Lead ID', 'Client Name', 'Email', 'Phone', 'Project Scope',
      'Space Type', 'Finish Tier', 'Floor Area (sqm)', 'Est. Budget (PHP)',
      'Est. Weeks', 'Lead Status', 'Date Submitted', 'Project Notes'
    ];
    const rows = filteredQuotes.map(q => [
      q.id,
      q.clientName,
      q.clientEmail,
      q.clientPhone || '',
      q.projectScope,
      q.spaceType || '',
      q.finishTier || '',
      q.estimatorArea,
      q.estimatedCost,
      q.estimatedWeeks,
      q.status,
      q.createdAt || '',
      q.projectNotes || ''
    ]);
    exportToCsv('CTVill_Quotation_Leads', headers, rows);
  };

  const handlePrint = () => {
    const headers = [
      'Lead ID', 'Client Name', 'Email / Contact', 'Scope & Space',
      'Area', 'Est. Budget', 'Duration', 'Status'
    ];
    const rows = filteredQuotes.map(q => [
      q.id,
      q.clientName,
      `${q.clientEmail} ${q.clientPhone ? '• ' + q.clientPhone : ''}`,
      `${q.projectScope} (${q.spaceType || 'Commercial'})`,
      `${q.estimatorArea} sqm`,
      `₱${Number(q.estimatedCost || 0).toLocaleString()}`,
      `${q.estimatedWeeks} wks`,
      q.status
    ]);
    printRegisterTable('Commercial Fit-Out Quotation Leads Register', 'Prospective Commercial Projects & Web Estimator Submissions', headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">
              CLIENT ACQUISITION & ESTIMATION CRM
            </span>
          </div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-cyan-400" />
            Landing Page Quotation Leads & Prospective Projects
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Incoming corporate inquiries and turnkey fit-out calculations submitted from the public portal. Convert high-intent leads to live projects in one click.
          </p>
        </div>

        <div className="bg-cyan-950/80 border border-cyan-800/80 px-4 py-2.5 rounded-xl font-mono text-xs text-cyan-300 font-bold self-start sm:self-auto shrink-0 flex items-center gap-2">
          <Calculator className="w-4 h-4 text-cyan-400" />
          <span>Pipeline: ₱{pipelineValue.toLocaleString()}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
            <span>TOTAL ONLINE INQUIRIES</span>
            <Mail className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">{totalQuotes}</div>
          <span className="text-[10px] text-slate-400 block font-mono">Web Estimator Leads</span>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
            <span>NEW INQUIRIES</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-300">{newCount}</div>
          <span className="text-[10px] text-amber-400 block font-mono">Awaiting Response</span>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
            <span>CONVERTED TO PROJECT</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-300">{convertedCount}</div>
          <span className="text-[10px] text-emerald-400 block font-mono">Signed CTVill Commercial Sites</span>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
            <span>CONVERSION RATE</span>
            <Award className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-300">
            {totalQuotes > 0 ? Math.round((convertedCount / totalQuotes) * 100) : 0}%
          </div>
          <span className="text-[10px] text-purple-400 block font-mono">Inquiry to Contract Pace</span>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto py-1">
          <Filter className="w-4 h-4 text-slate-500 shrink-0 mr-1" />
          {['ALL', 'NEW_INQUIRY', 'CONTACTED', 'PROPOSAL_SENT', 'CONVERTED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer shrink-0 ${
                statusFilter === st
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search client, email, scope..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <button
            onClick={handleExportCsv}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            title="Export filtered leads to CSV"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
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

      {/* Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Client Contact</th>
                <th className="py-3.5 px-4">Space & Scope</th>
                <th className="py-3.5 px-4 text-center">Floor Area</th>
                <th className="py-3.5 px-4 text-right">Est. Budget</th>
                <th className="py-3.5 px-4 text-center">Est. Duration</th>
                <th className="py-3.5 px-4 text-center">Lead Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredQuotes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">No quotation leads found</p>
                    <p className="text-xs text-slate-600 mt-0.5">Leads submitted via the website fit-out calculator will automatically populate here.</p>
                  </td>
                </tr>
              ) : (
                filteredQuotes.map((quote) => (
                  <tr key={quote.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white text-sm">{quote.clientName}</div>
                      <div className="text-[11px] text-cyan-400 font-mono mt-0.5 flex items-center gap-1">
                        <Mail className="w-3 h-3 shrink-0" />
                        <span>{quote.clientEmail}</span>
                      </div>
                      {quote.clientPhone && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                          <Phone className="w-3 h-3 shrink-0" />
                          <span>{quote.clientPhone}</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-medium text-white max-w-xs truncate">{quote.projectScope}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                        <span>{quote.spaceType || 'Commercial'}</span>
                        <span>•</span>
                        <span className="text-amber-400">{quote.finishTier || 'Standard Executive'}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-200">
                      {Number(quote.estimatorArea || 0).toLocaleString()} sqm
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400 text-sm">
                      ₱{Number(quote.estimatedCost || 0).toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4 text-center font-mono text-slate-300">
                      {quote.estimatedWeeks || 8} weeks
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <select
                        value={quote.status}
                        onChange={(e) => {
                          if (onUpdateStatus) {
                            onUpdateStatus(quote.id, e.target.value as any);
                          }
                        }}
                        className={`text-[10px] font-mono font-bold rounded-lg px-2 py-1 border cursor-pointer focus:outline-none ${
                          quote.status === 'CONVERTED'
                            ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700'
                            : quote.status === 'PROPOSAL_SENT'
                            ? 'bg-blue-950/90 text-blue-300 border-blue-700'
                            : quote.status === 'CONTACTED'
                            ? 'bg-purple-950/90 text-purple-300 border-purple-700'
                            : 'bg-amber-950/90 text-amber-300 border-amber-700'
                        }`}
                      >
                        <option value="NEW_INQUIRY">NEW INQUIRY</option>
                        <option value="CONTACTED">CONTACTED</option>
                        <option value="PROPOSAL_SENT">PROPOSAL SENT</option>
                        <option value="CONVERTED">CONVERTED</option>
                      </select>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedQuote(quote)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-medium transition cursor-pointer border border-slate-800"
                        >
                          Notes
                        </button>
                        {isAdmin && quote.status !== 'CONVERTED' && (
                          <button
                            onClick={() => handleConvert(quote)}
                            disabled={isConvertingId === quote.id}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
                          >
                            <Sparkles className="w-3 h-3 text-emerald-200" />
                            <span>{isConvertingId === quote.id ? 'Converting...' : 'Convert to Project'}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details View Modal */}
      {selectedQuote && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-cyan-400" />
                Inquiry Details: {selectedQuote.clientName}
              </h4>
              <button onClick={() => setSelectedQuote(null)} className="text-slate-500 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-500 block text-[10px]">Email</span>
                  <span className="text-cyan-300 font-mono truncate">{selectedQuote.clientEmail}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Phone</span>
                  <span className="text-white font-mono">{selectedQuote.clientPhone || 'Not provided'}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px]">Scope of Fit-Out</span>
                <p className="text-white font-medium bg-slate-950 p-3 rounded-xl border border-slate-800 mt-1">
                  {selectedQuote.projectScope}
                </p>
              </div>

              {selectedQuote.projectNotes && (
                <div>
                  <span className="text-slate-500 block text-[10px]">Client Comments & Specifications</span>
                  <p className="text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800 mt-1 leading-relaxed">
                    {selectedQuote.projectNotes}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-center pt-1 font-mono text-[11px]">
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[9px]">SPACE</span>
                  <span className="text-white font-bold">{selectedQuote.spaceType}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[9px]">AREA</span>
                  <span className="text-white font-bold">{selectedQuote.estimatorArea} sqm</span>
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[9px]">EST. BUDGET</span>
                  <span className="text-emerald-400 font-bold">₱{Number(selectedQuote.estimatedCost).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedQuote(null)}
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
