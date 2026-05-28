"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ChevronDown, ChevronRight, Check, X, Search, Loader2 } from "lucide-react";
import { TroubleshootingDesignNode } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TreeNode extends TroubleshootingDesignNode {
  children: TreeNode[];
}

interface DesignTreeSelectProps {
  nodes: TroubleshootingDesignNode[];
  value: string[];
  onChange: (uuids: string[], nodes: TroubleshootingDesignNode[]) => void;
  mode?: "single" | "multi";
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  "Mother Assembly": "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  "Child Assembly":  "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  "Component":       "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  "Sub-Component":   "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
};

function buildTree(flat: TroubleshootingDesignNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  flat.forEach(n => map.set(n.design_uuid, { ...n, children: [] }));
  const roots: TreeNode[] = [];
  map.forEach(node => {
    if (node.parent_design_uuid && map.has(node.parent_design_uuid)) {
      map.get(node.parent_design_uuid)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function getAllDescendantUuids(node: TreeNode): string[] {
  return [node.design_uuid, ...node.children.flatMap(getAllDescendantUuids)];
}

function flattenTree(nodes: TreeNode[]): TroubleshootingDesignNode[] {
  return nodes.flatMap(n => [n, ...flattenTree(n.children)]);
}

// ── TreeRow ───────────────────────────────────────────────────────────────────

function TreeRow({
  node,
  selectedIds,
  mode,
  depth,
  onSelect,
}: {
  node: TreeNode;
  selectedIds: Set<string>;
  mode: "single" | "multi";
  depth: number;
  onSelect: (node: TreeNode) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = node.children.length > 0;

  const descendants = useMemo(() => getAllDescendantUuids(node), [node]);
  const isSelected  = selectedIds.has(node.design_uuid);
  const isFull      = mode === "multi" && descendants.every(id => selectedIds.has(id));
  const isPartial   = mode === "multi" && !isFull && descendants.some(id => selectedIds.has(id));

  const typeClass = TYPE_COLOR[node.design_type] ?? "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white/50";

  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(node)}
        className={`w-full text-left flex items-center gap-2 py-2 pr-3 transition-colors text-xs font-mono
          border-b border-slate-100 dark:border-white/5 last:border-b-0
          ${(isSelected || isFull) ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-slate-50 dark:hover:bg-white/5"}`}
        style={{ paddingLeft: `${depth * 16 + 10}px` }}
      >
        {/* Expand toggle */}
        {hasChildren ? (
          <span
            role="button"
            onClick={e => { e.stopPropagation(); setExpanded(p => !p); }}
            className="shrink-0 w-4 h-4 flex items-center justify-center text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/60"
          >
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </span>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {/* Checkbox (multi) / dot (single) */}
        {mode === "multi" ? (
          <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors
            ${isFull ? "bg-blue-600 border-blue-600 dark:bg-blue-500 dark:border-blue-500"
              : isPartial ? "bg-blue-100 border-blue-500 dark:bg-blue-500/20 dark:border-blue-400"
              : "border-slate-300 dark:border-white/20"}`}
          >
            {isFull && <Check className="w-2.5 h-2.5 text-white" />}
            {isPartial && <div className="w-1.5 h-1.5 rounded-sm bg-blue-600 dark:bg-blue-400" />}
          </div>
        ) : (
          <div className={`w-3 h-3 rounded-full border-2 shrink-0 transition-colors
            ${isSelected ? "border-blue-500 bg-blue-500" : "border-slate-300 dark:border-white/20"}`}
          />
        )}

        {/* Name */}
        <span className={`flex-1 truncate ${(isSelected || isFull) ? "text-blue-800 dark:text-blue-300 font-semibold" : "text-slate-700 dark:text-white/70"}`}>
          {node.design_name}
        </span>

        {/* Type badge */}
        <span className={`shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded-full uppercase tracking-wide ${typeClass}`}>
          {node.design_type === "Mother Assembly" ? "MA"
            : node.design_type === "Child Assembly" ? "CA"
            : node.design_type === "Component" ? "C"
            : "SC"}
        </span>
      </button>

      {hasChildren && expanded && node.children.map(child => (
        <TreeRow
          key={child.design_uuid}
          node={child}
          selectedIds={selectedIds}
          mode={mode}
          depth={depth + 1}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function DesignTreeSelect({
  nodes,
  value,
  onChange,
  mode = "multi",
  label,
  placeholder = "Select components…",
  disabled = false,
  loading = false,
}: DesignTreeSelectProps) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef          = useRef<HTMLDivElement>(null);

  const selectedIds = useMemo(() => new Set(value), [value]);
  const tree        = useMemo(() => buildTree(nodes), [nodes]);
  const flat        = useMemo(() => flattenTree(tree), [tree]);

  const selectedNodes = useMemo(
    () => flat.filter(n => selectedIds.has(n.design_uuid)),
    [flat, selectedIds],
  );

  const filteredFlat = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return flat.filter(n => n.design_name.toLowerCase().includes(q) || n.design_type.toLowerCase().includes(q));
  }, [search, flat]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = useCallback((node: TreeNode) => {
    if (mode === "single") {
      const already = selectedIds.has(node.design_uuid);
      const next = already ? [] : [node.design_uuid];
      onChange(next, flat.filter(n => next.includes(n.design_uuid)));
      setOpen(false);
      setSearch("");
      return;
    }
    // multi: toggle entire subtree
    const descendants = getAllDescendantUuids(node);
    const allSelected = descendants.every(id => selectedIds.has(id));
    const next = new Set(selectedIds);
    if (allSelected) descendants.forEach(id => next.delete(id));
    else             descendants.forEach(id => next.add(id));
    onChange(Array.from(next), flat.filter(n => next.has(n.design_uuid)));
  }, [mode, selectedIds, flat, onChange]);

  const handleFlatSelect = useCallback((n: TroubleshootingDesignNode) => {
    if (mode === "single") {
      const already = selectedIds.has(n.design_uuid);
      const next = already ? [] : [n.design_uuid];
      onChange(next, flat.filter(x => next.includes(x.design_uuid)));
      setOpen(false);
      setSearch("");
      return;
    }
    const next = new Set(selectedIds);
    if (next.has(n.design_uuid)) next.delete(n.design_uuid);
    else                          next.add(n.design_uuid);
    onChange(Array.from(next), flat.filter(x => next.has(x.design_uuid)));
  }, [mode, selectedIds, flat, onChange]);

  const removeChip = (uuid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = value.filter(v => v !== uuid);
    onChange(next, flat.filter(n => next.includes(n.design_uuid)));
  };

  const clearAll = () => onChange([], []);

  return (
    <div ref={wrapperRef} className="relative">
      {label && (
        <label className="block text-[10px] font-mono text-slate-500 dark:text-white/40 uppercase tracking-widest mb-1.5">
          {label}
        </label>
      )}

      {/* Trigger */}
      <div
        role="button"
        tabIndex={disabled || loading ? -1 : 0}
        aria-disabled={disabled || loading}
        onClick={() => !disabled && !loading && setOpen(o => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!disabled && !loading) setOpen(o => !o);
          }
        }}
        className={`w-full min-h-[38px] flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs font-mono transition text-left
          bg-white dark:bg-white/5
          border-slate-200 dark:border-white/10
          hover:border-slate-300 dark:hover:border-white/20
          focus:outline-none focus:border-blue-400 dark:focus:border-blue-500/50
          ${open ? "border-blue-400 dark:border-blue-500/50 ring-2 ring-blue-100 dark:ring-blue-500/10" : ""}
          ${disabled || loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <div className="flex flex-wrap gap-1 flex-1 min-h-5 items-center">
          {loading ? (
            <span className="flex items-center gap-1.5 text-slate-400 dark:text-white/30">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading…
            </span>
          ) : selectedNodes.length === 0 ? (
            <span className="text-slate-400 dark:text-white/30">{placeholder}</span>
          ) : mode === "single" ? (
            <span className="text-slate-800 dark:text-white/80">{selectedNodes[0]?.design_name}</span>
          ) : (
            <>
              {selectedNodes.slice(0, 3).map(n => (
                <span key={n.design_uuid} className="flex items-center gap-1 bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/25 px-2 py-0.5 rounded-full text-[10px] font-mono">
                  {n.design_name}
                  <button type="button" onClick={e => removeChip(n.design_uuid, e)} className="hover:bg-blue-200 dark:hover:bg-blue-500/30 rounded-full">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
              {selectedNodes.length > 3 && (
                <span className="bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/50 px-2 py-0.5 rounded-full text-[10px] font-mono">
                  +{selectedNodes.length - 3} more
                </span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!loading && selectedNodes.length > 0 && mode === "multi" && (
            <button type="button" onClick={e => { e.stopPropagation(); clearAll(); }} className="text-slate-300 dark:text-white/20 hover:text-slate-500 dark:hover:text-white/50 p-0.5">
              <X className="w-3 h-3" />
            </button>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 dark:text-white/30 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] w-full z-[200] bg-white dark:bg-[#0c0f1a] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10">
              <Search className="w-3 h-3 text-slate-400 dark:text-white/30 shrink-0" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search components…"
                className="flex-1 bg-transparent text-xs font-mono text-slate-700 dark:text-white/70 placeholder:text-slate-400 dark:placeholder:text-white/20 focus:outline-none"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} className="text-slate-400 dark:text-white/30 hover:text-slate-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Actions row (multi only) */}
          {mode === "multi" && flat.length > 0 && (
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
              <button type="button" onClick={() => onChange(flat.map(n => n.design_uuid), flat)} className="text-[10px] font-mono text-blue-600 dark:text-blue-400 hover:underline">
                Select all
              </button>
              {value.length > 0 && (
                <button type="button" onClick={clearAll} className="text-[10px] font-mono text-red-500 dark:text-red-400 hover:underline">
                  Clear all
                </button>
              )}
            </div>
          )}

          {/* List */}
          <div className="max-h-60 overflow-y-auto">
            {nodes.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs font-mono text-slate-400 dark:text-white/30">
                No components available
              </div>
            ) : search ? (
              filteredFlat.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs font-mono text-slate-400 dark:text-white/30">No results</div>
              ) : (
                filteredFlat.map(n => {
                  const sel = selectedIds.has(n.design_uuid);
                  const typeClass = TYPE_COLOR[n.design_type] ?? "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white/50";
                  return (
                    <button
                      key={n.design_uuid}
                      type="button"
                      onClick={() => handleFlatSelect(n)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-mono border-b border-slate-100 dark:border-white/5 last:border-b-0 transition-colors
                        ${sel ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-slate-50 dark:hover:bg-white/5"}`}
                    >
                      {mode === "multi" ? (
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${sel ? "bg-blue-600 border-blue-600" : "border-slate-300 dark:border-white/20"}`}>
                          {sel && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                      ) : (
                        <div className={`w-3 h-3 rounded-full border-2 shrink-0 ${sel ? "border-blue-500 bg-blue-500" : "border-slate-300 dark:border-white/20"}`} />
                      )}
                      <span className={`flex-1 truncate ${sel ? "text-blue-800 dark:text-blue-300 font-semibold" : "text-slate-700 dark:text-white/70"}`}>{n.design_name}</span>
                      <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wide ${typeClass}`}>{n.design_type}</span>
                    </button>
                  );
                })
              )
            ) : (
              tree.map(root => (
                <TreeRow
                  key={root.design_uuid}
                  node={root}
                  selectedIds={selectedIds}
                  mode={mode}
                  depth={0}
                  onSelect={handleSelect}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {value.length > 0 && (
            <div className="px-3 py-2 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 text-[10px] font-mono text-slate-500 dark:text-white/30">
              {value.length} selected
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DesignTreeSelect;
