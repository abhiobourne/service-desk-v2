"use client";

import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

type AccentColor = "slate" | "blue" | "cyan" | "emerald" | "amber" | "rose" | "violet";

interface KpiCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  subtext?: string;
  trend?: { direction: "up" | "down" | "neutral"; label: string };
  loading?: boolean;
  accent?: AccentColor;
  pulse?: boolean;
  onClick?: () => void;
  className?: string;
}

const ACCENT: Record<AccentColor, { icon: string; value: string; badge: string; bar: string }> = {
  slate:   { icon: "bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-white/40",                 value: "text-slate-900 dark:text-white",      badge: "bg-slate-100 dark:bg-white/8 text-slate-500 dark:text-white/40",        bar: "bg-slate-400" },
  blue:    { icon: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400",               value: "text-blue-700 dark:text-blue-300",    badge: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400",       bar: "bg-blue-500" },
  cyan:    { icon: "bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",               value: "text-cyan-700 dark:text-cyan-300",    badge: "bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",       bar: "bg-cyan-500" },
  emerald: { icon: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",   value: "text-emerald-700 dark:text-emerald-300", badge: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" },
  amber:   { icon: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400",           value: "text-amber-700 dark:text-amber-300",  badge: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400",   bar: "bg-amber-500" },
  rose:    { icon: "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400",               value: "text-rose-700 dark:text-rose-400",    badge: "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400",       bar: "bg-rose-500" },
  violet:  { icon: "bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400",       value: "text-violet-700 dark:text-violet-300", badge: "bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400", bar: "bg-violet-500" },
};

export function KpiCard({
  title, value, icon, subtext, trend, loading = false,
  accent = "slate", pulse = false, onClick, className = "",
}: KpiCardProps) {
  const a = ACCENT[accent];

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl p-4 flex items-center gap-3 ${onClick ? "cursor-pointer hover:border-slate-300 dark:hover:border-white/10 transition" : ""} ${className}`}
    >
      {icon && (
        <div className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center ${a.icon}`}>
          {icon}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-mono text-slate-400 dark:text-white/30 uppercase tracking-widest truncate">{title}</p>

        {loading ? (
          <div className="mt-1 h-6 w-16 bg-slate-100 dark:bg-white/5 rounded animate-pulse" />
        ) : (
          <p className={`text-2xl font-bold font-mono tabular-nums leading-none mt-0.5 ${a.value}`}>
            {value}
          </p>
        )}

        {subtext && !loading && (
          <p className="text-[10px] text-slate-400 dark:text-white/25 mt-0.5 truncate">{subtext}</p>
        )}
      </div>

      <div className="shrink-0 flex flex-col items-end gap-1.5">
        {pulse && (
          <span className={`w-2 h-2 rounded-full ${a.bar} animate-pulse`} />
        )}
        {trend && !loading && (
          <span className={`flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded ${
            trend.direction === "up"   ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : trend.direction === "down" ? "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400"
            : "bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-white/30"
          }`}>
            {trend.direction === "up"   ? <TrendingUp className="w-2.5 h-2.5" />
            : trend.direction === "down" ? <TrendingDown className="w-2.5 h-2.5" />
            : null}
            {trend.label}
          </span>
        )}
      </div>
    </div>
  );
}
