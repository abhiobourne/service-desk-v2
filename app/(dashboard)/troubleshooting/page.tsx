"use client";

import { Wrench } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

export default function TroubleshootingIndexPage() {
  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#07090e]">
      <div className="bg-white dark:bg-[#090b10] border-b border-slate-200 dark:border-white/5 px-6 py-4">
        <Breadcrumbs
          className="mb-2"
          items={[
            { label: "Dashboard", href: "/" },
            { label: "Troubleshooting" },
          ]}
        />
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center shrink-0">
            <Wrench className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white">Troubleshooting</h1>
            <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">Guided fault resolution</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center h-[calc(100vh-120px)]">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/8 flex items-center justify-center">
            <Wrench className="w-7 h-7 text-slate-400 dark:text-white/20" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-600 dark:text-white/50">Coming Soon</p>
            <p className="text-xs text-slate-400 dark:text-white/30 mt-1">Troubleshooting content will appear here.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
