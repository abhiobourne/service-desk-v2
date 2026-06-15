"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  UserPlus, MessageCircle, ClipboardList, User, Ticket,
  FileText, FileCode, FileType, File as FileIcon,
  Eye, Download, Search, Image as ImageIcon, Loader2, ChevronLeft, ChevronRight,
  CheckCircle2, Clock, AlertCircle, ShieldCheck, Zap, Box,
  Info, MessageSquare, XCircle, Paperclip, ChevronDown, Sparkles,
} from "lucide-react";
import {
  fetchOrderTicketById, updateOrderTicketStatus, resolveOrderTicketWithCode,
  fetchTicketInspections, fetchTicketCommunications, OrderTicket, TicketInspectionRecord,
} from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { useAbility } from "@/providers/AbilityProvider";
import { TicketStatusDropdown } from "@/components/tickets/TicketStatusDropdown";
import { HappyCodeModal } from "@/components/tickets/HappyCodeModal";
import { AssignTechnicianDrawer } from "@/components/tickets/AssignTechnicianDrawer";
import { TicketChatDrawer } from "@/components/tickets/TicketChatDrawer";
import { InspectionModal } from "@/components/tickets/InspectionModal";
import { PageHeader } from "@/components/ui/PageHeader";

// ── Glass panel ───────────────────────────────────────────────────────────────

function GlassPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl overflow-hidden border border-slate-200 dark:border-white/5 bg-white dark:bg-[#090b10] ${className}`}
      style={{ backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}
    >
      {children}
    </div>
  );
}

// ── File helpers ──────────────────────────────────────────────────────────────

function getFileTypeInfo(url: string) {
  const ext = url.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf")                      return { Icon: FileText, label: "PDF",  bg: "bg-red-50 dark:bg-red-500/10",       ic: "text-red-500 dark:text-red-400",    badge: "bg-red-50 dark:bg-red-500/15 border-red-200 dark:border-red-500/25 text-red-600 dark:text-red-300" };
  if (ext === "doc" || ext === "docx")    return { Icon: FileText, label: "DOC",  bg: "bg-blue-50 dark:bg-blue-500/10",     ic: "text-blue-500 dark:text-blue-400",  badge: "bg-blue-50 dark:bg-blue-500/15 border-blue-200 dark:border-blue-500/25 text-blue-600 dark:text-blue-300" };
  if (ext === "md" || ext === "markdown") return { Icon: FileCode, label: "MD",   bg: "bg-indigo-50 dark:bg-indigo-500/10", ic: "text-indigo-500 dark:text-indigo-400", badge: "bg-indigo-50 dark:bg-indigo-500/15 border-indigo-200 dark:border-indigo-500/25 text-indigo-600 dark:text-indigo-300" };
  if (ext === "txt")                      return { Icon: FileType, label: "TXT",  bg: "bg-slate-100 dark:bg-white/5",       ic: "text-slate-500 dark:text-white/30", badge: "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/30" };
  return { Icon: FileIcon, label: ext.toUpperCase() || "FILE", bg: "bg-slate-100 dark:bg-white/5", ic: "text-slate-500 dark:text-white/30", badge: "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/30" };
}

async function downloadFile(url: string, name: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const bUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = bUrl; a.download = name;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(bUrl);
  } catch { /* ignore */ }
}

// ── Lifecycle stages ──────────────────────────────────────────────────────────

const LIFECYCLE_STAGES = [
  { key: "pending",       label: "Pending",      Icon: Clock        },
  { key: "open",          label: "Open",          Icon: AlertCircle  },
  { key: "assigned",      label: "Assigned",      Icon: UserPlus     },
  { key: "diagnosing",    label: "Diagnosing",    Icon: Zap          },
  { key: "parts_ordered", label: "Parts Ordered", Icon: Box          },
  { key: "resolved",      label: "Resolved",      Icon: CheckCircle2 },
  { key: "closed",        label: "Closed",        Icon: ShieldCheck  },
] as const;

function getActiveStageIndex(ticket: OrderTicket): number {
  if (ticket.status === "closed")      return 6;
  if (ticket.status === "resolved")    return 5;
  if (ticket.status === "in_progress") return 3;
  if (ticket.status === "open")        return ticket.assignee_details?.id ? 2 : 1;
  if (ticket.status === "pending")     return 0;
  return 1;
}

interface TicketCommunicationMessage {
  message?: string | null;
  createdAt: string;
  is_system?: boolean;
  type?: string;
  metadata?: { status?: unknown } | null;
}

type TicketWithProductFallback = OrderTicket & {
  product_name?: string | null;
  line_items?: Array<{ product_name?: string | null }>;
};

interface InfoRow {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}

function parseAssignmentHistory(messages: any[]): { name: string; createdAt: string }[] {
  return messages
    .filter((m) => m.is_system === true || m.type === "auto" || !!m.metadata?.status)
    .filter((m) => m.message?.toLowerCase().includes("assigned to"))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((m) => {
      const match = m.message?.match(/assigned to ([^.!\n]+)/i);
      const name = match?.[1]?.trim();
      return name ? { name, createdAt: m.createdAt } : null;
    })
    .filter((x): x is { name: string; createdAt: string } => !!x);
}

