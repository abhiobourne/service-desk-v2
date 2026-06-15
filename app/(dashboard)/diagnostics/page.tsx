"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Play, AlertTriangle, Activity,
  Cpu, TrendingUp, Zap, FileText, Layers, Box,
  Thermometer, Gauge, BarChart3,
} from "lucide-react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { GlbViewerDark } from "@/components/GlbViewerDark";
import DiagnosisModal from "@/components/DiagnosisModal";
import { AddTicketDrawer } from "@/components/tickets/AddTicketDrawer";
import {
  fetchMachines, fetchTickets, createTicket,
  fetchProductCatalog, fetchTroubleshootingByProduct,
  ApiMachine, ApiTicket, ApiProductCatalog, TroubleshootingDesignNode,
} from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_SERVER || "http://localhost:7000";

function mkTelemHistory(count = 30) {
  let pressure = -40, flow = 112;
  return Array.from({ length: count }, (_, i) => {
    pressure = +(Math.max(-55, Math.min(-30, pressure + (Math.random() - 0.5) * 4))).toFixed(1);
    flow     = +(Math.max(105, Math.min(120,  flow     + (Math.random() - 0.5) * 2))).toFixed(1);
    return { i, pressure, flow };
  });
}

export default function DiagnosticsPage() {
  const router = useRouter();

  const [rawMachines, setRawMachines] = useState<ApiMachine[]>([]);
  const [rawTickets, setRawTickets] = useState<ApiTicket[]>([]);
  const [diagnosticRunning, setDiagnosticRunning] = useState(false);
  const [showDiagModal, setShowDiagModal] = useState(false);
  const [ticketDrawerOpen, setTicketDrawerOpen] = useState(false);
  const [faultyNode, setFaultyNode] = useState<TroubleshootingDesignNode | null>(null);
  const [diagnosticStep, setDiagnosticStep] = useState<number>(2);

  // Last diagnosis from localStorage cache
  const [lastDiagCache, setLastDiagCache] = useState<{
    design_id: string; design_name: string; design_type: string;
    design_uuid: string; design_version_id: string; timestamp: string;
  } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("lastDiagnosis");
      if (raw) setLastDiagCache(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [showDiagModal]); // re-read after each modal close
  const [loading, setLoading] = useState(true);

  // GLB / Digital Twin state
  const [productsList, setProductsList] = useState<ApiProductCatalog[]>([]);
  const [twinProductId, setTwinProductId] = useState<string>("");
  const [twinTree, setTwinTree] = useState<TroubleshootingDesignNode[]>([]);
  const [twinGlbUrl, setTwinGlbUrl] = useState<string | null>(null);
  const [twinLoadingTree, setTwinLoadingTree] = useState(false);

  // Live telemetry simulation
  const [liveTelem, setLiveTelem] = useState({
    nitrogen: 98.2, coreTemp: 4.2, pressure: 42.5, sysLoad: 74,
  });

  // Live flow/pressure history for Telemetry Context chart
  const [telemHistory, setTelemHistory] = useState(() => mkTelemHistory(30));

  useEffect(() => {
    const id = setInterval(() => {
      setTelemHistory(prev => {
        const last = prev[prev.length - 1];
        const pressure = +(Math.max(-55, Math.min(-30, last.pressure + (Math.random() - 0.5) * 4))).toFixed(1);
        const flow     = +(Math.max(105, Math.min(120, last.flow     + (Math.random() - 0.5) * 2))).toFixed(1);
        return [...prev.slice(1), { i: last.i + 1, pressure, flow }];
      });
    }, 1200);
    return () => clearInterval(id);
  }, []);

  // Load machines, tickets, and product catalog
  useEffect(() => {
    Promise.all([
      fetchMachines(),
      fetchTickets(),
      fetchProductCatalog(),
    ]).then(([m, t, p]) => {
      setRawMachines(m);
      setRawTickets(t);
      setProductsList(p);
      if (p.length > 0) setTwinProductId(p[0].id);
    }).finally(() => setLoading(false));
  }, []);

  // Load GLB for selected product
  useEffect(() => {
    if (!twinProductId) return;
    setTwinLoadingTree(true);
    setTwinTree([]);
    setTwinGlbUrl(null);
    fetchTroubleshootingByProduct(twinProductId).then(res => {
      if (res.success) {
        setTwinTree(res.data);
        // 1. Try product-level GLB first
        if (res.product_glb) {
          setTwinGlbUrl(`${API_BASE}${res.product_glb}`);
          return;
        }
        // 2. Fall back to first design node that has a GLB file
        for (const node of res.data) {
          const glb = node.drawing_files.find(f =>
            f.file_name.toLowerCase().endsWith(".glb") || f.file_name.toLowerCase().endsWith(".gltf")
          );
          if (glb) { setTwinGlbUrl(`${API_BASE}${glb.url}`); break; }
        }
      }
    }).finally(() => setTwinLoadingTree(false));
  }, [twinProductId]);

  // Live telemetry simulation
  useEffect(() => {
    const id = setInterval(() => {
      setLiveTelem(prev => ({
        nitrogen: +Math.max(97.4, Math.min(99.2, prev.nitrogen + (Math.random() - 0.5) * 0.3)).toFixed(1),
        coreTemp: +Math.max(4.05, Math.min(4.48, prev.coreTemp + (Math.random() - 0.5) * 0.06)).toFixed(2),
        pressure: +Math.max(40.8, Math.min(44.8, prev.pressure + (Math.random() - 0.5) * 0.5)).toFixed(1),
        sysLoad: +Math.max(64, Math.min(88, prev.sysLoad + (Math.random() - 0.5) * 4)).toFixed(0),
      }));
    }, 1400);
    return () => clearInterval(id);
  }, []);

  const handleCreateTicket = async () => {
    const title = rawTickets.find(t => t.status === "OPEN")?.title || "System Fault ERR-9402-B";
    const desc = rawTickets.find(t => t.status === "OPEN")?.description || "Fault detected on primary system unit. Inspection required.";
    await createTicket(title, desc, "CRITICAL");
    router.push("/tickets");
  };

  const activeTicket = rawTickets.find(t => t.status === "OPEN" || t.status === "IN_PROGRESS");
  const machineName = rawMachines[0]?.name ?? "Primary System Unit";
  const twinProduct = productsList.find(p => p.id === twinProductId);

  const typeCounts = twinTree.reduce<Record<string, number>>((acc, n) => {
    acc[n.design_type] = (acc[n.design_type] ?? 0) + 1; return acc;
  }, {});

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#07090e]">

      {/* ── Page Header ── */}
      <div className="bg-white dark:bg-[#090b10] border-b border-slate-200 dark:border-white/5 px-6 py-4">
        <Breadcrumbs className="mb-2" items={[{ label: "Dashboard", href: "/" }, { label: "Diagnostics" }]} />
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white">Diagnostic Center</h1>
              <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">
                {loading ? "Initializing…" : `${machineName} · Real-time fault analysis & digital twin`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDiagModal(true)}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/70 hover:bg-slate-50 dark:hover:bg-white/10"
            >
              <Play className="h-3.5 w-3.5" /> Initiate Diagnostics
            </button>
            <button
              onClick={() => router.push("/diagnostics/troubleshooting")}
              className="px-3.5 py-2 bg-[#2D6CFA] hover:bg-[#255DE6] text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 shadow-[0_0_16px_rgba(45,108,250,0.2)]"
            >
              <Layers className="h-3.5 w-3.5" />
              Troubleshoot
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">

        {/* ── Live Telemetry KPIs ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "N₂ Purity", value: `${liveTelem.nitrogen}%`, unit: "Target ≥97.5%", icon: <BarChart3 className="w-4 h-4" />, color: "emerald", ok: liveTelem.nitrogen >= 97.5 },
            { label: "Core Temp", value: `${liveTelem.coreTemp}K`, unit: "Target 4.0–4.5K", icon: <Thermometer className="w-4 h-4" />, color: "blue", ok: liveTelem.coreTemp >= 4.0 && liveTelem.coreTemp <= 4.5 },
            { label: "He Pressure", value: `${liveTelem.pressure} psi`, unit: "Target 41–45 psi", icon: <Gauge className="w-4 h-4" />, color: "cyan", ok: liveTelem.pressure >= 41 && liveTelem.pressure <= 45 },
            { label: "Sys Load", value: `${liveTelem.sysLoad}%`, unit: "Warn >85%", icon: <Cpu className="w-4 h-4" />, color: liveTelem.sysLoad > 85 ? "amber" : "slate", ok: liveTelem.sysLoad <= 85 },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl p-4 flex items-center gap-3"
            >
              <div className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center ${kpi.ok
                ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"
                }`}>
                {kpi.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-mono text-slate-400 dark:text-white/30 uppercase tracking-widest truncate">{kpi.label}</p>
                <p className="text-lg font-bold font-mono text-slate-900 dark:text-white leading-none mt-0.5 tabular-nums">
                  {kpi.value}
                </p>
                <p className="text-[9px] text-slate-400 dark:text-white/25 mt-0.5 truncate">{kpi.unit}</p>
              </div>
              <span className={`w-2 h-2 rounded-full shrink-0 ${kpi.ok ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`} />
            </div>
          ))}
        </div>

        {/* ── Fault Summary Banner — driven by last diagnosis cache ── */}
        {lastDiagCache ? (() => {
          const diagTs = new Date(lastDiagCache.timestamp);
          const diagTime = diagTs.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
          const diagDate = diagTs.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
          const elapsedMs = Date.now() - diagTs.getTime();
          const elapsedMin = Math.floor(elapsedMs / 60000);
          const elapsedLabel = elapsedMin < 60
            ? `${elapsedMin}m ago`
            : `${Math.floor(elapsedMin / 60)}h ${elapsedMin % 60}m ago`;

          // Build timeline from the scan — fixed first 3 phases + the fault at the end
          const timeline = [
            { label: "Scan Started",     color: "emerald", done: true,  time: diagDate },
            { label: "Components Loaded", color: "emerald", done: true,  time: diagDate },
            { label: "Scan Complete",     color: "amber",   done: true,  time: diagDate },
            { label: `${lastDiagCache.design_name.length > 18 ? lastDiagCache.design_name.slice(0, 16) + "…" : lastDiagCache.design_name} Fault`, color: "rose", pulse: true, time: diagTime },
            { label: "Ticket Pending",    color: "slate",   muted: true, time: "Pending" },
          ];

          return (
            <div className="bg-white dark:bg-[#0c0e16] border border-rose-200 dark:border-rose-500/15 rounded-xl overflow-hidden">
              <div className="h-[3px] bg-gradient-to-r from-rose-600 via-rose-500 to-rose-400" />
              <div className="p-5">
                <div className="flex items-start justify-between gap-6 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-2.5 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-full text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                        Fault Detected
                      </span>
                      <code className="text-[11px] font-mono text-slate-400 dark:text-white/30 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded">
                        {lastDiagCache.design_type}
                      </code>
                      <span className="text-[10px] font-mono text-slate-400 dark:text-white/25">
                        {diagDate} · {diagTime}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2 leading-tight">
                      {lastDiagCache.design_name} — Fault Isolated
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-white/50 leading-relaxed max-w-2xl">
                      {lastDiagCache.design_type} subsystem anomaly detected during automated diagnosis.
                      Raise a service ticket to schedule inspection and repair.
                    </p>
                    <div className="flex items-center gap-2 mt-3.5 flex-wrap">
                      <button
                        onClick={() => {
                          const node = twinTree.find(n => n.design_id === lastDiagCache.design_id) ?? {
                            ...lastDiagCache,
                            design_version: "", level: 0, parent_design_uuid: null, parent_version_id: null,
                            root_design_id: "", root_design_name: "", drawing_files: [], kb_files: [], faq_items: [],
                          } as TroubleshootingDesignNode;
                          setFaultyNode(node);
                          setTicketDrawerOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition shadow-sm"
                      >
                        <Zap className="w-3 h-3" />
                        Raise Ticket
                      </button>
                      <button
                        onClick={() => setShowDiagModal(true)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60 text-xs font-semibold rounded-lg hover:bg-slate-50 dark:hover:bg-white/10 transition"
                      >
                        <Play className="w-3 h-3" />
                        Re-run Diagnosis
                      </button>
                      <button
                        onClick={() => { localStorage.removeItem("lastDiagnosis"); setLastDiagCache(null); }}
                        className="text-[10px] font-mono text-slate-400 dark:text-white/25 hover:text-slate-600 dark:text-white/50 transition ml-auto"
                        title="Clear cached result"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="shrink-0 bg-rose-50 dark:bg-rose-500/8 border border-rose-200 dark:border-rose-500/15 rounded-xl p-4 text-center min-w-[130px]">
                    <p className="text-[10px] font-mono text-slate-500 dark:text-white/35 uppercase tracking-widest mb-1">Detected</p>
                    <p className="text-lg font-mono font-bold text-rose-600 dark:text-rose-400 tabular-nums leading-tight">{diagTime}</p>
                    <p className="text-[10px] text-slate-400 dark:text-white/25 mt-1">{elapsedLabel}</p>
                  </div>
                </div>

                {/* Diagnosis timeline */}
                <div className="mt-6 pt-5 border-t border-slate-100 dark:border-white/5">
                  <p className="text-[10px] font-mono font-bold text-slate-400 dark:text-white/30 uppercase tracking-widest mb-5">
                    Diagnosis Event Timeline
                  </p>
                  <div className="relative flex justify-between items-start">
                    <div className="absolute top-[14px] left-4 right-4 h-px bg-slate-200 dark:bg-white/8" />
                    {timeline.map((step, i) => (
                      <div key={i} className={`flex flex-col items-center gap-2 z-10 ${(step as any).muted ? "opacity-35" : ""}`}>
                        <div className={`h-7 w-7 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                          step.color === "emerald" ? "bg-emerald-500 border-emerald-500 text-white"
                          : step.color === "amber"  ? "bg-amber-500 border-amber-500 text-white"
                          : step.color === "rose"   ? `bg-rose-500 border-rose-500 text-white ${(step as any).pulse ? "shadow-[0_0_0_4px_rgba(244,63,94,0.2)]" : ""}`
                          : "bg-white dark:bg-[#0c0e16] border-slate-300 dark:border-white/15 text-slate-400 dark:text-white/30"
                        }`}>
                          {step.done ? "✓" : step.color === "rose" ? "!" : "·"}
                        </div>
                        <div className="text-center">
                          <span className="block text-[9px] font-mono text-slate-400 dark:text-white/30 whitespace-nowrap">{step.time}</span>
                          <span className={`block text-[11px] font-semibold mt-0.5 whitespace-nowrap ${
                            step.color === "rose"    ? "text-rose-600 dark:text-rose-400"
                            : step.color === "emerald" ? "text-emerald-700 dark:text-emerald-400"
                            : step.color === "amber"   ? "text-amber-700 dark:text-amber-400"
                            : "text-slate-400 dark:text-white/30"
                          }`}>{step.label}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })() : (
          /* No cache — prompt to run diagnosis */
          <div className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden">
            <div className="h-[3px] bg-gradient-to-r from-slate-300 via-slate-200 to-slate-300 dark:from-white/10 dark:via-white/5 dark:to-white/10" />
            <div className="p-5 flex items-center gap-5 flex-wrap">
              <div className="w-11 h-11 shrink-0 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/8 flex items-center justify-center">
                <Activity className="w-5 h-5 text-slate-400 dark:text-white/25" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-700 dark:text-white/60">No diagnosis data yet</p>
                <p className="text-xs text-slate-400 dark:text-white/30 mt-0.5 leading-relaxed">
                  Run a full system scan to detect component faults. Results will appear here and persist across sessions.
                </p>
              </div>
              <button
                onClick={() => setShowDiagModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#2D6CFA] hover:bg-[#255DE6] text-white text-xs font-semibold rounded-lg transition shadow-sm shadow-blue-200 dark:shadow-none shrink-0"
              >
                <Play className="w-3.5 h-3.5" />
                Initiate Diagnosis
              </button>
            </div>
          </div>
        )}

        {/* ── Main Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left: Digital Twin + Guided Isolation */}
          <div className="lg:col-span-2 space-y-5">

            {/* Digital Twin Card */}
            <div className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-white/5 gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Cpu className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-white/70">
                    {twinProduct ? `${twinProduct.product_name} — 3D Viewport` : "Digital Twin — 3D Viewport"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded-full border ${diagnosticRunning
                    ? "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400"
                    : "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/8 text-slate-500 dark:text-white/30"
                    }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${diagnosticRunning ? "bg-rose-500 animate-pulse" : "bg-slate-300 dark:bg-white/20"}`} />
                    {diagnosticRunning ? "Scan Active" : "Standby"}
                  </span>
                </div>
              </div>

              {/* 3D Viewer */}
              <div className="h-[300px] bg-slate-100 dark:bg-[#07090e]">
                {twinLoadingTree ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3">
                    <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                    <p className="text-[10px] font-mono text-white/30">Loading model…</p>
                  </div>
                ) : twinGlbUrl ? (
                  <GlbViewerDark src={twinGlbUrl} hotspots={[]} autoRotate={diagnosticRunning} />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-white/20">
                    <Box className="w-10 h-10 opacity-20" />
                    <p className="text-[10px] font-mono">
                      {productsList.length === 0
                        ? "No products found"
                        : "No 3D model available for this product"}
                    </p>
                  </div>
                )}
              </div>

              {/* Assembly summary strip */}
              {twinTree.length > 0 && (
                <div className="px-5 py-3 border-t border-slate-100 dark:border-white/5 flex items-center gap-5 overflow-x-auto">
                  <span className="text-[9px] font-mono text-slate-400 dark:text-white/25 uppercase tracking-widest shrink-0">
                    Assembly
                  </span>
                  {Object.entries(typeCounts).map(([type, count]) => (
                    <span key={type} className="shrink-0 flex items-center gap-1.5 text-[10px] font-mono text-slate-500 dark:text-white/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500/60" />
                      {count}× {type}
                    </span>
                  ))}
                  <span className="text-[10px] font-mono text-slate-400 dark:text-white/25 ml-auto shrink-0">
                    {twinTree.length} nodes total
                  </span>
                </div>
              )}
            </div>

            {/* Guided Isolation Procedure */}
            <div className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-white/70">Guided Isolation Procedure</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400 dark:text-white/25">
                  Step {Math.min(diagnosticStep, 3)} of 3
                </span>
              </div>

              <div className="p-5">
                {/* Step 1 — Completed */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-7 h-7 rounded-full bg-emerald-500 border-2 border-emerald-500 flex items-center justify-center text-white text-xs font-bold">✓</div>
                    <div className="w-px flex-1 bg-slate-200 dark:bg-white/8 my-1.5 min-h-[24px]" />
                  </div>
                  <div className="pb-5 opacity-55 flex-1">
                    <p className="text-xs font-semibold text-slate-700 dark:text-white uppercase tracking-wide">Step 1: Isolate Primary Valve</p>
                    <p className="text-[11px] text-slate-500 dark:text-white/40 mt-0.5">Commanded valve V-102 to CLOSED state via telemetry override.</p>
                  </div>
                </div>

                {/* Step 2 — Active */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 ${diagnosticStep >= 2
                      ? "bg-blue-600 border-blue-600 shadow-[0_0_14px_rgba(37,99,235,0.4)]"
                      : "bg-white dark:bg-[#0c0e16] border-slate-300 dark:border-white/15 text-slate-400 dark:text-white/30"
                      }`}>2</div>
                    <div className="w-px flex-1 bg-slate-200 dark:bg-white/8 my-1.5 min-h-[24px]" />
                  </div>
                  <div className={`pb-5 flex-1 ${diagnosticStep < 2 ? "opacity-40" : ""}`}>
                    {diagnosticStep >= 2 ? (
                      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-500/20 rounded-lg p-4">
                        <p className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wide">
                          Step 2: Inspect Seal Integrity on Flange B
                        </p>
                        <p className="text-[11px] text-blue-600/80 dark:text-blue-400/70 mt-1.5 leading-relaxed">
                          Visual inspection required. Look for hydraulic fluid pooling near the lower gasket.
                        </p>
                        <div className="flex gap-2 mt-3.5">
                          <button
                            onClick={() => setDiagnosticStep(3)}
                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold rounded-lg transition"
                          >
                            Confirm Seal Intact
                          </button>
                          <button
                            onClick={() => setDiagnosticStep(3)}
                            className="px-3.5 py-1.5 bg-white dark:bg-white/5 hover:bg-rose-50 dark:hover:bg-rose-900/20 border border-rose-300 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 text-[11px] font-semibold rounded-lg transition"
                          >
                            Seal Compromised
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs font-semibold text-slate-700 dark:text-white uppercase tracking-wide">Step 2: Inspect Seal Integrity on Flange B</p>
                        <p className="text-[11px] text-slate-500 dark:text-white/40 mt-0.5">Visual inspection required.</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Step 3 — Pending */}
                <div className="flex gap-4 opacity-40">
                  <div className="w-7 h-7 rounded-full bg-white dark:bg-white/5 border-2 border-slate-300 dark:border-white/15 flex items-center justify-center text-slate-400 dark:text-white/30 text-xs font-bold shrink-0">3</div>
                  <div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-white uppercase tracking-wide">Step 3: Pressure Test Secondary Loop</p>
                    <p className="text-[11px] text-slate-500 dark:text-white/40 mt-0.5">Dependent on previous step completion.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-5">

            {/* Telemetry Context */}
            <div className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-cyan-500" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-white/70">Telemetry Context</span>
                </div>
                <span className="text-[9px] font-mono text-slate-400 dark:text-white/25 bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">T-2m</span>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-rose-50 dark:bg-rose-500/8 border border-rose-100 dark:border-rose-500/15 rounded-lg p-3.5">
                    <p className="text-[9px] font-mono text-slate-500 dark:text-white/35 uppercase tracking-widest mb-1.5">Pressure Δ</p>
                    <p className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400 leading-none">{telemHistory[telemHistory.length - 1]?.pressure ?? "—"}</p>
                    <p className="text-[10px] text-rose-400 dark:text-rose-500/70 mt-0.5">psi</p>
                  </div>
                  <div className="bg-cyan-50 dark:bg-cyan-500/8 border border-cyan-100 dark:border-cyan-500/15 rounded-lg p-3.5">
                    <p className="text-[9px] font-mono text-slate-500 dark:text-white/35 uppercase tracking-widest mb-1.5">Flow Rate</p>
                    <p className="text-lg font-bold font-mono text-cyan-600 dark:text-cyan-400 leading-none">{telemHistory[telemHistory.length - 1]?.flow ?? "—"}</p>
                    <p className="text-[10px] text-cyan-400 dark:text-cyan-500/70 mt-0.5">L/min</p>
                  </div>
                </div>

                <div className="h-[88px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={telemHistory}>
                      <Line type="monotone" dataKey="flow" stroke="#06b6d4" strokeWidth={2} dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="pressure" stroke="#f43f5e" strokeWidth={2} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex items-center gap-4 pt-1 border-t border-slate-100 dark:border-white/5">
                  <span className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 dark:text-white/30">
                    <span className="w-4 h-0.5 bg-cyan-500 rounded-full inline-block" />Flow
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 dark:text-white/30">
                    <span className="w-4 h-0.5 bg-rose-500 rounded-full inline-block" />Pressure
                  </span>
                </div>
              </div>
            </div>

            {/* Sensor Health Status */}
            <div className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 dark:border-white/5">
                <Activity className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-xs font-semibold text-slate-700 dark:text-white/70">Sub-System Sensor Status</span>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-[11px] text-slate-500 dark:text-white/40 leading-relaxed">
                  Real-time readouts from internal system monitors:
                </p>

                <div className="space-y-3">
                  {[
                    { label: "Coolant Loop A", status: "Critical", desc: "Pressure drop detected", color: "rose" },
                    { label: "Main Compressor", status: "Warning", desc: "Vibration exceeds 4.2mm/s", color: "amber" },
                    { label: "Power Inverter", status: "Nominal", desc: "Stable voltage at 240V", color: "emerald" },
                    { label: "Thermal Exhaust", status: "Nominal", desc: "Clear flow, temp 42°C", color: "emerald" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-slate-800 dark:text-white">{item.label}</span>
                        <span className="text-[10px] text-slate-400 dark:text-white/40 mt-0.5">{item.desc}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider ${
                        item.color === "rose" ? "bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400"
                        : item.color === "amber" ? "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400"
                        : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DiagnosisModal
        open={showDiagModal}
        onClose={() => setShowDiagModal(false)}
        glbUrl={twinGlbUrl}
        components={twinTree}
        onRaiseTicket={(node) => {
          setFaultyNode(node);
          setTicketDrawerOpen(true);
        }}
      />

      <AddTicketDrawer
        isOpen={ticketDrawerOpen}
        onClose={() => { setTicketDrawerOpen(false); setFaultyNode(null); }}
        onCreated={() => { setTicketDrawerOpen(false); setFaultyNode(null); }}
        selectedPartNodes={faultyNode ? [faultyNode] : []}
      />
    </div>
  );
}
