"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, ChevronDown, Loader2, Paperclip, Lock } from "lucide-react";
import toast from "react-hot-toast";
import {
  createOrderTicket,
  fetchClients,
  fetchOrdersByClient,
  fetchTroubleshootingByProduct,
  InventoryOrder,
  ApiClientOption,
  TroubleshootingDesignNode,
} from "../../lib/api";
import { useAuth } from "../../providers/AuthProvider";
import { TicketCreatedPopup } from "./TicketCreatedPopup";
import { DesignTreeSelect } from "../ui/DesignTreeSelect";

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
  component: string[];
  reason: string;
  description: string;
}

function SelectField({
  label, value, onChange, options, placeholder, disabled, loading, locked, lockedDisplay,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string; disabled?: boolean; loading?: boolean; locked?: boolean; lockedDisplay?: string;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">
        {label}
        {locked && <Lock className="w-2.5 h-2.5 text-slate-300" />}
      </label>
      {locked && lockedDisplay ? (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg">
          <span className="text-xs font-mono text-slate-700 flex-1 truncate">{lockedDisplay}</span>
          <Lock className="w-3 h-3 text-slate-300 shrink-0" />
        </div>
      ) : (
        <div className="relative">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled || loading || locked}
            className="w-full appearance-none bg-white border border-slate-200 text-slate-900 text-xs font-mono px-3 py-2.5 pr-8 rounded-lg focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-50"
          >
            <option value="">{loading ? "Loading…" : placeholder}</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {loading ? (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin pointer-events-none" />
          ) : (
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          )}
        </div>
      )}
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
    client_id: "", order_id: "", product_id: "", component: [], reason: "", description: "",
  });
  const [componentNodes, setComponentNodes] = useState<TroubleshootingDesignNode[]>([]);
  const [designNodes, setDesignNodes] = useState<TroubleshootingDesignNode[]>([]);
  const [loadingNodes, setLoadingNodes] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [attachments, setAttachments] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [createdTicket, setCreatedTicket] = useState<{ id: string; ref: string } | null>(null);

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

  // Fetch design nodes when product changes; also clear component selection
  useEffect(() => {
    if (!form.product_id) { setDesignNodes([]); setComponentNodes([]); return; }
    setLoadingNodes(true);
    fetchTroubleshootingByProduct(form.product_id).then((res) => {
      setDesignNodes(res?.data ?? []);
      setLoadingNodes(false);
    }).catch(() => setLoadingNodes(false));
  }, [form.product_id]);

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

    // Merge parts from troubleshooting pre-selection AND DesignTreeSelect, deduplicated by design_uuid
    const allPartNodes = [
      ...selectedPartNodes,
      ...componentNodes.filter(n => !selectedPartNodes.some(p => p.design_uuid === n.design_uuid)),
    ];

    if (allPartNodes.length > 0) {
      const productName =
        products.find(
          (p) =>
            (p.product_uuid || p.product_id) === form.product_id,
        )?.product_name ?? "";

      fd.append(
        "design_parts_json",
        JSON.stringify(
          allPartNodes.map((node) => {
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
                  ? `/diagnostics/troubleshooting/${encodeURIComponent(selectedOrder.order_id)}/${encodeURIComponent(productName)}?${sp.toString()}`
                  : `/diagnostics/troubleshooting?${sp.toString()}`,
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
      setCreatedTicket({ id: result.id, ref: result.ticket_id });
    } else {
      toast.error("Failed to create ticket. Please try again.");
    }
  };

  const handleClose = () => {
    setForm({ client_id: "", order_id: "", product_id: "", reason: "", description: "", component: [] });
    setComponentNodes([]);
    setErrors({});
    setAttachments([]);
    onClose();
  };

  if (!isOpen && !createdTicket) return null;

  const lockedOrderLabel = initialOrderId ? orders.find(o => o.id === form.order_id)?.order_id ?? initialOrderId : undefined;
  const lockedProductLabel = initialProductId ? products.find(p => (p.product_uuid || p.product_id) === form.product_id)?.product_name ?? initialProductId : undefined;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative z-50 w-[480px] h-full bg-white border-l border-slate-200 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="h-14 shrink-0 border-b border-slate-100 flex items-center justify-between px-5">
          <div>
            <span className="text-sm font-semibold text-slate-900">Raise Ticket</span>
            <p className="text-[10px] text-slate-400 mt-0.5">Submit a new service request</p>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 transition p-1 rounded hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

            {/* Client (hidden when resolved) */}
            {!effectiveClientId && (
              <SelectField
                label="Client *"
                value={form.client_id}
                onChange={(v) =>
                  setForm((f) => ({ ...f, client_id: v, order_id: "", product_id: "", component: [] }))
                }
                options={clients.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Select client"
                loading={loadingClients}
              />
            )}
            {errors.client_id && (
              <p className="text-red-500 text-[10px] -mt-3">{errors.client_id}</p>
            )}

            {/* Order */}
            <div>
              <SelectField
                label="Order *"
                value={form.order_id}
                onChange={(v) =>
                  setForm((f) => ({ ...f, order_id: v, product_id: "", component: [] }))
                }
                options={orders.map((o) => ({
                  value: o.id,
                  label: `${o.order_id}${o.status ? ` · ${o.status}` : ""}`,
                }))}
                placeholder={form.client_id ? "Select an order" : "Select client first"}
                disabled={!form.client_id}
                loading={loadingOrders}
                locked={!!initialOrderId}
                lockedDisplay={lockedOrderLabel}
              />
              {errors.order_id && (
                <p className="text-red-500 text-[10px] mt-1">{errors.order_id}</p>
              )}
            </div>

            {/* Product */}
            <div>
              <SelectField
                label="Product *"
                value={form.product_id}
                onChange={(v) => setForm((f) => ({ ...f, product_id: v, component: [] }))}
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
                lockedDisplay={lockedProductLabel}
              />
              {errors.product_id && (
                <p className="text-red-500 text-[10px] mt-1">{errors.product_id}</p>
              )}
            </div>

            {/* Component / Module selector */}
            <DesignTreeSelect
              label={`Component (optional)`}
              nodes={designNodes}
              value={form.component}
              onChange={(uuids, nodes) => { setForm(f => ({ ...f, component: uuids })); setComponentNodes(nodes); }}
              mode="multi"
              placeholder={form.product_id ? "Select components…" : "Select product first"}
              disabled={!form.product_id}
              loading={loadingNodes}
            />

            {/* Selected faulty parts from troubleshooting */}
            {selectedPartNodes.length > 0 && (
              <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
                <p className="mb-2 text-[10px] font-mono uppercase tracking-widest text-violet-600">
                  Faulty Components ({selectedPartNodes.length})
                </p>
                <div className="max-h-28 space-y-1 overflow-y-auto">
                  {selectedPartNodes.map((node) => (
                    <div
                      key={node.design_version_id || node.design_uuid}
                      className="flex items-center justify-between gap-2 rounded bg-white px-2 py-1.5 border border-violet-100"
                    >
                      <span className="truncate text-[10px] font-mono text-slate-700">{node.design_name}</span>
                      <span className="shrink-0 text-[9px] font-mono text-slate-400">{node.design_type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">
                Reason <span className="normal-case text-slate-400">(optional)</span>
              </label>
              <textarea
                rows={3}
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Briefly describe the reason…"
                className="w-full bg-white border border-slate-200 text-slate-900 text-xs font-mono px-3 py-2.5 rounded-lg focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 resize-none placeholder:text-slate-400"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">
                Description *
              </label>
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Add any additional details…"
                className="w-full bg-white border border-slate-200 text-slate-900 text-xs font-mono px-3 py-2.5 rounded-lg focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 resize-none placeholder:text-slate-400"
              />
              {errors.description && (
                <p className="text-red-500 text-[10px] mt-1">{errors.description}</p>
              )}
            </div>

            {/* Attachments */}
            <div>
              <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">
                Attachments <span className="normal-case text-slate-400">(optional)</span>
              </label>
              <label className="flex flex-col items-center justify-center gap-2 h-20 rounded-lg border border-dashed border-slate-200 hover:border-violet-400 cursor-pointer transition bg-slate-50 hover:bg-violet-50">
                <Paperclip className="w-4 h-4 text-slate-400" />
                <span className="text-[10px] font-mono text-slate-400">Click to attach files</span>
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
                      className="flex items-center gap-2 px-2 py-1 rounded bg-slate-50 border border-slate-200"
                    >
                      <Paperclip className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="flex-1 text-[10px] font-mono text-slate-600 truncate">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                        className="text-slate-300 hover:text-red-500 transition shrink-0"
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
          <div className="shrink-0 border-t border-slate-100 px-5 py-4 flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
            >
              {submitting ? "Creating…" : "Create Ticket"}
            </button>
          </div>
        </form>
      </div>
      {createdTicket && (
        <TicketCreatedPopup
          ticketId={createdTicket.id}
          ticketRef={createdTicket.ref}
          onClose={() => {
            setCreatedTicket(null);
            handleClose();
          }}
        />
      )}
    </div>
  );
}
