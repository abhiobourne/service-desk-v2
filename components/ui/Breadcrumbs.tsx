"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  showHome?: boolean;
  className?: string;
}

export function Breadcrumbs({ items, showHome = false, className = "" }: BreadcrumbsProps) {
  const router = useRouter();

  return (
    <nav
      aria-label="breadcrumb"
      className={`flex items-center gap-1 text-[10px] font-mono ${className}`}
    >
      {showHome && (
        <>
          <button
            onClick={() => router.push("/")}
            className="text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/60 transition flex items-center gap-1"
            title="Dashboard"
          >
            <Home className="w-3 h-3" />
          </button>
          {items.length > 0 && <ChevronRight className="w-3 h-3 text-slate-300 dark:text-white/15 shrink-0" />}
        </>
      )}

      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight className="w-3 h-3 text-slate-300 dark:text-white/15 shrink-0" />}
            {item.href && !isLast ? (
              <button
                onClick={() => router.push(item.href!)}
                className="text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/60 transition truncate max-w-[160px]"
              >
                {item.label}
              </button>
            ) : (
              <span className={`truncate max-w-[200px] ${isLast ? "text-slate-600 dark:text-white/60" : "text-slate-400 dark:text-white/30"}`}>
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
