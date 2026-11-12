/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calculator, Building2, User, MapPin, Plus, Trash2, ChevronDown, ChevronRight,
  Printer, RefreshCw, Check, Sparkles, Layers, FileSpreadsheet, ArrowRight,
  Download, Eye, EyeOff, Save, CheckCircle2, AlertCircle, Share2
} from 'lucide-react';
import { ProjectProfile } from '../types';
import { openEnterprisePrintWindow, escapePrintHtml } from '../utils/printEngine';
import { exportToCsv } from '../utils/exportUtils';
import { useTheme } from '../context/ThemeContext';
import { GANTT_TASKS_STORAGE_PREFIX, GANTT_TASKS_UPDATED_EVENT } from '../utils/ganttProgress';
import { logAuditEvent } from '../utils/auditLogger';

export type BomUnit = 'pcs' | 'days' | 'lot' | 'cu.m.' | 'sq.m.' | 'bags' | 'kg' | 'bd.ft.' | 'l.m.' | 'sets' | 'rolls' | 'sheets' | 'lengths';

export interface BomLineItem {
  id: string;
  scopeOfWork: string;
  noOfUnits: number;
  unit: BomUnit | string;
  unitCost: number;
  profitPct: number;      // e.g. 20 for 20%
  overheadPct: number;    // e.g. 5 for 5%
  designCost: number;     // e.g. 0 or specific design fee
}

export interface BomSubPhase {
  id: string;
  title: string;
  items: BomLineItem[];
}

export interface BomPhase {
  id: string;
  code: string;           // e.g. "A", "B", "C"
  title: string;          // e.g. "EARTHWORKS"
  defaultProfitPct: number;
  defaultOverheadPct: number;
  subPhases: BomSubPhase[];
  isExpanded?: boolean;
}

export type ProjectTypology =
  | '2-Storey Residential Unit'
  | '1-Storey / Bungalow'
  | 'Renovation / Fit-Out'
  | 'Demolition / Excavation'
  | 'Commercial Building';

export const STANDARD_BOM_PHASES_TEMPLATE: Omit<BomPhase, 'id' | 'subPhases'>[] = [
  { code: 'A', title: 'GENERAL REQUIREMENTS', defaultProfitPct: 15, defaultOverheadPct: 5 },
  { code: 'B', title: 'EARTHWORKS', defaultProfitPct: 20, defaultOverheadPct: 5 },
  { code: 'C', title: 'CONCRETE WORKS', defaultProfitPct: 20, defaultOverheadPct: 5 },
  { code: 'D', title: 'REINFORCING BAR', defaultProfitPct: 20, defaultOverheadPct: 5 },
  { code: 'E', title: 'FORMWORKS', defaultProfitPct: 20, defaultOverheadPct: 5 },
  { code: 'F', title: 'MASONRY WORKS', defaultProfitPct: 20, defaultOverheadPct: 5 },
  { code: 'G', title: 'ROOF WORKS', defaultProfitPct: 20, defaultOverheadPct: 5 },
  { code: 'H', title: 'FINISHING / TILING WORKS', defaultProfitPct: 20, defaultOverheadPct: 5 },
  { code: 'I', title: 'CEILING WORKS', defaultProfitPct: 20, defaultOverheadPct: 5 },
  { code: 'J', title: 'PAINTING WORKS', defaultProfitPct: 20, defaultOverheadPct: 5 },
  { code: 'K', title: 'DOORS AND WINDOWS', defaultProfitPct: 20, defaultOverheadPct: 5 },
  { code: 'L', title: 'CABINET WORKS', defaultProfitPct: 20, defaultOverheadPct: 5 },
  { code: 'M', title: 'ELECTRICAL WORKS', defaultProfitPct: 20, defaultOverheadPct: 5 },
  { code: 'N', title: 'PLUMBING WORKS', defaultProfitPct: 20, defaultOverheadPct: 5 },
  { code: 'O', title: 'FENCING WORKS', defaultProfitPct: 20, defaultOverheadPct: 5 },
];

export const OPTIONAL_BOM_PHASES: Omit<BomPhase, 'id' | 'subPhases'>[] = [
  { code: 'P', title: 'GARAGE WORKS', defaultProfitPct: 20, defaultOverheadPct: 5 },
  { code: 'Q', title: 'BALCONY', defaultProfitPct: 20, defaultOverheadPct: 5 },
  { code: 'R', title: 'OFFICE AREA', defaultProfitPct: 20, defaultOverheadPct: 5 },
];

