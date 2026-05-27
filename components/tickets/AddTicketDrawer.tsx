"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, ChevronDown, Loader2, Paperclip, Lock } from "lucide-react";
import toast from "react-hot-toast";
import {
  createOrderTicket,
  fetchClients,
  fetchOrdersByClient,
  InventoryOrder,
  ApiClientOption,
  TroubleshootingDesignNode,
} from "../../lib/api";
import { useAuth } from "../../providers/AuthProvider";

interface AddTicketDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
  loggedInClientId?: string | null;
  initialClientId?: string | null;
  /** UUID or display order_id string (e.g. "ORD-380725") */
  initialOrderId?: string | null;
  initialProductId?: string | null;
  selectedPartNodes?: TroubleshootingDesignNode[];
}

interface FormState {
  client_id: string;
  order_id: string;
  product_id: string;
  reason: string;
  description: string;
}

function SelectField({
  label, value, onChange, options, placeholder, disabled, loading, locked,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string; disabled?: boolean; loading?: boolean; locked?: boolean;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1.5">
        {label}
        {locked && <Lock className="w-2.5 h-2.5 text-white/25" />}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || loading || locked}
          className={`w-full appearance-none bg-[#0c0e16] border text-white text-xs font-mono px-3 py-2.5 pr-8 rounded-lg focus:outline-none disabled:cursor-not-allowed ${
            locked
              ? "border-white/5 opacity-50 cursor-not-allowed"
              : "border-white/10 focus:border-violet-500/50 disabled:opacity-40"
          }`}
        >
          <option value="">{loading ? "Loading…" : placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {loading ? (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 animate-spin pointer-events-none" />
        ) : locked ? (
          <Lock className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20 pointer-events-none" />
        ) : (
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
        )}
      </div>
    </div>
  );
}

