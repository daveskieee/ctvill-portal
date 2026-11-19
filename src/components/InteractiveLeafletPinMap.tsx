import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, MapPin } from 'lucide-react';

interface InteractiveLeafletPinMapProps {
  lat: number;
  lon: number;
  onChange: (newLat: number, newLon: number) => void;
  flyToTrigger?: number;
  heightClass?: string;
}

const createLdmPinIcon = () =>
  L.divIcon({
    className: 'ldm-custom-pin-icon',
    iconSize: [44, 54],
    iconAnchor: [22, 50],
    html: `
      <div style="position:relative;width:44px;height:54px;display:flex;align-items:center;justify-content:center;user-select:none;-webkit-user-select:none;cursor:grab;">
        <div style="position:absolute;bottom:2px;width:18px;height:7px;background:rgba(0,0,0,0.45);border-radius:50%;filter:blur(2px);"></div>
        <div style="position:absolute;bottom:4px;width:28px;height:28px;border-radius:50%;background:rgba(245,158,11,0.28);border:1.5px solid rgba(245,158,11,0.75);animation:ping 1.8s cubic-bezier(0,0,0.2,1) infinite;"></div>
        <svg width="40" height="48" viewBox="0 0 38 46" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 6px 10px rgba(0,0,0,0.55));position:relative;z-index:2;">
          <path d="M19 1C9.05887 1 1 9.05887 1 19C1 31.25 19 45 19 45C19 45 37 31.25 37 19C37 9.05887 28.9411 1 19 1Z" fill="#F59E0B" stroke="#0F172A" stroke-width="2.5"/>
          <circle cx="19" cy="18.5" r="7.5" fill="#0F172A"/>
          <circle cx="19" cy="18.5" r="3.5" fill="#FDE68A"/>
        </svg>
      </div>
    `
  });

