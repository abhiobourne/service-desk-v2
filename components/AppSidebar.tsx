"use client";

import React, { Suspense } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Globe, Activity, ShieldAlert, Wrench, Box, Layers, Cpu,
} from "lucide-react";
import { useAbility } from "../providers/AbilityProvider";

function SidebarInner() {
  const router = useRouter();
  const pathname = usePathname();
  const { can, isClient } = useAbility();

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
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-md text-xs font-mono tracking-wider transition-all duration-150 uppercase ${
          active
            ? "bg-blue-600 text-white shadow-[0_0_12px_#2563eb33]"
            : "text-white/60 hover:text-white hover:bg-white/5"
        }`}
      >
        {icon}
        <span>{label}</span>
      </button>
    );
  }

  return (
    <aside className="w-64 bg-[#090b10] border-r border-white/5 flex flex-col shrink-0 h-full">
      {/* Brand */}
      <div className="p-6 border-b border-white/5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded bg-blue-600 shadow-[0_0_15px_#2563eb44]">
          <Cpu className="h-5 w-5 text-white animate-pulse" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-wider uppercase text-white font-mono">Industrial OS</h1>
          <span className="text-[9px] font-mono text-white/30 uppercase px-1 py-0.5 rounded bg-white/5">V 4.0.2</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {navBtn(
          "Dashboard",
          <Globe className="h-4 w-4" />,
          isDashboard,
          () => router.push("/"),
          !isClient || can("read", "products") || can("browse", "products"),
        )}
        {navBtn(
          "Digital Twin",
          <Activity className="h-4 w-4" />,
          isPathActive("/twin"),
          () => router.push("/twin"),
          !isClient || can("read", "products"),
        )}
        {navBtn(
          "Diagnostics",
          <ShieldAlert className="h-4 w-4" />,
          isPathActive("/diagnostics"),
          () => router.push("/diagnostics"),
          !isClient || can("read", "inspections") || can("browse", "inspections"),
        )}
        {navBtn(
          "Tickets",
          <Wrench className="h-4 w-4" />,
          isPathActive("/tickets"),
          () => router.push("/tickets"),
        )}
        {navBtn(
          "Parts",
          <Box className="h-4 w-4" />,
          isPathActive("/parts"),
          () => router.push("/parts"),
          !isClient || can("read", "inventory"),
        )}
        {navBtn(
          "Troubleshoot",
          <Layers className="h-4 w-4" />,
          isPathActive("/troubleshooting"),
          () => router.push("/troubleshooting"),
        )}
      </nav>
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
