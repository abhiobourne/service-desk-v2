"use client";

import React, { useEffect, useLayoutEffect, useMemo, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, X, Check, Loader2 } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";

export interface MultiSelectSearchProps<T> {
  items: T[];
  value?: string[];
  onChange: (values: string[], items?: T[]) => void;
  getValue: (item: T) => string;
  getLabel: (item: T) => React.ReactNode;
  getSubLabel?: (item: T) => React.ReactNode;
  searchMode?: "client" | "server";
  searchBy?: (item: T) => string;
  onSearch?: (search: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  label?: string;
  disabled?: boolean;
  isLoading?: boolean;
  error?: boolean;
  helperText?: string;
  onLoadMore?: () => void;
  hasMore?: boolean;
  maxSelections?: number;
  showSelectAll?: boolean;
  allowClear?: boolean;
  totalCount?: number;
  initialSelectedItems?: T[];
}

function MultiSelectSearch<T>({
  items,
  value = [],
  onChange,
  getValue,
  getLabel,
  getSubLabel,
  searchMode = "client",
  searchBy,
  onSearch,
  placeholder = "Select options",
  searchPlaceholder = "Search…",
  label,
  disabled = false,
  isLoading = false,
  error = false,
  helperText,
  onLoadMore,
  hasMore = false,
  maxSelections,
  showSelectAll = true,
  allowClear = true,
  totalCount,
  initialSelectedItems = [],
}: MultiSelectSearchProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({ position: "fixed", top: 0, left: 0, width: 0, zIndex: 9999 });
  const [optionsMaxHeight, setOptionsMaxHeight] = useState(240);
  const [positionReady, setPositionReady] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const allSeenRef = useRef<Map<string, T>>(new Map());

  const debouncedSearch = useDebounce(search, 400);

  // Populate seen map from initialSelectedItems and items
  useEffect(() => {
    initialSelectedItems.forEach(item => {
      const id = getValue(item);
      if (!allSeenRef.current.has(id)) allSeenRef.current.set(id, item);
    });
  }, [initialSelectedItems, getValue]);

  useEffect(() => {
    items.forEach(item => {
      const id = getValue(item);
      if (!allSeenRef.current.has(id)) allSeenRef.current.set(id, item);
    });
  }, [items, getValue]);

  useEffect(() => {
    if (searchMode !== "server" || !open) return;
    onSearch?.(debouncedSearch);
  }, [debouncedSearch, searchMode, onSearch, open]);

  const filteredItems = useMemo(() => {
    if (searchMode === "server") return items;
    if (!search.trim() || !searchBy) return items;
    const q = search.toLowerCase();
    return items.filter(item => searchBy(item).toLowerCase().includes(q));
  }, [items, search, searchBy, searchMode]);

  const selectedItems = useMemo(() => {
    return value.map(v => allSeenRef.current.get(v)).filter(Boolean) as T[];
  }, [value]);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setSearch("");
    setPositionReady(false);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!wrapperRef.current?.contains(t) && !dropdownRef.current?.contains(t)) closeDropdown();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, closeDropdown]);

  useLayoutEffect(() => {
    if (!open) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const position = () => {
      const rect = wrapper.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
      const panelH = Math.max(120, Math.min(360, openUp ? spaceAbove : spaceBelow));

      setDropdownStyle({
        position: "fixed",
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
        ...(openUp ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }),
      });
      setOptionsMaxHeight(Math.max(80, panelH - 80));
      setPositionReady(true);
    };

    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => { window.removeEventListener("resize", position); window.removeEventListener("scroll", position, true); };
  }, [open]);

  const buildPayload = useCallback((vals: string[]) => ({
    values: vals,
    items: vals.map(v => allSeenRef.current.get(v)).filter(Boolean) as T[],
  }), []);

  const handleToggle = (v: string, item: T) => {
    allSeenRef.current.set(v, item);
    const next = value.includes(v)
      ? value.filter(x => x !== v)
      : maxSelections && value.length >= maxSelections
        ? value
        : [...value, v];
    const { values, items: selectedItems } = buildPayload(next);
    onChange(values, selectedItems);
  };

  const handleSelectAll = () => {
    const visibleVals = filteredItems.map(getValue);
    const allSelected = visibleVals.every(v => value.includes(v));
    const next = allSelected
      ? value.filter(v => !visibleVals.includes(v))
      : [...new Set([...value, ...visibleVals])].slice(0, maxSelections ?? Infinity);
    const { values, items: sel } = buildPayload(next);
    onChange(values, sel);
  };

  const handleClearAll = () => onChange([], []);

  const handleRemoveChip = (v: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = value.filter(x => x !== v);
    const { values, items: sel } = buildPayload(next);
    onChange(values, sel);
  };

  const handleScroll = () => {
    const el = listRef.current;
    if (!el || !hasMore || isLoading) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 5) onLoadMore?.();
  };

  const isAllVisible = filteredItems.length > 0 && filteredItems.every(item => value.includes(getValue(item)));
  const isPartial = value.length > 0 && !isAllVisible;

  return (
    <div className="relative">
      {label && (
        <label className={`block text-[10px] font-mono uppercase tracking-widest mb-1.5 ${error ? "text-red-500" : "text-slate-500 dark:text-white/40"}`}>
          {label}
        </label>
      )}

      <div ref={wrapperRef}>
        <div
          onClick={() => { if (!disabled && !isLoading) setOpen(o => !o); }}
          className={`relative min-h-[38px] flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono transition-all cursor-pointer
            bg-white dark:bg-white/5
            ${error ? "border-red-400 dark:border-red-500/50" : open ? "border-blue-400 dark:border-blue-500/50 ring-2 ring-blue-100 dark:ring-blue-500/10" : "border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20"}
            ${disabled || isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div className="flex flex-wrap gap-1 flex-1 min-h-5 items-center">
            {isLoading ? (
              <span className="flex items-center gap-1.5 text-slate-400 dark:text-white/30"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</span>
            ) : selectedItems.length === 0 ? (
              <span className="text-slate-400 dark:text-white/30">{placeholder}</span>
            ) : (
              <>
                {selectedItems.slice(0, 3).map(item => {
                  const v = getValue(item);
                  return (
                    <span key={v} className="flex items-center gap-1 bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/25 px-2 py-0.5 rounded-full text-[10px] font-mono">
                      {getLabel(item)}
                      <button type="button" onClick={e => handleRemoveChip(v, e)} className="hover:bg-blue-200 dark:hover:bg-blue-500/30 rounded-full ml-0.5">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  );
                })}
                {selectedItems.length > 3 && (
                  <span className="bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/50 px-2 py-0.5 rounded-full text-[10px] font-mono">
                    +{selectedItems.length - 3} more
                  </span>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!isLoading && value.length > 0 && allowClear && (
              <button type="button" onClick={e => { e.stopPropagation(); handleClearAll(); }} className="text-slate-300 dark:text-white/20 hover:text-slate-500 dark:hover:text-white/50 p-0.5">
                <X className="w-3 h-3" />
              </button>
            )}
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 dark:text-white/30 transition-transform ${open ? "rotate-180" : ""}`} />
          </div>
        </div>

        {helperText && <p className={`text-[10px] mt-1 ${error ? "text-red-500" : "text-slate-500 dark:text-white/30"}`}>{helperText}</p>}
      </div>

      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{ ...dropdownStyle, visibility: positionReady ? "visible" : "hidden" }}
          className="bg-white dark:bg-[#0c0f1a] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden"
        >
          {/* Search */}
          <div className="p-2 border-b border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10">
              <Search className="w-3 h-3 text-slate-400 dark:text-white/30 shrink-0" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="flex-1 bg-transparent text-xs font-mono text-slate-700 dark:text-white/70 placeholder:text-slate-400 dark:placeholder:text-white/20 focus:outline-none"
              />
              {search && <button type="button" onClick={() => setSearch("")} className="text-slate-400 dark:text-white/30 hover:text-slate-600"><X className="w-3 h-3" /></button>}
            </div>
          </div>

          {/* Select All / Clear */}
          {showSelectAll && filteredItems.length > 0 && (
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
              <button type="button" onClick={handleSelectAll} className="flex items-center gap-2 text-[10px] font-mono text-slate-600 dark:text-white/50 hover:text-slate-900 dark:hover:text-white transition">
                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors
                  ${isAllVisible ? "bg-blue-600 border-blue-600 dark:bg-blue-500 dark:border-blue-500"
                    : isPartial ? "bg-blue-100 border-blue-500 dark:bg-blue-500/20 dark:border-blue-400"
                    : "border-slate-300 dark:border-white/20"}`}
                >
                  {isAllVisible && <Check className="w-2.5 h-2.5 text-white" />}
                  {isPartial && <div className="w-1.5 h-1.5 rounded-sm bg-blue-600 dark:bg-blue-400" />}
                </div>
                {isAllVisible ? "Deselect all" : "Select all"}
              </button>
              {allowClear && value.length > 0 && (
                <button type="button" onClick={handleClearAll} className="text-[10px] font-mono text-red-500 dark:text-red-400 hover:underline">Clear all</button>
              )}
            </div>
          )}

          {/* Options */}
          <div ref={listRef} style={{ maxHeight: optionsMaxHeight }} className="overflow-y-auto" onScroll={handleScroll}>
            {filteredItems.length > 0 ? (
              filteredItems.map(item => {
                const v = getValue(item);
                const isSelected = value.includes(v);
                const isDisabled = !isSelected && !!maxSelections && value.length >= maxSelections;
                return (
                  <button
                    key={v}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => !isDisabled && handleToggle(v, item)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 border-b border-slate-100 dark:border-white/5 last:border-b-0 text-xs font-mono transition-colors
                      ${isSelected ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-slate-50 dark:hover:bg-white/5"}
                      ${isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors
                      ${isSelected ? "bg-blue-600 border-blue-600 dark:bg-blue-500 dark:border-blue-500" : "border-slate-300 dark:border-white/20"}`}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <div className="flex flex-col flex-1 min-w-0 text-left">
                      <span className={`truncate ${isSelected ? "text-blue-800 dark:text-blue-300 font-semibold" : "text-slate-700 dark:text-white/70"}`}>{getLabel(item)}</span>
                      {getSubLabel && <span className="text-[10px] text-slate-400 dark:text-white/30">{getSubLabel(item)}</span>}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-8 text-center text-xs font-mono text-slate-400 dark:text-white/30">No results found</div>
            )}
            {isLoading && hasMore && <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-slate-400 dark:text-white/30" /></div>}
          </div>

          {value.length > 0 && (
            <div className="px-3 py-1.5 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 text-[10px] font-mono text-slate-500 dark:text-white/30">
              {value.length}{totalCount ? ` / ${totalCount}` : maxSelections ? ` / ${maxSelections} max` : ""} selected
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

export default MultiSelectSearch;