const AVATAR_PALETTE = [
  "bg-blue-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500",  "bg-violet-500",  "bg-cyan-500",
];
function avatarBg(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function initials(n?: string | null) {
  if (!n) return "?";
  return n.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

// ── Lifecycle card ────────────────────────────────────────────────────────────

function LifecycleCard({
  ticket,
  assignmentHistory,
}: {
  ticket: OrderTicket;
  assignmentHistory: { name: string; createdAt: string }[];
}) {
  const activeIdx     = getActiveStageIndex(ticket);
  const reassignCount = assignmentHistory.length > 1 ? assignmentHistory.length - 1 : 0;
  const currentTech   = assignmentHistory[assignmentHistory.length - 1]?.name ?? null;

  const [historyOpen, setHistoryOpen] = useState(false);
  const histPopupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!historyOpen) return;
    function onOutside(e: MouseEvent) {
      if (histPopupRef.current && !histPopupRef.current.contains(e.target as Node)) {
        setHistoryOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [historyOpen]);

  const SHOW_MAX    = 3;
  const avatarSlice = assignmentHistory.slice(-Math.min(assignmentHistory.length, SHOW_MAX));
  const extraCount  = assignmentHistory.length > SHOW_MAX ? assignmentHistory.length - SHOW_MAX : 0;

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Ticket Lifecycle</h3>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
            Current stage:{" "}
            <span className="font-medium text-blue-600 dark:text-blue-400">
              {LIFECYCLE_STAGES[activeIdx].label}
            </span>
            {reassignCount > 0 && (
              <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400 font-medium">
                Reassigned ×{reassignCount}
              </span>
            )}
          </p>
        </div>
        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">
          {activeIdx + 1}/{LIFECYCLE_STAGES.length}
        </span>
      </div>

      <div className="flex items-start overflow-x-auto gap-0 pb-1">
        {LIFECYCLE_STAGES.map((stage, idx) => {
          const done   = idx < activeIdx;
          const active = idx === activeIdx;
          const future = idx > activeIdx;
          const { Icon } = stage;
          const isAssignedStage = stage.key === "assigned";
          const hasTech = assignmentHistory.length > 0 && !future;

          return (
            <React.Fragment key={stage.key}>
              <div className="flex flex-col items-center gap-1.5 shrink-0 min-w-[80px]">
                <div className={[
                  "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all",
                  done   ? "bg-blue-50 dark:bg-blue-500/20 border-blue-300 dark:border-blue-500/50"  : "",
                  active ? "bg-blue-600 border-blue-400 shadow-[0_0_14px_rgba(37,99,235,0.35)]"      : "",
                  future ? "bg-slate-100 dark:bg-white/3 border-slate-200 dark:border-white/8"       : "",
                ].join(" ")}>
                  {done
                    ? <CheckCircle2 className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                    : <Icon className={`w-3.5 h-3.5 ${active ? "text-white" : "text-slate-400 dark:text-white/20"}`} />}
                </div>

                <p className={`text-[8px] font-bold tracking-wide uppercase text-center leading-tight ${
                  done   ? "text-blue-500 dark:text-blue-400"
                  : active ? "text-slate-700 dark:text-slate-300"
                  : "text-slate-400 dark:text-white/20"
                }`}>{stage.label}</p>

                {isAssignedStage && hasTech && (
                  <div className="flex flex-col items-center gap-1 mt-0.5">
                    <div className="flex items-center">
                      {avatarSlice.map((entry, ai) => (
                        <div
                          key={ai}
                          title={entry.name}
                          className={`w-6 h-6 rounded-full border-2 border-white dark:border-[#090b10] flex items-center justify-center text-[7px] font-bold text-white ${avatarBg(entry.name)} shrink-0`}
                          style={{ marginLeft: ai === 0 ? 0 : -8, zIndex: avatarSlice.length - ai }}
                        >
                          {initials(entry.name)}
                        </div>
                      ))}
                      {extraCount > 0 && (
                        <div
                          className="w-6 h-6 rounded-full border-2 border-white dark:border-[#090b10] bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[7px] font-bold text-slate-600 dark:text-slate-300 shrink-0"
                          style={{ marginLeft: -8, zIndex: 0 }}
                        >
                          +{extraCount}
                        </div>
                      )}
                    </div>
                    {currentTech && (
                      <span className="text-[8px] font-semibold text-blue-600 dark:text-blue-400 truncate max-w-[76px] text-center leading-tight">
                        {currentTech}
                      </span>
                    )}
                    {assignmentHistory.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setHistoryOpen((o) => !o)}
                        className="text-[9px] text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 underline underline-offset-2 transition-colors font-medium"
                      >
                        history
                      </button>
                    )}
                  </div>
                )}
              </div>

              {idx < LIFECYCLE_STAGES.length - 1 && (
                <div className="flex-1 min-w-[6px] max-w-[28px] h-px mx-0.5 mt-4 shrink-0">
                  <div className={`h-full ${idx < activeIdx ? "bg-blue-300 dark:bg-blue-500/40" : "bg-slate-200 dark:bg-white/8"}`} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {historyOpen && assignmentHistory.length > 1 && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setHistoryOpen(false)} />
          <div
            ref={histPopupRef}
            className="absolute left-[calc(3/7*100%)] -translate-x-1/2 top-full mt-2 z-50 w-72 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0c0e16] shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-white/5">
              <p className="text-[9px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest">
                Assignment History
              </p>
              <button
                onClick={() => setHistoryOpen(false)}
                className="text-slate-400 dark:text-white/30 hover:text-slate-700 dark:hover:text-white/60 transition-colors text-base leading-none"
              >
                ×
              </button>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-64 overflow-y-auto">
              {[...assignmentHistory].reverse().map((entry, i) => {
                const isCurrent = i === 0;
                const d = new Date(entry.createdAt);
                return (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${avatarBg(entry.name)}`}>
                      {initials(entry.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold truncate ${
                        isCurrent ? "text-slate-800 dark:text-slate-200" : "text-slate-400 dark:text-slate-500 line-through"
                      }`}>
                        {entry.name}
                      </p>
                      <p className="text-[10px] font-mono text-slate-400 dark:text-slate-600 mt-px">
                        {d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                        {" · "}
                        {d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    {isCurrent && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wide shrink-0">
                        Current
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Faulty parts table ────────────────────────────────────────────────────────

function PartsTable({ parts }: { parts: NonNullable<OrderTicket["parts"]> }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 5;

  const filtered = useMemo(() => {
    if (!search.trim()) return parts;
    const q = search.toLowerCase();
    return parts.filter(
      (p) => p.part_name?.toLowerCase().includes(q) || p.part_type?.toLowerCase().includes(q)
    );
  }, [parts, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Faulty Parts</h3>
          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-500">{parts.length} parts</span>
        </div>
        <div className="relative w-52">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 dark:text-white/20 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search parts…"
            className="w-full bg-slate-50 dark:bg-white/3 border border-slate-200 dark:border-white/8 text-slate-800 dark:text-white text-[10px] font-mono pl-7 pr-3 py-2 rounded-lg focus:outline-none focus:border-blue-400 dark:focus:border-blue-500/40 placeholder:text-slate-400 dark:placeholder:text-white/20"
          />
        </div>
      </div>

      {parts.length === 0 ? (
        <div className="flex items-center justify-center h-16 text-xs font-mono text-slate-400 dark:text-white/25">
          No faulty parts reported.
        </div>
      ) : (
        <>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/5">
                {["Part Name", "Type", "Version", "View"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[9px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slice.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-[10px] font-mono text-slate-400 dark:text-white/25">
                    No results for &ldquo;{search}&rdquo;
                  </td>
                </tr>
              ) : slice.map((p, i) => (
                <tr key={i} className="border-b border-slate-50 dark:border-white/3 last:border-0 hover:bg-slate-50 dark:hover:bg-white/2">
                  <td className="px-3 py-2.5 text-xs font-medium text-slate-800 dark:text-slate-300">{p.part_name}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-500">{p.part_type}</td>
                  <td className="px-3 py-2.5">
                    <code className="text-[10px] font-mono text-slate-500 dark:text-slate-500">{p.part_version ?? "—"}</code>
                  </td>
                  <td className="px-3 py-2.5">
                    {p.troubleshooting_url ? (
                      <a
                        href={p.troubleshooting_url
                          .replace(/https?:\/\/(localhost|127\.0\.0\.1):\d+/, typeof window !== "undefined" ? window.location.origin : "")
                          .replace("/troubleshooting/", "/diagnostics/troubleshooting/")}
                        target="_blank" rel="noreferrer"
                        className="text-[10px] font-mono text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                      >View →</a>
                    ) : (
                      <span className="text-slate-300 dark:text-white/15 text-[10px] font-mono">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3">
              <span className="text-[9px] font-mono text-slate-400 dark:text-white/20">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-1">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                  className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 dark:border-white/8 text-slate-500 dark:text-white/25 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-30 transition">
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                  className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 dark:border-white/8 text-slate-500 dark:text-white/25 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-30 transition">
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Inspection report tab ─────────────────────────────────────────────────────

const INSP_VALUE_STYLE: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  pass:    { bg: "bg-emerald-50 dark:bg-emerald-500/15",  text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-500/30", dot: "bg-emerald-500" },
  fail:    { bg: "bg-red-50 dark:bg-red-500/15",          text: "text-red-700 dark:text-red-300",         border: "border-red-200 dark:border-red-500/30",         dot: "bg-red-500"     },
  resolve: { bg: "bg-blue-50 dark:bg-blue-500/15",        text: "text-blue-700 dark:text-blue-300",       border: "border-blue-200 dark:border-blue-500/30",       dot: "bg-blue-500"    },
  repair:  { bg: "bg-amber-50 dark:bg-amber-500/15",      text: "text-amber-700 dark:text-amber-300",     border: "border-amber-200 dark:border-amber-500/30",     dot: "bg-amber-500"   },
  replace: { bg: "bg-orange-50 dark:bg-orange-500/15",    text: "text-orange-700 dark:text-orange-300",   border: "border-orange-200 dark:border-orange-500/30",   dot: "bg-orange-500"  },
  hold:    { bg: "bg-slate-100 dark:bg-slate-500/15",     text: "text-slate-600 dark:text-slate-300",     border: "border-slate-200 dark:border-slate-500/30",     dot: "bg-slate-400"   },
};

function InspValueBadge({ value }: { value: string }) {
  const s = INSP_VALUE_STYLE[value];
  if (!s) return <span className="text-xs text-slate-400">—</span>;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${s.bg} ${s.text} ${s.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
      {value}
    </span>
  );
}

function InspectionReportTab({
  inspections,
  loading,
  canAdd,
  onAddInspection,
}: {
  inspections: TicketInspectionRecord[];
  loading: boolean;
  canAdd: boolean;
  onAddInspection: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map: Record<string, TicketInspectionRecord[]> = {};
    inspections.forEach((r) => {
      const bucket = Math.floor(new Date(r.createdAt).getTime() / 60000);
      const key = `${r.inspected_by}__${bucket}`;
      (map[key] ??= []).push(r);
    });
    return Object.entries(map).sort(
      ([, a], [, b]) => new Date(b[0].createdAt).getTime() - new Date(a[0].createdAt).getTime()
    );
  }, [inspections]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Inspection Report</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-500 mt-0.5">
            {grouped.length === 0
              ? "No inspections submitted yet"
              : `${grouped.length} submission${grouped.length !== 1 ? "s" : ""} · ${inspections.length} part${inspections.length !== 1 ? "s" : ""} inspected`}
          </p>
        </div>
        {canAdd && (
          <button
            onClick={onAddInspection}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            <ClipboardList className="w-3.5 h-3.5" />Add / Edit Inspection
          </button>
        )}
      </div>

      {grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-56 rounded-xl border border-dashed border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-white/2 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No inspection reports yet</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {canAdd
                ? "Submit the first inspection report for this ticket."
                : "The assigned technician hasn't submitted an inspection report yet."}
            </p>
          </div>
          {canAdd && (
            <button onClick={onAddInspection}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">
              <ClipboardList className="w-3.5 h-3.5" />Add Inspection
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(([key, group]) => {
            const isOpen = expanded === key;
            const inspector = group[0].inspector_name ?? group[0].inspected_by ?? "Technician";
            const d = new Date(group[0].createdAt);
            const passCount = group.filter((r) => r.result === "pass").length;
            const failCount = group.filter((r) => r.result === "fail").length;

            return (
              <div key={key}
                className={`bg-white dark:bg-[#090b10] border rounded-xl overflow-hidden transition-all ${isOpen ? "border-blue-200 dark:border-blue-500/30" : "border-slate-200 dark:border-white/5"}`}>
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : key)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-white/2 transition text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/25 flex items-center justify-center shrink-0">
                      <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">{initials(inspector)}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{inspector}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-500 font-mono mt-0.5">
                        {d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                        {" · "}
                        {d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        {" · "}
                        {group.length} part{group.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {passCount > 0 && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/25 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />{passCount} pass
                      </span>
                    )}
                    {failCount > 0 && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/25 text-[10px] font-semibold text-red-600 dark:text-red-400">
                        <XCircle className="w-3 h-3" />{failCount} fail
                      </span>
                    )}
                    <ChevronDown className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 dark:border-white/5 overflow-x-auto">
                    <table className="w-full border-collapse min-w-[700px]">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-white/3">
                          {["#", "Part", "Inspection Notes", "Result", "Action", "Notes", "Files"].map((h) => (
                            <th key={h} className="px-3 py-2.5 text-left text-[9px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-white/5">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {group.map((r, i) => (
                          <tr key={r.id} className="border-b border-slate-50 dark:border-white/5 last:border-0 hover:bg-slate-50/50 dark:hover:bg-white/2">
                            <td className="px-3 py-3 w-8">
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 dark:bg-white/5 text-[9px] font-bold text-slate-500 dark:text-slate-500">
                                {i + 1}
                              </span>
                            </td>
                            <td className="px-3 py-3 min-w-[140px]">
                              <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-tight">{r.part_name ?? "—"}</p>
                            </td>
                            <td className="px-3 py-3 min-w-[200px] max-w-[260px]">
                              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">{r.inspection || "—"}</p>
                            </td>
                            <td className="px-3 py-3 w-[100px]">
                              <InspValueBadge value={r.result} />
                            </td>
                            <td className="px-3 py-3 w-[110px]">
                              <InspValueBadge value={r.action} />
                            </td>
                            <td className="px-3 py-3 min-w-[120px] max-w-[180px]">
                              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">{r.notes ?? "—"}</p>
                            </td>
                            <td className="px-3 py-3 min-w-[80px]">
                              {r.attachments_url?.length ? (
                                <div className="flex flex-col gap-1">
                                  {r.attachments_url.map((url, fi) => (
                                    <a key={fi} href={url} target="_blank" rel="noreferrer"
                                      className="flex items-center gap-1 text-[10px] font-mono text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 truncate max-w-[100px]">
                                      <Paperclip className="w-2.5 h-2.5 shrink-0" />
                                      {url.split("/").pop()}
                                    </a>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type ActiveTab = "details" | "inspection";

export default function TicketDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const { can, isClient } = useAbility();

  const [ticket, setTicket]                 = useState<OrderTicket | null>(null);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [activeTab, setActiveTab]           = useState<ActiveTab>("details");
  const [chatOpen, setChatOpen]             = useState(false);

  const [inspections, setInspections]             = useState<TicketInspectionRecord[]>([]);
  const [loadingInsp, setLoadingInsp]             = useState(false);
  const [assignmentHistory, setAssignmentHistory] = useState<{ name: string; createdAt: string }[]>([]);

  const [infoTab,       setInfoTab]       = useState<"info" | "summary" | "chat">("info");
  const [ticketMessages, setTicketMessages] = useState<any[]>([]);
  const [summary,        setSummary]        = useState("");
  const [isSummarizing,  setIsSummarizing]  = useState(false);

  const [assignOpen,  setAssignOpen]  = useState(false);
  const [happyOpen,   setHappyOpen]   = useState(false);
  const [inspectOpen, setInspectOpen] = useState(false);
  const [previewUrl,  setPreviewUrl]  = useState<string | null>(null);
  const mdRef   = useRef<HTMLDivElement>(null);
  const docxRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const t = await fetchOrderTicketById(id);
    if (!t) { setError(true); setLoading(false); return; }
    setTicket(t);
    setLoading(false);
    const msgs = await fetchTicketCommunications(t.id).catch(() => []);
    setAssignmentHistory(parseAssignmentHistory(msgs));
    setTicketMessages(msgs);
  };

  const handleSummarize = async () => {
    if (!ticket) return;
    if (!ticketMessages.length) { setSummary("No conversation to summarize."); return; }
    setSummary("");
    setIsSummarizing(true);
    try {
      const transcript = ticketMessages
        .map((m: any) => `[${m.sender_id === ticket.user_id ? "User" : "Agent"}]: ${m.message}`)
        .join("\n");
      const prompt = `Summarize this support ticket conversation in 3-5 concise bullet points.\nFocus on: the main issue, actions taken, current status, and any unresolved items.\n\nConversation:\n${transcript}`;
      const puter = (await import("@heyputer/puter.js")).default;
      const resp = await (puter as any).ai.chat(prompt, { stream: true });
      let full = "";
      for await (const part of resp as any) {
        full += (part as any)?.text ?? "";
        setSummary(full);
      }
    } catch {
      setSummary("Failed to generate summary. Please try again.");
    }
    setIsSummarizing(false);
  };

  const loadInspections = async (ticketUuid: string) => {
    setLoadingInsp(true);
    const data = await fetchTicketInspections(ticketUuid).catch(() => []);
    setInspections(data ?? []);
    setLoadingInsp(false);
  };

  useEffect(() => {
    if (!user || !id) return;
    let cancelled = false;

    fetchOrderTicketById(id).then(async (nextTicket) => {
      if (cancelled) return;
      if (!nextTicket) {
        setError(true);
        setLoading(false);
        return;
      }

      setTicket(nextTicket);
      setLoading(false);
      const messages = await fetchTicketCommunications(nextTicket.id).catch(() => []);
      if (!cancelled) {
        setAssignmentHistory(
          parseAssignmentHistory(messages as TicketCommunicationMessage[]),
        );
        setTicketMessages(messages);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [id, user]);

  useEffect(() => {
    if (activeTab === "inspection" && ticket) loadInspections(ticket.id);
  }, [activeTab, ticket?.id]);

  useEffect(() => {
    if (!previewUrl || !/\.(md|markdown)$/i.test(previewUrl)) return;
    let cancelled = false;
    (async () => {
      try {
        const MarkdownIt = (await import("markdown-it")).default;
        const md = new MarkdownIt({ html: false, linkify: true, typographer: true });
        const res = await fetch(previewUrl);
        const text = await res.text();
        if (!cancelled && mdRef.current) mdRef.current.innerHTML = md.render(text);
      } catch {
        if (!cancelled && mdRef.current) mdRef.current.innerHTML = "<p style='color:#666;padding:16px'>Preview failed.</p>";
      }
    })();
    return () => { cancelled = true; };
  }, [previewUrl]);

  useEffect(() => {
    if (!previewUrl || !/\.(doc|docx)$/i.test(previewUrl)) return;
    (async () => {
      try {
        const { renderAsync } = await import("docx-preview");
        const res = await fetch(previewUrl);
        const buf = await res.arrayBuffer();
        setTimeout(async () => {
          if (docxRef.current) { docxRef.current.innerHTML = ""; await renderAsync(buf, docxRef.current); }
        }, 100);
      } catch {
        if (docxRef.current) docxRef.current.innerHTML = "<p style='color:#666;padding:16px'>Preview failed.</p>";
      }
    })();
  }, [previewUrl]);

  const renderPreview = (url: string) => {
    if (/\.(png|jpe?g|gif|webp|svg)$/i.test(url))
      return <img src={url} alt="Attachment" className="max-w-full max-h-full object-contain rounded" />;
    if (/\.pdf$/i.test(url))
      return <iframe src={url} className="w-full h-full rounded border-0 bg-white" />;
    if (/\.(md|markdown)$/i.test(url))
      return <div ref={mdRef} className="w-full h-full overflow-auto bg-[#0c0e16] p-6 text-xs font-mono text-white/60 leading-relaxed prose prose-invert prose-sm max-w-none">Loading…</div>;
    if (/\.(doc|docx)$/i.test(url))
      return <div ref={docxRef} className="w-full h-full overflow-auto bg-white p-6 text-[13px] text-slate-800">Loading document…</div>;
    return <iframe src={url} className="w-full h-full rounded border-0 bg-white" />;
  };

  const handleStatusChange = async (status: string) => {
    if (!ticket) return;
    if (status === "resolved") { setHappyOpen(true); return; }
    setUpdatingStatus(true);
    const ok = await updateOrderTicketStatus(ticket.id, status);
    setUpdatingStatus(false);
    if (ok) {
      toast.success("Status updated");
      setTicket((t) => t ? { ...t, status } : t);
    } else {
      toast.error("Failed to update status");
    }
  };

  const attachmentSource = ticket?.attachments_url;
  const attachmentUrls = useMemo((): string[] => {
    if (!attachmentSource) return [];
    if (Array.isArray(attachmentSource)) return attachmentSource;
    try {
      const parsed: unknown = JSON.parse(attachmentSource);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : [attachmentSource];
    } catch {
      return [attachmentSource];
    }
  }, [attachmentSource]);

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-[#06070a]">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-[#06070a]">
        <div className="text-center">
          <p className="text-sm font-mono text-red-500">Failed to load ticket.</p>
          <button onClick={() => router.back()}
            className="mt-4 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition">
            Go back
          </button>
        </div>
      </div>
    );
  }

  const assigneeName = ticket.assignee_details
    ? `${ticket.assignee_details.firstName ?? ""} ${ticket.assignee_details.lastName ?? ""}`.trim() || "Assigned"
    : null;

  const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
    open:        { bg: "bg-blue-50 dark:bg-blue-500/15",      text: "text-blue-600 dark:text-blue-400",    label: "Open"        },
    resolved:    { bg: "bg-emerald-50 dark:bg-emerald-500/15",text: "text-emerald-600 dark:text-emerald-400", label: "Resolved"  },
    in_progress: { bg: "bg-amber-50 dark:bg-amber-500/15",    text: "text-amber-600 dark:text-amber-400",  label: "In Progress" },
    closed:      { bg: "bg-slate-100 dark:bg-slate-500/15",   text: "text-slate-600 dark:text-slate-400",  label: "Closed"      },
    pending:     { bg: "bg-orange-50 dark:bg-orange-500/15",  text: "text-orange-600 dark:text-orange-400",label: "Pending"     },
  };
  const sb = STATUS_BADGE[ticket.status] ?? { bg: "bg-slate-100 dark:bg-white/10", text: "text-slate-600 dark:text-white/50", label: ticket.status };

  const ticketWithFallback = ticket as TicketWithProductFallback;
  const productName =
    ticket.items?.[0]?.product_name ??
    ticketWithFallback.product_name ??
    ticketWithFallback.line_items?.[0]?.product_name ??
    ticket.product_id ?? "—";

  const TABS: { key: ActiveTab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "details",    label: "Details",           Icon: Info          },
    { key: "inspection", label: "Inspection Report", Icon: ClipboardList },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-[#06070a] text-slate-900 dark:text-white">

      {/* ── Header ── */}
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Tickets",   href: "/tickets" },
          { label: ticket.ticket_id },
        ]}
        backHref="/tickets"
        icon={<Ticket className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        iconClassName="bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20"
        title={
          <>
            <span className="font-mono text-slate-900 dark:text-white">{ticket.ticket_id}</span>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide border ${sb.bg} ${sb.text}`}
              style={{ borderColor: "transparent" }}>
              {sb.label}
            </span>
          </>
        }
        subtitle={`Raised on ${fmtDate(ticket.createdAt)}`}
        right={
          <>
            {!isClient && (
              <>
                {can("assign", "tickets") && (
                  <button
                    onClick={() => setInspectOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium border border-slate-200 dark:border-white/10 rounded-full text-slate-600 dark:text-white/40 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white transition"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />Inspections
                  </button>
                )}
                <button
                  onClick={() => setAssignOpen(true)}
                  disabled={!can("assign", "tickets")}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium border border-blue-300 dark:border-blue-500/30 rounded-full text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 disabled:opacity-50 disabled:cursor-default transition"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {assigneeName ?? "Assign Technician"}
                </button>
                <TicketStatusDropdown
                  value={ticket.status}
                  onChange={handleStatusChange}
                  disabled={updatingStatus}
                />
              </>
            )}
          </>
        }
      />

      {/* ── Tab bar ── */}
      <div className="bg-white dark:bg-[#090b10] border-b border-slate-200 dark:border-white/5 px-6 shrink-0">
        <div className="flex items-center">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => {
                if (key === "inspection") setLoadingInsp(true);
                setActiveTab(key);
              }}
              className={[
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap",
                activeTab === key
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
              ].join(" ")}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 min-h-0 overflow-hidden">

        {/* ── Details tab ── */}
        {activeTab === "details" && (
          <div className="h-full overflow-y-auto">
            <div className="p-6 space-y-5">

              {/* Row 1: Tabbed info panel | Attachments */}
              <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5 items-stretch">

                {/* Left col: tabbed panel */}
                <GlassPanel className="flex flex-col">
                  {/* Tab bar */}
                  <div className="flex items-center gap-1 px-5 pt-4 pb-0 border-b border-slate-100 dark:border-white/5 shrink-0">
                    {([
                      { key: "info",    label: "Ticket Information", Icon: Info          },
                      { key: "summary", label: "Ticket Summary",     Icon: ClipboardList },
                      { key: "chat",    label: "Chat Summary",       Icon: Sparkles      },
                    ] as const).map(({ key, label, Icon }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setInfoTab(key)}
                        className={[
                          "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-all whitespace-nowrap",
                          infoTab === key
                            ? "border-blue-500 text-blue-600 dark:text-blue-400"
                            : "border-transparent text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
                        ].join(" ")}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="p-5 flex-1 overflow-y-auto">

                    {/* ── Ticket Information ── */}
                    {infoTab === "info" && (
                      <div className="space-y-2">
                        {([
                          { Icon: Ticket,   label: "Ticket ID",  value: ticket.ticket_id,               mono: true },
                          { Icon: User,     label: "Raised By",  value: ticket.user_name ?? ticket.user_id ?? "—" },
                          ...(assigneeName ? [{ Icon: UserPlus, label: "Assigned To", value: assigneeName }] : []),
                        ] as const).map(({ Icon, label, value, mono }: any) => (
                          <div key={label} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/3 rounded-lg">
                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-500 text-xs">
                              <Icon className="w-3.5 h-3.5 shrink-0" />{label}
                            </div>
                            {mono
                              ? <code className="text-[11px] font-mono text-slate-700 dark:text-slate-300 truncate max-w-[180px]">{value}</code>
                              : <span className="text-xs font-medium text-slate-800 dark:text-slate-300 truncate max-w-[180px]">{value}</span>}
                          </div>
                        ))}
                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/3 rounded-lg">
                          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-500 text-xs">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />Status
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${sb.bg} ${sb.text}`}>
                            {sb.label}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/3 rounded-lg">
                          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-500 text-xs">
                            <Clock className="w-3.5 h-3.5 shrink-0" />Created
                          </div>
                          <code className="text-[11px] font-mono text-slate-700 dark:text-slate-300">
                            {fmtDate(ticket.createdAt)}
                          </code>
                        </div>

                        {(ticket.reason || ticket.description) && (
                          <div className="pt-2 space-y-3 border-t border-slate-100 dark:border-white/5">
                            {ticket.reason && (
                              <div>
                                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Reason</p>
                                <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: ticket.reason }} />
                              </div>
                            )}
                            {ticket.description && (
                              <div>
                                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Description</p>
                                <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed" dangerouslySetInnerHTML={{ __html: ticket.description }} />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Ticket Summary (Lifecycle) ── */}
                    {infoTab === "summary" && (
                      <LifecycleCard ticket={ticket} assignmentHistory={assignmentHistory} />
                    )}

                    {/* ── Chat Summary (AI) ── */}
                    {infoTab === "chat" && (
                      <div className="flex flex-col gap-4">
                        {!summary ? (
                          <div className="flex flex-col items-center justify-center py-8 gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                              <Sparkles className="w-5 h-5 text-slate-400 dark:text-white/30" />
                            </div>
                            <p className="text-sm text-slate-400 dark:text-slate-500 text-center">
                              Generate an AI summary of the ticket chat conversation.
                            </p>
                            <button
                              type="button"
                              onClick={handleSummarize}
                              disabled={isSummarizing}
                              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50"
                            >
                              <Sparkles size={13} />
                              {isSummarizing ? "Summarizing…" : "Summarize Chat"}
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3">
                            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                              {summary.split("\n").map((line, i) => {
                                const trimmed = line.trim();
                                if (!trimmed) return <div key={i} className="h-1" />;
                                const isBullet = /^[-*]\s/.test(trimmed);
                                const content  = isBullet ? trimmed.replace(/^[-*]\s+/, "") : trimmed;
                                const render   = (text: string) =>
                                  text.split(/\*\*(.+?)\*\*/g).map((p, j) =>
                                    j % 2 === 1
                                      ? <span key={j} className="font-semibold text-slate-800 dark:text-slate-200">{p}</span>
                                      : <span key={j}>{p}</span>
                                  );
                                return isBullet ? (
                                  <div key={i} className="flex gap-2.5 items-start p-3 rounded-lg bg-slate-50 dark:bg-white/3 border border-slate-100 dark:border-white/5">
                                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-slate-400 dark:bg-white/30" />
                                    <span className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">{render(content)}</span>
                                  </div>
                                ) : (
                                  <p key={i} className="text-[12px] leading-relaxed text-slate-400 dark:text-slate-500 px-1">{render(content)}</p>
                                );
                              })}
                            </div>
                            <button
                              type="button"
                              onClick={() => { setSummary(""); handleSummarize(); }}
                              disabled={isSummarizing}
                              className="self-start flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-white/8 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition disabled:opacity-50"
                            >
                              <Sparkles size={12} />
                              {isSummarizing ? "Regenerating…" : "Regenerate"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                </GlassPanel>

                {/* Right col: Attachments */}
                <GlassPanel className="flex flex-col">
                  <div className="p-5 space-y-3 flex-1 overflow-y-auto">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-3.5 h-3.5 text-slate-400 dark:text-white/30" />
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Attachments</h3>
                    </div>
                    {attachmentUrls.length > 0 ? (
                      <div className="overflow-y-auto max-h-[420px] pr-1">
                        <div className="grid grid-cols-2 gap-2">
                          {attachmentUrls.map((url, i) => {
                            const isImage = /\.(png|jpe?g|gif|webp|svg)$/i.test(url);
                            const fileName = url.split("/").pop() ?? `attachment-${i + 1}`;
                            return (
                              <div
                                key={i}
                                onClick={() => setPreviewUrl(url)}
                                className="relative group cursor-pointer h-[120px] rounded-lg border border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-white/3 hover:border-blue-300 dark:hover:border-blue-500/30 transition overflow-hidden flex items-center justify-center"
                              >
                                {isImage ? (
                                  <img src={url} alt={`Attachment ${i + 1}`} className="w-full h-full object-cover" />
                                ) : (() => {
                                  const { Icon, label, bg, ic, badge } = getFileTypeInfo(url);
                                  return (
                                    <div className={`flex flex-col items-center justify-center gap-1.5 w-full h-full p-2 ${bg}`}>
                                      <Icon className={`w-6 h-6 ${ic}`} />
                                      <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border ${badge}`}>{label}</span>
                                      <span className="text-[8px] font-mono text-slate-400 dark:text-white/30 truncate w-full text-center px-1">{fileName}</span>
                                    </div>
                                  );
                                })()}
                                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition">
                                  <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-[200px] rounded-lg border border-dashed border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-white/2 gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                          <ImageIcon className="w-4 h-4 text-slate-400 dark:text-white/15" />
                        </div>
                        <p className="text-sm text-slate-400 dark:text-slate-500">No attachments</p>
                      </div>
                    )}
                  </div>
                </GlassPanel>
              </div>

              {/* Row 2: Faulty Parts */}
              <GlassPanel>
                <div className="p-5">
                  <PartsTable parts={ticket.parts ?? []} />
                </div>
              </GlassPanel>

            </div>
          </div>
        )}

        {/* ── Inspection tab ── */}
        {activeTab === "inspection" && (
          <div className="h-full overflow-y-auto">
            <div className="p-6">
              <InspectionReportTab
                inspections={inspections}
                loading={loadingInsp}
                canAdd={can("assign", "tickets")}
                onAddInspection={() => setInspectOpen(true)}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Attachment preview modal ── */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(0,0,0,0.75)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setPreviewUrl(null); }}
        >
          <div className="bg-white dark:bg-[#090b10] border border-slate-200 dark:border-white/8 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="h-12 shrink-0 border-b border-slate-100 dark:border-white/5 flex items-center justify-between px-4">
              <span className="text-xs font-mono text-slate-600 dark:text-white/50 truncate flex-1">
                {previewUrl.split("/").pop()}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadFile(previewUrl, previewUrl.split("/").pop() ?? "attachment")}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium text-slate-600 dark:text-white/40 border border-slate-200 dark:border-white/10 rounded hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white transition"
                >
                  <Download className="w-3 h-3" />Download
                </button>
                <button
                  onClick={() => setPreviewUrl(null)}
                  className="text-slate-400 dark:text-white/30 hover:text-slate-700 dark:hover:text-white/70 transition p-1"
                >
                  <span className="text-lg leading-none">×</span>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden flex items-center justify-center bg-slate-100 dark:bg-[#06070a] p-4 min-h-[400px]">
              {renderPreview(previewUrl)}
            </div>
          </div>
        </div>
      )}

      {/* ── Floating chat button ── */}
      <button
        onClick={() => setChatOpen(true)}
        className="fixed right-6 bottom-8 z-40 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 bg-slate-900 dark:bg-white cursor-pointer"
      >
        <MessageSquare size={20} strokeWidth={2} color="#ffffff" />
      </button>

      <TicketChatDrawer
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        ticketId={ticket.id}
        ticketInfo={{
          ticket_id:        ticket.ticket_id,
          status:           ticket.status,
          createdAt:        ticket.createdAt,
          order_id:         ticket.order_id,
          product_name:     ticket.items?.[0]?.product_name,
          reason:           ticket.reason ?? undefined,
          description:      ticket.description ?? undefined,
          user_name:        ticket.user_name ?? undefined,
          assignee_details: ticket.assignee_details ?? undefined,
        }}
      />

      {/* Modals / Drawers */}
      <HappyCodeModal
        open={happyOpen}
        onClose={() => setHappyOpen(false)}
        ticketId={ticket.ticket_id}
        maxAttempts={5}
        onVerify={async (code) => {
          const ok = await resolveOrderTicketWithCode(ticket.id, code);
          if (ok) { setTicket((t) => t ? { ...t, status: "resolved" } : t); await load(); }
          return ok;
        }}
      />

      <AssignTechnicianDrawer
        isOpen={assignOpen}
        onClose={() => setAssignOpen(false)}
        ticketData={{
          id:          ticket.id,
          orderId:     ticket.order_id,
          productId:   ticket.product_uuid ?? ticket.product_id ?? "",
          productUuid: ticket.product_uuid ?? "",
          designs:     ticket.designs,
          title:       ticket.reason ?? "Support Request",
          productName: ticket.items?.[0]?.product_name ?? "General Product",
          faultyParts: ticket.parts?.map((p) => ({ id: p.design_uuid, name: p.part_name })) ?? [],
          assigneeId:  ticket.assignee_details?.id,
        }}
        onAssigned={load}
      />

      <InspectionModal
        open={inspectOpen}
        onClose={() => {
          setInspectOpen(false);
          if (activeTab === "inspection" && ticket) loadInspections(ticket.id);
        }}
        ticket={ticket}
      />
    </div>
  );
}
