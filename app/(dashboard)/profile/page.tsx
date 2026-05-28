"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { useAbility } from "@/providers/AbilityProvider";
import {
  fetchTickets, fetchProductCatalog,
  ApiTicket, ApiProductCatalog,
} from "@/lib/api";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import {
  User, Mail, Shield, Package, Ticket, CheckCircle,
  Clock, AlertTriangle, ChevronRight, Activity, Hash,
  Calendar, Building2, TrendingUp, Circle,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  OPEN:        "bg-blue-500",
  IN_PROGRESS: "bg-amber-500",
  RESOLVED:    "bg-emerald-500",
  CLOSED:      "bg-slate-400",
};

export default function ProfilePage() {
  const router   = useRouter();
  const { user } = useAuth();
  const { roleName } = useAbility();

  const [tickets, setTickets]   = useState<ApiTicket[]>([]);
  const [products, setProducts] = useState<ApiProductCatalog[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([fetchTickets(), fetchProductCatalog()])
      .then(([t, p]) => { setTickets(t); setProducts(p); })
      .finally(() => setLoading(false));
  }, []);

  const myTickets    = tickets.filter(t =>
    t.assigned_to === user?.id || (t as any).user_id === user?.id || (t as any).sender_id === user?.id
  );
  const openCount     = myTickets.filter(t => t.status === "OPEN").length;
  const inProgCount   = myTickets.filter(t => t.status === "IN_PROGRESS").length;
  const resolvedCount = myTickets.filter(t => ["RESOLVED","CLOSED"].includes(t.status ?? "")).length;

  const initials = user
    ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase()
    : "?";

  const fullName = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : "—";
  const joinedDate = (user as any)?.createdAt
    ? new Date((user as any).createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#07090e]">

      {/* Header */}
      <div className="bg-white dark:bg-[#090b10] border-b border-slate-200 dark:border-white/5 px-6 py-4">
        <Breadcrumbs className="mb-2" items={[{ label: "Dashboard", href: "/" }, { label: "Profile" }]} />
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-cyan-500" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white">My Profile</h1>
            <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">Account details and activity summary</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">

        {/* ── Identity card ── */}
        <div className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden">
          <div className="h-[3px] bg-gradient-to-r from-cyan-500 via-violet-500 to-blue-500" />
          <div className="p-6">
            <div className="flex items-start gap-5 flex-wrap mb-6">
              {/* Avatar */}
              <div className="w-20 h-20 shrink-0 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/20 flex items-center justify-center font-mono text-2xl font-bold text-cyan-500">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{fullName}</h2>
                <span className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-[10px] font-mono font-bold text-violet-600 dark:text-violet-300 uppercase tracking-wider">
                  <Shield className="w-3 h-3" />
                  {roleName}
                </span>
                <p className="text-[11px] font-mono text-slate-400 dark:text-white/30 mt-2">{user?.email ?? "—"}</p>
              </div>
            </div>

            {/* 3-col info grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  icon: <Mail className="w-3.5 h-3.5" />,
                  label: "Email",
                  value: user?.email ?? "—",
                  mono: true,
                },
                {
                  icon: <Shield className="w-3.5 h-3.5" />,
                  label: "Role",
                  value: user?.role?.name ?? roleName ?? "—",
                },
                {
                  icon: <Hash className="w-3.5 h-3.5" />,
                  label: "User ID",
                  value: user?.id ? user.id.slice(0, 8) + "…" : "—",
                  mono: true,
                },
                {
                  icon: <Building2 className="w-3.5 h-3.5" />,
                  label: "Organization",
                  value: (user as any)?.department?.name ?? (user as any)?.organization ?? "Service Desk",
                },
                {
                  icon: <Calendar className="w-3.5 h-3.5" />,
                  label: "Joined",
                  value: joinedDate,
                  mono: true,
                },
                {
                  icon: <Activity className="w-3.5 h-3.5" />,
                  label: "Account Status",
                  value: (user as any)?.status ?? "Active",
                  highlight: true,
                },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 rounded-lg p-3">
                  <div className="w-8 h-8 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/8 flex items-center justify-center shrink-0 text-slate-400 dark:text-white/30">
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-mono text-slate-400 dark:text-white/25 uppercase tracking-widest">{item.label}</p>
                    <p className={`text-xs truncate mt-0.5 ${item.mono ? "font-mono text-slate-600 dark:text-white/60" : ""} ${item.highlight ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "font-semibold text-slate-800 dark:text-white/80"}`}>
                      {item.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 3-col: Ticket Stats + Assigned Machines + Recent Activity ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Col 1: Ticket stats */}
          <div className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3.5 border-b border-slate-100 dark:border-white/5">
              <Ticket className="w-3.5 h-3.5 text-violet-500" />
              <span className="text-xs font-semibold text-slate-700 dark:text-white/70">Ticket Activity</span>
            </div>
            <div className="p-4 space-y-3">
              {[
                { label: "Total Tickets",   value: loading ? "…" : myTickets.length,  color: "slate",   icon: <Ticket className="w-4 h-4" /> },
                { label: "Open",            value: loading ? "…" : openCount,          color: "blue",    icon: <Circle className="w-4 h-4" /> },
                { label: "In Progress",     value: loading ? "…" : inProgCount,        color: "amber",   icon: <Clock className="w-4 h-4" /> },
                { label: "Resolved/Closed", value: loading ? "…" : resolvedCount,      color: "emerald", icon: <CheckCircle className="w-4 h-4" /> },
              ].map(stat => (
                <div key={stat.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      stat.color === "blue"    ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      : stat.color === "amber"  ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : stat.color === "emerald"? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-white/30"
                    }`}>
                      {stat.icon}
                    </div>
                    <span className="text-xs text-slate-600 dark:text-white/60">{stat.label}</span>
                  </div>
                  <span className="text-base font-bold font-mono text-slate-900 dark:text-white tabular-nums">{stat.value}</span>
                </div>
              ))}
            </div>
            {myTickets.length > 0 && (
              <div className="px-4 pb-4">
                <button
                  onClick={() => router.push("/tickets")}
                  className="w-full py-2 border border-violet-200 dark:border-violet-500/20 bg-violet-50 dark:bg-violet-500/8 text-violet-700 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-500/12 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5"
                >
                  View All Tickets <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Col 2: Assigned Products (machines) */}
          <div className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3.5 border-b border-slate-100 dark:border-white/5">
              <Package className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs font-semibold text-slate-700 dark:text-white/70">Assigned Machines</span>
            </div>
            {loading ? (
              <div className="p-6 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : products.length === 0 ? (
              <div className="p-6 text-center">
                <Package className="w-8 h-8 text-slate-200 dark:text-white/10 mx-auto mb-2" />
                <p className="text-xs font-mono text-slate-400 dark:text-white/30">No machines assigned</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-white/[0.03]">
                {products.map(p => (
                  <div key={p.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
                      <Package className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">{p.product_name}</p>
                      <p className="text-[10px] font-mono text-slate-400 dark:text-white/30 mt-0.5">{p.product_id}</p>
                    </div>
                    <span className={`shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                      p.status === "IN_STOCK"
                        ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                        : "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/30"
                    }`}>
                      {p.status ?? "Active"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Col 3: Recent tickets */}
          <div className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3.5 border-b border-slate-100 dark:border-white/5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs font-semibold text-slate-700 dark:text-white/70">Recent Tickets</span>
            </div>
            {loading ? (
              <div className="p-6 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
              </div>
            ) : myTickets.length === 0 ? (
              <div className="p-6 text-center">
                <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-60" />
                <p className="text-xs font-mono text-slate-400 dark:text-white/30">No tickets yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-white/[0.03]">
                {myTickets.slice(0, 6).map(t => (
                  <button
                    key={t.id}
                    onClick={() => router.push(`/tickets/${t.id}`)}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition"
                  >
                    <span className={`shrink-0 w-2 h-2 rounded-full ${STATUS_COLORS[t.status ?? ""] ?? "bg-slate-300"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">{t.title ?? t.ticket_id}</p>
                      <p className="text-[9px] font-mono text-slate-400 dark:text-white/25 mt-0.5">{t.ticket_id}</p>
                    </div>
                    <span className="shrink-0 text-[9px] font-mono text-slate-400 dark:text-white/25 uppercase">{(t.status ?? "").replace("_", " ")}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
