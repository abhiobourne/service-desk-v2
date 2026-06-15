"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import toast, { Toaster } from "react-hot-toast";
import {
  ChevronRight, ChevronLeft, ChevronDown, Check, Plus, X, Calendar, Wrench,
  AlertTriangle, CheckCircle2, Clock, RefreshCw, Zap,
  User, Tag, Timer, Layers, FileText, Cpu,
} from "lucide-react";
import {
  useMaintenanceStorage,
  MaintenanceEvent,
  MaintType,
  MaintPriority,
  MaintStatus,
} from "@/hooks/useMaintenanceStorage";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { DesignTreeSelect } from "@/components/ui/DesignTreeSelect";
import {
  fetchProductCatalog, fetchTroubleshootingByProduct,
  ApiProductCatalog, TroubleshootingDesignNode,
} from "@/lib/api";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const TECHNICIANS = ["D. Sharma", "A. Mehta", "R. Patel", "S. Kumar"];

const CATEGORIES = [
  "Cryogenic System", "RF System", "Gradient System", "Superconducting Magnet",
  "Patient Table", "Control Console", "Cooling Circuit", "Power Supply",
  "Radiology", "Cardiology Equipment", "ICU Equipment", "Emergency Equipment",
  "Fluid Management", "Safety Systems", "Other",
];

const MAINT_TYPES: MaintType[] = [
  "Preventive", "Inspection", "Emergency", "Calibration", "Replacement", "Diagnostic",
];

// ─── Style maps ───────────────────────────────────────────────────────────────

const STATUS_PILL: Record<MaintStatus, { bg: string; text: string; dot: string; icon: React.ReactNode; label: string }> = {
  upcoming:     { bg: "bg-cyan-50 dark:bg-cyan-500/15 border border-cyan-200 dark:border-cyan-500/30",     text: "text-cyan-700 dark:text-cyan-300",    dot: "bg-cyan-500",    icon: <Clock className="w-3 h-3" />,                  label: "Upcoming" },
  "in-progress":{ bg: "bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30", text: "text-amber-700 dark:text-amber-300",  dot: "bg-amber-500",   icon: <RefreshCw className="w-3 h-3 animate-spin" />, label: "In Progress" },
  completed:    { bg: "bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500", icon: <CheckCircle2 className="w-3 h-3" />, label: "Completed" },
  overdue:      { bg: "bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30",     text: "text-rose-700 dark:text-rose-400",    dot: "bg-rose-500",    icon: <AlertTriangle className="w-3 h-3" />,          label: "Overdue" },
};

const TYPE_DOT: Record<MaintType, string> = {
  Preventive:  "bg-blue-500",
  Inspection:  "bg-blue-400",
  Emergency:   "bg-rose-500",
  Calibration: "bg-cyan-500",
  Replacement: "bg-amber-500",
  Diagnostic:  "bg-indigo-500",
};

const PRIORITY_STYLE: Record<MaintPriority, { text: string; bg: string; border: string }> = {
  LOW:      { text: "text-slate-500 dark:text-white/40",     bg: "bg-slate-50 dark:bg-white/5",        border: "border-slate-200 dark:border-white/10" },
  MEDIUM:   { text: "text-blue-600 dark:text-blue-400",      bg: "bg-blue-50 dark:bg-blue-500/10",     border: "border-blue-200 dark:border-blue-500/20" },
  HIGH:     { text: "text-amber-700 dark:text-amber-400",    bg: "bg-amber-50 dark:bg-amber-500/10",   border: "border-amber-200 dark:border-amber-500/20" },
  CRITICAL: { text: "text-rose-700 dark:text-rose-400",      bg: "bg-rose-50 dark:bg-rose-500/10",     border: "border-rose-200 dark:border-rose-500/20" },
};

// ─── Calendar helpers ─────────────────────────────────────────────────────────

