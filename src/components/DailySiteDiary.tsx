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
  LocateFixed, Building2
} from 'lucide-react';
import { DailySiteLog, ProjectProfile } from '../types';

interface DailySiteDiaryProps {
  logs: DailySiteLog[];
  projects?: ProjectProfile[];
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
  id: 'nexbridge-default',
  name: 'NexBridge Software Hub — Level 4 Fit-Out',
  region: 'Cabuyao Technopark, Laguna',
  lat: 14.2789,
  lon: 121.1245,
};

interface LiveWeatherData {
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

interface DailyForecastItem {
  date: string;
  dayName: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipitationProb: number;
  windSpeedMax: number;
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

export default function DailySiteDiary({ logs, projects = [], onAddLog, onToggleWeatherSuspension }: DailySiteDiaryProps) {
  // Initial site location based on active project coordinates or default
  const initialLocation = useMemo<SiteLocation>(() => {
    if (projects && projects.length > 0) {
      const p = projects[0];
      return {
        id: p.id,
        name: p.name,
        region: p.location || 'Laguna, Philippines',
        lat: p.latitude || (p.name.toLowerCase().includes('bgc') ? 14.5547 : 14.2547),
        lon: p.longitude || (p.name.toLowerCase().includes('bgc') ? 121.0509 : 121.5056),
        projectId: p.id,
      };
    }
    return DEFAULT_SITE_LOCATION;
  }, [projects]);

  // Active dynamic location state
  const [selectedLocation, setSelectedLocation] = useState<SiteLocation>(initialLocation);
  
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

  // Manual Weather Fallback State (Offline Resilience: condition, temperature, wind)
  const [isManualOverride, setIsManualOverride] = useState<boolean>(false);
  const [manualCondition, setManualCondition] = useState<'SUNNY' | 'OVERCAST' | 'RAINY' | 'STORM'>('SUNNY');
  const [manualTemp, setManualTemp] = useState<number>(29);
  const [manualWind, setManualWind] = useState<number>(16);

  // Modal State for Logging a Weather Observation
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [logNotes, setLogNotes] = useState<string>('');
  const [observerName, setObserverName] = useState<string>('Engr. Ricardo Ramos (PM)');
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

    setNotification(
      nextState
        ? '⚠️ WORK SUSPENDED DUE TO WEATHER (FORCE MAJEURE) ACTIVATED. Project timeline flagged for weather extension.'
        : '✅ Weather suspension lifted. Regular site execution resumed.'
    );
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

  // Fetch Live Weather with PostgreSQL local cache & offline resilience
  const fetchWeather = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      // 1. First Priority: Call backend endpoint backed by PostgreSQL weather cache
      try {
        const query = `?lat=${selectedLocation.lat}&lon=${selectedLocation.lon}&location=${encodeURIComponent(selectedLocation.name)}`;
        const backendRes = await fetch(`/api/weather/live${query}`);
        if (backendRes.ok) {
          const bData = await backendRes.json();
          if (bData?.success && bData?.weather) {
            const w = bData.weather;
            setLiveWeather({
              temperature: w.temperature,
              apparentTemperature: w.apparentTemperature,
              humidity: w.humidity,
              precipitation: w.precipitation,
              weatherCode: w.weatherCode,
              windSpeed: w.windSpeed,
              windDirection: w.windDirection,
              pressure: w.pressure,
              time: w.time || new Date().toISOString(),
            });
            setIsCachedTelemetry(Boolean(bData.cached));
            setIsManualOverride(false);

            if (!isSimulationMode) {
              setSimWind(Math.round(w.windSpeed));
              setSimPrecip(w.precipitation);
              setSimTemp(Math.round(w.temperature));
              setSimHumidity(w.humidity);
            }
            setLastFetched(new Date());
            setIsLoading(false);
            return;
          }
        }
      } catch (backendErr) {
        console.warn('Backend weather endpoint unavailable, attempting direct provider:', backendErr);
      }

      // 2. Direct Open-Meteo fallback
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${selectedLocation.lat}&longitude=${selectedLocation.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=Asia%2FManila`;
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

        // Initialize simulation default from live readings
        if (!isSimulationMode) {
          setSimWind(Math.round(data.current.wind_speed_10m));
          setSimPrecip(data.current.precipitation);
          setSimTemp(Math.round(data.current.temperature_2m));
          setSimHumidity(data.current.relative_humidity_2m);
        }
      }

      if (data.daily && data.daily.time) {
        const days: DailyForecastItem[] = data.daily.time.map((dateStr: string, idx: number) => {
          const dateObj = new Date(dateStr);
          const dayName = idx === 0 ? 'Today' : idx === 1 ? 'Tomorrow' : dateObj.toLocaleDateString('en-US', { weekday: 'short' });
          return {
            date: dateStr,
            dayName,
            weatherCode: data.daily.weather_code[idx],
            tempMax: data.daily.temperature_2m_max[idx],
            tempMin: data.daily.temperature_2m_min[idx],
            precipitationProb: data.daily.precipitation_probability_max[idx],
            windSpeedMax: data.daily.wind_speed_10m_max[idx],
          };
        });
        setForecast(days);
      }

      setLastFetched(new Date());
    } catch (err: any) {
      console.warn('Weather sensors offline, switching to graceful manual input:', err);
      setFetchError('Offline or location services unreachable. Manual site override enabled.');
      setIsManualOverride(true);
      // Graceful manual weather state
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
    }
  }, [selectedLocation, isSimulationMode, manualCondition, manualTemp]);

  useEffect(() => {
    fetchWeather();
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

  // Handle Recording Current Live Weather Snapshot to System Logs
  const handleSaveObservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveWeather) return;

    const finalWeatherType = isManualOverride ? manualCondition : currentWeatherInfo.conditionType;
    const finalTemp = `${isManualOverride ? manualTemp : liveWeather.temperature.toFixed(1)}°C`;
    const finalLabel = isManualOverride 
      ? (manualCondition === 'SUNNY' ? 'Clear Sky' : manualCondition === 'OVERCAST' ? 'Overcast' : manualCondition === 'RAINY' ? 'Light Rain' : 'Heavy Rain / Suspended')
      : currentWeatherInfo.label;

    onAddLog({
      date: new Date().toISOString(),
      weather: finalWeatherType,
      temperature: finalTemp,
      activeHeadcount: 0,
      equipmentOnSite: `Wind: ${liveWeather.windSpeed.toFixed(1)} km/h (${getWindDirection(liveWeather.windDirection)}) | Humidity: ${liveWeather.humidity}% | Mode: ${isManualOverride ? 'Manual Field Entry' : isCachedTelemetry ? 'PostgreSQL Cache' : 'Live Sensor'}`,
      toolboxTopic: `Weather Condition: ${finalLabel}`,
      workCompleted: `Meteorological Snapshot for ${selectedLocation.name} (${selectedLocation.region}): ${finalLabel}. Ambient: ${finalTemp}, Humidity: ${liveWeather.humidity}%, Wind: ${liveWeather.windSpeed.toFixed(1)} km/h. ${logNotes.trim() ? `Field Note: ${logNotes.trim()}` : ''}`,
      delaysOrIssues: (liveWeather.precipitation > 0 || finalWeatherType === 'STORM') ? `Precipitation recorded: ${liveWeather.precipitation} mm` : undefined,
      supervisorName: observerName.trim() || 'Site Weather Officer',
    });

    setLogNotes('');
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

  return (
    <div className="space-y-6">
      
      {/* Top Header & Location Hub Switcher */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
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

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Dynamic Active Project Selector */}
          {projects && projects.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white">
              <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <select
                value={selectedLocation.projectId || ''}
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
                className="bg-transparent text-xs text-white focus:outline-none cursor-pointer pr-1 max-w-[150px] truncate"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-slate-950 text-white">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Device GPS Auto-Detect Button */}
          <button
            type="button"
            onClick={handleUseDeviceGPS}
            disabled={isGpsLocating}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs transition-colors border border-slate-700 flex items-center gap-1.5 cursor-pointer"
            title="Auto-detect current coordinates using Device GPS"
          >
            <LocateFixed className={`w-3.5 h-3.5 ${isGpsLocating ? 'animate-spin text-amber-400' : 'text-emerald-400'}`} />
            <span className="hidden sm:inline">{isGpsLocating ? 'Locating...' : 'Device GPS'}</span>
          </button>

          {/* Custom City / Municipality Geocoding Search */}
          <div className="relative">
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white w-40 sm:w-48">
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
              <div className="absolute top-full left-0 mt-1 w-60 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
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

          {/* PostgreSQL Local Cache Telemetry Badge */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-[11px] font-mono text-slate-300">
            <span className={`w-2 h-2 rounded-full ${isCachedTelemetry ? 'bg-indigo-400' : 'bg-emerald-400 animate-pulse'}`} />
            <span>{isCachedTelemetry ? 'PostgreSQL Cache Active' : 'Live Sensors Active'}</span>
          </div>

          {/* Manual Fallback Mode Toggle */}
          <button
            onClick={() => setIsManualOverride(prev => !prev)}
            className={`p-2 rounded-xl text-xs transition-colors border flex items-center gap-1.5 cursor-pointer ${
              isManualOverride
                ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title="Toggle Manual Site Weather Fallback"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isManualOverride ? 'Manual Override ON' : 'Manual Fallback'}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={fetchWeather}
            disabled={isLoading}
            className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 hover:text-white rounded-xl text-xs transition-colors border border-slate-700 flex items-center gap-1 cursor-pointer"
            title="Refresh Live Sensor Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs transition-colors border border-slate-700 flex items-center gap-1.5 cursor-pointer"
            title="Export Site Diary as CSV"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          {/* Log Weather Observation Modal Trigger */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Log Weather Record</span>
          </button>
        </div>
      </div>

      {/* Force Majeure Active Warning Banner */}
      {isForceMajeureSuspended && (
        <div className="bg-rose-950/95 border-2 border-rose-500 rounded-2xl p-4 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-900 border border-rose-500 rounded-xl text-rose-200 shrink-0">
              <ShieldAlert className="w-6 h-6 text-rose-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-rose-500 text-slate-950 text-[10px] font-black uppercase tracking-wider font-mono">
                  FORCE MAJEURE ACTIVE
                </span>
                <h3 className="text-sm font-bold text-white">Work Suspended Due to Extreme Weather Conditions</h3>
              </div>
              <p className="text-xs text-rose-200/80 mt-1 leading-relaxed">
                Site execution at <strong className="text-white">{selectedLocation.name}</strong> is currently suspended under Force Majeure protocols. Timeline variance and handover schedules have been flagged for contractual delay extension.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleForceMajeure}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-rose-500 text-rose-200 text-xs font-bold transition cursor-pointer shrink-0"
          >
            Lift Weather Suspension
          </button>
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
            onClick={fetchWeather}
            className="mt-2 px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Hero Live Current Conditions */}
          <div className="lg:col-span-8 bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/20 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
              <div className="flex items-center gap-4">
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-700 shadow-inner">
                  <CurrentIcon className={`w-12 h-12 ${currentWeatherInfo.color}`} />
                </div>
                <div>
                  <div className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight flex items-baseline gap-2">
                    {liveWeather ? `${liveWeather.temperature.toFixed(1)}°C` : '--.-°C'}
                    <span className="text-xs font-normal text-slate-400 font-sans">
                      Feels like {liveWeather ? `${liveWeather.apparentTemperature.toFixed(1)}°C` : '--'}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-slate-200 mt-1 flex items-center gap-2">
                    <span>{currentWeatherInfo.label}</span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${currentWeatherInfo.badgeColor}`}>
                      {selectedLocation.name}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right text-xs text-slate-400">
                <div className="flex items-center gap-1 sm:justify-end text-slate-500 font-mono">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Telemetry Timestamp</span>
                </div>
                <div className="font-mono text-white text-xs font-bold mt-0.5">
                  {lastFetched ? lastFetched.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Syncing...'}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Lat: {selectedLocation.lat}°N, Lon: {selectedLocation.lon}°E
                </div>
              </div>
            </div>

            {/* Core Meteorological Data Grid (4 Sensors) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                  <span>HUMIDITY</span>
                  <Droplets className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div className="text-xl font-bold font-mono text-white">
                  {liveWeather ? `${liveWeather.humidity}%` : '--%'}
                </div>
                <div className="text-[10px] text-slate-500">
                  {liveWeather && liveWeather.humidity > 80 ? 'High moisture' : 'Moderate'}
                </div>
              </div>

              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                  <span>WIND SPEED</span>
                  <Wind className="w-3.5 h-3.5 text-teal-400" />
                </div>
                <div className="text-xl font-bold font-mono text-white">
                  {liveWeather ? `${liveWeather.windSpeed.toFixed(1)}` : '--'} <span className="text-xs font-normal text-slate-400">km/h</span>
                </div>
                <div className="text-[10px] text-teal-400 font-mono">
                  Direction: {liveWeather ? getWindDirection(liveWeather.windDirection) : '--'}
                </div>
              </div>

              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                  <span>PRECIPITATION</span>
                  <CloudRain className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <div className="text-xl font-bold font-mono text-white">
                  {liveWeather ? `${liveWeather.precipitation.toFixed(1)}` : '--'} <span className="text-xs font-normal text-slate-400">mm</span>
                </div>
                <div className="text-[10px] text-slate-500">
                  {liveWeather && liveWeather.precipitation > 0 ? 'Active rainfall' : 'No rain recorded'}
                </div>
              </div>

              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                  <span>BAROMETER</span>
                  <Gauge className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <div className="text-xl font-bold font-mono text-white">
                  {liveWeather ? `${liveWeather.pressure.toFixed(0)}` : '----'} <span className="text-xs font-normal text-slate-400">hPa</span>
                </div>
                <div className="text-[10px] text-slate-500">
                  Atmospheric pressure
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

          </div>

          {/* 7-Day Weather Forecast */}
          <div className="lg:col-span-4 bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-3">
            <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  7-Day Site Outlook
                </h3>
                <p className="text-[10px] text-slate-400">Daily forecast for work planning</p>
              </div>
              <span className="text-[10px] font-mono text-slate-500">WMO Model</span>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[340px] pr-1 scrollbar-thin scrollbar-thumb-slate-800">
              {forecast.map((day, idx) => {
                const info = getWeatherInfo(day.weatherCode);
                const DayIcon = info.icon;
                return (
                  <div key={idx} className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between text-xs">
                    <div className="w-20">
                      <strong className="text-white block text-xs">{day.dayName}</strong>
                      <span className="text-[10px] text-slate-500 font-mono">{day.date.split('-').slice(1).join('/')}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <DayIcon className={`w-4 h-4 ${info.color}`} />
                      <span className="text-[11px] text-slate-300 truncate max-w-[90px]">{info.label.split('/')[0]}</span>
                    </div>

                    <div className="text-right font-mono">
                      <div className="text-white font-bold text-xs">
                        {Math.round(day.tempMax)}° / <span className="text-slate-500 font-normal">{Math.round(day.tempMin)}°</span>
                      </div>
                      <div className="text-[10px] text-blue-400 flex items-center justify-end gap-1">
                        <Umbrella className="w-2.5 h-2.5" />
                        <span>{day.precipitationProb}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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
                      const code = cond === 'SUNNY' ? 0 : cond === 'OVERCAST' ? 3 : cond === 'RAINY' ? 61 : 95;
                      setLiveWeather(prev => prev ? { ...prev, weatherCode: code } : null);
                    }}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
                  >
                    <option value="SUNNY">Clear Sky</option>
                    <option value="OVERCAST">Overcast</option>
                    <option value="RAINY">Light Rain</option>
                    <option value="STORM">Heavy Rain / Suspended</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Ambient Temp (°C)</label>
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
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-amber-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Supervisor / Observer Name</label>
                <input
                  type="text"
                  required
                  value={observerName}
                  onChange={(e) => setObserverName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
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

    </div>
  );
}
