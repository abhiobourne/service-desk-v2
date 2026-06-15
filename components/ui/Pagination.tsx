"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export function Pagination({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  pageSizeOptions = [10, 20, 50, 100],
  className = "",
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const pages = buildPageList(currentPage, totalPages);

  return (
    <div
      className={`flex items-center justify-between px-4 py-2.5 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-[#06070a] ${className}`}
    >
      {/* Left: rows-per-page selector */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-slate-400 dark:text-white/30">Rows per page</span>
        {onItemsPerPageChange ? (
          <div className="relative">
            <select
              value={itemsPerPage}
              onChange={(e) => {
                onItemsPerPageChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="appearance-none bg-white dark:bg-[#0b0e14] border border-slate-200 dark:border-white/10 rounded px-2.5 py-1 pr-6 text-[10px] font-mono text-slate-700 dark:text-white/70 focus:outline-none focus:border-blue-400 dark:focus:border-white/20 cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center">
              <svg className="w-3 h-3 text-slate-400 dark:text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        ) : (
          <span className="text-[10px] font-mono text-slate-500 dark:text-white/40 bg-white dark:bg-[#0b0e14] border border-slate-200 dark:border-white/10 rounded px-2.5 py-1">
            {itemsPerPage}
          </span>
        )}
      </div>

      {/* Center: page info + numbered page buttons */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-slate-400 dark:text-white/30 mr-1">
          {startItem}–{endItem} of {totalItems}
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Previous page"
            className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 dark:border-white/8 text-slate-400 dark:text-white/30 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-700 dark:hover:text-white/60 transition disabled:opacity-25 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {pages.map((p, i) =>
            p === "..." ? (
              <span key={`ellipsis-${i}`} className="w-7 h-7 flex items-center justify-center text-[10px] font-mono text-slate-300 dark:text-white/20">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p as number)}
                aria-label={`Page ${p}`}
                className={`w-7 h-7 flex items-center justify-center rounded text-[10px] font-mono transition ${
                  p === currentPage
                    ? "bg-slate-200 dark:bg-white/10 border border-slate-300 dark:border-white/20 text-slate-900 dark:text-white font-bold"
                    : "border border-transparent text-slate-400 dark:text-white/35 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-700 dark:hover:text-white/60"
                }`}
              >
                {p}
              </button>
            ),
          )}

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            aria-label="Next page"
            className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 dark:border-white/8 text-slate-400 dark:text-white/30 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-700 dark:hover:text-white/60 transition disabled:opacity-25 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function buildPageList(current: number, total: number): Array<number | "..."> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: Array<number | "..."> = [];

  if (current <= 4) {
    pages.push(1, 2, 3, 4, 5, "...", total);
  } else if (current >= total - 3) {
    pages.push(1, "...", total - 4, total - 3, total - 2, total - 1, total);
  } else {
    pages.push(1, "...", current - 1, current, current + 1, "...", total);
  }

  return pages;
}
