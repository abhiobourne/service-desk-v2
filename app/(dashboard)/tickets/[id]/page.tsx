"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  UserPlus, ClipboardList, Building2, User, Ticket,
  ShoppingCart, Package, FileText, FileCode, FileType, File as FileIcon,
  Eye, Download, Search, Image as ImageIcon, Loader2, ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  fetchOrderTicketById, updateOrderTicketStatus, resolveOrderTicketWithCode,
  OrderTicket,
} from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { useAbility } from "@/providers/AbilityProvider";
import { TicketStatusDropdown } from "@/components/tickets/TicketStatusDropdown";
import { HappyCodeModal } from "@/components/tickets/HappyCodeModal";
import { AssignTechnicianDrawer } from "@/components/tickets/AssignTechnicianDrawer";
import { InlineTicketChat } from "@/components/tickets/InlineTicketChat";
import { InspectionModal } from "@/components/tickets/InspectionModal";
import { PageHeader } from "@/components/ui/PageHeader";

function getFileTypeInfo(url: string) {
  const ext = url.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf")              return { Icon: FileText, label: "PDF",  bg: "bg-red-500/10",    ic: "text-red-400",    badge: "bg-red-500/15 border-red-500/25 text-red-300"    };
  if (ext === "doc" || ext === "docx") return { Icon: FileText, label: "DOC",  bg: "bg-blue-500/10",   ic: "text-blue-400",   badge: "bg-blue-500/15 border-blue-500/25 text-blue-300"   };
  if (ext === "md" || ext === "markdown") return { Icon: FileCode, label: "MD",  bg: "bg-violet-500/10", ic: "text-violet-400", badge: "bg-violet-500/15 border-violet-500/25 text-violet-300" };
  if (ext === "txt")              return { Icon: FileType, label: "TXT",  bg: "bg-white/5",       ic: "text-white/30",   badge: "bg-white/5 border-white/10 text-white/30"         };
  return { Icon: FileIcon, label: ext.toUpperCase() || "FILE", bg: "bg-white/5", ic: "text-white/30", badge: "bg-white/5 border-white/10 text-white/30" };
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

function PartsTable({ parts }: { parts: NonNullable<OrderTicket["parts"]> }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 5;
  const filtered = useMemo(() => {
    if (!search.trim()) return parts;
    const q = search.toLowerCase();
    return parts.filter((p) => p.part_name?.toLowerCase().includes(q) || p.part_type?.toLowerCase().includes(q));
  }, [parts, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="bg-[#090b10] border border-white/5 rounded-xl overflow-hidden">
      <div className="p-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-mono font-semibold text-white/70">Faulty Parts</h3>
            <span className="text-[10px] font-mono text-white/25">{parts.length} parts</span>
          </div>
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20 pointer-events-none" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search parts…"
              className="w-full bg-white/3 border border-white/8 text-white text-[10px] font-mono pl-7 pr-3 py-2 rounded-lg focus:outline-none focus:border-violet-500/40 placeholder:text-white/20" />
          </div>
        </div>
        {parts.length === 0 ? (
          <div className="flex items-center justify-center h-16 text-xs font-mono text-white/25">No faulty parts reported.</div>
        ) : (
          <>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-white/5">
                  {["Part Name", "Type", "Version", "View"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[9px] font-mono font-bold text-white/25 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slice.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-8 text-center text-[10px] font-mono text-white/25">No results for &ldquo;{search}&rdquo;</td></tr>
                ) : slice.map((p, i) => (
                  <tr key={i} className="border-b border-white/3 last:border-0 hover:bg-white/2">
                    <td className="px-3 py-2.5 text-xs font-mono font-medium text-white/70">{p.part_name}</td>
                    <td className="px-3 py-2.5 text-xs font-mono text-white/40">{p.part_type}</td>
                    <td className="px-3 py-2.5"><code className="text-[10px] font-mono text-white/30">{p.part_version ?? "—"}</code></td>
                    <td className="px-3 py-2.5">
                      {p.troubleshooting_url
                        ? <a
                            href={p.troubleshooting_url.replace(/https?:\/\/(localhost|127\.0\.0\.1):\d+/, typeof window !== "undefined" ? window.location.origin : "").replace("/troubleshooting/", "/diagnostics/troubleshooting/")}
                            target="_blank" rel="noreferrer"
                            className="text-[10px] font-mono text-violet-400 hover:text-violet-300"
                          >View →</a>
                        : <span className="text-white/15 text-[10px] font-mono">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3">
                <span className="text-[9px] font-mono text-white/20">Page {page} of {totalPages}</span>
                <div className="flex gap-1">
                  <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="w-6 h-6 flex items-center justify-center rounded border border-white/8 text-white/25 hover:bg-white/5 disabled:opacity-30 transition"><ChevronLeft className="w-3 h-3" /></button>
                  <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="w-6 h-6 flex items-center justify-center rounded border border-white/8 text-white/25 hover:bg-white/5 disabled:opacity-30 transition"><ChevronRight className="w-3 h-3" /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function TicketDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const { can, isClient } = useAbility();

  const [ticket, setTicket] = useState<OrderTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [happyOpen, setHappyOpen] = useState(false);
  const [inspectOpen, setInspectOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const mdRef = useRef<HTMLDivElement>(null);
  const docxRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const t = await fetchOrderTicketById(id);
    if (!t) setError(true);
    else setTicket(t);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [id, user]);

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
      } catch { if (!cancelled && mdRef.current) mdRef.current.innerHTML = "<p style='color:#666;padding:16px'>Preview failed.</p>"; }
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
        setTimeout(async () => { if (docxRef.current) { docxRef.current.innerHTML = ""; await renderAsync(buf, docxRef.current); } }, 100);
      } catch { if (docxRef.current) docxRef.current.innerHTML = "<p style='color:#666;padding:16px'>Preview failed.</p>"; }
    })();
  }, [previewUrl]);

  const renderPreview = (url: string) => {
    if (/\.(png|jpe?g|gif|webp|svg)$/i.test(url)) return <img src={url} alt="Attachment" className="max-w-full max-h-full object-contain rounded" />;
    if (/\.pdf$/i.test(url)) return <iframe src={url} className="w-full h-full rounded border-0 bg-white" />;
    if (/\.(md|markdown)$/i.test(url)) return <div ref={mdRef} className="w-full h-full overflow-auto bg-[#0c0e16] p-6 text-xs font-mono text-white/60 leading-relaxed prose prose-invert prose-sm max-w-none">Loading…</div>;
    if (/\.(doc|docx)$/i.test(url)) return <div ref={docxRef} className="w-full h-full overflow-auto bg-white p-6 text-[13px] text-slate-800">Loading document…</div>;
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

  const attachmentUrls = useMemo((): string[] => {
    if (!ticket?.attachments_url) return [];
    if (Array.isArray(ticket.attachments_url)) return ticket.attachments_url;
    try { const p = JSON.parse(ticket.attachments_url); return Array.isArray(p) ? p : [ticket.attachments_url]; }
    catch { return [ticket.attachments_url as string]; }
  }, [ticket?.attachments_url]);

  const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#06070a]">
        <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#06070a]">
        <div className="text-center">
          <p className="text-sm font-mono text-red-400">Failed to load ticket.</p>
          <button onClick={() => router.back()} className="mt-4 text-xs font-mono text-white/40 hover:text-white/70 transition">Go back</button>
        </div>
      </div>
    );
  }

  const assigneeName = ticket.assignee_details ? `${ticket.assignee_details.firstName ?? ""} ${ticket.assignee_details.lastName ?? ""}`.trim() || "Assigned" : null;

  const TICKET_STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
    open:        { bg: "bg-blue-500/15",    text: "text-blue-400",    label: "Open" },
    resolved:    { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Resolved" },
    in_progress: { bg: "bg-amber-500/15",   text: "text-amber-400",   label: "In Progress" },
    closed:      { bg: "bg-slate-500/15",   text: "text-slate-400",   label: "Closed" },
  };
  const sb = TICKET_STATUS_BADGE[ticket.status] ?? { bg: "bg-white/10", text: "text-white/50", label: ticket.status };

  return (
    <div className="flex h-full overflow-hidden bg-[#06070a] text-white">
      {/* Left: ticket details */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* ── Header ── */}
        <PageHeader
          breadcrumbs={[
            { label: "Dashboard", href: "/" },
            { label: "Tickets", href: "/tickets" },
            { label: ticket.ticket_id },
          ]}
          backHref="/tickets"
          icon={<Ticket className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
          iconClassName="bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20"
          title={
            <>
              <span className="font-mono">{ticket.ticket_id}</span>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide ${sb.bg} ${sb.text}`}>
                {sb.label}
              </span>
            </>
          }
          subtitle={`Raised on ${fmtDate(ticket.createdAt)}`}
          right={
            <>
              {can("assign", "tickets") && (
                <button onClick={() => setInspectOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono border border-slate-200 dark:border-white/10 rounded-full text-slate-500 dark:text-white/40 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white transition">
                  <ClipboardList className="w-3.5 h-3.5" />Inspections
                </button>
              )}
              {can("assign", "tickets") ? (
                <button onClick={() => setAssignOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono border border-violet-500/30 rounded-full text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition">
                  <UserPlus className="w-3.5 h-3.5" />
                  {assigneeName ?? "Assign Technician"}
                </button>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono border border-slate-200 dark:border-white/8 rounded-full text-slate-400 dark:text-white/30 bg-slate-50 dark:bg-white/3">
                  <UserPlus className="w-3.5 h-3.5" />
                  {assigneeName ?? "Unassigned"}
                </span>
              )}
              <TicketStatusDropdown value={ticket.status} onChange={handleStatusChange} disabled={updatingStatus || isClient} />
            </>
          }
        />

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">

          {/* 2-col body */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5">
            {/* Left — Info */}
            <div className="bg-[#090b10] border border-white/5 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-mono font-semibold text-white/70">Ticket Information</h3>
              <div className="space-y-2">
                {[
                  { icon: Building2, label: "Client", value: ticket.client_name ?? ticket.client_id ?? "—" },
                  { icon: User, label: "Raised By", value: ticket.user_name ?? ticket.user_id ?? "—" },
                  ...(assigneeName ? [{ icon: UserPlus, label: "Assigned To", value: assigneeName }] : []),
                  { icon: ShoppingCart, label: "Order", value: ticket.order_id, mono: true },
                  { icon: Package, label: "Product", value: ticket.items?.[0]?.product_name ?? "—" },
                ].map(({ icon: Icon, label, value, mono }) => (
                  <div key={label} className="flex items-center justify-between p-3 bg-white/3 rounded-lg">
                    <div className="flex items-center gap-2 text-white/35 text-xs font-mono">
                      <Icon className="w-3.5 h-3.5 shrink-0" />{label}
                    </div>
                    {mono
                      ? <code className="text-[11px] font-mono text-white/55 truncate max-w-[220px]">{value}</code>
                      : <span className="text-xs font-mono font-medium text-white/65 truncate max-w-[220px]">{value}</span>}
                  </div>
                ))}
              </div>

              {(ticket.reason || ticket.description) && (
                <div className="pt-4 border-t border-white/5 space-y-3">
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
              {!ticket.reason && !ticket.description && (
                <p className="text-xs font-mono text-white/20 pt-2 border-t border-white/5">No description provided.</p>
              )}
            </div>

            {/* Right — Attachments */}
            <div className="bg-[#090b10] border border-white/5 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-mono font-semibold text-white/70">Attachments</h3>
              {attachmentUrls.length > 0 ? (
                <div className="overflow-y-auto max-h-[320px] pr-1">
                  <div className="grid grid-cols-2 gap-2">
                    {attachmentUrls.map((url, i) => {
                      const isImage = /\.(png|jpe?g|gif|webp|svg)$/i.test(url);
                      const fileName = url.split("/").pop() ?? `attachment-${i + 1}`;
                      return (
                        <div key={i} onClick={() => setPreviewUrl(url)}
                          className="relative group cursor-pointer h-[150px] rounded-lg border border-white/8 bg-white/3 hover:border-violet-500/30 transition overflow-hidden flex items-center justify-center">
                          {isImage ? (
                            <img src={url} alt={`Attachment ${i + 1}`} className="w-full h-full object-cover" />
                          ) : (() => {
                            const { Icon, label, bg, ic, badge } = getFileTypeInfo(url);
                            return (
                              <div className={`flex flex-col items-center justify-center gap-2 w-full h-full p-3 ${bg}`}>
                                <Icon className={`w-7 h-7 ${ic}`} />
                                <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border ${badge}`}>{label}</span>
                                <span className="text-[9px] font-mono text-white/30 truncate w-full text-center px-1">{fileName}</span>
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
                <div className="flex flex-col items-center justify-center h-[300px] rounded-lg border border-dashed border-white/8 bg-white/2 gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-white/15" />
                  </div>
                  <p className="text-xs font-mono text-white/25">No attachments</p>
                </div>
              )}
            </div>
          </div>

          {/* Faulty Parts */}
          <PartsTable parts={ticket.parts ?? []} />
        </div>
        </div>
        </div>

        {/* Attachment preview modal */}
        {previewUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.8)" }} onClick={(e) => { if (e.target === e.currentTarget) setPreviewUrl(null); }}>
            <div className="bg-[#090b10] border border-white/8 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="h-12 shrink-0 border-b border-white/5 flex items-center justify-between px-4">
                <span className="text-xs font-mono text-white/50 truncate flex-1">{previewUrl.split("/").pop()}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => downloadFile(previewUrl, previewUrl.split("/").pop() ?? "attachment")}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono text-white/40 border border-white/10 rounded hover:bg-white/5 hover:text-white transition">
                    <Download className="w-3 h-3" />Download
                  </button>
                  <button onClick={() => setPreviewUrl(null)} className="text-white/30 hover:text-white/70 transition p-1"><span className="text-lg">×</span></button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden flex items-center justify-center bg-[#06070a] p-4 min-h-[400px]">
                {renderPreview(previewUrl)}
              </div>
            </div>
          </div>
        )}

      {/* Right: inline chat */}
      <div className="w-[360px] shrink-0 border-l border-white/5 overflow-hidden flex flex-col">
        <InlineTicketChat
          ticket={ticket}
          onClose={() => router.push("/tickets")}
        />
      </div>

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
          id: ticket.id,
          orderId: ticket.order_id,
          productId: ticket.product_uuid ?? ticket.product_id ?? "",
          productUuid: ticket.product_uuid ?? "",
          designs: ticket.designs as any,
          title: ticket.reason ?? "Support Request",
          productName: ticket.items?.[0]?.product_name ?? "General Product",
          faultyParts: ticket.parts?.map((p) => ({ id: p.design_uuid, name: p.part_name })) ?? [],
          assigneeId: ticket.assignee_details?.id,
        }}
        onAssigned={load}
      />

      <InspectionModal
        open={inspectOpen}
        onClose={() => setInspectOpen(false)}
        ticket={ticket}
      />
    </div>
  );
}
