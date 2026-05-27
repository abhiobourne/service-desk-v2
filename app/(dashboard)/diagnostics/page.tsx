"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import Cyber3DViewer from "@/components/Cyber3DViewer";
import { fetchMachines, fetchTickets, createTicket, ApiMachine, ApiTicket } from "@/lib/api";

const TELEMETRY_DELTA_DATA = [
  { name: "T-60s", pressure: -38,   flow: 110   },
  { name: "T-45s", pressure: -40,   flow: 111   },
  { name: "T-30s", pressure: -43,   flow: 113   },
  { name: "T-15s", pressure: -42.5, flow: 112.4 },
  { name: "T-0s",  pressure: -42.5, flow: 112.4 },
];

export default function DiagnosticsPage() {
  const router = useRouter();

  const [rawMachines, setRawMachines] = useState<ApiMachine[]>([]);
  const [rawTickets, setRawTickets] = useState<ApiTicket[]>([]);
  const [diagnosticRunning, setDiagnosticRunning] = useState(false);
  const [diagnosticStep, setDiagnosticStep] = useState<number>(2);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchMachines(), fetchTickets()]).then(([m, t]) => {
      setRawMachines(m);
      setRawTickets(t);
    }).finally(() => setLoading(false));
  }, []);

  const handleCreateTicket = async () => {
    const title = rawTickets.find(t => t.status === "OPEN")?.title || "System Fault ERR-9402-B";
    const desc  = rawTickets.find(t => t.status === "OPEN")?.description || "Fault detected on primary system unit. Inspection required.";
    await createTicket(title, desc, "CRITICAL");
    router.push("/tickets");
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-slate-50 dark:bg-[#07090e] space-y-8">

      {/* Fault header */}
      <div className="border border-rose-500/20 bg-rose-950/10 p-6 rounded-lg">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-rose-500/20 text-rose-500 border border-rose-500/30 text-[9px] font-mono rounded font-bold uppercase tracking-widest">Critical Fault</span>
              <span className="text-xs font-mono text-slate-600 dark:text-white/50">ERR-9402-B</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight font-mono text-slate-900 dark:text-white mt-1">
              {loading ? "Loading…" : rawTickets.find(t => t.status === "OPEN" || t.status === "IN_PROGRESS")?.title || (rawMachines[0]?.name ? `${rawMachines[0].name} — Active Fault` : "System Fault Detected")}
            </h2>
            <p className="text-xs text-slate-600 dark:text-white/60 font-mono mt-2 max-w-3xl">
              {rawTickets.find(t => t.status === "OPEN" || t.status === "IN_PROGRESS")?.description || "Main actuator assembly delta-P dropped below minimum threshold during high-torque operation phase. Immediate inspection required."}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleCreateTicket}
              className="px-3.5 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/5 hover:border-slate-200 dark:border-white/20 text-slate-900 dark:text-white text-xs font-mono uppercase rounded transition font-bold"
            >
              Create Ticket
            </button>
            <button
              onClick={() => setDiagnosticRunning(v => !v)}
              className={`px-3.5 py-2 text-xs font-mono uppercase rounded font-bold transition flex items-center gap-1.5 ${diagnosticRunning ? "bg-rose-500 text-slate-900 dark:text-white shadow-[0_0_15px_#ef444433]" : "bg-blue-600 text-slate-900 dark:text-white hover:bg-blue-700 shadow-[0_0_12px_#2563eb22]"}`}
            >
              {diagnosticRunning ? <><Pause className="h-3.5 w-3.5" /><span>Halt Sequence</span></> : <><Play className="h-3.5 w-3.5 animate-pulse" /><span>Initiate Diagnostics</span></>}
            </button>
          </div>
        </div>

        {/* Fault Progression Map */}
        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-white/5">
          <h3 className="text-[10px] font-mono text-slate-600 dark:text-white/30 uppercase tracking-widest mb-4">Fault Progression Map</h3>
          <div className="flex flex-col sm:flex-row justify-between gap-6 sm:gap-2">
            {[
              { time: "14:02:00", label: "Normal Operation", color: "emerald", done: true },
              { time: "14:15:22", label: "Temp Anomaly",     color: "emerald", done: true },
              { time: "14:18:45", label: "Vibration Spike",  color: "amber",   done: true },
              { time: "14:22:10", label: "Pressure Failure", color: "rose",    done: false, pulse: true },
              { time: "Pending",  label: "System Halt",      color: "white",   done: false, muted: true },
            ].map((step, i) => (
              <div key={i} className={`flex items-center gap-3 ${step.muted ? "opacity-40" : ""}`}>
                <div className={`h-6 w-6 rounded-full flex items-center justify-center font-mono text-[10px] font-bold ${
                  step.color === "emerald" ? "bg-emerald-500/20 border border-emerald-500 text-emerald-400"
                  : step.color === "amber"  ? "bg-amber-500/20 border border-amber-500 text-amber-400"
                  : step.color === "rose"   ? `bg-rose-500/20 border border-rose-500 text-rose-500 ${step.pulse ? "animate-pulse" : ""}`
                  : "bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/40"
                }`}>
                  {step.done ? "✓" : step.color === "rose" ? "!" : "•"}
                </div>
                <div>
                  <span className="block text-[8px] font-mono text-slate-600 dark:text-white/40">{step.time}</span>
                  <span className={`block text-xs font-mono ${step.color === "rose" ? "text-rose-400 font-bold" : "text-slate-600 dark:text-white/70"}`}>{step.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: viewport + steps */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 p-6 rounded-lg">
            <span className="text-[10px] font-mono text-slate-500 dark:text-white/40 uppercase tracking-widest block mb-4">Product Design Viewport</span>
            <div className="h-[250px]">
              <Cyber3DViewer mode="mri" diagnosticActive={diagnosticRunning} />
            </div>
          </div>

          <div className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 p-6 rounded-lg space-y-5">
            <span className="text-xs font-mono text-slate-500 dark:text-white/40 uppercase tracking-widest block border-b border-slate-200 dark:border-white/5 pb-2">Guided Isolation Procedure</span>
            <div className="space-y-4">
              <div className="flex items-start gap-4 opacity-50">
                <div className="h-5 w-5 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center text-[10px] text-emerald-400 font-bold shrink-0 mt-0.5">✓</div>
                <div>
                  <span className="block text-xs font-mono font-bold text-slate-900 dark:text-white uppercase">Step 1: Isolate Primary Valve</span>
                  <span className="block text-[10px] font-mono text-slate-600 dark:text-white/50">Commanded valve V-102 to CLOSED state via telemetry override.</span>
                </div>
              </div>

              <div className={`flex items-start gap-4 p-4 rounded ${diagnosticStep >= 2 ? "bg-blue-50 border border-blue-200 dark:bg-blue-950/20 dark:border-blue-500/30" : "opacity-40"}`}>
                <div className="h-5 w-5 rounded-full bg-blue-600 flex items-center justify-center text-[10px] text-slate-900 dark:text-white font-bold shrink-0 mt-0.5 shadow-[0_0_10px_#2563eb]">2</div>
                <div className="flex-1 space-y-3">
                  <div>
                    <span className="block text-xs font-mono font-bold text-slate-900 dark:text-white uppercase">Step 2: Inspect Seal Integrity on Flange B</span>
                    <span className="block text-[10px] font-mono text-slate-600 dark:text-white/70">Visual inspection required. Look for hydraulic fluid pooling near the lower gasket.</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setDiagnosticStep(3); alert("Action logged: Seal confirmed intact."); }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-slate-900 dark:text-white text-[10px] font-mono font-semibold rounded transition uppercase">
                      Confirm Seal Intact
                    </button>
                    <button onClick={() => { setDiagnosticStep(3); alert("Action logged: Seal compromised. Dispatching technicians."); }}
                      className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900 border border-rose-500/30 hover:border-rose-500 text-rose-400 text-[10px] font-mono rounded transition uppercase">
                      Seal Compromised
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4 opacity-40">
                <div className="h-5 w-5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-[10px] text-slate-600 dark:text-white/40 shrink-0 mt-0.5">3</div>
                <div>
                  <span className="block text-xs font-mono font-bold text-slate-900 dark:text-white uppercase">Step 3: Pressure Test Secondary Loop</span>
                  <span className="block text-[10px] font-mono text-slate-600 dark:text-white/50">Dependent on previous step completion.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: telemetry + pattern analysis */}
        <div className="space-y-6">
          <div className="bg-slate-50 dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 p-6 rounded-lg space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-white/5 pb-2">
              <span className="text-[10px] font-mono text-slate-600 dark:text-white/40 uppercase tracking-widest">Telemetry Context</span>
              <span className="text-[8px] font-mono text-slate-600 dark:text-white/30 uppercase">T- 2m window</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[8px] font-mono text-slate-600 dark:text-white/30 uppercase block">Pressure Delta</span>
                <span className="text-sm font-bold font-mono text-rose-400">-42.5 psi</span>
              </div>
              <div>
                <span className="text-[8px] font-mono text-slate-600 dark:text-white/30 uppercase block">Flow Rate</span>
                <span className="text-sm font-bold font-mono text-cyan-400">112.4 L/m</span>
              </div>
            </div>
            <div className="h-[80px]">
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={TELEMETRY_DELTA_DATA}>
                  <Line type="monotone" dataKey="flow"     stroke="#06b6d4" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="pressure" stroke="#f43f5e" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 p-6 rounded-lg space-y-4">
            <span className="text-[10px] font-mono text-slate-600 dark:text-white/40 uppercase tracking-widest block border-b border-slate-200 dark:border-white/5 pb-2">Pattern Analysis</span>
            <p className="text-[10px] font-mono text-slate-600 dark:text-white/50">Based on 4,203 similar historical incidents across the fleet, AI suggests the following probable causes:</p>
            <div className="space-y-2 pt-2">
              {[
                { label: "Actuator Piston Seal Failure", sub: "Vibration signature matches seal blow-out.", match: "87% Match", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
                { label: "Relief Valve Stuck Open",       sub: "Could explain pressure drops in loop.",   match: "12% Match", cls: "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/50 border-slate-200 dark:border-white/10" },
                { label: "Supply Line Rupture",           sub: "Unlikely given upstream telemetry.",      match: "< 1% Match", cls: "" },
              ].map((item, i) => (
                <div key={i} className={`p-2.5 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 flex items-center justify-between ${i === 2 ? "opacity-60" : ""}`}>
                  <div>
                    <span className="block text-xs font-mono font-bold text-slate-900 dark:text-white">{item.label}</span>
                    <span className="block text-[9px] font-mono text-slate-600 dark:text-white/40">{item.sub}</span>
                  </div>
                  {item.cls
                    ? <span className={`px-1.5 py-0.5 rounded border font-bold text-[9px] ${item.cls}`}>{item.match}</span>
                    : <span className="text-slate-600 dark:text-white/40 text-[9px]">{item.match}</span>}
                </div>
              ))}
            </div>
            <button
              onClick={() => alert("Searching operational FAQ archives for Actuator Piston Seals...")}
              className="w-full py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/5 text-slate-900 dark:text-white text-[10px] font-mono uppercase tracking-widest rounded transition"
            >
              Query Full Knowledge Base
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
