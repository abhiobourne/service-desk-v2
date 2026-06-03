"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Ticket, Package,
  AlertCircle, Clock, CheckCircle2, Circle, Loader2, X, ChevronDown
} from "lucide-react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { SearchInput } from "@/components/ui/SearchInput";
import { fetchTicketsPaginated, OrderTicket, OrderTicketMeta } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { useAbility } from "@/providers/AbilityProvider";
import { AddTicketDrawer } from "@/components/tickets/AddTicketDrawer";
import { Pagination } from "@/components/ui/Pagination";
import { useDebounce } from "@/hooks/useDebounce";
import { fuzzyAny } from "@/lib/search";

// ── Status config (same keys as before) ───────────────────────────────────────
const STATUS_CONFIG: Record<string, {
  bg: string; text: string; dot: string; icon: React.ReactNode; label: string;
}> = {
  open:        { bg: "bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20",         text: "text-blue-700 dark:text-blue-300",      dot: "bg-blue-500",    icon: <Circle className="w-2.5 h-2.5" />,        label: "Open"        },
  in_progress: { bg: "bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20",     text: "text-amber-700 dark:text-amber-300",     dot: "bg-amber-500",   icon: <Clock className="w-2.5 h-2.5" />,          label: "In Progress" },
  pending:     { bg: "bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20", text: "text-orange-700 dark:text-orange-300",    dot: "bg-orange-500",  icon: <AlertCircle className="w-2.5 h-2.5" />,    label: "Pending"     },
  resolved:    { bg: "bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500", icon: <CheckCircle2 className="w-2.5 h-2.5" />,  label: "Resolved"    },
  closed:      { bg: "bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10",              text: "text-slate-500 dark:text-white/35",       dot: "bg-slate-300 dark:bg-white/20", icon: <X className="w-2.5 h-2.5" />, label: "Closed" },
};

