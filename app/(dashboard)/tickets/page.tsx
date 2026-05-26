"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Search, X, ChevronLeft, ChevronRight, Ticket, Clock, Package,
  ArrowLeft, Building2, User, UserPlus, ShoppingCart, Eye,
  Loader2, ClipboardList,
} from "lucide-react";
import {
  fetchTicketsPaginated, fetchOrderTicketById, updateOrderTicketStatus,
  resolveOrderTicketWithCode, OrderTicket, OrderTicketMeta,
} from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { useAbility } from "@/providers/AbilityProvider";
import { AddTicketDrawer } from "@/components/tickets/AddTicketDrawer";
import { InlineTicketChat } from "@/components/tickets/InlineTicketChat";
import { TicketStatusDropdown } from "@/components/tickets/TicketStatusDropdown";
import { HappyCodeModal } from "@/components/tickets/HappyCodeModal";
import { AssignTechnicianDrawer } from "@/components/tickets/AssignTechnicianDrawer";
import { InspectionModal } from "@/components/tickets/InspectionModal";
import { fuzzyAny } from "@/lib/search";

// ---------------------------------------------------------------------------
// Shared UI helpers
// ---------------------------------------------------------------------------
const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  open:        { bg: "bg-blue-500/15 border-blue-500/25",      text: "text-blue-300",    dot: "bg-blue-400"    },
  in_progress: { bg: "bg-amber-500/15 border-amber-500/25",    text: "text-amber-300",   dot: "bg-amber-400"   },
  pending:     { bg: "bg-orange-500/15 border-orange-500/25",  text: "text-orange-300",  dot: "bg-orange-400"  },
  resolved:    { bg: "bg-emerald-500/15 border-emerald-500/25",text: "text-emerald-300", dot: "bg-emerald-400" },
  closed:      { bg: "bg-white/5 border-white/10",             text: "text-white/30",    dot: "bg-white/20"    },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status?.toLowerCase()] ?? STATUS_STYLES.open;
  const label = (status ?? "open").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
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

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Inline detail panel (left side when ticket is open)
// ---------------------------------------------------------------------------
function TicketDetailPanel({ ticketId, onClose, onStatusChange }: {
  ticketId: string;
  onClose: () => void;
  onStatusChange?: (t: OrderTicket) => void;
}) {
  const { can } = useAbility();
  const [ticket, setTicket] = useState<OrderTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [happyOpen, setHappyOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [inspectOpen, setInspectOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    setTicket(null);
    fetchOrderTicketById(ticketId).then(t => { setTicket(t); setLoading(false); });
  }, [ticketId]);

  const handleStatusChange = async (status: string) => {
    if (!ticket) return;
    if (status === "resolved") { setHappyOpen(true); return; }
    setUpdatingStatus(true);
    const ok = await updateOrderTicketStatus(ticket.id, status);
    setUpdatingStatus(false);
    if (ok) {
      const updated = { ...ticket, status };
      setTicket(updated);
      onStatusChange?.(updated);
      setToastMsg({ type: "ok", text: "Status updated" });
    } else {
      setToastMsg({ type: "err", text: "Failed to update status" });
    }
    setTimeout(() => setToastMsg(null), 3000);
  };

  const attachmentUrls = useMemo((): string[] => {
    if (!ticket?.attachments_url) return [];
    if (Array.isArray(ticket.attachments_url)) return ticket.attachments_url;
    try { const p = JSON.parse(ticket.attachments_url as string); return Array.isArray(p) ? p : [ticket.attachments_url as string]; }
    catch { return [ticket.attachments_url as string]; }
  }, [ticket?.attachments_url]);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="w-5 h-5 text-violet-400 animate-spin" /></div>;
  }
  if (!ticket) {
    return <div className="flex-1 flex items-center justify-center"><p className="text-xs font-mono text-red-400">Failed to load ticket.</p></div>;
  }

  const assigneeName = ticket.assignee_details
    ? `${ticket.assignee_details.firstName ?? ""} ${ticket.assignee_details.lastName ?? ""}`.trim() || "Assigned"
    : null;

  return (
    <div className="flex-1 overflow-y-auto bg-[#06070a] min-w-0">
      {toastMsg && (
        <div className={`mx-5 mt-4 px-4 py-2.5 rounded-xl text-xs font-mono border ${
          toastMsg.type === "ok" ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-300" : "bg-red-500/15 border-red-500/25 text-red-300"
        }`}>{toastMsg.text}</div>
      )}

      <div className="p-5 space-y-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <button onClick={onClose} className="text-white/30 hover:text-white/60 transition">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <code className="text-violet-400 font-mono text-sm font-bold">#{ticket.ticket_id}</code>
              <StatusBadge status={ticket.status} />
            </div>
            <p className="text-[10px] font-mono text-white/30 ml-6">Raised {fmtDate(ticket.createdAt)}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {can("assign", "tickets") && (
              <button onClick={() => setInspectOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono border border-white/10 rounded-full text-white/40 hover:bg-white/5 hover:text-white transition">
                <ClipboardList className="w-3.5 h-3.5" />Inspect
              </button>
            )}
            {can("assign", "tickets") ? (
              <button onClick={() => setAssignOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono border border-violet-500/30 rounded-full text-violet-400 hover:bg-violet-500/10 transition">
                <UserPlus className="w-3.5 h-3.5" />{assigneeName ?? "Assign"}
              </button>
            ) : (
              assigneeName && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono border border-white/8 rounded-full text-white/30 bg-white/3">
                  <UserPlus className="w-3.5 h-3.5" />{assigneeName}
                </span>
              )
            )}
            <TicketStatusDropdown value={ticket.status} onChange={handleStatusChange} disabled={updatingStatus} />
          </div>
        </div>

        {/* Info */}
        <div className="bg-[#090b10] border border-white/5 rounded-xl p-4 space-y-2">
          <p className="text-[9px] font-bold text-white/25 uppercase tracking-widest mb-3">Ticket Information</p>
          {[
            { icon: Building2, label: "Client", value: ticket.client_name ?? ticket.client_id ?? "—" },
            { icon: User, label: "Raised By", value: ticket.user_name ?? ticket.user_id ?? "—" },
            ...(assigneeName ? [{ icon: UserPlus, label: "Assigned To", value: assigneeName }] : []),
            { icon: ShoppingCart, label: "Order", value: ticket.order_id, mono: true },
            { icon: Package, label: "Product", value: ticket.items?.[0]?.product_name ?? "—" },
          ].map(({ icon: Icon, label, value, mono }) => (
            <div key={label} className="flex items-center justify-between p-2.5 bg-white/3 rounded-lg">
              <div className="flex items-center gap-2 text-white/30 text-xs font-mono"><Icon className="w-3.5 h-3.5 shrink-0" />{label}</div>
              {mono
                ? <code className="text-[10px] font-mono text-white/55 truncate max-w-[180px]">{value}</code>
                : <span className="text-xs font-mono text-white/60 truncate max-w-[180px]">{value}</span>}
            </div>
          ))}
        </div>

        {/* Reason / desc */}
        {(ticket.reason || ticket.description) && (
          <div className="bg-[#090b10] border border-white/5 rounded-xl p-4 space-y-3">
            {ticket.reason && (
              <div>
                <p className="text-[9px] font-bold text-white/25 uppercase tracking-widest mb-1.5">Reason</p>
                <div className="text-xs font-mono text-white/50 leading-relaxed" dangerouslySetInnerHTML={{ __html: ticket.reason }} />
              </div>
            )}
            {ticket.description && (
              <div>
                <p className="text-[9px] font-bold text-white/25 uppercase tracking-widest mb-1.5">Description</p>
                <div className="text-xs font-mono text-white/50 leading-relaxed" dangerouslySetInnerHTML={{ __html: ticket.description }} />
              </div>
            )}
          </div>
        )}

        {/* Parts */}
        {ticket.parts && ticket.parts.length > 0 && (
          <div className="bg-[#090b10] border border-white/5 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/5">
              <p className="text-[9px] font-bold text-white/25 uppercase tracking-widest">Faulty Parts ({ticket.parts.length})</p>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {["Part Name", "Type", "Version"].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-[9px] font-mono font-bold text-white/25 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ticket.parts.map((p, i) => (
                  <tr key={i} className="border-b border-white/3 last:border-0 hover:bg-white/2">
                    <td className="px-4 py-2 text-xs font-mono font-medium text-white/70">{p.part_name}</td>
                    <td className="px-4 py-2 text-xs font-mono text-white/40">{p.part_type}</td>
                    <td className="px-4 py-2"><code className="text-[10px] font-mono text-white/30">{p.part_version ?? "—"}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Attachments */}
        {attachmentUrls.length > 0 && (
          <div className="bg-[#090b10] border border-white/5 rounded-xl p-4">
            <p className="text-[9px] font-bold text-white/25 uppercase tracking-widest mb-3">Attachments ({attachmentUrls.length})</p>
            <div className="grid grid-cols-3 gap-2">
              {attachmentUrls.map((url, i) => (
                <div key={i} onClick={() => setPreviewUrl(url)}
                  className="relative group cursor-pointer h-[90px] rounded-lg border border-white/8 bg-white/3 hover:border-violet-500/30 transition overflow-hidden flex items-center justify-center">
                  {/\.(png|jpe?g|gif|webp|svg)$/i.test(url)
                    ? <img src={url} alt="" className="w-full h-full object-cover" />
                    : <div className="flex flex-col items-center gap-1"><Eye className="w-4 h-4 text-white/20" /><span className="text-[8px] font-mono text-white/25 truncate px-1">{url.split("/").pop()}</span></div>
                  }
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition">
                    <Eye className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Attachment preview */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80"
          onClick={e => { if (e.target === e.currentTarget) setPreviewUrl(null); }}>
          <div className="bg-[#090b10] border border-white/8 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="h-10 shrink-0 border-b border-white/5 flex items-center justify-between px-4">
              <span className="text-[10px] font-mono text-white/40 truncate">{previewUrl.split("/").pop()}</span>
              <button onClick={() => setPreviewUrl(null)} className="text-white/30 hover:text-white"><X className="w-3.5 h-3.5" /></button>
            </div>
            <div className="flex-1 overflow-hidden">
              {/\.(png|jpe?g|gif|webp|svg)$/i.test(previewUrl)
                ? <img src={previewUrl} alt="Preview" className="w-full h-full object-contain p-4" />
                : <iframe src={previewUrl} className="w-full h-full border-0 bg-white" />}
            </div>
          </div>
        </div>
      )}

      {ticket && (
        <>
          <HappyCodeModal
            open={happyOpen}
            ticketId={ticket.id}
            onClose={() => setHappyOpen(false)}
            onVerify={async (code) => {
              const ok = await resolveOrderTicketWithCode(ticket.id, code);
              if (ok) {
                const u = { ...ticket, status: "resolved" };
                setTicket(u);
                onStatusChange?.(u);
              }
              return ok;
            }}
          />
          <AssignTechnicianDrawer isOpen={assignOpen} onClose={() => setAssignOpen(false)}
            ticketData={{
              id: ticket.id,
              orderId: ticket.order_id,
              productId: ticket.product_uuid || ticket.product_id || ticket.items?.[0]?.product_uuid || ticket.items?.[0]?.product_id || "",
              productUuid: ticket.product_uuid || ticket.items?.[0]?.product_uuid,
              designs: ticket.designs,
              title: ticket.reason || ticket.description || ticket.ticket_id,
              productName: ticket.items?.[0]?.product_name || ticket.product_id || "Product",
              faultyParts: ticket.parts?.map((p) => ({ id: p.design_uuid, name: p.part_name })) || [],
              assigneeId: ticket.assignee_details?.id || null,
            }}
            onAssigned={() => { setAssignOpen(false); fetchOrderTicketById(ticket.id).then(t => t && setTicket(t)); }} />
          <InspectionModal open={inspectOpen} ticket={ticket} onClose={() => setInspectOpen(false)} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function TicketsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { can } = useAbility();

  const [tickets, setTickets] = useState<OrderTicket[]>([]);
  const [meta, setMeta] = useState<OrderTicketMeta>({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (!authLoading && !user) router.replace("/"); }, [authLoading, user, router]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { items, meta: m } = await fetchTicketsPaginated({ page, limit: 20, search, orderBy: "createdAt", order: "DESC" });
    setTickets(items);
    setMeta(m);
    setLoading(false);
  }, [user, page, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setSearch(searchInput); setPage(1); }, 500);
  }, [searchInput]);

  if (authLoading) {
    return <div className="flex-1 flex items-center justify-center"><div className="w-5 h-5 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" /></div>;
  }

  const selectedSummary = tickets.find(t => t.id === selectedTicketId) ?? null;
  const visibleTickets = useMemo(() => {
    if (!searchInput.trim()) return tickets;
    return tickets.filter((t) => fuzzyAny([
      t.ticket_id,
      t.reason?.replace(/<[^>]*>/g, ""),
      t.description?.replace(/<[^>]*>/g, ""),
      t.client_name,
      t.order_id,
      t.items?.[0]?.product_name,
      t.assignee_details ? `${t.assignee_details.firstName ?? ""} ${t.assignee_details.lastName ?? ""}` : "",
      t.status,
    ], searchInput));
  }, [tickets, searchInput]);

  // ── DETAIL + CHAT VIEW ───────────────────────────────────────────────────
  if (selectedTicketId) {
    return (
      <div className="flex h-full overflow-hidden">
        {/* Left: full ticket details */}
        <TicketDetailPanel
          ticketId={selectedTicketId}
          onClose={() => setSelectedTicketId(null)}
          onStatusChange={updated =>
            setTickets(prev => prev.map(t => t.id === updated.id ? { ...t, status: updated.status } : t))
          }
        />

        {/* Right: chat panel */}
        <div className="w-[360px] shrink-0 border-l border-white/5 overflow-hidden flex flex-col">
          {selectedSummary ? (
            <InlineTicketChat
              ticket={selectedSummary}
              onClose={() => setSelectedTicketId(null)}
              onOpenDetail={() => router.push(`/tickets/${selectedTicketId}`)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-white/30" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="h-14 shrink-0 border-b border-white/5 flex items-center px-5 gap-3 bg-[#06070a]">
        <div className="flex items-center gap-2">
          <Ticket className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-mono font-bold text-white">Tickets</span>
          <span className="text-[10px] font-mono text-white/25">({meta.total})</span>
        </div>
        <div className="flex-1" />
        <div className="relative w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20 pointer-events-none" />
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search tickets…"
            className="w-full bg-white/3 border border-white/8 text-white text-xs font-mono pl-8 pr-7 py-2 rounded-lg focus:outline-none focus:border-violet-500/40 placeholder:text-white/20" />
          {searchInput && (
            <button onClick={() => setSearchInput("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        {can("add", "tickets") && (
          <button onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition">
            <Plus className="w-3.5 h-3.5" />New Ticket
          </button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="rounded-xl border border-white/5 bg-[#090b10] p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="mb-3 grid grid-cols-[120px_1fr_130px_130px_110px] gap-4 last:mb-0">
                <div className="h-4 rounded bg-white/5" />
                <div className="h-4 rounded bg-white/5" />
                <div className="h-4 rounded bg-white/5" />
                <div className="h-4 rounded bg-white/5" />
                <div className="h-4 rounded bg-white/5" />
              </div>
            ))}
          </div>
        )}

        {!loading && visibleTickets.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-24 text-center">
            <Ticket className="w-10 h-10 text-white/10 mb-3" />
            <p className="text-sm font-mono text-white/25">{searchInput ? `No tickets matching "${searchInput}"` : "No tickets yet"}</p>
          </div>
        )}

        {!loading && visibleTickets.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-white/5 bg-[#090b10]">
            <div className="grid grid-cols-[130px_minmax(260px,1.4fr)_minmax(160px,0.8fr)_120px_140px_110px] border-b border-white/5 bg-white/[0.03] px-4 py-3 text-[9px] font-mono font-bold uppercase tracking-widest text-white/25">
              <span>Ticket</span>
              <span>Issue</span>
              <span>Product</span>
              <span>Status</span>
              <span>Assignee</span>
              <span className="text-right">Created</span>
            </div>
            {visibleTickets.map(t => {
              const title = (t.reason ?? "Support Request").replace(/<[^>]*>/g, "").slice(0, 100);
              const productName = t.items?.[0]?.product_name;
              const assigneeName = t.assignee_details
                ? `${t.assignee_details.firstName ?? ""} ${t.assignee_details.lastName ?? ""}`.trim() : null;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTicketId(t.id)}
                  className="grid w-full grid-cols-[130px_minmax(260px,1.4fr)_minmax(160px,0.8fr)_120px_140px_110px] items-center gap-4 border-b border-white/5 px-4 py-3 text-left transition last:border-0 hover:bg-violet-500/5"
                >
                  <code className="text-[10px] font-mono font-semibold text-violet-400">{t.ticket_id}</code>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-mono text-white/70">{title}</p>
                    <p className="mt-1 truncate text-[10px] font-mono text-white/30">{t.client_name ?? t.order_id}</p>
                  </div>
                  <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-mono text-white/40">
                    <Package className="h-3 w-3 shrink-0" />
                    <span className="truncate">{productName ?? "—"}</span>
                  </div>
                  <StatusBadge status={t.status} />
                  <span className="truncate text-[10px] font-mono text-white/35">{assigneeName ?? "Unassigned"}</span>
                  <span className="text-right text-[10px] font-mono text-white/30">{timeAgo(t.createdAt)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="h-11 shrink-0 border-t border-white/5 flex items-center justify-between px-4 bg-[#06070a]">
          <span className="text-[10px] font-mono text-white/25">{page} / {meta.totalPages}</span>
          <div className="flex items-center gap-1">
            <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}
              className="w-6 h-6 flex items-center justify-center rounded border border-white/8 text-white/30 hover:bg-white/5 disabled:opacity-30">
              <ChevronLeft className="w-3 h-3" />
            </button>
            <button disabled={page >= meta.totalPages} onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
              className="w-6 h-6 flex items-center justify-center rounded border border-white/8 text-white/30 hover:bg-white/5 disabled:opacity-30">
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      <AddTicketDrawer isOpen={addOpen} onClose={() => setAddOpen(false)} onCreated={load} />
    </div>
  );
}
