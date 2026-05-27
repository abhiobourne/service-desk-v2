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
  const isDeepTroubleshooting = /^\/troubleshooting\/[^/]+\/[^/]+/.test(pathname);
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
      <div className="flex-1 flex items-center justify-center bg-[#06070a] h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center animate-pulse">
            <Cpu className="h-5 w-5 text-blue-400" />
          </div>
          <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest animate-pulse">
            Initializing Session...
          </span>
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
