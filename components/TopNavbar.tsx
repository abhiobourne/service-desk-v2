"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut, ChevronDown, PlusCircle, Sun, Moon } from "lucide-react";
import { useAuth } from "../providers/AuthProvider";
import { useAbility } from "../providers/AbilityProvider";
import { useTheme } from "../providers/ThemeProvider";
import { useNotifications } from "../providers/NotificationProvider";

export function TopNavbar() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { roleName } = useAbility();
  const { theme, toggleTheme } = useTheme();
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications();

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
            onClick={() => { setNotifOpen(v => !v); }}
            className="relative p-2 text-white/60 hover:text-white rounded bg-white/5 border border-white/5 hover:border-white/10 transition"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center bg-rose-500 rounded-full text-[8px] font-mono font-bold text-white px-0.5">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute top-10 right-0 w-80 bg-[#0c0e16] border border-white/10 rounded-xl shadow-2xl z-[9999] overflow-hidden">
              <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-white/50 uppercase tracking-widest">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[9px] font-mono text-cyan-400/70 hover:text-cyan-400 transition"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-[10px] font-mono text-white/20">
                    No notifications
                  </div>
                ) : (
                  notifications.slice(0, 20).map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        markRead(n.id);
                        setNotifOpen(false);
                        if (n.ticketId) {
                          router.push(`/tickets/${n.ticketId}`);
                        }
                      }}
                      className={`px-4 py-3 hover:bg-white/3 transition cursor-pointer ${!n.isRead ? "bg-white/[0.02]" : ""}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${!n.isRead ? "bg-violet-400" : "bg-white/15"}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-mono font-semibold leading-snug ${!n.isRead ? "text-violet-300" : "text-white/40"}`}>
                            {n.title}
                          </p>
                          <p className="text-[10px] font-mono text-white/40 mt-0.5 leading-snug truncate">{n.message}</p>
                          <p className="text-[9px] font-mono text-white/20 mt-1">
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {" · "}
                            {new Date(n.createdAt).toLocaleDateString("en-GB")}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
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
                {/* Theme toggle */}
                <button
                  onClick={toggleTheme}
                  className="w-full flex items-center justify-between gap-2.5 px-4 py-2.5 text-xs font-mono text-white/60 hover:bg-white/5 transition"
                >
                  <div className="flex items-center gap-2.5">
                    {theme === "dark"
                      ? <Sun className="h-3.5 w-3.5 text-amber-400" />
                      : <Moon className="h-3.5 w-3.5 text-slate-500" />}
                    <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
                  </div>
                  {/* Pill toggle */}
                  <div className={`relative w-8 h-4 shrink-0 rounded-full transition-colors ${theme === "light" ? "bg-blue-500" : "bg-white/15"}`}>
                    <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${theme === "light" ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                  </div>
                </button>

                <div className="border-t border-white/5" />

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
