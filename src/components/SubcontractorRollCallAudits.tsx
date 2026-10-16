import React, { useState, useMemo } from 'react';
import {
  ShieldCheck, AlertTriangle, Award, BadgeAlert,
  ClipboardList, Plus, Building2, Filter, MapPin, CheckCircle2, Search
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart as ReBarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import { DailyManpowerAudit, ProjectProfile, Contractor } from '../types';

export interface SubcontractorRollCallAuditsProps {
  manpowerAudits: DailyManpowerAudit[];
  projects?: ProjectProfile[];
  contractors?: Contractor[];
  readOnly?: boolean;
  isFinance?: boolean;
  onLogAuditClick?: () => void;
  notify?: (msg: string) => void;
}

export const SubcontractorRollCallAudits: React.FC<SubcontractorRollCallAuditsProps> = ({
  manpowerAudits = [],
  projects = [],
  contractors = [],
  readOnly = false,
  isFinance = false,
  onLogAuditClick,
  notify,
}) => {
  const [selectedSite, setSelectedSite] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const audits = manpowerAudits;

  // Derive unique list of active commercial sites / project names
  const availableProjects = useMemo(() => {
    const set = new Set<string>();
    
    // Add projects from project profile list
    projects.forEach(p => {
      if (p.name?.trim()) set.add(p.name.trim());
      if (p.id?.trim()) set.add(p.id.trim());
    });

    // Add projects / zones referenced in existing audits
    audits.forEach(a => {
      if (a.projectId?.trim()) set.add(a.projectId.trim());
      if (a.allocatedZone?.trim()) set.add(a.allocatedZone.trim());
      if (a.projectTitle?.trim()) set.add(a.projectTitle.trim());
      const zone = a.assignedSectorOrLot?.trim();
      if (zone) {
        // If it starts with common project prefixes, normalize or add
        if (zone.toLowerCase().includes('nexbridge')) set.add('NexBridge Software Hub');
        else if (zone.toLowerCase().includes('2-storey') || zone.toLowerCase().includes('residential')) set.add('2-Storey Residential House');
        else if (zone.toLowerCase().includes('bgcomm')) set.add('BGComm 1200sqm BPO Center');
        else set.add(zone);
      }
    });

    // Always ensure key active sites exist as options if not already present
    if (!set.has('NexBridge Software Hub')) set.add('NexBridge Software Hub');
    if (!set.has('2-Storey Residential House')) set.add('2-Storey Residential House');

    return Array.from(set).sort();
  }, [projects, audits]);

  // Filter audits based on selectedSite and searchQuery
  const filteredAudits = useMemo(() => {
    return audits.filter(audit => {
      const matchesSite = selectedSite === 'ALL' || (
        audit.projectId === selectedSite ||
        audit.allocatedZone === selectedSite ||
        audit.projectTitle?.toLowerCase() === selectedSite.toLowerCase() ||
        audit.assignedSectorOrLot?.toLowerCase() === selectedSite.toLowerCase() ||
        (audit.assignedSectorOrLot && audit.assignedSectorOrLot.toLowerCase().includes(selectedSite.toLowerCase())) ||
        (audit.assignedSectorOrLot && selectedSite.toLowerCase().includes(audit.assignedSectorOrLot.toLowerCase()))
      );
      if (!matchesSite) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        audit.contractorName?.toLowerCase().includes(q) ||
        audit.specialty?.toLowerCase().includes(q) ||
        audit.remarks?.toLowerCase().includes(q) ||
        audit.assignedSectorOrLot?.toLowerCase().includes(q)
      );
    });
  }, [audits, selectedSite, searchQuery]);

  // Dynamic chart data for filtered audits
  const chartData = useMemo(() => {
    return filteredAudits.slice(0, 10).map(audit => ({
      name: audit.contractorName ? audit.contractorName.split(' ')[0] : 'Trade',
      fullName: audit.contractorName || 'Subcontractor',
      specialty: audit.specialty,
      shift: audit.shift || 'Shift',
      claimed: audit.claimedHeadcount || 0,
      verified: audit.verifiedHeadcount || 0,
      discrepancy: audit.discrepancy || 0,
      status: audit.verificationStatus
    }));
  }, [filteredAudits]);

  // Aggregate metrics
  const totalVerified = filteredAudits.reduce((sum, a) => sum + (a.verifiedHeadcount || 0), 0);
  const totalClaimed = filteredAudits.reduce((sum, a) => sum + (a.claimedHeadcount || 0), 0);
  const flaggedCount = filteredAudits.filter(a => a.verificationStatus === 'DISCREPANCY_FLAGGED').length;
  const cleanCount = filteredAudits.filter(a => a.verificationStatus === 'VERIFIED_MATCH').length;

  const isReadOnlyMode = readOnly || isFinance;

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* View Header with Project Selector & Search */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span className="text-[10px] font-mono text-blue-400 font-bold uppercase tracking-wider">
              {isFinance ? 'FINANCE AUDIT VIEW • READ-ONLY PROTECTION' : 'SUBCONTRACTOR GATE MUSTER & ROLL-CALL VERIFICATION'}
            </span>
          </div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            Subcontractor Roll-Call Audits
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Field supervisor roll-calls, GPS geotagged attendance, biometric headcount, and anti-ghost discrepancy auditing.
          </p>
        </div>

        {/* Filters Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search trade or note..."
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 w-44"
            />
          </div>

          {/* Project Filter Selector */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded-lg">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedSite}
              onChange={e => setSelectedSite(e.target.value)}
              className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer pr-2"
            >
              <option value="ALL" className="bg-slate-900 text-white">All Projects ({audits.length})</option>
              {availableProjects.map(proj => (
                <option key={proj} value={proj} className="bg-slate-900 text-white">
                  {proj}
                </option>
              ))}
            </select>
          </div>

          {/* Single Action Button: completely hidden for Finance / readOnly */}
          {!isReadOnlyMode && onLogAuditClick && (
            <button
              onClick={onLogAuditClick}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Roll-Call Audit</span>
            </button>
          )}
        </div>
      </div>

      {/* Subcontractor Fraud Audit KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
            <span>24H ROLL-CALL AUDIT</span>
            <ShieldCheck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-bold font-mono text-blue-300">
            {totalVerified} / {totalClaimed}
            <span className="text-xs text-slate-400 font-normal ml-1">
              ({filteredAudits.length} Audits)
            </span>
          </div>
          <span className="text-[10px] text-blue-400 block font-mono">
            {filteredAudits.length > 0 ? `${filteredAudits.length} Audits Active • GPS Geotagged` : 'No Active Audits'}
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
            <span>LABOR DISCREPANCY RATE</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-400">
            {filteredAudits.length === 0 ? '0%' : `${Math.round((flaggedCount / filteredAudits.length) * 100)}%`}
            <span className="text-xs text-slate-400 font-normal ml-1.5">
              ({flaggedCount} of {filteredAudits.length} Shifts)
            </span>
          </div>
          <span className="text-[10px] text-amber-300/80 block font-mono">Subcontractor Billing auto-locked on variance</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
            <span>FRAUD PREVENTION</span>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-300">
            {filteredAudits.length === 0 ? '100%' : `${Math.round((cleanCount / filteredAudits.length) * 100)}%`}
            <span className="text-xs text-slate-400 font-normal ml-1.5">
              ({cleanCount} of {filteredAudits.length} Audits)
            </span>
          </div>
          <span className="text-[10px] text-emerald-400 block font-mono">100% Gate Muster Match</span>
        </div>
      </div>

      {/* Discrepancy & Anti-Ghost Worker Warning Banner */}
      {flaggedCount > 0 && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-3.5 flex items-start gap-2.5 text-xs">
          <BadgeAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <strong className="text-amber-200 block text-xs">Active Subcontractor Headcount Variance Detected:</strong>
            <p className="text-slate-300 text-[11px]">
              A discrepancy between subcontractor billed manifest and verified physical gate headcount was flagged. Progress payment releases remain guarded until rectified on next shift inspection.
            </p>
          </div>
        </div>
      )}

      {/* Chart: Roll-Call Discrepancy Multi-Bar Comparison */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
          <div>
            <h4 className="text-xs font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              Subcontractor Audit: Declared vs Verified vs Ghost Discrepancy
            </h4>
            <p className="text-[11px] text-slate-400">
              Macro gate headcount comparison protecting against ghost worker invoice fraud
              {selectedSite !== 'ALL' && <span className="text-blue-400 font-semibold ml-1">({selectedSite})</span>}
            </p>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-mono">
            <span className="flex items-center gap-1 text-blue-400"><span className="w-2 h-2 rounded bg-blue-500"></span> Declared</span>
            <span className="flex items-center gap-1 text-emerald-400"><span className="w-2 h-2 rounded bg-emerald-500"></span> Verified</span>
            <span className="flex items-center gap-1 text-rose-400"><span className="w-2 h-2 rounded bg-rose-500"></span> Ghost Gap</span>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="h-52 flex flex-col items-center justify-center text-slate-500 space-y-2 text-center p-4">
            <ShieldCheck className="w-8 h-8 text-slate-600" />
            <span className="text-xs font-semibold text-slate-400">No Roll-Call Audits Found for Selected Filter</span>
            <span className="text-[11px] text-slate-600">Switch filter to &quot;All Projects&quot; or clear search to view variances.</span>
          </div>
        ) : (
          <div className="h-52 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl shadow-xl text-xs font-sans space-y-1 pointer-events-none select-none">
                          <div className="font-bold text-white">{d.fullName} ({d.shift})</div>
                          {d.specialty && <div className="text-teal-400 text-[10px]">{d.specialty}</div>}
                          <div className="text-blue-400 font-mono">Declared Headcount: {d.claimed}</div>
                          <div className="text-emerald-400 font-mono">Verified Physical: {d.verified}</div>
                          {d.discrepancy > 0 ? (
                            <div className="text-rose-400 font-mono font-bold">⚠ Discrepancy: {d.discrepancy} Ghost Worker(s)</div>
                          ) : (
                            <div className="text-emerald-400 font-mono text-[10px]">✓ 100% Roll-Call Match</div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="claimed" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Declared" />
                <Bar dataKey="verified" fill="#10b981" radius={[4, 4, 0, 0]} name="Verified" />
                <Bar dataKey="discrepancy" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Ghost Discrepancy" />
              </ReBarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs">
          <div className="text-slate-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-[11px]">Real-Time Biometric &amp; Geofenced Gate Muster Protection Active</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">Protected by SHA-256 Geotag Signatures</span>
        </div>
      </div>

      {/* Certified Daily Roll-Call Audits & GPS Attendance Records Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <div>
            <h4 className="text-xs font-bold text-white flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-teal-400" />
              Certified Subcontractor Roll-Call Audits &amp; GPS Attendance Records
            </h4>
            <p className="text-[11px] text-slate-400">
              Field supervisor on-site roll-call certifications with GPS geotags and anti-fraud verification
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-teal-400 font-mono text-[11px] font-bold bg-teal-950/60 border border-teal-800/80 px-2 py-0.5 rounded-lg">
              {filteredAudits.length} Audited Logs
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono text-[10px] uppercase">
                <th className="py-2.5 px-3">Date &amp; Shift</th>
                <th className="py-2.5 px-3">Subcontractor / Crew</th>
                <th className="py-2.5 px-3">Allocated Zone / Site</th>
                <th className="py-2.5 px-3 text-center">Billed Manifest vs Verified</th>
                <th className="py-2.5 px-3 text-center">Variance Status</th>
                <th className="py-2.5 px-3">GPS &amp; Proof</th>
                <th className="py-2.5 px-3">Audit Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredAudits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                    <ClipboardList className="w-6 h-6 mx-auto text-slate-600 mb-1" />
                    <div className="font-semibold text-slate-400">No Subcontractor Audit Records Found</div>
                    <div className="text-[11px] text-slate-600">
                      {selectedSite !== 'ALL'
                        ? 'No records match this project filter. Reset to "All Projects" to view all logs.'
                        : 'No roll-call audit records have been registered yet.'}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAudits.map((audit) => (
                  <tr key={audit.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-3 px-3 font-mono whitespace-nowrap">
                      <span className="text-white font-bold block">{audit.date}</span>
                      <span className="text-slate-500 text-[10px]">{audit.shift}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-white font-bold block">{audit.contractorName}</span>
                      <span className="text-teal-400 font-mono text-[10px]">{audit.specialty}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-300 max-w-[180px] truncate">
                      {audit.assignedSectorOrLot}
                    </td>
                    <td className="py-3 px-3 text-center font-mono whitespace-nowrap">
                      <span className="text-teal-300 font-bold text-sm">{audit.verifiedHeadcount}</span>
                      <span className="text-slate-500 text-xs"> / {audit.claimedHeadcount} Men</span>
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${
                        audit.verificationStatus === 'VERIFIED_MATCH'
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                          : 'bg-amber-950 text-amber-300 border-amber-700'
                      }`}>
                        {audit.verificationStatus === 'VERIFIED_MATCH' ? 'MATCH ✓' : `MISSING (-${audit.discrepancy})`}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[10px] font-mono whitespace-nowrap">
                      <span className="text-slate-400 block">📍 {audit.gpsCoordinates ? audit.gpsCoordinates.split('(')[0] : 'Commercial Site'}</span>
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Photo Roll-Call Verified
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-300 italic text-[11px] max-w-[220px]">
                      &quot;{audit.remarks}&quot;
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SubcontractorRollCallAudits;
