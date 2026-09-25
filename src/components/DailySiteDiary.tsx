/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Sun, CloudRain, Cloud, CloudLightning, CloudSun, Wind, Droplets, 
  Thermometer, Compass, Gauge, AlertTriangle, CheckCircle2, 
  RefreshCw, MapPin, Calendar, Clock, Plus, X, ChevronRight,
  ShieldAlert, Sparkles, Umbrella, Eye, ArrowUpRight, Download,
  SlidersHorizontal, Check, ShieldCheck, Activity, Search,
  LocateFixed, Building2, Radio, Send, Users, ChevronDown, ChevronUp,
  Bell, Play, Pause, Megaphone, Smartphone, CheckCheck
} from 'lucide-react';
import { DailySiteLog, ProjectProfile, Contractor } from '../types';
import { resolveProjectCoordinatesSync } from '../utils/geocoding';

interface DailySiteDiaryProps {
  logs: DailySiteLog[];
  projects?: ProjectProfile[];
  contractors?: Contractor[];
  onAddLog: (log: Omit<DailySiteLog, 'id' | 'createdAt'>) => void;
  onToggleWeatherSuspension?: (projectId: string, suspended: boolean) => Promise<void> | void;
}

export interface SiteLocation {
  id: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
  projectId?: string;
}

export const DEFAULT_SITE_LOCATION: SiteLocation = {
  id: 'ctvill-main',
  name: 'CTVill Main Development Site',
  region: 'Laguna, Philippines',
  lat: 14.2789,
  lon: 121.1245,
};

export interface LiveWeatherData {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  precipitation: number;
  weatherCode: number;
  windSpeed: number;
  windDirection: number;
  pressure: number;
  time: string;
}

export interface HourlyForecastPoint {
  time: string; // ISO string e.g. "2026-09-17T14:00"
  hourLabel: string; // "2:00 PM"
  hour24: number; // 14
  temp: number;
  precipitationProb: number; // 0 - 100%
  precipitation: number; // mm
  weatherCode: number;
  windSpeed?: number; // km/h
  humidity?: number; // %
}

export interface DailyForecastItem {
  date: string;
  dayName: string;
  shortDayName?: string;
  fullDayName?: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipitationProb: number;
  windSpeedMax: number;
  avgHumidity?: number;
  hourlyPoints?: HourlyForecastPoint[];
  peakRainHour?: string;
  peakRainProb?: number;
  rainTimeWindow?: string;
  workImpactVerdict?: 'SAFE' | 'CAUTION' | 'HIGH_RISK';
}

interface TradeRule {
  id: string;
  name: string;
  maxWindSpeed: number; // km/h
  maxPrecipitation: number; // mm
  minTemp: number; // °C
  maxTemp: number; // °C
  maxHumidity: number; // %
  advice: string;
}

const TRADE_RULES: TradeRule[] = [
  {
    id: 'glazing',
    name: 'Exterior Glazing & Curtain Wall',
    maxWindSpeed: 28,
    maxPrecipitation: 0.1,
    minTemp: 12,
    maxTemp: 38,
    maxHumidity: 90,
    advice: 'Suction cup lifters and suspended scaffolds require wind speed under 28 km/h and zero moisture.'
  },
  {
    id: 'concrete',
    name: 'Structural Concrete Pouring',
    maxWindSpeed: 45,
    maxPrecipitation: 0.5,
    minTemp: 10,
    maxTemp: 35,
    maxHumidity: 95,
    advice: 'Extreme ambient heat causes rapid flash slump loss; rain washes out cement paste binder.'
  },
  {
    id: 'painting',
    name: 'Acoustic Drywall & Finish Painting',
    maxWindSpeed: 35,
    maxPrecipitation: 0.2,
    minTemp: 15,
    maxTemp: 38,
    maxHumidity: 80,
    advice: 'High relative humidity (>80%) delays latex drying and induces joint compound blistering.'
  },
  {
    id: 'roofing',
    name: 'Roofing & Waterproofing Membrane',
    maxWindSpeed: 25,
    maxPrecipitation: 0.0,
    minTemp: 14,
    maxTemp: 40,
    maxHumidity: 82,
    advice: 'Torch-applied bituthene and liquid sealants must be applied on bone-dry concrete substrates.'
  },
  {
    id: 'crane',
    name: 'Tower Crane Hoisting & Heavy Rigging',
    maxWindSpeed: 38,
    maxPrecipitation: 2.0,
    minTemp: 5,
    maxTemp: 45,
    maxHumidity: 100,
    advice: 'OSHA & DOLE safety protocols mandate crane boom lock-down when gust speeds exceed 38 km/h.'
  },
  {
    id: 'mepfs',
    name: 'MEPFS High-Voltage & Cable Pulling',
    maxWindSpeed: 50,
    maxPrecipitation: 0.2,
    minTemp: 10,
    maxTemp: 42,
    maxHumidity: 85,
    advice: 'Exposed electrical rough-ins and conduit pull boxes must stay dry to prevent dielectric breakdown.'
  }
];

export function parseHourlyAndDaily(dailyData: any, hourlyData: any): DailyForecastItem[] {
  if (!dailyData || !dailyData.time) return [];

  return dailyData.time.map((dateStr: string, idx: number) => {
    const dateObj = new Date(dateStr);
    const dayName = idx === 0 ? 'Today' : idx === 1 ? 'Tomorrow' : dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    const shortDayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    const fullDayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    
    // Find all hourly points belonging to this dateStr
    const hourlyPoints: HourlyForecastPoint[] = [];
    if (hourlyData && Array.isArray(hourlyData.time)) {
      for (let h = 0; h < hourlyData.time.length; h++) {
        const hTimeStr = hourlyData.time[h];
        if (hTimeStr && hTimeStr.startsWith(dateStr)) {
          const hDate = new Date(hTimeStr);
          const hour24 = hDate.getHours();
          const hourLabel = hDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
          hourlyPoints.push({
            time: hTimeStr,
            hourLabel,
            hour24,
            temp: hourlyData.temperature_2m ? Math.round(hourlyData.temperature_2m[h]) : 28,
            precipitationProb: hourlyData.precipitation_probability ? hourlyData.precipitation_probability[h] : 0,
            precipitation: hourlyData.precipitation ? Number(hourlyData.precipitation[h] || 0) : 0,
            weatherCode: hourlyData.weather_code ? hourlyData.weather_code[h] : 0,
            windSpeed: hourlyData.wind_speed_10m ? Math.round(hourlyData.wind_speed_10m[h]) : 12,
            humidity: hourlyData.relative_humidity_2m ? Math.round(hourlyData.relative_humidity_2m[h]) : 75,
          });
        }
      }
    }

    // Determine peak rain hour and probability during working hours (06:00 to 19:00)
    let peakPoint: HourlyForecastPoint | null = null;
    let maxProb = 0;
    
    hourlyPoints.forEach(p => {
      if (p.hour24 >= 6 && p.hour24 <= 19) {
        if (p.precipitationProb > maxProb) {
          maxProb = p.precipitationProb;
          peakPoint = p;
        }
      }
    });

    if (!peakPoint && hourlyPoints.length > 0) {
      hourlyPoints.forEach(p => {
        if (p.precipitationProb > maxProb) {
          maxProb = p.precipitationProb;
          peakPoint = p;
        }
      });
    }

    // Calculate rain time window (e.g. 1:00 PM – 5:00 PM)
    let rainTimeWindow = 'Dry Window: Clear throughout shift (<15%)';
    let workImpactVerdict: 'SAFE' | 'CAUTION' | 'HIGH_RISK' = 'SAFE';

    const highRainPoints = hourlyPoints.filter(p => p.precipitationProb >= 35 && p.hour24 >= 6 && p.hour24 <= 20);
    if (highRainPoints.length > 0) {
      const firstHour = highRainPoints[0].hourLabel;
      const lastHour = highRainPoints[highRainPoints.length - 1].hourLabel;
      rainTimeWindow = firstHour === lastHour ? `Rain risk around ${firstHour} (${maxProb}%)` : `${firstHour} – ${lastHour} (${maxProb}% Peak)`;
      workImpactVerdict = maxProb >= 70 ? 'HIGH_RISK' : 'CAUTION';
    } else if (maxProb >= 20 && peakPoint) {
      rainTimeWindow = `Spotty Showers ~${(peakPoint as HourlyForecastPoint).hourLabel} (${maxProb}%)`;
      workImpactVerdict = 'CAUTION';
    }

    const avgHumidity = hourlyPoints.length > 0
      ? Math.round(hourlyPoints.reduce((acc, p) => acc + (p.humidity || 75), 0) / hourlyPoints.length)
      : 75;

    return {
      date: dateStr,
      dayName,
      shortDayName,
      fullDayName,
      weatherCode: dailyData.weather_code ? dailyData.weather_code[idx] : 0,
      tempMax: dailyData.temperature_2m_max ? dailyData.temperature_2m_max[idx] : 32,
      tempMin: dailyData.temperature_2m_min ? dailyData.temperature_2m_min[idx] : 24,
      precipitationProb: dailyData.precipitation_probability_max ? dailyData.precipitation_probability_max[idx] : maxProb,
      windSpeedMax: dailyData.wind_speed_10m_max ? dailyData.wind_speed_10m_max[idx] : 15,
      avgHumidity,
      hourlyPoints,
      peakRainHour: peakPoint ? (peakPoint as HourlyForecastPoint).hourLabel : undefined,
      peakRainProb: maxProb,
      rainTimeWindow,
      workImpactVerdict,
    };
  });
}

