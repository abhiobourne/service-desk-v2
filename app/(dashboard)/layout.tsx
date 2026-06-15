"use client";

import React, { useEffect, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Cpu } from "lucide-react";
import { useAuth } from "../../providers/AuthProvider";
import { AppSidebar } from "../../components/AppSidebar";
import { TopNavbar } from "../../components/TopNavbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </Suspense>
  );
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isDeepTroubleshooting = /^\/diagnostics\/troubleshooting\/[^/]+\/[^/]+/.test(pathname);
  const isFullView = searchParams.get("full") === "1" || isDeepTroubleshooting;

  useEffect(() => {
    if (!authLoading && !user && !isFullView) {
      const sp = searchParams.toString();
      const currentUrl = pathname + (sp ? `?${sp}` : "");
      router.replace(`/login?returnUrl=${encodeURIComponent(currentUrl)}`);
    }
  }, [authLoading, user, isFullView, router, pathname, searchParams]);

  if (authLoading || (!user && !isFullView)) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#06070a] h-screen overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-blue-600/5 blur-[120px]" />
        </div>

        <div className="relative flex flex-col items-center gap-8">
          {/* Animated rings */}
          <div className="relative w-24 h-24 flex items-center justify-center">
            {/* Outer slow ring */}
            <div className="absolute inset-0 rounded-full border border-blue-500/10 animate-[spin_8s_linear_infinite]" />
            {/* Mid ring with gap */}
            <div className="absolute inset-[6px] rounded-full border-t border-r border-cyan-500/20 animate-[spin_4s_linear_infinite]" />
            {/* Inner pulsing ring */}
            <div className="absolute inset-[12px] rounded-full border border-blue-500/30 animate-pulse" />
            {/* Core icon */}
            <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600/30 to-cyan-600/20 border border-blue-500/40 flex items-center justify-center shadow-[0_0_24px_rgba(59,130,246,0.15)]">
              <Cpu className="h-6 w-6 text-blue-400" />
            </div>
          </div>

          {/* Text */}
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm font-semibold text-white/60 tracking-widest uppercase font-mono">
              Service Desk
            </p>
            {/* Animated progress bar */}
            <div className="w-40 h-[2px] bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite] rounded-full" />
            </div>
            <p className="text-[10px] font-mono text-white/20 uppercase tracking-[0.25em]">
              Initializing session
            </p>
          </div>

          {/* Corner decorations */}
          <div className="absolute -top-10 -left-12 w-4 h-4 border-t border-l border-white/10" />
          <div className="absolute -top-10 -right-12 w-4 h-4 border-t border-r border-white/10" />
          <div className="absolute -bottom-6 -left-12 w-4 h-4 border-b border-l border-white/10" />
          <div className="absolute -bottom-6 -right-12 w-4 h-4 border-b border-r border-white/10" />
        </div>
      </div>
    );
  }

  if (isFullView) {
    return (
      <div className="h-screen overflow-hidden bg-slate-50 dark:bg-[#06070a] text-slate-900 dark:text-white">
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-[#06070a] text-slate-900 dark:text-white">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNavbar />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
