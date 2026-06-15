"use client";

import React, { Suspense, useMemo, useState, useRef, useEffect, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Bounds, useGLTF, useAnimations, useProgress, Html } from "@react-three/drei";
import * as THREE from "three";
import {
  ArrowLeft, Check, Grid3X3, Loader2, Box, MoveRight, Plus, X as XIcon,
  Maximize2, Minimize2, RotateCcw, Layers,
} from "lucide-react";
import { useTheme } from "../providers/ThemeProvider";

export interface DarkHotspot {
  id: string;
  label: string;
  description?: string;
  color?: string;
  onActivate: () => void;
}

function Model({
  src,
  hotspots,
  wireframe,
  animate,
}: {
  src: string;
  hotspots: DarkHotspot[];
  wireframe: boolean;
  animate: boolean;
}) {
  // Use scene directly (not cloned) so AnimationMixer can bind tracks by name
  const { scene, animations } = useGLTF(src);
  const groupRef = useRef<THREE.Group>(null!);
  const { actions } = useAnimations(animations, groupRef);

  const box = useMemo(() => new THREE.Box3().setFromObject(scene), [scene]);
  const center = useMemo(() => {
    const v = new THREE.Vector3();
    return box.isEmpty() ? v : box.getCenter(v);
  }, [box]);
  const size = useMemo(() => {
    const v = new THREE.Vector3(1, 1, 1);
    return box.isEmpty() ? v : box.getSize(new THREE.Vector3());
  }, [box]);

  // Wireframe toggle
  useEffect(() => {
    scene.traverse((child: any) => {
      if (child.isMesh) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((mat: any) => { if (mat) mat.wireframe = wireframe; });
      }
    });
  }, [scene, wireframe]);

  // Play / stop embedded GLB animation clips based on animate prop
  useEffect(() => {
    Object.values(actions).forEach(action => {
      if (!action) return;
      if (animate) {
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.reset().play();
      } else {
        action.stop();
      }
    });
  }, [animate, actions]);

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
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
          <Html key={hs.id} position={pos} center zIndexRange={[10, 20]} style={{ pointerEvents: "auto" }}>
            <button
              onClick={e => { e.stopPropagation(); hs.onActivate(); }}
              className="group flex max-w-[180px] items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] shadow-xl backdrop-blur-md transition hover:scale-105 active:scale-95 bg-white/90 text-slate-900 dark:bg-black/75 dark:text-white"
              style={{ borderColor: `${color}55` }}
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
    </group>
  );
}

function AnimatedGlow() {
  const cyanRef = useRef<THREE.PointLight>(null);
  const purpleRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (cyanRef.current) {
      cyanRef.current.intensity = 3 + Math.sin(t * 1.4) * 1.8;
      cyanRef.current.color.setHSL(0.52 + Math.sin(t * 0.6) * 0.02, 1, 0.5);
    }
    if (purpleRef.current) {
      purpleRef.current.intensity = 1.2 + Math.sin(t * 0.9 + 1.2) * 0.8;
    }
  });

  return (
    <>
      <pointLight ref={cyanRef} position={[0, 0.4, 0.3]} color="#00e5ff" intensity={3} distance={5} decay={2} />
      <pointLight ref={purpleRef} position={[0, -0.3, 0.5]} color="#7c3aed" intensity={1.5} distance={4} decay={2} />
    </>
  );
}

function ProgressOverlay() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 dark:bg-[#06070a]/80 z-10 pointer-events-none">
      <Loader2 className="h-8 w-8 text-violet-500 dark:text-violet-400 animate-spin mb-3" />
      <span className="text-[11px] font-mono text-slate-600 dark:text-white/40">{Math.round(progress)}%</span>
    </div>
  );
}

// Exposes OrbitControls API to the outer component via callback
function OrbitControlsWrapper({ onMount }: { onMount: (api: any) => void }) {
  const ref = useRef<any>(null);
  useEffect(() => {
    if (ref.current) onMount(ref.current);
  });
  return <OrbitControls ref={ref} makeDefault enableDamping dampingFactor={0.05} />;
}

interface GlbViewerDarkProps {
  src: string | null;
  hotspots?: DarkHotspot[];
  canGoBack?: boolean;
  onBack?: () => void;
  onAddActive?: () => void;
  isActiveAdded?: boolean;
  autoRotate?: boolean;
}

