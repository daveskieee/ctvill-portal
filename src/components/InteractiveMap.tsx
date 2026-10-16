/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Upload, CheckCircle2, FileImage, Layers, Eye, RefreshCw, 
  UserPlus, FileText, Check, ShieldCheck, ArrowRight, Activity,
  ZoomIn, ZoomOut, Maximize2, Trash2, Download, Sparkles, MapPin, 
  Ruler, HelpCircle, Compass, Grid, PlusCircle, AlertTriangle, CheckSquare,
  Bot, DollarSign, TrendingUp, Sliders, Calculator, Percent, Banknote, FileSpreadsheet
} from 'lucide-react';
import { Slot, Client, SlotStatus, CADParseResult, CADParsedLot, SlotPoint, LandParcel, CompanyBudget, CivilWorksMilestone, Contractor, PayrollRecord } from '../types';
import { parseDXFContent, parseGeoJSONContent, parseSVGContent, generateSampleAutoCADDXF, calculatePolygonArea } from '../utils/cadParser';
import { calculateAILotPricing, aggregateProjectExpenses, AIPortfolioFeasibility, AILotValuation } from '../utils/aiPricingEngine';

interface InteractiveMapProps {
  slots: Slot[];
  clients: Client[];
  parcel?: LandParcel | null;
  budget?: CompanyBudget | null;
  milestones?: CivilWorksMilestone[];
  contractors?: Contractor[];
  payroll?: PayrollRecord[];
  onTransitionSlotStatus: (slotId: string, status: string, notes?: string, assignedClientId?: string | null) => void;
  onAssignClient: (slotId: string, clientId: string) => void;
  onImportCADLots?: (lots: CADParsedLot[]) => void;
  onClearAllLots?: () => void;
  onApplyAIPricing?: (updates: { slotId: string; newBasePrice: number }[], targetMargin: number) => Promise<void> | void;
}

