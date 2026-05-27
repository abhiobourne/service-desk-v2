"use client";

import React, { useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { Loader2, Maximize2, RotateCcw, Activity } from "lucide-react";
import { useTheme } from "../providers/ThemeProvider";

/**
 * Standard Error Boundary for robust GLB loading fallbacks.
 */
class ErrorBoundary extends React.Component<{ children: React.ReactNode; fallback: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.warn("ViewRay Portal Model loader failed or offline. Engaging dynamic cybermatic wireframe fallbacks:", error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

/**
 * Rotating cube wireframe mesh to indicate active asset streaming.
 */
function LoaderMesh() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.04;
      meshRef.current.rotation.x += 0.02;
    }
  });
  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#06b6d4" wireframe />
    </mesh>
  );
}

export interface DynamicHotspot {
  id: string;
  label: string;
  description?: string;
  onActivate: () => void;
}

/**
 * Dynamically streams actual ViewRay portal GLB drawings into Three.js.
 */
function PortalGltfModel({ mode, activeGlbUrl, dynamicHotspots = [] }: { mode: string, activeGlbUrl?: string | null, dynamicHotspots?: DynamicHotspot[] }) {
  const isBrowser = typeof window !== "undefined";
  const baseUrl = isBrowser ? `http://${window.location.hostname}:7000/api/v1/files` : "http://127.0.0.1:7000/api/v1/files";

  const modelUrlMap: Record<string, string> = {
    turbine: `${baseUrl}/1778652509459-981429694-engine_four_cylinder_low_poly__game_ready.glb`,
    mri: `${baseUrl}/1778652526973-16052661-bmw_rds_radio.glb`,
    diagnostics: `${baseUrl}/1779436322796-183340015-better_exhaust.glb`,
    "component-ordering": `${baseUrl}/1778652561181-732556382-better_gauges.glb`,
  };

  const url = activeGlbUrl || modelUrlMap[mode] || modelUrlMap.turbine;
  const { scene } = useGLTF(url);
  const clonedScene = React.useMemo(() => scene.clone(true), [scene]);
  
  // Style materials with cybernetic wireframe style to fit cockpit HUD perfectly!
  useEffect(() => {
    if (!clonedScene) return;
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => {
            if (mat) (mat as THREE.MeshBasicMaterial).wireframe = true;
          });
        } else if (mesh.material) {
          (mesh.material as THREE.MeshBasicMaterial).wireframe = true;
        }
      }
    });
  }, [clonedScene]);

  const box = React.useMemo(() => new THREE.Box3().setFromObject(clonedScene), [clonedScene]);
  const center = React.useMemo(() => {
    if (box.isEmpty()) return new THREE.Vector3(0, 0, 0);
    const v = new THREE.Vector3();
    box.getCenter(v);
    return v;
  }, [box]);
  const size = React.useMemo(() => {
    if (box.isEmpty()) return new THREE.Vector3(1, 1, 1);
    const v = new THREE.Vector3();
    box.getSize(v);
    return v;
  }, [box]);

  const scale = React.useMemo(() => {
    if (box.isEmpty()) return 1;
    const maxDim = Math.max(size.x, size.y, size.z);
    return maxDim > 0 ? 4.5 / maxDim : 1;
  }, [box, size]);
  return (
    <group scale={scale} position={[0, -0.6, 0]} rotation={[0.4, 0.5, 0.2]}>
      <primitive object={clonedScene} />
      {dynamicHotspots.map((hotspot, index) => {
        const total = dynamicHotspots.length;
        const angle = total <= 1 ? Math.PI / 5 : (index / total) * Math.PI * 2 - Math.PI / 2;
        const radiusX = Math.max(size.x * 0.56, 0.4);
        const radiusZ = Math.max(size.z * 0.56, 0.4);
        const yFraction = total <= 3 ? 0.12 : index % 2 === 0 ? 0.18 : -0.04;
        const pos: [number, number, number] = [
          center.x + Math.cos(angle) * radiusX,
          center.y + size.y * yFraction,
          center.z + Math.sin(angle) * radiusZ,
        ];
        return (
          <Html key={hotspot.id} position={pos} center>
            <button
              onClick={(e) => {
                e.stopPropagation();
                hotspot.onActivate();
              }}
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#090b10]/95 border border-[#06b6d4]/40 text-[10px] font-mono tracking-wider backdrop-blur shadow-[0_0_10px_#06b6d433] hover:scale-105 transition hover:bg-[#06b6d4]/10 cursor-pointer pointer-events-auto"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#06b6d4] animate-ping absolute" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#06b6d4]" />
              <span className="text-white font-bold text-[9px] uppercase whitespace-nowrap">{hotspot.label}</span>
            </button>
          </Html>
        );
      })}
    </group>
  );
}

