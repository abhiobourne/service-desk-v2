"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Plus, Trash2, Paperclip, X, ChevronDown, Loader2, ClipboardList, Search, CheckCircle2, XCircle } from "lucide-react";
import {
  fetchTicketInspections, createTicketInspection, fetchDesignTreeById,
  TicketInspectionRecord, OrderTicket, DesignTreeNode,
} from "../../lib/api";

type InspectionAction = "resolve" | "repair" | "replace" | "hold" | "forward_to_admin";

interface InspectionRowDraft {
  _id: string;
  part_design_uuid: string;
  part_name: string;
  part_type?: string | null;
  inspection: string;
  result: string;
  action: InspectionAction | "";
  notes: string;
  files: File[];
  isSeeded: boolean;
}

const RESULT_OPTIONS = [{ value: "pass", label: "Pass" }, { value: "fail", label: "Fail" }];
const ACTION_OPTIONS: { value: InspectionAction; label: string }[] = [
  { value: "resolve", label: "Resolve" },
  { value: "repair", label: "Repair" },
  { value: "replace", label: "Replace" },
  { value: "hold", label: "Hold" },
];
const VALUE_STYLE: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  pass:    { bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/30", dot: "bg-emerald-500" },
  fail:    { bg: "bg-red-500/15",     text: "text-red-300",     border: "border-red-500/30",     dot: "bg-red-500"     },
  resolve: { bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/30", dot: "bg-emerald-500" },
  repair:  { bg: "bg-amber-500/15",   text: "text-amber-300",   border: "border-amber-500/30",   dot: "bg-amber-500"   },
  replace: { bg: "bg-blue-500/15",    text: "text-blue-300",    border: "border-blue-500/30",    dot: "bg-blue-500"    },
  hold:    { bg: "bg-orange-500/15",  text: "text-orange-300",  border: "border-orange-500/30",  dot: "bg-orange-500"  },
};

function newRow(): InspectionRowDraft {
  return { _id: crypto.randomUUID(), part_design_uuid: "", part_name: "", part_type: null, inspection: "", result: "", action: "", notes: "", files: [], isSeeded: false };
}
function isDirty(r: InspectionRowDraft) { return !!(r.inspection || r.result || r.action || r.notes || r.files.length); }
function isComplete(r: InspectionRowDraft) {
  if (!r.inspection || !r.result || !r.action) return false;
  if (r.action === "hold" && !r.notes.trim()) return false;
  return true;
}
function flattenTree(node: DesignTreeNode, d = 0): Array<{ node: DesignTreeNode; depth: number }> {
  return [{ node, depth: d }, ...(node.children ?? []).flatMap((c) => flattenTree(c, d + 1))];
}
function initials(n?: string | null) { if (!n) return "?"; return n.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join(""); }

function ColoredSelect<T extends string>({ value, onChange, options, placeholder, hasError }: {
  value: T | ""; onChange: (v: T | "") => void;
  options: { value: T; label: string }[]; placeholder: string; hasError: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const style = value ? VALUE_STYLE[value] : null;
  const sel = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!(e.target as Element).closest("[data-cs]")) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <>
      <button ref={ref} type="button" data-cs="" onClick={() => { setRect(ref.current?.getBoundingClientRect() ?? null); setOpen((v) => !v); }}
        className={`w-full flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg border text-[10px] font-mono font-semibold transition-all ${style ? `${style.bg} ${style.border} ${style.text}` : hasError ? "border-red-500/30 bg-red-500/10 text-red-400/60" : "border-white/8 bg-white/3 text-white/30 hover:border-white/15"}`}>
        <span className="flex items-center gap-1 min-w-0">
          {style && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />}
          <span className="truncate">{sel?.label ?? placeholder}</span>
        </span>
        <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${open ? "rotate-180" : ""} ${style ? style.text : "text-white/20"}`} />
      </button>
      {open && rect && createPortal(
        <div data-cs="" style={{ position: "fixed", top: rect.bottom + 4, left: rect.left, minWidth: Math.max(rect.width, 140), zIndex: 9999 }}
          className="bg-[#0c0e16] border border-white/10 rounded-xl shadow-2xl py-1 overflow-hidden">
          {options.map((o) => {
            const s = VALUE_STYLE[o.value];
            return (
              <button key={o.value} type="button" data-cs="" onClick={() => { onChange(o.value as T); setOpen(false); }}
                className={`w-full text-left flex items-center gap-2 px-3 py-2 text-[10px] font-mono transition-colors ${value === o.value ? (s ? `${s.bg} ${s.text} font-bold` : "bg-white/5 text-white") : "text-white/50 hover:bg-white/5"}`}>
                {s && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />}
                {o.label}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}

// Past inspection timeline
function PastInspections({ records, productName }: { records: TicketInspectionRecord[]; productName?: string | null }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const grouped = useMemo(() => {
    const map: Record<string, TicketInspectionRecord[]> = {};
    records.forEach((r) => {
      const bucket = Math.floor(new Date(r.createdAt).getTime() / 60000);
      const key = `${r.inspected_by}__${bucket}`;
      (map[key] ??= []).push(r);
    });
    return Object.entries(map).sort(([, a], [, b]) => new Date(b[0].createdAt).getTime() - new Date(a[0].createdAt).getTime());
  }, [records]);
  if (!grouped.length) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-0.5 h-4 rounded-full bg-violet-500" />
        <span className="text-xs font-mono font-semibold text-white/60">Past Inspections</span>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-white/5 border border-white/8 text-white/30">{grouped.length}</span>
        {productName && <span className="ml-auto text-[10px] font-mono text-white/25 bg-white/3 border border-white/5 px-2 py-0.5 rounded-full truncate max-w-40">{productName}</span>}
      </div>
      <div className="space-y-1.5">
        {grouped.map(([key, group]) => {
          const isOpen = expanded === key;
          const inspector = group[0].inspector_name ?? group[0].inspected_by ?? "Unknown";
          const d = new Date(group[0].createdAt);
          const passCount = group.filter((r) => r.result === "pass").length;
          const failCount = group.filter((r) => r.result === "fail").length;
          return (
            <div key={key} className={`rounded-lg border overflow-hidden ${isOpen ? "border-white/15" : "border-white/8"}`}>
              <button type="button" onClick={() => setExpanded(isOpen ? null : key)}
                className="w-full flex items-center justify-between px-4 py-3 bg-white/3 hover:bg-white/5 transition text-left">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-violet-300">{initials(inspector)}</span>
                  </div>
                  <div>
                    <p className="text-xs font-mono font-semibold text-white/70">{inspector}</p>
                    <p className="text-[10px] font-mono text-white/30 mt-0.5">
                      {d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} · {d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {passCount > 0 && <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-[9px] font-mono text-emerald-400"><CheckCircle2 className="w-2.5 h-2.5" />{passCount}</span>}
                  {failCount > 0 && <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/25 text-[9px] font-mono text-red-400"><XCircle className="w-2.5 h-2.5" />{failCount}</span>}
                  {!passCount && !failCount && <span className="text-[9px] font-mono bg-white/5 border border-white/8 text-white/30 px-1.5 py-0.5 rounded-full">{group.length} parts</span>}
                  <ChevronDown className={`w-3.5 h-3.5 text-white/25 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </div>
              </button>
              {isOpen && (
                <div className="overflow-x-auto border-t border-white/5">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-white/3">
                        {["Part", "Inspection", "Result", "Action", "Notes", "Attachments"].map((h) => (
                          <th key={h} className="px-3 py-2 text-[9px] font-mono font-bold text-white/25 uppercase tracking-widest border-b border-white/5">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.map((r) => {
                        const rs = VALUE_STYLE[r.result];
                        const as_ = VALUE_STYLE[r.action];
                        return (
                          <tr key={r.id} className="border-b border-white/5 last:border-0 hover:bg-white/2">
                            <td className="px-3 py-2.5 text-[10px] font-mono text-white/60">{r.part_name ?? "—"}</td>
                            <td className="px-3 py-2.5 text-[10px] font-mono text-white/50 max-w-[180px]"><p className="whitespace-pre-wrap leading-relaxed">{r.inspection}</p></td>
                            <td className="px-3 py-2.5">
                              {rs ? <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold ${rs.bg} ${rs.text} ${rs.border}`}><span className={`w-1 h-1 rounded-full ${rs.dot}`} />{r.result}</span> : <span className="text-white/25">—</span>}
                            </td>
                            <td className="px-3 py-2.5">
                              {as_ ? <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold ${as_.bg} ${as_.text} ${as_.border}`}><span className={`w-1 h-1 rounded-full ${as_.dot}`} />{r.action}</span> : <span className="text-white/25">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-[10px] font-mono text-white/40 max-w-[120px]"><p className="whitespace-pre-wrap">{r.notes ?? "—"}</p></td>
                            <td className="px-3 py-2.5">
                              {r.attachments_url?.length ? (
                                <div className="flex flex-col gap-0.5">
                                  {r.attachments_url.map((u, i) => (
                                    <a key={i} href={u} target="_blank" rel="noreferrer" className="text-[9px] font-mono text-violet-400 hover:text-violet-300 flex items-center gap-0.5 truncate max-w-[90px]">
                                      <Paperclip className="w-2.5 h-2.5 shrink-0" />
                                      {u.split("/").pop()}
                                    </a>
                                  ))}
                                </div>
                              ) : <span className="text-white/20 text-[10px] font-mono">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Editable table row
function EditableRow({ row, index, hasError, parts, partsLoading, onChange, onRemove }: {
  row: InspectionRowDraft; index: number; hasError: boolean;
  parts: Array<{ uuid: string; name: string; type?: string | null; depth: number }>; partsLoading: boolean;
  onChange: (id: string, patch: Partial<InspectionRowDraft>) => void;
  onRemove: (id: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [partOpen, setPartOpen] = useState(false);
  const [partSearch, setPartSearch] = useState("");
  const partRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!partOpen) return;
    const h = (e: MouseEvent) => { if (partRef.current && !partRef.current.contains(e.target as Node)) { setPartOpen(false); setPartSearch(""); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [partOpen]);

  const filteredParts = useMemo(() => {
    if (!partSearch) return parts;
    const q = partSearch.toLowerCase();
    return parts.filter((p) => p.name.toLowerCase().includes(q));
  }, [parts, partSearch]);

  const selectedPart = parts.find((p) => p.uuid === row.part_design_uuid);
  const isRowError = hasError && isDirty(row) && !isComplete(row);
  const noteRequired = row.action === "hold";

  return (
    <tr className={`border-b border-white/5 last:border-0 ${isRowError ? "bg-red-500/5" : "hover:bg-white/2"}`}>
      <td className={`w-0.5 p-0 ${isRowError ? "bg-red-400" : row.isSeeded ? "bg-violet-500/40" : "bg-transparent"}`} />
      <td className="px-2 py-2.5 text-center w-7 border-r border-white/5">
        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/5 text-[9px] font-bold text-white/30">{index + 1}</span>
      </td>
      <td className="px-2 py-2.5 min-w-[160px] border-r border-white/5 align-top">
        {row.isSeeded ? (
          <div>
            <p className="text-[10px] font-mono font-semibold text-white/70">{row.part_name}</p>
            {row.part_type && <span className="text-[9px] font-mono text-white/30 mt-0.5">{row.part_type}</span>}
          </div>
        ) : (
          <div ref={partRef} className="relative">
            {selectedPart ? (
              <div className="flex items-start gap-1 justify-between">
                <div>
                  <p className="text-[10px] font-mono font-semibold text-white/70 leading-tight">{selectedPart.name}</p>
                  {selectedPart.type && <span className="text-[9px] font-mono text-white/30">{selectedPart.type}</span>}
                </div>
                <button type="button" onClick={() => onChange(row._id, { part_design_uuid: "", part_name: "", part_type: null })} className="text-white/20 hover:text-red-400 transition shrink-0 mt-0.5"><X className="w-3 h-3" /></button>
              </div>
            ) : (
              <button type="button" onClick={() => !partsLoading && setPartOpen(true)} disabled={partsLoading}
                className={`w-full text-left text-[10px] font-mono px-2 py-1.5 rounded border transition flex items-center gap-1 ${hasError && !row.part_design_uuid ? "border-red-500/30 bg-red-500/10 text-red-400/60" : "border-white/8 bg-white/3 text-white/30 hover:border-violet-500/30 hover:bg-violet-500/5"} disabled:opacity-40`}>
                {partsLoading ? <><Loader2 className="w-3 h-3 animate-spin" />Loading…</> : <><Search className="w-3 h-3" />Select part…</>}
              </button>
            )}
            {partOpen && (
              <div className="absolute z-50 top-full left-0 mt-1 w-[260px] bg-[#0c0e16] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                <div className="p-2 border-b border-white/5">
                  <input placeholder="Search…" value={partSearch} onChange={(e) => setPartSearch(e.target.value)} autoFocus
                    className="w-full text-[10px] font-mono px-2 py-1.5 rounded border border-white/8 bg-white/3 text-white focus:outline-none focus:border-violet-500/40 placeholder:text-white/20" />
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {filteredParts.length === 0 ? <p className="text-[10px] font-mono text-white/25 text-center py-5">No parts</p> : (
                    filteredParts.map((p) => (
                      <button key={p.uuid} type="button" style={{ paddingLeft: p.depth * 12 + 10 }}
                        onClick={() => { onChange(row._id, { part_design_uuid: p.uuid, part_name: p.name, part_type: p.type ?? null }); setPartOpen(false); setPartSearch(""); }}
                        className="w-full text-left pr-3 py-2 border-b border-white/3 last:border-0 hover:bg-white/5 cursor-pointer">
                        <span className="text-[10px] font-mono text-white/60">{p.name}</span>
                        {p.type && <span className="text-[9px] font-mono text-white/25 ml-1.5">{p.type}</span>}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </td>
      <td className="px-2 py-2.5 min-w-[160px] border-r border-white/5 align-top">
        <textarea rows={3} placeholder="Steps / checks…" value={row.inspection} onChange={(e) => onChange(row._id, { inspection: e.target.value })}
          className={`w-full text-[10px] font-mono bg-transparent border-0 focus:outline-none resize-none leading-relaxed ${hasError && !row.inspection.trim() ? "placeholder:text-red-400/40" : "placeholder:text-white/15"} text-white/60`} />
      </td>
      <td className="px-2 py-2.5 w-[120px] border-r border-white/5 align-top">
        <ColoredSelect value={row.result} onChange={(v) => onChange(row._id, { result: v })} options={RESULT_OPTIONS} placeholder="Result" hasError={hasError} />
      </td>
      <td className="px-2 py-2.5 w-[130px] border-r border-white/5 align-top">
        <ColoredSelect value={row.action as any} onChange={(v) => onChange(row._id, { action: v as InspectionAction | "" })} options={ACTION_OPTIONS} placeholder="Action" hasError={hasError} />
      </td>
      <td className={`px-2 py-2.5 min-w-[120px] border-r border-white/5 align-top ${noteRequired ? "bg-orange-500/5" : ""}`}>
        {noteRequired && <p className="text-[8px] font-bold text-orange-400 uppercase tracking-widest mb-1">Required</p>}
        <textarea rows={3} placeholder={noteRequired ? "Hold reason…" : "Notes…"} value={row.notes} onChange={(e) => onChange(row._id, { notes: e.target.value })}
          className={`w-full text-[10px] font-mono bg-transparent border-0 focus:outline-none resize-none leading-relaxed ${noteRequired && hasError && !row.notes.trim() ? "placeholder:text-orange-400/50" : "placeholder:text-white/15"} text-white/60`} />
      </td>
      <td className="px-2 py-2.5 w-[100px] border-r border-white/5 align-top">
        <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { const picked = Array.from(e.target.files ?? []); if (picked.length) onChange(row._id, { files: [...row.files, ...picked] }); if (fileRef.current) fileRef.current.value = ""; }} />
        <div className="flex flex-col gap-0.5">
          {row.files.map((f, i) => (
            <div key={i} className="flex items-center gap-1 bg-violet-500/10 border border-violet-500/20 rounded px-1 py-0.5">
              <Paperclip className="w-2 h-2 text-violet-400 shrink-0" />
              <span className="text-[9px] font-mono text-violet-300 truncate flex-1">{f.name}</span>
              <button type="button" onClick={() => onChange(row._id, { files: row.files.filter((_, j) => j !== i) })} className="text-violet-300/40 hover:text-red-400 transition shrink-0"><X className="w-2 h-2" /></button>
            </div>
          ))}
          <button type="button" onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-0.5 px-1.5 py-1 rounded border border-dashed border-white/8 text-white/25 hover:border-violet-500/40 hover:text-violet-400 transition text-[9px] font-mono justify-center">
            <Paperclip className="w-2 h-2" />{row.files.length > 0 ? "More" : "Attach"}
          </button>
        </div>
      </td>
      <td className="px-1.5 py-2.5 w-7 text-center align-top">
        {!row.isSeeded ? (
          <button type="button" onClick={() => onRemove(row._id)} className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-500/10 text-white/15 hover:text-red-400 transition mx-auto">
            <Trash2 className="w-3 h-3" />
          </button>
        ) : <div className="w-5 h-5" />}
      </td>
    </tr>
  );
}

interface InspectionModalProps {
  open: boolean;
  onClose: () => void;
  ticket: OrderTicket | null | undefined;
}

export function InspectionModal({ open, onClose, ticket }: InspectionModalProps) {
  const [rows, setRows] = useState<InspectionRowDraft[]>([]);
  const [past, setPast] = useState<TicketInspectionRecord[]>([]);
  const [loadingPast, setLoadingPast] = useState(false);
  const [validated, setValidated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [designTrees, setDesignTrees] = useState<DesignTreeNode[]>([]);
  const [loadingParts, setLoadingParts] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!open || !ticket) { setValidated(false); return; }
    setRows((ticket.parts ?? []).map((p) => ({ _id: crypto.randomUUID(), part_design_uuid: p.design_uuid, part_name: p.part_name, part_type: p.part_type ?? null, inspection: "", result: "", action: "", notes: "", files: [], isSeeded: true })));
    setLoadingPast(true);
    fetchTicketInspections(ticket.id).then((r) => { setPast(r); setLoadingPast(false); });
    const treeIds = (ticket.designs ?? []).map((d) => d.tree_id).filter(Boolean).slice(0, 3) as string[];
    if (treeIds.length) {
      setLoadingParts(true);
      Promise.all(treeIds.map(fetchDesignTreeById)).then((trees) => { setDesignTrees(trees.filter((t): t is DesignTreeNode => !!t)); setLoadingParts(false); });
    }
  }, [open, ticket?.id]);

  const availableParts = useMemo(() => {
    if (!ticket) return [];
    const faultyUuids = new Set((ticket.parts ?? []).map((p) => p.design_uuid));
    return designTrees.flatMap((t) => flattenTree(t)).map(({ node, depth }) => ({
      uuid: node.design_id, name: node.design_name, type: node.design_type, depth,
      disabled: faultyUuids.has(node.design_id),
    })).filter((p) => !p.disabled);
  }, [designTrees, ticket]);

  const update = (id: string, patch: Partial<InspectionRowDraft>) => setRows((prev) => prev.map((r) => r._id === id ? { ...r, ...patch } : r));
  const remove = (id: string) => setRows((prev) => prev.filter((r) => r._id !== id));
  const addRow = () => setRows((prev) => [...prev, newRow()]);

  const handleSubmit = async () => {
    setValidated(true);
    const dirty = rows.filter(isDirty);
    if (!dirty.length) { setToastMsg({ type: "err", text: "Fill in at least one inspection row." }); setTimeout(() => setToastMsg(null), 3000); return; }
    if (dirty.some((r) => !isComplete(r))) { setToastMsg({ type: "err", text: "Some rows are incomplete." }); setTimeout(() => setToastMsg(null), 3000); return; }
    setSubmitting(true);
    let allOk = true;
    for (const r of dirty) {
      const fd = new FormData();
      if (r.part_name) fd.append("part_name", r.part_name);
      fd.append("inspection", r.inspection);
      fd.append("result", r.result);
      fd.append("action", r.action as string);
      if (r.notes.trim()) fd.append("notes", r.notes.trim());
      r.files.forEach((f) => fd.append("file", f));
      const ok = await createTicketInspection(ticket!.id, fd);
      if (!ok) allOk = false;
    }
    setSubmitting(false);
    if (allOk) { setToastMsg({ type: "ok", text: "Inspection submitted" }); setTimeout(() => { setToastMsg(null); onClose(); }, 900); }
    else { setToastMsg({ type: "err", text: "Some rows failed to submit." }); setTimeout(() => setToastMsg(null), 3000); }
  };

  const isResolved = ticket?.status === "resolved" || ticket?.status === "closed";
  const dirtyCount = rows.filter(isDirty).length;
  const productName = ticket?.items?.find((i) => i.product_id === ticket.product_id)?.product_name ?? ticket?.items?.[0]?.product_name;

  if (!open || !ticket) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-5xl max-h-[90vh] bg-[#090b10] border border-white/8 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="h-14 shrink-0 border-b border-white/5 flex items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
              <ClipboardList className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-semibold text-white/80">Inspection Report</span>
                <code className="text-[10px] font-mono text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full">{ticket.ticket_id}</code>
              </div>
              {ticket.reason && <p className="text-[10px] font-mono text-white/30 mt-0.5 line-clamp-1">{ticket.reason.replace(/<[^>]*>/g, "")}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-white/25 hover:text-white/60 transition"><X className="w-4.5 h-4.5" /></button>
        </div>

        {toastMsg && (
          <div className={`mx-5 mt-3 px-3 py-2 rounded-lg text-xs font-mono ${toastMsg.type === "ok" ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300" : "bg-red-500/15 border border-red-500/30 text-red-300"}`}>
            {toastMsg.text}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loadingPast
            ? <div className="flex items-center gap-2 text-xs font-mono text-white/25"><Loader2 className="w-3.5 h-3.5 animate-spin" />Loading past inspections…</div>
            : <PastInspections records={past} productName={productName} />
          }

          {!isResolved && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-0.5 h-4 rounded-full bg-violet-500" />
                <span className="text-xs font-mono font-semibold text-white/60">New Inspection</span>
                {rows.length > 0 && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-white/5 border border-white/8 text-white/30">{rows.length} parts</span>}
                {validated && rows.some((r) => isDirty(r) && !isComplete(r)) && <span className="ml-auto text-[10px] font-mono text-red-400">Some rows incomplete</span>}
              </div>
              <div className="border border-white/8 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-[820px]">
                    <thead>
                      <tr className="bg-white/3 border-b border-white/5">
                        <th className="w-0.5 p-0" />
                        <th className="px-2 py-2 text-[9px] font-mono font-bold text-white/25 uppercase tracking-widest text-center w-7 border-r border-white/5">#</th>
                        <th className="px-2 py-2 text-[9px] font-mono font-bold text-white/25 uppercase tracking-widest text-left border-r border-white/5">Part</th>
                        <th className="px-2 py-2 text-[9px] font-mono font-bold text-white/25 uppercase tracking-widest text-left border-r border-white/5">Inspection Notes</th>
                        <th className="px-2 py-2 text-[9px] font-mono font-bold text-white/25 uppercase tracking-widest text-left w-[120px] border-r border-white/5">Result</th>
                        <th className="px-2 py-2 text-[9px] font-mono font-bold text-white/25 uppercase tracking-widest text-left w-[130px] border-r border-white/5">Action</th>
                        <th className="px-2 py-2 text-[9px] font-mono font-bold text-white/25 uppercase tracking-widest text-left border-r border-white/5">Notes</th>
                        <th className="px-2 py-2 text-[9px] font-mono font-bold text-white/25 uppercase tracking-widest text-center w-[100px] border-r border-white/5">Files</th>
                        <th className="w-7" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr><td colSpan={9} className="py-14 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <ClipboardList className="w-8 h-8 text-white/10" />
                            <p className="text-xs font-mono text-white/30">No parts added — click <span className="text-white/50">+ Add Part</span></p>
                          </div>
                        </td></tr>
                      ) : rows.map((row, i) => (
                        <EditableRow key={row._id} row={row} index={i} hasError={validated} parts={availableParts} partsLoading={loadingParts} onChange={update} onRemove={remove} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <button type="button" onClick={addRow}
                className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-semibold text-violet-400 hover:text-violet-300 bg-violet-500/8 hover:bg-violet-500/15 border border-dashed border-violet-500/25 hover:border-violet-500/50 rounded-lg transition">
                <Plus className="w-3 h-3" />Add Part
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/5 px-5 py-3 flex items-center justify-between">
          {!isResolved && <span className="text-[10px] font-mono text-white/25">{dirtyCount > 0 ? `${dirtyCount} row${dirtyCount !== 1 ? "s" : ""} ready` : "Fill inspection rows below"}</span>}
          <div className="flex items-center gap-2 ml-auto">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-mono text-white/40 hover:text-white/70 rounded-lg hover:bg-white/5 transition">{isResolved ? "Close" : "Cancel"}</button>
            {!isResolved && (
              <button type="button" onClick={handleSubmit} disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-mono font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition">
                {submitting ? <><Loader2 className="w-3 h-3 animate-spin" />Submitting…</> : "Submit Inspection"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
