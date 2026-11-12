/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Briefcase, CheckCircle2, Clock, DollarSign, Mail,
  Phone, Building2, User, Search, Filter, Sparkles,
  ArrowRight, Check, X, Tag, Calculator, Award, Download, Printer,
  Star, MessageSquare, ShieldCheck, Trash2, Sliders, RotateCcw, Save
} from 'lucide-react';
import { FitoutQuotationItem } from '../types';
import { exportToCsv, printRegisterTable } from '../utils/exportUtils';
import { useTheme } from '../context/ThemeContext';
import {
  EstimatorConfig,
  SpaceCategoryKey,
  FinishTierKey,
  getEstimatorConfig,
  saveEstimatorConfig,
  resetEstimatorConfig,
  ESTIMATOR_CONFIG_EVENT,
} from '../utils/estimatorConfig';
import BillOfMaterialsManager from './BillOfMaterialsManager';

interface QuotationLeadsManagerProps {
  quotations: FitoutQuotationItem[];
  isAdmin?: boolean;
  projects?: any[];
  onUpdateStatus?: (id: string, status: FitoutQuotationItem['status']) => Promise<void> | void;
  onConvertToProject?: (quotation: FitoutQuotationItem) => Promise<void> | void;
  navigateToProject?: (projectId?: string) => void;
}