// Turbine Rotor Model Components
function TurbineRotor({ isRotating }: { isRotating: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current && isRotating) {
      groupRef.current.rotation.x += 0.015;
    }
  });

  return (
    <group ref={groupRef} rotation={[0, 0, 0]}>
      {/* Central Shaft */}
      <mesh>
        <cylinderGeometry args={[0.2, 0.2, 5, 32]} />
        <meshBasicMaterial color="#475569" wireframe />
      </mesh>

      {/* Turbine Blades - Concentric Rings */}
      {Array.from({ length: 6 }).map((_, i) => {
        const radius = 0.8 + i * 0.25;
        const width = 0.15;
        const segmentCount = 20 - i * 2;
        const zPos = -2 + i * 0.8;

        return (
          <group key={i} position={[0, zPos, 0]} rotation={[0, 0, (i * Math.PI) / 6]}>
            {/* Outer Ring */}
            <mesh>
              <cylinderGeometry args={[radius, radius, width, 32, 1, true]} />
              <meshBasicMaterial color="#1e3a8a" wireframe />
            </mesh>
            {/* Blades */}
            {Array.from({ length: segmentCount }).map((_, j) => {
              const angle = (j / segmentCount) * Math.PI * 2;
              const x = Math.cos(angle) * (radius - 0.2);
              const y = Math.sin(angle) * (radius - 0.2);
              return (
                <mesh
                  key={j}
                  position={[x, 0, y]}
                  rotation={[0, -angle, 0.3]}
                >
                  <boxGeometry args={[0.04, width * 1.5, radius * 0.4]} />
                  <meshBasicMaterial color={i % 2 === 0 ? "#60a5fa" : "#3b82f6"} wireframe />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

// MRI Machine Model Components
function MriTwin({ calibrateScale, bedPosition }: { calibrateScale: number; bedPosition: number }) {
  const gantryRef = useRef<THREE.Mesh>(null);
  
  useFrame(() => {
    if (gantryRef.current && calibrateScale > 1) {
      gantryRef.current.rotation.y += 0.04;
    }
  });

  return (
    <group position={[0, -0.3, 0]} rotation={[0.4, -0.6, 0]}>
      {/* Outer Gantry Ring */}
      <mesh ref={gantryRef}>
        <cylinderGeometry args={[1.8, 1.8, 1.6, 24, 6]} />
        <meshBasicMaterial color="#3b82f6" wireframe />
      </mesh>
      
      {/* Inner Bore Ring */}
      <mesh>
        <cylinderGeometry args={[1.2, 1.2, 1.62, 24, 2, true]} />
        <meshBasicMaterial color="#1e40af" wireframe />
      </mesh>

      {/* Cryogenic cooling chambers (Tubes on top) */}
      <mesh position={[0, 1.9, 0.4]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.22, 0.22, 1.2, 12]} />
        <meshBasicMaterial color="#10b981" wireframe />
      </mesh>
      <mesh position={[0, 1.9, -0.4]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.22, 0.22, 1.2, 12]} />
        <meshBasicMaterial color="#10b981" wireframe />
      </mesh>

      {/* Patient Table Bed (Slides in/out based on slider) */}
      <group position={[0, -0.8, -1.8 + bedPosition * 1.5]}>
        {/* Flat bed */}
        <mesh>
          <boxGeometry args={[0.8, 0.1, 2.2]} />
          <meshBasicMaterial color="#60a5fa" wireframe />
        </mesh>
        {/* Support structure */}
        <mesh position={[0, -0.4, 0]}>
          <boxGeometry args={[0.6, 0.7, 0.4]} />
          <meshBasicMaterial color="#1e3a8a" wireframe />
        </mesh>
      </group>
    </group>
  );
}

// Actuator Assembly (Diagnostics)
function HydraulicActuator({ isActive, progress }: { isActive: boolean; progress: number }) {
  const pistonRef = useRef<THREE.Group>(null);
  
  return (
    <group position={[0, 0, 0]} rotation={[0, 0.8, 0.5]}>
      {/* Cylinder outer casing */}
      <mesh>
        <cylinderGeometry args={[0.6, 0.6, 2.5, 16]} />
        <meshBasicMaterial color="#475569" wireframe />
      </mesh>
      {/* Mounting flanges */}
      <mesh position={[0, 1.25, 0]}>
        <cylinderGeometry args={[0.7, 0.7, 0.1, 16]} />
        <meshBasicMaterial color="#94a3b8" wireframe />
      </mesh>
      <mesh position={[0, -1.25, 0]}>
        <cylinderGeometry args={[0.7, 0.7, 0.1, 16]} />
        <meshBasicMaterial color="#94a3b8" wireframe />
      </mesh>

      {/* Moving Piston shaft */}
      <group ref={pistonRef} position={[0, progress * 0.8, 0]}>
        {/* Piston Rod */}
        <mesh position={[0, 1.2, 0]}>
          <cylinderGeometry args={[0.25, 0.25, 1.6, 16]} />
          <meshBasicMaterial color="#60a5fa" wireframe />
        </mesh>
        {/* Piston end joint */}
        <mesh position={[0, 2.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.4, 12]} />
          <meshBasicMaterial color="#f87171" wireframe />
        </mesh>
      </group>

      {/* Flashing Leak Point (Flasher Box around seal) */}
      {Math.floor(Date.now() / 300) % 2 === 0 && (
        <mesh position={[0, 0.8, 0]}>
          <boxGeometry args={[1.4, 0.4, 1.4]} />
          <meshBasicMaterial color="#ef4444" wireframe />
        </mesh>
      )}
    </group>
  );
}

// Thermal Coupling Wireframe
function ComponentWireframe() {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.003;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]} rotation={[0.4, 0.5, 0.2]}>
      {/* Base Chassis Block */}
      <mesh>
        <boxGeometry args={[2.5, 1.8, 2.5]} />
        <meshBasicMaterial color="#1e3a8a" wireframe />
      </mesh>
      
      {/* Drive Motor Cylinder */}
      <mesh position={[0, 1.4, 0]}>
        <cylinderGeometry args={[0.8, 0.8, 1.0, 16]} />
        <meshBasicMaterial color="#475569" wireframe />
      </mesh>

      {/* Cooling Manifold Tubes */}
      <group position={[-1.4, 0, 0]}>
        <mesh position={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 1.2, 8]} />
          <meshBasicMaterial color="#3b82f6" wireframe />
        </mesh>
        <mesh position={[0, -0.6, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 1.2, 8]} />
          <meshBasicMaterial color="#3b82f6" wireframe />
        </mesh>
        {/* Active Thermal Coupling in Neon Green with thick highlight */}
        <mesh position={[0.2, 0, 0]}>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshBasicMaterial color="#10b981" wireframe />
        </mesh>
        {/* Glow Bounding Frame */}
        <mesh position={[0.2, 0, 0]}>
          <boxGeometry args={[0.55, 0.55, 0.55]} />
          <meshBasicMaterial color="#10b981" />
        </mesh>
      </group>
    </group>
  );
}

// Laser Scanning Sweep Animation Component
function LaserSweep() {
  const sweepRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (sweepRef.current) {
      sweepRef.current.position.y = Math.sin(state.clock.getElapsedTime() * 7) * 2.2;
    }
  });

  return (
    <mesh ref={sweepRef} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.3, 2.2, 32]} />
      <meshBasicMaterial color="#f43f5e" side={THREE.DoubleSide} transparent opacity={0.7} wireframe />
    </mesh>
  );
}