// Cubic Bézier smoothing helper for meteorological curve graphs
export function getSmoothCurvePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export default function DailySiteDiary({ logs, projects = [], contractors = [], onAddLog, onToggleWeatherSuspension }: DailySiteDiaryProps) {
  // Coordinate resolver for project sites (explicit lat/lon or comprehensive geocoding)
  const resolveProjectCoordinates = useCallback((p: ProjectProfile): { lat: number; lon: number; name: string } => {
    return resolveProjectCoordinatesSync(p.location, p.name, p.latitude, p.longitude);
  }, []);

  // Initial site location based on active project coordinates or default
  const initialLocation = useMemo<SiteLocation>(() => {
    if (projects && projects.length > 0) {
      const p = projects[0];
      const coords = resolveProjectCoordinates(p);
      return {
        id: p.id,
        name: p.name,
        region: p.location || coords.name,
        lat: coords.lat,
        lon: coords.lon,
        projectId: p.id,
      };
    }
    return DEFAULT_SITE_LOCATION;
  }, [projects, resolveProjectCoordinates]);

  // Active dynamic location state
  const [selectedLocation, setSelectedLocation] = useState<SiteLocation>(initialLocation);

  // Automatically keep selectedLocation aligned with project list when data arrives or changes
  useEffect(() => {
    if (projects && projects.length > 0) {
      if (!selectedLocation.projectId || selectedLocation.id === 'ctvill-main') {
        const p = projects[0];
        const coords = resolveProjectCoordinates(p);
        setSelectedLocation({
          id: p.id,
          name: p.name,
          region: p.location || coords.name,
          lat: coords.lat,
          lon: coords.lon,
          projectId: p.id,
        });
      } else {
        const current = projects.find(p => p.id === selectedLocation.projectId);
        if (current) {
          const coords = resolveProjectCoordinates(current);
          if (
            Math.abs(coords.lat - selectedLocation.lat) > 0.0001 || 
            Math.abs(coords.lon - selectedLocation.lon) > 0.0001 ||
            current.name !== selectedLocation.name ||
            (current.location && current.location !== selectedLocation.region)
          ) {
            setSelectedLocation({
              id: current.id,
              name: current.name,
              region: current.location || coords.name,
              lat: coords.lat,
              lon: coords.lon,
              projectId: current.id,
            });
          }
        }
      }
    }
  }, [projects, selectedLocation.projectId, selectedLocation.id, selectedLocation.lat, selectedLocation.lon, selectedLocation.name, selectedLocation.region, resolveProjectCoordinates]);
  
  // Custom Geocoding Search & Device GPS States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isGpsLocating, setIsGpsLocating] = useState(false);

  // Force Majeure Weather Suspension State
  const activeProject = projects.find(p => p.id === selectedLocation.projectId);
  const [isForceMajeureSuspended, setIsForceMajeureSuspended] = useState<boolean>(
    Boolean(activeProject?.weatherSuspended)
  );
  const [suspensionReason, setSuspensionReason] = useState<string>('Extreme weather conditions (heavy rains / gale winds)');

  useEffect(() => {
    if (activeProject) {
      setIsForceMajeureSuspended(Boolean(activeProject.weatherSuspended));
    }
  }, [activeProject]);

  // Live Weather Telemetry State
  const [liveWeather, setLiveWeather] = useState<LiveWeatherData | null>(null);
  const [forecast, setForecast] = useState<DailyForecastItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isCachedTelemetry, setIsCachedTelemetry] = useState<boolean>(false);

  // Real-time Clock, Telemetry Streaming & Auto-Sync Engine
  const [phtClock, setPhtClock] = useState<string>('');
  const [secondsAgo, setSecondsAgo] = useState<number>(0);
  const [isAutoSyncActive, setIsAutoSyncActive] = useState<boolean>(true);
  const [syncCountdown, setSyncCountdown] = useState<number>(60);
  const [isSilentSyncing, setIsSilentSyncing] = useState<boolean>(false);

  // 7-Day Outlook & Google-Style Hourly Chart State
  const [selectedForecastIndex, setSelectedForecastIndex] = useState<number | null>(0);
  const [chartTab, setChartTab] = useState<'temperature' | 'precipitation' | 'wind'>('temperature');
  const [isFahrenheit, setIsFahrenheit] = useState<boolean>(false);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Force Majeure Worker Emergency Broadcast & Muster State
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState<boolean>(false);
  const [isBroadcasting, setIsBroadcasting] = useState<boolean>(false);
  const [broadcastConfirmed, setBroadcastConfirmed] = useState<boolean>(false);
  const [lastBroadcastTimestamp, setLastBroadcastTimestamp] = useState<string | null>(null);
  const [broadcastHeadcount, setBroadcastHeadcount] = useState<number>(0);
  const [testMobileNumbers, setTestMobileNumbers] = useState<string>('');
  const [selectedContractorIds, setSelectedContractorIds] = useState<string[]>([]);
  const [customBroadcastMessage, setCustomBroadcastMessage] = useState<string>('');
  const [isMessageCustomized, setIsMessageCustomized] = useState<boolean>(false);

  // Filter contractors active on this project site (Optional)
  const projectContractors = useMemo(() => {
    if (!contractors || contractors.length === 0) return [];
    return contractors.filter(c => {
      if (!c.activeProjectSite) return true;
      return (
        c.activeProjectSite === selectedLocation.name ||
        c.activeProjectSite === selectedLocation.projectId ||
        c.activeProjectSite.toLowerCase().includes(selectedLocation.name.toLowerCase()) ||
        selectedLocation.name.toLowerCase().includes(c.activeProjectSite.toLowerCase())
      );
    });
  }, [contractors, selectedLocation]);

  // Manual Weather Fallback State (Offline Resilience: condition, temperature, wind)
  const [isManualOverride, setIsManualOverride] = useState<boolean>(false);
  const [manualCondition, setManualCondition] = useState<'SUNNY' | 'OVERCAST' | 'RAINY' | 'STORM'>('SUNNY');
  const [manualTemp, setManualTemp] = useState<number>(29);
  const [manualWind, setManualWind] = useState<number>(16);

  // Modal State for Logging a Weather Observation
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [logNotes, setLogNotes] = useState<string>('');
  const [observerName, setObserverName] = useState<string>('');
  const [notification, setNotification] = useState<string | null>(null);

  // Trade Safety Calculator & What-If Simulator State
  const [selectedTrade, setSelectedTrade] = useState<TradeRule>(TRADE_RULES[0]);
  const [isSimulationMode, setIsSimulationMode] = useState<boolean>(false);
  const [simWind, setSimWind] = useState<number>(20);
  const [simPrecip, setSimPrecip] = useState<number>(0);
  const [simTemp, setSimTemp] = useState<number>(31);
  const [simHumidity, setSimHumidity] = useState<number>(65);

  // Device GPS Location Handler
  const handleUseDeviceGPS = () => {
    if (!navigator.geolocation) {
      setNotification('⚠️ Geolocation is not supported in this browser.');
      setTimeout(() => setNotification(null), 3500);
      return;
    }
    setIsGpsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setSelectedLocation({
          id: `gps-${Date.now()}`,
          name: 'Device GPS Site',
          region: `Coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
          lat: latitude,
          lon: longitude,
          projectId: selectedLocation.projectId
        });
        setIsGpsLocating(false);
        setNotification(`📍 Detected site GPS coordinates (${latitude.toFixed(4)}, ${longitude.toFixed(4)}). Fetching weather...`);
        setTimeout(() => setNotification(null), 3500);
      },
      (err) => {
        setIsGpsLocating(false);
        setNotification(`⚠️ GPS detection failed: ${err.message}. Using default location.`);
        setTimeout(() => setNotification(null), 3500);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Custom Geocoding Search via Open-Meteo API
  const handleSearchLocation = async (query: string) => {
    setSearchQuery(query);
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
        setShowSearchDropdown(true);
      }
    } catch (err) {
      console.warn('Geocoding search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (item: any) => {
    setSelectedLocation({
      id: `custom-${item.id}`,
      name: item.name,
      region: [item.admin1, item.country].filter(Boolean).join(', '),
      lat: item.latitude,
      lon: item.longitude,
      projectId: selectedLocation.projectId
    });
    setSearchQuery('');
    setShowSearchDropdown(false);
    setNotification(`📍 Site location set to ${item.name}, ${item.admin1 || ''}`);
    setTimeout(() => setNotification(null), 3500);
  };

  // Force Majeure Weather Suspension Toggle
  const handleToggleForceMajeure = async () => {
    const nextState = !isForceMajeureSuspended;
    setIsForceMajeureSuspended(nextState);

    const activeProjectId = selectedLocation.projectId || (projects && projects[0]?.id);
    if (activeProjectId) {
      try {
        await fetch(`/api/projects/${activeProjectId}/weather-suspension`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            suspended: nextState,
            reason: suspensionReason,
            actorName: observerName
          })
        });
        if (onToggleWeatherSuspension) {
          await onToggleWeatherSuspension(activeProjectId, nextState);
        }
      } catch (err) {
        console.warn('Error syncing weather suspension to server:', err);
      }
    }

    if (nextState) {
      // Automatically prompt worker emergency broadcast modal
      setIsBroadcastModalOpen(true);
      setBroadcastConfirmed(false);
    }

    setNotification(
      nextState
        ? '⚠️ WORK SUSPENDED DUE TO WEATHER (FORCE MAJEURE) ACTIVATED. Project timeline flagged for weather extension.'
        : '✅ Weather suspension lifted. Regular site execution resumed.'
    );
    setTimeout(() => setNotification(null), 4000);
  };

  // Transmit Worker Emergency Stoppage Dispatch
  const handleDispatchWorkerBroadcast = async () => {
    setIsBroadcasting(true);
    // Simulate real-time GSM/LTE multi-channel broadcast
    await new Promise(r => setTimeout(r, 1000));

    const nowPht = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' });
    setLastBroadcastTimestamp(nowPht);
    setBroadcastConfirmed(true);
    setIsBroadcasting(false);

    const testNumbersList = testMobileNumbers.split(',').map(s => s.trim()).filter(Boolean);
    const recipientSummary = [
      testNumbersList.length > 0 ? `${testNumbersList.length} test phone number(s) [${testNumbersList.join(', ')}]` : null,
      selectedContractorIds.length > 0 ? `${selectedContractorIds.length} subcontractor team(s)` : null,
      broadcastHeadcount > 0 ? `${broadcastHeadcount} personnel on site` : null,
    ].filter(Boolean).join(' and ') || 'Site siren & muster alarm protocol';

    // Auto-record official entry into Daily Site Diary
    onAddLog({
      date: new Date().toISOString(),
      weather: liveWeather ? (liveWeather.weatherCode >= 95 ? 'STORM' : liveWeather.precipitation > 0 ? 'RAINY' : 'OVERCAST') : 'RAINY',
      temperature: `${liveWeather ? liveWeather.temperature.toFixed(1) : manualTemp}°C`,
      activeHeadcount: broadcastHeadcount,
      equipmentOnSite: `Force Majeure Stoppage: Wind ${liveWeather?.windSpeed.toFixed(1) || 0} km/h, Rain ${liveWeather?.precipitation.toFixed(1) || 0} mm.${testMobileNumbers ? ` Test GSM dispatch: ${testMobileNumbers}.` : ''}`,
      toolboxTopic: `EMERGENCY BROADCAST: Force Majeure Work Stoppage (${selectedLocation.name})`,
      workCompleted: `OFFICIAL CTVILL SAFETY NOTICE: Work suspended under Force Majeure at ${selectedLocation.name}. Emergency GSM/Push dispatch transmitted at ${nowPht} PHT. Recipient target: ${recipientSummary}. High-elevation and outdoor operations halted; personnel evacuated to CTVill base camp safety shelter. Protocol compliant with DOLE-OSHC weather guidelines. Alert payload: "${customBroadcastMessage}"`,
      delaysOrIssues: `Contractual Weather Delay Initiated: ${suspensionReason}`,
      supervisorName: observerName,
    });

    setNotification(`📢 Emergency work suspension broadcast transmitted for ${selectedLocation.name}.`);
    setTimeout(() => setNotification(null), 4000);
  };

  // Interpret WMO Weather Code
  const getWeatherInfo = (code: number) => {
    switch (code) {
      case 0:
        return { label: 'Clear Sky', icon: Sun, color: 'text-amber-400', badgeColor: 'bg-amber-950/80 border-amber-800 text-amber-300', conditionType: 'SUNNY' as const };
      case 1:
      case 2:
        return { label: 'Mainly Clear / Partly Cloudy', icon: CloudSun, color: 'text-amber-300', badgeColor: 'bg-blue-950/80 border-blue-800 text-blue-300', conditionType: 'SUNNY' as const };
      case 3:
        return { label: 'Overcast Skies', icon: Cloud, color: 'text-slate-300', badgeColor: 'bg-slate-800/80 border-slate-700 text-slate-300', conditionType: 'OVERCAST' as const };
      case 45:
      case 48:
        return { label: 'Dense Mist / Fog', icon: Cloud, color: 'text-indigo-300', badgeColor: 'bg-indigo-950/80 border-indigo-800 text-indigo-300', conditionType: 'OVERCAST' as const };
      case 51:
      case 53:
      case 55:
        return { label: 'Light Drizzle', icon: CloudRain, color: 'text-blue-400', badgeColor: 'bg-blue-950/80 border-blue-800 text-blue-300', conditionType: 'RAINY' as const };
      case 61:
      case 63:
      case 65:
        return { label: 'Precipitation / Rain Showers', icon: CloudRain, color: 'text-blue-400', badgeColor: 'bg-blue-950/80 border-blue-800 text-blue-300', conditionType: 'RAINY' as const };
      case 80:
      case 81:
      case 82:
        return { label: 'Heavy Downpour', icon: CloudRain, color: 'text-rose-400', badgeColor: 'bg-rose-950/80 border-rose-800 text-rose-300', conditionType: 'RAINY' as const };
      case 95:
      case 96:
      case 99:
        return { label: 'Severe Thunderstorm', icon: CloudLightning, color: 'text-amber-400', badgeColor: 'bg-rose-950/80 border-rose-800 text-rose-300', conditionType: 'STORM' as const };
      default:
        return { label: 'Variable Atmospheric', icon: CloudSun, color: 'text-slate-300', badgeColor: 'bg-slate-800/80 border-slate-700 text-slate-300', conditionType: 'OVERCAST' as const };
    }
  };

  // Convert Wind Direction Degrees to Cardinal Direction
  const getWindDirection = (degrees: number) => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round((degrees % 360) / 22.5) % 16;
    return directions[index];
  };

  // Fetch Live Weather with PostgreSQL local cache, hourly model & offline resilience
  const fetchWeather = useCallback(async (isSilent: boolean = false, forceFresh: boolean = false) => {
    if (!isSilent) {
      setIsLoading(true);
    } else {
      setIsSilentSyncing(true);
    }
    setFetchError(null);
    try {
      // 1. First Priority: Call backend endpoint backed by PostgreSQL weather cache & hourly model
      try {
        const siteKey = `proj_${selectedLocation.projectId || 'site'}_${selectedLocation.lat.toFixed(4)}_${selectedLocation.lon.toFixed(4)}`;
        const query = `?lat=${selectedLocation.lat}&lon=${selectedLocation.lon}&siteKey=${siteKey}${forceFresh ? '&fresh=true' : ''}`;
        const backendRes = await fetch(`/api/weather/live${query}`);
        if (backendRes.ok) {
          const bData = await backendRes.json();
          if (bData?.current) {
            const c = bData.current;
            setLiveWeather({
              temperature: c.temperature_2m ?? c.temperature ?? 30,
              apparentTemperature: c.apparent_temperature ?? c.apparentTemperature ?? 34,
              humidity: c.relative_humidity_2m ?? c.humidity ?? 75,
              precipitation: c.precipitation ?? 0,
              weatherCode: c.weather_code ?? c.weatherCode ?? 1,
              windSpeed: c.wind_speed_10m ?? c.windSpeed ?? 12,
              windDirection: c.wind_direction_10m ?? c.windDirection ?? 90,
              pressure: c.surface_pressure ?? c.pressure ?? 1012,
              time: c.time || new Date().toISOString(),
            });
            setIsCachedTelemetry(bData.source === 'POSTGRES_CACHE');
            setIsManualOverride(false);

            if (!isSimulationMode) {
              setSimWind(Math.round(c.wind_speed_10m ?? c.windSpeed ?? 12));
              setSimPrecip(c.precipitation ?? 0);
              setSimTemp(Math.round(c.temperature_2m ?? c.temperature ?? 30));
              setSimHumidity(c.relative_humidity_2m ?? c.humidity ?? 75);
            }

            if (bData.daily && bData.daily.time) {
              const days = parseHourlyAndDaily(bData.daily, bData.hourly);
              setForecast(days);
            }

            setLastFetched(new Date());
            setSecondsAgo(0);
            setSyncCountdown(60);
            setIsLoading(false);
            setIsSilentSyncing(false);
            return;
          }
        }
      } catch (backendErr) {
        console.warn('Backend weather endpoint unavailable, attempting direct provider:', backendErr);
      }

      // 2. Direct Open-Meteo fallback with hourly parameters
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${selectedLocation.lat}&longitude=${selectedLocation.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=Asia%2FManila`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Weather telemetry server returned code ${res.status}`);
      const data = await res.json();

      if (data.current) {
        setLiveWeather({
          temperature: data.current.temperature_2m,
          apparentTemperature: data.current.apparent_temperature,
          humidity: data.current.relative_humidity_2m,
          precipitation: data.current.precipitation,
          weatherCode: data.current.weather_code,
          windSpeed: data.current.wind_speed_10m,
          windDirection: data.current.wind_direction_10m,
          pressure: data.current.surface_pressure,
          time: data.current.time,
        });
        setIsCachedTelemetry(false);
        setIsManualOverride(false);

        if (!isSimulationMode) {
          setSimWind(Math.round(data.current.wind_speed_10m));
          setSimPrecip(data.current.precipitation);
          setSimTemp(Math.round(data.current.temperature_2m));
          setSimHumidity(data.current.relative_humidity_2m);
        }
      }

      if (data.daily && data.daily.time) {
        const days = parseHourlyAndDaily(data.daily, data.hourly);
        setForecast(days);
      }

      setLastFetched(new Date());
      setSecondsAgo(0);
      setSyncCountdown(60);
    } catch (err: any) {
      console.warn('Weather sensors offline, switching to graceful manual input:', err);
      setFetchError('Offline or location services unreachable. Manual site override enabled.');
      setIsManualOverride(true);
      const code = manualCondition === 'SUNNY' ? 0 : manualCondition === 'OVERCAST' ? 3 : manualCondition === 'RAINY' ? 61 : 95;
      setLiveWeather({
        temperature: manualTemp,
        apparentTemperature: manualTemp + 1,
        humidity: 75,
        precipitation: manualCondition === 'RAINY' ? 4.5 : manualCondition === 'STORM' ? 22 : 0,
        weatherCode: code,
        windSpeed: manualCondition === 'STORM' ? 48 : 14,
        windDirection: 90,
        pressure: 1012,
        time: new Date().toISOString()
      });
    } finally {
      setIsLoading(false);
      setIsSilentSyncing(false);
    }
  }, [selectedLocation, isSimulationMode, manualCondition, manualTemp]);

  // Master 1-Second Real-time Clock & Auto-Sync Engine
  useEffect(() => {
    const getPht = () => {
      return new Date().toLocaleTimeString('en-US', {
        timeZone: 'Asia/Manila',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    };
    setPhtClock(getPht());

    const timer = setInterval(() => {
      setPhtClock(getPht());
      setSecondsAgo(prev => prev + 1);

      if (isAutoSyncActive) {
        setSyncCountdown(prev => {
          if (prev <= 1) {
            fetchWeather(true, false);
            return 60;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isAutoSyncActive, fetchWeather]);

  useEffect(() => {
    fetchWeather(false, false);
  }, [fetchWeather]);

  // Operational Site Advisory based on Live Meteorological Conditions
  const getSiteAdvisory = () => {
    if (!liveWeather) return { level: 'NORMAL', text: 'Telemetry initializing...', color: 'text-slate-400', bg: 'bg-slate-900 border-slate-800' };

    if (liveWeather.weatherCode >= 95) {
      return {
        level: 'SEVERE',
        text: 'Thunderstorm Warning: Suspend all rooftop, facade, and crane operations. Disconnect exposed electrical connections.',
        color: 'text-rose-300',
        bg: 'bg-rose-950/80 border-rose-800'
      };
    }
    if (liveWeather.precipitation > 2.0 || liveWeather.weatherCode >= 80) {
      return {
        level: 'WARNING',
        text: 'Rain Alert: Protect open materials and moisture-sensitive finishes. External works subject to slippage risk.',
        color: 'text-amber-300',
        bg: 'bg-amber-950/80 border-amber-800'
      };
    }
    if (liveWeather.windSpeed > 35) {
      return {
        level: 'WARNING',
        text: 'High Wind Alert (>35 km/h): Secure loose facade panels, scaffolding tarps, and suspend crane hoisting.',
        color: 'text-amber-300',
        bg: 'bg-amber-950/80 border-amber-800'
      };
    }
    if (liveWeather.temperature >= 35) {
      return {
        level: 'CAUTION',
        text: 'Extreme Heat Index (>35°C): Enforce mandatory hydration rotations and frequent rest breaks in shaded zones.',
        color: 'text-amber-300',
        bg: 'bg-amber-950/80 border-amber-800'
      };
    }

    return {
      level: 'OPTIMAL',
      text: 'Optimal Meteorological Conditions: Safe for all indoor fit-out, external facade, joinery, and MEPFS installations.',
      color: 'text-emerald-300',
      bg: 'bg-emerald-950/80 border-emerald-800'
    };
  };

  const advisory = getSiteAdvisory();
  const currentWeatherInfo = liveWeather ? getWeatherInfo(liveWeather.weatherCode) : getWeatherInfo(0);
  const CurrentIcon = currentWeatherInfo.icon;

  // Keep alert message in sync with site and weather telemetry until user manually edits it
  useEffect(() => {
    if (!isMessageCustomized) {
      const windVal = liveWeather ? liveWeather.windSpeed.toFixed(1) : manualWind;
      const rainVal = liveWeather ? liveWeather.precipitation.toFixed(1) : '0.0';
      setCustomBroadcastMessage(
        `⚠️ [CTVILL SAFETY ALERT] EMERGENCY WORK SUSPENSION: Operations at ${selectedLocation.name} are suspended under Force Majeure effective immediately due to adverse weather (${currentWeatherInfo.label}, Wind: ${windVal} km/h, Rain: ${rainVal} mm). All high-elevation scaffolding, crane lifting, hot works, and exterior activities are strictly halted. All trade personnel must secure loose materials, disconnect power, and muster at CTVill Base Camp Safety Shelter.`
      );
    }
  }, [selectedLocation, currentWeatherInfo.label, liveWeather, manualWind, isMessageCustomized]);

  // Compute Trade Safety Analysis
  const activeWind = isSimulationMode ? simWind : (liveWeather ? liveWeather.windSpeed : 0);
  const activePrecip = isSimulationMode ? simPrecip : (liveWeather ? liveWeather.precipitation : 0);
  const activeTemp = isSimulationMode ? simTemp : (liveWeather ? liveWeather.temperature : 25);
  const activeHumidity = isSimulationMode ? simHumidity : (liveWeather ? liveWeather.humidity : 60);

  const calculateTradeSafety = () => {
    const reasons: string[] = [];
    let isNoGo = false;
    let isCaution = false;

    if (activeWind > selectedTrade.maxWindSpeed) {
      reasons.push(`Wind speed (${activeWind.toFixed(1)} km/h) exceeds safe ceiling of ${selectedTrade.maxWindSpeed} km/h`);
      isNoGo = true;
    } else if (activeWind > selectedTrade.maxWindSpeed * 0.8) {
      reasons.push(`Wind velocity near limit (${activeWind.toFixed(1)} km/h / ${selectedTrade.maxWindSpeed} km/h)`);
      isCaution = true;
    }

    if (activePrecip > selectedTrade.maxPrecipitation) {
      reasons.push(`Rainfall precipitation (${activePrecip.toFixed(1)} mm) exceeds threshold of ${selectedTrade.maxPrecipitation} mm`);
      isNoGo = true;
    }

    if (activeTemp > selectedTrade.maxTemp) {
      reasons.push(`Excessive heat (${activeTemp.toFixed(1)}°C) exceeds safety limit of ${selectedTrade.maxTemp}°C`);
      isCaution = true;
    }

    if (activeHumidity > selectedTrade.maxHumidity) {
      reasons.push(`Ambient humidity (${activeHumidity}%) exceeds trade ceiling of ${selectedTrade.maxHumidity}%`);
      isCaution = true;
    }

    if (isNoGo) {
      return {
        verdict: 'NO-GO (SUSPEND OPERATION)',
        badgeColor: 'bg-rose-950 text-rose-300 border-rose-800',
        textColor: 'text-rose-400',
        score: 35,
        reasons
      };
    }
    if (isCaution) {
      return {
        verdict: 'CAUTION (PROCEED WITH MONITORING)',
        badgeColor: 'bg-amber-950 text-amber-300 border-amber-800',
        textColor: 'text-amber-400',
        score: 75,
        reasons
      };
    }
    return {
      verdict: 'GO (ALL CLEAR / SAFE FOR DEPLOYMENT)',
      badgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-800',
      textColor: 'text-emerald-400',
      score: 98,
      reasons: ['Atmospheric indicators within all standard engineering safety margins.']
    };
  };

  const tradeSafety = calculateTradeSafety();

  // Open and Sync Weather Observation Modal with Live Sensor Readings
  const handleOpenLogModal = () => {
    if (liveWeather) {
      setManualCondition(currentWeatherInfo.conditionType);
      setManualTemp(Number(liveWeather.temperature.toFixed(1)));
    }
    setObserverName('');
    setLogNotes('');
    setIsModalOpen(true);
  };

  // Handle Recording Current Live Weather Snapshot to System Logs
  const handleSaveObservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveWeather) return;

    const finalWeatherType = manualCondition;
    const finalTemp = `${manualTemp}°C`;
    const finalLabel = manualCondition === currentWeatherInfo.conditionType
      ? currentWeatherInfo.label
      : manualCondition === 'SUNNY'
      ? 'Clear Sky'
      : manualCondition === 'OVERCAST'
      ? 'Overcast'
      : manualCondition === 'RAINY'
      ? (liveWeather && liveWeather.weatherCode === 51 ? 'Light Drizzle' : 'Light Rain')
      : 'Heavy Rain / Suspended';

    onAddLog({
      date: new Date().toISOString(),
      weather: finalWeatherType,
      temperature: finalTemp,
      activeHeadcount: 0,
      equipmentOnSite: `Wind: ${liveWeather.windSpeed.toFixed(1)} km/h (${getWindDirection(liveWeather.windDirection)}) | Humidity: ${liveWeather.humidity}% | Mode: ${isManualOverride ? 'Manual Field Entry' : isCachedTelemetry ? 'Telemetry Cache' : 'Live Sensor'}`,
      toolboxTopic: `Weather Condition: ${finalLabel}`,
      workCompleted: `Meteorological Snapshot for ${selectedLocation.name} (${selectedLocation.region}): ${finalLabel}. Ambient: ${finalTemp}, Humidity: ${liveWeather.humidity}%, Wind: ${liveWeather.windSpeed.toFixed(1)} km/h. ${logNotes.trim() ? `Field Note: ${logNotes.trim()}` : ''}`,
      delaysOrIssues: (liveWeather.precipitation > 0 || finalWeatherType === 'STORM') ? `Precipitation recorded: ${liveWeather.precipitation} mm` : undefined,
      supervisorName: observerName.trim() || 'Site Supervisor',
    });

    setLogNotes('');
    setObserverName('');
    setIsModalOpen(false);
    setNotification('Weather observation archived to project daily site log.');
    setTimeout(() => setNotification(null), 3500);
  };

  // Direct 1-Click Action: Log Trade Safety Verdict to Diary
  const handleLogTradeSafetyResult = () => {
    onAddLog({
      date: new Date().toISOString(),
      weather: currentWeatherInfo.conditionType,
      temperature: `${activeTemp.toFixed(1)}°C`,
      activeHeadcount: 0,
      equipmentOnSite: `Wind: ${activeWind.toFixed(1)} km/h | Rain: ${activePrecip.toFixed(1)} mm | Humidity: ${activeHumidity}% | Mode: ${isSimulationMode ? 'What-If Simulation' : 'Live Sensor'}`,
      toolboxTopic: `Trade Safety Audit: ${selectedTrade.name} - ${tradeSafety.verdict}`,
      workCompleted: `Safety Assessment for ${selectedTrade.name} at ${selectedLocation.name}. Verdict: ${tradeSafety.verdict}. Parameters: Wind ${activeWind.toFixed(1)} km/h, Temp ${activeTemp.toFixed(1)}°C, Rain ${activePrecip.toFixed(1)} mm, Humidity ${activeHumidity}%. Analysis Notes: ${tradeSafety.reasons.join('; ')}. Protocol: ${selectedTrade.advice}`,
      delaysOrIssues: tradeSafety.verdict.includes('NO-GO') ? `Safety work stoppage advised: ${tradeSafety.reasons[0]}` : undefined,
      supervisorName: 'Safety PM & Quality Lead',
    });

    setNotification(`Safety assessment for "${selectedTrade.name}" recorded into Project Diary!`);
    setTimeout(() => setNotification(null), 3500);
  };

  // Export Logs to CSV
  const handleExportCSV = () => {
    const headers = ['Date', 'Weather Condition', 'Temperature', 'Toolbox Topic', 'Supervisor', 'Work Scope Summary', 'Issues / Discrepancy'];
    const rows = logs.map(l => [
      l.date,
      l.weather,
      l.temperature,
      `"${(l.toolboxTopic || '').replace(/"/g, '""')}"`,
      `"${(l.supervisorName || '').replace(/"/g, '""')}"`,
      `"${(l.workCompleted || '').replace(/"/g, '""')}"`,
      `"${(l.delaysOrIssues || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Site_Weather_Diary_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // -------------------------------------------------------------------------
  // Google Weather Style 7-Day & Hourly Curve Computations
  // -------------------------------------------------------------------------
  const selectedDay = forecast[(selectedForecastIndex ?? 0)] || forecast[0] || {
    date: new Date().toISOString().split('T')[0],
    dayName: 'Today',
    shortDayName: 'Today',
    fullDayName: 'Today',
    weatherCode: liveWeather?.weatherCode ?? 0,
    tempMax: liveWeather?.temperature ? Math.round(liveWeather.temperature + 2) : 32,
    tempMin: liveWeather?.temperature ? Math.round(liveWeather.temperature - 4) : 24,
    precipitationProb: liveWeather?.precipitation ? 60 : 10,
    windSpeedMax: liveWeather?.windSpeed || 15,
    avgHumidity: liveWeather?.humidity || 75,
    hourlyPoints: []
  };

  const selectedWeatherInfo = getWeatherInfo(selectedDay.weatherCode);
  const SelectedIcon = selectedWeatherInfo.icon;

  const displayHeroTemp = (selectedForecastIndex === 0 || selectedForecastIndex === null) && liveWeather
    ? liveWeather.temperature
    : Math.round((selectedDay.tempMax + selectedDay.tempMin) / 2);

  // 8 target hourly intervals matching Google Weather UI: 3 AM, 6 AM, 9 AM, 12 PM, 3 PM, 6 PM, 9 PM, 12 AM
  const TARGET_HOURLY_SLOTS = useMemo(() => [
    { hour: 3, label: '3 AM' },
    { hour: 6, label: '6 AM' },
    { hour: 9, label: '9 AM' },
    { hour: 12, label: '12 PM' },
    { hour: 15, label: '3 PM' },
    { hour: 18, label: '6 PM' },
    { hour: 21, label: '9 PM' },
    { hour: 23, label: '12 AM' }
  ], []);

  const hourlyChartData = useMemo(() => {
    const points = selectedDay?.hourlyPoints || [];
    return TARGET_HOURLY_SLOTS.map((slot, idx) => {
      let matched = points.find(p => p.hour24 === slot.hour);
      if (!matched && points.length > 0) {
        matched = points.reduce((prev, curr) =>
          Math.abs(curr.hour24 - slot.hour) < Math.abs(prev.hour24 - slot.hour) ? curr : prev
        );
      }

      const baseTemp = Math.round((selectedDay.tempMax + selectedDay.tempMin) / 2);
      const tempOffsets = [-3, -4, -1, 3, 4, 2, 0, -2];
      const tempVal = matched ? matched.temp : baseTemp + tempOffsets[idx];
      const precipVal = matched ? matched.precipitationProb : Math.max(0, (selectedDay.precipitationProb || 0) - Math.abs(idx - 4) * 10);
      const windVal = matched?.windSpeed ?? Math.round((selectedDay.windSpeedMax || 15) * 0.75);
      const weatherCode = matched?.weatherCode ?? selectedDay.weatherCode;

      return {
        slotHour: slot.hour,
        hourLabel: slot.label,
        tempC: tempVal,
        tempF: Math.round(tempVal * 9/5 + 32),
        precipitationProb: precipVal,
        windKmh: windVal,
        windMph: Math.round(windVal * 0.621371),
        weatherCode
      };
    });
  }, [selectedDay, TARGET_HOURLY_SLOTS]);

  // Compute active curve points & SVG bounds
  const svgWidth = 800;
  const svgHeight = 160;
  const padX = 45;
  const padTop = 38;
  const padBottom = 35;
  const usableW = svgWidth - 2 * padX;
  const usableH = svgHeight - padTop - padBottom;

  const activeMetricValues = useMemo(() => {
    return hourlyChartData.map(d => {
      if (chartTab === 'temperature') {
        return isFahrenheit ? d.tempF : d.tempC;
      }
      if (chartTab === 'precipitation') {
        return d.precipitationProb;
      }
      return isFahrenheit ? d.windMph : d.windKmh;
    });
  }, [hourlyChartData, chartTab, isFahrenheit]);

  let minMetric = Math.min(...activeMetricValues);
  let maxMetric = Math.max(...activeMetricValues);

  if (chartTab === 'precipitation') {
    minMetric = 0;
    maxMetric = 100;
  } else if (chartTab === 'wind') {
    minMetric = 0;
    maxMetric = Math.max(30, maxMetric + 4);
  } else {
    // Temperature: ensure at least 6 degree span so curve is gentle and elegant
    if (maxMetric - minMetric < 6) {
      const mid = (maxMetric + minMetric) / 2;
      maxMetric = Math.round(mid + 3);
      minMetric = Math.round(mid - 3);
    }
  }

  const metricRange = maxMetric - minMetric || 1;

  const chartCurvePoints = useMemo(() => {
    return hourlyChartData.map((d, idx) => {
      const val = activeMetricValues[idx];
      const x = padX + (idx / (hourlyChartData.length - 1)) * usableW;
      const y = padTop + ((maxMetric - val) / metricRange) * usableH;
      const displayLabel = chartTab === 'temperature'
        ? `${val}°`
        : chartTab === 'precipitation'
        ? `${val}%`
        : `${val}`;

      return {
        ...d,
        val,
        displayLabel,
        x,
        y
      };
    });
  }, [hourlyChartData, activeMetricValues, chartTab, maxMetric, metricRange, usableW, usableH, padX, padTop]);

  const curveLinePath = useMemo(() => getSmoothCurvePath(chartCurvePoints), [chartCurvePoints]);
  const curveAreaPath = useMemo(() => {
    if (!curveLinePath || chartCurvePoints.length === 0) return '';
    return `${curveLinePath} L ${chartCurvePoints[chartCurvePoints.length - 1].x.toFixed(1)} ${(svgHeight - padBottom).toFixed(1)} L ${chartCurvePoints[0].x.toFixed(1)} ${(svgHeight - padBottom).toFixed(1)} Z`;
  }, [curveLinePath, chartCurvePoints, svgHeight, padBottom]);

  const themeConfig = chartTab === 'temperature'
    ? { stroke: '#f59e0b', fillGradId: 'tempGrad', fillStop: '#f59e0b', textClass: 'fill-amber-300' }
    : chartTab === 'precipitation'
    ? { stroke: '#38bdf8', fillGradId: 'precipGrad', fillStop: '#38bdf8', textClass: 'fill-sky-300' }
    : { stroke: '#2dd4bf', fillGradId: 'windGrad', fillStop: '#2dd4bf', textClass: 'fill-teal-300' };

  return (
    <div className="space-y-6">
      
      {/* Top Header & Location Hub Switcher */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        {/* Row 1: Title & Primary Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider">
                LIVE METEOROLOGICAL TELEMETRY
              </span>
            </div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <CloudSun className="w-6 h-6 text-amber-400" />
              Project Weather Report & Atmospheric Station
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time meteorological telemetry, automated trade safety calculators, and historical site diary archives.
            </p>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-colors border border-slate-700 flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Export Site Diary as CSV"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handleOpenLogModal}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Log Weather Record</span>
            </button>
          </div>
        </div>

        {/* Row 2: Clean Sub-Toolbar Divider & Grouped Controls */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Left Group: Location & Station Selector */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Dynamic Active Project Selector */}
            {projects && projects.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white">
                <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <select
                  value={selectedLocation.projectId || ''}
                  onChange={(e) => {
                    const proj = projects.find(p => p.id === e.target.value);
                    if (proj) {
                      const coords = resolveProjectCoordinates(proj);
                      setSelectedLocation({
                        id: proj.id,
                        name: proj.name,
                        region: proj.location || coords.name || 'Laguna, Philippines',
                        lat: coords.lat,
                        lon: coords.lon,
                        projectId: proj.id
                      });
                      setNotification(`📍 Synced weather station to: ${proj.name} • ${proj.location || coords.name} (${coords.lat.toFixed(4)}° N, ${coords.lon.toFixed(4)}° E)`);
                      setTimeout(() => setNotification(null), 3500);
                    }
                  }}
                  className="bg-transparent text-xs text-white focus:outline-none cursor-pointer pr-1 max-w-[190px] truncate font-semibold"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id} className="bg-slate-950 text-white">
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Custom City / Municipality Geocoding Search */}
            <div className="relative">
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white w-44 sm:w-48">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search municipality..."
                  value={searchQuery}
                  onChange={(e) => handleSearchLocation(e.target.value)}
                  onFocus={() => { if (searchResults.length > 0) setShowSearchDropdown(true); }}
                  className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-full"
                />
                {isSearching && <RefreshCw className="w-3 h-3 animate-spin text-amber-400 shrink-0" />}
              </div>

              {/* Autocomplete Dropdown */}
              {showSearchDropdown && searchResults.length > 0 && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                  {searchResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectSearchResult(item)}
                      className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-amber-500 hover:text-slate-950 transition flex flex-col cursor-pointer border-b border-slate-800 last:border-0"
                    >
                      <span className="font-bold">{item.name}</span>
                      <span className="text-[10px] opacity-75">{[item.admin1, item.country].filter(Boolean).join(', ')} ({item.latitude?.toFixed(2)}°, {item.longitude?.toFixed(2)}°)</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Device GPS Auto-Detect Button */}
            <button
              type="button"
              onClick={handleUseDeviceGPS}
              disabled={isGpsLocating}
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs transition-colors border border-slate-700 flex items-center gap-1.5 cursor-pointer"
              title="Auto-detect current coordinates using Device GPS"
            >
              <LocateFixed className={`w-3.5 h-3.5 ${isGpsLocating ? 'animate-spin text-amber-400' : 'text-emerald-400'}`} />
              <span className="hidden sm:inline">{isGpsLocating ? 'Locating...' : 'Device GPS'}</span>
            </button>
          </div>

          {/* Right Group: Operational & Safety Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Work Suspended (Force Majeure) Toggle Button */}
            <button
              type="button"
              onClick={handleToggleForceMajeure}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                isForceMajeureSuspended
                  ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-600/30'
                  : 'bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border-rose-800'
              }`}
              title="Toggle Work Stoppage due to Severe Weather (Force Majeure)"
            >
              <ShieldAlert className={`w-3.5 h-3.5 ${isForceMajeureSuspended ? 'animate-bounce text-amber-300' : 'text-rose-400'}`} />
              <span className="truncate">{isForceMajeureSuspended ? 'Force Majeure: SUSPENDED' : 'Force Majeure Stop'}</span>
            </button>

            {/* Manual Fallback Mode Toggle */}
            <button
              type="button"
              onClick={() => setIsManualOverride(prev => !prev)}
              className={`px-2.5 py-1.5 rounded-xl text-xs transition-colors border flex items-center gap-1.5 cursor-pointer ${
                isManualOverride
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
              }`}
              title="Toggle Manual Site Weather Fallback"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{isManualOverride ? 'Manual ON' : 'Manual Fallback'}</span>
            </button>

            {/* Refresh Button with fresh=true upstream sync */}
            <button
              type="button"
              onClick={() => fetchWeather(false, true)}
              disabled={isLoading}
              className="p-1.5 px-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-slate-300 hover:text-white rounded-xl text-xs transition-colors border border-slate-700 flex items-center gap-1 cursor-pointer"
              title="Fetch Fresh Sensor Data Upstream"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading || isSilentSyncing ? 'animate-spin text-amber-400' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Force Majeure Active Warning Banner with Worker Emergency Broadcast Action */}
      {isForceMajeureSuspended && (
        <div className="bg-rose-950/95 border-2 border-rose-500 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-rose-900 border border-rose-500 rounded-xl text-rose-200 shrink-0 mt-0.5 shadow-md">
              <ShieldAlert className="w-6 h-6 text-rose-400 animate-pulse" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-rose-500 text-slate-950 text-[10px] font-black uppercase tracking-wider font-mono">
                  FORCE MAJEURE ACTIVE
                </span>
                <h3 className="text-sm sm:text-base font-bold text-white">Work Suspended Due to Extreme Weather Conditions</h3>
                {broadcastConfirmed && (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold flex items-center gap-1">
                    <CheckCheck className="w-3 h-3 text-emerald-400" />
                    Workers Alerted ({lastBroadcastTimestamp} PHT)
                  </span>
                )}
              </div>
              <p className="text-xs text-rose-200/80 leading-relaxed max-w-3xl">
                Site execution at <strong className="text-white">{selectedLocation.name}</strong> is currently suspended under Force Majeure protocols. Timeline variance and handover schedules have been flagged for contractual delay extension.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0 w-full lg:w-auto justify-end">
            {/* Emergency Worker Broadcast Button */}
            <button
              type="button"
              onClick={() => setIsBroadcastModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer"
              title="Broadcast emergency work stoppage notice to all site foremen, workers, and subcontractors"
            >
              <Radio className="w-4 h-4 text-slate-950 animate-pulse" />
              <span>{broadcastConfirmed ? 'Re-broadcast to Workers' : 'Broadcast to Field Workers'}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleForceMajeure}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-rose-500 text-rose-200 text-xs font-bold transition cursor-pointer"
            >
              Lift Weather Suspension
            </button>
          </div>
        </div>
      )}

      {/* Manual Weather Fallback Bar (For Offline / Location Resilience) */}
      {(isManualOverride || fetchError) && (
        <div className="bg-slate-900/90 border border-amber-500/40 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Manual Weather Selection Active</span>
                <span className="text-[10px] text-amber-400 font-normal">(Offline & Site Resilience Mode)</span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Select condition, temperature, and wind speed manually for {selectedLocation.name}.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Condition Quick Selectors */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1">
              {[
                { label: 'Clear Sky', condition: 'SUNNY' as const, icon: Sun },
                { label: 'Overcast', condition: 'OVERCAST' as const, icon: Cloud },
                { label: 'Light Rain', condition: 'RAINY' as const, icon: CloudRain },
                { label: 'Heavy Rain / Suspended', condition: 'STORM' as const, icon: CloudLightning },
              ].map(({ label, condition, icon: Icon }) => (
                <button
                  key={condition}
                  type="button"
                  onClick={() => {
                    setManualCondition(condition);
                    const code = condition === 'SUNNY' ? 0 : condition === 'OVERCAST' ? 3 : condition === 'RAINY' ? 61 : 95;
                    setLiveWeather(prev => prev ? {
                      ...prev,
                      weatherCode: code,
                      precipitation: condition === 'RAINY' ? 4.5 : condition === 'STORM' ? 25 : 0
                    } : null);
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                    manualCondition === condition
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">{label}</span>
                </button>
              ))}
            </div>

            {/* Editable Temperature Input */}
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
              <Thermometer className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] text-slate-400 font-mono">Temp:</span>
              <input
                type="number"
                min={10}
                max={45}
                value={manualTemp}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setManualTemp(val);
                  setLiveWeather(prev => prev ? { ...prev, temperature: val, apparentTemperature: val + 1 } : null);
                }}
                className="w-12 bg-transparent text-xs text-white font-mono font-bold focus:outline-none"
              />
              <span className="text-xs text-white">°C</span>
            </div>

            {/* Editable Wind Speed Input */}
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
              <Wind className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[11px] text-slate-400 font-mono">Wind:</span>
              <input
                type="number"
                min={0}
                max={150}
                value={manualWind}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setManualWind(val);
                  setLiveWeather(prev => prev ? { ...prev, windSpeed: val } : null);
                }}
                className="w-12 bg-transparent text-xs text-white font-mono font-bold focus:outline-none"
              />
              <span className="text-xs text-slate-400 font-mono">km/h</span>
            </div>
          </div>
        </div>
      )}

      {notification && (
        <div className="p-4 rounded-xl bg-emerald-950/80 text-emerald-300 border border-emerald-800 text-xs font-mono flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 shrink-0" />
          {notification}
        </div>
      )}

      {/* Main Live Weather Hero Panel */}
      {fetchError ? (
        <div className="bg-rose-950/40 border border-rose-800 rounded-2xl p-6 text-center space-y-2">
          <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
          <h3 className="text-sm font-bold text-rose-200">Meteorological Sensor Error</h3>
          <p className="text-xs text-rose-300">{fetchError}</p>
          <button
            onClick={() => fetchWeather(false, true)}
            className="mt-2 px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* --------------------------------------------------------------------- */}
          {/* UNIFIED LIVE METEOROLOGICAL TELEMETRY & 7-DAY OUTLOOK */}
          {/* --------------------------------------------------------------------- */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
            
            {/* Top Row: Weather Summary Header & Real-time Live Clock */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
              <div className="flex items-center gap-4 sm:gap-5 flex-wrap">
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-700 shadow-inner shrink-0">
                  {React.createElement(selectedForecastIndex === 0 ? CurrentIcon : SelectedIcon, {
                    className: `w-12 h-12 sm:w-14 sm:h-14 ${selectedForecastIndex === 0 ? currentWeatherInfo.color : selectedWeatherInfo.color}`
                  })}
                </div>

                <div>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight">
                      {isFahrenheit
                        ? (selectedForecastIndex === 0 && liveWeather
                            ? `${((liveWeather.temperature * 9) / 5 + 32).toFixed(1)}`
                            : `${Math.round(displayHeroTemp * 9/5 + 32)}`)
                        : (selectedForecastIndex === 0 && liveWeather
                            ? `${liveWeather.temperature.toFixed(1)}`
                            : `${Math.round(displayHeroTemp)}`)}
                    </span>
                    <div className="flex items-center gap-1 text-sm font-semibold text-slate-400 select-none">
                      <button
                        type="button"
                        onClick={() => setIsFahrenheit(false)}
                        className={`cursor-pointer transition-colors ${!isFahrenheit ? 'text-white font-bold' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        °C
                      </button>
                      <span className="text-slate-600">|</span>
                      <button
                        type="button"
                        onClick={() => setIsFahrenheit(true)}
                        className={`cursor-pointer transition-colors ${isFahrenheit ? 'text-white font-bold' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        °F
                      </button>
                    </div>
                    <span className="text-xs font-normal text-slate-400 font-sans ml-1">
                      {selectedForecastIndex === 0 && liveWeather
                        ? `Feels like ${isFahrenheit ? `${((liveWeather.apparentTemperature * 9/5) + 32).toFixed(1)}°F` : `${liveWeather.apparentTemperature.toFixed(1)}°C`}`
                        : `Forecast Range (${selectedDay.tempMin}° – ${selectedDay.tempMax}°)`}
                    </span>
                  </div>

                  <div className="text-sm font-bold text-slate-200 mt-1 flex items-center gap-2 flex-wrap">
                    <span>{selectedForecastIndex === 0 ? currentWeatherInfo.label : selectedWeatherInfo.label}</span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${currentWeatherInfo.badgeColor}`}>
                      {selectedLocation.name}
                    </span>
                    {selectedForecastIndex !== 0 && (
                      <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                        Viewing: {selectedDay.fullDayName || selectedDay.dayName}
                      </span>
                    )}
                  </div>

                  {/* Project Site Location & Exact GPS Coordinates Badge */}
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400 flex-wrap">
                    <span className="flex items-center gap-1 font-medium text-emerald-400">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate max-w-sm sm:max-w-md">{selectedLocation.region || selectedLocation.name}</span>
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="font-mono text-[11px] text-slate-300">
                      GPS: {selectedLocation.lat.toFixed(4)}° N, {selectedLocation.lon.toFixed(4)}° E
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded font-mono font-semibold">
                      Site Synced
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Core Meteorological Data Grid (4 Sensors) - Syncs Live or Reflects Selected Day */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                  <span>HUMIDITY</span>
                  <Droplets className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div className="text-xl font-bold font-mono text-white">
                  {selectedForecastIndex === 0
                    ? (liveWeather ? `${liveWeather.humidity}%` : '--%')
                    : `${selectedDay?.avgHumidity ?? 75}%`}
                </div>
                <div className="text-[10px] text-slate-500">
                  {selectedForecastIndex === 0
                    ? (liveWeather && liveWeather.humidity > 80 ? 'High moisture (Live)' : 'Moderate (Live)')
                    : '24-hour Daily Average'}
                </div>
              </div>

              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                  <span>WIND SPEED</span>
                  <Wind className="w-3.5 h-3.5 text-teal-400" />
                </div>
                <div className="text-xl font-bold font-mono text-white">
                  {selectedForecastIndex === 0
                    ? (liveWeather ? (isFahrenheit ? `${(liveWeather.windSpeed * 0.621371).toFixed(1)}` : `${liveWeather.windSpeed.toFixed(1)}`) : '--')
                    : (isFahrenheit ? `${Math.round((selectedDay?.windSpeedMax || 10) * 0.621371)}` : `${selectedDay?.windSpeedMax || 10}`)}{' '}
                  <span className="text-xs font-normal text-slate-400">{isFahrenheit ? 'mph' : 'km/h'}</span>
                </div>
                <div className="text-[10px] text-teal-400 font-mono">
                  {selectedForecastIndex === 0
                    ? `Direction: ${liveWeather ? getWindDirection(liveWeather.windDirection) : '--'}`
                    : `Peak Forecast Gusts: ${selectedDay?.windSpeedMax || 10} km/h`}
                </div>
              </div>

              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                  <span>PRECIPITATION</span>
                  <CloudRain className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <div className="text-xl font-bold font-mono text-white">
                  {selectedForecastIndex === 0
                    ? (liveWeather ? `${liveWeather.precipitation.toFixed(1)} mm` : '-- mm')
                    : `${selectedDay?.precipitationProb ?? 0}%`}
                </div>
                <div className="text-[10px] text-slate-500">
                  {selectedForecastIndex === 0
                    ? (liveWeather && liveWeather.precipitation > 0 ? `Active rain (${selectedDay?.precipitationProb ?? 0}% chance)` : `No rain recorded (${selectedDay?.precipitationProb ?? 0}% chance)`)
                    : 'Precipitation Probability'}
                </div>
              </div>

              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                  <span>{selectedForecastIndex === 0 ? 'BAROMETER' : 'TEMP RANGE'}</span>
                  {selectedForecastIndex === 0 ? (
                    <Gauge className="w-3.5 h-3.5 text-purple-400" />
                  ) : (
                    <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                  )}
                </div>
                <div className="text-xl font-bold font-mono text-white">
                  {selectedForecastIndex === 0
                    ? (liveWeather ? `${liveWeather.pressure.toFixed(0)} hPa` : '1012 hPa')
                    : `${selectedDay.tempMin}° – ${selectedDay.tempMax}°C`}
                </div>
                <div className="text-[10px] text-slate-500">
                  {selectedForecastIndex === 0 ? 'Atmospheric pressure' : 'Forecasted Diurnal Range'}
                </div>
              </div>
            </div>

            {/* Field Operational Weather Advisory Banner */}
            <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${advisory.bg}`}>
              <ShieldAlert className={`w-5 h-5 shrink-0 mt-0.5 ${advisory.color}`} />
              <div className="space-y-0.5">
                <strong className={`font-bold block tracking-wide ${advisory.color}`}>
                  SITE METEOROLOGICAL ADVISORY: {advisory.level}
                </strong>
                <p className="text-slate-300 leading-relaxed">
                  {advisory.text}
                </p>
              </div>
            </div>

            {/* Metric Tab Switchers (Temperature, Precipitation, Wind) */}
            <div className="flex items-center gap-6 border-b border-slate-800 text-xs sm:text-sm font-medium pt-1">
              <button
                type="button"
                onClick={() => setChartTab('temperature')}
                className={`pb-2.5 transition-all cursor-pointer relative ${
                  chartTab === 'temperature'
                    ? 'text-amber-400 font-bold border-b-2 border-amber-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Temperature
              </button>
              <button
                type="button"
                onClick={() => setChartTab('precipitation')}
                className={`pb-2.5 transition-all cursor-pointer relative ${
                  chartTab === 'precipitation'
                    ? 'text-sky-400 font-bold border-b-2 border-sky-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Precipitation
              </button>
              <button
                type="button"
                onClick={() => setChartTab('wind')}
                className={`pb-2.5 transition-all cursor-pointer relative ${
                  chartTab === 'wind'
                    ? 'text-teal-400 font-bold border-b-2 border-teal-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Wind
              </button>
            </div>

            {/* Interactive Smooth Curve Area Chart */}
            <div className="w-full overflow-x-auto py-2">
              <div className="min-w-[650px] w-full">
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="w-full h-44 overflow-visible"
                >
                  <defs>
                    <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.32" />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="precipGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="windGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.32" />
                      <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Gradient Area Fill */}
                  {curveAreaPath && (
                    <path
                      d={curveAreaPath}
                      fill={`url(#${themeConfig.fillGradId})`}
                      className="transition-all duration-300"
                    />
                  )}

                  {/* Smooth Line Stroke */}
                  {curveLinePath && (
                    <path
                      d={curveLinePath}
                      fill="none"
                      stroke={themeConfig.stroke}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-all duration-300"
                    />
                  )}

                  {/* Hourly Data Points, Value Badges & X-Axis Time Labels */}
                  {chartCurvePoints.map((pt, idx) => {
                    const isHovered = hoveredPointIndex === idx;
                    return (
                      <g key={idx} className="cursor-pointer">
                        {/* Hover guideline */}
                        {isHovered && (
                          <line
                            x1={pt.x}
                            y1={padTop - 10}
                            x2={pt.x}
                            y2={svgHeight - padBottom}
                            stroke="#475569"
                            strokeWidth="1"
                            strokeDasharray="3 3"
                          />
                        )}

                        {/* Value Text Floating Above Curve */}
                        <text
                          x={pt.x}
                          y={pt.y - 12}
                          textAnchor="middle"
                          fill={isHovered ? '#ffffff' : '#cbd5e1'}
                          fontSize={isHovered ? '13' : '11'}
                          fontWeight="700"
                          fontFamily="monospace"
                          className="transition-all select-none"
                        >
                          {pt.displayLabel}
                        </text>

                        {/* Point Circle Node */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? 5.5 : 3.5}
                          fill="#090d16"
                          stroke={themeConfig.stroke}
                          strokeWidth={isHovered ? 2.5 : 2}
                          className="transition-all"
                          onMouseEnter={() => setHoveredPointIndex(idx)}
                          onMouseLeave={() => setHoveredPointIndex(null)}
                        />

                        {/* Time Label on X-Axis */}
                        <text
                          x={pt.x}
                          y={svgHeight - 10}
                          textAnchor="middle"
                          fill={isHovered ? '#ffffff' : '#64748b'}
                          fontSize="11"
                          fontWeight={isHovered ? '700' : '500'}
                          fontFamily="sans-serif"
                          className="transition-all select-none"
                        >
                          {pt.hourLabel}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* Bottom 7-Day Forecast Cards */}
            <div className="grid grid-cols-4 sm:grid-cols-7 lg:grid-cols-7 gap-2 pt-3 border-t border-slate-800/80">
              {forecast.slice(0, 7).map((day, idx) => {
                const isSelected = (selectedForecastIndex ?? 0) === idx;
                const dInfo = getWeatherInfo(day.weatherCode);
                const DIcon = dInfo.icon;
                const maxT = isFahrenheit ? Math.round(day.tempMax * 9/5 + 32) : Math.round(day.tempMax);
                const minT = isFahrenheit ? Math.round(day.tempMin * 9/5 + 32) : Math.round(day.tempMin);

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedForecastIndex(idx)}
                    className={`flex flex-col items-center justify-between p-3 rounded-2xl transition-all cursor-pointer text-center ${
                      isSelected
                        ? 'bg-slate-800/90 border border-slate-700/80 shadow-md shadow-amber-500/5 ring-1 ring-amber-400/20'
                        : 'bg-transparent hover:bg-slate-900/60 border border-transparent hover:border-slate-800/60'
                    }`}
                  >
                    <span className="text-xs font-semibold text-slate-300">
                      {idx === 0 ? 'Today' : day.shortDayName || day.dayName}
                    </span>
                    <div className="my-2 p-1">
                      <DIcon className={`w-6 h-6 ${dInfo.color}`} />
                    </div>
                    <div className="text-xs font-mono">
                      <span className="text-white font-bold">{maxT}°</span>{' '}
                      <span className="text-slate-500">{minT}°</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Optional Rain Radar Window Note if rain is expected */}
            {selectedDay && selectedDay.precipitationProb >= 25 && (
              <div className="mt-2 text-xs text-slate-400 bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 animate-fadeIn">
                <div className="flex items-center gap-2.5">
                  <Umbrella className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>
                    <strong>Rain Radar Window ({selectedDay.dayName}):</strong> {selectedDay.rainTimeWindow || `Rain probability peaks around ${selectedDay.peakRainHour} (${selectedDay.precipitationProb}%)`}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20 shrink-0">
                  Peak: {selectedDay.peakRainProb || selectedDay.precipitationProb}%
                </span>
              </div>
            )}

          </div>

        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* INTERACTIVE TRADE IMPACT SAFETY CALCULATOR & WHAT-IF SIMULATOR */}
      {/* --------------------------------------------------------------------- */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/30 border border-indigo-500/30 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold tracking-wider uppercase">
                Interactive Engineering Matrix
              </span>
              <span className="text-xs text-slate-400">Trade Hazard & Weather Impact Engine</span>
            </div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" />
              Trade Weather Safety Evaluator & What-If Simulator
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Select specific construction trades to automatically test wind, rain, and humidity safety limits against live telemetry or simulated extreme scenarios.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSimulationMode(!isSimulationMode)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition border cursor-pointer ${
                isSimulationMode 
                  ? 'bg-amber-500 text-slate-950 border-amber-400' 
                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-600'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{isSimulationMode ? 'Simulation: Active' : 'Enable What-If Simulator'}</span>
            </button>

            <button
              onClick={handleLogTradeSafetyResult}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/20 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              Record Inspection to Diary
            </button>
          </div>
        </div>

        {/* Trade Selector Tabs */}
        <div className="flex flex-wrap gap-2">
          {TRADE_RULES.map((trade) => (
            <button
              key={trade.id}
              onClick={() => setSelectedTrade(trade)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedTrade.id === trade.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {trade.name}
            </button>
          ))}
        </div>

        {/* What-If Sliders (Visible when isSimulationMode is true) */}
        {isSimulationMode && (
          <div className="p-4 bg-slate-900/90 border border-amber-500/40 rounded-xl space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-amber-400 font-mono flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                SIMULATE WEATHER CONDITIONS (TEST SITE TOLERANCES)
              </span>
              <button
                onClick={() => {
                  if (liveWeather) {
                    setSimWind(Math.round(liveWeather.windSpeed));
                    setSimPrecip(liveWeather.precipitation);
                    setSimTemp(Math.round(liveWeather.temperature));
                    setSimHumidity(liveWeather.humidity);
                  }
                }}
                className="text-slate-400 hover:text-white text-[11px] underline cursor-pointer"
              >
                Reset to Live Telemetry
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Wind Speed:</span>
                  <span className="text-white font-bold">{simWind} km/h</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="70"
                  value={simWind}
                  onChange={(e) => setSimWind(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Precipitation:</span>
                  <span className="text-white font-bold">{simPrecip} mm</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="0.5"
                  value={simPrecip}
                  onChange={(e) => setSimPrecip(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Temperature:</span>
                  <span className="text-white font-bold">{simTemp}°C</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="45"
                  value={simTemp}
                  onChange={(e) => setSimTemp(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Humidity:</span>
                  <span className="text-white font-bold">{simHumidity}%</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="100"
                  value={simHumidity}
                  onChange={(e) => setSimHumidity(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* Live Safety Evaluation Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">Evaluation Verdict</div>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold px-3 py-1 rounded-full border font-mono ${tradeSafety.badgeColor}`}>
                {tradeSafety.verdict}
              </span>
            </div>
            <div className="pt-2">
              <div className="flex justify-between text-xs font-mono text-slate-400 mb-1">
                <span>Calculated Safety Index</span>
                <span className="text-white font-bold">{tradeSafety.score}%</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all duration-500 ${
                    tradeSafety.score > 80 ? 'bg-emerald-400' : tradeSafety.score > 50 ? 'bg-amber-400' : 'bg-rose-400'
                  }`}
                  style={{ width: `${tradeSafety.score}%` }}
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 italic pt-1">
              Source: {isSimulationMode ? 'Simulated Weather Override' : `Live Weather Sensors (${selectedLocation.name})`}
            </p>
          </div>

          <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3 flex flex-col justify-between">
            <div>
              <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">Trade Safety Rationale & Field Advisory</div>
              <div className="space-y-1.5">
                {tradeSafety.reasons.map((r, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-slate-200">
                    <span className="text-indigo-400 font-bold">•</span>
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800/80 text-[11px] text-indigo-300">
              <strong className="block text-indigo-200 font-bold mb-0.5">Engineering Protocol:</strong>
              {selectedTrade.advice}
            </div>
          </div>
        </div>
      </div>

      {/* Historical Weather Observation Records */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              Recorded Weather Observations & Historical Logs ({logs.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Archived weather logs saved for site safety compliance, weather delay verification, and insurance audits.
            </p>
          </div>
          
          <button
            onClick={() => setIsModalOpen(true)}
            className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span>Record New Weather Log</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {logs.length === 0 ? (
          <div className="h-44 bg-slate-900/40 border border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-slate-500 space-y-2">
            <CloudSun className="w-8 h-8 text-slate-600" />
            <p className="text-xs font-semibold text-slate-400">No historical weather observations recorded yet.</p>
            <p className="text-[11px] text-slate-500 max-w-sm text-center">
              Click &quot;Log Weather Record&quot; to archive current live atmospheric readings for this site location.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.slice(0, 8).map((log) => {
              const info = getWeatherInfo(log.weather === 'SUNNY' ? 0 : log.weather === 'RAINY' ? 61 : log.weather === 'STORM' ? 95 : 3);
              const LogIcon = info.icon;
              return (
                <div key={log.id} className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-950 border border-slate-800 rounded-lg shrink-0 mt-0.5">
                      <LogIcon className={`w-4 h-4 ${info.color}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-white text-xs">{log.toolboxTopic || 'Weather Observation Snapshot'}</strong>
                        <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-slate-800 text-amber-400 border border-slate-700">
                          {log.temperature}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px] mt-1 leading-relaxed">{log.workCompleted}</p>
                      {log.delaysOrIssues && (
                        <span className="inline-block mt-1 text-[10px] text-rose-400 font-mono">
                          ⚠️ {log.delaysOrIssues}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 text-slate-500 font-mono text-[10px]">
                    <div>{new Date(log.date).toLocaleDateString()}</div>
                    <div className="text-slate-400">{log.supervisorName}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Log Weather Observation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <CloudSun className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-bold text-white">Log Site Weather Observation</h3>
            </div>

            <form onSubmit={handleSaveObservation} className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs space-y-1 font-mono">
                <div className="text-slate-400">Active Site: <strong className="text-white">{selectedLocation.name}</strong> ({selectedLocation.region})</div>
                <div className="text-slate-400">Current Reading: <strong className="text-amber-400">{currentWeatherInfo.label}</strong> • {liveWeather?.temperature.toFixed(1)}°C</div>
              </div>

              {/* Editable Condition & Temperature for Field Override */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Condition</label>
                  <select
                    value={manualCondition}
                    onChange={(e) => {
                      const cond = e.target.value as any;
                      setManualCondition(cond);
                    }}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
                  >
                    <option value="SUNNY">Clear Sky</option>
                    <option value="OVERCAST">Overcast</option>
                    <option value="RAINY">Light Rain / Drizzle</option>
                    <option value="STORM">Heavy Rain / Suspended</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Ambient Temp (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    min={10}
                    max={45}
                    value={manualTemp}
                    onChange={(e) => setManualTemp(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-amber-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Supervisor / Observer Name</label>
                <input
                  type="text"
                  placeholder="Enter supervisor / observer name..."
                  value={observerName}
                  onChange={(e) => setObserverName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-amber-500 focus:outline-none placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Site Observation & Field Notes</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Scaffolding secured, high winds observed around North curtain wall, rain began at 14:30..."
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  Archive Observation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Force Majeure Emergency Worker Broadcast & Muster Dispatch Modal */}
      {isBroadcastModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border-2 border-rose-500/60 rounded-2xl w-full max-w-2xl shadow-2xl p-6 sm:p-7 relative max-h-[90vh] overflow-y-auto space-y-5">
            <button
              onClick={() => setIsBroadcastModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-400 shadow-lg shadow-rose-500/10">
                <Radio className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold uppercase tracking-wider">
                    DOLE-OSHC / SAFETY DISPATCH
                  </span>
                  <span className="text-xs text-slate-400 font-mono">Channel: GSM / Push Broadcast</span>
                </div>
                <h3 className="text-lg font-black text-white mt-0.5">
                  Emergency Force Majeure Site Worker Broadcast
                </h3>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Dispatches an immediate high-priority work suspension alert to all assigned subcontractor foremen, on-site trades, safety marshals, and equipment operators at <strong className="text-white">{selectedLocation.name}</strong>.
            </p>

            {/* Target Project Site Location Selector */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5">
              <label className="block text-[11px] font-mono text-slate-400 uppercase font-bold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-amber-400" />
                  Select Project Site Location
                </span>
                <span className="text-[10px] text-slate-500 font-normal">Location weather syncs automatically</span>
              </label>
              {projects && projects.length > 0 ? (
                <select
                  value={selectedLocation.projectId || selectedLocation.id}
                  onChange={(e) => {
                    const proj = projects.find(p => p.id === e.target.value);
                    if (proj) {
                      setSelectedLocation({
                        id: proj.id,
                        name: proj.name,
                        region: proj.location || 'Laguna, Philippines',
                        lat: proj.latitude || (proj.name.toLowerCase().includes('bgc') ? 14.5547 : 14.2547),
                        lon: proj.longitude || (proj.name.toLowerCase().includes('bgc') ? 121.0509 : 121.5056),
                        projectId: proj.id
                      });
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id} className="bg-slate-950 text-white">
                      {p.name} {p.location ? `— (${p.location})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-xs text-slate-300 bg-slate-900 px-3 py-2 rounded-lg border border-slate-700">
                  {selectedLocation.name} ({selectedLocation.region})
                </div>
              )}
            </div>

            {/* Meteorological Grounding Snapshot */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div>
                <span className="text-slate-500 text-[10px] block">ATMOSPHERIC</span>
                <span className="text-amber-400 font-bold">{currentWeatherInfo.label}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">WIND VELOCITY</span>
                <span className="text-white font-bold">{liveWeather ? liveWeather.windSpeed.toFixed(1) : manualWind} km/h</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">PRECIPITATION</span>
                <span className="text-indigo-400 font-bold">{liveWeather ? liveWeather.precipitation.toFixed(1) : '0.0'} mm</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">SITE HEADCOUNT</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <input
                    type="number"
                    min={0}
                    value={broadcastHeadcount}
                    onChange={(e) => setBroadcastHeadcount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-emerald-400 font-bold focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-slate-400 text-[11px]">Pax</span>
                </div>
              </div>
            </div>

            {/* Recipient Subcontractor Roster (OPTIONAL) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1.5 font-bold uppercase text-slate-300">
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                  Target Subcontractor Teams ({selectedLocation.name})
                </span>
                <span className="text-xs text-slate-500 italic">Optional</span>
              </div>

              {projectContractors.length === 0 ? (
                <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-xl p-3.5 text-xs text-slate-400 flex items-start gap-3">
                  <div className="p-2 bg-slate-900 rounded-lg text-amber-400 shrink-0 mt-0.5 border border-slate-800">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-slate-200 block text-xs">No Outsourced Subcontractor Teams Registered (Optional)</strong>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                      You haven’t registered external subcontractor teams or assigned trade workers yet. This is completely optional — you can still test and trigger this safety dispatch via your test phone number below or log an on-site alert siren protocol.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {projectContractors.map((c) => {
                    const isSelected = selectedContractorIds.includes(c.id);
                    return (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedContractorIds((prev) =>
                            prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                          );
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-amber-950/20 border-amber-500/50 text-white'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <strong className="text-white block">{c.company || c.name}</strong>
                          <span className="text-slate-400 text-[11px]">
                            {c.specialty || c.tradeType || 'General Trade'} • {c.activeManpower || 0} Workers
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          isSelected ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {isSelected ? 'Selected' : 'Skip'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Optional Test Recipient Mobile Numbers Input */}
            <div className="space-y-1.5 bg-slate-950/80 border border-slate-800 rounded-xl p-3.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono text-slate-300 uppercase font-bold flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                  Test Recipient Mobile Number(s) for SMS Broadcast
                </label>
                <span className="text-[10px] font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 font-bold">
                  TESTING AID
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Enter mobile phone number(s) (comma-separated, e.g. <span className="text-amber-300 font-mono">09171234567, 09987654321</span>) to test the emergency GSM alert without needing registered contractor accounts.
              </p>
              <input
                type="text"
                placeholder="e.g. 09171234567, 09987654321"
                value={testMobileNumbers}
                onChange={(e) => setTestMobileNumbers(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder-slate-500 focus:outline-none"
              />
            </div>

            {/* Broadcast Dispatch Template */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-mono text-slate-400 uppercase font-bold">
                  Emergency Alert Payload (CTVill Safety & DOLE-OSHC Notice)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const windVal = liveWeather ? liveWeather.windSpeed.toFixed(1) : manualWind;
                    const rainVal = liveWeather ? liveWeather.precipitation.toFixed(1) : '0.0';
                    setIsMessageCustomized(false);
                    setCustomBroadcastMessage(
                      `⚠️ [CTVILL SAFETY ALERT] EMERGENCY WORK SUSPENSION: Operations at ${selectedLocation.name} are suspended under Force Majeure effective immediately due to adverse weather (${currentWeatherInfo.label}, Wind: ${windVal} km/h, Rain: ${rainVal} mm). All high-elevation scaffolding, crane lifting, hot works, and exterior activities are strictly halted. All trade personnel must secure loose materials, disconnect power, and muster at CTVill Base Camp Safety Shelter.`
                    );
                  }}
                  className="text-[10px] font-mono text-amber-400 hover:underline cursor-pointer"
                >
                  Reset to Standard CTVill Template
                </button>
              </div>
              <textarea
                rows={4}
                value={customBroadcastMessage}
                onChange={(e) => {
                  setIsMessageCustomized(true);
                  setCustomBroadcastMessage(e.target.value);
                }}
                className="w-full bg-slate-950 border border-rose-500/40 focus:border-rose-500 rounded-xl p-3.5 text-xs font-mono text-rose-200 leading-relaxed focus:outline-none"
              />
            </div>

            {/* Multi-Channel Protocol Checkboxes */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-1">
              <label className="flex items-center gap-2 font-mono cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-amber-500 rounded cursor-pointer" />
                <span>SMS Gateway (GSM Telephony)</span>
              </label>
              <label className="flex items-center gap-2 font-mono cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-amber-500 rounded cursor-pointer" />
                <span>Worker App Push Notification</span>
              </label>
              <label className="flex items-center gap-2 font-mono cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-amber-500 rounded cursor-pointer" />
                <span>Site Siren & Muster Protocol</span>
              </label>
            </div>

            {/* Delivery Confirmation */}
            {broadcastConfirmed && (
              <div className="bg-emerald-950/80 border border-emerald-500/50 rounded-xl p-3.5 flex items-center gap-3 text-xs text-emerald-300 animate-fadeIn">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <strong className="font-bold text-white block">CTVill Safety Dispatch Transmitted & Logged</strong>
                  <span>
                    Official stoppage notice recorded for <strong>{selectedLocation.name}</strong> at {lastBroadcastTimestamp} PHT.
                    {testMobileNumbers && ` Test alerts queued to [${testMobileNumbers}].`}
                    {selectedContractorIds.length > 0 && ` Transmitted to ${selectedContractorIds.length} contractor team(s).`}
                    {broadcastHeadcount > 0 && ` Headcount affected: ${broadcastHeadcount} personnel.`}
                    {' '}Official stoppage record archived into Daily Site Diary.
                  </span>
                </div>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsBroadcastModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 text-xs font-medium cursor-pointer"
              >
                Close Window
              </button>

              <button
                type="button"
                onClick={handleDispatchWorkerBroadcast}
                disabled={isBroadcasting}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
              >
                <Radio className={`w-4 h-4 ${isBroadcasting ? 'animate-spin' : 'animate-pulse'}`} />
                <span>{isBroadcasting ? 'Transmitting Alert Dispatch...' : broadcastConfirmed ? 'Re-transmit Alert' : 'Transmit Emergency Dispatch Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
