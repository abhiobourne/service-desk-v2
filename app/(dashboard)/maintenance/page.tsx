"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Wrench, Calendar, CheckCircle2, AlertTriangle, Clock,
  RefreshCw, ChevronDown, BarChart3,
} from "lucide-react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { SearchInput } from "@/components/ui/SearchInput";
import { Pagination } from "@/components/ui/Pagination";

const PAGE_SIZE = 8;

type MaintStatus = "completed" | "upcoming" | "overdue" | "in-progress";

export interface MaintenanceRecord {
  id: string;
  equipment: string;
  equipmentId: string;
  department: string;
  type: "Preventive" | "Corrective" | "Calibration" | "Inspection";
  scheduledDate: string;
  completedDate?: string;
  status: MaintStatus;
  technician: string;
  notes?: string;
}

export const MOCK_RECORDS: MaintenanceRecord[] = [
  { id: "PM-2024-001", equipment: "MRI Scanner — Siemens MAGNETOM",    equipmentId: "EQ-MRI-01", department: "Radiology",  type: "Preventive",  scheduledDate: "2024-06-15", status: "overdue",     technician: "D. Sharma", notes: "Annual coil inspection overdue" },
  { id: "PM-2024-002", equipment: "CT Scanner — GE Revolution",          equipmentId: "EQ-CT-03",  department: "Radiology",  type: "Calibration", scheduledDate: "2024-06-20", status: "overdue",     technician: "A. Mehta" },
  { id: "PM-2024-003", equipment: "Ventilator — Dräger Evita V800",      equipmentId: "EQ-VNT-07", department: "ICU",        type: "Preventive",  scheduledDate: "2024-06-28", status: "in-progress", technician: "R. Patel", notes: "Filter replacement in progress" },
  { id: "PM-2024-004", equipment: "Infusion Pump — BD Alaris",           equipmentId: "EQ-INF-12", department: "Ward B",     type: "Inspection",  scheduledDate: "2024-07-02", status: "upcoming",    technician: "S. Kumar" },
  { id: "PM-2024-005", equipment: "ECG Machine — Philips PageWriter",    equipmentId: "EQ-ECG-05", department: "Cardiology", type: "Calibration", scheduledDate: "2024-07-05", status: "upcoming",    technician: "D. Sharma" },
  { id: "PM-2024-006", equipment: "X-Ray Unit — Siemens Ysio",           equipmentId: "EQ-XRY-02", department: "Radiology",  type: "Preventive",  scheduledDate: "2024-07-10", status: "upcoming",    technician: "A. Mehta" },
  { id: "PM-2024-007", equipment: "Defibrillator — Zoll R Series",       equipmentId: "EQ-DEF-09", department: "Emergency",  type: "Inspection",  scheduledDate: "2024-07-12", status: "upcoming",    technician: "R. Patel" },
  { id: "PM-2024-008", equipment: "Anesthesia Machine — GE Datex-Ohmeda",equipmentId: "EQ-ANS-04", department: "OR Suite",   type: "Preventive",  scheduledDate: "2024-05-30", completedDate: "2024-05-29", status: "completed", technician: "S. Kumar", notes: "Gas lines inspected, flow meters calibrated" },
  { id: "PM-2024-009", equipment: "Patient Monitor — Mindray BeneVision", equipmentId: "EQ-MON-21", department: "ICU",       type: "Calibration", scheduledDate: "2024-05-28", completedDate: "2024-05-28", status: "completed", technician: "D. Sharma" },
  { id: "PM-2024-010", equipment: "Ultrasound — Philips EPIQ Elite",      equipmentId: "EQ-USG-06", department: "OB-GYN",    type: "Preventive",  scheduledDate: "2024-06-01", completedDate: "2024-06-03", status: "completed", technician: "A. Mehta", notes: "Transducer cleaned and tested" },
  { id: "PM-2024-011", equipment: "Blood Analyzer — Sysmex XN-3000",     equipmentId: "EQ-LAB-15", department: "Pathology",  type: "Calibration", scheduledDate: "2024-07-20", status: "upcoming",    technician: "R. Patel" },
  { id: "PM-2024-012", equipment: "Surgical Robot — Intuitive da Vinci",  equipmentId: "EQ-ROB-01", department: "OR Suite",   type: "Preventive",  scheduledDate: "2024-07-25", status: "upcoming",    technician: "S. Kumar", notes: "Biannual full system check" },
];

