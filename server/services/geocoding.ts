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
  isExactMatch?: boolean;
}

export interface LocationSuggestion {
  displayName: string;
  subLabel: string;
  fullAddress: string;
  lat: number;
  lng: number;
  isRecent?: boolean;
}

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
  // --- CALABARZON (REGION IV-A) - CABUYAO BARANGAYS & COMMERCIAL HUBS ---
  {
    keywords: ['sala', 'brgy sala', 'brgy. sala', 'sala cabuyao', 'brgy sala cabuyao', 'brgy. sala, cabuyao', 'villa caceres cabuyao'],
    lat: 14.2764,
    lon: 121.1256,
    displayName: 'Brgy. Sala, Cabuyao, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['banlic', 'brgy banlic', 'brgy. banlic', 'banlic cabuyao', 'brgy banlic cabuyao', 'brgy. banlic, cabuyao'],
    lat: 14.2612,
    lon: 121.1352,
    displayName: 'Brgy. Banlic, Cabuyao, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['pulo', 'brgy pulo', 'brgy. pulo', 'pulo cabuyao', 'cabuyao retail hub', 'cabuyao commercial', 'brgy. pulo, cabuyao', 'brgy pulo cabuyao'],
    lat: 14.2678,
    lon: 121.1287,
    displayName: 'Brgy. Pulo, Cabuyao, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['mamatid', 'brgy mamatid', 'brgy. mamatid', 'mamatid cabuyao', 'mabuhay city', 'mabuhay city cabuyao', 'brgy. mamatid, cabuyao'],
    lat: 14.2492,
    lon: 121.1378,
    displayName: 'Brgy. Mamatid, Cabuyao, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['marinig', 'brgy marinig', 'brgy. marinig', 'marinig cabuyao', 'brgy marinig cabuyao', 'brgy. marinig, cabuyao'],
    lat: 14.2783,
    lon: 121.1444,
    displayName: 'Brgy. Marinig, Cabuyao, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['banay banay', 'banay-banay', 'brgy banay banay', 'brgy. banay-banay', 'banay banay cabuyao', 'brgy. banay-banay, cabuyao'],
    lat: 14.2731,
    lon: 121.1198,
    displayName: 'Brgy. Banay-Banay, Cabuyao, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['niugan', 'brgy niugan', 'brgy. niugan', 'niugan cabuyao', 'cabuyao technopark', 'lisp 1 cabuyao', 'lisp cabuyao', 'brgy. niugan, cabuyao'],
    lat: 14.2685,
    lon: 121.1162,
    displayName: 'Brgy. Niugan, Cabuyao, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['gulod', 'brgy gulod', 'brgy. gulod', 'gulod cabuyao', 'brgy gulod cabuyao', 'brgy. gulod, cabuyao'],
    lat: 14.2922,
    lon: 121.1415,
    displayName: 'Brgy. Gulod, Cabuyao, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['butong', 'brgy butong', 'brgy. butong', 'butong cabuyao', 'brgy butong cabuyao', 'brgy. butong, cabuyao'],
    lat: 14.2886,
    lon: 121.1350,
    displayName: 'Brgy. Butong, Cabuyao, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['bigaa', 'brgy bigaa', 'brgy. bigaa', 'bigaa cabuyao', 'brgy bigaa cabuyao', 'brgy. bigaa, cabuyao'],
    lat: 14.2858,
    lon: 121.1305,
    displayName: 'Brgy. Bigaa, Cabuyao, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['san isidro cabuyao', 'brgy san isidro cabuyao', 'san isidro, cabuyao', 'brgy. san isidro cabuyao'],
    lat: 14.2801,
    lon: 121.1215,
    displayName: 'Brgy. San Isidro, Cabuyao, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['baclaran cabuyao', 'brgy baclaran cabuyao', 'brgy. baclaran cabuyao', 'baclaran, cabuyao'],
    lat: 14.2965,
    lon: 121.1472,
    displayName: 'Brgy. Baclaran, Cabuyao, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['casile', 'brgy casile', 'brgy. casile', 'casile cabuyao', 'casile, cabuyao'],
    lat: 14.2255,
    lon: 121.0789,
    displayName: 'Brgy. Casile, Cabuyao, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['diezmo', 'brgy diezmo', 'brgy. diezmo', 'diezmo cabuyao', 'diezmo, cabuyao'],
    lat: 14.2389,
    lon: 121.0965,
    displayName: 'Brgy. Diezmo, Cabuyao, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['pittland', 'brgy pittland', 'brgy. pittland', 'pittland cabuyao', 'pittland, cabuyao'],
    lat: 14.2465,
    lon: 121.0921,
    displayName: 'Brgy. Pittland, Cabuyao, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['cabuyao city center', 'cabuyao poblacion', 'poblacion cabuyao', 'cabuyao, laguna', 'cabuyao laguna', 'cabuyao city', 'cabuyao'],
    lat: 14.2789,
    lon: 121.1245,
    displayName: 'Cabuyao City Center, Laguna',
    region: 'Laguna'
  },
  // --- CALAMBA BARANGAYS ---
  {
    keywords: ['banadero', 'bañadero', 'brgy banadero', 'brgy. banadero', 'brgy bañadero', 'brgy. bañadero', 'banadero calamba', 'bañadero calamba'],
    lat: 14.2202,
    lon: 121.1654,
    displayName: 'Brgy. Bañadero, Calamba, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['canlubang', 'brgy canlubang', 'brgy. canlubang', 'canlubang calamba', 'carmelray', 'carmelray calamba'],
    lat: 14.2185,
    lon: 121.0967,
    displayName: 'Brgy. Canlubang, Calamba, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['bucal', 'brgy bucal', 'brgy. bucal', 'bucal calamba', 'bucal bypass'],
    lat: 14.1884,
    lon: 121.1762,
    displayName: 'Brgy. Bucal, Calamba, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['pansol', 'brgy pansol', 'brgy. pansol', 'pansol calamba', 'pansol hot springs'],
    lat: 14.1802,
    lon: 121.1852,
    displayName: 'Brgy. Pansol, Calamba, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['mayapa', 'brgy mayapa', 'brgy. mayapa', 'mayapa calamba'],
    lat: 14.2148,
    lon: 121.1345,
    displayName: 'Brgy. Mayapa, Calamba, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['parian', 'brgy parian', 'brgy. parian', 'parian calamba'],
    lat: 14.2081,
    lon: 121.1578,
    displayName: 'Brgy. Parian, Calamba, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['halang', 'brgy halang', 'brgy. halang', 'halang calamba'],
    lat: 14.2012,
    lon: 121.1664,
    displayName: 'Brgy. Halang, Calamba, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['turbina', 'brgy turbina', 'brgy. turbina', 'turbina calamba'],
    lat: 14.1925,
    lon: 121.1465,
    displayName: 'Brgy. Turbina, Calamba, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['real calamba', 'brgy real calamba', 'brgy. real calamba', 'calamba city hall'],
    lat: 14.2132,
    lon: 121.1678,
    displayName: 'Brgy. Real, Calamba, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['paciano', 'paciano rizal', 'brgy paciano rizal', 'brgy. paciano rizal'],
    lat: 14.2215,
    lon: 121.1392,
    displayName: 'Brgy. Paciano Rizal, Calamba, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['makiling', 'brgy makiling', 'brgy. makiling', 'makiling calamba'],
    lat: 14.1685,
    lon: 121.1612,
    displayName: 'Brgy. Makiling, Calamba, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['barandal', 'brgy barandal', 'brgy. barandal', 'barandal calamba'],
    lat: 14.2115,
    lon: 121.1215,
    displayName: 'Brgy. Barandal, Calamba, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['batino', 'brgy batino', 'brgy. batino', 'batino calamba'],
    lat: 14.2256,
    lon: 121.1189,
    displayName: 'Brgy. Batino, Calamba, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['calamba city center', 'poblacion calamba', 'calamba, laguna', 'calamba laguna', 'calamba city', 'calamba'],
    lat: 14.2132,
    lon: 121.1678,
    displayName: 'Calamba City Center, Laguna',
    region: 'Laguna'
  },

  // --- SANTA ROSA BARANGAYS ---
  {
    keywords: ['balibago', 'brgy balibago', 'brgy. balibago', 'balibago santa rosa', 'balibago sta rosa', 'target mall balibago'],
    lat: 14.2965,
    lon: 121.1057,
    displayName: 'Brgy. Balibago, Santa Rosa, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['don jose', 'brgy don jose', 'brgy. don jose', 'don jose santa rosa', 'nuvali don jose'],
    lat: 14.2625,
    lon: 121.0745,
    displayName: 'Brgy. Don Jose, Santa Rosa, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['tagapo', 'brgy tagapo', 'brgy. tagapo', 'tagapo santa rosa', 'sm sta rosa'],
    lat: 14.3125,
    lon: 121.1025,
    displayName: 'Brgy. Tagapo, Santa Rosa, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['pulong santa cruz', 'pulong sta cruz', 'brgy pulong santa cruz', 'brgy. pulong sta cruz', 'enchanted kingdom'],
    lat: 14.2912,
    lon: 121.0856,
    displayName: 'Brgy. Pulong Sta. Cruz, Santa Rosa, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['dila', 'brgy dila', 'brgy. dila', 'dila santa rosa', 'dila sta rosa'],
    lat: 14.3085,
    lon: 121.1125,
    displayName: 'Brgy. Dila, Santa Rosa, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['macabling', 'brgy macabling', 'brgy. macabling', 'macabling santa rosa'],
    lat: 14.3056,
    lon: 121.1185,
    displayName: 'Brgy. Macabling, Santa Rosa, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['sinalhan', 'brgy sinalhan', 'brgy. sinalhan', 'sinalhan santa rosa'],
    lat: 14.3212,
    lon: 121.1256,
    displayName: 'Brgy. Sinalhan, Santa Rosa, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['santa rosa city center', 'santa rosa', 'sta rosa', 'sta. rosa', 'nuvali', 'eton city', 'greenfield santa rosa'],
    lat: 14.3122,
    lon: 121.1114,
    displayName: 'Santa Rosa / Nuvali, Laguna',
    region: 'Laguna'
  },

  // --- BIÑAN & SAN PEDRO BARANGAYS ---
  {
    keywords: ['san antonio binan', 'brgy san antonio binan', 'san antonio, biñan', 'san antonio biñan'],
    lat: 14.3312,
    lon: 121.0856,
    displayName: 'Brgy. San Antonio, Biñan, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['mamplasan', 'brgy mamplasan', 'brgy. mamplasan', 'mamplasan binan'],
    lat: 14.3185,
    lon: 121.0712,
    displayName: 'Brgy. Mamplasan, Biñan, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['pacita', 'pacita complex', 'pacita san pedro', 'brgy pacita'],
    lat: 14.3512,
    lon: 121.0612,
    displayName: 'Pacita Complex, San Pedro, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['binan city center', 'binan', 'biñan', 'poblacion binan'],
    lat: 14.3384,
    lon: 121.0827,
    displayName: 'Biñan City Center, Laguna',
    region: 'Laguna'
  },
  {
    keywords: ['san pedro city center', 'san pedro laguna', 'san pedro city'],
    lat: 14.3585,
    lon: 121.0545,
    displayName: 'San Pedro City, Laguna',
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

export function resolveLocalGeocoding(locationString: string): GeocodedLocation | null {
  if (!locationString || !locationString.trim()) return null;

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

  let bestMatch: (typeof PHILIPPINES_GEOCODING_DIRECTORY)[0] | null = null;
  let highestScore = 0;

  for (const entry of PHILIPPINES_GEOCODING_DIRECTORY) {
    for (const keyword of entry.keywords) {
      const kw = keyword.toLowerCase();
      if (normalized.includes(` ${kw} `) || normalized.includes(kw)) {
        const score = kw.length * (kw.includes(' ') ? 2 : 1);
        if (score > highestScore) {
          highestScore = score;
          bestMatch = entry;
        }
      }
    }
  }

  if (bestMatch) {
    const offset = getDeterministicStreetOffset(locationString);
    const matchedKw = bestMatch.keywords.find(k => normalized.includes(k.toLowerCase())) || '';
    
    // Check if entry is an exact barangay or specific hub
    const isBarangayEntry = bestMatch.displayName.toLowerCase().startsWith('brgy') || 
                            bestMatch.displayName.toLowerCase().includes('subdivision') ||
                            bestMatch.displayName.toLowerCase().includes('complex');

    // Check if the user entered significant words not covered by the matched entry
    const cleanTokens = rawClean.trim().split(/\s+/).filter(w => 
      !['city', 'center', 'province', 'laguna', 'cavite', 'batangas', 'rizal', 'quezon', 'philippines', 'brgy', 'barangay', 'lot', 'blk', 'block', 'street', 'st'].includes(w)
    );
    const matchedKwTokens = matchedKw.toLowerCase().split(/\s+/);
    const hasUnmatchedSubLocation = cleanTokens.some(tok => tok.length > 3 && !matchedKwTokens.includes(tok));

    const isExact = isBarangayEntry || !hasUnmatchedSubLocation;

    return {
      name: bestMatch.displayName,
      region: bestMatch.region,
      lat: Number((bestMatch.lat + offset.latOffset).toFixed(6)),
      lon: Number((bestMatch.lon + offset.lonOffset).toFixed(6)),
      confidence: 'DICTIONARY_MATCH',
      isExactMatch: isExact
    };
  }

  return null;
}

export function getDeterministicStreetOffset(str: string): { latOffset: number; lonOffset: number } {
  if (!str || !str.trim()) return { latOffset: 0, lonOffset: 0 };
  let h1 = 5381;
  let h2 = 52711;
  const s = str.trim().toLowerCase();
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = ((h1 << 5) + h1) ^ c;
    h2 = ((h2 << 5) + h2) ^ (c * 33);
  }
  const latOffset = (((Math.abs(h1) % 10000) / 10000) - 0.5) * 0.007;
  const lonOffset = (((Math.abs(h2) % 10000) / 10000) - 0.5) * 0.007;
  return {
    latOffset: Number(latOffset.toFixed(6)),
    lonOffset: Number(lonOffset.toFixed(6))
  };
}

