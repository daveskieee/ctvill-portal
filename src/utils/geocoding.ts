/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GeocodedLocation {
  name: string;
  region?: string;
  lat: number;
  lon: number;
  confidence?: 'EXACT_COORDINATES' | 'DICTIONARY_MATCH' | 'ONLINE_GEOCODED' | 'DEFAULT_FALLBACK';
}

/**
 * Curated Philippine Real Estate & Construction Geocoding Knowledge Base
 * Covers all NCR districts, commercial hubs, CALABARZON, Central & Northern Luzon, Visayas & Mindanao
 */
export const PHILIPPINES_GEOCODING_DIRECTORY: Array<{
  keywords: string[];
  lat: number;
  lon: number;
  displayName: string;
  region: string;
}> = [
  // --- METRO MANILA / NCR ---
  {
    keywords: ['bgc', 'bonifacio global city', 'bonifacio high street', 'fort bonifacio', 'market market', 'uptown mall'],
    lat: 14.5547,
    lon: 121.0509,
    displayName: 'Bonifacio Global City (BGC), Taguig',
    region: 'Metro Manila'
  },
  {
    keywords: ['taguig', 'arca south', 'fti', 'bicutan taguig'],
    lat: 14.5243,
    lon: 121.0792,
    displayName: 'Taguig City',
    region: 'Metro Manila'
  },
  {
    keywords: ['makati', 'ayala avenue', 'salcedo', 'legazpi village', 'bel-air', 'poblacion makati', 'buendia makati', 'rockwell'],
    lat: 14.5547,
    lon: 121.0244,
    displayName: 'Makati CBD',
    region: 'Metro Manila'
  },
  {
    keywords: ['ortigas', 'ortigas center', 'emerald avenue', 'garnet road'],
    lat: 14.5869,
    lon: 121.0614,
    displayName: 'Ortigas Center, Pasig',
    region: 'Metro Manila'
  },
  {
    keywords: ['pasig', 'kapitolyo', 'rosario pasig', 'brgy. rosario', 'tiendesitas', 'c5 pasig'],
    lat: 14.5764,
    lon: 121.0851,
    displayName: 'Pasig City',
    region: 'Metro Manila'
  },
  {
    keywords: ['mandaluyong', 'greenfield', 'shangri-la edsa', 'pioneer mandaluyong', 'shaw boulevard', 'wack-wack'],
    lat: 14.5794,
    lon: 121.0359,
    displayName: 'Mandaluyong City',
    region: 'Metro Manila'
  },
  {
    keywords: ['quezon city', 'qc', 'diliman', 'cubao', 'eastwood', 'katipunan', 'commonwealth', 'novaliches', 'timog', 'scout area', 'vertis north'],
    lat: 14.6760,
    lon: 121.0437,
    displayName: 'Quezon City',
    region: 'Metro Manila'
  },
  {
    keywords: ['alabang', 'filinvest city', 'madrigal business park', 'ayala alabang', 'festival mall'],
    lat: 14.4172,
    lon: 121.0436,
    displayName: 'Alabang, Muntinlupa',
    region: 'Metro Manila'
  },
  {
    keywords: ['muntinlupa', 'tunasan', 'sucat muntinlupa', 'poblacion muntinlupa'],
    lat: 14.3833,
    lon: 121.0500,
    displayName: 'Muntinlupa City',
    region: 'Metro Manila'
  },
  {
    keywords: ['paranaque', 'parañaque', 'bf homes', 'entertainment city', 'aseana', 'tambo', 'bicutan'],
    lat: 14.5028,
    lon: 120.9939,
    displayName: 'Parañaque City',
    region: 'Metro Manila'
  },
  {
    keywords: ['pasay', 'mall of asia', 'moa', 'roxas blvd', 'newport', 'naia', 'macapagal'],
    lat: 14.5378,
    lon: 120.9995,
    displayName: 'Pasay City',
    region: 'Metro Manila'
  },
  {
    keywords: ['manila', 'intramuros', 'malate', 'ermita', 'binondo', 'sampaloc', 'sta. cruz manila', 'paco'],
    lat: 14.5995,
    lon: 120.9842,
    displayName: 'City of Manila',
    region: 'Metro Manila'
  },
  {
    keywords: ['san juan', 'greenhills', 'annapolis', 'ortigas ave san juan'],
    lat: 14.6019,
    lon: 121.0355,
    displayName: 'San Juan City',
    region: 'Metro Manila'
  },
  {
    keywords: ['marikina', 'concepcion marikina', 'marikina heights', 'riverbanks'],
    lat: 14.6507,
    lon: 121.1029,
    displayName: 'Marikina City',
    region: 'Metro Manila'
  },
  {
    keywords: ['las pinas', 'las piñas', 'zapote', 'alabang-zapote', 'talon'],
    lat: 14.4445,
    lon: 120.9939,
    displayName: 'Las Piñas City',
    region: 'Metro Manila'
  },
  {
    keywords: ['valenzuela', 'karuhatan', 'malinta'],
    lat: 14.7011,
    lon: 120.9830,
    displayName: 'Valenzuela City',
    region: 'Metro Manila'
  },
  {
    keywords: ['caloocan', 'kalookan', 'monumento'],
    lat: 14.6571,
    lon: 120.9841,
    displayName: 'Caloocan City',
    region: 'Metro Manila'
  },
  {
    keywords: ['malabon', 'navotas', 'pateros'],
    lat: 14.6625,
    lon: 120.9571,
    displayName: 'Malabon / CAMANAVA',
    region: 'Metro Manila'
  },

  // --- CALABARZON (REGION IV-A) ---
  {
    keywords: ['cabuyao', 'san isidro cabuyao', 'mamatid', 'banlic', 'marinig', 'pulo cabuyao', 'cabuyao technopark'],
    lat: 14.2789,
    lon: 121.1245,
    displayName: 'Cabuyao, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['calamba', 'turbina', 'canlubang', 'parian calamba', 'pansol', 'bucal', 'mayapa', 'halang calamba'],
    lat: 14.2132,
    lon: 121.1678,
    displayName: 'Calamba, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['santa rosa', 'sta rosa', 'sta. rosa', 'nuvali', 'balibago', 'eton city', 'greenfield santa rosa', 'don jose'],
    lat: 14.3122,
    lon: 121.1114,
    displayName: 'Santa Rosa / Nuvali, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['binan', 'biñan', 'san pedro laguna', 'pacita', 'southwoods'],
    lat: 14.3384,
    lon: 121.0827,
    displayName: 'Biñan / San Pedro, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['los banos', 'los baños', 'uplb', 'college laguna', 'bay laguna'],
    lat: 14.1683,
    lon: 121.2435,
    displayName: 'Los Baños, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['cavinti', 'cavinti highland', 'cavinti crest', 'lumot lake', 'caliraya'],
    lat: 14.2492,
    lon: 121.5056,
    displayName: 'Cavinti, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['san pablo', 'san pablo city', 'sampaloc lake'],
    lat: 14.0683,
    lon: 121.3256,
    displayName: 'San Pablo City, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['pagsanjan', 'sta cruz laguna', 'santa cruz laguna', 'lumban', 'paete', 'siniloan'],
    lat: 14.2742,
    lon: 121.4556,
    displayName: 'Santa Cruz / Pagsanjan, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['laguna'],
    lat: 14.2789,
    lon: 121.1245,
    displayName: 'Laguna Province',
    region: 'CALABARZON'
  },

  // CAVITE
  {
    keywords: ['tagaytay', 'tagaytay city', 'kaybagal', 'mahogany', 'calamba road tagaytay'],
    lat: 14.1153,
    lon: 120.9621,
    displayName: 'Tagaytay City, Cavite',
    region: 'Cavite'
  },
  {
    keywords: ['silang', 'silang cavite', 'aguinaldo hwy silang'],
    lat: 14.2307,
    lon: 120.9748,
    displayName: 'Silang, Cavite',
    region: 'Cavite'
  },
  {
    keywords: ['imus', 'imus city', 'anabu', 'buhay na tubig'],
    lat: 14.4296,
    lon: 120.9367,
    displayName: 'Imus City, Cavite',
    region: 'Cavite'
  },
  {
    keywords: ['bacoor', 'bacoor city', 'molino', 'habay'],
    lat: 14.4624,
    lon: 120.9645,
    displayName: 'Bacoor City, Cavite',
    region: 'Cavite'
  },
  {
    keywords: ['dasmarinas', 'dasmariñas', 'paliparan', 'salawag', 'salitran'],
    lat: 14.3294,
    lon: 120.9367,
    displayName: 'Dasmariñas, Cavite',
    region: 'Cavite'
  },
  {
    keywords: ['general trias', 'gen trias', 'gentri', 'manggahan gen trias'],
    lat: 14.3862,
    lon: 120.8812,
    displayName: 'General Trias, Cavite',
    region: 'Cavite'
  },
  {
    keywords: ['carmona', 'carmona cavite'],
    lat: 14.3167,
    lon: 121.0500,
    displayName: 'Carmona, Cavite',
    region: 'Cavite'
  },
  {
    keywords: ['trece martires', 'naic', 'kawit', 'rosario cavite', 'tanza', 'maragondon', 'cavite'],
    lat: 14.2825,
    lon: 120.8669,
    displayName: 'Cavite Province',
    region: 'CALABARZON'
  },

  // BATANGAS
  {
    keywords: ['batangas city', 'pallocan', 'kumintang'],
    lat: 13.7565,
    lon: 121.0583,
    displayName: 'Batangas City',
    region: 'Batangas'
  },
  {
    keywords: ['lipa', 'lipa city', 'marawoy', 'tambo lipa'],
    lat: 13.9419,
    lon: 121.1644,
    displayName: 'Lipa City, Batangas',
    region: 'Batangas'
  },
  {
    keywords: ['santo tomas', 'sto tomas', 'sto. tomas batangas', 'fpip', 'first philippine industrial park'],
    lat: 14.1086,
    lon: 121.1417,
    displayName: 'Sto. Tomas, Batangas',
    region: 'Batangas'
  },
  {
    keywords: ['tanauan', 'tanauan city', 'tanauan batangas'],
    lat: 14.0864,
    lon: 121.1517,
    displayName: 'Tanauan, Batangas',
    region: 'Batangas'
  },
  {
    keywords: ['nasugbu', 'calatagan', 'san juan batangas', 'anilao', 'mabini batangas', 'lemery', 'taal batangas', 'batangas'],
    lat: 13.7565,
    lon: 121.0583,
    displayName: 'Batangas Province',
    region: 'CALABARZON'
  },

  // RIZAL
  {
    keywords: ['antipolo', 'antipolo city', 'masinag', 'hinulugang taktak', 'sumulong hwy'],
    lat: 14.5844,
    lon: 121.1764,
    displayName: 'Antipolo City, Rizal',
    region: 'Rizal'
  },
  {
    keywords: ['cainta', 'taytay', 'angono', 'san mateo rizal', 'rodriguez rizal', 'montalban', 'binangonan', 'tanay', 'rizal'],
    lat: 14.5778,
    lon: 121.1219,
    displayName: 'Cainta / Taytay, Rizal',
    region: 'Rizal'
  },

  // QUEZON PROVINCE
  {
    keywords: ['lucena', 'lucena city', 'tayabas', 'sariaya', 'candelaria quezon', 'quezon province'],
    lat: 13.9314,
    lon: 121.6172,
    displayName: 'Lucena City, Quezon',
    region: 'Quezon'
  },

  // --- CENTRAL LUZON (REGION III) ---
  {
    keywords: ['clark', 'clark freeport', 'angeles', 'angeles city', 'balibago angeles', 'mabalacat', 'pampanga'],
    lat: 15.1450,
    lon: 120.5887,
    displayName: 'Clark / Angeles City, Pampanga',
    region: 'Pampanga'
  },
  {
    keywords: ['san fernando pampanga', 'mexico pampanga', 'guagua', 'lubao'],
    lat: 15.0286,
    lon: 120.6897,
    displayName: 'San Fernando, Pampanga',
    region: 'Pampanga'
  },
  {
    keywords: ['malolos', 'meycauayan', 'marilao', 'san jose del monte', 'csjdm', 'bocaue', 'bulacan'],
    lat: 14.8527,
    lon: 120.8160,
    displayName: 'Malolos / Bulacan',
    region: 'Bulacan'
  },
  {
    keywords: ['subic', 'subic bay', 'olongapo', 'zambales'],
    lat: 14.8386,
    lon: 120.2842,
    displayName: 'Subic Bay / Olongapo',
    region: 'Central Luzon'
  },
  {
    keywords: ['bataan', 'balanga', 'mariveles', 'hermosa'],
    lat: 14.6806,
    lon: 120.5417,
    displayName: 'Balanga City, Bataan',
    region: 'Central Luzon'
  },
  {
    keywords: ['tarlac', 'tarlac city', 'capas', 'new clark city'],
    lat: 15.4802,
    lon: 120.5979,
    displayName: 'Tarlac / New Clark City',
    region: 'Central Luzon'
  },
  {
    keywords: ['cabanatuan', 'nueva ecija', 'gapan', 'palayan'],
    lat: 15.4859,
    lon: 120.9673,
    displayName: 'Cabanatuan, Nueva Ecija',
    region: 'Central Luzon'
  },

  // --- NORTHERN LUZON ---
  {
    keywords: ['baguio', 'baguio city', 'camp john hay', 'session road', 'benguet', 'la trinidad'],
    lat: 16.4023,
    lon: 120.5960,
    displayName: 'Baguio City, Benguet',
    region: 'Cordillera'
  },
  {
    keywords: ['la union', 'san fernando la union', 'urbiztondo', 'san juan la union'],
    lat: 16.6159,
    lon: 120.3209,
    displayName: 'San Fernando, La Union',
    region: 'Ilocos Region'
  },
  {
    keywords: ['dagupan', 'lingayen', 'urdaneta', 'pangasinan'],
    lat: 16.0433,
    lon: 120.3333,
    displayName: 'Dagupan, Pangasinan',
    region: 'Ilocos Region'
  },
  {
    keywords: ['laoag', 'ilocos norte', 'vigan', 'ilocos sur'],
    lat: 18.1960,
    lon: 120.5927,
    displayName: 'Laoag / Vigan, Ilocos',
    region: 'Ilocos Region'
  },
  {
    keywords: ['tuguegarao', 'cagayan valley', 'isabela', 'cauayan', 'santiago city'],
    lat: 17.6131,
    lon: 121.7269,
    displayName: 'Tuguegarao, Cagayan Valley',
    region: 'Cagayan Valley'
  },

  // --- VISAYAS ---
  {
    keywords: ['cebu', 'cebu city', 'cebu business park', 'it park cebu', 'lahug', 'mandaue', 'lapu-lapu', 'mactan', 'talisay cebu'],
    lat: 10.3157,
    lon: 123.8854,
    displayName: 'Cebu City / Mactan',
    region: 'Central Visayas'
  },
  {
    keywords: ['iloilo', 'iloilo city', 'mandurriao', 'iloilo business park', 'jaro', 'guimaras'],
    lat: 10.7202,
    lon: 122.5621,
    displayName: 'Iloilo City',
    region: 'Western Visayas'
  },
  {
    keywords: ['bacolod', 'bacolod city', 'negros occidental'],
    lat: 10.6765,
    lon: 122.9509,
    displayName: 'Bacolod City, Negros Occidental',
    region: 'Western Visayas'
  },
  {
    keywords: ['tagbilaran', 'bohol', 'panglao'],
    lat: 9.6444,
    lon: 123.8542,
    displayName: 'Tagbilaran / Panglao, Bohol',
    region: 'Central Visayas'
  },
  {
    keywords: ['dumaguete', 'negros oriental', 'sibulan'],
    lat: 9.3068,
    lon: 123.3054,
    displayName: 'Dumaguete City, Negros Oriental',
    region: 'Central Visayas'
  },
  {
    keywords: ['tacloban', 'leyte', 'ormoc'],
    lat: 11.2433,
    lon: 125.0039,
    displayName: 'Tacloban City, Leyte',
    region: 'Eastern Visayas'
  },
  {
    keywords: ['boracay', 'malay aklan', 'caticlan'],
    lat: 11.9674,
    lon: 121.9248,
    displayName: 'Boracay, Aklan',
    region: 'Western Visayas'
  },

  // --- MINDANAO ---
  {
    keywords: ['davao', 'davao city', 'bajada', 'matina', 'lanang', 'toril', 'davao del sur'],
    lat: 7.1907,
    lon: 125.4553,
    displayName: 'Davao City',
    region: 'Davao Region'
  },
  {
    keywords: ['cagayan de oro', 'cdo', 'misamis oriental', 'uptown cdo', 'macasandig'],
    lat: 8.4542,
    lon: 124.6319,
    displayName: 'Cagayan de Oro City',
    region: 'Northern Mindanao'
  },
  {
    keywords: ['general santos', 'gensan', 'south cotabato', 'koronadal'],
    lat: 6.1164,
    lon: 125.1716,
    displayName: 'General Santos City',
    region: 'SOCCSKSARGEN'
  },
  {
    keywords: ['zamboanga', 'zamboanga city'],
    lat: 6.9214,
    lon: 122.0790,
    displayName: 'Zamboanga City',
    region: 'Zamboanga Peninsula'
  },
  {
    keywords: ['butuan', 'butuan city', 'agusan del norte'],
    lat: 8.9475,
    lon: 125.5406,
    displayName: 'Butuan City',
    region: 'Caraga'
  },
  {
    keywords: ['iligan', 'iligan city', 'lanao del norte'],
    lat: 8.2280,
    lon: 124.2452,
    displayName: 'Iligan City',
    region: 'Northern Mindanao'
  }
];