export const STATUS_CONFIG: Record<MaintStatus, { label: string; bg: string; text: string; dot: string; icon: React.ReactNode }> = {
  overdue:      { label: "Overdue",     bg: "bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20",       text: "text-rose-600 dark:text-rose-400",    dot: "bg-rose-500",    icon: <AlertTriangle className="w-3 h-3" /> },
  "in-progress":{ label: "In Progress", bg: "bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20",   text: "text-amber-600 dark:text-amber-400",  dot: "bg-amber-500",   icon: <RefreshCw className="w-3 h-3" /> },
  upcoming:     { label: "Upcoming",    bg: "bg-blue-50 dark:bg-sky-500/10 border border-blue-200 dark:border-sky-500/20",         text: "text-blue-600 dark:text-sky-400",     dot: "bg-blue-500 dark:bg-sky-400",    icon: <Clock className="w-3 h-3" /> },
  completed:    { label: "Completed",   bg: "bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500", icon: <CheckCircle2 className="w-3 h-3" /> },
};

export const TYPE_STYLE: Record<string, string> = {
  Preventive:  "bg-blue-50 dark:bg-sky-500/8 text-blue-700 dark:text-sky-300 border border-blue-200 dark:border-sky-500/20",
  Corrective:  "bg-amber-50 dark:bg-amber-500/8 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20",
  Calibration: "bg-teal-50 dark:bg-teal-500/8 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-500/20",
  Inspection:  "bg-violet-50 dark:bg-violet-500/8 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-500/20",
};

