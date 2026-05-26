"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut, ChevronDown, Search, PlusCircle } from "lucide-react";
import { useAuth } from "../providers/AuthProvider";
import { useAbility } from "../providers/AbilityProvider";

export function TopNavbar() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { roleName, isClient } = useAbility();

  const [searchQuery, setSearchQuery] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <header className="relative z-[9999] h-12 shrink-0 border-b border-white/5 px-5 flex items-center justify-end gap-3 bg-[#090b10]/60 backdrop-blur">

      {/* Right: search + actions + profile */}
      <div className="flex items-center gap-3">
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-white/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search parameter..."
            className="w-48 bg-white/5 focus:bg-white/10 border border-white/5 focus:border-[#06b6d4]/30 rounded px-3 py-1.5 pl-9 text-xs text-white placeholder-white/30 font-mono transition focus:outline-none"
          />
        </div>

        <button
          onClick={() => router.push("/?tab=support")}
          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-mono tracking-wider font-bold rounded flex items-center gap-1.5 shadow-[0_0_12px_#2563eb22] transition uppercase"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          <span>Connect Machine</span>
        </button>

        {/* Bell */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setNotifOpen(v => !v)}
            className="relative p-2 text-white/60 hover:text-white rounded bg-white/5 border border-white/5 hover:border-white/10 transition"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-rose-500 rounded-full" />
          </button>

          {notifOpen && (
            <div className="absolute top-10 right-0 w-80 bg-[#0c0e16] border border-white/10 rounded-xl shadow-2xl z-[9999] overflow-hidden">
              <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-white/50 uppercase tracking-widest">Notifications</span>
                <span className="text-[9px] font-mono text-white/25">4 unread</span>
              </div>
              <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
                {[
                  { type: "critical", title: "Pressure Alert — Berlin Central", msg: "Helium leak detected. Pressure dropped below threshold.", time: "2m ago" },
                  { type: "warning",  title: "Filter Replacement Due",           msg: "Sydney Care Centre — overdue by 3 days.",               time: "18m ago" },
                  { type: "info",     title: "Maintenance Window",               msg: "Mumbai Facility scheduled in 2 hours.",                 time: "1h ago" },
                  { type: "success",  title: "Ticket #TKT-042 Resolved",         msg: "Tokyo Hub #12 scan completed successfully.",            time: "3h ago" },
                ].map((n, i) => {
                  const dot = n.type === "critical" ? "bg-rose-500" : n.type === "warning" ? "bg-amber-500" : n.type === "success" ? "bg-emerald-500" : "bg-blue-400";
                  const title = n.type === "critical" ? "text-rose-400" : n.type === "warning" ? "text-amber-400" : n.type === "success" ? "text-emerald-400" : "text-blue-400";
                  return (
                    <div key={i} className="px-4 py-3 hover:bg-white/3 transition cursor-pointer">
                      <div className="flex items-start gap-2.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-mono font-semibold leading-snug ${title}`}>{n.title}</p>
                          <p className="text-[10px] font-mono text-white/40 mt-0.5 leading-snug">{n.msg}</p>
                          <p className="text-[9px] font-mono text-white/20 mt-1">{n.time}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="px-4 py-2 border-t border-white/5">
                <button className="w-full text-[10px] font-mono text-white/30 hover:text-white/60 transition text-center">View all notifications</button>
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        {user && (
          <div ref={profileRef} className="relative">
            <button
              onClick={() => setProfileOpen(v => !v)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5 transition"
            >
              <div className="h-8 w-8 shrink-0 rounded-full border border-cyan-400/40 bg-[#121620] flex items-center justify-center font-mono text-xs font-bold text-cyan-400">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-[11px] font-mono font-semibold text-white leading-none">{user.firstName} {user.lastName}</p>
                <p className="text-[9px] font-mono text-cyan-400/80 uppercase tracking-wider mt-0.5">{roleName}</p>
              </div>
              <ChevronDown className={`h-3 w-3 text-white/30 transition-transform ${profileOpen ? "rotate-180" : ""}`} />
            </button>

            {profileOpen && (
              <div className="absolute top-10 right-0 w-52 bg-[#0c0e16] border border-white/10 rounded-xl shadow-2xl z-[9999] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5">
                  <p className="text-xs font-mono font-semibold text-white truncate">{user.firstName} {user.lastName}</p>
                  <p className="text-[9px] font-mono text-white/35 truncate mt-0.5">{(user as any).email ?? ""}</p>
                </div>
                <button
                  onClick={async () => { setProfileOpen(false); await logout(); router.push("/login"); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-mono text-red-400 hover:bg-red-500/10 transition"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