/**
 * Checks if the string directly contains numeric latitude and longitude coordinates
 * (e.g. "14.5547, 121.0509" or "14.5547 N, 121.0509 E" or "@14.2789,121.1245")
 */
export function parseExplicitCoordinates(text: string): { lat: number; lon: number } | null {
  if (!text) return null;
  const coordRegex = /(-?\d{1,2}\.\d+)\s*(?:,|;|\/|\s)\s*(-?\d{1,3}\.\d+)/;
  const match = text.match(coordRegex);
  if (match) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return { lat, lon };
    }
  }
  return null;
}

/**
 * High-speed local dictionary lookup with token-level and substring scoring
 */
export function resolveLocalGeocoding(locationString: string): GeocodedLocation | null {
  if (!locationString || !locationString.trim()) return null;

  // 1. Check explicit coordinates
  const explicit = parseExplicitCoordinates(locationString);
  if (explicit) {
    return {
      name: locationString.trim(),
      region: 'Custom GPS Coordinates',
      lat: explicit.lat,
      lon: explicit.lon,
      confidence: 'EXACT_COORDINATES'
    };
  }

  const rawClean = locationString.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ');
  const normalized = ` ${rawClean} `;

  // 2. Score entries based on keyword specificity
  let bestMatch: (typeof PHILIPPINES_GEOCODING_DIRECTORY)[0] | null = null;
  let highestScore = 0;

  for (const entry of PHILIPPINES_GEOCODING_DIRECTORY) {
    for (const keyword of entry.keywords) {
      const kw = keyword.toLowerCase();
      // Whole-word or phrase boundary check
      if (normalized.includes(` ${kw} `) || normalized.includes(kw)) {
        // Longer keyword matches are more specific (e.g., 'bonifacio global city' > 'taguig')
        const score = kw.length * (kw.includes(' ') ? 2 : 1);
        if (score > highestScore) {
          highestScore = score;
          bestMatch = entry;
        }
      }
    }
  }

  if (bestMatch) {
    return {
      name: bestMatch.displayName,
      region: bestMatch.region,
      lat: bestMatch.lat,
      lon: bestMatch.lon,
      confidence: 'DICTIONARY_MATCH'
    };
  }

  return null;
}