export async function fetchOnlineGeocoding(locationQuery: string): Promise<GeocodedLocation | null> {
  if (!locationQuery || !locationQuery.trim()) return null;

  const segments = locationQuery
    .split(/[,;/]/)
    .map(s => s.trim())
    .filter(s => s.length > 2);

  const candidateQueries: string[] = [locationQuery.trim()];

  // Micro-clean query: strip purok, sitio, lot, block, phase prefixes so core barangay/subdivision resolves
  const microClean = locationQuery
    .replace(/\b(purok|prk|sitio|blk|block|lot|phase|ph)\s*[\w\d-]+/gi, '')
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (microClean && microClean.length > 3 && microClean !== locationQuery.trim()) {
    candidateQueries.push(microClean);
  }

  if (segments.length > 1) {
    candidateQueries.push(segments.slice(-2).join(', '));
    if (segments.length > 2) {
      candidateQueries.push(segments.slice(-3).join(', '));
    }
    candidateQueries.push(segments[segments.length - 1]);
    candidateQueries.push(segments[segments.length - 2]);
  }

  // A. First try OpenStreetMap (Nominatim) for all 42,000+ Philippine barangays
  for (const q of candidateQueries) {
    try {
      const cleanQ = q.replace(/brgy\.?/gi, 'Barangay').trim();
      const searchQuery = cleanQ.toLowerCase().includes('philippines') ? cleanQ : `${cleanQ}, Philippines`;
      const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1&countrycodes=ph`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      
      const res = await fetch(osmUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'CTVillERP-Geocoding/1.0' }
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const first = data[0];
          const rawLat = parseFloat(first.lat);
          const rawLon = parseFloat(first.lon);
          if (!isNaN(rawLat) && !isNaN(rawLon)) {
            const displayParts = (first.display_name || '').split(',').map((s: string) => s.trim());
            const rawName = first.name || displayParts[0] || 'Project Site';
            const isAlreadyBarangay = rawName.toLowerCase().startsWith('brgy') || rawName.toLowerCase().startsWith('barangay');
            const barangayLabel = isAlreadyBarangay ? rawName : `Brgy. ${rawName}`;
            const cityProvince = displayParts.slice(1, 3).join(', ');
            const formattedName = cityProvince ? `${barangayLabel}, ${cityProvince}` : barangayLabel;

            // Apply deterministic street/purok/sitio offset so distinct lots within the same barangay get distinct coordinates
            const offset = getDeterministicStreetOffset(locationQuery);

            return {
              name: formattedName,
              region: first.display_name,
              lat: Number((rawLat + offset.latOffset).toFixed(6)),
              lon: Number((rawLon + offset.lonOffset).toFixed(6)),
              confidence: 'ONLINE_GEOCODED',
              isExactMatch: true
            };
          }
        }
      }
    } catch {
      // Fallback
    }
  }

  // B. Fallback to Open-Meteo
  for (const q of candidateQueries) {
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=3&language=en&format=json`;
      const res = await fetch(url);
      if (!res.ok) continue;

      const data = await res.json();
      if (data && data.results && data.results.length > 0) {
        const phResult = data.results.find((r: any) => r.country_code === 'PH') || data.results[0];
        return {
          name: phResult.name,
          region: [phResult.admin2, phResult.admin1, phResult.country].filter(Boolean).join(', '),
          lat: phResult.latitude,
          lon: phResult.longitude,
          confidence: 'ONLINE_GEOCODED',
          isExactMatch: false
        };
      }
    } catch {
      // Continue loop
    }
  }

  return null;
}

