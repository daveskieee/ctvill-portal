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
      label: '2-Storey Residential Design & Build',
      baseRatePerSqm: 32000,
      standard: 32000,
      premium: 40000,
      bespoke: 49600,
      baseWeeks: 20,
      weekPer100Sqm: 4.0,
    },
    bpo: {
      id: 'bpo',
      label: 'Bungalow / A-Frame Custom Home',
      baseRatePerSqm: 28000,
      standard: 28000,
      premium: 35000,
      bespoke: 43400,
      baseWeeks: 14,
      weekPer100Sqm: 3.0,
    },
    tech: {
      id: 'tech',
      label: 'Bespoke Interior Design & Fit-Out',
      baseRatePerSqm: 22000,
      standard: 22000,
      premium: 27500,
      bespoke: 34100,
      baseWeeks: 8,
      weekPer100Sqm: 2.0,
    },
    retail: {
      id: 'retail',
      label: 'Commercial / Multi-Unit Townhouse Build',
      baseRatePerSqm: 35000,
      standard: 35000,
      premium: 43750,
      bespoke: 54250,
      baseWeeks: 24,
      weekPer100Sqm: 4.5,
    },
  },
  tierMultipliers: {
    standard: 1.0,
    premium: 1.25,
    bespoke: 1.55,
  },
  tierLabels: {
    standard: 'Standard Build / Bare-to-Basic Finish',
    premium: 'Premium Modern Architectural & Interior Finish',
    bespoke: 'Bespoke Luxury / Turnkey Designer Package',
  },
  updatedAt: new Date().toISOString(),
  updatedBy: 'LDM Construction Default Benchmark',
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