// Generates default pre-populated engineering data based on Santos-New-Estimate
export function generateDefaultBomPhases(typology: ProjectTypology): BomPhase[] {
  const isRenovation = typology === 'Renovation / Fit-Out';
  const isDemolition = typology === 'Demolition / Excavation';

  return STANDARD_BOM_PHASES_TEMPLATE.map((tpl, pIdx) => {
    const pId = `phase-${tpl.code.toLowerCase()}-${Date.now()}-${pIdx}`;
    let subPhases: BomSubPhase[] = [];

    if (tpl.code === 'A') {
      subPhases = [
        {
          id: `sub-${tpl.code}-1`,
          title: 'Mobilization & Statutory Permits',
          items: [
            { id: `item-a-1`, scopeOfWork: 'Mobilization & Demobilization of Tools and Equipment', noOfUnits: 1, unit: 'lot', unitCost: 35000, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-a-2`, scopeOfWork: 'Building Permit Processing, Structural Sign-offs & Blueprints', noOfUnits: 1, unit: 'lot', unitCost: 45000, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 15000 },
            { id: `item-a-3`, scopeOfWork: 'Temporary Facilities, Power & Water Tapping, Jobsite Billboard', noOfUnits: 1, unit: 'lot', unitCost: 28000, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 }
          ]
        }
      ];
    } else if (tpl.code === 'B') {
      subPhases = [
        {
          id: `sub-${tpl.code}-1`,
          title: 'Site Clearing & Layout',
          items: [
            { id: `item-b-1`, scopeOfWork: 'Site Clearing, Grubbing & Topsoil Stripping', noOfUnits: isDemolition ? 350 : 180, unit: 'sq.m.', unitCost: 65, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-b-2`, scopeOfWork: 'Batterboard Installation, Staking & Leveling (2"x2"x8\' Lumber, Nails)', noOfUnits: 1, unit: 'lot', unitCost: 14500, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
          ]
        },
        {
          id: `sub-${tpl.code}-2`,
          title: 'Excavation & Earth Preparation',
          items: [
            { id: `item-b-3`, scopeOfWork: 'Structural Excavation for Footings & Tie Beams', noOfUnits: isRenovation ? 15 : 68, unit: 'cu.m.', unitCost: 450, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-b-4`, scopeOfWork: 'Backfill, Compaction & Sub-grade Preparation', noOfUnits: isRenovation ? 10 : 42, unit: 'cu.m.', unitCost: 380, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-b-5`, scopeOfWork: 'Gravel Bedding (G-1 Gravel Bedding 50mm thk)', noOfUnits: isRenovation ? 5 : 18, unit: 'cu.m.', unitCost: 1650, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 }
          ]
        }
      ];
    } else if (tpl.code === 'C') {
      subPhases = [
        {
          id: `sub-${tpl.code}-1`,
          title: 'Structural Concrete Pouring (Class A 3,000 PSI)',
          items: [
            { id: `item-c-1`, scopeOfWork: 'Column Footings & Wall Footings Concrete Pouring', noOfUnits: 18, unit: 'cu.m.', unitCost: 5800, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-c-2`, scopeOfWork: 'Ground Floor Slab & Tie Beams (3,000 PSI)', noOfUnits: 24, unit: 'cu.m.', unitCost: 5900, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-c-3`, scopeOfWork: 'Second Floor Suspended Slab & Roof Beams', noOfUnits: 22, unit: 'cu.m.', unitCost: 6100, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 }
          ]
        }
      ];
    } else if (tpl.code === 'D') {
      subPhases = [
        {
          id: `sub-${tpl.code}-1`,
          title: 'Reinforcing Steel Bars (Grade 40/60)',
          items: [
            { id: `item-d-1`, scopeOfWork: 'Deformed Reinforcing Steel Bars 16mm Dia. x 6.0m (Footings & Columns)', noOfUnits: 180, unit: 'lengths', unitCost: 485, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-d-2`, scopeOfWork: 'Deformed Reinforcing Steel Bars 12mm Dia. x 6.0m (Beams & Slabs)', noOfUnits: 240, unit: 'lengths', unitCost: 285, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-d-3`, scopeOfWork: 'Deformed Reinforcing Steel Bars 10mm Dia. x 6.0m (Stirrups & Ties)', noOfUnits: 320, unit: 'lengths', unitCost: 195, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-d-4`, scopeOfWork: '#16 G.I. Tie Wire (35kg/roll)', noOfUnits: 6, unit: 'rolls', unitCost: 2850, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 }
          ]
        }
      ];
    } else if (tpl.code === 'E') {
      subPhases = [
        {
          id: `sub-${tpl.code}-1`,
          title: 'Formworks & Shoring Systems',
          items: [
            { id: `item-e-1`, scopeOfWork: 'Phenolic Board 1/2" x 4\' x 8\' (High-Reuse Form Face)', noOfUnits: 45, unit: 'sheets', unitCost: 1150, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-e-2`, scopeOfWork: 'Good Lumber Framing (2"x3" & 2"x4" Coco Lumber)', noOfUnits: 1450, unit: 'bd.ft.', unitCost: 32, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-e-3`, scopeOfWork: 'Assorted Common Wire Nails (CWN 2", 3", 4")', noOfUnits: 80, unit: 'kg', unitCost: 85, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-e-4`, scopeOfWork: 'Adjustable Steel Props & Scaffolding Rental System', noOfUnits: 1, unit: 'lot', unitCost: 35000, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 }
          ]
        }
      ];
    } else if (tpl.code === 'F') {
      subPhases = [
        {
          id: `sub-${tpl.code}-1`,
          title: 'Concrete Hollow Block (CHB) Laying & Plastering',
          items: [
            { id: `item-f-1`, scopeOfWork: '6" CHB for Exterior Perimeter & Load-Bearing Walls', noOfUnits: 2200, unit: 'pcs', unitCost: 22, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-f-2`, scopeOfWork: '4" CHB for Interior Partitions', noOfUnits: 1800, unit: 'pcs', unitCost: 18, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-f-3`, scopeOfWork: 'Portland Cement (Type 1 - 40kg Bags)', noOfUnits: 250, unit: 'bags', unitCost: 270, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-f-4`, scopeOfWork: 'Screened Sand (Fine Washed White/River Sand)', noOfUnits: 28, unit: 'cu.m.', unitCost: 1400, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-f-5`, scopeOfWork: 'Plain Cement Plaster Finish with Skim Coat Preparation', noOfUnits: 550, unit: 'sq.m.', unitCost: 120, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 }
          ]
        }
      ];
    } else if (tpl.code === 'G') {
      subPhases = [
        {
          id: `sub-${tpl.code}-1`,
          title: 'Roof Framing & Pre-Painted Long Span Roofing',
          items: [
            { id: `item-g-1`, scopeOfWork: 'Structural Steel C-Purlins & Angle Bars (Welded Roof Trusses)', noOfUnits: 1, unit: 'lot', unitCost: 85000, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-g-2`, scopeOfWork: 'Rib-Type Pre-painted Roofing Sheet 0.50mm thk', noOfUnits: 140, unit: 'sq.m.', unitCost: 620, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-g-3`, scopeOfWork: 'Double-Sided Aluminum Foil Roof Thermal Insulation', noOfUnits: 140, unit: 'sq.m.', unitCost: 110, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-g-4`, scopeOfWork: 'Spanish Gutter, Ridge Roll & Flashing Details', noOfUnits: 48, unit: 'l.m.', unitCost: 450, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 }
          ]
        }
      ];
    } else if (tpl.code === 'H') {
      subPhases = [
        {
          id: `sub-${tpl.code}-1`,
          title: 'Flooring & Wall Tiling Works',
          items: [
            { id: `item-h-1`, scopeOfWork: '60cm x 60cm Glazed Porcelain Floor Tiles (Living, Dining, Kitchen)', noOfUnits: 110, unit: 'sq.m.', unitCost: 750, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-h-2`, scopeOfWork: '30cm x 60cm Non-Skid Ceramic Floor & Wall Tiles (Bathrooms)', noOfUnits: 45, unit: 'sq.m.', unitCost: 650, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-h-3`, scopeOfWork: 'Heavy Duty Tile Adhesive & Water-Resistant Tile Grout', noOfUnits: 25, unit: 'bags', unitCost: 380, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 }
          ]
        }
      ];
    } else if (tpl.code === 'I') {
      subPhases = [
        {
          id: `sub-${tpl.code}-1`,
          title: 'Ceiling Framing & Board Installation',
          items: [
            { id: `item-i-1`, scopeOfWork: '9mm Moisture-Resistant Gypsum Board on Metal Furring (Drop Ceiling)', noOfUnits: 120, unit: 'sq.m.', unitCost: 520, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-i-2`, scopeOfWork: 'Fiber Cement Board 4.5mm (Eaves & Toilet Ceilings)', noOfUnits: 35, unit: 'sq.m.', unitCost: 480, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 }
          ]
        }
      ];
    } else if (tpl.code === 'J') {
      subPhases = [
        {
          id: `sub-${tpl.code}-1`,
          title: 'Architectural Painting (3-Coat Premium System)',
          items: [
            { id: `item-j-1`, scopeOfWork: 'Exterior Concrete Primer & Permacoat Latex Paint (3 Coats)', noOfUnits: 350, unit: 'sq.m.', unitCost: 195, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-j-2`, scopeOfWork: 'Interior Wall Semi-Gloss Low-VOC Latex Finish with Full Skim Coat', noOfUnits: 420, unit: 'sq.m.', unitCost: 185, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-j-3`, scopeOfWork: 'Ceiling Flat Latex Coating System', noOfUnits: 155, unit: 'sq.m.', unitCost: 165, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 }
          ]
        }
      ];
    } else if (tpl.code === 'K') {
      subPhases = [
        {
          id: `sub-${tpl.code}-1`,
          title: 'Custom Doors, Jambs & Tempered Glass Windows',
          items: [
            { id: `item-k-1`, scopeOfWork: 'Main Entry Solid Wood Panel Door with Heavy Duty Smart Lockset', noOfUnits: 1, unit: 'sets', unitCost: 28500, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-k-2`, scopeOfWork: 'Molded Bedroom Doors with Stainless Lever Handles', noOfUnits: 4, unit: 'sets', unitCost: 6500, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-k-3`, scopeOfWork: 'Powder-Coated Aluminum Sliding Glass Windows (6mm Tempered)', noOfUnits: 1, unit: 'lot', unitCost: 95000, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 }
          ]
        }
      ];
    } else if (tpl.code === 'L') {
      subPhases = [
        {
          id: `sub-${tpl.code}-1`,
          title: 'Modular Cabinetry & Countertops',
          items: [
            { id: `item-l-1`, scopeOfWork: 'Modular Kitchen Base & Overhead Cabinets (Marine Plywood / HPL)', noOfUnits: 6.5, unit: 'l.m.', unitCost: 9500, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-l-2`, scopeOfWork: 'Natural Granite / Quartz Kitchen Countertop & Splashboard', noOfUnits: 6.5, unit: 'l.m.', unitCost: 6800, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-l-3`, scopeOfWork: 'Master Bedroom Built-in Wardrobe Closet (Floor-to-Ceiling)', noOfUnits: 1, unit: 'sets', unitCost: 38000, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 }
          ]
        }
      ];
    } else if (tpl.code === 'M') {
      subPhases = [
        {
          id: `sub-${tpl.code}-1`,
          title: 'Electrical Rough-in, Wiring & Fixtures',
          items: [
            { id: `item-m-1`, scopeOfWork: 'Main Distribution Panel Board with Circuit Breakers', noOfUnits: 1, unit: 'sets', unitCost: 16500, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-m-2`, scopeOfWork: 'THHN Copper Wires (3.5mm² & 2.0mm² Phelps Dodge) in PVC Conduits', noOfUnits: 1, unit: 'lot', unitCost: 65000, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-m-3`, scopeOfWork: 'Designer Switches, Duplex Outlets & Modern LED Recessed Downlights', noOfUnits: 1, unit: 'lot', unitCost: 45000, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 }
          ]
        }
      ];
    } else if (tpl.code === 'N') {
      subPhases = [
        {
          id: `sub-${tpl.code}-1`,
          title: 'Potable Waterline, Sanitary Drainage & Fixtures',
          items: [
            { id: `item-n-1`, scopeOfWork: 'PPR Hot & Cold Waterline Pipework & Fittings', noOfUnits: 1, unit: 'lot', unitCost: 32000, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-n-2`, scopeOfWork: 'PVC Sanitary, Sewer & Storm Drainage Piping Network', noOfUnits: 1, unit: 'lot', unitCost: 38000, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-n-3`, scopeOfWork: 'Dual-Flush Water Closets, Lavatories, Rain Showers & Floor Drains', noOfUnits: 3, unit: 'sets', unitCost: 14500, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 }
          ]
        }
      ];
    } else if (tpl.code === 'O') {
      subPhases = [
        {
          id: `sub-${tpl.code}-1`,
          title: 'Perimeter Fence & Steel Gate',
          items: [
            { id: `item-o-1`, scopeOfWork: 'Concrete Perimeter Fence with Plaster & Paint Finish', noOfUnits: 32, unit: 'l.m.', unitCost: 2800, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 },
            { id: `item-o-2`, scopeOfWork: 'Vehicular Sliding Gate & Pedestrian Gate with Primer & Enamel', noOfUnits: 1, unit: 'lot', unitCost: 42000, profitPct: tpl.defaultProfitPct, overheadPct: tpl.defaultOverheadPct, designCost: 0 }
          ]
        }
      ];
    }

    return {
      id: pId,
      code: tpl.code,
      title: tpl.title,
      defaultProfitPct: tpl.defaultProfitPct,
      defaultOverheadPct: tpl.defaultOverheadPct,
      subPhases,
      isExpanded: true
    };
  });
}

// Compute straight percentage math formulas
export function calculateLineItemCosts(item: BomLineItem) {
  const units = Math.max(0, Number(item.noOfUnits) || 0);
  const uCost = Math.max(0, Number(item.unitCost) || 0);
  const directTotalCost = units * uCost;

  const profitPct = Math.max(0, Number(item.profitPct) || 0);
  const overheadPct = Math.max(0, Number(item.overheadPct) || 0);
  const designCost = Math.max(0, Number(item.designCost) || 0);

  // Strict Straight Percentage Math:
  // Profit Cost = Direct Total Cost * (Profit Allocation % / 100)
  const profitCost = directTotalCost * (profitPct / 100);

  // Overhead Cost = Direct Total Cost * (Overhead % / 100)
  const overheadCost = directTotalCost * (overheadPct / 100);

  // Total Markup = Profit Cost + Overhead Cost + Design Cost
  const totalMarkup = profitCost + overheadCost + designCost;

  // Total Cost (Final) = Direct Total Cost + Total Markup
  const finalTotalCost = directTotalCost + totalMarkup;

  // Marked-up unit cost (for client presentation)
  const markedUpUnitCost = units > 0 ? finalTotalCost / units : 0;

  return {
    directTotalCost,
    profitCost,
    overheadCost,
    totalMarkup,
    finalTotalCost,
    markedUpUnitCost
  };
}

interface BillOfMaterialsManagerProps {
  projects?: any[];
  onNotify?: (msg: string) => void;
  onNavigateToGantt?: (projectId?: string) => void;
}

export default function BillOfMaterialsManager({
  projects = [],
  onNotify,
  onNavigateToGantt
}: BillOfMaterialsManagerProps) {
  const { isDark } = useTheme();

  // Available projects from props or local storage
  const activeProjectsList: ProjectProfile[] = useMemo(() => {
    if (projects && projects.length > 0) return projects;
    try {
      const raw = localStorage.getItem('ctvill_projects') || localStorage.getItem('ctvill_cached_projects');
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }, [projects]);

  // Selected project state
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    return activeProjectsList[0]?.id || 'PRJ-DEFAULT';
  });

  const activeProject = useMemo(() => {
    return activeProjectsList.find(p => p.id === selectedProjectId) || activeProjectsList[0] || null;
  }, [activeProjectsList, selectedProjectId]);

  // Project Header Meta
  const [projectTitle, setProjectTitle] = useState<string>('2-Storey Modern Residential Villa');
  const [ownerName, setOwnerName] = useState<string>('Mr. & Mrs. Alexander Santos');
  const [siteLocation, setSiteLocation] = useState<string>('Brgy. Banlic, Cabuyao, Laguna');
  const [projectType, setProjectType] = useState<ProjectTypology>('2-Storey Residential Unit');
  const [floorAreaSqm, setFloorAreaSqm] = useState<number>(155);
  const [estimateRefNo, setEstimateRefNo] = useState<string>(() => `EST-LDM-${new Date().getFullYear()}-001`);
  const [estimateDate, setEstimateDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Client Presentation Mode Toggle
  const [isClientMode, setIsClientMode] = useState<boolean>(false);
  const [syncGanttLoading, setSyncGanttLoading] = useState<boolean>(false);

  // Sync Project Meta when active project changes
  useEffect(() => {
    if (activeProject) {
      setProjectTitle(activeProject.name || '2-Storey Modern Residential Villa');
      setOwnerName(activeProject.clientName || 'Private Client');
      setSiteLocation(activeProject.location || 'Brgy. Banlic, Cabuyao, Laguna');
      if ((activeProject as any).floorAreaSqm) {
        setFloorAreaSqm(Number((activeProject as any).floorAreaSqm) || 155);
      }
    }
  }, [activeProject]);

  // BOM Phases State
  const storageKey = `ldm_bom_${selectedProjectId}`;
  const [phases, setPhases] = useState<BomPhase[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return generateDefaultBomPhases('2-Storey Residential Unit');
  });

  // Re-load BOM when switching project
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`ldm_bom_${selectedProjectId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPhases(parsed);
          return;
        }
      }
    } catch {}
    setPhases(generateDefaultBomPhases(projectType));
  }, [selectedProjectId]);

  // Auto-save BOM changes to localStorage
  const saveBomToStorage = useCallback((newPhases: BomPhase[]) => {
    setPhases(newPhases);
    try {
      localStorage.setItem(`ldm_bom_${selectedProjectId}`, JSON.stringify(newPhases));
    } catch {}
  }, [selectedProjectId]);

  // Reset to default typology template
  const handleApplyTypology = (newType: ProjectTypology) => {
    setProjectType(newType);
    if (confirm(`Reset and generate standard Bill of Materials template for "${newType}"? Existing custom items for this project will be overwritten.`)) {
      const freshPhases = generateDefaultBomPhases(newType);
      saveBomToStorage(freshPhases);
      onNotify?.(`Applied "${newType}" Bill of Materials template with 15 WBS phases.`);
    }
  };

  // Phase collapse/expand toggle
  const togglePhaseExpand = (phaseId: string) => {
    saveBomToStorage(phases.map(p => p.id === phaseId ? { ...p, isExpanded: !p.isExpanded } : p));
  };

  // Batch-apply Profit % to all items in phase
  const handleBatchProfitChange = (phaseId: string, newProfit: number) => {
    const val = Math.max(0, Math.min(100, Number(newProfit) || 0));
    saveBomToStorage(phases.map(p => {
      if (p.id !== phaseId) return p;
      return {
        ...p,
        defaultProfitPct: val,
        subPhases: p.subPhases.map(sp => ({
          ...sp,
          items: sp.items.map(item => ({ ...item, profitPct: val }))
        }))
      };
    }));
  };

  // Batch-apply Overhead % to all items in phase
  const handleBatchOverheadChange = (phaseId: string, newOverhead: number) => {
    const val = Math.max(0, Math.min(100, Number(newOverhead) || 0));
    saveBomToStorage(phases.map(p => {
      if (p.id !== phaseId) return p;
      return {
        ...p,
        defaultOverheadPct: val,
        subPhases: p.subPhases.map(sp => ({
          ...sp,
          items: sp.items.map(item => ({ ...item, overheadPct: val }))
        }))
      };
    }));
  };

  // Add Item inside Sub-Phase
  const handleAddItem = (phaseId: string, subPhaseId: string) => {
    saveBomToStorage(phases.map(p => {
      if (p.id !== phaseId) return p;
      return {
        ...p,
        subPhases: p.subPhases.map(sp => {
          if (sp.id !== subPhaseId) return sp;
          const newItem: BomLineItem = {
            id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            scopeOfWork: 'New Construction Line Item / Material Work',
            noOfUnits: 1,
            unit: 'pcs',
            unitCost: 1000,
            profitPct: p.defaultProfitPct,
            overheadPct: p.defaultOverheadPct,
            designCost: 0
          };
          return {
            ...sp,
            items: [...sp.items, newItem]
          };
        })
      };
    }));
  };

  // Add Sub-Phase inside Phase
  const handleAddSubPhase = (phaseId: string) => {
    const subTitle = prompt('Enter Sub-Phase title (e.g., "Site Clearing" or "Masonry Wall Laying"):');
    if (!subTitle || !subTitle.trim()) return;

    saveBomToStorage(phases.map(p => {
      if (p.id !== phaseId) return p;
      const newSub: BomSubPhase = {
        id: `sub-${Date.now()}`,
        title: subTitle.trim(),
        items: [
          {
            id: `item-${Date.now()}`,
            scopeOfWork: 'Scope of Work Description',
            noOfUnits: 1,
            unit: 'lot',
            unitCost: 5000,
            profitPct: p.defaultProfitPct,
            overheadPct: p.defaultOverheadPct,
            designCost: 0
          }
        ]
      };
      return {
        ...p,
        isExpanded: true,
        subPhases: [...p.subPhases, newSub]
      };
    }));
  };

  // Delete Line Item
  const handleDeleteItem = (phaseId: string, subPhaseId: string, itemId: string) => {
    saveBomToStorage(phases.map(p => {
      if (p.id !== phaseId) return p;
      return {
        ...p,
        subPhases: p.subPhases.map(sp => {
          if (sp.id !== subPhaseId) return sp;
          return {
            ...sp,
            items: sp.items.filter(i => i.id !== itemId)
          };
        })
      };
    }));
  };

  // Delete Sub-Phase
  const handleDeleteSubPhase = (phaseId: string, subPhaseId: string) => {
    if (!confirm('Delete this sub-phase and all its line items?')) return;
    saveBomToStorage(phases.map(p => {
      if (p.id !== phaseId) return p;
      return {
        ...p,
        subPhases: p.subPhases.filter(sp => sp.id !== subPhaseId)
      };
    }));
  };

  // Update Line Item Field
  const handleUpdateItem = (
    phaseId: string,
    subPhaseId: string,
    itemId: string,
    field: keyof BomLineItem,
    value: any
  ) => {
    saveBomToStorage(phases.map(p => {
      if (p.id !== phaseId) return p;
      return {
        ...p,
        subPhases: p.subPhases.map(sp => {
          if (sp.id !== subPhaseId) return sp;
          return {
            ...sp,
            items: sp.items.map(item => {
              if (item.id !== itemId) return item;
              return {
                ...item,
                [field]: value
              };
            })
          };
        })
      };
    }));
  };

  // Add an Optional Phase (Garage, Balcony, Office Area)
  const handleAddOptionalPhase = (tpl: typeof OPTIONAL_BOM_PHASES[0]) => {
    if (phases.some(p => p.code === tpl.code)) {
      alert(`Phase ${tpl.code}. ${tpl.title} already exists in this estimate.`);
      return;
    }
    const newPhase: BomPhase = {
      id: `phase-${tpl.code.toLowerCase()}-${Date.now()}`,
      code: tpl.code,
      title: tpl.title,
      defaultProfitPct: tpl.defaultProfitPct,
      defaultOverheadPct: tpl.defaultOverheadPct,
      isExpanded: true,
      subPhases: [
        {
          id: `sub-${tpl.code}-1`,
          title: `${tpl.title} Execution`,
          items: [
            {
              id: `item-${tpl.code}-1`,
              scopeOfWork: `${tpl.title} Structural Framing & Finishing`,
              noOfUnits: 1,
              unit: 'lot',
              unitCost: 45000,
              profitPct: tpl.defaultProfitPct,
              overheadPct: tpl.defaultOverheadPct,
              designCost: 0
            }
          ]
        }
      ]
    };
    saveBomToStorage([...phases, newPhase]);
    onNotify?.(`Added Phase ${tpl.code}. ${tpl.title} to estimate.`);
  };

  // ---------------------------------------------------------------------------
  // ROLL-UP SUMMARY CALCULATIONS
  // ---------------------------------------------------------------------------
  const summaryCalculations = useMemo(() => {
    let grandDirectCost = 0;
    let grandProfitCost = 0;
    let grandOverheadCost = 0;
    let grandDesignCost = 0;
    let grandTotalCost = 0;
    let totalLineItemsCount = 0;

    const phaseSummaries = phases.map(phase => {
      let phaseDirect = 0;
      let phaseProfit = 0;
      let phaseOverhead = 0;
      let phaseDesign = 0;
      let phaseTotal = 0;

      phase.subPhases.forEach(sp => {
        sp.items.forEach(item => {
          totalLineItemsCount++;
          const computed = calculateLineItemCosts(item);
          phaseDirect += computed.directTotalCost;
          phaseProfit += computed.profitCost;
          phaseOverhead += computed.overheadCost;
          phaseDesign += Number(item.designCost) || 0;
          phaseTotal += computed.finalTotalCost;
        });
      });

      grandDirectCost += phaseDirect;
      grandProfitCost += phaseProfit;
      grandOverheadCost += phaseOverhead;
      grandDesignCost += phaseDesign;
      grandTotalCost += phaseTotal;

      return {
        phaseId: phase.id,
        code: phase.code,
        title: phase.title,
        phaseDirect,
        phaseProfit,
        phaseOverhead,
        phaseDesign,
        phaseTotalMarkup: phaseProfit + phaseOverhead + phaseDesign,
        phaseTotal
      };
    });

    const grandTotalMarkup = grandProfitCost + grandOverheadCost + grandDesignCost;
    const safeArea = Math.max(1, Number(floorAreaSqm) || 1);
    const costPerSqm = grandTotalCost / safeArea;

    return {
      phaseSummaries,
      grandDirectCost,
      grandProfitCost,
      grandOverheadCost,
      grandDesignCost,
      grandTotalMarkup,
      grandTotalCost,
      costPerSqm,
      totalLineItemsCount
    };
  }, [phases, floorAreaSqm]);

  // ---------------------------------------------------------------------------
  // PRINT ENGINE: CLIENT QUOTATION (HIDES PROFIT/MARKUP) & INTERNAL BOM
  // ---------------------------------------------------------------------------
  const handlePrintQuotation = (hideInternalMarkup: boolean = true) => {
    const tableHeaders = hideInternalMarkup
      ? ['ITEM #', 'SCOPE OF WORK / MATERIAL SPECIFICATIONS', 'QTY', 'UNIT', 'UNIT PRICE (₱)', 'TOTAL COST (₱)']
      : ['ITEM #', 'SCOPE OF WORK', 'QTY', 'UNIT', 'DIRECT UNIT (₱)', 'DIRECT TOTAL (₱)', 'PROFIT %', 'PROFIT (₱)', 'OVERHEAD %', 'TOTAL (₱)'];

    let itemCounter = 1;
    let rowsHtml = '';

    phases.forEach(phase => {
      // Phase Header Row
      const colSpan = hideInternalMarkup ? 6 : 10;
      rowsHtml += `
        <tr style="background:#0f172a;color:#f8fafc;font-weight:bold;font-size:11px;letter-spacing:0.5px;">
          <td colspan="${colSpan}" style="padding:6px 10px;">PHASE ${phase.code}. ${escapePrintHtml(phase.title)}</td>
        </tr>
      `;

      phase.subPhases.forEach(sp => {
        // Sub-phase header row
        rowsHtml += `
          <tr style="background:#f1f5f9;font-weight:600;font-size:10px;color:#334155;">
            <td colspan="${colSpan}" style="padding:4px 10px;border-left:3px solid #f59e0b;">${escapePrintHtml(sp.title)}</td>
          </tr>
        `;

        sp.items.forEach(item => {
          const c = calculateLineItemCosts(item);
          const itemNum = `${phase.code}.${itemCounter++}`;

          if (hideInternalMarkup) {
            rowsHtml += `
              <tr style="border-bottom:1px solid #e2e8f0;font-size:10px;">
                <td style="padding:4px 8px;font-family:monospace;color:#64748b;">${itemNum}</td>
                <td style="padding:4px 8px;">${escapePrintHtml(item.scopeOfWork)}</td>
                <td style="padding:4px 8px;text-align:right;font-family:monospace;">${item.noOfUnits.toLocaleString()}</td>
                <td style="padding:4px 8px;text-align:center;">${escapePrintHtml(item.unit)}</td>
                <td style="padding:4px 8px;text-align:right;font-family:monospace;">₱${c.markedUpUnitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="padding:4px 8px;text-align:right;font-weight:bold;font-family:monospace;">₱${c.finalTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            `;
          } else {
            rowsHtml += `
              <tr style="border-bottom:1px solid #e2e8f0;font-size:9.5px;">
                <td style="padding:4px 6px;font-family:monospace;color:#64748b;">${itemNum}</td>
                <td style="padding:4px 6px;">${escapePrintHtml(item.scopeOfWork)}</td>
                <td style="padding:4px 6px;text-align:right;font-family:monospace;">${item.noOfUnits.toLocaleString()}</td>
                <td style="padding:4px 6px;text-align:center;">${escapePrintHtml(item.unit)}</td>
                <td style="padding:4px 6px;text-align:right;font-family:monospace;">₱${item.unitCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td style="padding:4px 6px;text-align:right;font-family:monospace;">₱${c.directTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td style="padding:4px 6px;text-align:center;font-family:monospace;">${item.profitPct}%</td>
                <td style="padding:4px 6px;text-align:right;font-family:monospace;">₱${c.profitCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td style="padding:4px 6px;text-align:center;font-family:monospace;">${item.overheadPct}%</td>
                <td style="padding:4px 6px;text-align:right;font-weight:bold;font-family:monospace;">₱${c.finalTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
            `;
          }
        });
      });
    });

    // Summary block html
    const summaryBlockHtml = `
      <div style="margin-top:20px;border-top:2px solid #0f172a;padding-top:12px;">
        <table style="width:100%;font-size:11px;border-collapse:collapse;">
          ${!hideInternalMarkup ? `
            <tr>
              <td style="padding:4px;color:#64748b;">Direct Labor & Material Subtotal:</td>
              <td style="padding:4px;text-align:right;font-weight:bold;font-family:monospace;">₱${summaryCalculations.grandDirectCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td style="padding:4px;color:#64748b;">Total Contractor Profit Allocation:</td>
              <td style="padding:4px;text-align:right;font-weight:bold;font-family:monospace;">₱${summaryCalculations.grandProfitCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td style="padding:4px;color:#64748b;">Total Overhead & Administrative Expenses:</td>
              <td style="padding:4px;text-align:right;font-weight:bold;font-family:monospace;">₱${summaryCalculations.grandOverheadCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          ` : ''}
          <tr style="background:#f8fafc;font-size:13px;font-weight:bold;border-top:2px solid #0f172a;border-bottom:2px solid #0f172a;">
            <td style="padding:8px;color:#0f172a;">TOTAL ESTIMATED CONTRACT PROJECT COST:</td>
            <td style="padding:8px;text-align:right;color:#0f172a;font-family:monospace;">₱${summaryCalculations.grandTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td style="padding:4px;color:#64748b;">Total Floor Area: ${floorAreaSqm} sqm</td>
            <td style="padding:4px;text-align:right;color:#64748b;font-family:monospace;">Unit Cost: ₱${summaryCalculations.costPerSqm.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / sqm</td>
          </tr>
        </table>
      </div>
    `;

    const bodyHtml = `
      <div style="margin-bottom:12px;font-size:10px;color:#475569;display:flex;justify-content:space-between;border-bottom:1px solid #cbd5e1;padding-bottom:8px;">
        <div>
          <strong>CLIENT:</strong> ${escapePrintHtml(ownerName)}<br/>
          <strong>PROJECT:</strong> ${escapePrintHtml(projectTitle)} (${escapePrintHtml(projectType)})<br/>
          <strong>LOCATION:</strong> ${escapePrintHtml(siteLocation)}
        </div>
        <div style="text-align:right;">
          <strong>ESTIMATE REF:</strong> ${escapePrintHtml(estimateRefNo)}<br/>
          <strong>DATE:</strong> ${escapePrintHtml(estimateDate)}<br/>
          <strong>ESTIMATOR:</strong> LDM Engineering & Estimating Desk
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-top:8px;">
        <thead>
          <tr style="background:#1e293b;color:#f8fafc;font-size:10px;text-align:left;">
            ${tableHeaders.map((h, i) => `<th style="padding:6px 8px;border:1px solid #334155;text-align:${i >= (hideInternalMarkup ? 2 : 2) ? 'right' : 'left'};">${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      ${summaryBlockHtml}
    `;

    openEnterprisePrintWindow({
      title: hideInternalMarkup
        ? 'Official Bill of Materials & Turnkey Construction Quotation'
        : 'Detailed Engineering Bill of Materials (BOM) & Cost Ledger',
      subtitle: `${projectTitle} — ${projectType} | ${siteLocation}`,
      docRef: estimateRefNo,
      orientation: hideInternalMarkup ? 'portrait' : 'landscape',
      projectMeta: {
        name: projectTitle,
        location: siteLocation,
        client: ownerName,
        period: `Floor Area: ${floorAreaSqm} sqm (₱${Math.round(summaryCalculations.costPerSqm).toLocaleString()}/sqm)`
      },
      kpiSummary: [
        { label: 'Total Estimated Cost', value: `₱${summaryCalculations.grandTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
        { label: 'Floor Area', value: `${floorAreaSqm} sqm` },
        { label: 'Unit Cost / sqm', value: `₱${Math.round(summaryCalculations.costPerSqm).toLocaleString()}/sqm` },
        { label: 'Active WBS Phases', value: `${phases.length} Phases` }
      ],
      signatures: [
        { role: 'Prepared By', name: 'Engr. Carlos Mendoza', title: 'Cost Engineer / Estimator' },
        { role: 'Checked & Approved', name: 'Engr. Ricardo Ramos', title: 'Head of Engineering & Projects' },
        { role: 'Client Conforme', name: ownerName, title: 'Owner / Authorized Representative' }
      ],
      bodyHtml
    });
  };

  // ---------------------------------------------------------------------------
  // SYNC BOM PHASES TO MASTER GANTT CHART
  // ---------------------------------------------------------------------------
  const handleSyncToMasterGantt = () => {
    if (!selectedProjectId) {
      alert('Please select an active project first.');
      return;
    }

    setSyncGanttLoading(true);
    try {
      const storageKey = `${GANTT_TASKS_STORAGE_PREFIX}${selectedProjectId}`;
      const now = new Date();
      let cumulativeStart = new Date(now);

      const newGanttTasks: any[] = [];
      let sortCounter = 1;

      phases.forEach((phase, pIdx) => {
        const phaseParentId = `gantt-phase-${phase.code.toLowerCase()}-${Date.now()}-${pIdx}`;
        const phaseSummary = summaryCalculations.phaseSummaries.find(ps => ps.phaseId === phase.id);
        const phaseDurationDays = Math.max(3, Math.min(30, Math.round((phaseSummary?.phaseDirect || 50000) / 15000)));

        const phaseStartStr = cumulativeStart.toISOString().split('T')[0];
        const phaseEnd = new Date(cumulativeStart);
        phaseEnd.setDate(phaseEnd.getDate() + phaseDurationDays);
        const phaseEndStr = phaseEnd.toISOString().split('T')[0];

        // Parent WBS Task (type = 'project')
        newGanttTasks.push({
          id: phaseParentId,
          projectId: selectedProjectId,
          wbsCode: `${pIdx + 1}.0`,
          text: `Phase ${phase.code}: ${phase.title}`,
          startDate: phaseStartStr,
          endDate: phaseEndStr,
          duration: phaseDurationDays,
          progress: 0,
          weight: Math.max(1, Math.round(((phaseSummary?.phaseTotal || 1) / (summaryCalculations.grandTotalCost || 1)) * 100)),
          constructionPhase: phase.title,
          type: 'project',
          parentTaskId: null,
          sortOrder: sortCounter++,
          contractorName: 'LDM Construction Crew',
          predecessorIds: pIdx > 0 ? [`${pIdx}.0`] : []
        });

        // Child Tasks for each Sub-Phase
        let subCounter = 1;
        phase.subPhases.forEach((sp) => {
          const childDuration = Math.max(2, Math.round(phaseDurationDays / Math.max(1, phase.subPhases.length)));
          const childStart = new Date(cumulativeStart);
          const childEnd = new Date(childStart);
          childEnd.setDate(childEnd.getDate() + childDuration);

          newGanttTasks.push({
            id: `gantt-sub-${phase.code}-${subCounter}-${Date.now()}`,
            projectId: selectedProjectId,
            wbsCode: `${pIdx + 1}.${subCounter}`,
            text: sp.title,
            startDate: childStart.toISOString().split('T')[0],
            endDate: childEnd.toISOString().split('T')[0],
            duration: childDuration,
            progress: 0,
            weight: Math.max(1, Math.round(100 / Math.max(1, phase.subPhases.length))),
            constructionPhase: phase.title,
            type: 'task',
            parentTaskId: phaseParentId,
            sortOrder: sortCounter++,
            contractorName: 'LDM In-House Trade Gang',
            predecessorIds: []
          });
          subCounter++;
        });

        // Advance cumulative calendar
        cumulativeStart.setDate(cumulativeStart.getDate() + Math.max(2, Math.round(phaseDurationDays * 0.75)));
      });

      // Save into project's Gantt storage
      localStorage.setItem(storageKey, JSON.stringify(newGanttTasks));
      window.dispatchEvent(new CustomEvent(GANTT_TASKS_UPDATED_EVENT, { detail: { projectId: selectedProjectId, tasks: newGanttTasks } }));

      logAuditEvent({
        entityType: 'CIVIL_WORKS',
        entityId: selectedProjectId,
        action: 'BOM_GANTT_SYNC',
        actorName: 'Engr. Dan Ramos',
        actorRole: 'Operations Manager',
        details: `Synchronized ${phases.length} WBS phases (${newGanttTasks.length} tasks) from BOM Quotation Builder to Master Gantt Chart for ${projectTitle}.`
      });

      onNotify?.(`⚡ Successfully pushed ${newGanttTasks.length} BOM phases & tasks into Master Gantt Chart!`);
      if (confirm(`Successfully pushed ${phases.length} WBS phases (${newGanttTasks.length} tasks) into Master Gantt Chart. Navigate to Master Gantt now?`)) {
        onNavigateToGantt?.(selectedProjectId);
      }
    } catch (err) {
      console.error(err);
      alert('Error syncing to Gantt storage.');
    } finally {
      setSyncGanttLoading(false);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = ['Phase', 'Sub-Phase', 'Scope of Work', 'Units', 'Unit', 'Unit Cost (PHP)', 'Direct Cost (PHP)', 'Profit %', 'Profit Cost (PHP)', 'Overhead %', 'Overhead Cost (PHP)', 'Design (PHP)', 'Total Markup (PHP)', 'Final Cost (PHP)'];
    const rows: (string | number)[][] = [];

    phases.forEach(phase => {
      phase.subPhases.forEach(sp => {
        sp.items.forEach(item => {
          const c = calculateLineItemCosts(item);
          rows.push([
            `Phase ${phase.code}. ${phase.title}`,
            sp.title,
            item.scopeOfWork,
            item.noOfUnits,
            item.unit,
            item.unitCost,
            c.directTotalCost,
            item.profitPct,
            c.profitCost,
            item.overheadPct,
            c.overheadCost,
            item.designCost,
            c.totalMarkup,
            c.finalTotalCost
          ]);
        });
      });
    });

    exportToCsv(`BOM_Quotation_${projectTitle.replace(/\s+/g, '_')}`, headers, rows);
  };

  return (
    <div className="space-y-5 font-sans">
      
      {/* 1. TOP HEADER & PROJECT SELECTOR BANNER */}
      <div className={`p-4 sm:p-5 rounded-2xl border shadow-sm transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-4 mb-4 border-slate-800/60">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider">
                ENGINEERING BILL OF MATERIALS &amp; CLIENT QUOTATION BUILDER
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Calculator className="w-6 h-6 text-amber-400" />
              <span>Bill of Materials (BOM) &amp; Quotation</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Detailed construction estimate engine matching the Santos spreadsheet specification. Automatic straight-percentage markups, collapsible WBS phases, and live Gantt chart sync.
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsClientMode(!isClientMode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer ${
                isClientMode
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
              }`}
              title="Toggle client-friendly view (hides profit, overhead, and markup breakdown columns)"
            >
              {isClientMode ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{isClientMode ? 'Client Mode: Active (Markup Hidden)' : 'Internal Engineering Mode'}</span>
            </button>

            <button
              type="button"
              onClick={() => handlePrintQuotation(true)}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              title="Print clean client quotation where internal profits & markups are combined into unit costs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>🖨️ Print Client Quotation</span>
            </button>

            <button
              type="button"
              onClick={() => handlePrintQuotation(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
              title="Print full engineering BOM with internal profit & overhead columns"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span>Internal BOM</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              disabled={syncGanttLoading}
              onClick={handleSyncToMasterGantt}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-slate-950" />
              <span>{syncGanttLoading ? 'Syncing...' : '⚡ Sync Phases to Master Gantt'}</span>
            </button>
          </div>
        </div>

        {/* Project Meta Selectors Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold mb-1">
              Select PMS Project *
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-white font-medium focus:border-amber-500 focus:outline-none"
              >
                {activeProjectsList.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold mb-1">
              Project Typology Template
            </label>
            <select
              value={projectType}
              onChange={(e) => handleApplyTypology(e.target.value as ProjectTypology)}
              className="w-full bg-slate-950 border border-amber-500/40 text-amber-300 font-bold rounded-xl px-3 py-2 focus:border-amber-500 focus:outline-none"
            >
              <option value="2-Storey Residential Unit">2-Storey Residential Unit</option>
              <option value="1-Storey / Bungalow">1-Storey / Bungalow</option>
              <option value="Renovation / Fit-Out">Renovation / Fit-Out</option>
              <option value="Demolition / Excavation">Demolition / Excavation</option>
              <option value="Commercial Building">Commercial Building</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold mb-1">
              Owner / Client Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Client Name"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold mb-1">
              Site Location
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={siteLocation}
                onChange={(e) => setSiteLocation(e.target.value)}
                placeholder="Location"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Secondary Parameters Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-800/60 text-xs">
          <div>
            <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold mb-1">Total Floor Area (sqm)</label>
            <input
              type="number"
              min={1}
              value={floorAreaSqm}
              onChange={(e) => setFloorAreaSqm(Math.max(1, Number(e.target.value) || 1))}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white font-mono font-bold focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold mb-1">Cost / Floor Area (₱/sqm)</label>
            <div className="bg-slate-950 border border-emerald-500/30 rounded-xl px-3 py-1.5 text-emerald-400 font-mono font-bold text-sm">
              ₱{Math.round(summaryCalculations.costPerSqm).toLocaleString()} / sqm
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold mb-1">Estimate Ref. No.</label>
            <input
              type="text"
              value={estimateRefNo}
              onChange={(e) => setEstimateRefNo(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white font-mono focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono text-slate-400 uppercase font-bold mb-1">Estimate Date</label>
            <input
              type="date"
              value={estimateDate}
              onChange={(e) => setEstimateDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white font-mono focus:border-amber-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 2. OVERALL COST ANALYSIS KPI CARDS */}
      {isClientMode ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="bg-slate-900/80 border border-emerald-500/40 p-3.5 rounded-xl sm:col-span-2">
            <span className="text-[10px] font-mono text-emerald-400 uppercase block font-bold">TOTAL ESTIMATED CONTRACT PRICE</span>
            <span className="text-xl sm:text-2xl font-black font-mono text-emerald-400 mt-1 block">
              ₱{summaryCalculations.grandTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
              Turnkey Design &amp; Build Scope &bull; {summaryCalculations.totalLineItemsCount} Deliverable Items
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl">
            <span className="text-[10px] font-mono text-cyan-400 uppercase block font-bold">ESTIMATED COST PER SQM</span>
            <span className="text-xl font-bold font-mono text-cyan-300 mt-1 block">
              ₱{(floorAreaSqm > 0 ? Math.round(summaryCalculations.grandTotalCost / floorAreaSqm) : 0).toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Gross Floor Area Base</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl">
            <span className="text-[10px] font-mono text-amber-400 uppercase block font-bold">PROJECT SPECS &amp; WBS</span>
            <span className="text-xl font-bold font-mono text-white mt-1 block">
              {floorAreaSqm} SQM
            </span>
            <span className="text-[10px] text-slate-400 font-mono">{phases.length} Architectural WBS Phases</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
            <span className="text-[10px] font-mono text-slate-400 uppercase block font-bold">Direct Labor &amp; Mat</span>
            <span className="text-base font-bold font-mono text-white mt-1 block">
              ₱{summaryCalculations.grandDirectCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Net Materials Base</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
            <span className="text-[10px] font-mono text-amber-400 uppercase block font-bold">Total Profit Cost</span>
            <span className="text-base font-bold font-mono text-amber-400 mt-1 block">
              ₱{summaryCalculations.grandProfitCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Straight % Margin</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
            <span className="text-[10px] font-mono text-blue-400 uppercase block font-bold">Total Overhead</span>
            <span className="text-base font-bold font-mono text-blue-400 mt-1 block">
              ₱{summaryCalculations.grandOverheadCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Site Ops &amp; Admin</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
            <span className="text-[10px] font-mono text-purple-400 uppercase block font-bold">Total Markup</span>
            <span className="text-base font-bold font-mono text-purple-400 mt-1 block">
              ₱{summaryCalculations.grandTotalMarkup.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Profit + OH + Design</span>
          </div>

          <div className="bg-slate-900/80 border border-emerald-500/30 p-3 rounded-xl sm:col-span-2">
            <span className="text-[10px] font-mono text-emerald-400 uppercase block font-bold">GRAND TOTAL PROJECT COST</span>
            <span className="text-lg font-black font-mono text-emerald-400 mt-0.5 block">
              ₱{summaryCalculations.grandTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {summaryCalculations.totalLineItemsCount} Line Items across {phases.length} WBS Phases
            </span>
          </div>
        </div>
      )}

      {/* 3. OPTIONAL PHASE QUICK-ADD PILLS */}
      <div className="flex items-center gap-2 flex-wrap text-xs bg-slate-900/40 border border-slate-800/80 p-2.5 rounded-xl">
        <span className="text-[10px] font-mono text-slate-400 uppercase font-bold flex items-center gap-1">
          <Plus className="w-3.5 h-3.5 text-amber-400" />
          <span>Add Optional Phases:</span>
        </span>
        {OPTIONAL_BOM_PHASES.map(tpl => {
          const exists = phases.some(p => p.code === tpl.code);
          return (
            <button
              key={tpl.code}
              type="button"
              disabled={exists}
              onClick={() => handleAddOptionalPhase(tpl)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold flex items-center gap-1 transition ${
                exists
                  ? 'bg-slate-800/50 text-slate-500 border border-slate-800 cursor-not-allowed'
                  : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 cursor-pointer'
              }`}
            >
              <span>+ Phase {tpl.code}: {tpl.title}</span>
              {exists && <Check className="w-3 h-3 text-emerald-400" />}
            </button>
          );
        })}
      </div>

      {/* 4. EXPANDABLE WBS PHASES & MATERIAL LINE ITEMS ACCORDION */}
      <div className="space-y-4">
        {phases.map((phase, pIdx) => {
          const phaseSummary = summaryCalculations.phaseSummaries.find(ps => ps.phaseId === phase.id);

          return (
            <div
              key={phase.id}
              className={`rounded-2xl border overflow-hidden shadow-md transition-colors ${
                isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              {/* Phase Header Bar */}
              <div className="p-3.5 sm:p-4 bg-slate-950/80 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div
                  onClick={() => togglePhaseExpand(phase.id)}
                  className="flex items-center gap-2.5 cursor-pointer select-none"
                >
                  <button
                    type="button"
                    className="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center text-slate-300 hover:text-white"
                  >
                    {phase.isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <div>
                    <span className="text-[10px] font-mono text-amber-400 uppercase font-bold tracking-wider">
                      PHASE {phase.code}
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                      {phase.title}
                    </h3>
                  </div>
                </div>

                {/* Phase Batch Controls & Subtotals */}
                <div className="flex flex-wrap items-center gap-3">
                  {!isClientMode && (
                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 px-2.5 py-1 rounded-lg text-xs font-mono">
                      <span className="text-slate-400 text-[10px]">Phase Profit:</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={phase.defaultProfitPct}
                        onChange={(e) => handleBatchProfitChange(phase.id, Number(e.target.value))}
                        className="w-12 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-center text-amber-400 font-bold"
                      />
                      <span className="text-slate-400 text-[10px]">%</span>
                      <span className="text-slate-600">|</span>
                      <span className="text-slate-400 text-[10px]">Overhead:</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={phase.defaultOverheadPct}
                        onChange={(e) => handleBatchOverheadChange(phase.id, Number(e.target.value))}
                        className="w-12 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-center text-blue-400 font-bold"
                      />
                      <span className="text-slate-400 text-[10px]">%</span>
                    </div>
                  )}

                  <div className="text-right font-mono">
                    <span className="text-[10px] text-slate-400 block">Phase Total</span>
                    <span className="text-sm sm:text-base font-black text-emerald-400">
                      ₱{(phaseSummary?.phaseTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddSubPhase(phase.id)}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Sub-Phase</span>
                  </button>
                </div>
              </div>

              {/* Sub-Phases & Items Content */}
              {phase.isExpanded && (
                <div className="p-3 sm:p-4 space-y-4">
                  {phase.subPhases.map((sp) => (
                    <div key={sp.id} className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden">
                      
                      {/* Sub-Phase Title Row */}
                      <div className="px-3.5 py-2 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                          <span className="text-xs font-bold text-white">{sp.title}</span>
                          <span className="text-[10px] font-mono text-slate-400">({sp.items.length} item{sp.items.length === 1 ? '' : 's'})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleAddItem(phase.id, sp.id)}
                            className="text-[11px] font-mono text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Item</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSubPhase(phase.id, sp.id)}
                            className="text-slate-500 hover:text-red-400 p-1 cursor-pointer"
                            title="Delete Sub-Phase"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Items Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-950 text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800">
                              <th className="py-2.5 px-3 min-w-[200px]">Scope of Work / Material</th>
                              <th className="py-2.5 px-2 w-20 text-center">No. of Units</th>
                              <th className="py-2.5 px-2 w-20 text-center">Unit</th>
                              <th className="py-2.5 px-2 w-28 text-right">{isClientMode ? 'Unit Price (₱)' : 'Unit Cost (₱)'}</th>
                              {!isClientMode && <th className="py-2.5 px-2 w-28 text-right">Direct Cost (₱)</th>}
                              {!isClientMode && <th className="py-2.5 px-2 w-20 text-center">Profit %</th>}
                              {!isClientMode && <th className="py-2.5 px-2 w-24 text-right">Profit (₱)</th>}
                              {!isClientMode && <th className="py-2.5 px-2 w-20 text-center">Overhead %</th>}
                              {!isClientMode && <th className="py-2.5 px-2 w-24 text-right">Total Markup</th>}
                              <th className="py-2.5 px-3 w-32 text-right">Total Cost (₱)</th>
                              <th className="py-2.5 px-2 w-10"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 font-sans">
                            {sp.items.map((item) => {
                              const c = calculateLineItemCosts(item);

                              return (
                                <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                                  {/* Scope */}
                                  <td className="py-2 px-3">
                                    <input
                                      type="text"
                                      value={item.scopeOfWork}
                                      onChange={(e) => handleUpdateItem(phase.id, sp.id, item.id, 'scopeOfWork', e.target.value)}
                                      className="w-full bg-transparent border-0 text-white text-xs focus:ring-1 focus:ring-amber-500 rounded px-1 py-0.5"
                                    />
                                  </td>

                                  {/* No of Units */}
                                  <td className="py-2 px-2 text-center">
                                    <input
                                      type="number"
                                      min={0}
                                      step="any"
                                      value={item.noOfUnits}
                                      onChange={(e) => handleUpdateItem(phase.id, sp.id, item.id, 'noOfUnits', Math.max(0, parseFloat(e.target.value) || 0))}
                                      className="w-16 bg-slate-900 border border-slate-700/80 rounded px-1.5 py-0.5 text-center text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
                                    />
                                  </td>

                                  {/* Unit */}
                                  <td className="py-2 px-2 text-center">
                                    <select
                                      value={item.unit}
                                      onChange={(e) => handleUpdateItem(phase.id, sp.id, item.id, 'unit', e.target.value)}
                                      className="bg-slate-900 border border-slate-700/80 rounded px-1.5 py-0.5 text-[11px] font-mono text-slate-300 focus:border-amber-500 focus:outline-none cursor-pointer"
                                    >
                                      <option value="pcs">pcs</option>
                                      <option value="days">days</option>
                                      <option value="lot">lot</option>
                                      <option value="cu.m.">cu.m.</option>
                                      <option value="sq.m.">sq.m.</option>
                                      <option value="bags">bags</option>
                                      <option value="kg">kg</option>
                                      <option value="bd.ft.">bd.ft.</option>
                                      <option value="l.m.">l.m.</option>
                                      <option value="sets">sets</option>
                                      <option value="sheets">sheets</option>
                                      <option value="lengths">lengths</option>
                                      <option value="rolls">rolls</option>
                                    </select>
                                  </td>

                                  {/* Unit Cost */}
                                  <td className="py-2 px-2 text-right">
                                    {isClientMode ? (
                                      <span className="font-mono text-slate-300">
                                        ₱{c.markedUpUnitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                    ) : (
                                      <input
                                        type="number"
                                        min={0}
                                        step="any"
                                        value={item.unitCost}
                                        onChange={(e) => handleUpdateItem(phase.id, sp.id, item.id, 'unitCost', Math.max(0, parseFloat(e.target.value) || 0))}
                                        className="w-24 bg-slate-900 border border-slate-700/80 rounded px-1.5 py-0.5 text-right text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
                                      />
                                    )}
                                  </td>

                                  {/* Direct Total Cost */}
                                  {!isClientMode && (
                                    <td className="py-2 px-2 text-right font-mono text-slate-300">
                                      ₱{c.directTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                  )}

                                  {/* Profit % */}
                                  {!isClientMode && (
                                    <td className="py-2 px-2 text-center">
                                      <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={item.profitPct}
                                        onChange={(e) => handleUpdateItem(phase.id, sp.id, item.id, 'profitPct', Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                                        className="w-14 bg-slate-900 border border-slate-700/80 rounded px-1 py-0.5 text-center text-xs font-mono text-amber-400 focus:border-amber-500 focus:outline-none"
                                      />
                                    </td>
                                  )}

                                  {/* Profit Cost */}
                                  {!isClientMode && (
                                    <td className="py-2 px-2 text-right font-mono text-amber-300">
                                      ₱{c.profitCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                  )}

                                  {/* Overhead % */}
                                  {!isClientMode && (
                                    <td className="py-2 px-2 text-center">
                                      <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={item.overheadPct}
                                        onChange={(e) => handleUpdateItem(phase.id, sp.id, item.id, 'overheadPct', Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                                        className="w-14 bg-slate-900 border border-slate-700/80 rounded px-1 py-0.5 text-center text-xs font-mono text-blue-400 focus:border-amber-500 focus:outline-none"
                                      />
                                    </td>
                                  )}

                                  {/* Total Markup */}
                                  {!isClientMode && (
                                    <td className="py-2 px-2 text-right font-mono text-purple-300">
                                      ₱{c.totalMarkup.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                  )}

                                  {/* Final Total Cost */}
                                  <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">
                                    ₱{c.finalTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>

                                  {/* Delete Item */}
                                  <td className="py-2 px-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteItem(phase.id, sp.id, item.id)}
                                      className="text-slate-600 hover:text-red-400 p-1 cursor-pointer transition-colors"
                                      title="Delete Item"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
