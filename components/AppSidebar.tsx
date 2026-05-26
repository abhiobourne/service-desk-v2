"use client";

import React, { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Globe, Activity, ShieldAlert, Wrench, Box, Layers, BookOpen,
  Settings, HelpCircle, AlertTriangle, Cpu,
} from "lucide-react";
import { useAuth } from "../providers/AuthProvider";
import { useAbility } from "../providers/AbilityProvider";

interface AppSidebarProps {
  onEmergencyStop?: () => void;
}

function SidebarInner({ onEmergencyStop }: AppSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, logout } = useAuth();
  const { can, roleName, isAdmin, isClient } = useAbility();

  const tab = searchParams.get("tab") ?? "fleet";

  const isTabActive = (t: string) => pathname === "/" && tab === t;
  const isPathActive = (p: string) => pathname === p || pathname.startsWith(p + "/");

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
          "Fleet",
          <Globe className="h-4 w-4" />,
          isTabActive("fleet"),
          () => router.push("/"),
          !isClient || can("read", "products") || can("browse", "products"),
        )}
        {navBtn(
          "Digital Twin",
          <Activity className="h-4 w-4" />,
          isTabActive("twin"),
          () => router.push("/?tab=twin"),
          !isClient || can("read", "products"),
        )}
        {navBtn(
          "Diagnostics",
          <ShieldAlert className="h-4 w-4" />,
          isTabActive("diagnostics"),
          () => router.push("/?tab=diagnostics"),
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
        {navBtn(
          "Knowledge",
          <BookOpen className="h-4 w-4" />,
          false,
          () => alert("Loading Enterprise Engineering Knowledge Base..."),
        )}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/5 space-y-2 mt-auto">
        <button
          onClick={onEmergencyStop}
          className="w-full py-2.5 bg-red-950/20 hover:bg-red-900/40 border border-red-500/20 hover:border-red-500 text-red-400 font-mono text-[11px] uppercase tracking-wider font-semibold rounded transition flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.02)]"
        >
          <AlertTriangle className="h-3.5 w-3.5 text-red-500 animate-pulse" />
          <span>Emergency Stop</span>
        </button>

        {(isAdmin || can("edit", "users")) && (
          <button
            onClick={() => router.push("/?tab=settings")}
            className="w-full flex items-center gap-3 px-4 py-2 rounded text-xs font-mono text-white/50 hover:text-white hover:bg-white/5 transition"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Settings</span>
          </button>
        )}

        <button
          onClick={() => router.push("/?tab=support")}
          className="w-full flex items-center gap-3 px-4 py-2 rounded text-xs font-mono text-white/50 hover:text-white hover:bg-white/5 transition"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          <span>Support</span>
        </button>

        {user && (
          <div className="flex items-center gap-3 pt-2 border-t border-white/5">
            <button
              onClick={async () => { await logout(); }}
              className="h-8 w-8 rounded-full border border-[#06b6d4]/40 hover:border-red-500/50 bg-[#121620] overflow-hidden flex items-center justify-center font-mono text-xs font-bold text-[#06b6d4] hover:text-red-400 transition shrink-0"
              title="Sign Out Session"
            >
              {user.firstName?.[0]}{user.lastName?.[0]}
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-mono text-white font-semibold truncate">
                {user.firstName} {user.lastName}
              </div>
              <div className="text-[9px] font-mono text-[#06b6d4] uppercase tracking-wider">{roleName}</div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

export function AppSidebar(props: AppSidebarProps) {
  return (
    <Suspense fallback={<aside className="w-64 bg-[#090b10] border-r border-white/5 shrink-0 h-full" />}>
      <SidebarInner {...props} />
    </Suspense>
  );
}
