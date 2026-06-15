"use client";

import React, { Suspense, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, ShieldAlert, Wrench, Ticket, ChevronLeft, ChevronRight,
} from "lucide-react";
import Image from "next/image";
import { useAbility } from "../providers/AbilityProvider";
import { useTheme } from "../providers/ThemeProvider";

function SidebarInner() {
  const router   = useRouter();
  const pathname = usePathname();
  const { can, isClient } = useAbility();
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const [collapsed, setCollapsed] = useState(false);

  const sidebarBg    = isDark ? "#090b10"                 : "#ffffff";
  const borderColor  = isDark ? "rgba(255,255,255,0.05)"  : "rgba(0,0,0,0.08)";
  const textInactive = isDark ? "rgba(255,255,255,0.65)"  : "rgba(15,23,42,0.65)";
  const textMuted    = isDark ? "rgba(255,255,255,0.3)"   : "rgba(15,23,42,0.35)";
  const textBrand    = isDark ? "#ffffff"                 : "#0f172a";
  const textSub      = isDark ? "rgba(255,255,255,0.5)"   : "rgba(15,23,42,0.45)";
  const hoverBg      = isDark ? "rgba(255,255,255,0.05)"  : "rgba(0,0,0,0.04)";

  const isPathActive = (p: string) => pathname === p || pathname.startsWith(p + "/");
  const isDashboard  = pathname === "/";

  function navBtn(
    label: string,
    icon: React.ReactNode,
    active: boolean,
    onClick: () => void,
    show: boolean = true,
  ) {
    if (!show) return null;
    return (
      <button
        key={label}
        onClick={onClick}
        title={collapsed ? label : undefined}
        className={`w-full flex items-center rounded-md text-xs tracking-wider transition-all duration-150 uppercase ${
          collapsed ? "justify-center px-0 py-3" : "gap-3 px-4 py-3"
        } ${active ? "shadow-[0_0_12px_#2D6CFA33]" : ""}`}
        style={{
          fontFamily: "Arial, Helvetica, sans-serif",
          backgroundColor: active ? "#2D6CFA" : "transparent",
          color: active ? "#ffffff" : textInactive,
        }}
        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.backgroundColor = hoverBg; }}
        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
      >
        {icon}
        {!collapsed && <span>{label}</span>}
      </button>
    );
  }

  return (
    <aside
      className={`relative flex flex-col shrink-0 h-full transition-[width] duration-200 overflow-hidden ${
        collapsed ? "w-12" : "w-64"
      }`}
      style={{ backgroundColor: sidebarBg, borderRight: `1px solid ${borderColor}` }}
    >
      {/* Right-edge collapse handle */}
      <div
        onClick={() => setCollapsed(v => !v)}
        className="absolute inset-y-0 right-0 w-1 z-20 cursor-col-resize hover:bg-blue-500/50 transition-colors"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      />

      {/* Brand */}
      <div
        className="flex items-center shrink-0"
        style={{
          borderBottom: `1px solid ${borderColor}`,
          ...(collapsed ? { justifyContent: "center", padding: "16px 0" } : { gap: "12px", padding: "24px" }),
        }}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded overflow-hidden">
          <Image src="/brand/logo.png" alt="Quarkcity Logo" width={36} height={36} className="object-contain" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h1
              className="text-[11px] font-bold tracking-wider uppercase truncate"
              style={{ color: textBrand, fontFamily: "Arial, Helvetica, sans-serif" }}
            >
              Quarkcity Medtech
            </h1>
            <span
              className="text-[10px] uppercase"
              style={{ color: textSub, fontFamily: "Arial, Helvetica, sans-serif" }}
            >
              Service Desk
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 py-6 space-y-1.5 overflow-y-auto ${collapsed ? "px-1.5" : "px-4"}`}>
        {navBtn(
          "Dashboard",
          <LayoutDashboard className="h-4 w-4 shrink-0" />,
          isDashboard,
          () => router.push("/"),
          !isClient || can("read", "products") || can("browse", "products"),
        )}
        {navBtn(
          "Diagnostics",
          <ShieldAlert className="h-4 w-4 shrink-0" />,
          isPathActive("/diagnostics"),
          () => router.push("/diagnostics"),
          !isClient || can("read", "inspections") || can("browse", "inspections"),
        )}
        {navBtn(
          "Tickets",
          <Ticket className="h-4 w-4 shrink-0" />,
          isPathActive("/tickets"),
          () => router.push("/tickets"),
        )}
        {navBtn(
          "Maintenance",
          <Wrench className="h-4 w-4 shrink-0" />,
          isPathActive("/maintenance"),
          () => router.push("/maintenance"),
        )}
      </nav>

      {/* Collapse toggle at bottom */}
      {!collapsed && (
        <div className="shrink-0 p-2" style={{ borderTop: `1px solid ${borderColor}` }}>
          <button
            onClick={() => setCollapsed(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded text-[10px] transition"
            style={{ color: textMuted, fontFamily: "Arial, Helvetica, sans-serif" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = hoverBg; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Collapse
          </button>
        </div>
      )}
      {collapsed && (
        <div className="shrink-0 p-1.5" style={{ borderTop: `1px solid ${borderColor}` }}>
          <button
            onClick={() => setCollapsed(false)}
            title="Expand sidebar"
            className="w-full flex items-center justify-center py-2 rounded transition"
            style={{ color: textMuted }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = hoverBg; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </aside>
  );
}

export function AppSidebar() {
  return (
    <Suspense fallback={<aside className="w-64 bg-[#090b10] border-r border-white/5 shrink-0 h-full" />}>
      <SidebarInner />
    </Suspense>
  );
}
