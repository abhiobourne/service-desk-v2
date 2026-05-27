"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X, Ticket, Package } from "lucide-react";
import { fetchTicketsPaginated, OrderTicket, OrderTicketMeta } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { useAbility } from "@/providers/AbilityProvider";
import { AddTicketDrawer } from "@/components/tickets/AddTicketDrawer";
import { Pagination } from "@/components/ui/Pagination";
import { useDebounce } from "@/hooks/useDebounce";
import { fuzzyAny } from "@/lib/search";

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  open:        { bg: "bg-blue-500/15 border-blue-500/25",       text: "text-blue-300",    dot: "bg-blue-400"    },
  in_progress: { bg: "bg-amber-500/15 border-amber-500/25",     text: "text-amber-300",   dot: "bg-amber-400"   },
  pending:     { bg: "bg-orange-500/15 border-orange-500/25",   text: "text-orange-300",  dot: "bg-orange-400"  },
  resolved:    { bg: "bg-emerald-500/15 border-emerald-500/25", text: "text-emerald-300", dot: "bg-emerald-400" },
  closed:      { bg: "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10",              text: "text-slate-600 dark:text-white/30",    dot: "bg-slate-100 dark:bg-white/20"    },
};

const PAGE_SIZE = 20;

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status?.toLowerCase()] ?? STATUS_STYLES.open;
  const label = (status ?? "open").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-mono font-semibold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {label}
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

  const [tickets, setTickets] = useState<OrderTicket[]>([]);
  const [meta, setMeta] = useState<OrderTicketMeta>({ total: 0, page: 1, limit: PAGE_SIZE, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [searchInput, setSearchInput] = useState("");
  const [addOpen, setAddOpen] = useState(false);

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

  // Reset to page 1 whenever search or page size changes
  useEffect(() => { setPage(1); }, [debouncedSearch, pageSize]);

  // Client-side fuzzy filter on top of server results
  const visibleTickets = useMemo(() => {
    if (!searchInput.trim()) return tickets;
    return tickets.filter((t) =>
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
  }, [tickets, searchInput]);

  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="h-14 shrink-0 border-b border-slate-200 dark:border-white/5 flex items-center px-5 gap-3 bg-slate-50 dark:bg-[#06070a]">
        <div className="flex items-center gap-2">
          <Ticket className="w-4 h-4 text-violet-500 dark:text-violet-400" />
          <span className="text-sm font-mono font-bold text-slate-900 dark:text-white">Tickets</span>
          <span className="text-[10px] font-mono text-slate-500 dark:text-white/25">({meta.total})</span>
        </div>

        <div className="flex-1" />

        <div className="relative w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 dark:text-white/20 pointer-events-none" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search tickets…"
            className="w-full bg-slate-100 dark:bg-white/3 border border-slate-200 dark:border-white/8 text-slate-900 dark:text-white text-xs font-mono pl-8 pr-7 py-2 rounded-lg focus:outline-none focus:border-violet-500/40 placeholder:text-slate-600 dark:text-white/20"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 dark:text-white/25 hover:text-slate-600 dark:text-white/60"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-semibold bg-violet-600 hover:bg-violet-500 text-slate-900 dark:text-white rounded-lg transition"
        >
          <Plus className="w-3.5 h-3.5" />
          New Ticket
        </button>
      </div>

      {/* Table area */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#090b10] p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="mb-3 grid grid-cols-[120px_1fr_130px_130px_110px] gap-4 last:mb-0">
                <div className="h-4 rounded bg-slate-100 dark:bg-white/5 animate-pulse" />
                <div className="h-4 rounded bg-slate-100 dark:bg-white/5 animate-pulse" />
                <div className="h-4 rounded bg-slate-100 dark:bg-white/5 animate-pulse" />
                <div className="h-4 rounded bg-slate-100 dark:bg-white/5 animate-pulse" />
                <div className="h-4 rounded bg-slate-100 dark:bg-white/5 animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {!loading && visibleTickets.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-24 text-center">
            <Ticket className="w-10 h-10 text-slate-600 dark:text-white/10 mb-3" />
            <p className="text-sm font-mono text-slate-600 dark:text-white/25">
              {searchInput ? `No tickets matching "${searchInput}"` : "No tickets yet"}
            </p>
          </div>
        )}

        {!loading && visibleTickets.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#090b10]">
            {/* Header */}
            <div className="grid grid-cols-[130px_minmax(260px,1.4fr)_minmax(160px,0.8fr)_120px_140px_110px] border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/[0.03] px-4 py-3 text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500 dark:text-white/25">
              <span>Ticket</span>
              <span>Issue</span>
              <span>Product</span>
              <span>Status</span>
              <span>Assignee</span>
              <span className="text-right">Created</span>
            </div>

            {visibleTickets.map((t) => {
              const title = (t.reason ?? "Support Request").replace(/<[^>]*>/g, "").slice(0, 100);
              const productName = t.items?.[0]?.product_name;
              const assigneeName = t.assignee_details
                ? `${t.assignee_details.firstName ?? ""} ${t.assignee_details.lastName ?? ""}`.trim()
                : null;
              return (
                <button
                  key={t.id}
                  onClick={() => router.push(`/tickets/${t.id}`)}
                  className="grid w-full grid-cols-[130px_minmax(260px,1.4fr)_minmax(160px,0.8fr)_120px_140px_110px] items-center gap-4 border-b border-slate-200 dark:border-white/5 px-4 py-3 text-left transition last:border-0 hover:bg-violet-500/5"
                >
                  <code className="text-[10px] font-mono font-semibold text-violet-400">{t.ticket_id}</code>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-mono text-slate-800 dark:text-white/70">{title}</p>
                    <p className="mt-1 truncate text-[10px] font-mono text-slate-500 dark:text-white/30">{t.client_name ?? t.order_id}</p>
                  </div>
                  <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-mono text-slate-600 dark:text-white/40">
                    <Package className="h-3 w-3 shrink-0" />
                    <span className="truncate">{productName ?? "—"}</span>
                  </div>
                  <StatusBadge status={t.status} />
                  <span className="truncate text-[10px] font-mono text-slate-600 dark:text-white/35">
                    {assigneeName ?? "Unassigned"}
                  </span>
                  <span className="text-right text-[10px] font-mono text-slate-600 dark:text-white/30">{timeAgo(t.createdAt)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {meta.total > 0 && (
        <Pagination
          currentPage={page}
          totalItems={meta.total}
          itemsPerPage={pageSize}
          onPageChange={setPage}
          onItemsPerPageChange={(size) => { setPageSize(size); setPage(1); }}
          pageSizeOptions={[10, 20, 50, 100]}
        />
      )}

      <AddTicketDrawer isOpen={addOpen} onClose={() => setAddOpen(false)} onCreated={load} />
    </div>
  );
}
