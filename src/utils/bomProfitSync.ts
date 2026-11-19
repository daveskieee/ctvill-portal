/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const BOM_PROFIT_SYNC_EVENT = 'ldm-bom-profit-updated';
export const DEFAULT_BASELINE_PROFIT = 487627;

export interface MaterialLedgerRecord {
  id: string;
  projectName?: string;
  materialDescription: string;
  category?: string;
  ordered: number;
  received: number;
  used?: number;
  unitCostPhp: number;
}

export interface BomLineItemSyncStatus {
  itemId: string;
  scopeOfWork: string;
  allocatedCost: number;
  actualMaterialSpend: number;
  isBudgetFulfilled: boolean;
  overrunAmount: number;
  matchedMaterialCount: number;
}

export interface ProjectProfitSummary {
  baselineProfit: number;
  totalMaterialSpend: number;
  totalAllocatedBomMaterial: number;
  totalOverrun: number;
  remainingProfit: number;
  profitMarginPct: number; // 100% when intact (0 overrun), drops as overruns eat into profit pool
  isIntact: boolean;
  fulfilledCount: number;
  overrunCount: number;
  lineItemStatuses: Record<string, BomLineItemSyncStatus>;
}

/**
 * Notify all subscribed components (ProjectProfileHub, BillOfMaterialsManager, RfiManager, Dashboard)
 * that Material Directory or BOM figures changed.
 */
export function notifyBomProfitSync() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BOM_PROFIT_SYNC_EVENT));
  }
}

/**
 * Reads Material Directory ledger items from localStorage.
 */
