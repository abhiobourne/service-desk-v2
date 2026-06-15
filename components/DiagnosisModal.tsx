"use client";

import { useState, useEffect } from "react";
import {
  X, AlertTriangle, CheckCircle2, Loader2, Activity,
  Cpu, Zap, Thermometer, Gauge, Shield, Layers, Ticket,
} from "lucide-react";
import { GlbViewerDark } from "@/components/GlbViewerDark";
import type { TroubleshootingDesignNode } from "@/lib/api";

const SCAN_MS = 520;

type ScanStatus = "pending" | "scanning" | "ok" | "fault";

function iconForType(type: string) {
  const t = type.toLowerCase();
  if (t.includes("thermal") || t.includes("cool")) return Thermometer;
  if (t.includes("electric") || t.includes("power")) return Zap;
  if (t.includes("sensor") || t.includes("gauge")) return Gauge;
  if (t.includes("assembly")) return Layers;
  if (t.includes("seal") || t.includes("valve") || t.includes("hydraul")) return Shield;
  return Cpu;
}

interface DiagnosisModalProps {
  open: boolean;
  onClose: () => void;
  glbUrl?: string | null;
  components: TroubleshootingDesignNode[];
  onRaiseTicket: (node: TroubleshootingDesignNode) => void;
}

export default function DiagnosisModal({
  open,
  onClose,
  glbUrl,
  components,
  onRaiseTicket,
}: DiagnosisModalProps) {
  const [phase, setPhase] = useState<"scanning" | "complete">("scanning");
  const [statuses, setStatuses] = useState<Record<string, ScanStatus>>({});
  const [faultyId, setFaultyId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    setPhase("scanning");
    setStatuses({});
    setFaultyId(null);
    setCurrentIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open || phase !== "scanning" || components.length === 0) return;

    if (currentIndex >= components.length) {
      const faulty = components[Math.floor(Math.random() * components.length)];
      setFaultyId(faulty.design_id);
      setStatuses(prev => ({ ...prev, [faulty.design_id]: "fault" }));
      setPhase("complete");
      // Persist to localStorage so the diagnostics page can show the last result
      try {
        localStorage.setItem("lastDiagnosis", JSON.stringify({
          design_id: faulty.design_id,
          design_name: faulty.design_name,
          design_type: faulty.design_type,
          design_uuid: faulty.design_uuid,
          design_version_id: faulty.design_version_id,
          timestamp: new Date().toISOString(),
        }));
      } catch { /* ignore */ }
      return;
    }

    const comp = components[currentIndex];
    setStatuses(prev => ({ ...prev, [comp.design_id]: "scanning" }));

    const t = setTimeout(() => {
      setStatuses(prev => ({ ...prev, [comp.design_id]: "ok" }));
      setCurrentIndex(i => i + 1);
    }, SCAN_MS);

    return () => clearTimeout(t);
  }, [currentIndex, phase, open, components]);

  if (!open) return null;

  const faultyComp = components.find(c => c.design_id === faultyId);
  const progress = Math.min(
    phase === "complete" ? 100 : Math.round((currentIndex / Math.max(components.length, 1)) * 100),
    100,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div
        className="relative w-full max-w-5xl bg-white dark:bg-[#07090e] border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* top accent */}
        <div className="h-[2px] bg-gradient-to-r from-blue-600 via-cyan-500 to-rose-500" />

        {/* ── header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/[0.06] bg-white dark:bg-[#090b10]">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors duration-700 ${
              phase === "complete"
                ? "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30"
                : "bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20"
            }`}>
              <Activity className={`w-4 h-4 ${phase === "complete" ? "text-rose-500 dark:text-rose-400" : "text-cyan-600 dark:text-cyan-400 animate-pulse"}`} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide">Full System Diagnosis</h2>
              <p className="text-[10px] font-mono text-slate-400 dark:text-white/30 mt-0.5">
                {phase === "scanning"
                  ? `Scanning · ${currentIndex} of ${components.length} components checked…`
                  : "Scan complete · 1 fault detected"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/80 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* progress bar */}
        <div className="h-[3px] bg-slate-100 dark:bg-white/5 relative overflow-hidden">
          <div
            className={`absolute left-0 top-0 h-full rounded-r transition-all duration-300 ${
              phase === "complete" ? "bg-rose-500" : "bg-cyan-500"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* ── body: flex-row so fullscreen exit can't collapse the right panel ── */}
        <div className="flex flex-row" style={{ height: "420px" }}>

          {/* left: 3-D viewer */}
          <div
            className="relative flex-1 min-w-0 border-r border-slate-100 dark:border-white/[0.06]"
          >
            {glbUrl ? (
              <GlbViewerDark src={glbUrl} hotspots={[]} autoRotate />
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-[#06070a]">
                <Loader2 className="w-8 h-8 animate-spin text-slate-300 dark:text-white/15" />
                <p className="text-[10px] font-mono text-slate-400 dark:text-white/20">No 3D model available</p>
              </div>
            )}

            {/* scan badge */}
            <div className="absolute bottom-4 left-4 pointer-events-none z-10">
              {phase === "scanning" ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 dark:bg-[#07090e]/85 border border-cyan-200 dark:border-cyan-500/25 text-[9px] font-mono tracking-widest text-cyan-600 dark:text-cyan-400 uppercase backdrop-blur shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-ping" />
                  Running diagnosis
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 dark:bg-[#07090e]/85 border border-rose-200 dark:border-rose-500/25 text-[9px] font-mono tracking-widest text-rose-600 dark:text-rose-400 uppercase backdrop-blur shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  Fault isolated
                </span>
              )}
            </div>
          </div>

          {/* right: scan list — fixed 340 px, never collapses */}
          <div
            className="flex flex-col gap-4 p-5 overflow-hidden bg-slate-50/50 dark:bg-transparent"
            style={{ width: "340px", minWidth: "340px" }}
          >
            <p className="text-[9px] font-mono text-slate-400 dark:text-white/25 uppercase tracking-widest shrink-0">
              Component Scan — {components.length} assemblies
            </p>

            <div className="space-y-1.5 overflow-y-auto flex-1 pr-0.5">
              {components.map((comp) => {
                const status: ScanStatus = statuses[comp.design_id] ?? "pending";
                const Icon = iconForType(comp.design_type);
                return (
                  <div
                    key={comp.design_id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all duration-300 ${
                      status === "fault"
                        ? "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/22"
                        : status === "ok"
                        ? "bg-emerald-50/60 dark:bg-emerald-500/[0.04] border-emerald-100 dark:border-emerald-500/12"
                        : status === "scanning"
                        ? "bg-cyan-50 dark:bg-cyan-500/[0.06] border-cyan-200 dark:border-cyan-500/20"
                        : "bg-white dark:bg-white/[0.01] border-slate-100 dark:border-white/[0.04]"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${
                      status === "fault"      ? "text-rose-500 dark:text-rose-400"
                      : status === "ok"      ? "text-emerald-500 dark:text-emerald-400"
                      : status === "scanning" ? "text-cyan-600 dark:text-cyan-400"
                      : "text-slate-300 dark:text-white/15"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold truncate ${
                        status === "fault"      ? "text-rose-700 dark:text-rose-300"
                        : status === "ok"      ? "text-slate-600 dark:text-white/65"
                        : status === "scanning" ? "text-slate-900 dark:text-white"
                        : "text-slate-300 dark:text-white/20"
                      }`}>
                        {comp.design_name}
                      </p>
                      <p className="text-[9px] text-slate-400 dark:text-white/22 mt-0.5 truncate">
                        {comp.design_type}
                      </p>
                    </div>
                    <div className="shrink-0 w-4 flex justify-center">
                      {status === "scanning" && <Loader2 className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400 animate-spin" />}
                      {status === "ok"       && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />}
                      {status === "fault"    && <AlertTriangle className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400 animate-pulse" />}
                      {status === "pending"  && <span className="w-3 h-3 rounded-full border border-slate-200 dark:border-white/10 block" />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* fault result card */}
            {phase === "complete" && faultyComp && (
              <div className="shrink-0 rounded-xl p-4 space-y-2 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">
                    Fault Detected
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{faultyComp.design_name}</p>
                <p className="text-[11px] text-slate-500 dark:text-white/40 leading-relaxed">
                  {faultyComp.design_type} anomaly detected. Raise a service ticket to begin repair.
                </p>
                <button
                  onClick={() => {
                    onRaiseTicket(faultyComp);
                    onClose();
                  }}
                  className="mt-1 w-full py-2 flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition shadow-sm"
                >
                  <Ticket className="w-3.5 h-3.5" />
                  Raise Ticket
                </button>
              </div>
            )}

            {/* scanning placeholder */}
            {phase === "scanning" && (
              <div className="shrink-0 rounded-xl flex items-center gap-3 p-4 bg-white dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.05]">
                <Loader2 className="w-4 h-4 text-cyan-500 dark:text-cyan-400 animate-spin shrink-0" />
                <p className="text-[11px] text-slate-500 dark:text-white/35">
                  Analyzing subsystems… {progress}% complete
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
