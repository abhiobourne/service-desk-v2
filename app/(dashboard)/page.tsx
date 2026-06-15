"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import {
  Cpu, ShieldAlert, Ticket, Wrench, AlertTriangle, LayoutDashboard,
  CheckCircle2, Clock, TrendingUp, Thermometer, Gauge,
  BarChart3, ChevronRight, ArrowRight, Activity, Zap,
  Circle,
} from "lucide-react";
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import {
  fetchMachines, fetchTickets, fetchProductCatalog,
  ApiMachine, ApiTicket, ApiProductCatalog,
} from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { useAbility } from "@/providers/AbilityProvider";
import { UpcomingAppointments } from "@/components/dashboard/UpcomingAppointments";

const API_BASE = process.env.NEXT_PUBLIC_API_SERVER || "http://localhost:7000";

// Sparkline history shape
const mkSparkline = (base: number, range: number, count = 12) =>
  Array.from({ length: count }, (_, i) => ({
    i,
    v: +(base + (Math.random() - 0.5) * range * 2).toFixed(2),
  }));

const mkTrendData = (base: number, range: number, count = 60) =>
  Array.from({ length: count }, (_, i) => ({
    time: i,
    v: +(base + (Math.random() - 0.5) * range * 2).toFixed(2),
  }));