export function getStoredMaterialDirectory(): MaterialLedgerRecord[] {
  try {
    const raw =
      localStorage.getItem('ldm_material_directory') ||
      localStorage.getItem('ctvill_material_directory');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Reads stored BOM phases for a given project ID.
 */
export function getStoredBomPhases(projectId?: string): any[] {
  if (!projectId) return [];
  try {
    const raw = localStorage.getItem(`ldm_bom_${projectId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'type', 'works', 'work', 'load', 'bearing',
  'supply', 'installation', 'materials', 'material', 'complete', 'grade', 'class',
  'set', 'pcs', 'bags', 'lot', 'unit', 'units', 'mm', 'cm', 'thk', 'x'
]);

function extractKeywords(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

/**
 * Determines if a Material Directory item matches a BOM line item scope or category.
 */
export function doesMaterialMatchBomItem(
  mat: MaterialLedgerRecord,
  bomScope: string,
  phaseTitle: string
): boolean {
  const matText = `${mat.materialDescription || ''} ${mat.category || ''}`.toLowerCase();
  const scopeText = `${bomScope || ''}`.toLowerCase();
  const phaseText = `${phaseTitle || ''}`.toLowerCase();

  // Direct high-confidence domain mappings
  const pairs: Array<[RegExp, RegExp]> = [
    [/cement|portland|concrete\s*mix/i, /concrete|cement|footing|column|slab|plaster/i],
    [/rebar|reinforcing|steel\s*bar|deformed/i, /rebar|reinforcing|steel\s*bar|tie\s*wire/i],
    [/hollow\s*block|chb/i, /chb|hollow\s*block|masonry/i],
    [/phenolic|plywood|formwork|coco\s*lumber/i, /formwork|phenolic|scaffolding|shoring/i],
    [/wire|cable|thhn|breaker|panel|conduit|switch|outlet|light/i, /electrical|wiring|conduit|breaker|lighting|panel/i],
    [/pvc|pipe|ppr|plumbing|faucet|closet|lavatory/i, /plumbing|sanitary|waterline|pipe|fixture/i],
    [/paint|primer|putty|skimcoat|elastomeric/i, /paint|skimcoat|primer|coat/i],
    [/tile|granite|ceramic|adhesive|grout/i, /tile|tiling|floor\s*finish|granite/i],
    [/gypsum|hardiflex|ceiling|furring/i, /ceiling|gypsum|drywall|partition/i],
    [/roof|gi\s*sheet|purlin|truss|gutter/i, /roof|truss|purlin|gutter|sheeting/i],
    [/gravel|sand|aggregates|earth|backfill/i, /gravel|sand|earthwork|backfill|bedding/i],
    [/door|window|aluminum|glass|jamb/i, /door|window|glazing|glass/i],
  ];

  for (const [matRe, bomRe] of pairs) {
    if (matRe.test(matText) && (bomRe.test(scopeText) || bomRe.test(phaseText))) {
      return true;
    }
  }

  // Fallback keyword overlap (at least 2 shared meaningful tokens or 1 long specific token >= 6 chars)
  const matKw = extractKeywords(mat.materialDescription);
  const bomKw = new Set(extractKeywords(bomScope));
  let matches = 0;
  for (const kw of matKw) {
    if (bomKw.has(kw)) {
      matches++;
      if (kw.length >= 6) return true;
    }
  }
  return matches >= 2;
}

/**
 * Computes actual material spend for a project from the Material Directory.
 */
export function getProjectMaterialSpend(projectName?: string, allMaterials?: MaterialLedgerRecord[]): number {
  const materials = allMaterials || getStoredMaterialDirectory();
  const normProj = (projectName || '').trim().toLowerCase();

  return materials
    .filter((m) => {
      if (!normProj) return true;
      const mp = (m.projectName || '').trim().toLowerCase();
      if (!mp) return false;
      return mp === normProj || mp.includes(normProj) || normProj.includes(mp);
    })
    .reduce((sum, m) => {
      const qty = Math.max(Number(m.received || 0), Number(m.ordered || 0));
      return sum + qty * Number(m.unitCostPhp || 0);
    }, 0);
}

/**
 * Computes BOM line-item fulfillment, material cost overruns, and live Profit Margin % for a project.
 */
export function calculateProjectBomProfitSync(params: {
  projectId?: string;
  projectName?: string;
  phases?: any[];
  materials?: MaterialLedgerRecord[];
}): ProjectProfitSummary {
  const materials = params.materials || getStoredMaterialDirectory();
  const phases = params.phases || getStoredBomPhases(params.projectId);
  const normProj = (params.projectName || '').trim().toLowerCase();

  // Filter materials belonging to this project (or all if single-project / unassigned fallback)
  const projectMaterials = normProj
    ? materials.filter((m) => {
        const mp = (m.projectName || '').trim().toLowerCase();
        return !mp || mp === normProj || mp.includes(normProj) || normProj.includes(mp);
      })
    : materials;

  // Compute baseline profit from BOM phases if available, else default baseline ₱487,627
  let computedBomProfit = 0;
  let totalAllocatedBomMaterial = 0;
  const lineItemStatuses: Record<string, BomLineItemSyncStatus> = {};
  const consumedMaterialIds = new Set<string>();

  let totalOverrun = 0;
  let fulfilledCount = 0;
  let overrunCount = 0;

  if (phases && phases.length > 0) {
    for (const phase of phases) {
      const subPhases = Array.isArray(phase.subPhases) ? phase.subPhases : [];
      const phaseItems: any[] = [
        ...(Array.isArray(phase.items) ? phase.items : []),
        ...subPhases.flatMap((sp: any) => (Array.isArray(sp.items) ? sp.items : [])),
      ];
      for (const item of phaseItems) {
        const directCost = Number(item.noOfUnits || 0) * Number(item.unitCost || 0);
        const profitAmt = directCost * (Number(item.profitPct || 0) / 100);
        computedBomProfit += profitAmt;
        totalAllocatedBomMaterial += directCost;

        // Match Material Directory items to this BOM line item
        let actualSpend = 0;
        let matchedCount = 0;
        for (const mat of projectMaterials) {
          if (consumedMaterialIds.has(mat.id)) continue;
          if (doesMaterialMatchBomItem(mat, item.scopeOfWork, phase.title)) {
            const qty = Math.max(Number(mat.received || 0), Number(mat.ordered || 0));
            actualSpend += qty * Number(mat.unitCostPhp || 0);
            matchedCount++;
            consumedMaterialIds.add(mat.id);
          }
        }

        const isBudgetFulfilled = directCost > 0 && actualSpend >= directCost;
        const overrunAmount = directCost > 0 ? Math.max(0, actualSpend - directCost) : 0;

        if (isBudgetFulfilled) fulfilledCount++;
        if (overrunAmount > 0) {
          overrunCount++;
          totalOverrun += overrunAmount;
        }

        lineItemStatuses[item.id] = {
          itemId: item.id,
          scopeOfWork: item.scopeOfWork,
          allocatedCost: directCost,
          actualMaterialSpend: actualSpend,
          isBudgetFulfilled,
          overrunAmount,
          matchedMaterialCount: matchedCount,
        };
      }
    }
  }

  const totalMaterialSpend = projectMaterials.reduce((sum, m) => {
    const qty = Math.max(Number(m.received || 0), Number(m.ordered || 0));
    return sum + qty * Number(m.unitCostPhp || 0);
  }, 0);

  // If no phases stored yet for this project, still detect overruns if material spend exceeds baseline threshold
  const baselineProfit = computedBomProfit > 0 ? Math.round(computedBomProfit) : DEFAULT_BASELINE_PROFIT;
  const remainingProfit = Math.max(0, baselineProfit - totalOverrun);
  const profitMarginPct =
    baselineProfit > 0
      ? Math.max(0, Math.round((remainingProfit / baselineProfit) * 1000) / 10)
      : 100;

  return {
    baselineProfit,
    totalMaterialSpend,
    totalAllocatedBomMaterial,
    totalOverrun,
    remainingProfit,
    profitMarginPct,
    isIntact: totalOverrun <= 0,
    fulfilledCount,
    overrunCount,
    lineItemStatuses,
  };
}
