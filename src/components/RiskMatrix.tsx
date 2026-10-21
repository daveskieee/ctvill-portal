/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2, Plus, X, User, Target } from 'lucide-react';
import { ProjectRisk } from '../types';

interface RiskMatrixProps {
  risks: ProjectRisk[];
  onAddRisk: (risk: Omit<ProjectRisk, 'id' | 'createdAt'>) => void;
  onUpdateRiskStatus?: (riskId: string, status: ProjectRisk['status']) => void;
}

export default function RiskMatrix({ risks, onAddRisk, onUpdateRiskStatus }: RiskMatrixProps) {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Form state
  const [newTitle, setNewTitle] = useState<string>('');
  const [newCategory, setNewCategory] = useState<ProjectRisk['category']>('WEATHER');
  const [newLikelihood, setNewLikelihood] = useState<number>(3);
  const [newImpact, setNewImpact] = useState<number>(4);
  const [newMitigation, setNewMitigation] = useState<string>('');
  const [newOwner, setNewOwner] = useState<string>('Engr. Ricardo Gomez');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    onAddRisk({
      title: newTitle.trim(),
      category: newCategory,
      likelihood: newLikelihood,
      impact: newImpact,
      riskScore: newLikelihood * newImpact,
      mitigationPlan: newMitigation.trim() || 'Standard operational risk protocol.',
      status: 'OPEN',
      ownerName: newOwner,
    });

    setNewTitle('');
    setNewMitigation('');
    setIsModalOpen(false);
  };

  const getScoreBadge = (score: number) => {
    if (score >= 15) {
      return <span className="bg-rose-500/20 text-rose-400 border border-rose-500/40 text-xs px-2.5 py-0.5 rounded-full font-bold">CRITICAL ({score})</span>;
    }
    if (score >= 10) {
      return <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs px-2.5 py-0.5 rounded-full font-bold">HIGH ({score})</span>;
    }
    if (score >= 5) {
      return <span className="bg-blue-500/20 text-blue-400 border border-blue-500/40 text-xs px-2.5 py-0.5 rounded-full font-medium">MEDIUM ({score})</span>;
    }
    return <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs px-2.5 py-0.5 rounded-full font-medium">LOW ({score})</span>;
  };

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            Project Risk Register & 5x5 RAG Matrix
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Engineering, permitting, meteorological, and supply-chain risk scoring with mitigation action plans.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-lg shadow-rose-950 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Log Project Risk</span>
        </button>
      </div>

      {/* 5x5 Risk Heatmap & Summary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Heatmap Card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3">
              5x5 Probability vs Impact Matrix
            </h3>

            {/* 5x5 Grid */}
            <div className="space-y-1">
              {[5, 4, 3, 2, 1].map((impactRow) => (
                <div key={impactRow} className="flex items-center gap-1">
                  <span className="w-4 text-[10px] font-mono text-slate-500 text-right pr-1">I{impactRow}</span>
                  {[1, 2, 3, 4, 5].map((probCol) => {
                    const cellScore = impactRow * probCol;
                    const cellRisks = risks.filter((r) => r.impact === impactRow && r.likelihood === probCol);

                    let bgClass = 'bg-emerald-950/40 border-emerald-800/40 text-emerald-500';
                    if (cellScore >= 15) bgClass = 'bg-rose-950/70 border-rose-700/60 text-rose-300 font-bold';
                    else if (cellScore >= 10) bgClass = 'bg-amber-950/60 border-amber-700/60 text-amber-300 font-bold';
                    else if (cellScore >= 5) bgClass = 'bg-blue-950/50 border-blue-700/50 text-blue-300';

                    return (
                      <div
                        key={probCol}
                        className={`flex-1 h-9 rounded-lg border flex flex-col items-center justify-center transition-all ${bgClass}`}
                        title={`Impact: ${impactRow}, Likelihood: ${probCol} (Score: ${cellScore})`}
                      >
                        <span className="text-[10px] font-mono">{cellScore}</span>
                        {cellRisks.length > 0 && (
                          <span className="text-[9px] bg-white/20 px-1 rounded-full font-mono">
                            {cellRisks.length}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
              <div className="flex items-center gap-1 pt-1 text-[10px] font-mono text-slate-500 pl-5">
                <div className="flex-1 text-center">L1</div>
                <div className="flex-1 text-center">L2</div>
                <div className="flex-1 text-center">L3</div>
                <div className="flex-1 text-center">L4</div>
                <div className="flex-1 text-center">L5</div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
            <span>X-Axis: Likelihood (L1-L5)</span>
            <span>Y-Axis: Impact (I1-I5)</span>
          </div>
        </div>

        {/* Risk Register Table (2 Cols) */}
        <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Active Risk Mitigation Log
          </h3>

          <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
            {risks.map((risk) => (
              <div
                key={risk.id}
                className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono text-rose-400 font-bold uppercase block">
                      {risk.category} RISK
                    </span>
                    <h4 className="text-xs font-bold text-white leading-snug">
                      {risk.title}
                    </h4>
                  </div>
                  {getScoreBadge(risk.riskScore)}
                </div>

                <p className="text-xs text-slate-300 bg-slate-900/60 p-2 rounded-lg border border-slate-800 leading-relaxed">
                  <strong className="text-slate-400 block text-[10px] uppercase">Mitigation Action Plan:</strong>
                  {risk.mitigationPlan}
                </p>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span className="flex items-center gap-1 text-slate-300">
                    <User className="w-3 h-3 text-slate-500" />
                    Owner: {risk.ownerName}
                  </span>

                  <span className="font-mono text-[10px] text-slate-500">
                    Status: <strong className="text-amber-400">{risk.status}</strong>
                  </span>
                </div>
              </div>
            ))}

            {risks.length === 0 && (
              <div className="h-40 flex flex-col items-center justify-center text-slate-500 text-xs">
                <ShieldAlert className="w-6 h-6 text-slate-600 mb-1" />
                No active project risks logged.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                Add Risk to Project Matrix
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Risk Title / Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Monsoon Season Heavy Rain affecting Phase B Spine Road curing"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  >
                    <option value="WEATHER">Weather</option>
                    <option value="REGULATORY">Regulatory</option>
                    <option value="SUPPLY_CHAIN">Supply Chain</option>
                    <option value="TECHNICAL">Technical</option>
                    <option value="FINANCIAL">Financial</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Likelihood (1-5)</label>
                  <select
                    value={newLikelihood}
                    onChange={(e) => setNewLikelihood(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  >
                    <option value={1}>1 - Rare</option>
                    <option value={2}>2 - Unlikely</option>
                    <option value={3}>3 - Possible</option>
                    <option value={4}>4 - Likely</option>
                    <option value={5}>5 - Almost Certain</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Impact (1-5)</label>
                  <select
                    value={newImpact}
                    onChange={(e) => setNewImpact(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  >
                    <option value={1}>1 - Negligible</option>
                    <option value={2}>2 - Minor</option>
                    <option value={3}>3 - Moderate</option>
                    <option value={4}>4 - Major</option>
                    <option value={5}>5 - Catastrophic</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Mitigation Strategy / Prevention Action</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Schedule asphalt paving during 10-day dry weather forecast window..."
                  value={newMitigation}
                  onChange={(e) => setNewMitigation(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-950 cursor-pointer"
                >
                  Save Risk to Matrix
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
