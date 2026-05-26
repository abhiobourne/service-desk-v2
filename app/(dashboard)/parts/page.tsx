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
  Plus,
  ShoppingCart,
  CheckCircle,
  TruckIcon,
  Info,
  Clock
} from "lucide-react";
import {
  ApiPartCatalogItem,
  ApiPartOrderHistoryItem,
  fetchPartOrderHistory,
  fetchPartsCatalog,
  fetchOrdersList
} from "@/lib/api";
import { fuzzyAny } from "@/lib/search";
import { AddOrderDrawer } from "../../../components/order/AddOrderDrawer";

function statusClass(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes("low") || normalized.includes("processing") || normalized.includes("shipped")) 
    return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  if (normalized.includes("out") || normalized.includes("hold") || normalized.includes("cancelled") || normalized.includes("failed")) 
    return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  if (normalized.includes("transit") || normalized.includes("pending")) 
    return "border-sky-400/30 bg-sky-400/10 text-sky-200";
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
  const [activeTab, setActiveTab] = useState<"orders" | "catalog">("catalog");
  const [parts, setParts] = useState<ApiPartCatalogItem[]>([]);
  const [history, setHistory] = useState<ApiPartOrderHistoryItem[]>([]);
  const [detailedOrders, setDetailedOrders] = useState<any[]>([]);
  
  // Selection/State for parts catalog
  const [selectedPartId, setSelectedPartId] = useState<string>("");
  const [checkedPartIds, setCheckedPartIds] = useState<string[]>([]);
  
  // Selection/State for orders history
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pageSize = 12;

  // Load all data
  async function loadData() {
    setLoading(true);
    try {
      const [catalog, orderHistory, orders] = await Promise.all([
        fetchPartsCatalog(),
        fetchPartOrderHistory(),
        fetchOrdersList(),
      ]);
      setParts(catalog);
      setHistory(orderHistory);
      setDetailedOrders(orders);

      if (catalog.length > 0) {
        setSelectedPartId(catalog[0].id);
      }
      if (orders.length > 0) {
        setSelectedOrderId(orders[0].id);
      }
    } catch (err) {
      console.error("Failed to load catalog/orders data", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const typeOptions = useMemo(() => {
    const types = Array.from(new Set(parts.map((part) => part.type).filter(Boolean))).sort();
    return ["All", ...types];
  }, [parts]);

  // Filters for Parts Catalog
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

  // Filters for Orders History
  const filteredOrders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return detailedOrders.filter((order) => {
      const matchesQuery =
        !normalized ||
        fuzzyAny([
          order.order_id,
          order.status,
          order.client_name,
          order.user_name,
          order.shipping_address,
          ...(order.line_items ?? []).map((i: any) => i.product_name)
        ], normalized);
      return matchesQuery;
    });
  }, [detailedOrders, query]);

  useEffect(() => {
    setPage(1);
  }, [query, typeFilter, activeTab]);

  const totalPages = Math.max(1, Math.ceil((activeTab === "catalog" ? filteredParts.length : filteredOrders.length) / pageSize));
  
  const pagedParts = useMemo(() => {
    return filteredParts.slice((page - 1) * pageSize, page * pageSize);
  }, [filteredParts, page]);

  const pagedOrders = useMemo(() => {
    return filteredOrders.slice((page - 1) * pageSize, page * pageSize);
  }, [filteredOrders, page]);

  // Set default selection when filter results change
  useEffect(() => {
    if (activeTab === "catalog") {
      if (!filteredParts.length) {
        setSelectedPartId("");
        return;
      }
      if (!filteredParts.some((part) => part.id === selectedPartId)) {
        setSelectedPartId(filteredParts[0].id);
      }
    } else {
      if (!filteredOrders.length) {
        setSelectedOrderId("");
        return;
      }
      if (!filteredOrders.some((order) => order.id === selectedOrderId)) {
        setSelectedOrderId(filteredOrders[0].id);
      }
    }
  }, [filteredParts, filteredOrders, selectedPartId, selectedOrderId, activeTab]);

  // Resolve selected item objects
  const selectedPart = useMemo(() => {
    return parts.find((part) => part.id === selectedPartId) ?? filteredParts[0];
  }, [filteredParts, parts, selectedPartId]);

  const selectedOrder = useMemo(() => {
    return detailedOrders.find((order) => order.id === selectedOrderId) ?? filteredOrders[0];
  }, [filteredOrders, detailedOrders, selectedOrderId]);

  // Get orders associated with selected part
  const selectedPartHistory = useMemo(() => {
    if (!selectedPart) return [];
    return history.filter(
      (entry) =>
        entry.part_id === selectedPart.id ||
        entry.part_id === selectedPart.part_number ||
        entry.part_name.toLowerCase().includes(selectedPart.name.toLowerCase().slice(0, 16)),
    );
  }, [history, selectedPart]);

  // Toggle checklist select for order cart
  const handleToggleCheckPart = (partId: string) => {
    setCheckedPartIds((prev) =>
      prev.includes(partId) ? prev.filter((id) => id !== partId) : [...prev, partId]
    );
  };

  // Convert checked parts into detailed records for AddOrderDrawer
  const preSelectedDrawerParts = useMemo(() => {
    return checkedPartIds
      .map((id) => {
        const part = parts.find((p) => p.id === id);
        return part
          ? {
              id: part.id,
              part_number: part.part_number,
              name: part.name,
              product_id: part.product_id,
              product_name: part.product_name,
            }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
  }, [checkedPartIds, parts]);

  const lowStockCount = parts.filter((part) => part.stock <= part.reorder_point).length;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[#06070a] text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-5 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-cyan-200">
              <PackageSearch className="h-3.5 w-3.5" />
              Portal Purchase Desk
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Parts & Order History</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/50">
              Select parts catalog nodes to order hardware assemblies, inspect delivery lead times, and track historical orders.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            {/* Quick stats */}
            <div className="flex gap-2 text-xs">
              <div className="rounded border border-white/10 bg-white/[0.03] px-3.5 py-2">
                <p className="font-mono text-[9px] uppercase tracking-wider text-white/35">Low Stock</p>
                <p className="mt-0.5 text-base font-semibold text-amber-200">{lowStockCount}</p>
              </div>
              <div className="rounded border border-white/10 bg-white/[0.03] px-3.5 py-2">
                <p className="font-mono text-[9px] uppercase tracking-wider text-white/35">Total Orders</p>
                <p className="mt-0.5 text-base font-semibold text-cyan-200">{detailedOrders.length}</p>
              </div>
            </div>

            {/* Place Order — count updates when parts are checked */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs uppercase tracking-widest rounded-lg transition duration-200 flex items-center gap-1.5 border border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
            >
              <Plus className="w-4 h-4 text-black" />
              {checkedPartIds.length > 0 ? `Place Order (${checkedPartIds.length})` : "Place Order"}
            </button>
          </div>
        </header>

        {/* Tab Controls */}
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex gap-2 bg-[#0b0e14] p-1 rounded-lg border border-white/5">
            <button
              onClick={() => setActiveTab("catalog")}
              className={`px-4 py-1.5 rounded-md text-xs font-mono tracking-wider transition ${
                activeTab === "catalog"
                  ? "bg-cyan-500/10 border border-cyan-400/20 text-cyan-200"
                  : "text-white/40 hover:text-white/80"
              }`}
            >
              Serviceable Parts Catalog
            </button>
            <button
              onClick={() => setActiveTab("orders")}
              className={`px-4 py-1.5 rounded-md text-xs font-mono tracking-wider transition ${
                activeTab === "orders"
                  ? "bg-cyan-500/10 border border-cyan-400/20 text-cyan-200"
                  : "text-white/40 hover:text-white/80"
              }`}
            >
              Purchase Order History
            </button>
          </div>

          {checkedPartIds.length > 0 && activeTab === "catalog" && (
            <span className="text-xs text-white/55 font-mono">
              {checkedPartIds.length} item{checkedPartIds.length > 1 ? "s" : ""} selected
            </span>
          )}
        </div>

        {/* Search, filters & main body */}
        <section className="grid min-h-[680px] grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)]">
          <div className="min-w-0 rounded border border-white/10 bg-[#0b0e14]">
            {/* Filter Bar */}
            <div className="flex flex-col gap-3 border-b border-white/10 p-4 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={
                    activeTab === "catalog"
                      ? "Search parts catalog by name, supplier, or SKU…"
                      : "Search historical orders by ID, status, client or product…"
                  }
                  className="h-10 w-full rounded border border-white/10 bg-white/[0.04] pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-cyan-400/50"
                />
              </div>

              {activeTab === "catalog" && (
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
              )}
            </div>

            {/* TAB CONTENT: ORDER HISTORY TABLE */}
            {activeTab === "orders" && (
              <>
                <div className="grid grid-cols-[1.2fr_1.5fr_1fr_1.2fr] border-b border-white/10 px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-white/35">
                  <span>Order Node</span>
                  <span>Component / Product Summary</span>
                  <span>Status</span>
                  <span className="text-right">Order Date</span>
                </div>

                <div className="min-h-[520px]">
                  {loading ? (
                    <div className="flex h-[520px] items-center justify-center gap-3 text-sm text-white/45">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Decrypting order database deck
                    </div>
                  ) : filteredOrders.length ? (
                    pagedOrders.map((order) => (
                      <button
                        type="button"
                        key={order.id}
                        onClick={() => setSelectedOrderId(order.id)}
                        className={`grid w-full grid-cols-[1.2fr_1.5fr_1fr_1.2fr] items-center gap-3 border-b border-white/5 px-4 py-4 text-left transition hover:bg-white/[0.04] ${
                          selectedOrder?.id === order.id ? "bg-cyan-400/[0.08]" : ""
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-white/10 bg-white/[0.04]">
                              <ClipboardList className="h-4 w-4 text-cyan-200" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold font-mono text-white">
                                {order.order_id}
                              </span>
                              <span className="mt-0.5 block truncate text-xs text-white/40 font-mono">
                                {order.client_name || "Enterprise Client"}
                              </span>
                            </span>
                          </span>
                        </span>

                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-white/80">
                            {(order.line_items ?? order.items ?? [])[0]?.product_name || "Hardware Package"}
                          </span>
                          <span className="text-[10px] text-white/30 font-mono mt-0.5 block">
                            {(order.line_items ?? order.items ?? []).length} unique line item(s)
                          </span>
                        </span>

                        <span>
                          <span className={`inline-flex rounded border px-2 py-0.5 text-[9px] font-bold font-mono uppercase tracking-wider ${statusClass(order.status)}`}>
                            {order.status}
                          </span>
                        </span>

                        <span className="text-right font-mono text-xs text-white/65">
                          {formatDate(order.createdAt || order.created_at)}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="flex h-[520px] items-center justify-center text-sm text-white/45">
                      No order records match the current filters.
                    </div>
                  )}
                </div>
              </>
            )}

            {/* TAB CONTENT: PARTS CATALOG TABLE */}
            {activeTab === "catalog" && (
              <>
                <div className="grid grid-cols-[30px_1fr_120px_110px_120px] border-b border-white/10 px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-white/35">
                  <span />
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
                      <div
                        key={part.id}
                        className={`grid w-full grid-cols-[30px_1fr_120px_110px_120px] items-center gap-3 border-b border-white/5 px-4 py-3.5 text-left transition hover:bg-white/[0.02] ${
                          selectedPart?.id === part.id ? "bg-cyan-400/[0.04]" : ""
                        }`}
                      >
                        {/* Checkbox selector */}
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={checkedPartIds.includes(part.id)}
                            onChange={() => handleToggleCheckPart(part.id)}
                            className="w-3.5 h-3.5 bg-black border border-white/20 rounded accent-cyan-400 focus:outline-none"
                          />
                        </div>

                        {/* Interactive row body */}
                        <button
                          type="button"
                          onClick={() => setSelectedPartId(part.id)}
                          className="min-w-0 text-left flex items-center gap-3"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-white/10 bg-white/[0.04]">
                            <Box className="h-4 w-4 text-cyan-200" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-white">{part.name}</span>
                            <span className="mt-1 flex min-w-0 items-center gap-2 text-xs text-white/40 font-mono">
                              <span>{part.part_number}</span>
                              <ChevronRight className="h-3 w-3 shrink-0" />
                              <span className="truncate">{part.product_name}</span>
                            </span>
                          </span>
                        </button>

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
                      </div>
                    ))
                  ) : (
                    <div className="flex h-[520px] items-center justify-center text-sm text-white/45">
                      No parts match the current filters.
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Pagination Controls */}
            {((activeTab === "catalog" ? filteredParts.length : filteredOrders.length) > pageSize) && (
              <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
                <span className="text-[10px] font-mono text-white/35">
                  Page {page} / {totalPages} · {activeTab === "catalog" ? filteredParts.length : filteredOrders.length} records
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

          {/* RIGHT SIDEBAR (DYNAMIC BASED ON TAB) */}
          <aside className="min-w-0 rounded border border-white/10 bg-[#0b0e14]">
            {/* SIDEBAR: ACTIVE ORDER DETAILS */}
            {activeTab === "orders" && (
              selectedOrder ? (
                <>
                  {/* Sidebar Header */}
                  <div className="border-b border-white/10 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-200">
                          {selectedOrder.order_id}
                        </p>
                        <h2 className="mt-2 text-base font-semibold leading-snug text-white truncate">
                          {selectedOrder.client_name || "Enterprise Client Node"}
                        </h2>
                        <p className="mt-1 text-xs text-white/40 font-mono">
                          Operator: {selectedOrder.user_name || "Operator ID"}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded border px-2.5 py-1 text-[10px] font-mono uppercase ${statusClass(selectedOrder.status)}`}>
                        {selectedOrder.status}
                      </span>
                    </div>
                  </div>

                  {/* Sidebar quick stats info */}
                  <div className="grid grid-cols-2 gap-3 p-5">
                    <div className="rounded border border-white/10 bg-white/[0.03] p-4">
                      <Clock className="mb-2 h-4 w-4 text-emerald-200" />
                      <p className="font-mono text-[9px] uppercase tracking-wider text-white/35">Dispatched</p>
                      <p className="mt-1 text-sm font-semibold font-mono">
                        {formatDate(selectedOrder.createdAt || selectedOrder.created_at)}
                      </p>
                    </div>
                    <div className="rounded border border-white/10 bg-white/[0.03] p-4">
                      <ShoppingCart className="mb-2 h-4 w-4 text-cyan-200" />
                      <p className="font-mono text-[9px] uppercase tracking-wider text-white/35">Items Count</p>
                      <p className="mt-1 text-sm font-semibold font-mono">
                        {(selectedOrder.line_items ?? selectedOrder.items ?? []).reduce((acc: number, item: any) => acc + (item.quantity || 1), 0)} pcs
                      </p>
                    </div>
                  </div>

                  {/* Addresses */}
                  <div className="space-y-3.5 border-t border-white/10 p-5">
                    <div className="flex items-start gap-3 rounded border border-white/10 bg-white/[0.03] p-3">
                      <MapPin className="h-4 w-4 text-white/45 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[9px] font-mono uppercase text-white/35">Billing Address</p>
                        <p className="text-xs text-white/80 leading-relaxed mt-0.5">
                          {selectedOrder.billing_address || "Standard billing location"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded border border-white/10 bg-white/[0.03] p-3">
                      <Truck className="h-4 w-4 text-white/45 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[9px] font-mono uppercase text-white/35">Shipping Address</p>
                        <p className="text-xs text-white/80 leading-relaxed mt-0.5">
                          {selectedOrder.shipping_address || "Standard shipping location"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Order Line Items */}
                  <div className="border-t border-white/10 p-5 space-y-3">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-[#06b6d4]">
                      Line Items breakdown
                    </p>
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {(selectedOrder.line_items ?? selectedOrder.items ?? []).map((item: any, idx: number) => (
                        <div key={idx} className="rounded-lg border border-white/5 bg-white/3 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-xs font-semibold text-white/80 truncate">
                              {item.product_name || `Product UUID: ${item.product_id}`}
                            </span>
                            <span className="text-xs font-mono font-bold text-cyan-200">
                              Qty {item.quantity || 1}
                            </span>
                          </div>
                          <span className="text-[9px] font-mono text-white/30 block mt-1">
                            {item.product_uuid || item.product_id}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Design sub-assembly parts details */}
                  {selectedOrder.design_parts && selectedOrder.design_parts.length > 0 && (
                    <div className="border-t border-white/10 p-5 space-y-3">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-300">
                        Design Parts / Sub-Assemblies
                      </p>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {selectedOrder.design_parts.map((p: any, idx: number) => (
                          <div key={idx} className="bg-cyan-400/[0.03] border border-cyan-400/10 rounded-lg p-2.5 text-xs">
                            <div className="flex justify-between font-mono">
                              <span className="text-cyan-200/85 font-medium">{p.design_name || "Sub-assembly Part"}</span>
                              <span className="text-cyan-400/90">Qty {p.quantity || 1}</span>
                            </div>
                            {p.design_type && (
                              <span className="text-[9px] bg-white/5 border border-white/8 text-white/40 px-1 py-0.25 rounded font-mono block mt-1 w-max">
                                {p.design_type}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex h-full min-h-[520px] flex-col items-center justify-center gap-3 p-8 text-center text-white/45">
                  <ClipboardList className="h-8 w-8 text-white/20 animate-pulse" />
                  <p className="text-sm font-mono">Select an order node to view metadata breakdown.</p>
                </div>
              )
            )}

            {/* SIDEBAR: ACTIVE PART CATALOG DETAILS */}
            {activeTab === "catalog" && (
              selectedPart ? (
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
                    <div className="flex items-center gap-3 rounded border border-white/10 bg-[#07090e] p-3">
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

                  {/* Part-specific Order History list */}
                  <div className="border-t border-white/10 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <History className="h-4 w-4 text-cyan-200" />
                      <span className="text-xs font-mono font-semibold uppercase text-white/70">
                        Part Order History
                      </span>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {selectedPartHistory.length ? (
                        selectedPartHistory.map((entry) => (
                          <div key={entry.id} className="rounded border border-white/10 bg-[#07090e] p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-mono text-xs font-semibold text-white/80">{entry.order_id}</p>
                                <p className="mt-1 truncate text-[10px] text-white/45">{entry.client_name || "Mumbai Facility Node"}</p>
                              </div>
                              <span className={`shrink-0 rounded border px-2 py-0.5 text-[9px] font-mono uppercase ${statusClass(entry.status)}`}>
                                {entry.status}
                              </span>
                            </div>
                            <div className="mt-3 flex items-center justify-between text-[10px] text-white/35 font-mono">
                              <span>Qty {entry.quantity}</span>
                              <span>{formatDate(entry.ordered_at)}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center justify-center p-6 text-[11px] font-mono text-white/30 border border-dashed border-white/5 rounded-lg">
                          No recent orders for this specific part.
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-full min-h-[520px] flex-col items-center justify-center gap-3 p-8 text-center text-white/45">
                  <ClipboardList className="h-8 w-8 text-white/25" />
                  <p className="text-sm font-mono">Select a serviceable part to inspect details.</p>
                </div>
              )
            )}
          </aside>
        </section>
      </div>

      {/* Slide-out Order Drawer */}
      <AddOrderDrawer
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setCheckedPartIds([]); // Clear selection cart on close
        }}
        preSelectedParts={preSelectedDrawerParts}
        onOrderPlaced={() => {
          loadData(); // Reload orders list and parts
          setActiveTab("orders"); // Switch to orders list automatically
        }}
      />
    </div>
  );
}