export async function resolveProjectCoordinates(
  locationString?: string,
  projectName?: string
): Promise<{ lat: number; lon: number; name: string }> {
  const combined = [locationString, projectName].filter(Boolean).join(' ');
  const localMatch = resolveLocalGeocoding(combined);
  if (localMatch && localMatch.isExactMatch) {
    return { lat: localMatch.lat, lon: localMatch.lon, name: localMatch.name };
  }

  if (locationString && locationString.trim()) {
    try {
      const online = await fetchOnlineGeocoding(locationString.trim());
      if (online) {
        return { lat: online.lat, lon: online.lon, name: online.name };
      }
    } catch {
      // Offline
    }
  }

  if (localMatch) {
    return { lat: localMatch.lat, lon: localMatch.lon, name: localMatch.name };
  }

  const offset = getDeterministicStreetOffset(combined || locationString || 'Cabuyao');
  return { 
    lat: Number((14.2789 + offset.latOffset).toFixed(6)), 
    lon: Number((121.1245 + offset.lonOffset).toFixed(6)), 
    name: locationString || 'Laguna Project Site' 
  };
}

/**
 * Nationwide Live Place Autocomplete Search for the Philippines (Google Maps Style)
 * Dynamically searches OpenStreetMap via Photon (Komoot) and Nominatim APIs
 * across all provinces, cities, municipalities, barangays, subdivisions, and streets.
 */