export function AddTicketDrawer({
  isOpen,
  onClose,
  onCreated,
  loggedInClientId,
  initialClientId,
  initialOrderId,
  initialProductId,
  selectedPartNodes = [],
}: AddTicketDrawerProps) {
  const { user, clients: authClients } = useAuth();

  const [form, setForm] = useState<FormState>({
    client_id: "", order_id: "", product_id: "", reason: "", description: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [attachments, setAttachments] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [clients, setClients] = useState<ApiClientOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [orders, setOrders] = useState<InventoryOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const loggedInUserClientId =
    user?.client?.id ?? authClients?.[0]?.id ?? user?.clientIds?.[0] ?? "";
  const effectiveClientId = loggedInClientId || initialClientId || loggedInUserClientId;

  // On open: fetch client list if no effective client, else set client directly
  useEffect(() => {
    if (!isOpen) return;
    if (effectiveClientId) {
      setForm((f) => ({ ...f, client_id: effectiveClientId }));
    } else {
      setLoadingClients(true);
      fetchClients({ limit: 100 }).then((list) => {
        setClients(list);
        setLoadingClients(false);
      });
    }
  }, [isOpen, effectiveClientId]);

  // On open: push initial order/product IDs into form
  useEffect(() => {
    if (!isOpen) return;
    setForm((f) => ({
      ...f,
      client_id: effectiveClientId || f.client_id,
      order_id: initialOrderId || f.order_id,
      product_id: initialProductId || f.product_id,
    }));
  }, [isOpen, effectiveClientId, initialOrderId, initialProductId]);

  // Load ALL orders for the client (no status filter) whenever client changes
  useEffect(() => {
    if (!form.client_id) {
      setOrders([]);
      return;
    }
    setLoadingOrders(true);
    // No status filter — show every order for this client
    fetchOrdersByClient(form.client_id).then((res) => {
      setOrders(res);
      setLoadingOrders(false);
    });
  }, [form.client_id]);

  // After orders load: if the stored order_id doesn't match any o.id (UUID),
  // try matching by o.order_id display string and correct the form value.
  useEffect(() => {
    if (!orders.length || !initialOrderId) return;
    if (orders.some((o) => o.id === form.order_id)) return; // already matched

    const byDisplay = orders.find(
      (o) => o.order_id === initialOrderId || o.id === initialOrderId,
    );
    if (byDisplay) {
      setForm((f) => ({ ...f, order_id: byDisplay.id }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, initialOrderId]);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === form.order_id),
    [orders, form.order_id],
  );

  const products = useMemo(
    () => selectedOrder?.line_items ?? selectedOrder?.items ?? [],
    [selectedOrder],
  );

  // After the selected order resolves, auto-select the product that matches initialProductId
  useEffect(() => {
    if (!initialProductId || !products.length) return;
    if (products.some((p) => (p.product_uuid || p.product_id) === form.product_id)) return;

    const matched = products.find(
      (p) =>
        p.product_uuid === initialProductId ||
        p.product_id === initialProductId,
    );
    if (matched) {
      setForm((f) => ({ ...f, product_id: matched.product_uuid || matched.product_id }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, initialProductId]);

  const validate = () => {
    const e: typeof errors = {};
    if (!form.client_id) e.client_id = "Client is required";
    if (!form.order_id) e.order_id = "Order is required";
    if (!form.product_id) e.product_id = "Product is required";
    if (!form.description.trim()) e.description = "Description is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    const fd = new FormData();
    fd.append("client_id", form.client_id);
    fd.append("user_id", user?.id ?? "");
    fd.append("order_id", form.order_id);
    fd.append("product_id", form.product_id);
    if (form.reason) fd.append("reason", `<p>${form.reason}</p>`);
    fd.append("description", `<p>${form.description}</p>`);

    if (selectedPartNodes.length > 0) {
      const productName =
        products.find(
          (p) =>
            (p.product_uuid || p.product_id) === form.product_id,
        )?.product_name ?? "";

      fd.append(
        "design_parts_json",
        JSON.stringify(
          selectedPartNodes.map((node) => {
            const sp = new URLSearchParams({
              productId: form.product_id,
              orderId: form.order_id,
              clientId: form.client_id,
              part: node.design_id,
            });
            return {
              design_uuid: node.design_uuid,
              design_version_uuid: node.design_version_id || null,
              troubleshooting_url:
                selectedOrder?.order_id && productName
                  ? `/troubleshooting/${encodeURIComponent(selectedOrder.order_id)}/${encodeURIComponent(productName)}?${sp.toString()}`
                  : `/troubleshooting?${sp.toString()}`,
            };
          }),
        ),
      );
    }

    attachments.forEach((f) => fd.append("attachments", f));
    const result = await createOrderTicket(fd);
    setSubmitting(false);

    if (result) {
      toast.success("Ticket created successfully");
      onCreated?.();
      onClose();
    } else {
      toast.error("Failed to create ticket. Please try again.");
    }
  };

  const handleClose = () => {
    setForm({ client_id: "", order_id: "", product_id: "", reason: "", description: "" });
    setErrors({});
    setAttachments([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
      <div className="relative z-50 w-[460px] h-full bg-[#090b10] border-l border-white/5 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="h-12 shrink-0 border-b border-white/5 flex items-center justify-between px-4">
          <span className="text-sm font-mono text-white/70">Raise Ticket</span>
          <button onClick={handleClose} className="text-white/30 hover:text-white/70 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

            {/* Auto-populated context banner */}


            {/* Client (hidden when already resolved) */}
            {!effectiveClientId && (
              <SelectField
                label="Client *"
                value={form.client_id}
                onChange={(v) =>
                  setForm((f) => ({ ...f, client_id: v, order_id: "", product_id: "" }))
                }
                options={clients.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Select client"
                loading={loadingClients}
              />
            )}
            {errors.client_id && (
              <p className="text-red-400 text-[10px] font-mono -mt-3">{errors.client_id}</p>
            )}

            {/* Selected faulty parts */}
            {selectedPartNodes.length > 0 && (
              <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
                <p className="mb-2 text-[10px] font-mono uppercase tracking-widest text-violet-300">
                  Faulty Components ({selectedPartNodes.length})
                </p>
                <div className="max-h-28 space-y-1 overflow-y-auto">
                  {selectedPartNodes.map((node) => (
                    <div
                      key={node.design_version_id || node.design_uuid}
                      className="flex items-center justify-between gap-2 rounded bg-white/5 px-2 py-1.5"
                    >
                      <span className="truncate text-[10px] font-mono text-white/60">
                        {node.design_name}
                      </span>
                      <span className="shrink-0 text-[9px] font-mono text-white/30">
                        {node.design_type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Order */}
            <div>
              <SelectField
                label="Order *"
                value={form.order_id}
                onChange={(v) =>
                  setForm((f) => ({ ...f, order_id: v, product_id: "" }))
                }
                options={orders.map((o) => ({
                  value: o.id,
                  label: `${o.order_id}${o.status ? ` · ${o.status}` : ""}`,
                }))}
                placeholder={form.client_id ? "Select an order" : "Select client first"}
                disabled={!form.client_id}
                loading={loadingOrders}
                locked={!!initialOrderId}
              />
              {errors.order_id && (
                <p className="text-red-400 text-[10px] font-mono mt-1">{errors.order_id}</p>
              )}
            </div>

            {/* Product */}
            <div>
              <SelectField
                label="Product *"
                value={form.product_id}
                onChange={(v) => setForm((f) => ({ ...f, product_id: v }))}
                options={products.map((p) => ({
                  value: p.product_uuid || p.product_id,
                  label: p.product_name,
                }))}
                placeholder={
                  form.order_id
                    ? products.length === 0
                      ? "No products in this order"
                      : "Select product"
                    : "Select order first"
                }
                disabled={!form.order_id || products.length === 0}
                locked={!!initialProductId}
              />
              {errors.product_id && (
                <p className="text-red-400 text-[10px] font-mono mt-1">{errors.product_id}</p>
              )}
            </div>

            {/* Reason */}
            <div>
              <label className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1.5">
                Reason <span className="normal-case text-white/20">(optional)</span>
              </label>
              <textarea
                rows={3}
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Briefly describe the reason…"
                className="w-full bg-[#0c0e16] border border-white/10 text-white text-xs font-mono px-3 py-2.5 rounded-lg focus:outline-none focus:border-violet-500/50 resize-none placeholder:text-white/20"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1.5">
                Description *
              </label>
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Add any additional details…"
                className="w-full bg-[#0c0e16] border border-white/10 text-white text-xs font-mono px-3 py-2.5 rounded-lg focus:outline-none focus:border-violet-500/50 resize-none placeholder:text-white/20"
              />
              {errors.description && (
                <p className="text-red-400 text-[10px] font-mono mt-1">{errors.description}</p>
              )}
            </div>

            {/* Attachments */}
            <div>
              <label className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1.5">
                Attachments <span className="normal-case text-white/20">(optional)</span>
              </label>
              <label className="flex flex-col items-center justify-center gap-2 h-20 rounded-lg border border-dashed border-white/10 hover:border-violet-500/40 cursor-pointer transition bg-white/2 hover:bg-violet-500/5">
                <Paperclip className="w-4 h-4 text-white/20" />
                <span className="text-[10px] font-mono text-white/30">Click to attach files</span>
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) =>
                    setAttachments((prev) => [...prev, ...Array.from(e.target.files ?? [])])
                  }
                />
              </label>
              {attachments.length > 0 && (
                <div className="mt-2 space-y-1">
                  {attachments.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-2 py-1 rounded bg-white/5 border border-white/5"
                    >
                      <Paperclip className="w-3 h-3 text-white/30 shrink-0" />
                      <span className="flex-1 text-[10px] font-mono text-white/50 truncate">
                        {f.name}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setAttachments((prev) => prev.filter((_, j) => j !== i))
                        }
                        className="text-white/20 hover:text-red-400 transition shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-white/5 px-4 py-3 flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-2 text-xs font-mono text-white/40 hover:text-white/70 border border-white/10 rounded-lg hover:bg-white/5 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 text-xs font-mono font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {submitting ? "Creating…" : "Create Ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
