"use client";

import React from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Breadcrumbs } from "./Breadcrumbs";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  breadcrumbs: BreadcrumbItem[];
  icon: React.ReactNode;
  iconClassName?: string;
  title: React.ReactNode;
  subtitle?: string;
  right?: React.ReactNode;
  backHref?: string;
  className?: string;
}

export function PageHeader({
  breadcrumbs,
  icon,
  iconClassName = "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10",
  title,
  subtitle,
  right,
  backHref,
  className,
}: PageHeaderProps) {
  const router = useRouter();

  return (
    <div className={`shrink-0 bg-white dark:bg-[#090b10] border-b border-slate-200 dark:border-white/5 px-6 py-4 ${className ?? ""}`}>
      <Breadcrumbs className="mb-2" items={breadcrumbs} />
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {backHref && (
            <button
              onClick={() => router.push(backHref)}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/5 transition shrink-0"
            >
              <ArrowLeft className="w-4 h-4 text-slate-600 dark:text-white/60" />
            </button>
          )}
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${iconClassName}`}>
            {icon}
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2.5 flex-wrap">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {right && <div className="flex items-center gap-2.5 flex-wrap">{right}</div>}
      </div>
    </div>
  );
}
