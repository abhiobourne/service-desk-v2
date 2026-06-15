"use client";

import React, { useEffect, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
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
      <div className="flex-1 flex items-center justify-center bg-[#06070a] h-screen overflow-hidden select-none">
        <div className="flex flex-col items-center gap-10">
          {/* Brand mark */}
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white tracking-tight"
              style={{ background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)" }}
            >
              SD
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-mono font-semibold text-white/50 uppercase tracking-[0.18em]">
                Quarkcity
              </span>
              <span className="text-base font-bold text-white leading-tight tracking-wide">
                Service Desk
              </span>
            </div>
          </div>

          {/* Animated dots */}
          <div className="flex items-center gap-2">
            {[0, 160, 320].map(delay => (
              <span
                key={delay}
                className="w-2 h-2 rounded-full animate-bounce"
                style={{
                  background: "linear-gradient(135deg, #3b82f6, #6366f1)",
                  animationDelay: `${delay}ms`,
                  animationDuration: "1s",
                }}
              />
            ))}
          </div>
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
