"use client";

import React, { useState, useMemo, useEffect } from "react";
import { X, Search, Users, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import {
  fetchJurisdictions, fetchJurisdictionLevels, fetchProductById, fetchDesignTreeById,
  assignOrderTicketToUser, JurisdictionRecord, JurisdictionLevel, DesignTreeNode,
} from "../../lib/api";

interface TicketData {
  id: string;
  orderId: string;
  productId: string;
  productUuid?: string;
  designs?: Array<{ design_id: string; tree_id?: string; design_name?: string }>;
  title: string;
  productName: string;
  priority?: string;
  issueType?: string;
  faultyParts?: { id: string; name: string }[];
  assigneeId?: string | null;
}

interface AssignTechnicianDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  ticketData?: TicketData;
  onAssigned?: () => void;
}

function flattenTree(node: DesignTreeNode, depth = 0): Array<{ node: DesignTreeNode; depth: number }> {
  return [{ node, depth }, ...(node.children ?? []).flatMap((c) => flattenTree(c, depth + 1))];
}

const WORK_MODES = ["Remote", "On-site", "Both"] as const;

export function AssignTechnicianDrawer({ isOpen, onClose, ticketData, onAssigned }: AssignTechnicianDrawerProps) {
  const [technicians, setTechnicians] = useState<JurisdictionRecord[]>([]);
  const [levels, setLevels] = useState<JurisdictionLevel[]>([]);
  const [loadingTechs, setLoadingTechs] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState(ticketData?.productId ?? "");
  const [selectedExpertise, setSelectedExpertise] = useState<string[]>([]);
  const [selectedRanks, setSelectedRanks] = useState<string[]>([]);
  const [workMode, setWorkMode] = useState<string | null>(null);
  const [designTrees, setDesignTrees] = useState<DesignTreeNode[]>([]);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [expandedTechs, setExpandedTechs] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Load technicians + levels on open
  useEffect(() => {
    if (!isOpen) return;
    setSelectedProductId("");
    setSelectedExpertise([]);
    setSelectedRanks([]); setWorkMode(null); setSearch("");
    setLoadingTechs(true);
    Promise.all([fetchJurisdictions({ limit: 100 }), fetchJurisdictionLevels()]).then(([techs, lvls]) => {
      setTechnicians(techs); setLevels(lvls); setLoadingTechs(false);
    });
  }, [isOpen, ticketData?.id]);

  // Load design trees for expertise filter
  useEffect(() => {
    if (!isOpen || !selectedProductId) { setDesignTrees([]); return; }
    setLoadingProduct(true);
    fetchProductById(selectedProductId).then(async (product) => {
      const treeIds = (product?.designs ?? []).map((d: any) => d.tree_id).filter(Boolean).slice(0, 5) as string[];
      const trees = await Promise.all(treeIds.map((id) => fetchDesignTreeById(id)));
      setDesignTrees(trees.filter((t): t is DesignTreeNode => !!t));
      setLoadingProduct(false);
    });
  }, [isOpen, selectedProductId]);

  const designOptions = useMemo(() => {
    return designTrees.flatMap((t) => flattenTree(t)).map(({ node, depth }) => ({
      id: node.design_id, name: node.design_name, type: node.design_type, depth,
    }));
  }, [designTrees]);

  const faultyPartIds = useMemo(() => new Set(selectedExpertise), [selectedExpertise]);

  const getTechMatchCount = (tech: JurisdictionRecord) => {
    if (faultyPartIds.size === 0) return 0;
    const techDesignIds = new Set(
      (tech.knowledge ?? [])
        .filter((k) => !selectedProductId || k.product_id === selectedProductId)
        .flatMap((k) => k.designs.map((d) => d.id)),
    );
    return [...faultyPartIds].filter((id) => techDesignIds.has(id)).length;
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return technicians.filter((tech) => {
      if (ticketData?.assigneeId && tech.user_id === ticketData.assigneeId) return true;
      if (selectedProductId) {
        const knows = tech.knowledge?.some((k) => k.product_id === selectedProductId);
        if (!knows) return false;
      }
      if (workMode) {
        if (workMode === "Both" && tech.mode !== "Both") return false;
        if (workMode === "Remote" && tech.mode !== "Remote" && tech.mode !== "Both") return false;
        if (workMode === "On-site" && tech.mode !== "On-site" && tech.mode !== "Both") return false;
      }
      if (selectedRanks.length > 0 && !selectedRanks.includes(tech.level_id ?? "")) return false;
      if (selectedExpertise.length > 0) {
        return tech.knowledge?.some((k) =>
          (!selectedProductId || k.product_id === selectedProductId) &&
          k.designs.some((d) => selectedExpertise.includes(d.id))
        );
      }
      if (q) {
        const name = `${tech.user?.firstName ?? ""} ${tech.user?.lastName ?? ""}`.toLowerCase();
        return name.includes(q);
      }
      return true;
    });
  }, [technicians, search, selectedProductId, workMode, selectedRanks, selectedExpertise, ticketData?.assigneeId]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.user_id === ticketData?.assigneeId) return -1;
      if (b.user_id === ticketData?.assigneeId) return 1;
      return getTechMatchCount(b) - getTechMatchCount(a);
    });
  }, [filtered]);

  const handleAssign = async (tech: JurisdictionRecord) => {
    if (!ticketData?.id) return;
    const name = `${tech.user?.firstName ?? ""} ${tech.user?.lastName ?? ""}`.trim() || "Technician";
    setAssigning(tech.user_id);
    const ok = await assignOrderTicketToUser(ticketData.id, tech.user_id);
    setAssigning(null);
    if (ok) {
      setToastMsg({ type: "ok", text: `Assigned to ${name}` });
      setTimeout(() => { setToastMsg(null); onAssigned?.(); onClose(); }, 1000);
    } else {
      setToastMsg({ type: "err", text: "Failed to assign technician" });
      setTimeout(() => setToastMsg(null), 3000);
    }
  };

  const cleanTitle = useMemo(() => (ticketData?.title ?? "—").replace(/<[^>]*>/g, ""), [ticketData?.title]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-50 w-[520px] h-full bg-[#090b10] border-l border-white/5 flex flex-col shadow-2xl overflow-hidden">
        <div className="h-12 shrink-0 border-b border-white/5 flex items-center justify-between px-4">
          <span className="text-sm font-mono text-white/70">Assign Technician</span>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition"><X className="w-4 h-4" /></button>
        </div>

        {toastMsg && (
          <div className={`mx-4 mt-3 px-3 py-2 rounded-lg text-xs font-mono ${toastMsg.type === "ok" ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300" : "bg-red-500/15 border border-red-500/30 text-red-300"}`}>
            {toastMsg.text}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Ticket summary */}
          <div className="rounded-xl border border-white/8 bg-white/3 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-white/3 border-b border-white/5">
              <span className="text-[9px] font-bold text-white/25 uppercase tracking-widest">Ticket</span>
              <span className="text-[9px] font-bold text-white/25 uppercase tracking-widest">Product</span>
            </div>
            <div className="flex items-start justify-between gap-4 px-4 py-3">
              <h3 className="text-xs font-semibold text-white/80 leading-snug flex-1">{cleanTitle}</h3>
              <span className="shrink-0 text-xs font-bold text-violet-400">{ticketData?.productName ?? "—"}</span>
            </div>
            {(ticketData?.faultyParts?.length ?? 0) > 0 && (
              <div className="px-4 pb-3 border-t border-white/5 pt-2">
                <p className="text-[9px] font-bold text-white/25 uppercase tracking-widest mb-1.5">Faulty Parts</p>
                <div className="flex flex-wrap gap-1">
                  {ticketData!.faultyParts!.map((p, i) => (
                    <span key={i} className="px-1.5 py-0.5 bg-red-500/15 text-red-400 rounded text-[10px] font-mono border border-red-500/20">{p.name}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-white/25 uppercase tracking-widest">Filters</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setSelectedProductId(ticketData?.productId ?? ""); setSelectedExpertise(ticketData?.faultyParts?.map((p) => p.id) ?? []); setSelectedRanks([]); setWorkMode(null); }} className="text-[10px] font-mono text-blue-400 hover:text-blue-300 uppercase tracking-wide transition">Reset</button>
                <button type="button" onClick={() => { setSelectedProductId(""); setSelectedExpertise([]); setSelectedRanks([]); setWorkMode(null); }} className="text-[10px] font-mono text-red-400 hover:text-red-300 uppercase tracking-wide transition">Clear</button>
              </div>
            </div>

            {/* Work Mode */}
            <div>
              <p className="text-[9px] font-bold text-white/25 uppercase tracking-widest mb-1.5">Work Mode</p>
              <div className="flex gap-4">
                {WORK_MODES.map((m) => (
                  <button key={m} type="button" onClick={() => setWorkMode((prev) => prev === m ? null : m)} className="flex items-center gap-1.5 group">
                    <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition ${workMode === m ? "border-violet-500" : "border-white/20"}`}>
                      {workMode === m && <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />}
                    </span>
                    <span className={`text-xs font-mono transition ${workMode === m ? "text-white" : "text-white/40"}`}>{m}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Ranks */}
            {levels.length > 0 && (
              <div>
                <p className="text-[9px] font-bold text-white/25 uppercase tracking-widest mb-1.5">Ranks</p>
                <div className="flex flex-wrap gap-1">
                  {levels.map((l) => {
                    const sel = selectedRanks.includes(l.id);
                    return (
                      <button key={l.id} type="button"
                        onClick={() => setSelectedRanks((prev) => sel ? prev.filter((r) => r !== l.id) : [...prev, l.id])}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono border transition ${sel ? "bg-violet-500/20 border-violet-500/40 text-violet-300" : "bg-white/3 border-white/10 text-white/40 hover:border-white/20"}`}
                      >
                        {l.name} (Rank {l.rank})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Expertise */}
            {(designOptions.length > 0 || loadingProduct) && (
              <div>
                <p className="text-[9px] font-bold text-white/25 uppercase tracking-widest mb-1.5">Expertise</p>
                {loadingProduct ? (
                  <div className="flex items-center gap-1 text-white/30 text-[10px] font-mono"><Loader2 className="w-3 h-3 animate-spin" />Loading designs…</div>
                ) : (
                  <div className="max-h-32 overflow-y-auto space-y-0.5">
                    {designOptions.map((d) => {
                      const sel = selectedExpertise.includes(d.id);
                      return (
                        <button key={d.id} type="button"
                          onClick={() => setSelectedExpertise((prev) => sel ? prev.filter((x) => x !== d.id) : [...prev, d.id])}
                          style={{ paddingLeft: d.depth * 12 + 8 }}
                          className={`w-full text-left pr-2 py-1 text-[10px] font-mono rounded transition flex items-center gap-1.5 ${sel ? "text-violet-300 bg-violet-500/10" : "text-white/40 hover:bg-white/3"}`}
                        >
                          <span className={`w-2.5 h-2.5 rounded border shrink-0 flex items-center justify-center ${sel ? "bg-violet-500 border-violet-500" : "border-white/20"}`}>
                            {sel && <span className="w-1 h-1 bg-white rounded-sm" />}
                          </span>
                          <span className="truncate">{d.name}</span>
                          {d.type && <span className="text-white/20 shrink-0">{d.type}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Technician list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-white/25 uppercase tracking-widest">Recommended Technicians</span>
              <span className="text-[10px] font-mono text-white/30">{loadingTechs ? "Loading…" : `${sorted.length} shown`}</span>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name…"
                className="w-full bg-[#0c0e16] border border-white/10 text-white text-xs font-mono pl-7 pr-3 py-2 rounded-lg focus:outline-none focus:border-violet-500/40 placeholder:text-white/20"
              />
            </div>

            {loadingTechs ? (
              <div className="flex flex-col items-center justify-center py-12 text-white/30 gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-violet-400" />
                <span className="text-xs font-mono">Loading technicians…</span>
              </div>
            ) : sorted.length === 0 ? (
              <div className="py-12 flex flex-col items-center text-white/20 border border-dashed border-white/5 rounded-xl">
                <Users className="w-8 h-8 mb-2 opacity-30" />
                <span className="text-xs font-mono">No technicians found</span>
                <span className="text-[10px] font-mono mt-1">Remove filters to widen search</span>
              </div>
            ) : (
              <div className="space-y-2">
                {sorted.map((tech) => {
                  const isAssigned = tech.user_id === ticketData?.assigneeId;
                  const fullName = `${tech.user?.firstName ?? ""} ${tech.user?.lastName ?? ""}`.trim() || "Unknown";
                  const initials = `${tech.user?.firstName?.[0] ?? ""}${tech.user?.lastName?.[0] ?? ""}`.toUpperCase() || "T";
                  const matchCount = getTechMatchCount(tech);
                  const total = faultyPartIds.size;
                  const isFullMatch = total > 0 && matchCount === total;
                  const isPartial = total > 0 && matchCount > 0 && !isFullMatch;

                  const allChips = (tech.knowledge ?? [])
                    .filter((k) => !selectedProductId || k.product_id === selectedProductId)
                    .flatMap((k) => k.designs);
                  const uniqChips = Array.from(new Map(allChips.map((d) => [d.id, d])).values());
                  const matchChips = uniqChips.filter((d) => faultyPartIds.has(d.id));
                  const otherChips = uniqChips.filter((d) => !faultyPartIds.has(d.id));
                  const isExpanded = expandedTechs.has(tech.id);

                  const stripe = isAssigned ? "bg-violet-500" : isFullMatch ? "bg-emerald-500" : isPartial ? "bg-amber-400" : "bg-white/10";
                  const border = isAssigned ? "border-violet-500/30" : isFullMatch ? "border-emerald-500/20" : "border-white/8";

                  return (
                    <div key={tech.id} className={`relative bg-white/3 rounded-xl border overflow-hidden ${border}`}>
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${stripe}`} />
                      <div className="pl-4 pr-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center text-violet-300 font-bold text-xs shrink-0">{initials}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-mono font-semibold text-white/80 truncate">{fullName}</span>
                              {isAssigned && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 shrink-0">Assigned</span>}
                              {!isAssigned && isFullMatch && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shrink-0">Full match</span>}
                            </div>
                            <div className="text-[10px] font-mono text-white/30 mt-0.5">{tech.level?.name ?? "No Rank"}</div>
                          </div>
                          <button
                            onClick={() => handleAssign(tech)}
                            disabled={!!assigning}
                            className={`shrink-0 px-2.5 py-1 text-[10px] font-mono font-semibold rounded-lg transition disabled:opacity-50 ${isAssigned ? "border border-white/10 text-white/40 hover:bg-white/5" : "bg-violet-600 hover:bg-violet-500 text-white"}`}
                          >
                            {assigning === tech.user_id ? "…" : isAssigned ? "Reassign" : "Assign"}
                          </button>
                        </div>

                        <div className={`mt-2.5 grid gap-3 ${total > 0 ? "grid-cols-3" : "grid-cols-2"}`}>
                          {total > 0 && (
                            <div>
                              <div className="text-[9px] font-bold text-white/25 uppercase">Match</div>
                              <div className="text-xs font-bold text-white/70 mt-0.5 font-mono">{matchCount}<span className="text-white/30">/{total}</span></div>
                            </div>
                          )}
                          <div>
                            <div className="text-[9px] font-bold text-white/25 uppercase">Location</div>
                            <div className="text-[10px] font-mono text-white/50 mt-0.5 truncate">{tech.location?.name ?? tech.location?.city ?? "—"}</div>
                          </div>
                          <div>
                            <div className="text-[9px] font-bold text-white/25 uppercase">Mode</div>
                            <div className="text-[10px] font-mono text-white/50 mt-0.5">{tech.mode ?? "—"}</div>
                          </div>
                        </div>

                        {(matchChips.length > 0 || otherChips.length > 0) && (
                          <div className="mt-2 pt-2 border-t border-white/5 flex flex-wrap gap-1">
                            {matchChips.map((d) => (
                              <span key={d.id} className="text-[9px] px-1.5 py-0.5 bg-red-500/15 text-red-400 border border-red-500/20 rounded font-mono">{d.name}</span>
                            ))}
                            {isExpanded && otherChips.map((d) => (
                              <span key={d.id} className="text-[9px] px-1.5 py-0.5 bg-white/5 text-white/40 border border-white/8 rounded font-mono">{d.name}</span>
                            ))}
                            {otherChips.length > 0 && (
                              <button type="button" onClick={() => setExpandedTechs((prev) => { const n = new Set(prev); isExpanded ? n.delete(tech.id) : n.add(tech.id); return n; })}
                                className="text-[9px] px-1.5 py-0.5 bg-white/5 text-white/40 border border-white/8 rounded font-mono hover:bg-white/10 transition">
                                {isExpanded ? "Show less" : `+${otherChips.length}`}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
