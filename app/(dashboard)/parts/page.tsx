"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowDownUp,
  Box,
  CalendarClock,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Filter,
  History,
  Loader2,
  MapPin,
  PackageCheck,
  PackageSearch,
  Search,
  SlidersHorizontal,
  Truck,
} from "lucide-react";
import {
  ApiPartCatalogItem,
  ApiPartOrderHistoryItem,
  fetchPartOrderHistory,
  fetchPartsCatalog,
} from "@/lib/api";
import { fuzzyAny } from "@/lib/search";

function statusClass(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes("low")) return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  if (normalized.includes("out") || normalized.includes("hold")) return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  if (normalized.includes("transit") || normalized.includes("pending")) return "border-sky-400/30 bg-sky-400/10 text-sky-200";
  return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
}

function formatDate(value?: string | null): string {
  if (!value) return "No recent order";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function currency(value: number): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value < 1 ? 2 : 0,
  }).format(value);
}

export default function PartsPage() {
  const [parts, setParts] = useState<ApiPartCatalogItem[]>([]);
  const [history, setHistory] = useState<ApiPartOrderHistoryItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [showHistory, setShowHistory] = useState(true);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 12;

  useEffect(() => {
    let cancelled = false;
    async function loadParts() {
      setLoading(true);
      const [catalog, orderHistory] = await Promise.all([
        fetchPartsCatalog(),
        fetchPartOrderHistory(),
      ]);
      if (cancelled) return;
      setParts(catalog);
      setHistory(orderHistory);
      setSelectedId(catalog[0]?.id ?? "");
      setLoading(false);
    }
    loadParts();
    return () => {
      cancelled = true;
    };
  }, []);

  const typeOptions = useMemo(() => {
    const types = Array.from(new Set(parts.map((part) => part.type).filter(Boolean))).sort();
    return ["All", ...types];
  }, [parts]);

  const filteredParts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return parts.filter((part) => {
      const matchesType = typeFilter === "All" || part.type === typeFilter;
      const matchesQuery =
        !normalized ||
        fuzzyAny([part.name, part.part_number, part.product_name, part.supplier, part.type, part.location], normalized);
      return matchesType && matchesQuery;
    });
  }, [parts, query, typeFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredParts.length / pageSize));
  const pagedParts = filteredParts.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (!filteredParts.length) {
      setSelectedId("");
      return;
    }
    if (!filteredParts.some((part) => part.id === selectedId)) {
      setSelectedId(filteredParts[0].id);
    }
  }, [filteredParts, selectedId]);

  const selectedPart = useMemo(
    () => parts.find((part) => part.id === selectedId) ?? filteredParts[0],
    [filteredParts, parts, selectedId],
  );

  const selectedHistory = useMemo(() => {
    if (!selectedPart) return [];
    return history.filter(
      (entry) =>
        entry.part_id === selectedPart.id ||
        entry.part_id === selectedPart.part_number ||
        entry.part_name.toLowerCase().includes(selectedPart.name.toLowerCase().slice(0, 16)),
    );
  }, [history, selectedPart]);

  const lowStockCount = parts.filter((part) => part.stock <= part.reorder_point).length;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[#06070a] text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-5 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-cyan-200">
              <PackageSearch className="h-3.5 w-3.5" />
              Parts Control
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Parts Catalog</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/50">
              Search serviceable assemblies and components, inspect inventory thresholds, and review order movement from one work surface.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-wider text-white/35">Catalog</p>
              <p className="mt-1 text-lg font-semibold">{parts.length}</p>
            </div>
            <div className="rounded border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-wider text-white/35">Low Stock</p>
              <p className="mt-1 text-lg font-semibold text-amber-200">{lowStockCount}</p>
            </div>
            <div className="rounded border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-wider text-white/35">Orders</p>
              <p className="mt-1 text-lg font-semibold text-cyan-200">{history.length}</p>
            </div>
          </div>
        </header>

        <section className="grid min-h-[680px] grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)]">
          <div className="min-w-0 rounded border border-white/10 bg-[#0b0e14]">
            <div className="flex flex-col gap-3 border-b border-white/10 p-4 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by part, product, supplier, or number"
                  className="h-10 w-full rounded border border-white/10 bg-white/[0.04] pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-cyan-400/50"
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                  <select
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value)}
                    className="h-10 min-w-44 appearance-none rounded border border-white/10 bg-[#111722] pl-10 pr-8 text-xs text-white outline-none focus:border-cyan-400/50"
                  >
                    {typeOptions.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded border border-white/10 bg-white/[0.04] text-white/60 transition hover:border-white/20 hover:text-white"
                  title="Sort catalog"
                  aria-label="Sort catalog"
                >
                  <ArrowDownUp className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-[1fr_120px_110px_120px] border-b border-white/10 px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-white/35">
              <span>Part</span>
              <span>Stock</span>
              <span>Status</span>
              <span className="text-right">Lead Time</span>
            </div>

            <div className="min-h-[520px]">
              {loading ? (
                <div className="flex h-[520px] items-center justify-center gap-3 text-sm text-white/45">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading parts catalog
                </div>
              ) : filteredParts.length ? (
                pagedParts.map((part) => (
                  <button
                    type="button"
                    key={part.id}
                    onClick={() => setSelectedId(part.id)}
                    className={`grid w-full grid-cols-[1fr_120px_110px_120px] items-center gap-3 border-b border-white/5 px-4 py-4 text-left transition hover:bg-white/[0.04] ${
                      selectedPart?.id === part.id ? "bg-cyan-400/[0.08]" : ""
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-white/10 bg-white/[0.04]">
                          <Box className="h-4 w-4 text-cyan-200" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-white">{part.name}</span>
                          <span className="mt-1 flex min-w-0 items-center gap-2 text-xs text-white/40">
                            <span className="font-mono">{part.part_number}</span>
                            <ChevronRight className="h-3 w-3 shrink-0" />
                            <span className="truncate">{part.product_name}</span>
                          </span>
                        </span>
                      </span>
                    </span>
                    <span className="font-mono text-sm text-white/80">
                      {part.stock}
                      <span className="ml-1 text-xs text-white/30">pcs</span>
                    </span>
                    <span>
                      <span className={`inline-flex rounded border px-2 py-1 text-[10px] font-mono uppercase ${statusClass(part.status)}`}>
                        {part.status}
                      </span>
                    </span>
                    <span className="text-right text-sm text-white/65">{part.lead_time_days} days</span>
                  </button>
                ))
              ) : (
                <div className="flex h-[520px] items-center justify-center text-sm text-white/45">
                  No parts match the current filters.
                </div>
              )}
            </div>

            {filteredParts.length > pageSize && (
              <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
                <span className="text-[10px] font-mono text-white/35">
                  Page {page} / {totalPages} · {filteredParts.length} parts
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    className="rounded border border-white/10 px-3 py-1.5 text-xs text-white/50 transition hover:bg-white/5 disabled:opacity-30"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                    className="rounded border border-white/10 px-3 py-1.5 text-xs text-white/50 transition hover:bg-white/5 disabled:opacity-30"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          <aside className="min-w-0 rounded border border-white/10 bg-[#0b0e14]">
            {selectedPart ? (
              <>
                <div className="border-b border-white/10 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-200">{selectedPart.part_number}</p>
                      <h2 className="mt-2 text-xl font-semibold leading-snug text-white">{selectedPart.name}</h2>
                      <p className="mt-1 text-sm text-white/45">{selectedPart.product_name}</p>
                    </div>
                    <span className={`shrink-0 rounded border px-2.5 py-1 text-[10px] font-mono uppercase ${statusClass(selectedPart.status)}`}>
                      {selectedPart.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 p-5">
                  <div className="rounded border border-white/10 bg-white/[0.03] p-4">
                    <PackageCheck className="mb-3 h-4 w-4 text-emerald-200" />
                    <p className="font-mono text-[10px] uppercase tracking-wider text-white/35">Stock</p>
                    <p className="mt-1 text-2xl font-semibold">{selectedPart.stock}</p>
                    <p className="text-xs text-white/40">Reorder at {selectedPart.reorder_point}</p>
                  </div>
                  <div className="rounded border border-white/10 bg-white/[0.03] p-4">
                    <CircleDollarSign className="mb-3 h-4 w-4 text-amber-200" />
                    <p className="font-mono text-[10px] uppercase tracking-wider text-white/35">Unit Cost</p>
                    <p className="mt-1 text-2xl font-semibold">{currency(selectedPart.unit_cost)}</p>
                    <p className="text-xs text-white/40">{selectedPart.lead_time_days} day lead</p>
                  </div>
                </div>

                <div className="space-y-3 border-t border-white/10 p-5">
                  <div className="flex items-center gap-3 rounded border border-white/10 bg-white/[0.03] p-3">
                    <SlidersHorizontal className="h-4 w-4 text-white/45" />
                    <div className="min-w-0">
                      <p className="text-xs text-white/35">Type</p>
                      <p className="truncate text-sm text-white/85">{selectedPart.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded border border-white/10 bg-white/[0.03] p-3">
                    <MapPin className="h-4 w-4 text-white/45" />
                    <div className="min-w-0">
                      <p className="text-xs text-white/35">Location</p>
                      <p className="truncate text-sm text-white/85">{selectedPart.location}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded border border-white/10 bg-white/[0.03] p-3">
                    <Truck className="h-4 w-4 text-white/45" />
                    <div className="min-w-0">
                      <p className="text-xs text-white/35">Supplier</p>
                      <p className="truncate text-sm text-white/85">{selectedPart.supplier}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded border border-white/10 bg-white/[0.03] p-3">
                    <CalendarClock className="h-4 w-4 text-white/45" />
                    <div className="min-w-0">
                      <p className="text-xs text-white/35">Last Ordered</p>
                      <p className="truncate text-sm text-white/85">{formatDate(selectedPart.last_ordered)}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/10 p-5">
                  <button
                    type="button"
                    onClick={() => setShowHistory((value) => !value)}
                    className="flex h-10 w-full items-center justify-between rounded border border-white/10 bg-white/[0.04] px-3 text-sm text-white transition hover:border-cyan-400/30"
                  >
                    <span className="flex items-center gap-2">
                      <History className="h-4 w-4 text-cyan-200" />
                      Order History
                    </span>
                    <span className="font-mono text-xs text-white/45">{showHistory ? "Hide" : "Show"}</span>
                  </button>

                  {showHistory && (
                    <div className="mt-3 space-y-2">
                      {(selectedHistory.length ? selectedHistory : history.slice(0, 4)).map((entry) => (
                        <div key={entry.id} className="rounded border border-white/10 bg-white/[0.03] p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-mono text-xs text-white/80">{entry.order_id}</p>
                              <p className="mt-1 truncate text-xs text-white/40">{entry.client_name || entry.part_name}</p>
                            </div>
                            <span className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-mono uppercase ${statusClass(entry.status)}`}>
                              {entry.status}
                            </span>
                          </div>
                          <div className="mt-3 flex items-center justify-between text-xs text-white/45">
                            <span>Qty {entry.quantity}</span>
                            <span>{formatDate(entry.ordered_at)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex h-full min-h-[520px] flex-col items-center justify-center gap-3 p-8 text-center text-white/45">
                <ClipboardList className="h-8 w-8" />
                <p className="text-sm">Select a part to inspect details.</p>
              </div>
            )}
          </aside>
        </section>
      </div>
    </div>
  );
}
