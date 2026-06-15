"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, ShoppingCart, Minus, Plus, Trash2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../providers/AuthProvider";
import {
  fetchClientAddresses,
  createInventoryOrder,
  fetchProductCatalog,
  fetchTroubleshootingByProduct,
  fetchDesignTreeById,
  ApiClientAddress,
  ApiProductCatalog,
  DesignTreeNode,
  CreateOrderPayload
} from "../../lib/api";

interface CartItem {
  product_id: string;        // UUID of the product
  product_display_id: string; // PROD-XXXXXX identifier
  product_name: string;
  quantity: number;
  availableDesigns: Array<{ design_id: string; design_uuid: string; tree_id?: string; design_name?: string }>;
  selectedDesignUuids: string[];
  selectedPartMeta: Record<string, { name: string; design_id?: string; quantity?: number; design_type?: string }>;
}

interface AddOrderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  preSelectedParts?: Array<{ id: string; part_number: string; name: string; product_id: string; product_name: string }>;
  onOrderPlaced?: () => void;
}

function flattenTree(node: DesignTreeNode, depth = 0): Array<{ node: DesignTreeNode; depth: number }> {
  return [{ node, depth }, ...(node.children ?? []).flatMap((c) => flattenTree(c, depth + 1))];
}

// ── Per-product sub-assembly selector ──
function ProductPartsSelector({
  productUuid,
  designs,
  selectedIds,
  selectedPartMeta,
  onPartToggle,
  onPartQtyChange
}: {
  productUuid: string;
  designs: Array<{ design_id: string; design_uuid: string; tree_id?: string; design_name?: string }>;
  selectedIds: string[];
  selectedPartMeta: Record<string, { name: string; design_id?: string; quantity?: number; design_type?: string }>;
  onPartToggle: (part: { id: string; name: string; design_id?: string; design_type?: string }) => void;
  onPartQtyChange: (partId: string, delta: number) => void;
}) {
  const [designTrees, setDesignTrees] = useState<DesignTreeNode[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const treeIds = designs.map((d) => d.tree_id).filter(Boolean) as string[];
    if (treeIds.length === 0) return;

    setLoading(true);
    Promise.all(treeIds.map((id) => fetchDesignTreeById(id))).then((trees) => {
      if (!active) return;
      setDesignTrees(trees.filter((t): t is DesignTreeNode => !!t));
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [designs]);

  const flattenedParts = useMemo(() => {
    return designTrees.flatMap((t) => flattenTree(t)).map(({ node, depth }) => ({
      id: node.design_id,
      name: node.design_name,
      type: node.design_type,
      depth,
    }));
  }, [designTrees]);

  if (flattenedParts.length === 0) return null;

  return (
    <div className="mt-3 border-t border-white/5 pt-3 space-y-2">
      <label className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/80 block">
        Sub-Assembly Parts (Optional)
      </label>
      {loading ? (
        <div className="flex items-center gap-1.5 text-white/30 text-[10px] font-mono py-1">
          <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
          Mapping design tree…
        </div>
      ) : (
        <div className="max-h-48 overflow-y-auto space-y-1.5 bg-[#07090e]/60 rounded-lg p-2 border border-white/5">
          {flattenedParts.map((part) => {
            const isSelected = selectedIds.includes(part.id);
            const meta = selectedPartMeta[part.id];
            const qty = meta?.quantity ?? 1;

            return (
              <div key={part.id} className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => onPartToggle({ id: part.id, name: part.name, design_id: part.id, design_type: part.type })}
                  style={{ paddingLeft: part.depth * 10 }}
                  className={`w-full text-left py-1 text-[10px] font-mono rounded transition flex items-center justify-between group ${
                    isSelected ? "text-cyan-300 bg-cyan-400/[0.05]" : "text-white/40 hover:bg-white/3"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-3 h-3 rounded border shrink-0 flex items-center justify-center transition-colors ${
                      isSelected ? "bg-cyan-500 border-cyan-500" : "border-white/20 group-hover:border-white/40"
                    }`}>
                      {isSelected && <span className="w-1 h-1 bg-black rounded-sm" />}
                    </span>
                    <span className="truncate">{part.name}</span>
                  </div>
                  {part.type && (
                    <span className="text-[9px] px-1 py-0.25 bg-white/5 border border-white/8 text-white/30 rounded shrink-0 ml-2">
                      {part.type}
                    </span>
                  )}
                </button>

                {isSelected && (
                  <div style={{ paddingLeft: part.depth * 10 + 20 }} className="flex items-center gap-2 pb-1">
                    <span className="text-[9px] font-mono text-white/30">Qty:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onPartQtyChange(part.id, -1)}
                        disabled={qty <= 1}
                        className="w-5 h-5 rounded border border-white/10 hover:border-white/20 text-white/60 flex items-center justify-center text-[10px] transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5"
                      >
                        -
                      </button>
                      <span className="w-6 text-center text-[10px] font-mono font-bold text-white/80">{qty}</span>
                      <button
                        type="button"
                        onClick={() => onPartQtyChange(part.id, 1)}
                        className="w-5 h-5 rounded border border-white/10 hover:border-white/20 text-white/60 flex items-center justify-center text-[10px] transition hover:bg-white/5"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AddOrderDrawer({ isOpen, onClose, preSelectedParts, onOrderPlaced }: AddOrderDrawerProps) {
  const { user, clients } = useAuth();

  const [catalog, setCatalog] = useState<ApiProductCatalog[]>([]);
  const [addresses, setAddresses] = useState<ApiClientAddress[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  
  const [selectedBilling, setSelectedBilling] = useState("");
  const [selectedShipping, setSelectedShipping] = useState("");

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [productSearch, setProductSearch] = useState("");
  const [showSearchList, setShowSearchList] = useState(false);

  // Compute IDs
  const loggedInClientId = useMemo(() => {
    return user?.client?.id ?? clients[0]?.id ?? user?.clientIds?.[0] ?? "";
  }, [user, clients]);

  const userId = useMemo(() => user?.id ?? "", [user]);

  // Load product catalog + addresses
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setProductSearch("");

    const promises: Promise<any>[] = [fetchProductCatalog()];
    if (loggedInClientId) {
      promises.push(fetchClientAddresses(loggedInClientId));
    }

    Promise.all(promises).then(async ([products, addrList = []]: any) => {
      setCatalog(products);
      setAddresses(addrList);

      // Pre-select billing and shipping addresses if available
      const billAddr = addrList.find((a: ApiClientAddress) => a.addressType === "bill_to" || a.addressType === "both");
      const shipAddr = addrList.find((a: ApiClientAddress) => a.addressType === "ship_to" || a.addressType === "both");
      
      if (billAddr) setSelectedBilling(billAddr.id);
      if (shipAddr) setSelectedShipping(shipAddr.id);

      // Build cart from preSelectedParts
      if (preSelectedParts && preSelectedParts.length > 0 && products.length > 0) {
        // Group by product_id
        const productMap = new Map<string, Array<typeof preSelectedParts[0]>>();
        preSelectedParts.forEach((part) => {
          // Find matching product catalog record by product_id display string (e.g. PROD-DEMO-GNT)
          const prodRecord = products.find((p: any) => p.product_id === part.product_id || p.id === part.product_id);
          if (prodRecord) {
            const existing = productMap.get(prodRecord.id) || [];
            productMap.set(prodRecord.id, [...existing, part]);
          }
        });

        const initialCart: CartItem[] = [];
        for (const [prodUuid, parts] of productMap.entries()) {
          const prodRecord = products.find((p: any) => p.id === prodUuid)!;
          
          // Fetch designs
          const designInfo = await fetchTroubleshootingByProduct(prodUuid);
          const availableDesigns = (designInfo.data ?? []).map((node) => ({
            design_id: node.design_id,
            design_uuid: node.design_uuid,
            tree_id: node.drawing_files?.[0]?.id || node.kb_files?.[0]?.id || undefined, // Dummy mapping to tree_id
            design_name: node.design_name,
            design_type: node.design_type,
          }));

          const selectedDesignUuids: string[] = [];
          const selectedPartMeta: Record<string, any> = {};

          parts.forEach((p) => {
            // Find in designs
            const matchedDesign = availableDesigns.find(
              (d) => d.design_id === p.part_number || d.design_name.toLowerCase().includes(p.name.toLowerCase())
            );
            if (matchedDesign) {
              selectedDesignUuids.push(matchedDesign.design_id);
              selectedPartMeta[matchedDesign.design_id] = {
                name: matchedDesign.design_name,
                design_id: matchedDesign.design_id,
                quantity: 1,
                design_type: matchedDesign.design_type,
              };
            }
          });

          initialCart.push({
            product_id: prodUuid,
            product_display_id: prodRecord.product_id,
            product_name: prodRecord.product_name,
            quantity: 1,
            availableDesigns: availableDesigns as any,
            selectedDesignUuids,
            selectedPartMeta,
          });
        }
        setCart(initialCart);
      } else {
        setCart([]);
      }
      setLoading(false);
    });
  }, [isOpen, loggedInClientId, preSelectedParts]);

  // Handle adding product to cart
  const handleAddProduct = async (product: ApiProductCatalog) => {
    setShowSearchList(false);
    setProductSearch("");

    // Check if already in cart
    if (cart.some((item) => item.product_id === product.id)) return;

    setLoading(true);
    // Fetch product sub-assemblies/designs
    const designInfo = await fetchTroubleshootingByProduct(product.id);
    const availableDesigns = (designInfo.data ?? []).map((node) => ({
      design_id: node.design_id,
      design_uuid: node.design_uuid,
      tree_id: node.drawing_files?.[0]?.id || node.kb_files?.[0]?.id || undefined,
      design_name: node.design_name,
      design_type: node.design_type,
    }));

    setCart((prev) => [
      ...prev,
      {
        product_id: product.id,
        product_display_id: product.product_id,
        product_name: product.product_name,
        quantity: 1,
        availableDesigns: availableDesigns as any,
        selectedDesignUuids: [],
        selectedPartMeta: {},
      },
    ]);
    setLoading(false);
  };

  // Modify product quantity
  const updateProductQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product_id === productId
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item
      )
    );
  };

  // Remove product from cart
  const removeProduct = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product_id !== productId));
  };

  // Toggle sub-assembly part selection
  const handlePartToggle = (
    productId: string,
    part: { id: string; name: string; design_id?: string; design_type?: string }
  ) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product_id !== productId) return item;

        const isSelected = item.selectedDesignUuids.includes(part.id);
        const nextUuids = isSelected
          ? item.selectedDesignUuids.filter((x) => x !== part.id)
          : [...item.selectedDesignUuids, part.id];

        const nextMeta = { ...item.selectedPartMeta };
        if (isSelected) {
          delete nextMeta[part.id];
        } else {
          nextMeta[part.id] = {
            name: part.name,
            design_id: part.design_id,
            quantity: 1,
            design_type: part.design_type,
          };
        }

        return {
          ...item,
          selectedDesignUuids: nextUuids,
          selectedPartMeta: nextMeta,
        };
      })
    );
  };

  // Modify part quantity
  const handlePartQtyChange = (productId: string, partId: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product_id !== productId) return item;
        const meta = item.selectedPartMeta[partId];
        if (!meta) return item;

        return {
          ...item,
          selectedPartMeta: {
            ...item.selectedPartMeta,
            [partId]: {
              ...meta,
              quantity: Math.max(1, (meta.quantity ?? 1) + delta),
            },
          },
        };
      })
    );
  };

  // Filter products for search selector.
  // When query is empty show all un-carted products (up to 8); typing narrows the list.
  const filteredProducts = useMemo(() => {
    const s = productSearch.toLowerCase().trim();
    const available = catalog.filter((p) => !cart.some((c) => c.product_id === p.id));
    if (!s) return available.slice(0, 8);
    return available
      .filter((p) => p.product_name.toLowerCase().includes(s) || p.product_id.toLowerCase().includes(s))
      .slice(0, 8);
  }, [catalog, productSearch, cart]);

  // Place order
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggedInClientId) {
      toast.error("No authenticated client associated with your user session.");
      return;
    }
    if (cart.length === 0) {
      toast.error("Please add at least one product to your order.");
      return;
    }
    if (!selectedBilling || !selectedShipping) {
      toast.error("Both Billing and Shipping addresses are required.");
      return;
    }

    setSubmitting(true);

    // Prepare design parts json
    const allSelectedParts = cart.flatMap((item) =>
      item.selectedDesignUuids.map((uuid) => {
        const m = item.selectedPartMeta[uuid];
        const fullDesignInfo = item.availableDesigns.find((d) => d.design_id === uuid);

        return {
          product_id: item.product_id,
          design_uuid: fullDesignInfo?.design_uuid || uuid,
          design_version_uuid: null,
          design_name: m?.name ?? null,
          design_id: m?.design_id ?? null,
          quantity: m?.quantity ?? 1,
          design_type: m?.design_type ?? null,
        };
      })
    );

    const design_parts_json =
      allSelectedParts.length > 0 ? JSON.stringify(allSelectedParts) : undefined;

    const payload: CreateOrderPayload = {
      client_id: loggedInClientId,
      user_id: userId,
      billing_address: selectedBilling,
      shipping_address: selectedShipping,
      items: cart.map((c) => ({ product_id: c.product_id, quantity: c.quantity })),
      design_parts_json,
    };

    try {
      await createInventoryOrder(payload);
      toast.success("Order dispatched successfully!");
      setCart([]);
      setTimeout(() => {
        onOrderPlaced?.();
        onClose();
      }, 1200);
    } catch (err: any) {
      toast.error(err.message || "Failed to dispatch order. Check your input.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end font-mono">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />

      {/* Slideout deck */}
      <div className="relative z-50 w-[520px] h-full bg-[#090b10] border-l border-white/5 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden">
        {/* Header */}
        <div className="h-12 shrink-0 border-b border-white/5 flex items-center justify-between px-4">
          <span className="text-sm font-semibold tracking-wider text-white/70 uppercase">
            🚀 Dispatch Purchase Order
          </span>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main form */}
        <form onSubmit={handlePlaceOrder} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Auto-populated details */}
            <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-[#06b6d4] uppercase tracking-widest">
                  Client Portal Context
                </span>
                <span className="text-[8px] bg-cyan-400/15 border border-cyan-400/20 text-cyan-200 px-2 py-0.5 rounded font-bold">
                  AUTO-POPULATED
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[9px] text-white/30 block mb-0.5">Operator ID</span>
                  <span className="text-white/75 truncate block">
                    {user?.firstName} {user?.lastName} ({user?.email})
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-white/30 block mb-0.5">Client Node</span>
                  <span className="text-white/75 truncate block">
                    {user?.client?.name || clients[0]?.name || "Local Facility Node"}
                  </span>
                </div>
              </div>
            </div>

            {/* Address Selectors */}
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-bold text-white/40 uppercase tracking-wider block mb-1.5">
                  Billing Address
                </label>
                <select
                  value={selectedBilling}
                  onChange={(e) => setSelectedBilling(e.target.value)}
                  className="w-full h-10 rounded-lg border border-white/10 bg-[#0c0e16] text-xs text-white px-3 focus:outline-none focus:border-cyan-400/40"
                  required
                >
                  <option value="" disabled>Select billing location…</option>
                  {addresses
                    .filter((a) => a.addressType === "bill_to" || a.addressType === "both")
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.siteCode ? `[${a.siteCode}] ` : ""}{a.address}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-[9px] font-bold text-white/40 uppercase tracking-wider block mb-1.5">
                  Shipping Address
                </label>
                <select
                  value={selectedShipping}
                  onChange={(e) => setSelectedShipping(e.target.value)}
                  className="w-full h-10 rounded-lg border border-white/10 bg-[#0c0e16] text-xs text-white px-3 focus:outline-none focus:border-cyan-400/40"
                  required
                >
                  <option value="" disabled>Select shipping location…</option>
                  {addresses
                    .filter((a) => a.addressType === "ship_to" || a.addressType === "both")
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.siteCode ? `[${a.siteCode}] ` : ""}{a.address}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Add Products Search */}
            <div className="relative">
              <label className="text-[9px] font-bold text-white/40 uppercase tracking-wider block mb-1.5">
                Add Products to Order
              </label>
              <input
                type="text"
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  setShowSearchList(true);
                }}
                onFocus={() => setShowSearchList(true)}
                onBlur={() => setTimeout(() => setShowSearchList(false), 150)}
                placeholder="Search or click to browse products…"
                className="w-full h-10 bg-[#0c0e16] border border-white/10 text-xs text-white px-3 rounded-lg focus:outline-none focus:border-cyan-400/40 placeholder:text-white/20"
              />

              {showSearchList && (
                <div className="absolute z-10 left-0 right-0 mt-1 bg-[#0c0e16] border border-white/10 rounded-lg shadow-xl overflow-hidden max-h-52 overflow-y-auto">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleAddProduct(p)}
                        className="w-full text-left px-3 py-2.5 hover:bg-white/5 border-b border-white/5 last:border-0 text-xs text-white flex justify-between items-center gap-2 transition"
                      >
                        <span className="font-medium truncate">{p.product_name}</span>
                        <span className="text-[9px] text-[#06b6d4] font-mono shrink-0">{p.product_id}</span>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-3 text-[10px] font-mono text-white/30 text-center">
                      {catalog.length === 0 ? "Loading catalog…" : "All products already added"}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Cart Items */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <ShoppingCart className="w-4 h-4 text-cyan-200" />
                <span className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Selected Items ({cart.length})
                </span>
              </div>

              {loading && cart.length === 0 ? (
                <div className="flex justify-center py-6 text-white/30 text-xs gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  Staging product components…
                </div>
              ) : cart.length === 0 ? (
                <div className="py-10 border border-dashed border-white/5 rounded-xl flex flex-col items-center justify-center text-white/25">
                  <ShoppingCart className="w-8 h-8 opacity-25 mb-2" />
                  <span className="text-xs">No products in cart</span>
                  <span className="text-[9px] mt-1">Search and select items above to build order</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div
                      key={item.product_id}
                      className="bg-white/3 border border-white/8 rounded-xl p-4 space-y-3 shadow-inner"
                    >
                      {/* Product Header Row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="block truncate text-xs font-bold text-white/90">
                            {item.product_name}
                          </span>
                          <span className="text-[9px] font-mono text-cyan-200/50 block mt-0.5">
                            {item.product_display_id}
                          </span>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1.5 bg-[#090b10] border border-white/10 rounded-md p-1">
                            <button
                              type="button"
                              onClick={() => updateProductQty(item.product_id, -1)}
                              className="w-5 h-5 flex items-center justify-center text-xs text-white/60 hover:text-white hover:bg-white/5 rounded transition"
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center text-xs font-bold font-mono text-cyan-200">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateProductQty(item.product_id, 1)}
                              className="w-5 h-5 flex items-center justify-center text-xs text-white/60 hover:text-white hover:bg-white/5 rounded transition"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeProduct(item.product_id)}
                            className="w-7 h-7 flex items-center justify-center border border-rose-500/20 text-rose-400 hover:text-rose-200 hover:bg-rose-500/10 rounded-lg transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Sub-assembly parts selector */}
                      {item.availableDesigns.length > 0 && (
                        <ProductPartsSelector
                          productUuid={item.product_id}
                          designs={item.availableDesigns}
                          selectedIds={item.selectedDesignUuids}
                          selectedPartMeta={item.selectedPartMeta}
                          onPartToggle={(part) => handlePartToggle(item.product_id, part)}
                          onPartQtyChange={(partId, delta) => handlePartQtyChange(item.product_id, partId, delta)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer Deck */}
          <div className="h-16 shrink-0 border-t border-white/5 bg-[#090b10]/95 px-4 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || cart.length === 0}
              className="flex-1 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs uppercase tracking-wider rounded-lg transition disabled:bg-white/5 disabled:text-white/20 border border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)] flex items-center justify-center gap-1.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Dispatching…
                </>
              ) : (
                "Place Order"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
