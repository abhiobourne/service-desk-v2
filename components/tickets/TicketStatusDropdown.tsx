"use client";

import React, { useRef, useState, useEffect } from "react";
import { ChevronDown, Lock } from "lucide-react";

const STATUS_CONFIG: Record<string, {
  label: string; subtitle: string;
  color: string; bg: string; dot: string; locked?: boolean; muted?: boolean;
}> = {
  open:        { label: "Open",        subtitle: "queued · not assigned",   color: "text-blue-300",   bg: "bg-blue-500/15 border-blue-500/30",    dot: "bg-blue-400"    },
  in_progress: { label: "In Progress", subtitle: "on-site or remote work",  color: "text-amber-300",  bg: "bg-amber-500/15 border-amber-500/30",  dot: "bg-amber-400"   },
  pending:     { label: "Pending",     subtitle: "waiting for client",       color: "text-orange-300", bg: "bg-orange-500/15 border-orange-500/30",dot: "bg-orange-400"  },
  resolved:    { label: "Resolved",    subtitle: "requires happy code",      color: "text-emerald-300",bg: "bg-emerald-500/15 border-emerald-500/30",dot:"bg-emerald-400",locked: true },
  closed:      { label: "Closed",      subtitle: "after 7-day review",       color: "text-white/25",   bg: "bg-white/5 border-white/10",           dot: "bg-white/20",   muted: true },
};

interface TicketStatusDropdownProps {
  value: string;
  onChange: (status: string) => void;
  disabled?: boolean;
}

export function TicketStatusDropdown({ value, onChange, disabled = false }: TicketStatusDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = STATUS_CONFIG[value] ?? STATUS_CONFIG.open;

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono font-medium transition select-none ${current.color} ${current.bg} ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:opacity-80"}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${current.dot}`} />
        {current.label}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1.5 w-52 bg-[#0c0e16] border border-white/10 rounded-xl shadow-2xl py-1.5 overflow-hidden">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              type="button"
              onClick={() => { setOpen(false); if (key !== value) onChange(key); }}
              className={`w-full flex flex-col px-4 py-2.5 text-left transition-colors ${key === value ? "bg-white/5" : "hover:bg-white/5"}`}
            >
              <span className={`flex items-center gap-1.5 text-xs font-mono font-semibold leading-tight ${cfg.muted ? "text-white/20" : cfg.color}`}>
                {cfg.label}
                {cfg.locked && <Lock className="w-3 h-3 text-white/25" />}
              </span>
              <span className={`text-[10px] mt-0.5 leading-tight ${cfg.locked ? "font-mono" : ""} ${cfg.muted ? "text-white/15" : "text-white/30"}`}>
                {cfg.subtitle}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