interface Cyber3DViewerProps {
  mode: "turbine" | "mri" | "diagnostics" | "component-ordering";
  calibrateActive?: boolean;
  mriBedPos?: number; // 0 to 1
  diagnosticActive?: boolean;
  selectedHotspot?: string;
  onHotspotClick?: (name: string) => void;
  laserScanActive?: boolean; // Laser Scanning Sweep trigger
  activeGlbUrl?: string | null;
  dynamicHotspots?: DynamicHotspot[];
}

export default function Cyber3DViewer({
  mode,
  calibrateActive = false,
  mriBedPos = 0.5,
  diagnosticActive = false,
  selectedHotspot,
  onHotspotClick,
  laserScanActive = false,
  activeGlbUrl = null,
  dynamicHotspots = [],
}: Cyber3DViewerProps) {
  const [loading, setLoading] = useState(true);
  const [calibrateScale, setCalibrateScale] = useState(1);
  const [diaProgress, setDiaProgress] = useState(0.5);
  const { theme } = useTheme();
  const bgColor = theme === "light" ? "#f1f5f9" : "#090b10";
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, [mode]);

  // MRI Calibrate animation effect
  useEffect(() => {
    let interval: any;
    if (calibrateActive) {
      setCalibrateScale(1.8);
      interval = setInterval(() => {
        setCalibrateScale((s) => (s > 1 ? s - 0.05 : 1));
      }, 50);
    } else {
      setCalibrateScale(1);
    }
    return () => clearInterval(interval);
  }, [calibrateActive]);

  // Diagnostic Piston animation effect
  useEffect(() => {
    let animationFrame: any;
    let tick = 0;
    if (diagnosticActive) {
      const animate = () => {
        tick += 0.08;
        setDiaProgress(Math.sin(tick) * 0.4 + 0.5);
        animationFrame = requestAnimationFrame(animate);
      };
      animate();
    } else {
      setDiaProgress(0.5);
    }
    return () => cancelAnimationFrame(animationFrame);
  }, [diagnosticActive]);

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[250px] flex items-center justify-center rounded-lg overflow-hidden border border-slate-200 dark:border-white/5 group shadow-inner" style={{ backgroundColor: bgColor }}>
      {/* Cybernetic HUD elements overlay */}
      <div className="absolute inset-0 border border-[#06b6d4]/10 pointer-events-none rounded-lg" />
      
      {/* Corner crosshairs */}
      <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-white/30 pointer-events-none" />
      <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-white/30 pointer-events-none" />
      <div className="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-white/30 pointer-events-none" />
      <div className="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-white/30 pointer-events-none" />
      
      {/* Grid overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.03]" 
        style={{
          backgroundImage: `
            linear-gradient(to right, #ffffff 1px, transparent 1px),
            linear-gradient(to bottom, #ffffff 1px, transparent 1px)
          `,
          backgroundSize: "20px 20px"
        }}
      />

      {loading ? (
        <div className="flex flex-col items-center gap-3 text-[#60a5fa] z-10">
          <Loader2 className="h-9 w-9 animate-spin text-cyan-400" />
          <span className="text-xs font-mono tracking-widest text-cyan-400 uppercase">
            Initializing Digital Twin...
          </span>
        </div>
      ) : (
        <>
          <Canvas camera={{ position: [0, 0, 7.5], fov: 45 }} style={{ background: bgColor }}>
            <color attach="background" args={[bgColor]} />
            <ambientLight intensity={0.2} />
            <pointLight position={[10, 10, 10]} intensity={1.5} />
            <pointLight position={[-10, -10, -10]} intensity={0.5} />
            
            {/* Grid helper */}
            <gridHelper args={[20, 20, "#1e293b", "#0f172a"]} position={[0, -2, 0]} />

            <ErrorBoundary 
              key={mode}
              fallback={
                <React.Suspense fallback={null}>
                  {mode === "turbine" && <TurbineRotor isRotating={true} />}
                  {mode === "mri" && (
                    <MriTwin calibrateScale={calibrateScale} bedPosition={mriBedPos} />
                  )}
                  {mode === "diagnostics" && (
                    <HydraulicActuator isActive={diagnosticActive} progress={diaProgress} />
                  )}
                  {mode === "component-ordering" && <ComponentWireframe />}
                </React.Suspense>
              }
            >
              <React.Suspense fallback={<LoaderMesh />}>
                <PortalGltfModel mode={mode} activeGlbUrl={activeGlbUrl} dynamicHotspots={dynamicHotspots} />
              </React.Suspense>
            </ErrorBoundary>

            {/* Render dynamic laser sweep if scanning is active */}
            {mode === "turbine" && laserScanActive && <LaserSweep />}


            <OrbitControls makeDefault enableDamping dampingFactor={0.05} minDistance={2} maxDistance={10} />
          </Canvas>

          {/* Quick HUD controls */}
          <div className="absolute top-3 left-3 pointer-events-none">
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#121620]/80 border border-white/5 font-mono text-[9px] tracking-wider uppercase text-white/50 backdrop-blur">
              <Activity className="h-3 w-3 text-cyan-400 animate-pulse" />
              <span>Realtime telemetry active</span>
            </span>
          </div>

          <div className="absolute bottom-3 right-3 flex items-center gap-2 z-10">
            <button
              onClick={() => {
                if (mode === "mri") setCalibrateScale(1.8);
                if (mode === "diagnostics") setDiaProgress(0.5);
              }}
              title="Reset Viewport"
              className="flex h-7 w-7 items-center justify-center rounded bg-[#121620]/90 border border-white/10 hover:border-cyan-500/30 text-white/70 hover:text-cyan-400 hover:shadow-[0_0_10px_#06b6d422] transition duration-200 pointer-events-auto backdrop-blur"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              title="Toggle Fullscreen"
              onClick={() => {
                if (!document.fullscreenElement) {
                  containerRef.current?.requestFullscreen();
                } else {
                  document.exitFullscreen();
                }
              }}
              className="flex h-7 w-7 items-center justify-center rounded bg-slate-100/90 dark:bg-[#121620]/90 border border-slate-300 dark:border-white/10 hover:border-cyan-500/30 text-slate-600 dark:text-white/70 hover:text-cyan-600 dark:hover:text-cyan-400 hover:shadow-[0_0_10px_#06b6d422] transition duration-200 pointer-events-auto backdrop-blur"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Hologram scan line effect */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-cyan-500/[0.015] to-transparent bg-[length:100%_4px] animate-pulse" />
        </>
      )}
    </div>
  );
}
