/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Zero-Overhead Asset Engine for LDM Construction
 * (Engineers • Architects • Builders)
 *
 * Uses Vite's ?url globbing to emit lightweight URL strings without Base64 bundle bloat.
 * Excludes logos from all portfolio slices so they never render as house cards.
 */

import ldmLogoDirectUrl from '../assets/images/LDM CONSTRUCTIONS ASSETS/ldm logo.png';

/**
 * Standardized Official LDM Construction Headquarters & Service Area
 */
export const LDM_COMPANY_LOCATION = 'Cabuyao, Laguna / Metro Manila & CALABARZON, Philippines';
export const LDM_COMPANY_PHONE = '(+63) 945 681 0515';
export const LDM_COMPANY_EMAIL = 'ldmengineeringdesign@gmail.com';

// Import raw image URLs using Vite eager glob
const rawAssets = import.meta.glob(
  '../assets/images/LDM CONSTRUCTIONS ASSETS/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG}',
  { eager: true, query: '?url', import: 'default' }
) as Record<string, string>;

export interface LdmPortfolioAsset {
  id: string;
  filename: string;
  url: string;
  title: string;
  category: 'architectural' | 'interior' | 'construction' | 'branding';
  categoryLabel: string;
  seriesId: string;
}

const assetEntries = Object.entries(rawAssets);

function extractSeriesId(filename: string): string {
  const parts = filename.split('_');
  if (parts.length >= 2) {
    return parts[1];
  }
  return 'general';
}

export function isLdmLogoFile(filename: string): boolean {
  const f = filename.toLowerCase();
  return (
    f.includes('logo') ||
    f.endsWith('ldm logo.png') ||
    f.endsWith('ldm-logo.png') ||
    f.endsWith('ldm_logo.png') ||
    f.includes('898851099112461') ||
    f.includes('899068149090756') ||
    f.includes('899068125757425') ||
    f.includes('898850') ||
    f.includes('899067') ||
    f.includes('899058') ||
    f.includes('900067')
  );
}

// 1. Resolve Official Primary Logo Asset (Strictly `ldm logo.png`)
const globLogoMatch = assetEntries.find(([path]) => {
  const f = (path.split('/').pop() || '').toLowerCase();
  return (
    f === 'ldm logo.png' ||
    f === 'ldm-logo.png' ||
    f === 'ldm_logo.png' ||
    (f.includes('logo') && f.endsWith('.png'))
  );
});

export const PRIMARY_LDM_LOGO: string =
  ldmLogoDirectUrl ||
  (globLogoMatch ? globLogoMatch[1] : '') ||
  '/ldm logo.png';

export const ldmLogoAssets: LdmPortfolioAsset[] = [
  {
    id: 'ldm-official-logo',
    filename: 'ldm logo.png',
    url: PRIMARY_LDM_LOGO,
    title: 'LDM Construction Official Corporate Brand Identity',
    category: 'branding',
    categoryLabel: 'LDM Brand Identity',
    seriesId: 'official-logo',
  },
];

// 2. Classify Real Projects (Excluding All Logos)
const realProjectEntries = assetEntries.filter(([path]) => !isLdmLogoFile(path.split('/').pop() || ''));

let archCount = 0;
let interiorCount = 0;
let constructionCount = 0;

export const allLdmPortfolioAssets: LdmPortfolioAsset[] = realProjectEntries.map(([path, url], idx) => {
  const filename = path.split('/').pop() || `ldm_asset_${idx}.jpg`;
  const f = filename.toLowerCase();
  const seriesId = extractSeriesId(filename);

  // Interior Series
  if (
    f.includes('132608') ||
    f.includes('132607') ||
    f.includes('921585') ||
    f.includes('100464') ||
    f.includes('100477') ||
    f.includes('101542') ||
    f.includes('103515') ||
    f.includes('104016') ||
    f.includes('105086') ||
    f.includes('128943')
  ) {
    interiorCount += 1;
    return {
      id: `ldm-int-${interiorCount}`,
      filename,
      url,
      title: `LDM Bespoke Interior & Millwork Fit-Out #${interiorCount}`,
      category: 'interior',
      categoryLabel: 'Bespoke Interior Fit-Out',
      seriesId,
    };
  }

  // Site Construction / Structural / Rebar / Formwork Field Series
  if (
    f.includes('133754') ||
    f.includes('133852') ||
    f.includes('133908') ||
    f.includes('133981') ||
    f.includes('135488') ||
    f.includes('136013') ||
    f.includes('136015') ||
    f.includes('136000') ||
    f.includes('123788') ||
    f.includes('123789') ||
    f.includes('128309') ||
    f.includes('131140')
  ) {
    constructionCount += 1;
    return {
      id: `ldm-con-${constructionCount}`,
      filename,
      url,
      title: `LDM Turnkey Structural & Site Progress #${constructionCount}`,
      category: 'construction',
      categoryLabel: 'Turnkey Civil & Structural Works',
      seriesId,
    };
  }

  // Architectural / Exterior / Residential Typology Series
  archCount += 1;
  return {
    id: `ldm-arch-${archCount}`,
    filename,
    url,
    title: `LDM Architectural Exterior & Residence Design #${archCount}`,
    category: 'architectural',
    categoryLabel: 'Architectural Designs',
    seriesId,
  };
});

// Category Slices (100% Guaranteed Logo-Free)
export const ldmArchitecturalAssets: LdmPortfolioAsset[] = allLdmPortfolioAssets.filter(
  (a) => a.category === 'architectural'
);

export const ldmInteriorAssets: LdmPortfolioAsset[] = allLdmPortfolioAssets.filter(
  (a) => a.category === 'interior'
);

export const ldmSiteConstructionAssets: LdmPortfolioAsset[] = allLdmPortfolioAssets.filter(
  (a) => a.category === 'construction'
);

// Curated Top-6 Hero Showcase Assets (Pure architectural & interior renders)
export const ldmHeroShowcaseAssets: LdmPortfolioAsset[] = [
  ldmArchitecturalAssets[0] || allLdmPortfolioAssets[0],
  ldmInteriorAssets[0] || allLdmPortfolioAssets[1],
  ldmArchitecturalAssets[1] || allLdmPortfolioAssets[2],
  ldmInteriorAssets[1] || allLdmPortfolioAssets[3],
  ldmArchitecturalAssets[2] || allLdmPortfolioAssets[4],
  ldmInteriorAssets[2] || allLdmPortfolioAssets[5],
].filter(Boolean);

/**
 * Filter and paginate real project assets safely
 */
export function getPaginatedLdmAssets(
  category: 'all' | 'featured' | 'architectural' | 'interior' | 'construction',
  limit: number = 12
): {
  items: LdmPortfolioAsset[];
  total: number;
  hasMore: boolean;
} {
  let filtered: LdmPortfolioAsset[] = [];

  if (category === 'all') {
    filtered = allLdmPortfolioAssets;
  } else if (category === 'featured') {
    filtered = [
      ...ldmArchitecturalAssets.slice(0, 4),
      ...ldmInteriorAssets.slice(0, 4),
      ...ldmSiteConstructionAssets.slice(0, 4),
    ];
  } else if (category === 'architectural') {
    filtered = ldmArchitecturalAssets;
  } else if (category === 'interior') {
    filtered = ldmInteriorAssets;
  } else if (category === 'construction') {
    filtered = ldmSiteConstructionAssets;
  }

  const items = filtered.slice(0, limit);
  return {
    items,
    total: filtered.length,
    hasMore: limit < filtered.length,
  };
}