export default function InteractiveMap({ 
  slots, 
  clients,
  parcel = null,
  budget = null,
  milestones = [],
  contractors = [],
  payroll = [],
  onTransitionSlotStatus, 
  onAssignClient,
  onImportCADLots,
  onClearAllLots,
  onApplyAIPricing
}: InteractiveMapProps) {
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [assignmentClientId, setAssignmentClientId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Canvas Zoom & Pan
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // CAD Upload & Parse State
  const [parsedCADResult, setParsedCADResult] = useState<CADParseResult | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isLayerVisible, setIsLayerVisible] = useState<{ lots: boolean; labels: boolean; roads: boolean; grid: boolean }>({
    lots: true,
    labels: true,
    roads: true,
    grid: true,
  });

  // Manual Subdivider Studio Modal
  const [isSubdivideModalOpen, setIsSubdivideModalOpen] = useState<boolean>(false);
  const [subdivideLotCount, setSubdivideLotCount] = useState<number>(12);
  const [subdivideLotArea, setSubdivideLotArea] = useState<number>(500);
  const [subdivideBasePrice, setSubdivideBasePrice] = useState<number>(48000);
  const [subdivideBlockName, setSubdivideBlockName] = useState<string>('Block 1');

  // AI Pricing & Expense Valuation States
  const aggregatedExpenses = useMemo(() => aggregateProjectExpenses({
    parcel,
    budget,
    milestones,
    contractors,
    payroll
  }), [parcel, budget, milestones, contractors, payroll]);

  const [aiAcquisitionCost, setAiAcquisitionCost] = useState<number>(aggregatedExpenses.acquisitionCost);
  const [aiCivilCost, setAiCivilCost] = useState<number>(aggregatedExpenses.civilWorksCost);
  const [aiLaborCost, setAiLaborCost] = useState<number>(aggregatedExpenses.contractorLaborCost);
  const [aiOverheadCost, setAiOverheadCost] = useState<number>(aggregatedExpenses.permittingOverheadCost);
  const [aiTargetMargin, setAiTargetMargin] = useState<number>(35);
  const [aiContingency, setAiContingency] = useState<number>(8);
  const [isAIPricingModalOpen, setIsAIPricingModalOpen] = useState<boolean>(false);
  const [isApplyingPricing, setIsApplyingPricing] = useState<boolean>(false);
  const [pricingNotice, setPricingNotice] = useState<string | null>(null);

  // Sync state if parcel changes
  useEffect(() => {
    if (parcel?.acquisitionCost) {
      setAiAcquisitionCost(parcel.acquisitionCost);
    }
  }, [parcel]);

  // Real-time AI valuation calculation across entire lot inventory
  const aiFeasibility: AIPortfolioFeasibility = useMemo(() => {
    return calculateAILotPricing({
      acquisitionCost: Number(aiAcquisitionCost) || 0,
      civilWorksCost: Number(aiCivilCost) || 0,
      contractorLaborCost: Number(aiLaborCost) || 0,
      permittingOverheadCost: Number(aiOverheadCost) || 0,
      contingencyPercent: Number(aiContingency) || 0,
      targetProfitMargin: Number(aiTargetMargin) || 35,
      slots,
      parcel
    });
  }, [aiAcquisitionCost, aiCivilCost, aiLaborCost, aiOverheadCost, aiContingency, aiTargetMargin, slots, parcel]);

  const selectedSlotValuation: AILotValuation | undefined = useMemo(() => {
    if (!selectedSlot) return undefined;
    return aiFeasibility.lotValuations.find(v => v.slotId === selectedSlot.id);
  }, [selectedSlot, aiFeasibility]);

  const handleApplyAllAIPrices = async () => {
    setIsApplyingPricing(true);
    setPricingNotice(null);
    try {
      const updates = aiFeasibility.lotValuations.map(v => ({
        slotId: v.slotId,
        newBasePrice: v.suggestedBasePrice
      }));

      if (onApplyAIPricing) {
        await onApplyAIPricing(updates, aiTargetMargin);
      } else {
        const res = await fetch('/api/slots/apply-ai-pricing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            updates,
            parcelId: parcel?.id || 'PARCEL-CST',
            targetMargin: aiTargetMargin,
          })
        });
        if (!res.ok) throw new Error('Failed to apply pricing');
      }

      setPricingNotice(`✅ Successfully applied AI-optimized pricing to ${aiFeasibility.lotValuations.length} lots!`);
      setTimeout(() => setPricingNotice(null), 5000);
    } catch (e) {
      console.error(e);
      setPricingNotice('⚠️ Failed to commit pricing updates to database.');
    } finally {
      setIsApplyingPricing(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse uploaded CAD / DXF / SVG / GeoJSON file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const fileName = file.name;
    const ext = fileName.split('.').pop()?.toLowerCase();

    setIsParsing(true);
    try {
      const text = await file.text();
      let parseResult: CADParseResult;

      if (ext === 'geojson' || ext === 'json') {
        parseResult = parseGeoJSONContent(text, fileName);
      } else if (ext === 'svg') {
        parseResult = parseSVGContent(text, fileName);
      } else {
        // DXF / DWG text
        parseResult = parseDXFContent(text, fileName);
      }

      setParsedCADResult(parseResult);
      if (onImportCADLots && parseResult.lots.length > 0) {
        onImportCADLots(parseResult.lots);
      }
    } catch (err: any) {
      console.error('Failed to parse CAD file:', err);
      alert(`Error parsing CAD file: ${err.message || 'Unknown format'}`);
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Load Built-in Sample AutoCAD DXF
  const handleLoadSampleCAD = () => {
    setIsParsing(true);
    setTimeout(() => {
      try {
        const sampleDXF = generateSampleAutoCADDXF();
        const result = parseDXFContent(sampleDXF, 'Cavinti_Highland_Phase1_Masterplan.dxf');
        setParsedCADResult(result);
        if (onImportCADLots && result.lots.length > 0) {
          onImportCADLots(result.lots);
        }
      } catch (err: any) {
        console.error('Error generating sample DXF:', err);
      } finally {
        setIsParsing(false);
      }
    }, 400);
  };

  // Dynamic Map Bounding Box: Calculates exact envelope for ANY number of lots (1 to 500+)
  const mapBoundingBox = useMemo(() => {
    if (!slots || slots.length === 0) {
      return { minX: 0, minY: 0, maxX: 1000, maxY: 650, width: 1000, height: 650, viewBox: "0 0 1000 650", roadY: 270, roadWidth: 940, roadX: 30 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const totalCols = Math.min(slots.length, Math.max(5, Math.ceil(Math.sqrt(slots.length * 1.5))));

    slots.forEach((slot, idx) => {
      let pts: SlotPoint[] = [];
      if (slot.polygonPoints) {
        if (typeof slot.polygonPoints === 'string') {
          try {
            const parsed = JSON.parse(slot.polygonPoints);
            if (Array.isArray(parsed) && parsed.length > 0) {
              pts = parsed;
            }
          } catch {}
        } else if (Array.isArray(slot.polygonPoints)) {
          pts = slot.polygonPoints;
        }
      }

      if (pts.length === 0) {
        const row = slot.row || Math.ceil((idx + 1) / totalCols);
        const col = slot.col || ((idx % totalCols) + 1);
        const x0 = 60 + (col - 1) * 170;
        const y0 = 50 + (row - 1) * 130;
        const x1 = x0 + 150;
        const y1 = y0 + 110;
        pts = [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
      }

      pts.forEach(p => {
        if (typeof p.x === 'number' && typeof p.y === 'number' && !isNaN(p.x) && !isNaN(p.y)) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
      });
    });

    if (minX === Infinity || maxX === -Infinity || minY === Infinity || maxY === -Infinity) {
      return { minX: 0, minY: 0, maxX: 1000, maxY: 650, width: 1000, height: 650, viewBox: "0 0 1000 650", roadY: 270, roadWidth: 940, roadX: 30 };
    }

    const paddingX = Math.max(60, (maxX - minX) * 0.06);
    const paddingY = Math.max(60, (maxY - minY) * 0.06);

    const bMinX = Math.round(minX - paddingX);
    const bMinY = Math.round(minY - paddingY);
    const bWidth = Math.max(900, Math.round((maxX - minX) + paddingX * 2));
    const bHeight = Math.max(600, Math.round((maxY - minY) + paddingY * 2));

    const roadY = Math.round(minY + (maxY - minY) * 0.45);
    const roadX = bMinX + 20;
    const roadWidth = bWidth - 40;

    return {
      minX: bMinX,
      minY: bMinY,
      maxX: bMinX + bWidth,
      maxY: bMinY + bHeight,
      width: bWidth,
      height: bHeight,
      viewBox: `${bMinX} ${bMinY} ${bWidth} ${bHeight}`,
      roadY,
      roadWidth,
      roadX
    };
  }, [slots]);

  // Generate Custom Subdivision Grid
  const handleGenerateCustomSubdivision = (e: React.FormEvent) => {
    e.preventDefault();
    const lots: CADParsedLot[] = [];
    const count = Number(subdivideLotCount) || 12;
    const area = Number(subdivideLotArea) || 500;
    const price = Number(subdivideBasePrice) || 48000;
    const cols = Math.min(count, count > 24 ? 6 : count > 12 ? 5 : 4);
    const rows = Math.ceil(count / cols);

    let num = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (num > count) break;
        const x0 = 80 + c * 180;
        const y0 = 60 + r * 140;
        const x1 = x0 + 160;
        const y1 = y0 + 120;

        lots.push({
          slotNumber: num,
          lotName: `Lot ${num.toString().padStart(2, '0')}`,
          blockName: subdivideBlockName,
          areaSqm: area,
          points: [
            { x: x0, y: y0 },
            { x: x1, y: y0 },
            { x: x1, y: y1 },
            { x: x0, y: y1 },
          ],
          centerPoint: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 },
          basePrice: price,
          rawLayer: 'CUSTOM_SUBDIVISION',
        });
        num++;
      }
    }

    if (onImportCADLots) {
      onImportCADLots(lots);
    }
    setIsSubdivideModalOpen(false);
  };

  // Convert SVG coordinates for polygon points
  const getPolygonPointsString = (slot: Slot, index: number): string => {
    if (slot.polygonPoints) {
      if (typeof slot.polygonPoints === 'string') {
        try {
          const parsed = JSON.parse(slot.polygonPoints);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((p: SlotPoint) => `${p.x},${p.y}`).join(' ');
          }
        } catch {}
      } else if (Array.isArray(slot.polygonPoints) && slot.polygonPoints.length > 0) {
        return slot.polygonPoints.map((p) => `${p.x},${p.y}`).join(' ');
      }
    }

    // Default geometric grid rendering based on row / col if polygon vertices not supplied
    const totalCols = Math.min(slots.length, Math.max(5, Math.ceil(Math.sqrt(slots.length * 1.5))));
    const row = slot.row || Math.ceil((index + 1) / totalCols);
    const col = slot.col || ((index % totalCols) + 1);
    const x0 = 60 + (col - 1) * 170;
    const y0 = 50 + (row - 1) * 130;
    const x1 = x0 + 150;
    const y1 = y0 + 110;
    return `${x0},${y0} ${x1},${y0} ${x1},${y1} ${x0},${y1}`;
  };

  const getStatusFill = (status: SlotStatus, isSelected: boolean) => {
    if (isSelected) {
      return { fill: 'rgba(59, 130, 246, 0.4)', stroke: '#3b82f6', strokeWidth: '3' };
    }
    switch (status) {
      case 'Available':
        return { fill: 'rgba(16, 185, 129, 0.15)', stroke: '#10b981', strokeWidth: '1.5' };
      case 'Reserved':
        return { fill: 'rgba(245, 158, 11, 0.2)', stroke: '#f59e0b', strokeWidth: '1.5' };
      case 'Under Contract':
        return { fill: 'rgba(59, 130, 246, 0.25)', stroke: '#3b82f6', strokeWidth: '1.5' };
      case 'Developing':
        return { fill: 'rgba(99, 102, 241, 0.25)', stroke: '#6366f1', strokeWidth: '1.5' };
      case 'Titling Phase':
        return { fill: 'rgba(168, 85, 247, 0.25)', stroke: '#a855f7', strokeWidth: '1.5' };
      case 'Turnover Ready':
        return { fill: 'rgba(20, 184, 166, 0.3)', stroke: '#14b8a6', strokeWidth: '2' };
      case 'Handed Over':
      case 'Sold':
        return { fill: 'rgba(100, 116, 139, 0.3)', stroke: '#64748b', strokeWidth: '1.5' };
      default:
        return { fill: 'rgba(51, 65, 85, 0.2)', stroke: '#475569', strokeWidth: '1' };
    }
  };

  const filteredSlots = slots.filter((s) => filterStatus === 'ALL' || s.status === filterStatus);

  return (
    <div className="space-y-4">
      {/* Studio Toolbar & Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Compass className="w-5 h-5 text-amber-400" />
              Project Map & Space Planning Studio
            </h2>
            <span className="bg-slate-800 text-slate-300 border border-slate-700 text-xs px-2 py-0.5 rounded font-mono font-bold">
              {slots.length} Active Lots
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            AutoCAD (.dxf/.dwg/GeoJSON) interpretation engine with real polygon vertices, computed square meters, and lifecycle tagging.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".dxf,.dwg,.geojson,.json,.svg"
            className="hidden"
          />

          {/* AI Lot Pricing Optimizer Button */}
          <button
            onClick={() => setIsAIPricingModalOpen(true)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            title="Run AI Real Estate Cost & Pricing Optimizer"
          >
            <Bot className="w-3.5 h-3.5 text-purple-400" />
            <span>AI Pricing Optimizer</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isParsing}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold px-3.5 py-1.5 rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            {isParsing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            <span>Upload AutoCAD / DXF</span>
          </button>

          <button
            onClick={handleLoadSampleCAD}
            disabled={isParsing}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-md cursor-pointer"
            title="Load built-in Cavinti Phase 1 sample AutoCAD DXF masterplan"
          >
            <Sparkles className="w-4 h-4" />
            <span>Load Sample DXF</span>
          </button>

          <button
            onClick={() => setIsSubdivideModalOpen(true)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 transition-all cursor-pointer"
          >
            <Grid className="w-4 h-4 text-emerald-400" />
            <span>Subdivision Builder</span>
          </button>

          {slots.length > 0 && onClearAllLots && (
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to clear all lots from the masterplan? This will reset the parcel grid to an empty slate.')) {
                  onClearAllLots();
                  setSelectedSlot(null);
                }
              }}
              className="flex items-center gap-1 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-semibold px-3 py-2 rounded-xl transition-all cursor-pointer"
              title="Clear all lots and reset to blank masterplan"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Masterplan</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Studio View: Vector Canvas + Lot Details Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Vector Canvas Container (9 cols) */}
        <div className="lg:col-span-8 xl:col-span-9 bg-slate-950 border border-slate-800 rounded-3xl p-4 relative overflow-hidden flex flex-col justify-between shadow-2xl min-h-[580px]">
          {/* Canvas Viewport Controls Overlay */}
          <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2">
            <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-1 flex items-center gap-1 shadow-lg">
              <button
                onClick={() => setZoomLevel((z) => Math.min(z + 0.2, 3))}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono text-slate-300 px-1 font-semibold">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.max(z - 0.2, 0.4))}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setZoomLevel(1); setPanOffset({ x: 0, y: 0 }); }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                title="Reset View"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Pills */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
            >
              <option value="ALL">All Lot States ({slots.length})</option>
              <option value="Available">Available</option>
              <option value="Reserved">Reserved</option>
              <option value="Under Contract">Under Contract</option>
              <option value="Developing">Developing</option>
              <option value="Titling Phase">Titling Phase</option>
              <option value="Turnover Ready">Turnover Ready</option>
              <option value="Handed Over">Handed Over / Sold</option>
            </select>
          </div>

          {/* Layer Controls (Top Right Overlay) */}
          <div className="absolute top-4 right-4 z-20 flex items-center gap-1 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-1 text-[11px] text-slate-400 font-semibold shadow-lg">
            <button
              onClick={() => setIsLayerVisible((l) => ({ ...l, grid: !l.grid }))}
              className={`px-2 py-1 rounded-lg transition-colors ${isLayerVisible.grid ? 'bg-slate-800 text-white' : 'text-slate-500'}`}
            >
              Grid
            </button>
            <button
              onClick={() => setIsLayerVisible((l) => ({ ...l, labels: !l.labels }))}
              className={`px-2 py-1 rounded-lg transition-colors ${isLayerVisible.labels ? 'bg-slate-800 text-white' : 'text-slate-500'}`}
            >
              Labels
            </button>
            <button
              onClick={() => setIsLayerVisible((l) => ({ ...l, roads: !l.roads }))}
              className={`px-2 py-1 rounded-lg transition-colors ${isLayerVisible.roads ? 'bg-slate-800 text-white' : 'text-slate-500'}`}
            >
              Spine Road
            </button>
          </div>

          {/* Interactive Vector SVG Canvas */}
          {slots.length > 0 ? (
            <div 
              className="w-full h-[540px] cursor-grab active:cursor-grabbing flex items-center justify-center select-none overflow-hidden"
              onMouseDown={(e) => {
                setIsDragging(true);
                setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
              }}
              onMouseMove={(e) => {
                if (isDragging) {
                  setPanOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
                }
              }}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
              onWheel={(e) => {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 0.1 : -0.1;
                setZoomLevel((z) => Math.min(Math.max(z + delta, 0.3), 3.5));
              }}
            >
              <svg
                viewBox={mapBoundingBox.viewBox}
                className="w-full h-full transition-transform duration-75"
                style={{
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                  transformOrigin: 'center center',
                }}
              >
                {/* Background Blueprint Grid */}
                {isLayerVisible.grid && (
                  <defs>
                    <pattern id="cadGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(51, 65, 85, 0.25)" strokeWidth="0.75" />
                    </pattern>
                  </defs>
                )}
                {isLayerVisible.grid && (
                  <rect 
                    x={mapBoundingBox.minX} 
                    y={mapBoundingBox.minY} 
                    width={mapBoundingBox.width} 
                    height={mapBoundingBox.height} 
                    fill="url(#cadGrid)" 
                  />
                )}

                {/* Road Network & Spine */}
                {isLayerVisible.roads && (
                  <g className="roads-layer">
                    <rect 
                      x={mapBoundingBox.roadX} 
                      y={mapBoundingBox.roadY} 
                      width={mapBoundingBox.roadWidth} 
                      height="45" 
                      fill="rgba(30, 41, 59, 0.6)" 
                      stroke="#475569" 
                      strokeDasharray="6 4" 
                      rx="6" 
                    />
                    <text 
                      x={mapBoundingBox.minX + mapBoundingBox.width / 2} 
                      y={mapBoundingBox.roadY + 28} 
                      fill="#94a3b8" 
                      fontSize="12" 
                      fontFamily="monospace" 
                      fontWeight="bold" 
                      textAnchor="middle"
                    >
                      === 6.5M CONCRETE SPINE ROAD NETWORK (PHASE 1 CAVINTI) ===
                    </text>
                  </g>
                )}

                {/* Subdivided Lot Polygons */}
                <g className="lots-layer">
                  {filteredSlots.map((slot, idx) => {
                    const isSelected = selectedSlot?.id === slot.id;
                    const pointsStr = getPolygonPointsString(slot, idx);
                    const style = getStatusFill(slot.status, isSelected);

                    // Compute approximate centroid for label placement
                    const pts = pointsStr.split(' ').map((p) => {
                      const [x, y] = p.split(',').map(Number);
                      return { x, y };
                    });
                    const cx = pts.reduce((sum, p) => sum + p.x, 0) / (pts.length || 1);
                    const cy = pts.reduce((sum, p) => sum + p.y, 0) / (pts.length || 1);

                    return (
                      <g 
                        key={slot.id} 
                        className="cursor-pointer transition-all group"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSlot(slot);
                          setAssignmentClientId(slot.assignedClientId || '');
                        }}
                      >
                        {/* Lot Boundary Polygon */}
                        <polygon
                          points={pointsStr}
                          fill={style.fill}
                          stroke={style.stroke}
                          strokeWidth={style.strokeWidth}
                          className="transition-all hover:opacity-80"
                        />

                        {/* Lot Labels & Dimensions */}
                        {isLayerVisible.labels && (
                          <g pointerEvents="none">
                            <text
                              x={cx}
                              y={cy - 8}
                              fill="#ffffff"
                              fontSize="12"
                              fontFamily="sans-serif"
                              fontWeight="bold"
                              textAnchor="middle"
                            >
                              Lot {slot.slotNumber}
                            </text>
                            <text
                              x={cx}
                              y={cy + 8}
                              fill="#10b981"
                              fontSize="10"
                              fontFamily="monospace"
                              fontWeight="bold"
                              textAnchor="middle"
                            >
                              {slot.areaSqm} sqm
                            </text>
                            <text
                              x={cx}
                              y={cy + 22}
                              fill="#94a3b8"
                              fontSize="9"
                              fontFamily="monospace"
                              textAnchor="middle"
                            >
                              ₱{Number(slot.basePrice).toLocaleString()}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>
          ) : (
            /* Clean Empty Slate / Masterplan Onboarding */
            <div className="h-[520px] flex flex-col items-center justify-center text-center p-8 space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 shadow-xl">
                <Compass className="w-8 h-8 animate-pulse" />
              </div>

              <div className="max-w-md space-y-1">
                <h3 className="text-base font-bold text-white">
                  Masterplan Canvas is Clean (0 Sample Lots)
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Upload your real AutoCAD (.dxf / .dwg / GeoJSON) survey file or use the built-in Subdivision Studio to generate and interpret property lots.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-950 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload AutoCAD File</span>
                </button>

                <button
                  onClick={handleLoadSampleCAD}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-950 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Load Sample DXF Masterplan</span>
                </button>

                <button
                  onClick={() => setIsSubdivideModalOpen(true)}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-700 transition-all cursor-pointer"
                >
                  <Grid className="w-4 h-4 text-emerald-400" />
                  <span>Subdivision Builder</span>
                </button>
              </div>
            </div>
          )}

          {/* Bottom Legend */}
          <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500" />
                <span>Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500" />
                <span>Reserved</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-blue-500/20 border border-blue-500" />
                <span>Under Contract</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-teal-500/20 border border-teal-500" />
                <span>Turnover Ready</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-slate-500/20 border border-slate-500" />
                <span>Handed Over</span>
              </div>
            </div>

            <span className="font-mono text-[10px] text-slate-500">
              Interactive Zoom: Scroll or Click +/- • Pan: Click & Drag
            </span>
          </div>
        </div>

        {/* Lot Inspector Sidebar (4 cols) */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-4">
          {selectedSlot ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase block">
                    {selectedSlot.blockName || 'Cavinti Phase 1'}
                  </span>
                  <h3 className="text-base font-bold text-white">
                    Lot {selectedSlot.slotNumber} Inspector
                  </h3>
                </div>
                <span className="bg-slate-950 font-mono text-xs px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300 font-bold">
                  {selectedSlot.id}
                </span>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-mono block">AREA (SQM)</span>
                  <strong className="text-white text-sm">{selectedSlot.areaSqm} m²</strong>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-mono block">CONTRACT PRICE</span>
                  <strong className="text-emerald-400 text-sm">₱{Number(selectedSlot.basePrice).toLocaleString()}</strong>
                </div>
              </div>

              {/* AI LOT COST & VALUATION CARD */}
              {selectedSlotValuation && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                      <Bot className="w-4 h-4 text-purple-400" />
                      <span>AI Lot Cost & Price Suggestion</span>
                    </div>
                    <span className="bg-purple-900/60 border border-purple-700 text-purple-200 font-mono text-[10px] px-2 py-0.5 rounded font-bold">
                      {selectedSlotValuation.confidenceScore}% Confidence
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-950/80 p-2 rounded-lg border border-purple-900/40">
                      <span className="text-[9px] text-slate-400 font-mono block">BREAK-EVEN COGS</span>
                      <strong className="text-white font-mono text-xs">₱{selectedSlotValuation.breakEvenCost.toLocaleString()}</strong>
                      <span className="text-[9px] text-slate-500 block font-mono">₱{selectedSlotValuation.breakEvenPricePerSqm}/sqm</span>
                    </div>
                    <div className="bg-slate-950/80 p-2 rounded-lg border border-purple-900/40">
                      <span className="text-[9px] text-purple-400 font-mono block font-bold">AI SUGGESTED PRICE</span>
                      <strong className="text-emerald-400 font-mono text-xs">₱{selectedSlotValuation.suggestedBasePrice.toLocaleString()}</strong>
                      <span className="text-[9px] text-emerald-500 block font-mono">₱{selectedSlotValuation.suggestedPricePerSqm}/sqm</span>
                    </div>
                  </div>

                  {/* Drivers / Tags */}
                  <div className="flex flex-wrap gap-1">
                    {selectedSlotValuation.premiums.cornerLot && (
                      <span className="bg-amber-950/80 border border-amber-700 text-amber-300 text-[9px] font-mono px-1.5 py-0.5 rounded font-bold">
                        ★ Corner Plot (+12%)
                      </span>
                    )}
                    {selectedSlotValuation.premiums.frontageAccess && (
                      <span className="bg-blue-950/80 border border-blue-700 text-blue-300 text-[9px] font-mono px-1.5 py-0.5 rounded font-bold">
                        🛣️ Main Spine Road (+8%)
                      </span>
                    )}
                    {selectedSlotValuation.premiums.scenicOrientation && (
                      <span className="bg-purple-950/80 border border-purple-700 text-purple-300 text-[9px] font-mono px-1.5 py-0.5 rounded font-bold">
                        ⛰️ Scenic Ridge (+6%)
                      </span>
                    )}
                    <span className="bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-[9px] font-mono px-1.5 py-0.5 rounded font-bold">
                      +{selectedSlotValuation.profitMarginPercent}% Margin
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-300 leading-tight italic">
                    "{selectedSlotValuation.aiRationale}"
                  </p>

                  <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400 font-mono border-t border-purple-900/40">
                    <span>36m Amort: <strong>₱{selectedSlotValuation.monthlyInstallment36m.toLocaleString()}/mo</strong></span>
                    <span>Spot Cash: <strong>₱{selectedSlotValuation.cashDiscountPrice.toLocaleString()}</strong></span>
                  </div>

                  {/* 1-Click Update this lot to AI Suggested Price */}
                  {selectedSlot.basePrice !== selectedSlotValuation.suggestedBasePrice && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await fetch('/api/slots/apply-ai-pricing', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              updates: [{ slotId: selectedSlot.id, newBasePrice: selectedSlotValuation.suggestedBasePrice }],
                              parcelId: parcel?.id || 'PARCEL-CST',
                              targetMargin: aiTargetMargin,
                            })
                          });
                          selectedSlot.basePrice = selectedSlotValuation.suggestedBasePrice;
                          alert(`Updated Lot ${selectedSlot.slotNumber} price to ₱${selectedSlotValuation.suggestedBasePrice.toLocaleString()}`);
                        } catch (e) {
                          console.error(e);
                        }
                      }}
                      className="w-full py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>Set to AI Suggested Price (₱{selectedSlotValuation.suggestedBasePrice.toLocaleString()})</span>
                    </button>
                  )}
                </div>
              )}

              {/* Status Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Lot Lifecycle State
                </label>
                <select
                  value={selectedSlot.status}
                  onChange={(e) => onTransitionSlotStatus(selectedSlot.id, e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-semibold"
                >
                  <option value="Available">Available (Unassigned)</option>
                  <option value="Reserved">Reserved (Holding Fee Paid)</option>
                  <option value="Under Contract">Under Contract (CTS Signed)</option>
                  <option value="Developing">Developing (Earthworks)</option>
                  <option value="Titling Phase">Titling Phase (BIR / Registry)</option>
                  <option value="Turnover Ready">Turnover Ready (Inspected)</option>
                  <option value="Handed Over">Handed Over (Certificate Signed)</option>
                </select>
              </div>

              {/* Client Assignment */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="block text-xs font-semibold text-slate-300">
                  Assign to Registered Buyer
                </label>
                <select
                  value={assignmentClientId}
                  onChange={(e) => setAssignmentClientId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="">-- No Buyer Assigned --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => onAssignClient(selectedSlot.id, assignmentClientId)}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 rounded-xl transition-all shadow-md shadow-emerald-950 cursor-pointer"
                >
                  Bind Buyer to Lot
                </button>
              </div>

              {selectedSlot.assignedClientId && (
                <div className="bg-emerald-950/40 border border-emerald-800/80 rounded-xl p-3 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Occupied by Buyer</span>
                  </div>
                  <div className="text-slate-300">
                    Client ID: <strong className="text-white">{selectedSlot.assignedClientId}</strong>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center text-slate-500 space-y-2">
              <MapPin className="w-8 h-8 text-slate-600 mx-auto" />
              <h4 className="text-xs font-bold text-slate-300">No Lot Selected</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Click any lot on the AutoCAD masterplan to inspect dimensions, transition lifecycle state, or view AI cost & pricing suggestion.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Subdivision Studio Modal */}
      {isSubdivideModalOpen && (
        <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Grid className="w-5 h-5 text-emerald-400" />
                Subdivision Grid & Masterplan Builder
              </h3>
              <button
                onClick={() => setIsSubdivideModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerateCustomSubdivision} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Block / Phase Name</label>
                <input
                  type="text"
                  required
                  value={subdivideBlockName}
                  onChange={(e) => setSubdivideBlockName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Total Planned Lots</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={subdivideLotCount}
                    onChange={(e) => setSubdivideLotCount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Lot Size (sqm)</label>
                  <input
                    type="number"
                    value={subdivideLotArea}
                    onChange={(e) => setSubdivideLotArea(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Standard Base Price per Lot (₱)</label>
                <input
                  type="number"
                  value={subdivideBasePrice}
                  onChange={(e) => setSubdivideBasePrice(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSubdivideModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-950 cursor-pointer"
                >
                  Generate Lots
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* AI LOT PRICING & EXPENSE VALUATION OPTIMIZER MODAL */}
      {/* ============================================================= */}
      {isAIPricingModalOpen && (
        <div className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fadeIn">
          <div className="fixed inset-0 cursor-pointer" onClick={() => setIsAIPricingModalOpen(false)} />
          <div className="relative z-10 w-full max-w-5xl bg-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 my-auto max-h-[92vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="shrink-0 flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-950/80 border border-purple-700 flex items-center justify-center text-purple-400 shadow-lg shadow-purple-950/50">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">AI Lot Cost & Pricing Feasibility Studio</h3>
                    <span className="bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase">
                      Actuarial COGS Model
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Real-time AI pricing engine that aggregates acquisition costs, civil engineering works, labor, permitting, and topological multipliers.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsAIPricingModalOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-900 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="overflow-y-auto pr-1 space-y-6 text-xs">
              
              {/* Financial Feasibility Executive KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-1">
                  <span className="text-[10px] font-mono font-bold text-slate-400 block uppercase">TOTAL PROJECT OUTLAY</span>
                  <strong className="text-white font-mono text-base block">₱{aiFeasibility.totalProjectOutlay.toLocaleString()}</strong>
                  <span className="text-[10px] text-slate-500">All Expenses + Buffer</span>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-1">
                  <span className="text-[10px] font-mono font-bold text-amber-400 block uppercase">BREAK-EVEN / SQM</span>
                  <strong className="text-amber-300 font-mono text-base block">₱{aiFeasibility.baselineCostPerSqm.toFixed(2)}</strong>
                  <span className="text-[10px] text-slate-500">Min. Cost of Goods</span>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-1">
                  <span className="text-[10px] font-mono font-bold text-blue-400 block uppercase">AVG. TARGET PRICE / SQM</span>
                  <strong className="text-blue-300 font-mono text-base block">₱{aiFeasibility.averageSuggestedPricePerSqm.toFixed(2)}</strong>
                  <span className="text-[10px] text-slate-500">Weighted Average</span>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-1">
                  <span className="text-[10px] font-mono font-bold text-emerald-400 block uppercase">PROJECTED GROSS SALES</span>
                  <strong className="text-emerald-300 font-mono text-base block">₱{aiFeasibility.totalProjectedGrossRevenue.toLocaleString()}</strong>
                  <span className="text-[10px] text-slate-500">{aiFeasibility.lotsEvaluated} Lots Inventory</span>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-1">
                  <span className="text-[10px] font-mono font-bold text-teal-400 block uppercase">PROJECTED NET PROFIT</span>
                  <strong className="text-teal-300 font-mono text-base block">₱{aiFeasibility.totalProjectedNetProfit.toLocaleString()}</strong>
                  <span className="text-[10px] text-teal-500">After All Expenses</span>
                </div>

                <div className="bg-slate-900/90 border border-purple-800/80 bg-purple-950/20 rounded-2xl p-3.5 space-y-1">
                  <span className="text-[10px] font-mono font-bold text-purple-300 block uppercase">PROJECTED ROI %</span>
                  <strong className="text-purple-300 font-mono text-base block">{aiFeasibility.projectedROI}%</strong>
                  <span className="text-[10px] text-purple-400 font-bold">Target Margin: {aiTargetMargin}%</span>
                </div>
              </div>

              {/* Interactive Cost Adjustment Controls & Margin Sliders */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="font-bold text-white text-xs flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-blue-400" />
                    Interactive Cost Drivers & Target Margin Controls
                  </h4>
                  <span className="text-[11px] text-slate-400">Values update AI prices dynamically</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Land Acquisition Cost (₱)
                    </label>
                    <input
                      type="number"
                      value={aiAcquisitionCost}
                      onChange={(e) => setAiAcquisitionCost(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Civil Works Infrastructure (₱)
                    </label>
                    <input
                      type="number"
                      value={aiCivilCost}
                      onChange={(e) => setAiCivilCost(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Contractor Labor & Payroll (₱)
                    </label>
                    <input
                      type="number"
                      value={aiLaborCost}
                      onChange={(e) => setAiLaborCost(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Regulatory & Permitting Overhead (₱)
                    </label>
                    <input
                      type="number"
                      value={aiOverheadCost}
                      onChange={(e) => setAiOverheadCost(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Sliders: Target Profit Margin & Contingency */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-slate-300 text-xs">
                        Target Developer Profit Margin: <strong className="text-emerald-400 font-mono text-sm">{aiTargetMargin}%</strong>
                      </label>
                      <span className="text-[10px] text-slate-500 font-mono">Range: 15% - 60%</span>
                    </div>
                    <input
                      type="range"
                      min={15}
                      max={60}
                      step={1}
                      value={aiTargetMargin}
                      onChange={(e) => setAiTargetMargin(Number(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-slate-300 text-xs">
                        Contingency / Safety Buffer: <strong className="text-purple-400 font-mono text-sm">{aiContingency}%</strong> (₱{aiFeasibility.totalContingencyCost.toLocaleString()})
                      </label>
                      <span className="text-[10px] text-slate-500 font-mono">Range: 3% - 15%</span>
                    </div>
                    <input
                      type="range"
                      min={3}
                      max={15}
                      step={1}
                      value={aiContingency}
                      onChange={(e) => setAiContingency(Number(e.target.value))}
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Natural Language AI Executive Summary */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-white text-xs">AI Actuarial Recommendation Summary</h4>
                  <p className="text-slate-300 text-xs leading-relaxed">
                    {aiFeasibility.aiExecutiveSummary}
                  </p>
                </div>
              </div>

              {/* Table of Lots with AI Valuation Breakdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-xs flex items-center gap-2">
                    <Grid className="w-4 h-4 text-emerald-400" />
                    Subdivided Lot Inventory Valuation Breakdown ({aiFeasibility.lotValuations.length} Lots)
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Sorted by Lot ID
                  </span>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-900 text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800">
                        <tr>
                          <th className="px-4 py-3">Lot ID & Number</th>
                          <th className="px-4 py-3">Area (sqm)</th>
                          <th className="px-4 py-3">Break-Even COGS</th>
                          <th className="px-4 py-3">AI Multiplier Drivers</th>
                          <th className="px-4 py-3">AI Suggested TCP</th>
                          <th className="px-4 py-3">Price / sqm</th>
                          <th className="px-4 py-3">Projected Net Profit</th>
                          <th className="px-4 py-3">36-Mo. Amortization</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {aiFeasibility.lotValuations.map((val) => (
                          <tr key={val.slotId} className="hover:bg-slate-900/60 transition-colors">
                            <td className="px-4 py-3 font-bold text-white font-mono">
                              {val.slotId}
                            </td>
                            <td className="px-4 py-3 font-mono">
                              {val.areaSqm} sqm
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-400">
                              ₱{val.breakEvenCost.toLocaleString()}
                              <span className="block text-[10px] text-slate-500">₱{val.breakEvenPricePerSqm}/sqm</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {val.premiums.cornerLot && (
                                  <span className="bg-amber-950 text-amber-300 border border-amber-800 text-[9px] font-mono px-1.5 py-0.5 rounded font-bold">
                                    Corner (+12%)
                                  </span>
                                )}
                                {val.premiums.frontageAccess && (
                                  <span className="bg-blue-950 text-blue-300 border border-blue-800 text-[9px] font-mono px-1.5 py-0.5 rounded font-bold">
                                    Spine Road (+8%)
                                  </span>
                                )}
                                {val.premiums.scenicOrientation && (
                                  <span className="bg-purple-950 text-purple-300 border border-purple-800 text-[9px] font-mono px-1.5 py-0.5 rounded font-bold">
                                    Vista (+6%)
                                  </span>
                                )}
                                {!val.premiums.cornerLot && !val.premiums.frontageAccess && !val.premiums.scenicOrientation && (
                                  <span className="bg-slate-800 text-slate-400 text-[9px] font-mono px-1.5 py-0.5 rounded">
                                    Standard Interior
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono font-bold text-emerald-400">
                              ₱{val.suggestedBasePrice.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-300">
                              ₱{val.suggestedPricePerSqm.toLocaleString()}/sqm
                            </td>
                            <td className="px-4 py-3 font-mono text-teal-400 font-bold">
                              +₱{val.grossProfit.toLocaleString()} ({val.profitMarginPercent}%)
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-400">
                              ₱{val.monthlyInstallment36m.toLocaleString()}/mo
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {pricingNotice && (
                <div className="p-3 bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs rounded-xl font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{pricingNotice}</span>
                </div>
              )}

            </div>

            {/* Modal Sticky Footer */}
            <div className="shrink-0 pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400 font-mono">
                Model: <strong>Actuarial Real Estate COGS v2.1</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAIPricingModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Close Studio
                </button>

                <button
                  type="button"
                  disabled={isApplyingPricing || aiFeasibility.lotValuations.length === 0}
                  onClick={handleApplyAllAIPrices}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
                >
                  {isApplyingPricing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Applying Pricing to Database...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Apply AI Pricing to All {aiFeasibility.lotValuations.length} Lots</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