export function GlbViewerDark({
  src,
  hotspots = [],
  canGoBack = false,
  onBack,
  onAddActive,
  isActiveAdded = false,
  autoRotate = false,
}: GlbViewerDarkProps) {
  const [showGrid, setShowGrid]         = useState(false);
  const [wireframe, setWireframe]       = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { theme } = useTheme();
  const bgColor = theme === "light" ? "#f8fafc" : "#06070a";

  const containerRef = useRef<HTMLDivElement>(null);
  const controlsApiRef = useRef<any>(null);

  const handleOrbitMount = useCallback((api: any) => {
    controlsApiRef.current = api;
  }, []);

  const handleResetView = useCallback(() => {
    controlsApiRef.current?.reset();
  }, []);

  const handleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen?.();
    }
  }, []);

  // Track fullscreen state
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Reset wireframe when model changes
  useEffect(() => {
    setWireframe(false);
  }, [src]);

  const ctrlBtnClass = (active?: boolean) =>
    `flex h-7 w-7 items-center justify-center rounded-lg border backdrop-blur-sm transition shadow-sm ${
      active
        ? "border-violet-400 bg-violet-100 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/20 dark:text-violet-300"
        : "border-slate-300 bg-white/80 text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-white/10 dark:bg-black/50 dark:text-white/50 dark:hover:border-white/30 dark:hover:text-white"
    }`;

  if (!src) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-4" style={{ backgroundColor: bgColor }}>
        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center">
          <Box className="w-7 h-7 text-slate-400 dark:text-white/20" />
        </div>
        <div className="text-center">
          <p className="text-sm font-mono text-slate-600 dark:text-white/30">No 3D file selected</p>
          <p className="text-xs font-mono text-slate-500 dark:text-white/20 mt-1">Click a .glb file in the tree to view it</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden" style={{ backgroundColor: bgColor }}>
      <Canvas
        key={src}
        camera={{ position: [0, 0, 5], fov: 45 }}
        style={{ width: "100%", height: "100%", background: bgColor }}
      >
        <color attach="background" args={[bgColor]} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[5, 10, 5]} intensity={1.4} castShadow />
        <directionalLight position={[-5, -5, -5]} intensity={0.3} />
        <pointLight position={[0, 5, 0]} intensity={0.5} />
        <Environment preset="studio" />
        <AnimatedGlow />
        <Suspense fallback={null}>
          <Bounds key={src} fit clip margin={1.25}>
            <Model src={src} hotspots={hotspots} wireframe={wireframe} animate={autoRotate} />
          </Bounds>
        </Suspense>
        {showGrid && <gridHelper args={[20, 20, "#1a1a2e", "#0d0d1a"]} />}
        <OrbitControlsWrapper onMount={handleOrbitMount} />
      </Canvas>

      <ProgressOverlay />

      {/* Bottom-left hints */}
      <div className="pointer-events-none absolute left-2.5 bottom-2.5 flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-white/8 bg-white/80 dark:bg-black/50 px-2.5 py-1 text-[10px] text-slate-600 dark:text-white/30 backdrop-blur-sm font-mono shadow-sm">
        Drag · scroll · right-drag to pan
      </div>

      {hotspots.length > 0 && (
        <div className="pointer-events-none absolute bottom-9 left-2.5 rounded-md border border-violet-300 dark:border-violet-500/20 bg-violet-50/80 dark:bg-black/60 px-2.5 py-1 text-[10px] font-mono text-violet-700 dark:text-violet-300/50 backdrop-blur-sm shadow-sm">
          Click a hotspot to drill into child assembly
        </div>
      )}

      {/* Top-right controls */}
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
        {onAddActive && (
          <button
            onClick={onAddActive}
            className="flex h-7 items-center gap-1.5 rounded-lg border px-2 text-[10px] font-mono backdrop-blur-sm transition shadow-sm border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/25"
            title="Remove component from selection"
          >
            <XIcon className="h-3.5 w-3.5" />
            Remove
          </button>
        )}
        {canGoBack && (
          <button
            onClick={onBack}
            className={ctrlBtnClass()}
            title="Back to previous assembly"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Reset View */}
        <button
          onClick={handleResetView}
          className={ctrlBtnClass()}
          title="Reset view"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>

        {/* Wireframe */}
        <button
          onClick={() => setWireframe(v => !v)}
          className={ctrlBtnClass(wireframe)}
          title={wireframe ? "Disable wireframe" : "Enable wireframe"}
        >
          <Layers className="h-3.5 w-3.5" />
        </button>

        {/* Grid */}
        <button
          onClick={() => setShowGrid(v => !v)}
          className={ctrlBtnClass(showGrid)}
          title="Toggle grid"
        >
          <Grid3X3 className="h-3.5 w-3.5" />
        </button>

        {/* Fullscreen */}
        <button
          onClick={handleFullscreen}
          className={ctrlBtnClass(isFullscreen)}
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen
            ? <Minimize2 className="h-3.5 w-3.5" />
            : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