export default function MaintenancePage() {
  const router = useRouter();
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState<MaintStatus | "all">("all");
  const [typeFilter, setTypeFilter]     = useState<string>("all");
  const [page, setPage]                 = useState(1);

  const counts = useMemo(() => ({
    overdue:    MOCK_RECORDS.filter(r => r.status === "overdue").length,
    inProgress: MOCK_RECORDS.filter(r => r.status === "in-progress").length,
    upcoming:   MOCK_RECORDS.filter(r => r.status === "upcoming").length,
    completed:  MOCK_RECORDS.filter(r => r.status === "completed").length,
  }), []);

  const filtered = useMemo(() => {
    setPage(1);
    return MOCK_RECORDS.filter(r => {
      const matchSearch =
        !search.trim() ||
        r.equipment.toLowerCase().includes(search.toLowerCase()) ||
        r.department.toLowerCase().includes(search.toLowerCase()) ||
        r.technician.toLowerCase().includes(search.toLowerCase()) ||
        r.equipmentId.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      const matchType   = typeFilter === "all" || r.type === typeFilter;
      return matchSearch && matchStatus && matchType;
    });
  }, [search, statusFilter, typeFilter]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

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
                Preventive &amp; corrective maintenance for medical equipment
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push("/maintenance/schedule")}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition shadow-[0_0_16px_rgba(37,99,235,0.2)]"
          >
            <Calendar className="w-3.5 h-3.5" />
            Schedule Maintenance
          </button>
        </div>
      </div>

      <div className="p-6 space-y-5">

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Overdue",
              value: counts.overdue,
              sub: "Requires immediate action",
              icon: <AlertTriangle className="w-4 h-4 text-rose-500" />,
              iconBg: "bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20",
              value_color: "text-rose-600 dark:text-rose-400",
              bar: "bg-rose-500",
              pct: Math.round((counts.overdue / MOCK_RECORDS.length) * 100),
            },
            {
              label: "In Progress",
              value: counts.inProgress,
              sub: "Currently being serviced",
              icon: <RefreshCw className="w-4 h-4 text-amber-500" />,
              iconBg: "bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20",
              value_color: "text-amber-600 dark:text-amber-400",
              bar: "bg-amber-500",
              pct: Math.round((counts.inProgress / MOCK_RECORDS.length) * 100),
            },
            {
              label: "Upcoming ",
              value: counts.upcoming,
              sub: "Scheduled in next 30 days",
              icon: <Clock className="w-4 h-4 text-blue-500" />,
              iconBg: "bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20",
              value_color: "text-blue-600 dark:text-blue-400",
              bar: "bg-blue-500",
              pct: Math.round((counts.upcoming / MOCK_RECORDS.length) * 100),
            },
            {
              label: "Completed",
              value: counts.completed,
              sub: "Completed on schedule",
              icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
              iconBg: "bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20",
              value_color: "text-emerald-700 dark:text-emerald-400",
              bar: "bg-emerald-500",
              pct: Math.round((counts.completed / MOCK_RECORDS.length) * 100),
            },
          ].map(card => (
            <div key={card.label} className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${card.iconBg}`}>
                  {card.icon}
                </div>
                <BarChart3 className="w-4 h-4 text-slate-200 dark:text-white/10" />
              </div>
              <p className={`text-3xl font-bold tabular-nums ${card.value_color}`}>{card.value}</p>
              <p className="text-xs font-semibold text-slate-600 dark:text-white/60 mt-1">{card.label}</p>
              <p className="text-[10px] text-slate-400 dark:text-white/25 mt-0.5">{card.sub}</p>
              <div className="mt-4 h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${card.bar}`} style={{ width: `${card.pct}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* ── Filter Bar ── */}
        <div className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3.5 flex items-center gap-3 flex-wrap">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search equipment, department, technician…"
            className="flex-1 min-w-[200px]"
          />
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as MaintStatus | "all")}
                className="appearance-none bg-slate-50 dark:bg-white/3 border border-slate-200 dark:border-white/8 rounded-lg pl-3 pr-7 py-2 text-xs text-slate-700 dark:text-white/70 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500/40 cursor-pointer transition"
              >
                <option value="all">All Statuses</option>
                <option value="overdue">Overdue</option>
                <option value="in-progress">In Progress</option>
                <option value="upcoming">Upcoming</option>
                <option value="completed">Completed</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 dark:text-white/30 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="appearance-none bg-slate-50 dark:bg-white/3 border border-slate-200 dark:border-white/8 rounded-lg pl-3 pr-7 py-2 text-xs text-slate-700 dark:text-white/70 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500/40 cursor-pointer transition"
              >
                <option value="all">All Types</option>
                <option value="Preventive">Preventive</option>
                <option value="Corrective">Corrective</option>
                <option value="Calibration">Calibration</option>
                <option value="Inspection">Inspection</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 dark:text-white/30 pointer-events-none" />
            </div>
          </div>
          <span className="text-[10px] font-mono text-slate-400 dark:text-white/25 ml-auto shrink-0">
            {filtered.length} of {MOCK_RECORDS.length} records
          </span>
        </div>

        {/* ── Maintenance Table ── */}
        <div className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden">

          {/* Table Header */}
          <div className="grid grid-cols-[180px_1fr_130px_110px_130px_140px_160px] px-4 py-3 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02]">
            {["Work Order", "Equipment", "Department", "Type", "Scheduled", "Technician", "Status"].map(h => (
              <span key={h} className="text-[10px] font-bold font-mono uppercase tracking-widest text-slate-400 dark:text-white/25">
                {h}
              </span>
            ))}
          </div>

          {/* Table Body */}
          {paginated.length === 0 && filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/8 flex items-center justify-center">
                <Wrench className="w-5 h-5 text-slate-300 dark:text-white/15" />
              </div>
              <p className="text-sm font-medium text-slate-400 dark:text-white/30">No records match your filters</p>
              <p className="text-xs text-slate-300 dark:text-white/20">Try adjusting the search or filter criteria</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/4">
              {paginated.map(r => {
                const s = STATUS_CONFIG[r.status];
                return (
                  <div
                    key={r.id}
                    onClick={() => router.push(`/maintenance/${r.id}`)}
                    className="grid grid-cols-[180px_1fr_130px_110px_130px_140px_160px] px-4 py-3.5 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] cursor-pointer transition-colors group"
                  >
                    {/* Work Order */}
                    <div className="flex flex-col justify-center min-w-0">
                      <span className="text-[11px] font-mono font-bold text-blue-600 dark:text-sky-400 truncate">{r.id}</span>
                      <span className="text-[10px] font-mono text-slate-400 dark:text-white/25 mt-0.5">{r.equipmentId}</span>
                    </div>

                    {/* Equipment */}
                    <div className="flex flex-col justify-center min-w-0 pr-4">
                      <span className="text-xs font-semibold text-slate-800 dark:text-white/80 truncate">{r.equipment}</span>
                      {r.notes && (
                        <span className="text-[10px] text-slate-400 dark:text-white/35 truncate mt-0.5">{r.notes}</span>
                      )}
                    </div>

                    {/* Department */}
                    <div className="flex items-center min-w-0">
                      <span className="text-xs text-slate-500 dark:text-white/50 truncate">{r.department}</span>
                    </div>

                    {/* Type */}
                    <div className="flex items-center">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${TYPE_STYLE[r.type]}`}>
                        {r.type}
                      </span>
                    </div>

                    {/* Scheduled Date */}
                    <div className="flex flex-col justify-center">
                      <span className="text-[11px] font-mono text-slate-700 dark:text-white/60">
                        {new Date(r.scheduledDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                      {r.completedDate && (
                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400/70 mt-0.5">
                          Done {new Date(r.completedDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                        </span>
                      )}
                    </div>

                    {/* Technician */}
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400">
                          {r.technician.split(" ").map(n => n[0]).join("")}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-600 dark:text-white/50 truncate">{r.technician}</span>
                    </div>

                    {/* Status */}
                    <div className="flex items-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold ${s.bg} ${s.text}`}>
                        {s.icon}
                        {s.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {filtered.length > 0 && (
            <Pagination
              currentPage={page}
              totalItems={filtered.length}
              itemsPerPage={PAGE_SIZE}
              onPageChange={setPage}
            />
          )}
        </div>
      </div>
    </div>
  );
}
