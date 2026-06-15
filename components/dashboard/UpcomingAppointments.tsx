"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Wrench } from "lucide-react";
import { mockSchedules } from "@/lib/mockSchedules";

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TECH_COLORS: Record<string, { color: string; bg: string }> = {
  "James Otieno":  { color: "#3b82f6", bg: "#3b82f620" },
  "Priya Sharma":  { color: "#8b5cf6", bg: "#8b5cf620" },
  "Carlos Mendes": { color: "#10b981", bg: "#10b98120" },
  "Aisha Nkosi":   { color: "#f59e0b", bg: "#f59e0b20" },
};
const DEFAULT_COLOR = { color: "#6b7280", bg: "#6b728020" };

function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getMondayOf(d: Date) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(d.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(d.getDate() + n);
  return r;
}

export function UpcomingAppointments() {
  const today    = new Date();
  const todayKey = toDateKey(today);

  const [weekStart,   setWeekStart]   = useState(() => getMondayOf(today));
  const [selectedKey, setSelectedKey] = useState(todayKey);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    return { key: toDateKey(d), label: DAY_SHORT[i], num: d.getDate() };
  });

  const prevWeek = () => { const s = addDays(weekStart, -7); setWeekStart(s); setSelectedKey(toDateKey(s)); };
  const nextWeek = () => { const s = addDays(weekStart,  7); setWeekStart(s); setSelectedKey(toDateKey(s)); };

  const items = useMemo(() =>
    mockSchedules
      .filter(s => s.scheduledDate === selectedKey)
      .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime)),
  [selectedKey]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <Wrench className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-xs font-semibold text-slate-700 dark:text-white/70">Upcoming Maintenance</span>
        </div>
        <Link
          href="/maintenance"
          className="flex items-center gap-1 text-[10px] font-mono text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition"
        >
          See all <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Week picker */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 dark:border-white/5 shrink-0">
        <button
          onClick={prevWeek}
          className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 bg-[#2D6CFA] text-white hover:bg-[#255DE6] cursor-pointer transition"
        >
          <ChevronLeft size={13} />
        </button>

        <div className="flex-1 flex justify-between items-center">
          {days.map(d => {
            const isSelected = d.key === selectedKey;
            const isToday    = d.key === todayKey;
            return (
              <button
                key={d.key}
                onClick={() => setSelectedKey(d.key)}
                className="flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-lg transition-all cursor-pointer"
                style={{
                  background: isSelected ? "#0f172a" : "transparent",
                  border: isSelected
                    ? "1px solid transparent"
                    : isToday
                    ? "1px solid #94a3b8"
                    : "1px solid transparent",
                }}
              >
                <span
                  className="text-[9px] font-bold uppercase tracking-wide"
                  style={{
                    color: isSelected ? "#ffffff" : isToday ? "#334155" : "#94a3b8",
                  }}
                >
                  {d.label}
                </span>
                <span
                  className="text-[13px] font-bold"
                  style={{
                    color: isSelected ? "#ffffff" : isToday ? "#1e293b" : "#64748b",
                  }}
                >
                  {d.num}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={nextWeek}
          className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 bg-[#2D6CFA] text-white hover:bg-[#255DE6] cursor-pointer transition"
        >
          <ChevronRight size={13} />
        </button>
      </div>

      {/* Schedule list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center">
              <Wrench size={18} className="text-slate-300 dark:text-white/20" />
            </div>
            <p className="text-[11px] font-mono text-slate-400 dark:text-white/30">Nothing scheduled</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {items.map(s => {
              const c = TECH_COLORS[s.assignedTo] ?? DEFAULT_COLOR;
              return (
                <div key={s.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: c.bg, border: `2px solid ${c.color}44` }}
                  >
                    <Wrench size={15} style={{ color: c.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">{s.equipment}</p>
                    <p className="text-[10px] text-slate-400 dark:text-white/30 mt-0.5 truncate">
                      {s.assignedTo} · {s.type} · {s.scheduledTime}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