interface CalDay {
  dateStr: string;   // "YYYY-MM-DD"
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildGrid(year: number, month: number): CalDay[] {
  const today = todayStr();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const make = (y: number, m: number, d: number, cur: boolean): CalDay => {
    const s = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return { dateStr: s, day: d, isCurrentMonth: cur, isToday: s === today, isPast: s < today };
  };

  const cells: CalDay[] = [];

  const prevM = month === 0 ? 11 : month - 1;
  const prevY = month === 0 ? year - 1 : year;
  for (let i = firstDow - 1; i >= 0; i--) cells.push(make(prevY, prevM, daysInPrev - i, false));

  for (let d = 1; d <= daysInMonth; d++) cells.push(make(year, month, d, true));

  const nextM = month === 11 ? 0 : month + 1;
  const nextY = month === 11 ? year + 1 : year;
  let nd = 1;
  while (cells.length < 42) cells.push(make(nextY, nextM, nd++, false));

  return cells;
}

function eventsByDate(events: MaintenanceEvent[]): Record<string, MaintenanceEvent[]> {
  return events.reduce<Record<string, MaintenanceEvent[]>>((acc, ev) => {
    (acc[ev.scheduledDate] ??= []).push(ev);
    return acc;
  }, {});
}

// ─── Single-select custom dropdown ───────────────────────────────────────────

interface SelectOption {
  value: string;
  label?: string;
  prefix?: React.ReactNode;
}

function SingleSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: (SelectOption | string)[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const normalized = options.map(o =>
    typeof o === "string" ? { value: o, label: o, prefix: undefined } : { label: o.label ?? o.value, ...o }
  );
  const current = normalized.find(o => o.value === value);

  const openFn = () => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
    setOpen(v => !v);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const closeOnScroll = () => setOpen(false);
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", closeOnScroll, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openFn}
        className={`w-full flex items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-white/[0.04] border ${
          open
            ? "border-blue-400 dark:border-blue-500/60 ring-2 ring-blue-500/20"
            : "border-slate-200 dark:border-white/10"
        } rounded-lg text-xs text-left text-slate-900 dark:text-white focus:outline-none transition`}
      >
        {current?.prefix && <span className="shrink-0">{current.prefix}</span>}
        <span className="flex-1 min-w-0 truncate text-sm">{current?.label ?? value}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-white/30 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && rect && typeof document !== "undefined" && createPortal(
        <div
          onMouseDown={e => e.stopPropagation()}
          style={{ position: "fixed", top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 9999 }}
          className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-52 overflow-y-auto"
        >
          {normalized.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs transition text-left ${
                opt.value === value
                  ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 font-semibold"
                  : "text-slate-700 dark:text-white/70 hover:bg-slate-50 dark:hover:bg-white/5"
              }`}
            >
              {opt.prefix && <span className="shrink-0">{opt.prefix}</span>}
              <span className="flex-1">{opt.label}</span>
              {opt.value === value && <Check className="w-3 h-3 shrink-0 text-blue-500" />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

// ─── Form default ─────────────────────────────────────────────────────────────

interface FormData {
  title: string;
  type: MaintType;
  category: string;
  technician: string;
  priority: MaintPriority;
  description: string;
  scheduledDate: string;
  duration: string;
  module: string;
}

function defaultForm(dateStr = ""): FormData {
  return {
    title: "",
    type: "Preventive",
    category: "Cryogenic System",
    technician: TECHNICIANS[0],
    priority: "MEDIUM",
    description: "",
    scheduledDate: dateStr || todayStr(),
    duration: "2",
    module: "",
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScheduleMaintenancePage() {
  const router = useRouter();
  const { events, hydrated, addEvent } = useMaintenanceStorage();

  const now = new Date();
  const [viewYear, setViewYear]   = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const [drawerOpen, setDrawerOpen]     = useState(false);

  // Backend component selector
  const [products, setProducts]         = useState<ApiProductCatalog[]>([]);
  const [designNodes, setDesignNodes]   = useState<TroubleshootingDesignNode[]>([]);
  const [loadingNodes, setLoadingNodes] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [moduleUuids, setModuleUuids] = useState<string[]>([]);
  const [detailEvent, setDetailEvent]   = useState<MaintenanceEvent | null>(null);
  const [form, setForm]                 = useState<FormData>(defaultForm());
  const [formErrors, setFormErrors]     = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting]     = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const calGrid   = useMemo(() => buildGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const evByDate  = useMemo(() => eventsByDate(events), [events]);

  const monthLabel = `${MONTH_NAMES[viewMonth]} ${viewYear}`;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const openDrawer = useCallback((dateStr?: string) => {
    setForm(defaultForm(dateStr));
    setFormErrors({});
    setDetailEvent(null);
    setDrawerOpen(true);
    setTimeout(() => titleRef.current?.focus(), 120);
  }, []);

  const closeDrawer = () => { setDrawerOpen(false); setDetailEvent(null); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeDrawer(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Load product list once
  useEffect(() => {
    fetchProductCatalog().then(list => {
      setProducts(list);
      if (list.length > 0) {
        setSelectedProductId(list[0].id);
      }
    });
  }, []);

  // When product changes, load its assembly tree
  useEffect(() => {
    if (!selectedProductId) return;
    setLoadingNodes(true);
    fetchTroubleshootingByProduct(selectedProductId)
      .then(res => { if (res.success) setDesignNodes(res.data); })
      .finally(() => setLoadingNodes(false));
  }, [selectedProductId]);

  const handleField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (formErrors[key]) setFormErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (!form.title.trim()) errs.title = "Title is required";
    if (!form.scheduledDate) errs.scheduledDate = "Date is required";
    if (!form.duration || isNaN(Number(form.duration)) || Number(form.duration) <= 0)
      errs.duration = "Enter a valid duration";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 400));
    const status: MaintStatus = form.scheduledDate < todayStr() ? "overdue" : "upcoming";
    addEvent({
      title: form.title.trim(),
      type: form.type,
      category: form.category,
      technician: form.technician,
      priority: form.priority,
      description: form.description.trim() || undefined,
      scheduledDate: form.scheduledDate,
      duration: Number(form.duration),
      module: form.module.trim() || undefined,
      status,
    });
    setSubmitting(false);
    closeDrawer();
    toast.success("Maintenance event scheduled", {
      style: { background: "#0c0e16", color: "#fff", border: "1px solid rgba(255,255,255,0.08)" },
      iconTheme: { primary: "#10b981", secondary: "#0c0e16" },
    });
    // Navigate to the month of the new event if different
    const [ey, em] = form.scheduledDate.split("-").map(Number);
    setViewYear(ey); setViewMonth(em - 1);
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:      events.length,
    overdue:    events.filter(e => e.status === "overdue").length,
    upcoming:   events.filter(e => e.status === "upcoming").length,
    inProgress: events.filter(e => e.status === "in-progress").length,
    completed:  events.filter(e => e.status === "completed").length,
  }), [events]);

  // ── Upcoming sidebar (next 10 events chronologically) ─────────────────────
  const sidebarEvents = useMemo(() =>
    [...events]
      .filter(e => e.status === "upcoming" || e.status === "in-progress" || e.status === "overdue")
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
      .slice(0, 8),
    [events]);

  // ── Cell click ─────────────────────────────────────────────────────────────
  const handleDayClick = (cell: CalDay) => {
    if (!cell.isCurrentMonth) return;
    openDrawer(cell.dateStr);
  };

  const handleEventClick = (ev: MaintenanceEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    setDetailEvent(ev);
    setDrawerOpen(true);
  };

  return (
    <>
      <Toaster position="bottom-right" />

      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#07090e]">

        {/* ── Page Header ── */}
        <div className="bg-white dark:bg-[#090b10] border-b border-slate-200 dark:border-white/5 px-6 py-4">
          <Breadcrumbs className="mb-2" items={[{ label: "Dashboard", href: "/" }, { label: "Maintenance", href: "/maintenance" }, { label: "Schedule" }]} />
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 dark:text-white">Maintenance Schedule</h1>
                <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">
                  Manage preventive and scheduled maintenance for the installed machine.
                </p>
              </div>
            </div>
            <button
              onClick={() => openDrawer()}
              className="flex items-center gap-2 px-4 py-2 bg-[#2D6CFA] hover:bg-[#255DE6] text-white text-xs font-semibold rounded-lg transition shadow-[0_0_16px_rgba(45,108,250,0.2)] active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Maintenance
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">

          {/* ── Stats strip ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total Events",  value: stats.total,      icon: <Calendar className="w-4 h-4" />,      color: "slate",  ok: true },
              { label: "Overdue",       value: stats.overdue,    icon: <AlertTriangle className="w-4 h-4" />, color: "rose",   ok: stats.overdue === 0 },
              { label: "In Progress",   value: stats.inProgress, icon: <RefreshCw className="w-4 h-4" />,    color: "amber",  ok: true },
              { label: "Upcoming",      value: stats.upcoming,   icon: <Clock className="w-4 h-4" />,         color: "cyan",   ok: true },
            ].map(s => (
              <div
                key={s.label}
                className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl p-4 flex items-center gap-3"
              >
                <div className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center ${
                  s.color === "rose"  ? (!s.ok && s.value > 0 ? "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-white/30")
                  : s.color === "amber" ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : s.color === "cyan"  ? "bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
                  : "bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-white/40"
                }`}>
                  {s.icon}
                </div>
                <div>
                  <p className="text-[9px] font-mono text-slate-400 dark:text-white/30 uppercase tracking-widest">{s.label}</p>
                  <p className={`text-2xl font-bold font-mono tabular-nums leading-none mt-0.5 ${
                    s.color === "rose" && !s.ok && s.value > 0 ? "text-rose-600 dark:text-rose-400"
                    : "text-slate-900 dark:text-white"
                  }`}>{hydrated ? s.value : "—"}</p>
                </div>
                {s.color === "rose" && s.value > 0 && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                )}
              </div>
            ))}
          </div>

          {/* ── Main grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Calendar (2/3) */}
            <div className="lg:col-span-2 bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden">

              {/* Calendar header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                    <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">Maintenance calendar</span>
                    <span className="ml-2 text-sm font-normal text-slate-400 dark:text-white/30">{monthLabel}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={prevMonth}
                    className="w-7 h-7 rounded flex items-center justify-center text-slate-400 dark:text-white/40 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[11px] font-mono text-slate-400 dark:text-white/30 px-2 py-0.5 border border-slate-200 dark:border-white/10 rounded">
                    Month
                  </span>
                  <button
                    onClick={nextMonth}
                    className="w-7 h-7 rounded flex items-center justify-center text-slate-400 dark:text-white/40 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 border-b border-slate-100 dark:border-white/5">
                {DAY_LABELS.map(d => (
                  <div key={d} className="py-2 text-center text-[9px] font-mono font-bold text-slate-400 dark:text-white/25 uppercase tracking-widest">
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${viewYear}-${viewMonth}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className="grid grid-cols-7"
                >
                  {calGrid.map((cell, idx) => {
                    const dayEvents = evByDate[cell.dateStr] ?? [];
                    const hasOverdue = dayEvents.some(e => e.status === "overdue");
                    const visibleEvts = dayEvents.slice(0, 2);
                    const moreCount = dayEvents.length - visibleEvts.length;
                    const isLastRow = idx >= 35;
                    const isLastCol = (idx + 1) % 7 === 0;

                    return (
                      <div
                        key={cell.dateStr}
                        onClick={() => handleDayClick(cell)}
                        className={[
                          "min-h-[80px] p-2 relative transition-colors duration-100",
                          !isLastRow ? "border-b border-slate-100 dark:border-white/[0.04]" : "",
                          !isLastCol ? "border-r border-slate-100 dark:border-white/[0.04]" : "",
                          cell.isCurrentMonth && !cell.isToday
                            ? hasOverdue
                              ? "bg-rose-50/40 dark:bg-rose-500/[0.04] hover:bg-rose-50/70 dark:hover:bg-rose-500/[0.07] cursor-pointer"
                              : "hover:bg-slate-50 dark:hover:bg-white/[0.02] cursor-pointer"
                            : "bg-slate-50/60 dark:bg-transparent",
                          cell.isToday
                            ? "ring-2 ring-inset ring-cyan-500/50 dark:ring-cyan-400/40 bg-cyan-50/30 dark:bg-cyan-500/[0.04] cursor-pointer"
                            : "",
                          !cell.isCurrentMonth ? "opacity-40 cursor-default" : "",
                        ].join(" ")}
                      >
                        {/* Day number */}
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={[
                            "text-[11px] font-mono font-semibold leading-none",
                            cell.isToday ? "text-cyan-600 dark:text-cyan-400 font-bold" : "",
                            !cell.isCurrentMonth ? "text-slate-300 dark:text-white/20" : "text-slate-700 dark:text-white/60",
                          ].join(" ")}>
                            {cell.day}
                          </span>
                          {cell.isToday && (
                            <span className="text-[8px] font-mono font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wide">
                              Today
                            </span>
                          )}
                        </div>

                        {/* Events */}
                        <div className="space-y-0.5">
                          {cell.isToday && dayEvents.length >= 3 ? (
                            <button
                              onClick={e => { e.stopPropagation(); openDrawer(cell.dateStr); }}
                              className={`w-full text-left px-1.5 py-1 rounded text-[9px] font-mono font-semibold truncate border ${STATUS_PILL["in-progress"].bg} ${STATUS_PILL["in-progress"].text}`}
                            >
                              Today · {dayEvents.length} events
                            </button>
                          ) : (
                            <>
                              {visibleEvts.map(ev => (
                                <motion.button
                                  key={ev.id}
                                  whileHover={{ scale: 1.01 }}
                                  onClick={e => handleEventClick(ev, e)}
                                  className={`w-full text-left px-1.5 py-0.5 rounded text-[9px] font-mono truncate border ${STATUS_PILL[ev.status].bg} ${STATUS_PILL[ev.status].text}`}
                                >
                                  {ev.title}
                                </motion.button>
                              ))}
                              {moreCount > 0 && (
                                <button
                                  onClick={e => { e.stopPropagation(); openDrawer(cell.dateStr); }}
                                  className="w-full text-left px-1.5 py-0.5 text-[9px] font-mono text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/50 transition"
                                >
                                  +{moreCount} more
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Sidebar (1/3) */}
            <div className="space-y-4">

              {/* Machine context */}
              <div className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden">
                <div className="h-[3px] bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-400" />
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Cpu className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-white/70">Machine Context</span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: "System", value: "Primary MRI Unit" },
                      { label: "Model",  value: "Siemens MAGNETOM" },
                      { label: "Status", value: "Online", ok: true },
                      { label: "Uptime", value: "99.8%" },
                    ].map(r => (
                      <div key={r.label} className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-slate-400 dark:text-white/30 uppercase tracking-wider">{r.label}</span>
                        <span className={`text-[11px] font-semibold ${r.ok ? "text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-white/70"}`}>
                          {r.value}
                          {r.ok && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 ml-1.5 mb-0.5 animate-pulse" />}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400 dark:text-white/30">Next service due</span>
                    <span className="text-[11px] font-bold font-mono text-rose-600 dark:text-rose-400">Overdue</span>
                  </div>
                </div>
              </div>

              {/* Upcoming/active events */}
              <div className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-white/70">Active & Upcoming</span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-400 dark:text-white/25 bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">
                    {sidebarEvents.length}
                  </span>
                </div>

                {!hydrated ? (
                  <div className="p-6 flex justify-center">
                    <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                  </div>
                ) : sidebarEvents.length === 0 ? (
                  <div className="p-6 text-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1.5 opacity-60" />
                    <p className="text-[10px] font-mono text-slate-400 dark:text-white/30">All clear</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50 dark:divide-white/[0.03] max-h-[380px] overflow-y-auto">
                    {sidebarEvents.map(ev => {
                      const pill = STATUS_PILL[ev.status];
                      return (
                        <button
                          key={ev.id}
                          onClick={() => handleEventClick(ev, { stopPropagation: () => {} } as any)}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition"
                        >
                          <div className="flex items-start gap-2.5">
                            <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${pill.dot}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-semibold text-slate-800 dark:text-white truncate">{ev.title}</p>
                              <p className="text-[9px] font-mono text-slate-400 dark:text-white/30 mt-0.5 truncate">
                                {ev.scheduledDate} · {ev.technician}
                              </p>
                            </div>
                            <span className={`shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded border ${pill.bg} ${pill.text}`}>
                              {pill.label}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Legend */}
              <div className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl p-4">
                <p className="text-[9px] font-mono font-bold text-slate-400 dark:text-white/25 uppercase tracking-widest mb-3">Legend</p>
                <div className="space-y-1.5">
                  {(Object.entries(STATUS_PILL) as [MaintStatus, typeof STATUS_PILL[MaintStatus]][]).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${val.dot}`} />
                      <span className="text-[10px] font-mono text-slate-500 dark:text-white/40">{val.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Backdrop + Drawer ── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={closeDrawer}
              className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
            />
            <motion.aside
              key="drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              className="fixed right-0 top-0 h-full w-full max-w-[480px] bg-white dark:bg-[#0c0e16] border-l border-slate-200 dark:border-white/5 z-50 flex flex-col shadow-2xl"
            >

              {/* Drawer header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/5 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                    {detailEvent
                      ? <Wrench className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      : <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {detailEvent ? "Event Details" : "Add Maintenance"}
                    </p>
                    <p className="text-[10px] font-mono text-slate-400 dark:text-white/30">
                      {detailEvent ? detailEvent.scheduledDate : "Schedule a new maintenance event"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeDrawer}
                  className="w-7 h-7 rounded flex items-center justify-center text-slate-400 dark:text-white/30 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer body */}
              <div className="flex-1 overflow-y-auto">

                {/* Detail view */}
                {detailEvent ? (
                  <div className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight flex-1">
                        {detailEvent.title}
                      </h2>
                      <span className={`shrink-0 flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded-full border ${STATUS_PILL[detailEvent.status].bg} ${STATUS_PILL[detailEvent.status].text}`}>
                        {STATUS_PILL[detailEvent.status].icon}
                        {STATUS_PILL[detailEvent.status].label}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { icon: <Tag className="w-3.5 h-3.5" />, label: "Type", value: detailEvent.type },
                        { icon: <AlertTriangle className="w-3.5 h-3.5" />, label: "Priority", value: detailEvent.priority },
                        { icon: <User className="w-3.5 h-3.5" />, label: "Technician", value: detailEvent.technician },
                        { icon: <Timer className="w-3.5 h-3.5" />, label: "Duration", value: `${detailEvent.duration}h` },
                        { icon: <Calendar className="w-3.5 h-3.5" />, label: "Scheduled", value: detailEvent.scheduledDate },
                        { icon: <Layers className="w-3.5 h-3.5" />, label: "Category", value: detailEvent.category },
                      ].map(row => (
                        <div key={row.label} className="bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 rounded-lg p-3">
                          <div className="flex items-center gap-1.5 text-slate-400 dark:text-white/30 mb-1">
                            {row.icon}
                            <span className="text-[9px] font-mono uppercase tracking-widest">{row.label}</span>
                          </div>
                          <p className="text-xs font-semibold text-slate-800 dark:text-white">{row.value}</p>
                        </div>
                      ))}
                    </div>

                    {detailEvent.module && (
                      <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 text-slate-400 dark:text-white/30 mb-1">
                          <Cpu className="w-3.5 h-3.5" />
                          <span className="text-[9px] font-mono uppercase tracking-widest">Module / Component</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-white">{detailEvent.module}</p>
                      </div>
                    )}

                    {detailEvent.description && (
                      <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 text-slate-400 dark:text-white/30 mb-1">
                          <FileText className="w-3.5 h-3.5" />
                          <span className="text-[9px] font-mono uppercase tracking-widest">Notes</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-white/60 leading-relaxed">{detailEvent.description}</p>
                      </div>
                    )}

                    <div className={`rounded-lg px-3 py-2 border flex items-center gap-2 ${PRIORITY_STYLE[detailEvent.priority].bg} ${PRIORITY_STYLE[detailEvent.priority].border}`}>
                      <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${PRIORITY_STYLE[detailEvent.priority].text}`}>
                        {detailEvent.priority} Priority
                      </span>
                      <span className={`w-1.5 h-1.5 rounded-full ml-auto ${
                        detailEvent.priority === "CRITICAL" ? "bg-rose-500 animate-pulse"
                        : detailEvent.priority === "HIGH"   ? "bg-amber-500"
                        : detailEvent.priority === "MEDIUM" ? "bg-blue-500"
                        : "bg-slate-400"
                      }`} />
                    </div>

                    <button
                      onClick={() => {
                        setDetailEvent(null);
                        setForm({
                          title: detailEvent.title,
                          type: detailEvent.type,
                          category: detailEvent.category,
                          technician: detailEvent.technician,
                          priority: detailEvent.priority,
                          description: detailEvent.description ?? "",
                          scheduledDate: detailEvent.scheduledDate,
                          duration: String(detailEvent.duration),
                          module: detailEvent.module ?? "",
                        });
                      }}
                      className="w-full py-2.5 border border-blue-200 dark:border-blue-500/25 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/15 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Reschedule / Edit
                    </button>
                  </div>
                ) : (

                  /* Add form */
                  <form id="maint-form" onSubmit={handleSubmit} className="p-5 space-y-4">

                    {/* Title */}
                    <div>
                      <label className="block text-[10px] font-mono font-bold text-slate-500 dark:text-white/40 uppercase tracking-widest mb-1.5">
                        Title <span className="text-rose-500">*</span>
                      </label>
                      <input
                        ref={titleRef}
                        type="text"
                        value={form.title}
                        onChange={e => handleField("title", e.target.value)}
                        placeholder="e.g. Gradient coil inspection"
                        className={`w-full px-3 py-2.5 bg-slate-50 dark:bg-white/[0.04] border ${formErrors.title ? "border-rose-400 dark:border-rose-500/60" : "border-slate-200 dark:border-white/10"} rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition`}
                      />
                      {formErrors.title && <p className="text-[10px] text-rose-500 mt-1">{formErrors.title}</p>}
                    </div>

                    {/* Type + Priority */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-mono font-bold text-slate-500 dark:text-white/40 uppercase tracking-widest mb-1.5">Type</label>
                        <SingleSelect
                          value={form.type}
                          options={MAINT_TYPES.map(t => ({
                            value: t,
                            label: t,
                            prefix: <span className={`w-2 h-2 rounded-full shrink-0 ${TYPE_DOT[t]}`} />,
                          }))}
                          onChange={v => handleField("type", v as MaintType)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono font-bold text-slate-500 dark:text-white/40 uppercase tracking-widest mb-1.5">Priority</label>
                        <SingleSelect
                          value={form.priority}
                          options={(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as MaintPriority[]).map(p => ({
                            value: p,
                            label: p,
                            prefix: <span className={`w-2 h-2 rounded-full shrink-0 ${
                              p === "CRITICAL" ? "bg-rose-500 animate-pulse"
                              : p === "HIGH"   ? "bg-amber-500"
                              : p === "MEDIUM" ? "bg-blue-500"
                              : "bg-slate-400"
                            }`} />,
                          }))}
                          onChange={v => handleField("priority", v as MaintPriority)}
                        />
                      </div>
                    </div>

                    {/* Date + Duration */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-mono font-bold text-slate-500 dark:text-white/40 uppercase tracking-widest mb-1.5">
                          Date <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={form.scheduledDate}
                          onChange={e => handleField("scheduledDate", e.target.value)}
                          className={`w-full px-3 py-2.5 bg-slate-50 dark:bg-white/[0.04] border ${formErrors.scheduledDate ? "border-rose-400 dark:border-rose-500/60" : "border-slate-200 dark:border-white/10"} rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono font-bold text-slate-500 dark:text-white/40 uppercase tracking-widest mb-1.5">
                          Duration (hrs) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="0.5"
                          max="24"
                          step="0.5"
                          value={form.duration}
                          onChange={e => handleField("duration", e.target.value)}
                          className={`w-full px-3 py-2.5 bg-slate-50 dark:bg-white/[0.04] border ${formErrors.duration ? "border-rose-400 dark:border-rose-500/60" : "border-slate-200 dark:border-white/10"} rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition`}
                        />
                      </div>
                    </div>

                    {/* Technician + Category */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-mono font-bold text-slate-500 dark:text-white/40 uppercase tracking-widest mb-1.5">Technician</label>
                        <SingleSelect
                          value={form.technician}
                          options={TECHNICIANS}
                          onChange={v => handleField("technician", v)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono font-bold text-slate-500 dark:text-white/40 uppercase tracking-widest mb-1.5">Category</label>
                        <SingleSelect
                          value={form.category}
                          options={CATEGORIES}
                          onChange={v => handleField("category", v)}
                        />
                      </div>
                    </div>

                    {/* Module / Component — from backend product tree */}
                    <DesignTreeSelect
                      label="Module / Component"
                      nodes={designNodes}
                      value={moduleUuids}
                      onChange={(uuids, nodes) => {
                        setModuleUuids(uuids);
                        handleField("module", nodes[0]?.design_name ?? "");
                      }}
                      mode="single"
                      placeholder="— Select component —"
                      loading={loadingNodes}
                    />

                    {/* Notes */}
                    <div>
                      <label className="block text-[10px] font-mono font-bold text-slate-500 dark:text-white/40 uppercase tracking-widest mb-1.5">
                        Notes / Description
                      </label>
                      <textarea
                        value={form.description}
                        onChange={e => handleField("description", e.target.value)}
                        rows={3}
                        placeholder="Additional context or instructions for the technician..."
                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none transition"
                      />
                    </div>

                  </form>
                )}
              </div>

              {/* Drawer footer */}
              {!detailEvent && (
                <div className="shrink-0 px-5 py-4 border-t border-slate-100 dark:border-white/5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={closeDrawer}
                    className="flex-1 py-2.5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/50 hover:bg-slate-50 dark:hover:bg-white/5 text-xs font-semibold rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="maint-form"
                    disabled={submitting}
                    className="flex-1 py-2.5 bg-[#2D6CFA] hover:bg-[#255DE6] disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2 shadow-[0_0_16px_rgba(45,108,250,0.2)] active:scale-95"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Scheduling…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Schedule Event
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