/**
 * Online Geocoding via Open-Meteo Geocoding API with multi-token fallback
 */
export async function fetchOnlineGeocoding(locationQuery: string): Promise<GeocodedLocation | null> {
  if (!locationQuery || !locationQuery.trim()) return null;

  // Split comma or slash separated segments, starting from the most general/informative parts (e.g. city/province)
  const segments = locationQuery
    .split(/[,;/]/)
    .map(s => s.trim())
    .filter(s => s.length > 2);

  const candidateQueries: string[] = [];

  // 1. Direct query
  candidateQueries.push(locationQuery.trim());

  // 2. City/Province segment combinations from right to left (e.g., "Cabuyao, Laguna", "Cabuyao")
  if (segments.length > 1) {
    candidateQueries.push(segments.slice(-2).join(', '));
    candidateQueries.push(segments[segments.length - 1]);
    candidateQueries.push(segments[segments.length - 2]);
  }

  for (const q of candidateQueries) {
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=3&language=en&format=json`;
      const res = await fetch(url);
      if (!res.ok) continue;

      const data = await res.json();
      if (data && data.results && data.results.length > 0) {
        // Prioritize Philippines result if available
        const phResult = data.results.find((r: any) => r.country_code === 'PH') || data.results[0];
        return {
          name: phResult.name,
          region: [phResult.admin2, phResult.admin1, phResult.country].filter(Boolean).join(', '),
          lat: phResult.latitude,
          lon: phResult.longitude,
          confidence: 'ONLINE_GEOCODED'
        };
      }
    } catch (err) {
      // Continue to next query candidate
    }
  }

  return null;
}

/**
 * Unified Geocoding Resolver:
 * Resolves location synchronously from local dictionary, or asynchronously from Open-Meteo
 */
export async function resolveProjectCoordinatesAsync(
  locationString?: string,
  projectName?: string
): Promise<GeocodedLocation> {
  const combined = [locationString, projectName].filter(Boolean).join(' ');

  // 1. Try local dictionary first (0ms latency, handles Philippine addresses accurately)
  const localMatch = resolveLocalGeocoding(combined);
  if (localMatch) {
    return localMatch;
  }

  // 2. Try online geocoding if network is available
  if (locationString && locationString.trim()) {
    try {
      const online = await fetchOnlineGeocoding(locationString.trim());
      if (online) {
        return online;
      }
    } catch {
      // Offline fallback
    }
  }

  // 3. Graceful default fallback: Cabuyao, Laguna
  return {
    name: locationString || 'Laguna Project Site',
    region: 'Laguna, Philippines',
    lat: 14.2789,
    lon: 121.1245,
    confidence: 'DEFAULT_FALLBACK'
  };
}

/**
 * Synchronous resolver for immediate component rendering
 */
export function resolveProjectCoordinatesSync(
  locationString?: string,
  projectName?: string,
  existingLat?: number | null,
  existingLon?: number | null
): { lat: number; lon: number; name: string } {
  // If coordinates already saved in DB, use them directly
  if (existingLat !== undefined && existingLat !== null && existingLon !== undefined && existingLon !== null) {
    const latNum = Number(existingLat);
    const lonNum = Number(existingLon);
    if (!isNaN(latNum) && !isNaN(lonNum) && (latNum !== 0 || lonNum !== 0)) {
      return {
        lat: latNum,
        lon: lonNum,
        name: locationString || projectName || 'Project Site'
      };
    }
  }

  const combined = [locationString, projectName].filter(Boolean).join(' ');
  const match = resolveLocalGeocoding(combined);
  if (match) {
    return {
      lat: match.lat,
      lon: match.lon,
      name: match.name
    };
  }

  // Default Cabuyao Laguna
  return {
    lat: 14.2789,
    lon: 121.1245,
    name: locationString || 'Laguna, Philippines'
  };
}
