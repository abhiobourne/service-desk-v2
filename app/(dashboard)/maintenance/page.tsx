"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Wrench, Calendar, CheckCircle2, AlertTriangle, Clock,
  RefreshCw, ChevronLeft, ChevronRight, BarChart3,
  Filter, X, User,
} from "lucide-react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { DatePicker, ConfigProvider, theme as antdTheme } from "antd";
import dayjs, { Dayjs } from "dayjs";
import { useTheme } from "@/providers/ThemeProvider";
import {
  mockSchedules, MaintenanceSchedule, ScheduleStatus, MaintenanceType, Priority,
} from "@/lib/mockSchedules";

const { RangePicker } = DatePicker;

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_SHORT  = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const TIME_SLOTS: string[] = [];
for (let h = 8; h <= 17; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2,"0")}:00`);
  if (h < 17) TIME_SLOTS.push(`${String(h).padStart(2,"0")}:30`);
}

const TECH_COLORS: Record<string, { bg: string; border: string; accent: string }> = {
  "James Otieno":  { bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.3)", accent: "#a78bfa" },
  "Priya Sharma":  { bg: "rgba(74,222,128,0.10)",  border: "rgba(74,222,128,0.3)",  accent: "#4ade80" },
  "Carlos Mendes": { bg: "rgba(96,165,250,0.12)",  border: "rgba(96,165,250,0.3)",  accent: "#60a5fa" },
  "Aisha Nkosi":   { bg: "rgba(251,146,60,0.12)",  border: "rgba(251,146,60,0.3)",  accent: "#fb923c" },
};
const DEFAULT_TECH = { bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.3)", accent: "#94a3b8" };

const STATUS_STYLE: Record<ScheduleStatus, { bg: string; border: string; text: string; dot: string }> = {
  Scheduled:     { bg: "rgba(96,165,250,0.10)",  border: "rgba(96,165,250,0.3)",  text: "#60a5fa", dot: "#60a5fa" },
  "In Progress": { bg: "rgba(250,204,21,0.10)",  border: "rgba(250,204,21,0.35)", text: "#facc15", dot: "#facc15" },
  Overdue:       { bg: "rgba(248,113,113,0.10)", border: "rgba(248,113,113,0.35)",text: "#f87171", dot: "#f87171" },
  Completed:     { bg: "rgba(74,222,128,0.08)",  border: "rgba(74,222,128,0.25)", text: "#4ade80", dot: "#4ade80" },
};

const PRIORITY_STYLE: Record<Priority, { color: string; bg: string }> = {
  High:   { color: "#f87171", bg: "rgba(239,68,68,0.10)"   },
  Medium: { color: "#facc15", bg: "rgba(234,179,8,0.10)"   },
  Low:    { color: "#4ade80", bg: "rgba(74,222,128,0.08)"  },
};

const TYPE_STYLE: Record<MaintenanceType, { color: string; bg: string }> = {
  Preventive: { color: "#60a5fa", bg: "rgba(96,165,250,0.10)"  },
  Corrective: { color: "#c084fc", bg: "rgba(192,132,252,0.10)" },
  Predictive: { color: "#2dd4bf", bg: "rgba(45,212,191,0.10)"  },
};

type ViewMode = "week" | "month";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function getMondayOf(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  r.setDate(r.getDate() + (day === 0 ? -6 : 1 - day));
  r.setHours(0,0,0,0);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// ── AppointmentCard ───────────────────────────────────────────────────────────

function AppointmentCard({
  schedule, selected, onClick,
}: { schedule: MaintenanceSchedule; selected: boolean; onClick: () => void }) {
  const c = TECH_COLORS[schedule.assignedTo] ?? DEFAULT_TECH;
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-2 py-1.5 rounded-lg transition-all cursor-pointer mb-1 last:mb-0"
      style={{
        background: c.bg,
        border: `1px solid ${selected ? c.accent : c.border}`,
        boxShadow: selected ? `0 0 0 2px ${c.accent}33` : "none",
      }}
    >
      <p className="text-[11px] font-semibold leading-tight truncate text-slate-800 dark:text-white/85">
        {schedule.equipment}
      </p>
      <p className="text-[10px] font-medium mt-0.5 truncate" style={{ color: c.accent }}>
        {schedule.assignedTo}
      </p>
    </button>
  );
}

// ── ScheduleDetail ────────────────────────────────────────────────────────────

function ScheduleDetail({ schedule, onClose }: { schedule: MaintenanceSchedule; onClose: () => void }) {
  const s = STATUS_STYLE[schedule.status];
  const p = PRIORITY_STYLE[schedule.priority];
  const t = TYPE_STYLE[schedule.type];

  return (
    <div className="w-80 shrink-0 bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/8 rounded-xl overflow-hidden">
      <div className="px-4 py-3 flex items-start justify-between gap-2 border-b border-slate-100 dark:border-white/6">
        <div className="min-w-0">
          <p className="text-[10px] font-mono text-slate-400 dark:text-white/30">{schedule.id}</p>
          <h3 className="text-[13px] font-semibold mt-0.5 leading-snug text-slate-800 dark:text-white">
            {schedule.equipment}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/6 transition-colors mt-0.5 cursor-pointer"
        >
          <X className="w-3.5 h-3.5 text-slate-400 dark:text-white/30" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        <Row label="Status">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ color: s.text, background: s.bg, border: `1px solid ${s.border}` }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot }} />
            {schedule.status}
          </span>
        </Row>
        <Row label="Type">
          <span className="text-[11px] font-medium px-2 py-0.5 rounded"
            style={{ color: t.color, background: t.bg }}>{schedule.type}</span>
        </Row>
        <Row label="Priority">
          <span className="text-[11px] font-medium px-2 py-0.5 rounded"
            style={{ color: p.color, background: p.bg }}>{schedule.priority}</span>
        </Row>
        <div className="h-px bg-slate-100 dark:bg-white/6" />
        <DetailRow icon={<Calendar className="w-3.5 h-3.5" />} label="Scheduled">
          {schedule.scheduledDate} · {schedule.scheduledTime}
        </DetailRow>
        <DetailRow icon={<Clock className="w-3.5 h-3.5" />} label="Duration">
          {schedule.estimatedDuration}
        </DetailRow>
        <DetailRow icon={<User className="w-3.5 h-3.5" />} label="Assigned To">
          {schedule.assignedTo}
        </DetailRow>
        <DetailRow icon={<Wrench className="w-3.5 h-3.5" />} label="Last Performed">
          {schedule.lastPerformed}
        </DetailRow>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] uppercase tracking-widest font-mono text-slate-400 dark:text-white/30 shrink-0">{label}</span>
      {children}
    </div>
  );
}

function DetailRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-slate-300 dark:text-white/20 mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-[9px] uppercase tracking-widest font-mono text-slate-400 dark:text-white/25">{label}</p>
        <p className="text-[12px] font-medium text-slate-600 dark:text-white/60 mt-0.5">{children}</p>
      </div>
    </div>
  );
}

// ── WeekCalendar ──────────────────────────────────────────────────────────────

function WeekCalendar({ weekStart, schedules, selected, onSelect }: {
  weekStart: Date;
  schedules: MaintenanceSchedule[];
  selected: MaintenanceSchedule | null;
  onSelect: (s: MaintenanceSchedule | null) => void;
}) {
  const todayKey = toDateKey(new Date());
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    return { d, key: toDateKey(d), label: DAY_SHORT[i], num: d.getDate(), month: MONTH_SHORT[d.getMonth()] };
  });

  const indexed = useMemo(() => {
    const map: Record<string, Record<string, MaintenanceSchedule[]>> = {};
    for (const s of schedules) {
      (map[s.scheduledDate] ??= {})[s.scheduledTime] ??= [];
      map[s.scheduledDate][s.scheduledTime].push(s);
    }
    return map;
  }, [schedules]);

  const TIME_COL_W = 52;
  const ROW_H = 76;

  return (
    <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 340px)" }}>
      {/* Header */}
      <div className="sticky top-0 z-10 flex bg-white dark:bg-[#0c0e16] border-b border-slate-100 dark:border-white/5">
        <div style={{ width: TIME_COL_W, minWidth: TIME_COL_W }} className="border-r border-slate-100 dark:border-white/5" />
        {days.map((d, i) => {
          const isToday = d.key === todayKey;
          return (
            <div key={d.key} className={`flex-1 py-2.5 text-center ${i < 6 ? "border-r border-slate-100 dark:border-white/5" : ""}`}>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/25">{d.label}</p>
              <div className="flex items-center justify-center mt-0.5 gap-1">
                <span className="text-[13px] font-semibold w-7 h-7 flex items-center justify-center rounded-full"
                  style={isToday ? { background: "#2D6CFA", color: "#fff" } : { color: "inherit" }}
                >
                  {d.num}
                </span>
                {d.d.getDate() === 1 && (
                  <span className="text-[9px] text-slate-400 dark:text-white/25">{d.month}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Rows */}
      {TIME_SLOTS.map((slot, si) => (
        <div key={slot} className={`flex ${si < TIME_SLOTS.length - 1 ? "border-b border-slate-100 dark:border-white/5" : ""}`} style={{ minHeight: ROW_H }}>
          <div className="flex items-start justify-end pr-2 pt-1.5 shrink-0 border-r border-slate-100 dark:border-white/5"
            style={{ width: TIME_COL_W, minWidth: TIME_COL_W }}>
            <span className="text-[10px] font-mono text-slate-400 dark:text-white/25">{slot}</span>
          </div>
          {days.map((d, di) => {
            const items = indexed[d.key]?.[slot] ?? [];
            return (
              <div key={d.key}
                className={`flex-1 p-1.5 ${di < 6 ? "border-r border-slate-100 dark:border-white/5" : ""}`}
                style={{ background: d.key === todayKey ? "rgba(45,108,250,0.04)" : "transparent" }}
              >
                {items.map(s => (
                  <AppointmentCard
                    key={s.id}
                    schedule={s}
                    selected={selected?.id === s.id}
                    onClick={() => onSelect(selected?.id === s.id ? null : s)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── MonthCalendar ─────────────────────────────────────────────────────────────

function MonthCalendar({ year, month, schedules, selected, onSelect }: {
  year: number; month: number;
  schedules: MaintenanceSchedule[];
  selected: MaintenanceSchedule | null;
  onSelect: (s: MaintenanceSchedule | null) => void;
}) {
  const today = new Date();
  const byDate = useMemo(() => {
    const map: Record<string, MaintenanceSchedule[]> = {};
    schedules.forEach(s => { (map[s.scheduledDate] ??= []).push(s); });
    return map;
  }, [schedules]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const rawFirst = new Date(year, month, 1).getDay();
  const offset = rawFirst === 0 ? 6 : rawFirst - 1;
  const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;

  const cells = Array.from({ length: totalCells }, (_, i) => {
    const dayNum = i - offset + 1;
    if (dayNum < 1 || dayNum > daysInMonth) return null;
    const key = `${year}-${String(month+1).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`;
    const isToday = dayNum === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    return { dayNum, key, items: byDate[key] ?? [], isToday };
  });

  return (
    <div>
      <div className="grid grid-cols-7 bg-slate-50 dark:bg-white/2 border-b border-slate-100 dark:border-white/5">
        {DAY_SHORT.map(d => (
          <div key={d} className="py-2.5 text-center text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/25">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          const isLast = i >= cells.length - 7;
          const isLastCol = (i + 1) % 7 === 0;
          return (
            <div key={i}
              className={`min-h-28 p-2 relative
                ${!isLast    ? "border-b border-slate-100 dark:border-white/5" : ""}
                ${!isLastCol ? "border-r border-slate-100 dark:border-white/5" : ""}
                ${!cell      ? "bg-slate-50 dark:bg-white/2" : ""}
              `}
            >
              {cell && (
                <>
                  <div className="flex justify-end mb-1">
                    <span className="w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-semibold"
                      style={cell.isToday ? { background: "#2D6CFA", color: "#fff" } : { color: "rgb(148 163 184)" }}>
                      {cell.dayNum}
                    </span>
                  </div>
                  {cell.items.slice(0, 2).map(s => (
                    <AppointmentCard key={s.id} schedule={s}
                      selected={selected?.id === s.id}
                      onClick={() => onSelect(selected?.id === s.id ? null : s)}
                    />
                  ))}
                  {cell.items.length > 2 && (
                    <button onClick={() => onSelect(cell.items[2])}
                      className="text-[10px] font-mono text-slate-400 dark:text-white/25 px-1.5 cursor-pointer hover:text-slate-600 dark:hover:text-white/50 transition-colors">
                      +{cell.items.length - 2} more
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── FilterPopover ─────────────────────────────────────────────────────────────

function FilterPopover({ defaultFrom, defaultTo, onApply, onClear, onClose }: {
  defaultFrom?: string;
  defaultTo?: string;
  onApply: (from: string, to: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  const [range, setRange] = useState<[Dayjs | null, Dayjs | null]>([
    defaultFrom ? dayjs(defaultFrom) : null,
    defaultTo   ? dayjs(defaultTo)   : null,
  ]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const popup = document.querySelector(".ant-picker-dropdown");
      if (popup?.contains(e.target as Node)) return;
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div ref={ref}
      className="absolute right-0 top-full mt-1.5 z-50 p-4 rounded-xl space-y-3 bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/8 shadow-xl"
      style={{ minWidth: 320 }}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">Date Range</p>
      <ConfigProvider theme={{ algorithm: theme === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm }}>
        <RangePicker
          value={range}
          onChange={dates => setRange(dates ? [dates[0] ?? null, dates[1] ?? null] : [null, null])}
          format="DD MMM YYYY"
          style={{ width: "100%" }}
          allowClear
        />
      </ConfigProvider>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => { setRange([null, null]); onClear(); }}
          className="flex-1 py-1.5 rounded-lg text-[12px] font-medium cursor-pointer border border-slate-200 dark:border-white/8 text-slate-500 dark:text-white/40 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
        >
          Clear
        </button>
        <button
          onClick={() => onApply(range[0]?.format("YYYY-MM-DD") ?? "", range[1]?.format("YYYY-MM-DD") ?? "")}
          className="flex-1 py-1.5 rounded-lg text-[12px] font-medium cursor-pointer bg-[#2D6CFA] hover:bg-[#255DE6] text-white transition-colors"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

// ── UpcomingSidebar ───────────────────────────────────────────────────────────

function UpcomingSidebar({ onSelect }: { onSelect: (s: MaintenanceSchedule) => void }) {
  const todayKey = toDateKey(new Date());

  const upcoming = useMemo(() =>
    mockSchedules
      .filter(s => s.status === "Scheduled" && s.scheduledDate >= todayKey)
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)),
  [todayKey]);

  return (
    <div className="w-80 shrink-0 bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden flex flex-col" style={{ maxHeight: "calc(100vh - 260px)" }}>
      <div className="px-4 py-3 border-b border-slate-100 dark:border-white/5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-xs font-semibold text-slate-700 dark:text-white/70">Upcoming Maintenance</span>
        </div>
        <span className="text-[10px] font-mono text-slate-400 dark:text-white/25">{upcoming.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
        {upcoming.length === 0 ? (
          <p className="px-4 py-6 text-[11px] text-center text-slate-400 dark:text-white/25">No upcoming tasks</p>
        ) : upcoming.map(s => {
          const c = TECH_COLORS[s.assignedTo] ?? DEFAULT_TECH;
          const p = PRIORITY_STYLE[s.priority];
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s)}
              className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/3 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-[11px] font-semibold text-slate-800 dark:text-white/85 leading-tight truncate">
                  {s.equipment}
                </p>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                  style={{ color: p.color, background: p.bg }}>
                  {s.priority}
                </span>
              </div>
              <p className="text-[10px] truncate" style={{ color: c.accent }}>{s.assignedTo}</p>
              <p className="text-[10px] text-slate-400 dark:text-white/25 mt-0.5 font-mono">
                {s.scheduledDate} · {s.scheduledTime}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MaintenancePage() {
  const router = useRouter();
  const today = new Date();

  const [view, setView]             = useState<ViewMode>("week");
  const [weekStart, setWeekStart]   = useState<Date>(() => getMondayOf(today));
  const [calYear, setCalYear]       = useState(today.getFullYear());
  const [calMonth, setCalMonth]     = useState(today.getMonth());
  const [selected, setSelected]     = useState<MaintenanceSchedule | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeFrom, setActiveFrom] = useState("");
  const [activeTo, setActiveTo]     = useState("");

  const isFiltered = !!(activeFrom || activeTo);

  const filtered = useMemo(() => {
    if (!activeFrom && !activeTo) return mockSchedules;
    return mockSchedules.filter(s => {
      if (activeFrom && s.scheduledDate < activeFrom) return false;
      if (activeTo   && s.scheduledDate > activeTo)   return false;
      return true;
    });
  }, [activeFrom, activeTo]);

  const counts = useMemo(() => ({
    overdue:    mockSchedules.filter(s => s.status === "Overdue").length,
    inProgress: mockSchedules.filter(s => s.status === "In Progress").length,
    upcoming:   mockSchedules.filter(s => s.status === "Scheduled").length,
    completed:  mockSchedules.filter(s => s.status === "Completed").length,
  }), []);

  const prevPeriod = () => {
    if (view === "week") setWeekStart(d => addDays(d, -7));
    else if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };
  const nextPeriod = () => {
    if (view === "week") setWeekStart(d => addDays(d, 7));
    else if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };
  const goToday = () => {
    setWeekStart(getMondayOf(today));
    setCalYear(today.getFullYear());
    setCalMonth(today.getMonth());
  };

  const weekEnd   = addDays(weekStart, 6);
  const weekLabel = weekStart.getMonth() === weekEnd.getMonth()
    ? `${MONTH_SHORT[weekStart.getMonth()]} ${weekStart.getDate()} – ${weekEnd.getDate()}, ${weekStart.getFullYear()}`
    : `${MONTH_SHORT[weekStart.getMonth()]} ${weekStart.getDate()} – ${MONTH_SHORT[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${weekStart.getFullYear()}`;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#07090e]">

      {/* ── Page Header ── */}
      <div className="bg-white dark:bg-[#090b10] border-b border-slate-200 dark:border-white/5 px-6 py-4">
        <Breadcrumbs className="mb-2" items={[{ label: "Dashboard", href: "/" }, { label: "Maintenance" }]} />
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center shrink-0">
              <Wrench className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white">Maintenance Management</h1>
              <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">
                Preventive &amp; corrective maintenance for industrial equipment
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push("/maintenance/schedule")}
            className="flex items-center gap-2 px-4 py-2 bg-[#2D6CFA] hover:bg-[#255DE6] text-white text-xs font-semibold rounded-lg transition shadow-[0_0_16px_rgba(45,108,250,0.2)]"
          >
            <Calendar className="w-3.5 h-3.5" />
            Request Maintenance
          </button>
        </div>
      </div>

      <div className="p-6 space-y-5">

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Overdue",     value: counts.overdue,    sub: "Requires immediate action",  icon: <AlertTriangle className="w-4 h-4 text-rose-500" />,   iconBg: "bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20",       valueColor: "text-rose-600 dark:text-rose-400",    bar: "bg-rose-500",    pct: Math.round((counts.overdue    / mockSchedules.length) * 100) },
            { label: "In Progress", value: counts.inProgress, sub: "Currently being serviced",   icon: <RefreshCw className="w-4 h-4 text-amber-500" />,      iconBg: "bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20",   valueColor: "text-amber-600 dark:text-amber-400",  bar: "bg-amber-500",   pct: Math.round((counts.inProgress / mockSchedules.length) * 100) },
            { label: "Upcoming",    value: counts.upcoming,   sub: "Scheduled & ready",          icon: <Clock className="w-4 h-4 text-blue-500" />,           iconBg: "bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20",       valueColor: "text-blue-600 dark:text-blue-400",    bar: "bg-blue-500",    pct: Math.round((counts.upcoming   / mockSchedules.length) * 100) },
            { label: "Completed",   value: counts.completed,  sub: "Completed on schedule",      icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />, iconBg: "bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20", valueColor: "text-emerald-700 dark:text-emerald-400", bar: "bg-emerald-500", pct: Math.round((counts.completed  / mockSchedules.length) * 100) },
          ].map(card => (
            <div key={card.label} className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${card.iconBg}`}>{card.icon}</div>
                <BarChart3 className="w-4 h-4 text-slate-200 dark:text-white/10" />
              </div>
              <p className={`text-3xl font-bold tabular-nums ${card.valueColor}`}>{card.value}</p>
              <p className="text-xs font-semibold text-slate-600 dark:text-white/60 mt-1">{card.label}</p>
              <p className="text-[10px] text-slate-400 dark:text-white/25 mt-0.5">{card.sub}</p>
              <div className="mt-4 h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${card.bar}`} style={{ width: `${card.pct}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* ── Calendar Panel ── */}
        <div className="flex gap-4 items-start pb-2">
          <div className="flex-1 min-w-0 bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden">

            {/* Toolbar */}
            <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-white/5 flex-wrap">

              {/* View tabs */}
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/8">
                {(["week","month"] as ViewMode[]).map(v => (
                  <button key={v} onClick={() => setView(v)}
                    className="px-3 py-1 rounded-md text-[12px] font-medium transition-all cursor-pointer capitalize"
                    style={{
                      background: view === v ? "#fff" : "transparent",
                      color: view === v ? "#0f172a" : "rgb(148 163 184)",
                      border: view === v ? "1px solid rgb(226 232 240)" : "1px solid transparent",
                      boxShadow: view === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>

              {/* Navigation */}
              <div className="flex items-center gap-2">
                <button onClick={prevPeriod}
                  className="w-7 h-7 rounded-lg flex items-center justify-center border border-slate-200 dark:border-white/8 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer text-slate-500 dark:text-white/40">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={goToday}
                  className="px-3 py-1 rounded-lg text-[12px] font-medium border border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-white/3 hover:bg-slate-100 dark:hover:bg-white/6 text-slate-600 dark:text-white/50 transition-colors cursor-pointer">
                  Today
                </button>
                <button onClick={nextPeriod}
                  className="w-7 h-7 rounded-lg flex items-center justify-center border border-slate-200 dark:border-white/8 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer text-slate-500 dark:text-white/40">
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="text-[13px] font-semibold text-slate-700 dark:text-white/70 ml-1 whitespace-nowrap">
                  {view === "week" ? weekLabel : `${MONTH_NAMES[calMonth]} ${calYear}`}
                </span>
              </div>

              {/* Filter */}
              <div className="relative">
                <button onClick={() => setFilterOpen(o => !o)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                  style={{
                    border: `1px solid ${isFiltered ? "#2D6CFA" : "rgb(226 232 240)"}`,
                    color: isFiltered ? "#2D6CFA" : "rgb(148 163 184)",
                    background: isFiltered ? "rgba(45,108,250,0.08)" : "transparent",
                  }}
                >
                  <Filter className="w-3.5 h-3.5" />
                </button>
                {filterOpen && (
                  <FilterPopover
                    defaultFrom={activeFrom}
                    defaultTo={activeTo}
                    onApply={(from, to) => { setActiveFrom(from); setActiveTo(to); setFilterOpen(false); }}
                    onClear={() => { setActiveFrom(""); setActiveTo(""); setFilterOpen(false); }}
                    onClose={() => setFilterOpen(false)}
                  />
                )}
              </div>
            </div>

            {/* Calendar body */}
            {view === "week" ? (
              <WeekCalendar
                weekStart={weekStart}
                schedules={filtered}
                selected={selected}
                onSelect={setSelected}
              />
            ) : (
              <MonthCalendar
                year={calYear}
                month={calMonth}
                schedules={filtered}
                selected={selected}
                onSelect={setSelected}
              />
            )}
          </div>

          {/* Right panel — detail when selected, upcoming list otherwise */}
          {selected ? (
            <ScheduleDetail schedule={selected} onClose={() => setSelected(null)} />
          ) : (
            <UpcomingSidebar onSelect={setSelected} />
          )}
        </div>

      </div>
    </div>
  );
}
