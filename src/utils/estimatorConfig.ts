/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SpaceCategoryKey = 'corporate' | 'bpo' | 'tech' | 'retail';
export type FinishTierKey = 'standard' | 'premium' | 'bespoke';

export interface CategoryPricingConfig {
  id: SpaceCategoryKey;
  label: string;
  baseRatePerSqm: number;
  standard: number;
  premium: number;
  bespoke: number;
  baseWeeks: number;
  weekPer100Sqm: number;
}

export interface TierMultiplierConfig {
  standard: number;
  premium: number;
  bespoke: number;
}

export interface EstimatorConfig {
  categories: Record<SpaceCategoryKey, CategoryPricingConfig>;
  tierMultipliers: TierMultiplierConfig;
  tierLabels: Record<FinishTierKey, string>;
  updatedAt: string;
  updatedBy: string;
}

export const ESTIMATOR_CONFIG_STORAGE_KEY = 'ctvill_estimator_config';
export const ESTIMATOR_CONFIG_EVENT = 'ctvill-estimator-config-updated';

export const DEFAULT_ESTIMATOR_CONFIG: EstimatorConfig = {
  categories: {
    corporate: {
      id: 'corporate',
      label: 'Corporate Office',
      baseRatePerSqm: 14500,
      standard: 14500,
      premium: 19500,
      bespoke: 25000,
      baseWeeks: 5,
      weekPer100Sqm: 1.2,
    },
    bpo: {
      id: 'bpo',
      label: 'BPO / Call Center',
      baseRatePerSqm: 12500,
      standard: 12500,
      premium: 16800,
      bespoke: 21500,
      baseWeeks: 6,
      weekPer100Sqm: 1.0,
    },
    tech: {
      id: 'tech',
      label: 'Tech & Dev Studio',
      baseRatePerSqm: 15500,
      standard: 15500,
      premium: 21000,
      bespoke: 27500,
      baseWeeks: 5,
      weekPer100Sqm: 1.3,
    },
    retail: {
      id: 'retail',
      label: 'Retail Store / F&B',
      baseRatePerSqm: 16500,
      standard: 16500,
      premium: 23000,
      bespoke: 29500,
      baseWeeks: 4,
      weekPer100Sqm: 1.4,
    },
  },
  tierMultipliers: {
    standard: 1.0,
    premium: 1.35,
    bespoke: 1.75,
  },
  tierLabels: {
    standard: 'Standard Commercial',
    premium: 'Premium Modern',
    bespoke: 'Bespoke Executive',
  },
  updatedAt: new Date().toISOString(),
  updatedBy: 'System Default Benchmark',
};

export function getEstimatorConfig(): EstimatorConfig {
  if (typeof window === 'undefined') return DEFAULT_ESTIMATOR_CONFIG;
  try {
    const raw = localStorage.getItem(ESTIMATOR_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_ESTIMATOR_CONFIG;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.categories) return DEFAULT_ESTIMATOR_CONFIG;
    return {
      ...DEFAULT_ESTIMATOR_CONFIG,
      ...parsed,
      categories: {
        corporate: { ...DEFAULT_ESTIMATOR_CONFIG.categories.corporate, ...(parsed.categories?.corporate || {}) },
        bpo: { ...DEFAULT_ESTIMATOR_CONFIG.categories.bpo, ...(parsed.categories?.bpo || {}) },
        tech: { ...DEFAULT_ESTIMATOR_CONFIG.categories.tech, ...(parsed.categories?.tech || {}) },
        retail: { ...DEFAULT_ESTIMATOR_CONFIG.categories.retail, ...(parsed.categories?.retail || {}) },
      },
      tierMultipliers: {
        ...DEFAULT_ESTIMATOR_CONFIG.tierMultipliers,
        ...(parsed.tierMultipliers || {}),
      },
      tierLabels: {
        ...DEFAULT_ESTIMATOR_CONFIG.tierLabels,
        ...(parsed.tierLabels || {}),
      },
    };
  } catch {
    return DEFAULT_ESTIMATOR_CONFIG;
  }
}

export function saveEstimatorConfig(config: EstimatorConfig, actorName = 'Operations Admin'): EstimatorConfig {
  const next: EstimatorConfig = {
    ...config,
    updatedAt: new Date().toISOString(),
    updatedBy: actorName,
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(ESTIMATOR_CONFIG_STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent(ESTIMATOR_CONFIG_EVENT, { detail: next }));
    } catch {
      /* ignore quota errors */
    }
  }
  return next;
}

export function resetEstimatorConfig(): EstimatorConfig {
  const reset = {
    ...DEFAULT_ESTIMATOR_CONFIG,
    updatedAt: new Date().toISOString(),
    updatedBy: 'Reset to Default Benchmark',
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(ESTIMATOR_CONFIG_STORAGE_KEY, JSON.stringify(reset));
      window.dispatchEvent(new CustomEvent(ESTIMATOR_CONFIG_EVENT, { detail: reset }));
    } catch {
      /* ignore */
    }
  }
  return reset;
}

