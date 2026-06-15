"use client";

import React, { useEffect, useLayoutEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, X, Loader2 } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";

export interface SelectSearchProps<T> {
  items: T[];
  value?: string;
  onChange: (value: string, item?: T) => void;
  getValue: (item: T) => string;
  getLabel: (item: T) => React.ReactNode;
  getSelectedLabel?: (item: T) => React.ReactNode;
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
  clearable?: boolean;
  required?: boolean;
}

function SelectSearch<T>({
  items,
  value = "",
  onChange,
  getValue,
  getLabel,
  getSelectedLabel,
  getSubLabel,
  searchMode = "client",
  searchBy,
  onSearch,
  placeholder = "Select option",
  searchPlaceholder = "Search…",
  label,
  disabled = false,
  isLoading = false,
  error = false,
  helperText,
  onLoadMore,
  hasMore = false,
  clearable = true,
  required = false,
}: SelectSearchProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({ position: "fixed", top: 0, left: 0, width: 0, zIndex: 9999 });
  const [optionsMaxHeight, setOptionsMaxHeight] = useState(240);
  const [positionReady, setPositionReady] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebounce(search, 400);
  const selectedItem = items.find((item) => getValue(item) === value);

  useEffect(() => {
    if (searchMode !== "server" || !open) return;
    onSearch?.(debouncedSearch);
  }, [debouncedSearch, searchMode, onSearch, open]);

  const filteredItems = useMemo(() => {
    if (searchMode === "server") return items;
    if (!search.trim() || !searchBy) return items;
    const q = search.toLowerCase();
    return items.filter((item) => searchBy(item).toLowerCase().includes(q));
  }, [items, search, searchBy, searchMode]);

  const closeDropdown = () => {
    setOpen(false);
    setSearch("");
    setPositionReady(false);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!wrapperRef.current?.contains(t) && !dropdownRef.current?.contains(t)) closeDropdown();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    const panelH = Math.max(120, Math.min(320, openUp ? spaceAbove : spaceBelow));

    setDropdownStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
      ...(openUp ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }),
    });
    setOptionsMaxHeight(Math.max(80, panelH - 64));
    setPositionReady(true);

    const reposition = () => {
      const r = wrapper.getBoundingClientRect();
      setDropdownStyle(prev => ({ ...prev, left: r.left, width: r.width, ...(openUp ? { bottom: window.innerHeight - r.top + 8 } : { top: r.bottom + 8 }) }));
    };
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => { window.removeEventListener("resize", reposition); window.removeEventListener("scroll", reposition, true); };
  }, [open]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el || !hasMore || isLoading) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 5) onLoadMore?.();
  };

  return (
    <div className="relative">
      {label && (
        <label className={`block text-[10px] font-mono uppercase tracking-widest mb-1.5 ${error ? "text-red-500" : "text-slate-500 dark:text-white/40"}`}>
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      <div ref={wrapperRef}>
        <div
          onClick={() => { if (!disabled && !isLoading) setOpen(o => !o); }}
          className={`relative flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-mono transition-all cursor-pointer
            bg-white dark:bg-white/5
            ${error ? "border-red-400 dark:border-red-500/50" : open ? "border-blue-400 dark:border-blue-500/50 ring-2 ring-blue-100 dark:ring-blue-500/10" : "border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20"}
            ${disabled || isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <span className={`flex-1 truncate ${selectedItem ? "text-slate-900 dark:text-white/80" : "text-slate-400 dark:text-white/30"}`}>
            {selectedItem ? (getSelectedLabel ? getSelectedLabel(selectedItem) : getLabel(selectedItem)) : placeholder}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {isLoading && <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />}
            {selectedItem && clearable && !disabled && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onChange(""); }}
                className="text-slate-300 dark:text-white/20 hover:text-slate-500 dark:hover:text-white/50 p-0.5"
              >
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

          {/* Options */}
          <div ref={listRef} style={{ maxHeight: optionsMaxHeight }} className="overflow-y-auto" onScroll={handleScroll}>
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => {
                const v = getValue(item);
                const isActive = v === value;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => { onChange(v, item); closeDropdown(); }}
                    className={`w-full text-left flex flex-col px-3 py-2.5 border-b border-slate-100 dark:border-white/5 last:border-b-0 text-xs font-mono transition-colors
                      ${isActive ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold" : "text-slate-700 dark:text-white/70 hover:bg-slate-50 dark:hover:bg-white/5"}`}
                  >
                    <span>{getLabel(item)}</span>
                    {getSubLabel && <span className="text-[10px] text-slate-400 dark:text-white/30">{getSubLabel(item)}</span>}
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-8 text-center text-xs font-mono text-slate-400 dark:text-white/30">No results found</div>
            )}
            {isLoading && hasMore && <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

export default SelectSearch;
