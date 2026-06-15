"use client";

import React, { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar, User, Building2, Wrench, FileText, CheckCircle2 } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { MOCK_RECORDS, STATUS_CONFIG, TYPE_STYLE } from "../page";

export default function MaintenanceDetailsPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const record = useMemo(() => MOCK_RECORDS.find((r) => r.id === id), [id]);

  if (!record) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-[#07090e]">
        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-4 border border-slate-200 dark:border-white/10">
          <Wrench className="w-5 h-5 text-slate-400 dark:text-white/20" />
        </div>
        <p className="text-sm font-mono text-slate-500 dark:text-white/40">Maintenance record not found</p>
        <button
          onClick={() => router.push("/maintenance")}
          className="mt-4 px-4 py-2 text-xs font-mono text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition"
        >
          Go Back
        </button>
      </div>
    );
  }

  const s = STATUS_CONFIG[record.status];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#07090e]">
      {/* ── Header ── */}
      <div className="bg-white dark:bg-[#090b10] border-b border-slate-200 dark:border-white/5 px-6 py-4">
        <Breadcrumbs
          className="mb-2"
          items={[
            { label: "Dashboard", href: "/" },
            { label: "Maintenance", href: "/maintenance" },
            { label: record.id },
          ]}
        />
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/maintenance")}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/5 transition"
            >
              <ArrowLeft className="w-4 h-4 text-slate-600 dark:text-white/60" />
            </button>
            <div>
              <h1 className="text-xl font-bold font-mono text-slate-900 dark:text-white flex items-center gap-3">
                {record.id}
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide ${s.bg} ${s.text}`}>
                  {s.icon}
                  {s.label}
                </span>
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Main Info */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl p-6">
              <h3 className="text-sm font-mono font-bold text-slate-800 dark:text-white/80 mb-5">Equipment Details</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Wrench className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-mono text-slate-400 dark:text-white/40 uppercase tracking-widest mb-0.5">Equipment</p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-white/90">{record.equipment}</p>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-white/50 mt-0.5">{record.equipmentId}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg border border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-2 mb-1 text-slate-400 dark:text-white/30">
                      <Building2 className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-mono uppercase tracking-widest">Department</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-white/70">{record.department}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-2 mb-1 text-slate-400 dark:text-white/30">
                      <FileText className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-mono uppercase tracking-widest">Type</span>
                    </div>
                    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md mt-1 ${TYPE_STYLE[record.type]}`}>
                      {record.type}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes Section */}
            <div className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl p-6">
              <h3 className="text-sm font-mono font-bold text-slate-800 dark:text-white/80 mb-4">Maintenance Notes</h3>
              {record.notes ? (
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5">
                  <p className="text-sm font-mono text-slate-600 dark:text-white/60 leading-relaxed">{record.notes}</p>
                </div>
              ) : (
                <p className="text-xs font-mono text-slate-400 dark:text-white/30 italic">No notes provided for this maintenance task.</p>
              )}
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl p-6">
              <h3 className="text-sm font-mono font-bold text-slate-800 dark:text-white/80 mb-5">Schedule Info</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4 text-slate-500 dark:text-white/40" />
                  </div>
                  <div>
                    <p className="text-[10px] font-mono text-slate-400 dark:text-white/30 uppercase tracking-widest">Scheduled</p>
                    <p className="text-xs font-semibold text-slate-800 dark:text-white/70">
                      {new Date(record.scheduledDate).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}
                    </p>
                  </div>
                </div>
                
                {record.completedDate && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-500/20">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-mono text-slate-400 dark:text-white/30 uppercase tracking-widest">Completed</p>
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        {new Date(record.completedDate).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl p-6">
              <h3 className="text-sm font-mono font-bold text-slate-800 dark:text-white/80 mb-5">Assignment</h3>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/10">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-500/30">
                  <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-[10px] font-mono text-blue-400/80 dark:text-blue-300/50 uppercase tracking-widest">Technician</p>
                  <p className="text-xs font-bold text-blue-900 dark:text-blue-100">{record.technician}</p>
                </div>
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