export const InteractiveLeafletPinMap: React.FC<InteractiveLeafletPinMapProps> = ({
  lat,
  lon,
  onChange,
  flyToTrigger = 0,
  heightClass = 'h-80'
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const streetLayerRef = useRef<L.TileLayer | null>(null);
  const satelliteLayerRef = useRef<L.TileLayer | null>(null);
  const isInternalDragRef = useRef<boolean>(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [tileMode, setTileMode] = useState<'street' | 'satellite'>('street');
  const [isLocatingGps, setIsLocatingGps] = useState<boolean>(false);
  const [gpsStatusMessage, setGpsStatusMessage] = useState<{
    text: string;
    type: 'info' | 'warning';
  } | null>(null);

  // Initialize Leaflet Map once on mount
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialLat = Number.isFinite(lat) ? lat : 14.246909;
    const initialLon = Number.isFinite(lon) ? lon : 121.138789;

    const map = L.map(containerRef.current, {
      center: [initialLat, initialLon],
      zoom: 17,
      zoomControl: false,
      dragging: true,
      scrollWheelZoom: true,
      touchZoom: true,
      doubleClickZoom: true,
      attributionControl: true
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    });

    const satelliteLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
      }
    );

    streetLayer.addTo(map);
    streetLayerRef.current = streetLayer;
    satelliteLayerRef.current = satelliteLayer;

    const marker = L.marker([initialLat, initialLon], {
      draggable: true,
      autoPan: true,
      icon: createLdmPinIcon()
    }).addTo(map);

    // Live drag updates
    marker.on('dragstart', () => {
      isInternalDragRef.current = true;
    });

    marker.on('drag', () => {
      const pos = marker.getLatLng();
      onChangeRef.current(Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6)));
    });

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      const nextLat = Number(pos.lat.toFixed(6));
      const nextLon = Number(pos.lng.toFixed(6));
      onChangeRef.current(nextLat, nextLon);
      map.panTo([nextLat, nextLon], { animate: true });
      setTimeout(() => {
        isInternalDragRef.current = false;
      }, 60);
    });

    // Click anywhere on the map to drop/move the pin immediately
    map.on('click', (e: L.LeafletMouseEvent) => {
      isInternalDragRef.current = true;
      const nextLat = Number(e.latlng.lat.toFixed(6));
      const nextLon = Number(e.latlng.lng.toFixed(6));
      marker.setLatLng([nextLat, nextLon]);
      onChangeRef.current(nextLat, nextLon);
      map.panTo([nextLat, nextLon], { animate: true });
      setTimeout(() => {
        isInternalDragRef.current = false;
      }, 60);
    });

    mapRef.current = map;
    markerRef.current = marker;

    // Ensure crisp full-width tile rendering inside animated modal
    const t1 = setTimeout(() => map.invalidateSize(), 50);
    const t2 = setTimeout(() => map.invalidateSize(), 220);
    const t3 = setTimeout(() => map.invalidateSize(), 480);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      if (resizeObserver) resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Sync external lat/lon changes (typing in inputs or selecting search suggestions)
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker || isInternalDragRef.current) return;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const currentPos = marker.getLatLng();
    const diff = Math.abs(currentPos.lat - lat) + Math.abs(currentPos.lng - lon);
    if (diff > 0.000001) {
      marker.setLatLng([lat, lon]);
      map.panTo([lat, lon], { animate: true });
    }
  }, [lat, lon]);

  // Smooth flyTo when search suggestion, preset, or GPS is triggered
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker || flyToTrigger === 0) return;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    marker.setLatLng([lat, lon]);
    map.flyTo([lat, lon], Math.max(map.getZoom(), 17), {
      animate: true,
      duration: 0.75
    });
  }, [flyToTrigger]);

  // Switch between Street (OSM) and Satellite (Esri World Imagery)
  const handleToggleTileMode = (mode: 'street' | 'satellite') => {
    setTileMode(mode);
    const map = mapRef.current;
    const streetLayer = streetLayerRef.current;
    const satelliteLayer = satelliteLayerRef.current;
    if (!map || !streetLayer || !satelliteLayer) return;

    if (mode === 'satellite') {
      if (map.hasLayer(streetLayer)) map.removeLayer(streetLayer);
      if (!map.hasLayer(satelliteLayer)) satelliteLayer.addTo(map);
    } else {
      if (map.hasLayer(satelliteLayer)) map.removeLayer(satelliteLayer);
      if (!map.hasLayer(streetLayer)) streetLayer.addTo(map);
    }
  };

  const applyFallbackCabuyaoHq = () => {
    const fallbackLat = 14.2785;
    const fallbackLon = 121.1235;
    isInternalDragRef.current = true;
    onChangeRef.current(fallbackLat, fallbackLon);
    if (markerRef.current && mapRef.current) {
      markerRef.current.setLatLng([fallbackLat, fallbackLon]);
      mapRef.current.flyTo([fallbackLat, fallbackLon], 17, { animate: true, duration: 0.75 });
    }
    setTimeout(() => {
      isInternalDragRef.current = false;
    }, 100);
    setGpsStatusMessage({
      text: 'Centered on Cabuyao HQ — Drag pin or search to set project site',
      type: 'info'
    });
    setTimeout(() => {
      setGpsStatusMessage(null);
    }, 5000);
  };

  const handleUseCurrentGps = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!navigator.geolocation) {
      applyFallbackCabuyaoHq();
      return;
    }
    setIsLocatingGps(true);
    setGpsStatusMessage(null);
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setIsLocatingGps(false);
          const nextLat = Number(pos.coords.latitude.toFixed(6));
          const nextLon = Number(pos.coords.longitude.toFixed(6));
          isInternalDragRef.current = true;
          onChangeRef.current(nextLat, nextLon);
          if (markerRef.current && mapRef.current) {
            markerRef.current.setLatLng([nextLat, nextLon]);
            mapRef.current.flyTo([nextLat, nextLon], 17, { animate: true, duration: 0.75 });
          }
          setTimeout(() => {
            isInternalDragRef.current = false;
          }, 100);
          setGpsStatusMessage({
            text: `Centered on current device GPS (${nextLat.toFixed(6)}° N, ${nextLon.toFixed(6)}° E)`,
            type: 'info'
          });
          setTimeout(() => {
            setGpsStatusMessage(null);
          }, 4000);
        },
        () => {
          setIsLocatingGps(false);
          applyFallbackCabuyaoHq();
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    } catch {
      setIsLocatingGps(false);
      applyFallbackCabuyaoHq();
    }
  };

  return (
    <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 relative select-none">
      {/* Interactive Leaflet Map Container */}
      <div
        ref={containerRef}
        className={`w-full ${heightClass} select-none cursor-crosshair`}
        style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
      />

      {/* Top-Left Live Coordinate Badge */}
      <div className="
        absolute top-3 left-3 z-[1000] pointer-events-none
        bg-slate-900/95 backdrop-blur-md border border-slate-700/90
        rounded-xl px-3 py-2 shadow-xl flex items-center gap-2.5
      ">
        <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
        <div>
          <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400">
            Pinned Lot Coordinates • Drag Pin or Click Map
          </div>
          <div className="text-xs font-mono font-bold text-white">
            {Number(lat || 0).toFixed(6)}° N, {Number(lon || 0).toFixed(6)}° E
          </div>
        </div>
      </div>

      {/* Top-Right Map Layer & GPS Controls */}
      <div
        className="absolute top-3 right-3 z-[1000] pointer-events-auto flex items-center gap-1.5"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/90 rounded-xl p-1 flex items-center gap-1 shadow-xl">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleTileMode('street');
            }}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer ${
              tileMode === 'street'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            🗺️ Street
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleTileMode('satellite');
            }}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer ${
              tileMode === 'satellite'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            🛰️ Satellite
          </button>
        </div>

        <button
          type="button"
          onClick={handleUseCurrentGps}
          disabled={isLocatingGps}
          title="Center map on current device GPS"
          className="px-2.5 py-1.5 rounded-xl bg-slate-900/95 hover:bg-slate-800 backdrop-blur-md border border-slate-700/90 text-cyan-300 text-[10px] font-mono font-bold shadow-xl flex items-center gap-1.5 cursor-pointer transition disabled:opacity-60"
        >
          <LocateFixed className={`w-3.5 h-3.5 text-cyan-400 ${isLocatingGps ? 'animate-spin' : ''}`} />
          <span>{isLocatingGps ? 'Locating...' : 'Use Current GPS'}</span>
        </button>
      </div>

      {/* Clean Neutral Status Pill */}
      {gpsStatusMessage && (
        <div
          className="absolute bottom-3 left-3 right-14 z-[1000] pointer-events-none px-3 py-1.5 rounded-full border border-slate-700/90 bg-slate-900/95 text-slate-200 text-[11px] font-mono shadow-xl backdrop-blur-md flex items-center gap-2 w-fit max-w-[calc(100%-5rem)]"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
          <span className="truncate">{gpsStatusMessage.text}</span>
        </div>
      )}
    </div>
  );
};
