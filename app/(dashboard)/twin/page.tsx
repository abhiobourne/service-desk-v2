"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Activity } from "lucide-react";
import { GlbViewerDark } from "@/components/GlbViewerDark";
import {
  fetchTroubleshootingByProduct,
  fetchProductCatalog,
  TroubleshootingDesignNode,
  ApiProductCatalog,
} from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_SERVER || "http://localhost:7000";

const SYS_LOGS = [
  { time: "14:22", msg: "Pressure delta deviation detected", level: "warning" },
  { time: "14:18", msg: "Vibration spike on axis-Z", level: "critical" },
  { time: "13:55", msg: "Coolant temp nominal restored", level: "ok" },
  { time: "12:40", msg: "Filter service reminder active", level: "warning" },
  { time: "11:30", msg: "All systems nominal", level: "ok" },
];

export default function DigitalTwinPage() {
  const router = useRouter();

  const [productsList, setProductsList] = useState<ApiProductCatalog[]>([]);
  const [twinProductId, setTwinProductId] = useState<string>("");
  const [twinTree, setTwinTree] = useState<TroubleshootingDesignNode[]>([]);
  const [twinGlbUrl, setTwinGlbUrl] = useState<string | null>(null);
  const [twinLoadingTree, setTwinLoadingTree] = useState(false);
  const [liveTelem, setLiveTelem] = useState({ nitrogen: 98.2, coreTemp: 4.2, pressure: 42.5, sysLoad: 74 });

  useEffect(() => {
    fetchProductCatalog().then(list => {
      setProductsList(list);
      if (list.length > 0) setTwinProductId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!twinProductId) return;
    setTwinLoadingTree(true);
    setTwinTree([]);
    setTwinGlbUrl(null);
    fetchTroubleshootingByProduct(twinProductId).then(res => {
      if (res.success && res.data.length > 0) {
        setTwinTree(res.data);
        for (const node of res.data) {
          const glb = node.drawing_files.find(f =>
            f.file_name.toLowerCase().endsWith(".glb") || f.file_name.toLowerCase().endsWith(".gltf")
          );
          if (glb) { setTwinGlbUrl(`${API_BASE}${glb.url}`); break; }
        }
      }
    }).finally(() => setTwinLoadingTree(false));
  }, [twinProductId]);

  useEffect(() => {
    const id = setInterval(() => {
      setLiveTelem(prev => ({
        nitrogen:  +Math.max(97.4, Math.min(99.2, prev.nitrogen  + (Math.random() - 0.5) * 0.3)).toFixed(1),
        coreTemp:  +Math.max(4.05, Math.min(4.48, prev.coreTemp  + (Math.random() - 0.5) * 0.06)).toFixed(2),
        pressure:  +Math.max(40.8, Math.min(44.8, prev.pressure  + (Math.random() - 0.5) * 0.5)).toFixed(1),
        sysLoad:   +Math.max(64,   Math.min(88,   prev.sysLoad   + (Math.random() - 0.5) * 4)).toFixed(0),
      }));
    }, 1400);
    return () => clearInterval(id);
  }, []);

  const twinProduct = productsList.find(p => p.id === twinProductId);
  const typeCounts = twinTree.reduce<Record<string, number>>((acc, n) => {
    acc[n.design_type] = (acc[n.design_type] ?? 0) + 1; return acc;
  }, {});

  const TELEMETRY = [
    { label: "Nitrogen",  value: liveTelem.nitrogen.toFixed(1),            unit: "%",   color: "text-cyan-400",    warn: liveTelem.nitrogen < 97.8 },
    { label: "Core Temp", value: liveTelem.coreTemp.toFixed(2),            unit: "K",   color: liveTelem.coreTemp > 4.35 ? "text-amber-400" : "text-emerald-400", warn: liveTelem.coreTemp > 4.35 },
    { label: "Pressure",  value: liveTelem.pressure.toFixed(1),            unit: "psi", color: "text-amber-400",   warn: liveTelem.pressure > 43.5 },
    { label: "Sys Load",  value: Math.round(liveTelem.sysLoad).toString(), unit: "%",   color: liveTelem.sysLoad > 80 ? "text-rose-400" : "text-white", warn: liveTelem.sysLoad > 80 },
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden p-6 bg-[#07090e]">
      <div className="flex flex-col gap-4" style={{ height: "calc(100vh - 120px)" }}>

        {/* Top bar */}
        <div className="shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold font-mono text-white uppercase">
              {twinProduct?.product_name ?? "Digital Twin"}
            </h2>
            <p className="text-xs font-mono text-white/40 mt-0.5">
              {twinProduct ? `ID: ${twinProduct.product_id}` : "Select a product to load 3D model"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {productsList.length > 0 && (
              <select
                value={twinProductId}
                onChange={e => setTwinProductId(e.target.value)}
                className="bg-[#0c0e16] border border-white/10 text-white text-xs font-mono px-3 py-1.5 rounded focus:outline-none focus:border-violet-500/40"
              >
                {productsList.map(p => (
                  <option key={p.id} value={p.id}>{p.product_name}</option>
                ))}
              </select>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span>{twinLoadingTree ? "Loading…" : twinTree.length > 0 ? "Tree Loaded" : "Live"}</span>
            </div>
          </div>
        </div>

        {/* Main viewer with overlays */}
        <div className="flex-1 relative rounded-xl overflow-hidden min-h-0 border border-white/5">
          <div className="absolute inset-0 bg-[#06070a]">
            {twinLoadingTree ? (
              <div className="h-full flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
              </div>
            ) : twinGlbUrl ? (
              <GlbViewerDark src={twinGlbUrl} hotspots={[]} canGoBack={false} onBack={() => {}} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3">
                <Activity className="h-16 w-16 text-white/10" />
                <p className="text-sm font-mono text-white/25">No 3D model for this product</p>
                <p className="text-[10px] font-mono text-white/15">Upload a GLB file via admin portal</p>
              </div>
            )}
          </div>

          {/* Assembly diagnostics overlay — bottom-left */}
          <div className="absolute bottom-4 left-4 bg-[#06070a]/88 backdrop-blur-md border border-white/10 rounded-xl p-4 w-[220px] pointer-events-none">
            <p className="text-[9px] font-mono text-white/40 uppercase tracking-widest mb-2.5">Assembly Diagnostics</p>
            {twinTree.length === 0 ? (
              <p className="text-[10px] font-mono text-white/20">No data loaded</p>
            ) : (
              <>
                {Object.entries(typeCounts).map(([type, count]) => {
                  const clr = type === "Mother Assembly" ? "text-violet-400" : type === "Child Assembly" ? "text-blue-400" : type === "Component" ? "text-emerald-400" : "text-amber-400";
                  return (
                    <div key={type} className="flex justify-between items-center text-[10px] font-mono mb-1.5">
                      <span className={clr}>{type}</span>
                      <span className="text-white font-bold">{count}</span>
                    </div>
                  );
                })}
                <div className="mt-2 border-t border-white/10 pt-2 flex justify-between text-[10px] font-mono">
                  <span className="text-white/40">Total Nodes</span>
                  <span className="text-white font-bold">{twinTree.length}</span>
                </div>
              </>
            )}
          </div>

          {/* Right sidebar */}
          <div className="absolute top-0 right-0 bottom-0 w-[280px] bg-[#06070a]/90 backdrop-blur-md border-l border-white/8 flex flex-col overflow-hidden">
            {/* Live Telemetry */}
            <div className="p-4 border-b border-white/8 shrink-0">
              <p className="text-[9px] font-mono text-white/40 uppercase tracking-widest mb-3">Live Telemetry</p>
              <div className="grid grid-cols-2 gap-2">
                {TELEMETRY.map(card => (
                  <div key={card.label} className={`bg-white/5 border rounded-lg p-3 ${card.warn ? "border-amber-500/20" : "border-white/5"}`}>
                    <p className="text-[8px] font-mono text-white/35 mb-1 truncate">{card.label}</p>
                    <p className={`text-base font-bold font-mono leading-none ${card.color}`}>
                      {card.value}
                      <span className="text-[9px] text-white/30 ml-0.5">{card.unit}</span>
                    </p>
                    {card.warn && <p className="text-[8px] font-mono text-amber-500 mt-1">▲ Warning</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* System Logs */}
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-[9px] font-mono text-white/40 uppercase tracking-widest mb-3">System Logs</p>
              {SYS_LOGS.map((log, i) => (
                <div key={i} className="flex gap-2 mb-3">
                  <span className="text-[9px] font-mono text-white/25 shrink-0 mt-0.5 w-10">{log.time}</span>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${log.level === "critical" ? "bg-rose-500" : log.level === "warning" ? "bg-amber-500" : "bg-emerald-500"}`} />
                  <p className="text-[10px] font-mono text-white/55 leading-snug">{log.msg}</p>
                </div>
              ))}
            </div>

            {/* Quick links */}
            <div className="p-3 border-t border-white/8 flex gap-2 shrink-0">
              <button onClick={() => router.push("/diagnostics/troubleshooting")}
                className="flex-1 py-2 bg-violet-600/20 border border-violet-500/30 text-violet-400 text-[10px] font-mono uppercase rounded hover:bg-violet-600/30 transition">
                Troubleshoot
              </button>
              <button onClick={() => router.push("/tickets")}
                className="flex-1 py-2 bg-white/5 border border-white/8 text-white/50 text-[10px] font-mono uppercase rounded hover:bg-white/10 transition">
                Tickets
              </button>
            </div>
          </div>
        </div>

        {/* Quick-Order strip */}
        {productsList.length > 0 && (
          <div className="shrink-0">
            <p className="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-2">Inventory Quick-Order</p>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {productsList.map((p, i) => {
                const inStock = i % 3 !== 2;
                return (
                  <div key={p.id} className="shrink-0 bg-[#0c0e16] border border-white/5 rounded-lg p-3 w-[170px] hover:border-white/10 transition">
                    <p className="text-[10px] font-mono text-white/60 truncate mb-0.5">{p.product_name}</p>
                    <code className="text-[9px] font-mono text-violet-400">{p.product_id}</code>
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-[8px] font-mono ${inStock ? "text-emerald-400" : "text-amber-400"}`}>
                        {inStock ? "• In Stock" : "• Low Stock"}
                      </span>
                      <button className="text-[9px] font-mono text-violet-400 hover:text-violet-300 transition">Order →</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
