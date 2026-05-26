"use client";

import React, { useState, useEffect } from "react";
import { X, ChevronDown, Loader2, Paperclip, Package, ShoppingCart } from "lucide-react";
import {
  createOrderTicket, fetchClients, fetchOrdersByClient,
  InventoryOrder, ApiClientOption, TroubleshootingDesignNode,
} from "../../lib/api";
import { useAuth } from "../../providers/AuthProvider";
import { fuzzyAny } from "../../lib/search";

interface AddTicketDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
  loggedInClientId?: string | null;
  initialClientId?: string | null;
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

function SelectField({ label, value, onChange, options, placeholder, disabled, loading }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string; disabled?: boolean; loading?: boolean;
}) {
  return (
    <div>
      <label className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1.5">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || loading}
          className="w-full appearance-none bg-[#0c0e16] border border-white/10 text-white text-xs font-mono px-3 py-2.5 pr-8 rounded-lg focus:outline-none focus:border-violet-500/50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <option value="">{loading ? "Loading…" : placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {loading
          ? <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 animate-spin pointer-events-none" />
          : <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
        }
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
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>({ client_id: "", order_id: "", product_id: "", reason: "", description: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [attachments, setAttachments] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Client options
  const [clients, setClients] = useState<ApiClientOption[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [loadingClients, setLoadingClients] = useState(false);
  const [orders, setOrders] = useState<InventoryOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const effectiveClientId = loggedInClientId || initialClientId || user?.client?.id || "";

  // Load clients.
  useEffect(() => {
    if (!isOpen) return;
    if (effectiveClientId) {
      setForm((f) => ({ ...f, client_id: effectiveClientId }));
      return;
    }
    setLoadingClients(true);
    fetchClients({ limit: 100 }).then((list) => {
      setClients(list);
      setLoadingClients(false);
    });
  }, [isOpen, effectiveClientId]);

  useEffect(() => {
    if (!isOpen) return;
    setForm((f) => ({
      ...f,
      client_id: effectiveClientId || f.client_id,
      order_id: initialOrderId || f.order_id,
      product_id: initialProductId || f.product_id,
    }));
  }, [isOpen, effectiveClientId, initialOrderId, initialProductId]);

  // Load orders when client changes
  useEffect(() => {
    if (!form.client_id) { setOrders([]); return; }
    setLoadingOrders(true);
    fetchOrdersByClient(form.client_id, "Delivered").then((res) => {
      setOrders(res);
      setLoadingOrders(false);
    });
  }, [form.client_id]);

  const selectedOrder = orders.find((o) => o.id === form.order_id);
  const products = (selectedOrder?.items ?? selectedOrder?.line_items ?? []);
  const filteredClients = clients.filter((client) => fuzzyAny([client.name, client.email, client.id], clientSearch));

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
      const selectedProduct = products.find((p) => (p.product_uuid || p.product_id) === form.product_id || p.product_id === form.product_id);
      fd.append(
        "design_parts_json",
        JSON.stringify(selectedPartNodes.map((node) => {
          const sp = new URLSearchParams({
            productId: form.product_id,
            orderId: form.order_id,
            clientId: form.client_id,
            part: node.design_id,
          });
          return {
            design_uuid: node.design_uuid,
            design_version_uuid: node.design_version_id || null,
            troubleshooting_url: selectedOrder?.order_id && selectedProduct?.product_name
              ? `/troubleshooting?${sp.toString()}&full=1`
              : `/troubleshooting?${sp.toString()}`,
          };
        })),
      );
    }
    attachments.forEach((f) => fd.append("attachments", f));
    const result = await createOrderTicket(fd);
    setSubmitting(false);
    if (result) {
      setToastMsg({ type: "ok", text: "Ticket created successfully" });
      setTimeout(() => { setToastMsg(null); onCreated?.(); onClose(); }, 1200);
    } else {
      setToastMsg({ type: "err", text: "Failed to create ticket. Please try again." });
      setTimeout(() => setToastMsg(null), 3000);
    }
  };

  const handleClose = () => {
    setForm({ client_id: "", order_id: "", product_id: "", reason: "", description: "" });
    setErrors({}); setAttachments([]); setToastMsg(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
      <div className="relative z-50 w-[460px] h-full bg-[#090b10] border-l border-white/5 flex flex-col shadow-2xl">
        <div className="h-12 shrink-0 border-b border-white/5 flex items-center justify-between px-4">
          <span className="text-sm font-mono text-white/70">Raise Ticket</span>
          <button onClick={handleClose} className="text-white/30 hover:text-white/70 transition">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {toastMsg && (
          <div className={`mx-4 mt-3 px-3 py-2 rounded-lg text-xs font-mono ${toastMsg.type === "ok" ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300" : "bg-red-500/15 border border-red-500/30 text-red-300"}`}>
            {toastMsg.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

            {/* Client (hidden if already set) */}
            {!effectiveClientId && (
              <div>
                <label className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1.5">Client *</label>
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder={loadingClients ? "Loading clients..." : "Fuzzy search clients"}
                  className="mb-2 w-full bg-[#0c0e16] border border-white/10 text-white text-xs font-mono px-3 py-2.5 rounded-lg focus:outline-none focus:border-violet-500/50"
                />
                <SelectField
                  label=""
                  value={form.client_id}
                  onChange={(v) => setForm((f) => ({ ...f, client_id: v, order_id: "", product_id: "" }))}
                  options={filteredClients.map((c) => ({ value: c.id, label: c.name }))}
                  placeholder="Select client"
                  loading={loadingClients}
                />
                {errors.client_id && <p className="text-red-400 text-[10px] font-mono mt-1">{errors.client_id}</p>}
              </div>
            )}

            {selectedPartNodes.length > 0 && (
              <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
                <p className="mb-2 text-[10px] font-mono uppercase tracking-widest text-violet-300">
                  Faulty Components ({selectedPartNodes.length})
                </p>
                <div className="max-h-28 space-y-1 overflow-y-auto">
                  {selectedPartNodes.map((node) => (
                    <div key={node.design_version_id || node.design_uuid} className="flex items-center justify-between gap-2 rounded bg-white/5 px-2 py-1.5">
                      <span className="truncate text-[10px] font-mono text-white/60">{node.design_name}</span>
                      <span className="shrink-0 text-[9px] font-mono text-white/30">{node.design_type}</span>
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
                onChange={(v) => setForm((f) => ({ ...f, order_id: v, product_id: "" }))}
                options={orders.map((o) => ({ value: o.id, label: `${o.order_id}${o.status ? ` · ${o.status}` : ""}` }))}
                placeholder={form.client_id ? "Select delivered order" : "Select client first"}
                disabled={!form.client_id}
                loading={loadingOrders}
              />
              {errors.order_id && <p className="text-red-400 text-[10px] font-mono mt-1">{errors.order_id}</p>}
            </div>

            {/* Product */}
            <div>
              <SelectField
                label="Product *"
                value={form.product_id}
                onChange={(v) => setForm((f) => ({ ...f, product_id: v }))}
                options={products.map((p) => ({ value: p.product_uuid || p.product_id, label: p.product_name }))}
                placeholder={form.order_id ? (products.length === 0 ? "No products in order" : "Select product") : "Select order first"}
                disabled={!form.order_id || products.length === 0}
              />
              {errors.product_id && <p className="text-red-400 text-[10px] font-mono mt-1">{errors.product_id}</p>}
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
                placeholder="Describe the reason for raising this ticket…"
                className="w-full bg-[#0c0e16] border border-white/10 text-white text-xs font-mono px-3 py-2.5 rounded-lg focus:outline-none focus:border-violet-500/50 resize-none placeholder:text-white/20"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1.5">Description *</label>
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Add any additional details…"
                className="w-full bg-[#0c0e16] border border-white/10 text-white text-xs font-mono px-3 py-2.5 rounded-lg focus:outline-none focus:border-violet-500/50 resize-none placeholder:text-white/20"
              />
              {errors.description && <p className="text-red-400 text-[10px] font-mono mt-1">{errors.description}</p>}
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
                  onChange={(e) => setAttachments((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
                />
              </label>
              {attachments.length > 0 && (
                <div className="mt-2 space-y-1">
                  {attachments.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1 rounded bg-white/5 border border-white/5">
                      <Paperclip className="w-3 h-3 text-white/30 shrink-0" />
                      <span className="flex-1 text-[10px] font-mono text-white/50 truncate">{f.name}</span>
                      <button type="button" onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))} className="text-white/20 hover:text-red-400 transition shrink-0">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

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