const PAGE_SIZE = 20;

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CONFIG[status?.toLowerCase()] ?? STATUS_CONFIG.open;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap ${s.bg} ${s.text}`}>
      {s.icon}
      {s.label}
    </span>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function TicketsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { can } = useAbility();

  const [tickets, setTickets]     = useState<OrderTicket[]>([]);
  const [meta, setMeta]           = useState<OrderTicketMeta>({ total: 0, page: 1, limit: PAGE_SIZE, totalPages: 1 });
  const [loading, setLoading]     = useState(false);
  const [page, setPage]           = useState(1);
  const [pageSize, setPageSize]   = useState(PAGE_SIZE);
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [addOpen, setAddOpen]     = useState(false);

  const debouncedSearch = useDebounce(searchInput, 400);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { items, meta: m } = await fetchTicketsPaginated({
      page,
      limit: pageSize,
      search: debouncedSearch,
      orderBy: "createdAt",
      order: "DESC",
    });
    setTickets(items);
    setMeta(m);
    setLoading(false);
  }, [user, page, pageSize, debouncedSearch]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedSearch, pageSize]);

  const visibleTickets = useMemo(() => {
    let result = tickets;
    if (statusFilter !== "all") {
      result = result.filter(t => t.status === statusFilter);
    }
    if (!searchInput.trim()) return result;
    return result.filter(t =>
      fuzzyAny(
        [
          t.ticket_id,
          t.reason?.replace(/<[^>]*>/g, ""),
          t.description?.replace(/<[^>]*>/g, ""),
          t.client_name,
          t.order_id,
          t.items?.[0]?.product_name,
          t.assignee_details
            ? `${t.assignee_details.firstName ?? ""} ${t.assignee_details.lastName ?? ""}`
            : "",
          t.status,
        ],
        searchInput,
      ),
    );
  }, [tickets, searchInput, statusFilter]);

  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-[#07090e]">
        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-[#07090e]">

      {/* ── Page Header ── */}
      <div className="shrink-0 bg-white dark:bg-[#090b10] border-b border-slate-200 dark:border-white/5 px-6 py-4">
        <Breadcrumbs className="mb-2" items={[{ label: "Dashboard", href: "/" }, { label: "Tickets" }]} />
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center shrink-0">
              <Ticket className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-base font-bold text-slate-900 dark:text-white">Service Tickets</h1>
                {meta.total > 0 && (
                  <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold font-mono rounded-full">
                    {meta.total}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">
                Track and manage equipment service requests
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#2D6CFA] hover:bg-[#255DE6] text-white rounded-lg transition shadow-[0_0_16px_rgba(45,108,250,0.2)]"
            >
              <Plus className="w-3.5 h-3.5" />
              New Ticket
            </button>
          </div>
        </div>
      </div>

      <div className="px-5 pt-5">
        <div className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3.5 flex items-center gap-3 flex-wrap">
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search equipment, department, technician..."
            className="flex-1 min-w-[200px]"
          />
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="appearance-none bg-slate-50 dark:bg-white/3 border border-slate-200 dark:border-white/8 rounded-lg pl-3 pr-7 py-2 text-xs text-slate-700 dark:text-white/70 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500/40 cursor-pointer transition"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 dark:text-white/30 pointer-events-none" />
            </div>
            <span className="text-[10px] font-mono text-slate-400 dark:text-white/25 ml-2 shrink-0">
              {visibleTickets.length} of {meta.total} records
            </span>
          </div>
        </div>
      </div>

      {/* ── Table Area ── */}
      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-5">

        {/* Loading skeleton */}
        {loading && (
          <div className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02]">
              <div className="grid grid-cols-[140px_1fr_180px_130px_150px_120px] gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-3 rounded bg-slate-200 dark:bg-white/8 animate-pulse" />
                ))}
              </div>
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="px-5 py-4 border-b border-slate-100 dark:border-white/4 last:border-0">
                <div className="grid grid-cols-[140px_1fr_180px_130px_150px_120px] gap-4 items-center">
                  <div className="h-3.5 rounded bg-slate-100 dark:bg-white/5 animate-pulse" />
                  <div className="space-y-1.5">
                    <div className="h-3.5 rounded bg-slate-100 dark:bg-white/5 animate-pulse w-3/4" />
                    <div className="h-2.5 rounded bg-slate-50 dark:bg-white/3 animate-pulse w-1/2" />
                  </div>
                  <div className="h-3.5 rounded bg-slate-100 dark:bg-white/5 animate-pulse" />
                  <div className="h-6 rounded-full bg-slate-100 dark:bg-white/5 animate-pulse w-20" />
                  <div className="h-3.5 rounded bg-slate-100 dark:bg-white/5 animate-pulse" />
                  <div className="h-3 rounded bg-slate-100 dark:bg-white/5 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && visibleTickets.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/8 flex items-center justify-center">
              <Ticket className="w-7 h-7 text-slate-300 dark:text-white/15" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500 dark:text-white/40">
                {searchInput ? `No tickets match "${searchInput}"` : "No tickets yet"}
              </p>
              <p className="text-xs text-slate-400 dark:text-white/25 mt-1">
                {searchInput ? "Try a different search term" : "Create a new ticket to get started"}
              </p>
            </div>
            {!searchInput && (
              <button
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#2D6CFA] hover:bg-[#255DE6] text-white rounded-lg transition mt-1"
              >
                <Plus className="w-3.5 h-3.5" />
                New Ticket
              </button>
            )}
          </div>
        )}

        {/* Tickets table */}
        {!loading && visibleTickets.length > 0 && (
          <div className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden">

            {/* Header row */}
            <div className="grid grid-cols-[140px_minmax(260px,1.4fr)_minmax(160px,0.9fr)_140px_160px_120px] px-5 py-3.5 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02] text-[10px] font-bold font-mono uppercase tracking-widest text-slate-400 dark:text-white/25">
              <span>Ticket ID</span>
              <span>Issue</span>
              <span>Product</span>
              <span>Status</span>
              <span>Assignee</span>
              <span className="text-right">Raised</span>
            </div>

            {/* Data rows */}
            <div className="divide-y divide-slate-100 dark:divide-white/4">
              {visibleTickets.map(t => {
                const title       = (t.reason ?? "Support Request").replace(/<[^>]*>/g, "").slice(0, 100);
                const productName = t.items?.[0]?.product_name;
                const assigneeName = t.assignee_details
                  ? `${t.assignee_details.firstName ?? ""} ${t.assignee_details.lastName ?? ""}`.trim()
                  : null;

                return (
                  <button
                    key={t.id}
                    onClick={() => router.push(`/tickets/${t.id}`)}
                    className="grid w-full grid-cols-[140px_minmax(260px,1.4fr)_minmax(160px,0.9fr)_140px_160px_120px] items-center gap-4 px-5 py-4 text-left transition hover:bg-blue-50/50 dark:hover:bg-blue-500/[0.04] group"
                  >
                    {/* Ticket ID */}
                    <div className="min-w-0">
                      <code className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition">
                        {t.ticket_id}
                      </code>
                    </div>

                    {/* Issue */}
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-800 dark:text-white/75 group-hover:text-slate-900 dark:group-hover:text-white transition">
                        {title}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-slate-400 dark:text-white/30">
                        {t.client_name ?? t.order_id}
                      </p>
                    </div>

                    {/* Product */}
                    <div className="flex min-w-0 items-center gap-1.5">
                      <Package className="h-3 w-3 shrink-0 text-slate-300 dark:text-white/20" />
                      <span className="truncate text-[11px] text-slate-500 dark:text-white/45">
                        {productName ?? "—"}
                      </span>
                    </div>

                    {/* Status */}
                    <div>
                      <StatusBadge status={t.status} />
                    </div>

                    {/* Assignee */}
                    <div className="flex items-center gap-2 min-w-0">
                      {assigneeName ? (
                        <>
                          <div className="w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center shrink-0">
                            <span className="text-[8px] font-bold text-blue-600 dark:text-blue-400">
                              {assigneeName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                            </span>
                          </div>
                          <span className="truncate text-[11px] text-slate-600 dark:text-white/50">{assigneeName}</span>
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-300 dark:text-white/20 italic">Unassigned</span>
                      )}
                    </div>

                    {/* Time */}
                    <div className="text-right">
                      <span className="text-[10px] font-mono text-slate-400 dark:text-white/30 whitespace-nowrap">
                        {timeAgo(t.createdAt)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ── Pagination inside the table card ── */}
            {meta.total > 0 && (
              <Pagination
                currentPage={page}
                totalItems={meta.total}
                itemsPerPage={pageSize}
                onPageChange={setPage}
                onItemsPerPageChange={size => { setPageSize(size); setPage(1); }}
                pageSizeOptions={[10, 20, 50, 100]}
              />
            )}
          </div>
        )}
      </div>

      <AddTicketDrawer isOpen={addOpen} onClose={() => setAddOpen(false)} onCreated={load} />
    </div>
  );
}