export default function QuotationLeadsManager({
  quotations = [],
  isAdmin = true,
  projects = [],
  onUpdateStatus,
  onConvertToProject,
  navigateToProject: propNavigateToProject
}: QuotationLeadsManagerProps) {
  const { isDark } = useTheme();
  const navigateToProject = (projectId?: string) => {
    if (propNavigateToProject) {
      propNavigateToProject(projectId);
    } else {
      window.dispatchEvent(new CustomEvent('navigate-to-project', { detail: { projectId } }));
    }
  };
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedQuote, setSelectedQuote] = useState<FitoutQuotationItem | null>(null);
  const [isConvertingId, setIsConvertingId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'bom' | 'leads' | 'estimator' | 'all'>('bom');

  // Estimator Configuration State
  const [estimatorConfig, setEstimatorConfig] = useState<EstimatorConfig>(() => getEstimatorConfig());
  const [estimatorSavedMsg, setEstimatorSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    const syncEstimator = () => setEstimatorConfig(getEstimatorConfig());
    window.addEventListener(ESTIMATOR_CONFIG_EVENT, syncEstimator);
    window.addEventListener('storage', syncEstimator);
    return () => {
      window.removeEventListener(ESTIMATOR_CONFIG_EVENT, syncEstimator);
      window.removeEventListener('storage', syncEstimator);
    };
  }, []);

  const handleSpaceRateChange = (key: SpaceCategoryKey, newRate: number) => {
    const clamped = Math.max(1000, Math.min(250000, Math.round(Number(newRate) || 0)));
    setEstimatorConfig((prev) => ({
      ...prev,
      categories: {
        ...prev.categories,
        [key]: {
          ...prev.categories[key],
          baseRatePerSqm: clamped,
          standard: Math.round(clamped * prev.tierMultipliers.standard),
          premium: Math.round(clamped * prev.tierMultipliers.premium),
          bespoke: Math.round(clamped * prev.tierMultipliers.bespoke),
        },
      },
    }));
  };

  const handleTierMultiplierChange = (key: FinishTierKey, newMult: number) => {
    const clamped = Math.max(0.5, Math.min(5.0, Number(newMult) || 1));
    setEstimatorConfig((prev) => {
      const nextMults = { ...prev.tierMultipliers, [key]: clamped };
      const nextCategories = { ...prev.categories };
      (Object.keys(nextCategories) as SpaceCategoryKey[]).forEach((catKey) => {
        const base = nextCategories[catKey].baseRatePerSqm;
        nextCategories[catKey] = {
          ...nextCategories[catKey],
          standard: Math.round(base * nextMults.standard),
          premium: Math.round(base * nextMults.premium),
          bespoke: Math.round(base * nextMults.bespoke),
        };
      });
      return {
        ...prev,
        categories: nextCategories,
        tierMultipliers: nextMults,
      };
    });
  };

  const handleSaveEstimatorRates = () => {
    const updated = saveEstimatorConfig(estimatorConfig, 'Operations Admin');
    setEstimatorConfig(updated);
    setEstimatorSavedMsg('Estimator rates & tier multipliers saved! Public Landing Page updated live.');
    setTimeout(() => setEstimatorSavedMsg(null), 4000);
  };

  const handleResetEstimatorRates = () => {
    const defaults = resetEstimatorConfig();
    setEstimatorConfig(defaults);
    setEstimatorSavedMsg('Estimator rates restored to default baseline.');
    setTimeout(() => setEstimatorSavedMsg(null), 4000);
  };

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
    exportToCsv('LDM_Construction_Quotation_Leads', headers, rows);
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
    printRegisterTable('LDM Construction Quotation Leads Register', 'Prospective Residential & Turnkey Fit-Out Inquiries', headers, rows);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">
              CLIENT ACQUISITION & ESTIMATION CRM
            </span>
          </div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-cyan-400" />
            Landing Page Quotation Leads & Prospective Projects
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Incoming corporate inquiries and turnkey fit-out calculations submitted from the public portal. Convert high-intent leads to live projects in one click.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-1 gap-1">
            {[
              { id: 'bom', label: 'BOM & Quotation Builder' },
              { id: 'leads', label: `Quotation Leads (${totalQuotes})` },
              { id: 'estimator', label: 'Estimator Rates Config' },
              { id: 'all', label: 'All CRM & BOM' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                  activeSubTab === tab.id
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg font-mono text-xs text-cyan-300 font-bold flex items-center gap-2">
            <Calculator className="w-4 h-4 text-cyan-400" />
            <span>Pipeline: ₱{pipelineValue.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Bill of Materials & Quotation Builder Module */}
      {(activeSubTab === 'bom' || activeSubTab === 'all') && (
        <div className="space-y-4">
          <BillOfMaterialsManager
            projects={projects}
            onNavigateToGantt={(projectId) => navigateToProject(projectId)}
          />
        </div>
      )}

      {/* KPI Cards */}
      {(activeSubTab === 'all' || activeSubTab === 'leads') && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 space-y-1 shadow-xs">
          <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
            <span>TOTAL ONLINE INQUIRIES</span>
            <Mail className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white">{totalQuotes}</div>
          <span className="text-[10px] text-slate-400 block font-mono">Web Estimator Leads</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 space-y-1 shadow-xs">
          <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
            <span>NEW INQUIRIES</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white">{newCount}</div>
          <span className="text-[10px] text-slate-400 block font-mono">Awaiting Response</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 space-y-1 shadow-xs">
          <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
            <span>CONVERTED TO PROJECT</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white">{convertedCount}</div>
          <span className="text-[10px] text-slate-400 block font-mono">Signed LDM Design &amp; Build Projects</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 space-y-1 shadow-xs">
          <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
            <span>CONVERSION RATE</span>
            <Award className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white">
            {totalQuotes > 0 ? Math.round((convertedCount / totalQuotes) * 100) : 0}%
          </div>
          <span className="text-[10px] text-slate-400 block font-mono">Inquiry to Contract Pace</span>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto py-1">
          <Filter className="w-4 h-4 text-slate-500 shrink-0 mr-1" />
          {['ALL', 'NEW_INQUIRY', 'CONTACTED', 'PROPOSAL_SENT', 'CONVERTED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer shrink-0 ${statusFilter === st
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
            >
              {st === 'NEW_INQUIRY' ? 'NEW' : st.replace('_', ' ')}
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
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <button
            onClick={handleExportCsv}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            title="Export filtered leads to CSV"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Export CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            title="Print or Save PDF report"
          >
            <Printer className="w-3.5 h-3.5 text-slate-300" />
            <span className="hidden md:inline">Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={`${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs'} border rounded-xl overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className={`w-full text-left text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            <thead className={`${isDark ? 'bg-slate-900/90 text-slate-400 border-slate-800' : 'bg-slate-50 text-slate-600 border-slate-200'} font-mono text-[11px] uppercase border-b`}>
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
            <tbody className={`divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-200'} font-sans`}>
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
                  <tr key={quote.id} className={`${isDark ? 'hover:bg-slate-900/50' : 'hover:bg-slate-50/80'} transition-colors`}>
                    <td className="py-3.5 px-4">
                      <div className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'} text-sm`}>{quote.clientName}</div>
                      <div className={`text-[11px] ${isDark ? 'text-cyan-400' : 'text-cyan-700'} font-mono mt-0.5 flex items-center gap-1`}>
                        <Mail className="w-3 h-3 shrink-0" />
                        <span>{quote.clientEmail}</span>
                      </div>
                      {quote.clientPhone && (
                        <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'} font-mono mt-0.5 flex items-center gap-1`}>
                          <Phone className="w-3 h-3 shrink-0" />
                          <span>{quote.clientPhone}</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'} max-w-xs truncate`}>{quote.projectScope}</div>
                      <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'} flex items-center gap-2 mt-0.5 font-mono`}>
                        <span>{quote.spaceType || 'Commercial'}</span>
                        <span>•</span>
                        <span className={isDark ? 'text-amber-400' : 'text-amber-700 font-semibold'}>{quote.finishTier || 'Standard Executive'}</span>
                      </div>
                    </td>

                    <td className={`py-3.5 px-4 text-center font-mono font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                      {Number(quote.estimatorArea || 0).toLocaleString()} sqm
                    </td>

                    <td className={`py-3.5 px-4 text-right font-mono font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'} text-sm`}>
                      ₱{Number(quote.estimatedCost || 0).toLocaleString()}
                    </td>

                    <td className={`py-3.5 px-4 text-center font-mono ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
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
                        className={`text-[10px] font-mono font-bold rounded-lg px-2 py-1 border cursor-pointer focus:outline-none ${quote.status === 'CONVERTED'
                            ? isDark
                              ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : quote.status === 'PROPOSAL_SENT'
                              ? isDark
                                ? 'bg-blue-950/90 text-blue-300 border-blue-700'
                                : 'bg-blue-50 text-blue-800 border-blue-300'
                              : quote.status === 'CONTACTED'
                                ? isDark
                                  ? 'bg-purple-950/90 text-purple-300 border-purple-700'
                                  : 'bg-purple-50 text-purple-800 border-purple-300'
                                : isDark
                                  ? 'bg-amber-950/90 text-amber-300 border-amber-700'
                                  : 'bg-amber-50 text-amber-800 border-amber-300'
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
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer border ${
                            isDark
                              ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          Notes
                        </button>
                        {(() => {
                          const lead = quote;
                          if (!isAdmin) return null;
                          if (lead.status === 'CONVERTED') {
                            return (
                              <button
                                onClick={() => navigateToProject(lead.convertedProjectId)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-colors border ${
                                  isDark
                                    ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20'
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                }`}
                              >
                                View Project →
                              </button>
                            );
                          }
                          return (
                            <button
                              onClick={() => handleConvert(lead)}
                              disabled={isConvertingId === lead.id}
                              className={`text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                                isDark
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-xs'
                                  : 'bg-white border border-slate-300 text-slate-700 hover:border-emerald-600 hover:text-emerald-700 font-medium'
                              }`}
                            >
                              <Sparkles className={`w-3.5 h-3.5 ${isDark ? 'text-emerald-200' : 'text-emerald-600'}`} />
                              <span>{isConvertingId === lead.id ? 'Converting...' : 'Convert to Project'}</span>
                            </button>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

      {/* Admin Estimator Pricing & Tier Configuration Panel */}
      {(activeSubTab === 'all' || activeSubTab === 'estimator') && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">
                  LIVE LANDING PAGE PRICING ENGINE
                </span>
              </div>
              <h4 className="text-base font-bold text-white">
                Cost Estimator Rate & Finish Tier Configuration
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure base <span className="font-mono text-cyan-300">₱/sqm</span> rates per Project Category and multipliers per Specification & Finish Tier. Changes immediately synchronize with the public Landing Page estimator.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={handleResetEstimatorRates}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Defaults
              </button>
              <button
                type="button"
                onClick={handleSaveEstimatorRates}
                className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                Save Estimator Rates
              </button>
            </div>
          </div>

          {estimatorSavedMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{estimatorSavedMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Base ₱/sqm Rates per Project Category */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <h5 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                1. Base Rate per Project Category (₱ / sqm)
              </h5>
              <div className="space-y-2.5">
                {(Object.keys(estimatorConfig.categories) as SpaceCategoryKey[]).map((key) => {
                  const cat = estimatorConfig.categories[key];
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-3 bg-slate-900/80 border border-slate-800/80 rounded-lg p-3"
                    >
                      <div>
                        <div className="text-xs font-bold text-white">{cat.label}</div>
                        <div className="text-[11px] text-slate-400">
                          Std: ₱{cat.standard.toLocaleString()} • Prem: ₱{cat.premium.toLocaleString()} • Bespoke: ₱{cat.bespoke.toLocaleString()}/sqm
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs font-mono text-slate-400">₱</span>
                        <input
                          type="number"
                          min={1000}
                          max={250000}
                          step={500}
                          value={cat.baseRatePerSqm}
                          onChange={(e) => handleSpaceRateChange(key, Number(e.target.value))}
                          className="w-28 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-right text-xs font-mono font-bold text-cyan-300 focus:outline-none focus:border-cyan-500"
                        />
                        <span className="text-[11px] font-mono text-slate-500">/sqm</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Multipliers per Specification & Finish Tier */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <h5 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                2. Specification & Finish Tier Multipliers
              </h5>
              <div className="space-y-2.5">
                {(Object.keys(estimatorConfig.tierMultipliers) as FinishTierKey[]).map((key) => {
                  const mult = estimatorConfig.tierMultipliers[key];
                  const label = estimatorConfig.tierLabels[key];
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-3 bg-slate-900/80 border border-slate-800/80 rounded-lg p-3"
                    >
                      <div>
                        <div className="text-xs font-bold text-white">{label}</div>
                        <div className="text-[11px] text-slate-400 font-mono">Tier Key: {key.toUpperCase()}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          type="number"
                          min={0.5}
                          max={5.0}
                          step={0.05}
                          value={mult}
                          onChange={(e) => handleTierMultiplierChange(key, Number(e.target.value))}
                          className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-right text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-500"
                        />
                        <span className="text-xs font-mono text-slate-400">x</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

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