function DashboardInner() {
  const router = useRouter();
  const { user } = useAuth();
  const { isClient, can } = useAbility();

  const [rawMachines, setRawMachines] = useState<ApiMachine[]>([]);
  const [rawTickets, setRawTickets]   = useState<ApiTicket[]>([]);
  const [products, setProducts]       = useState<ApiProductCatalog[]>([]);
  const [loading, setLoading]         = useState(true);

  const [liveTelem, setLiveTelem] = useState({
    nitrogen: 98.2, coreTemp: 4.2, pressure: 42.5, sysLoad: 74,
  });

  const [sparklines, setSparklines] = useState({
    nitrogen: mkSparkline(98.2, 0.4),
    coreTemp: mkSparkline(4.2,  0.15),
    pressure: mkSparkline(42.5, 1.0),
    sysLoad:  mkSparkline(74,   5),
  });

  const [nitrogenTrend, setNitrogenTrend] = useState(() => mkTrendData(98.2, 0.4));

  // 30-day service health data (mock — day 0 = oldest, day 29 = today)
  const [health30d] = useState(() => {
    const today = new Date();
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (29 - i));
      const base = 98 + Math.random() * 1.5;
      const hasAlert = Math.random() < 0.15;
      return {
        day: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        uptime: +Math.max(94.5, Math.min(100, base - (hasAlert ? 2.5 : 0))).toFixed(2),
        alerts: hasAlert ? Math.floor(Math.random() * 3) + 1 : 0,
      };
    });
  });

  useEffect(() => {
    Promise.all([fetchMachines(), fetchTickets(), fetchProductCatalog()])
      .then(([m, t, p]) => {
        setRawMachines(m);
        setRawTickets(t);
        setProducts(p);
      })
      .finally(() => setLoading(false));
  }, [user]);

  // Live telemetry simulation — update values AND stream sparklines
  useEffect(() => {
    const id = setInterval(() => {
      setLiveTelem(prev => {
        const next = {
          nitrogen: +Math.max(97.4, Math.min(99.2, prev.nitrogen + (Math.random() - 0.5) * 0.3)).toFixed(1),
          coreTemp: +Math.max(4.05, Math.min(4.48, prev.coreTemp + (Math.random() - 0.5) * 0.06)).toFixed(2),
          pressure: +Math.max(40.8, Math.min(44.8, prev.pressure + (Math.random() - 0.5) * 0.5)).toFixed(1),
          sysLoad:  +Math.max(64,   Math.min(88,   prev.sysLoad  + (Math.random() - 0.5) * 4)).toFixed(0),
        };
        setSparklines(sp => {
          const slide = <T extends { i: number; v: number }>(arr: T[], val: number): T[] => {
            const next = [...arr.slice(1), { i: arr[arr.length - 1].i + 1, v: val } as T];
            return next;
          };
          return {
            nitrogen: slide(sp.nitrogen, next.nitrogen),
            coreTemp: slide(sp.coreTemp, next.coreTemp),
            pressure: slide(sp.pressure, next.pressure),
            sysLoad:  slide(sp.sysLoad,  next.sysLoad),
          };
        });
        setNitrogenTrend(prev => {
          return [...prev.slice(1), { time: prev[prev.length - 1].time + 1, v: next.nitrogen }];
        });
        return next;
      });
    }, 1400);
    return () => clearInterval(id);
  }, []);

  // RBAC filtering — preserve existing multi-tenant isolation
  const machines: ApiMachine[] = rawMachines.filter(m => {
    if (isClient) {
      const clientIds = user?.clientIds || [];
      if (clientIds.length === 0) return true;
      return clientIds.includes(m.id) || clientIds.includes(m.machine_id);
    }
    return true;
  });

  const tickets: ApiTicket[] = rawTickets.filter(t => {
    if (isClient) return t.assigned_to === user?.id || !t.assigned_to;
    return true;
  });

  const machine = machines[0] ?? null;
  const product = products[0] ?? null;

  const openTickets      = tickets.filter(t => t.status === "OPEN").length;
  const inProgressTickets = tickets.filter(t => t.status === "IN_PROGRESS").length;
  const criticalTickets  = tickets.filter(t => t.priority === "CRITICAL" && t.status !== "CLOSED" && t.status !== "RESOLVED").length;
  const recentTickets    = [...tickets].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ).slice(0, 5);

  const machineOnline  = machine?.status?.toLowerCase() !== "offline";
  const machineStatus  = machine?.status ?? "NOMINAL";

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#07090e]">

      {/* ── Page Header ── */}
      <div className="bg-white dark:bg-[#090b10] border-b border-slate-200 dark:border-white/5 px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center shrink-0">
              <LayoutDashboard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white">Dashboard</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/diagnostics")}
              className="px-3.5 py-2 bg-[#2D6CFA] hover:bg-[#255DE6] text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 shadow-[0_0_16px_rgba(45,108,250,0.2)]"
            >
              <Activity className="h-3.5 w-3.5 text-white" />
              <span className="text-white">Open Diagnostics</span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">

        {/* ── Machine Hero Card ── */}
        <div className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden">
          <div className="h-[3px] bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-400" />
          <div className="p-5">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-2">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    machineOnline
                      ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                      : "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/40"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${machineOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                    {machineOnline ? "Online" : "Offline"}
                  </span>
                  {criticalTickets > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-full text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                      <AlertTriangle className="w-3 h-3" />
                      {criticalTickets} Critical
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                  {loading ? "Loading…" : machine?.name ?? "Primary System Unit"}
                </h2>
                <p className="text-sm text-slate-500 dark:text-white/40 mt-1">
                  {product?.product_name ?? "Medical Imaging System"}
                </p>
              </div>

              {/* Quick stat chips */}
              <div className="flex items-center gap-3 shrink-0 flex-wrap">
                <button
                  onClick={() => router.push("/tickets")}
                  className="text-center px-4 py-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-500/15 transition"
                >
                  <p className="text-2xl font-bold font-mono text-blue-700 dark:text-blue-400 tabular-nums">{loading ? "—" : openTickets}</p>
                  <p className="text-[9px] font-mono text-blue-600/70 dark:text-blue-400/60 uppercase tracking-widest mt-0.5">Open Tickets</p>
                </button>
                <button
                  onClick={() => router.push("/tickets")}
                  className="text-center px-4 py-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-500/15 transition"
                >
                  <p className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400 tabular-nums">{loading ? "—" : inProgressTickets}</p>
                  <p className="text-[9px] font-mono text-amber-600/70 dark:text-amber-400/60 uppercase tracking-widest mt-0.5">In Progress</p>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Live Telemetry KPIs ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-white/30 uppercase tracking-widest">
              Live Telemetry
            </span>
            <span className="flex items-center gap-1.5 text-[9px] font-mono text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Streaming
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                label: "N₂ Purity", value: `${liveTelem.nitrogen}%`,
                unit: "Target ≥97.5%", icon: <BarChart3 className="w-4 h-4" />,
                ok: liveTelem.nitrogen >= 97.5, spark: sparklines.nitrogen, color: "emerald",
              },
              {
                label: "Core Temp", value: `${liveTelem.coreTemp}K`,
                unit: "Target 4.0–4.5K", icon: <Thermometer className="w-4 h-4" />,
                ok: liveTelem.coreTemp >= 4.0 && liveTelem.coreTemp <= 4.5, spark: sparklines.coreTemp, color: "blue",
              },
              {
                label: "He Pressure", value: `${liveTelem.pressure} psi`,
                unit: "Target 41–45 psi", icon: <Gauge className="w-4 h-4" />,
                ok: liveTelem.pressure >= 41 && liveTelem.pressure <= 45, spark: sparklines.pressure, color: "cyan",
              },
              {
                label: "Sys Load", value: `${liveTelem.sysLoad}%`,
                unit: "Warn >85%", icon: <Cpu className="w-4 h-4" />,
                ok: liveTelem.sysLoad <= 85, spark: sparklines.sysLoad, color: liveTelem.sysLoad > 85 ? "amber" : "slate",
              },
            ].map(kpi => (
              <div
                key={kpi.label}
                className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl p-4 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${
                    kpi.ok
                      ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  }`}>
                    {kpi.icon}
                  </div>
                  <span className={`w-2 h-2 rounded-full ${kpi.ok ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`} />
                </div>
                <div>
                  <p className="text-[9px] font-mono text-slate-400 dark:text-white/30 uppercase tracking-widest">{kpi.label}</p>
                  <p className="text-xl font-bold font-mono text-slate-900 dark:text-white leading-none mt-0.5 tabular-nums">
                    {kpi.value}
                  </p>
                  <p className="text-[9px] text-slate-400 dark:text-white/25 mt-0.5">{kpi.unit}</p>
                </div>
                <div className="h-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={kpi.spark} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id={`grad-${kpi.label.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={kpi.ok ? "#10b981" : "#ef4444"} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={kpi.ok ? "#10b981" : "#ef4444"} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone" dataKey="v"
                        stroke={kpi.ok ? "#10b981" : "#ef4444"}
                        fill={`url(#grad-${kpi.label.replace(/\s+/g, '-')})`}
                        strokeWidth={1.5} dot={false} isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* ── Continuous Nitrogen Trend ── */}
          <div className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden p-5 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[10px] font-mono font-bold text-slate-400 dark:text-white/30 tracking-widest uppercase mb-1">
                  Trend · 10M
                </p>
                <h3 className="text-xs font-mono font-bold text-slate-500 dark:text-white/40 uppercase tracking-widest">
                  Nitrogen Purity Reading
                </h3>
              </div>
              <div className="text-right">
                <span className="text-2xl font-mono font-bold text-slate-900 dark:text-white">
                  {liveTelem.nitrogen.toFixed(2)} %
                </span>
              </div>
            </div>
            
            <div className="flex-1 min-h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={nitrogenTrend} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="grad-nitrogen-trend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="time" 
                    tickFormatter={(val, i) => {
                      if (i === 0) return "-10m";
                      if (i === Math.floor(nitrogenTrend.length / 2)) return "-5m";
                      if (i === nitrogenTrend.length - 1) return "NOW";
                      return "";
                    }}
                    tick={{ fontSize: 10, fill: "currentColor", fontFamily: "monospace" }}
                    className="text-slate-400 dark:text-white/30"
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    domain={['dataMin - 0.5', 'dataMax + 0.5']}
                    tick={{ fontSize: 10, fill: "currentColor", fontFamily: "monospace" }}
                    className="text-slate-400 dark:text-white/30"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => v.toFixed(0)}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      background: "var(--tooltip-bg, #1e293b)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "8px",
                      fontSize: "11px",
                      fontFamily: "monospace",
                    }}
                    itemStyle={{ color: '#ef4444' }}
                    labelStyle={{ color: "rgba(255,255,255,0.4)", fontSize: "10px" }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="v" 
                    stroke="#ef4444" 
                    fill="url(#grad-nitrogen-trend)" 
                    strokeWidth={2} 
                    isAnimationActive={false}
                    dot={(props: any) => {
                      const { cx, cy, index } = props;
                      if (index === nitrogenTrend.length - 1) {
                        return <circle key={index} cx={cx} cy={cy} r={4} fill="#ef4444" />;
                      }
                      return null;
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Service Health Chart (30-day) ── */}
          <div className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-violet-500" />
                <span className="text-xs font-semibold text-slate-700 dark:text-white/70">Service Health</span>
                <span className="text-[9px] font-mono text-slate-400 dark:text-white/25 bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">30 days</span>
              </div>
              <div className="flex items-center gap-3 text-[9px] font-mono">
                <span className="flex items-center gap-1 text-violet-600 dark:text-violet-400">
                  <span className="w-2 h-0.5 bg-violet-500 inline-block rounded" />Uptime %
                </span>
                <span className="flex items-center gap-1 text-slate-400 dark:text-white/30">
                  <span className="w-2 h-0.5 bg-rose-500 inline-block rounded border-dashed" />SLA 97.5%
                </span>
              </div>
            </div>
            <div className="px-4 py-4 flex-1 min-h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={health30d} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 9, fontFamily: "monospace", fill: "currentColor" }}
                    className="text-slate-400 dark:text-white/20"
                    interval={6}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[94, 100]}
                    tick={{ fontSize: 9, fontFamily: "monospace", fill: "currentColor" }}
                    className="text-slate-400 dark:text-white/20"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={v => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--tooltip-bg, #1e293b)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "8px",
                      fontSize: "11px",
                      fontFamily: "monospace",
                    }}
                    itemStyle={{ color: "#a78bfa" }}
                    labelStyle={{ color: "rgba(255,255,255,0.4)", fontSize: "10px" }}
                    formatter={(v) => [`${v}%`, "Uptime"]}
                  />
                  <ReferenceLine
                    y={97.5}
                    stroke="#f43f5e"
                    strokeDasharray="4 3"
                    strokeWidth={1}
                    strokeOpacity={0.6}
                  />
                  <defs>
                    <linearGradient id="grad-health" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Line
                    type="monotone"
                    dataKey="uptime"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3, fill: "#8b5cf6" }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Main Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left: Recent Tickets */}
          <div className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-2">
                <Ticket className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-xs font-semibold text-slate-700 dark:text-white/70">Recent Tickets</span>
              </div>
              <button
                onClick={() => router.push("/tickets")}
                className="text-[10px] font-mono text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition"
              >
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {loading ? (
              <div className="p-8 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : recentTickets.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-60" />
                <p className="text-xs font-mono text-slate-400 dark:text-white/30">No active tickets</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {recentTickets.map(t => {
                  const isOpen       = t.status === "OPEN";
                  const isInProgress = t.status === "IN_PROGRESS";
                  const isCritical   = t.priority === "CRITICAL";
                  return (
                    <div
                      key={t.id}
                      onClick={() => router.push(`/tickets/${t.id}`)}
                      className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] cursor-pointer transition"
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        isCritical ? "bg-rose-500 animate-pulse"
                        : isOpen   ? "bg-blue-500"
                        : isInProgress ? "bg-amber-500"
                        : "bg-emerald-500"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">{t.title}</p>
                        <p className="text-[10px] text-slate-400 dark:text-white/30 mt-0.5 truncate">
                          {t.ticket_id ?? t.id} · {new Date(t.created_at).toLocaleDateString("en-GB")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isCritical && (
                          <span className="px-1.5 py-0.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded text-[9px] font-bold text-rose-600 dark:text-rose-400 uppercase">
                            Critical
                          </span>
                        )}
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono border uppercase ${
                          isOpen ? "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400"
                          : isInProgress ? "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400"
                          : "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                        }`}>
                          {t.status.replace("_", " ")}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-white/20" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Centre: Upcoming Maintenance */}
          <UpcomingAppointments />

          {/* Right: Quick Navigation + System Health */}
          <div className="space-y-5">

            {/* Quick Actions */}
            <div className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 dark:border-white/5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-semibold text-slate-700 dark:text-white/70">Quick Access</span>
              </div>
              <div className="p-4 space-y-2">
                {[
                  { label: "Diagnostic Center", sub: "Fault analysis & 3D twin", icon: <ShieldAlert className="w-4 h-4" />, href: "/diagnostics", color: "rose" },
                  { label: "Support Tickets",   sub: `${openTickets} open · ${inProgressTickets} in progress`, icon: <Ticket className="w-4 h-4" />, href: "/tickets", color: "blue" },
                  { label: "Maintenance",        sub: "Schedule & task tracking", icon: <Wrench className="w-4 h-4" />, href: "/maintenance", color: "violet" },
                ].map(item => (
                  <button
                    key={item.href}
                    onClick={() => router.push(item.href)}
                    className="w-full flex items-center gap-3 px-3.5 py-3 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.03] border border-transparent hover:border-slate-200 dark:hover:border-white/8 transition text-left"
                  >
                    <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${
                      item.color === "rose"   ? "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400"
                      : item.color === "blue"  ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      : "bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400"
                    }`}>
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-white">{item.label}</p>
                      <p className="text-[10px] text-slate-400 dark:text-white/35 truncate">{item.sub}</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-white/20 shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            {/* System Health */}
            <div className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 dark:border-white/5">
                <Activity className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-xs font-semibold text-slate-700 dark:text-white/70">System Health</span>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { label: "Cryogenic System",    ok: liveTelem.nitrogen >= 97.5,   detail: `N₂ ${liveTelem.nitrogen}%` },
                  { label: "Superconducting Core", ok: liveTelem.coreTemp <= 4.5,   detail: `${liveTelem.coreTemp}K` },
                  { label: "Helium Circuit",       ok: liveTelem.pressure <= 44.8,  detail: `${liveTelem.pressure} psi` },
                  { label: "Control Systems",      ok: liveTelem.sysLoad <= 85,     detail: `${liveTelem.sysLoad}% load` },
                  { label: "Network Uplink",       ok: true,                        detail: "Connected" },
                ].map((sys, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {sys.ok
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        : <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 animate-pulse" />}
                      <span className="text-[11px] font-medium text-slate-700 dark:text-white/70 truncate">{sys.label}</span>
                    </div>
                    <span className={`text-[10px] font-mono shrink-0 ${sys.ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                      {sys.detail}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── All Machines Strip (admin/staff only) ── */}
        {!isClient && machines.length > 1 && (
          <div className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-slate-500 dark:text-white/40" />
                <span className="text-xs font-semibold text-slate-700 dark:text-white/70">All Machines ({machines.length})</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/5">
                    <th className="text-left px-5 py-2.5 text-[10px] font-mono text-slate-400 dark:text-white/30 uppercase tracking-widest">Machine</th>
                    <th className="text-left px-5 py-2.5 text-[10px] font-mono text-slate-400 dark:text-white/30 uppercase tracking-widest">Serial</th>
                    <th className="text-left px-5 py-2.5 text-[10px] font-mono text-slate-400 dark:text-white/30 uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-white/[0.03]">
                  {machines.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition">
                      <td className="px-5 py-3 font-semibold text-slate-800 dark:text-white">{m.name}</td>
                      <td className="px-5 py-3 font-mono text-slate-500 dark:text-white/40 text-[11px]">{m.machine_id ?? "—"}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                          m.status?.toLowerCase() === "offline"
                            ? "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/40"
                            : "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${m.status?.toLowerCase() === "offline" ? "bg-slate-400" : "bg-emerald-500"}`} />
                          {m.status ?? "Online"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-[#07090e]">
        <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    }>
      <DashboardInner />
    </Suspense>
  );
}
