"use client";

import React, { memo, useEffect, useRef } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";
import { useTheme } from "@/providers/ThemeProvider";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";

export interface MapMarker {
  name: string;
  coordinates: [number, number]; // [lng, lat]
  status: "nominal" | "critical" | "warning";
  detail?: string;
}

const STATUS = {
  nominal:  { dot: "#10b981", ring: "#10b981", label: "bg-emerald-500" },
  critical: { dot: "#ef4444", ring: "#ef4444", label: "bg-rose-500" },
  warning:  { dot: "#f59e0b", ring: "#f59e0b", label: "bg-amber-500" },
};

interface Props {
  markers?: MapMarker[];
  loaded?: boolean;
  autoSelectFirst?: boolean;
}

function WorldMapInner({ markers = [], loaded = true, autoSelectFirst = false }: Props) {
  const [tooltip, setTooltip] = React.useState<{ name: string; detail?: string; x: number; y: number } | null>(null);
  const [selected, setSelected] = React.useState<MapMarker | null>(null);
  const autoSelectedRef = useRef(false);
  const { theme } = useTheme();

  const center = selected?.coordinates ?? [0, 10];
  const zoom = selected ? 3.4 : 1;

  // When markers load for the first time, auto-select the first one to zoom in
  useEffect(() => {
    if (autoSelectFirst && loaded && markers.length > 0 && !autoSelectedRef.current) {
      autoSelectedRef.current = true;
      // Small delay so the map has a chance to render before transitioning
      setTimeout(() => setSelected(markers[0]), 400);
    }
  }, [loaded, markers, autoSelectFirst]);

  // Reset auto-select flag when markers change significantly (new data)
  useEffect(() => {
    if (!loaded) autoSelectedRef.current = false;
  }, [loaded]);

  if (!loaded) {
    return (
      <div className="relative w-full h-full bg-[#090b10] rounded overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] bg-[length:20px_20px]" />
        <div className="flex flex-col items-center gap-3 text-white/30">
          <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
          <span className="text-[10px] font-mono uppercase tracking-widest">Loading deployment data…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-slate-50 dark:bg-[#090b10] rounded overflow-hidden select-none">
      {/* subtle grid overlay */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[radial-gradient(#000000_1px,transparent_1px)] dark:bg-[radial-gradient(#ffffff_1px,transparent_1px)] bg-[length:20px_20px]" />

      <ComposableMap
        projection="geoNaturalEarth1"
        projectionConfig={{ scale: 155, center: [0, 10] }}
        style={{ width: "100%", height: "100%" }}
      >
        {/* transitionDuration animates center/zoom changes */}
        <ZoomableGroup center={center} zoom={zoom} minZoom={1} maxZoom={6}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  style={{
                    default: { 
                      fill: theme === 'light' ? '#e2e8f0' : '#1a1f2e', 
                      stroke: theme === 'light' ? '#cbd5e1' : '#2a3040', 
                      strokeWidth: 0.4, 
                      outline: "none" 
                    },
                    hover:   { 
                      fill: theme === 'light' ? '#cbd5e1' : '#222840', 
                      stroke: theme === 'light' ? '#94a3b8' : '#3b4560', 
                      strokeWidth: 0.5, 
                      outline: "none" 
                    },
                    pressed: { 
                      fill: theme === 'light' ? '#e2e8f0' : '#1a1f2e', 
                      outline: "none" 
                    },
                  }}
                />
              ))
            }
          </Geographies>

          {markers.map((m, i) => {
            const s = STATUS[m.status];
            return (
              <Marker
                key={i}
                coordinates={m.coordinates}
                onMouseEnter={(e: React.MouseEvent) => {
                  const rect = (e.currentTarget as SVGElement).closest("svg")?.getBoundingClientRect();
                  if (rect) setTooltip({ name: m.name, detail: m.detail, x: e.clientX - rect.left, y: e.clientY - rect.top });
                }}
                onMouseLeave={() => setTooltip(null)}
                onClick={() => setSelected(m)}
              >
                {/* Pulsing ring */}
                <circle r={9} fill="none" stroke={s.ring} strokeWidth={1} opacity={0.3}>
                  <animate attributeName="r" values="6;14;6" dur="2.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.4;0;0.4" dur="2.5s" repeatCount="indefinite" />
                </circle>
                {/* Core dot */}
                <circle r={4} fill={s.dot} stroke="#0a0c14" strokeWidth={1.5} style={{ cursor: "pointer" }} />
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-20 pointer-events-none bg-[#0c0e16] border border-white/10 px-2.5 py-1.5 rounded text-[9px] font-mono text-white shadow-lg"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <div className="font-bold text-[10px]">{tooltip.name}</div>
          {tooltip.detail && <div className="text-white/50 mt-0.5">{tooltip.detail}</div>}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-2 left-3 flex items-center gap-3">
        {(["nominal", "warning", "critical"] as const).map(s => (
          <div key={s} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: STATUS[s].dot }} />
            <span className="text-[8px] font-mono text-white/35 uppercase">{s}</span>
          </div>
        ))}
      </div>

      {selected && (
        <div className="absolute right-3 top-3 max-w-56 rounded border border-cyan-400/20 bg-white/95 dark:bg-[#0c0e16]/95 p-3 font-mono shadow-xl text-slate-800 dark:text-white">
          <div className="mb-1 text-[10px] uppercase tracking-widest text-cyan-600 dark:text-cyan-200">Installation View</div>
          <div className="text-xs font-semibold text-slate-900 dark:text-white">{selected.name}</div>
          {selected.detail && <div className="mt-1 text-[10px] text-slate-600 dark:text-white/45">{selected.detail}</div>}
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="mt-3 rounded border border-slate-300 dark:border-white/10 px-2 py-1 text-[10px] uppercase tracking-wider text-slate-600 dark:text-white/45 transition hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
          >
            World View
          </button>
        </div>
      )}
    </div>
  );
}

export const WorldMap = memo(WorldMapInner);