export async function searchLocationsNationwide(query: string): Promise<LocationSuggestion[]> {
  if (!query || query.trim().length < 2) return [];

  const cleanQuery = query.trim();
  const results: LocationSuggestion[] = [];
  const seenKeys = new Set<string>();

  // 0. Instant curated directory match
  const normQuery = cleanQuery.toLowerCase();
  for (const entry of PHILIPPINES_GEOCODING_DIRECTORY) {
    if (entry.keywords.some(k => k.includes(normQuery) || (normQuery.length >= 3 && k.startsWith(normQuery)))) {
      const coordKey = `${entry.lat.toFixed(4)},${entry.lon.toFixed(4)}`;
      if (!seenKeys.has(coordKey)) {
        seenKeys.add(coordKey);
        const nameParts = entry.displayName.split(',');
        const primary = nameParts[0].trim();
        const secondary = nameParts.slice(1).join(', ').trim() || `${entry.region}, Philippines`;
        results.push({
          displayName: primary,
          subLabel: secondary,
          fullAddress: `${entry.displayName}, Philippines`,
          lat: entry.lat,
          lng: entry.lon
        });
      }
    }
  }

  // 1. Primary: Photon Komoot API (Optimized for real-time live typeahead geocoding)
  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(cleanQuery)}&limit=8`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(photonUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'CTVillERP-Autocomplete/1.0' }
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.features)) {
        for (const f of data.features) {
          const props = f.properties || {};
          const countryCode = (props.countrycode || '').toUpperCase();
          const country = (props.country || '').toLowerCase();
          if (countryCode !== 'PH' && !country.includes('philippine')) continue;

          const coords = f.geometry?.coordinates;
          if (!coords || coords.length < 2) continue;
          const [lon, lat] = coords;
          if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) continue;

          const coordKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
          if (seenKeys.has(coordKey)) continue;
          seenKeys.add(coordKey);

          const primary = props.name || props.street || props.locality || props.district || props.city || 'Location';
          const secondaryParts = [
            props.street && props.street !== primary ? props.street : null,
            props.district && props.district !== primary && props.district !== props.street ? props.district : null,
            props.locality && props.locality !== primary && props.locality !== props.district && props.locality !== props.street ? props.locality : null,
            props.city && props.city !== primary ? props.city : null,
            props.state
          ].filter(Boolean);
          const subLabel = secondaryParts.join(', ');
          const fullAddress = `${primary}, ${subLabel}`;

          results.push({
            displayName: primary,
            subLabel,
            fullAddress,
            lat: Number(lat.toFixed(6)),
            lng: Number(lon.toFixed(6))
          });
        }
      }
    }
  } catch {
    // Failover
  }

  // 2. Secondary fallback: OpenStreetMap Nominatim API
  if (results.length < 3) {
    try {
      const qWithCountry = cleanQuery.toLowerCase().includes('philippines') ? cleanQuery : `${cleanQuery}, Philippines`;
      const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(qWithCountry)}&format=json&limit=6&addressdetails=1&countrycodes=ph`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(osmUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'CTVillERP-Autocomplete/1.0' }
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          for (const item of data) {
            const lat = parseFloat(item.lat);
            const lng = parseFloat(item.lon);
            if (isNaN(lat) || isNaN(lng)) continue;

            const coordKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
            if (seenKeys.has(coordKey)) continue;
            seenKeys.add(coordKey);

            const addr = item.address || {};
            const primary = item.name || addr.quarter || addr.suburb || addr.neighbourhood || addr.road || item.display_name.split(',')[0];
            const secondaryParts = [
              addr.city || addr.town || addr.municipality,
              addr.province || addr.state || addr.region,
              'Philippines'
            ].filter(Boolean);
            const subLabel = secondaryParts.join(', ');
            const fullAddress = item.display_name;

            results.push({
              displayName: primary,
              subLabel,
              fullAddress,
              lat: Number(lat.toFixed(6)),
              lng: Number(lng.toFixed(6))
            });
          }
        }
      }
    } catch {
      // Offline
    }
  }

  return results.slice(0, 8);
}

