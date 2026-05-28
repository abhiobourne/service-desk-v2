"use client";

import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, X } from "lucide-react";

interface TicketCreatedPopupProps {
  ticketId: string;
  ticketRef: string;
  onClose: () => void;
  autoCloseMs?: number;
}

export function TicketCreatedPopup({
  ticketId,
  ticketRef,
  onClose,
  autoCloseMs = 25000,
}: TicketCreatedPopupProps) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const startRef = useRef<number>(Date.now());
  const rafRef = useRef<number>(0);

  // Entrance animation
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Countdown bar
  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, 1 - elapsed / autoCloseMs);
      setProgress(remaining * 100);
      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        handleClose();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [autoCloseMs]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-250 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Card */}
      <div
        className={`relative w-full max-w-sm mx-4 bg-[#090b10] border border-white/10 rounded-2xl shadow-2xl overflow-hidden transition-all duration-250 ${
          visible ? "scale-100 translate-y-0 opacity-100" : "scale-95 translate-y-3 opacity-0"
        }`}
      >
        {/* Countdown bar at top */}
        <div className="h-1 bg-white/5">
          <div
            className="h-full bg-[#2D6CFA] transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-3 right-3 p-1 rounded-full text-white/30 hover:text-white/70 hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="px-8 pt-8 pb-6 flex flex-col items-center text-center">
          {/* Success icon */}
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 border border-emerald-500/20">
            <CheckCircle2 className="w-7 h-7 text-emerald-400" strokeWidth={1.75} />
          </div>

          <h3 className="text-lg font-semibold text-white mb-1 font-mono">
            Ticket Created
          </h3>
          <p className="text-sm text-white/40 mb-5 font-mono">
            Your ticket has been submitted successfully.
          </p>

          {/* Ticket ID badge */}
          <div className="w-full bg-[#0c0e16] border border-white/5 rounded-xl px-4 py-3 mb-6">
            <p className="text-[11px] text-white/30 uppercase tracking-widest font-medium mb-0.5 font-mono">
              Ticket ID
            </p>
            <p className="text-lg font-mono font-semibold text-[#2D6CFA]">
              {ticketRef}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2.5 w-full">
            <a
              href={`/tickets/${ticketId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#2D6CFA] text-white text-sm font-semibold hover:bg-[#2460e0] font-mono transition-colors shadow-[0_0_15px_rgba(45,108,250,0.3)] hover:shadow-[0_0_20px_rgba(45,108,250,0.5)]"
            >
              View Ticket
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-2 text-sm text-white/30 hover:text-white/70 font-mono transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
