"use client";

import React, { Suspense, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Globe, Activity, ShieldAlert, Wrench, Box, Layers, Cpu, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useAbility } from "../providers/AbilityProvider";

function SidebarInner() {
  const router   = useRouter();
  const pathname = usePathname();
  const { can, isClient } = useAbility();
  const [collapsed, setCollapsed] = useState(false);

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
        className={`w-full flex items-center rounded-md text-xs font-mono tracking-wider transition-all duration-150 uppercase ${
          collapsed ? "justify-center px-0 py-3" : "gap-3 px-4 py-3"
        } ${
          active
            ? "bg-blue-600 text-white shadow-[0_0_12px_#2563eb33]"
            : "text-white/60 hover:text-white hover:bg-white/5"
        }`}
      >
        {icon}
        {!collapsed && <span>{label}</span>}
      </button>
    );
  }

  return (
    <aside
      className={`relative flex flex-col bg-[#090b10] border-r border-white/5 shrink-0 h-full transition-[width] duration-200 overflow-hidden ${
        collapsed ? "w-12" : "w-64"
      }`}
    >
      {/* Right-edge collapse handle — clicking the sidebar border collapses it */}
      <div
        onClick={() => setCollapsed(v => !v)}
        className="absolute inset-y-0 right-0 w-1 z-20 cursor-col-resize hover:bg-blue-500/50 transition-colors"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      />

      {/* Brand */}
      <div
        className={`border-b border-white/5 flex items-center shrink-0 ${
          collapsed ? "justify-center px-0 py-4" : "gap-3 p-6"
        }`}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-blue-600 shadow-[0_0_15px_#2563eb44]">
          <Cpu className="h-5 w-5 text-white animate-pulse" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-wider uppercase text-white font-mono truncate">Industrial OS</h1>
            <span className="text-[9px] font-mono text-white/30 uppercase px-1 py-0.5 rounded bg-white/5">V 4.0.2</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 py-6 space-y-1.5 overflow-y-auto ${collapsed ? "px-1.5" : "px-4"}`}>
        {navBtn(
          "Dashboard",
          <Globe className="h-4 w-4 shrink-0" />,
          isDashboard,
          () => router.push("/"),
          !isClient || can("read", "products") || can("browse", "products"),
        )}
        {navBtn(
          "Digital Twin",
          <Activity className="h-4 w-4 shrink-0" />,
          isPathActive("/twin"),
          () => router.push("/twin"),
          !isClient || can("read", "products"),
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
          <Wrench className="h-4 w-4 shrink-0" />,
          isPathActive("/tickets"),
          () => router.push("/tickets"),
        )}
        {navBtn(
          "Parts",
          <Box className="h-4 w-4 shrink-0" />,
          isPathActive("/parts"),
          () => router.push("/parts"),
          !isClient || can("read", "inventory"),
        )}
        {navBtn(
          "Troubleshoot",
          <Layers className="h-4 w-4 shrink-0" />,
          isPathActive("/troubleshooting"),
          () => router.push("/troubleshooting"),
        )}
      </nav>

      {/* Collapse toggle at bottom */}
      {!collapsed && (
        <div className="shrink-0 border-t border-white/5 p-2">
          <button
            onClick={() => setCollapsed(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded text-[10px] font-mono text-white/30 hover:text-white/60 hover:bg-white/5 transition"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Collapse
          </button>
        </div>
      )}
      {collapsed && (
        <div className="shrink-0 border-t border-white/5 p-1.5">
          <button
            onClick={() => setCollapsed(false)}
            title="Expand sidebar"
            className="w-full flex items-center justify-center py-2 rounded text-white/30 hover:text-white/60 hover:bg-white/5 transition"
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
