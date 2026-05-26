"use client";

import React, { Suspense, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Bounds, useGLTF, useProgress, Html } from "@react-three/drei";
import * as THREE from "three";
import { ArrowLeft, Check, Grid3X3, Loader2, Box, MoveRight, Plus } from "lucide-react";

export interface DarkHotspot {
  id: string;
  label: string;
  description?: string;
  color?: string;
  onActivate: () => void;
}

function Model({ src, hotspots }: { src: string; hotspots: DarkHotspot[] }) {
  const { scene } = useGLTF(src);
  const cloned = useMemo(() => scene.clone(true), [scene]);

  const box = useMemo(() => new THREE.Box3().setFromObject(cloned), [cloned]);
  const center = useMemo(() => {
    const v = new THREE.Vector3();
    return box.isEmpty() ? v : box.getCenter(v);
  }, [box]);
  const size = useMemo(() => {
    const v = new THREE.Vector3(1, 1, 1);
    return box.isEmpty() ? v : box.getSize(new THREE.Vector3());
  }, [box]);

  return (
    <>
      <primitive object={cloned} />
      {hotspots.map((hs, i) => {
        const total = hotspots.length;
        const angle = total <= 1 ? Math.PI / 5 : (i / total) * Math.PI * 2 - Math.PI / 2;
        const rx = Math.max(size.x * 0.56, 0.4);
        const rz = Math.max(size.z * 0.56, 0.4);
        const yFrac = total <= 3 ? 0.12 : i % 2 === 0 ? 0.18 : -0.04;
        const pos: [number, number, number] = [
          center.x + Math.cos(angle) * rx,
          center.y + size.y * yFrac,
          center.z + Math.sin(angle) * rz,
        ];
        const color = hs.color ?? "#6366f1";
        return (
          <Html key={hs.id} position={pos} center style={{ pointerEvents: "auto" }}>
            <button
              onClick={e => { e.stopPropagation(); hs.onActivate(); }}
              className="group flex max-w-[180px] items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] shadow-xl backdrop-blur-md transition hover:scale-105 active:scale-95"
              style={{ borderColor: `${color}55`, background: `rgba(0,0,0,0.75)`, color: "#fff" }}
            >
              <span
                className="h-4 w-4 shrink-0 flex items-center justify-center rounded-full text-[9px] font-bold text-white shadow"
                style={{ background: color }}
              >
                {i + 1}
              </span>
              <span className="flex-1 font-semibold truncate">{hs.label}</span>
              <MoveRight className="h-3 w-3 shrink-0 opacity-60" style={{ color }} />
            </button>
          </Html>
        );
      })}
    </>
  );
}

function ProgressOverlay() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#06070a]/80 z-10 pointer-events-none">
      <Loader2 className="h-8 w-8 text-violet-400 animate-spin mb-3" />
      <span className="text-[11px] font-mono text-white/40">{Math.round(progress)}%</span>
    </div>
  );
}

interface GlbViewerDarkProps {
  src: string | null;
  hotspots?: DarkHotspot[];
  canGoBack?: boolean;
  onBack?: () => void;
  onAddActive?: () => void;
  isActiveAdded?: boolean;
}

export function GlbViewerDark({ src, hotspots = [], canGoBack = false, onBack, onAddActive, isActiveAdded = false }: GlbViewerDarkProps) {
  const [showGrid, setShowGrid] = useState(false);

  if (!src) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-[#06070a]">
        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
          <Box className="w-7 h-7 text-white/20" />
        </div>
        <div className="text-center">
          <p className="text-sm font-mono text-white/30">No 3D file selected</p>
          <p className="text-xs font-mono text-white/20 mt-1">Click a .glb file in the tree to view it</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-[#06070a] overflow-hidden">
      <Canvas
        key={src}
        camera={{ position: [0, 0, 5], fov: 45 }}
        style={{ width: "100%", height: "100%", background: "#06070a" }}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[5, 10, 5]} intensity={1.4} castShadow />
        <directionalLight position={[-5, -5, -5]} intensity={0.3} />
        <pointLight position={[0, 5, 0]} intensity={0.5} />
        <Environment preset="studio" />
        <Suspense fallback={null}>
          <Bounds key={src} fit clip observe margin={1.25}>
            <Model src={src} hotspots={hotspots} />
          </Bounds>
        </Suspense>
        {showGrid && <gridHelper args={[20, 20, "#1a1a2e", "#0d0d1a"]} />}
        <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
      </Canvas>

      <ProgressOverlay />

      {/* Bottom-left hint */}
      <div className="pointer-events-none absolute left-2.5 bottom-2.5 flex items-center gap-1.5 rounded-md border border-white/8 bg-black/50 px-2.5 py-1 text-[10px] text-white/30 backdrop-blur-sm font-mono">
        Drag · scroll · right-drag to pan
      </div>

      {hotspots.length > 0 && (
        <div className="pointer-events-none absolute bottom-9 left-2.5 rounded-md border border-violet-500/20 bg-black/60 px-2.5 py-1 text-[10px] font-mono text-violet-300/50 backdrop-blur-sm">
          Click a hotspot to drill into child assembly
        </div>
      )}

      {/* Top-right controls */}
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
        {onAddActive && (
          <button
            onClick={onAddActive}
            className={`flex h-7 items-center gap-1.5 rounded-lg border px-2 text-[10px] font-mono backdrop-blur-sm transition ${
              isActiveAdded
                ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-200"
                : "border-violet-500/30 bg-black/50 text-violet-200 hover:border-violet-400/60"
            }`}
            title={isActiveAdded ? "Remove component from ticket" : "Add component to ticket"}
          >
            {isActiveAdded ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {isActiveAdded ? "Added" : "Add"}
          </button>
        )}
        {canGoBack && (
          <button
            onClick={onBack}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-black/50 text-white/50 backdrop-blur-sm transition hover:border-white/30 hover:text-white"
            title="Back to previous assembly"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={() => setShowGrid(v => !v)}
          className={`flex h-7 w-7 items-center justify-center rounded-lg border backdrop-blur-sm transition ${
            showGrid
              ? "border-violet-500/40 bg-violet-500/20 text-violet-300"
              : "border-white/10 bg-black/50 text-white/50 hover:border-white/30 hover:text-white"
          }`}
          title="Toggle grid"
        >
          <Grid3X3 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
