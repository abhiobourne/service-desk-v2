"use client";

import { useEffect, useRef } from "react";
import { X, Bot, User, Ticket, Stethoscope } from "lucide-react";
import {
  useTroubleshootingAssistant,
  type TroubleshootingFaqItem,
} from "@/hooks/useTroubleshootingAssistant";
import { useTheme } from "@/providers/ThemeProvider";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  faqs: TroubleshootingFaqItem[];
  onRaiseTicket: () => void;
}

export function TroubleshootingAssistant({ isOpen, onClose, faqs, onRaiseTicket }: Props) {
  const { theme } = useTheme();
  const dark = theme === "dark";

  const {
    messages,
    isTyping,
    needsTicket,
    isResolved,
    startSession,
    handleUserResponse,
  } = useTroubleshootingAssistant();

  const bottomRef = useRef<HTMLDivElement>(null);
  const sessionStartedRef = useRef(false);

  useEffect(() => {
    if (isOpen && !sessionStartedRef.current) {
      sessionStartedRef.current = true;
      startSession(faqs);
    }
    if (!isOpen) {
      sessionStartedRef.current = false;
    }
  }, [isOpen, faqs, startSession]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // ── Theme-aware tokens ──────────────────────────────────────────────────────
  const drawerBg   = dark ? "rgba(9,11,16,0.96)"      : "rgba(255,255,255,0.97)";
  const drawerBdr  = dark ? "rgba(255,255,255,0.08)"   : "rgba(0,0,0,0.10)";
  const divBdr     = dark ? "rgba(255,255,255,0.07)"   : "rgba(0,0,0,0.08)";
  const subtleText = dark ? "rgba(255,255,255,0.30)"   : "rgba(15,23,42,0.40)";
  const closeBg    = dark ? "rgba(255,255,255,0.05)"   : "rgba(0,0,0,0.05)";
  const closeColor = dark ? "rgba(255,255,255,0.40)"   : "rgba(15,23,42,0.40)";
  const closeHover = dark ? "rgba(255,255,255,0.10)"   : "rgba(0,0,0,0.10)";
  const msgListBg  = dark ? "rgba(0,0,0,0.15)"         : "rgba(0,0,0,0.02)";
  const botAvBg    = dark ? "rgba(255,255,255,0.08)"   : "rgba(0,0,0,0.06)";
  const botAvBdr   = dark ? "rgba(255,255,255,0.12)"   : "rgba(0,0,0,0.10)";
  const botIconCls = dark ? "text-white/60"            : "text-slate-500";
  const botBubBg   = dark ? "rgba(255,255,255,0.08)"   : "#f1f5f9";
  const botBubBdr  = dark ? "rgba(255,255,255,0.10)"   : "rgba(0,0,0,0.08)";
  const botBubTxt  = dark ? "rgba(255,255,255,0.80)"   : "#1e293b";
  const dotBg      = dark ? "rgba(255,255,255,0.40)"   : "rgba(15,23,42,0.30)";
  const footerBg   = dark ? "rgba(255,255,255,0.03)"   : "rgba(0,0,0,0.02)";
  const noBtnBg    = dark ? "rgba(255,255,255,0.06)"   : "#e2e8f0";
  const noBtnBdr   = dark ? "rgba(255,255,255,0.12)"   : "rgba(0,0,0,0.10)";
  const noBtnTxt   = dark ? "rgba(255,255,255,0.70)"   : "#334155";
  const noBtnHov   = dark ? "rgba(255,255,255,0.10)"   : "#cbd5e1";

  return (
    <>
      {/* Backdrop — offset below the 48px topbar */}
      {isOpen && (
        <div
          className="fixed left-0 right-0 z-40 backdrop-blur-[2px]"
          style={{
            top: 48,
            bottom: 0,
            background: dark ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.15)",
          }}
          onClick={onClose}
        />
      )}

      {/* Slide-in drawer — starts below the 48px topbar */}
      <div
        className="fixed right-0 z-50 flex flex-col transition-transform duration-300 ease-in-out"
        style={{
          top: 48,
          height: "calc(100% - 48px)",
          width: 480,
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          background: drawerBg,
          backdropFilter: "blur(20px)",
          borderLeft: `1px solid ${drawerBdr}`,
          boxShadow: dark
            ? "-24px 0 60px rgba(0,0,0,0.55)"
            : "-24px 0 60px rgba(0,0,0,0.12)",
        }}
      >
        {/* ── Header ── */}
        <div
          className="shrink-0 flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${divBdr}` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: dark ? "rgba(37,99,235,0.18)" : "rgba(37,99,235,0.10)",
                border: "1px solid rgba(37,99,235,0.30)",
              }}
            >
              <Stethoscope className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p
                className="text-sm font-bold tracking-wide"
                style={{ color: dark ? "#fff" : "#0f172a" }}
              >
                Jitter
              </p>
              <p className="text-[10px] font-mono mt-0.5" style={{ color: subtleText }}>
                AI Troubleshooting Assistant
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition"
            style={{ background: closeBg, color: closeColor }}
            onMouseEnter={e => (e.currentTarget.style.background = closeHover)}
            onMouseLeave={e => (e.currentTarget.style.background = closeBg)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Message list ── */}
        <div
          className="flex-1 overflow-y-auto px-4 py-5 space-y-4"
          style={{ background: msgListBg }}
        >
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex items-end gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              {/* Avatar */}
              <div
                className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center"
                style={{
                  background: msg.role === "user" ? "rgba(37,99,235,0.15)" : botAvBg,
                  border: msg.role === "user"
                    ? "1px solid rgba(37,99,235,0.30)"
                    : `1px solid ${botAvBdr}`,
                }}
              >
                {msg.role === "user"
                  ? <User className="w-3.5 h-3.5 text-blue-500" />
                  : <Bot className={`w-3.5 h-3.5 ${botIconCls}`} />}
              </div>

              {/* Bubble */}
              <div
                className="max-w-[78%] px-4 py-3 text-xs leading-relaxed whitespace-pre-line"
                style={msg.role === "user" ? {
                  borderRadius: "16px 4px 16px 16px",
                  background: "rgba(37,99,235,0.14)",
                  border: "1px solid rgba(37,99,235,0.25)",
                  color: dark ? "#bfdbfe" : "#1e3a8a",
                  fontFamily: "inherit",
                } : {
                  borderRadius: "4px 16px 16px 16px",
                  background: botBubBg,
                  border: `1px solid ${botBubBdr}`,
                  color: botBubTxt,
                  fontFamily: "inherit",
                }}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex items-end gap-2.5">
              <div
                className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center"
                style={{ background: botAvBg, border: `1px solid ${botAvBdr}` }}
              >
                <Bot className={`w-3.5 h-3.5 ${botIconCls}`} />
              </div>
              <div
                className="px-4 py-3 flex items-center gap-1.5"
                style={{
                  borderRadius: "4px 16px 16px 16px",
                  background: botBubBg,
                  border: `1px solid ${botBubBdr}`,
                }}
              >
                {[0, 150, 300].map(delay => (
                  <span
                    key={delay}
                    className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{ background: dotBg, animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Footer ── */}
        <div
          className="shrink-0 px-4 py-4"
          style={{ borderTop: `1px solid ${divBdr}`, background: footerBg }}
        >
          {isResolved ? (
            <div className="flex items-center justify-center gap-2 py-2">
              <span className="text-xs font-semibold text-emerald-500">✓ This issue has been resolved.</span>
            </div>
          ) : needsTicket ? (
            <div className="space-y-3">
              <p className="text-[11px] text-center" style={{ color: subtleText }}>
                It seems we couldn&apos;t resolve the issue automatically.
              </p>
              <button
                onClick={() => { onClose(); onRaiseTicket(); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition"
                style={{ background: "rgba(239,68,68,0.85)", border: "1px solid rgba(239,68,68,0.35)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#ef4444")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(239,68,68,0.85)")}
              >
                <Ticket className="w-4 h-4" />
                Raise a Ticket
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-[10px] font-mono mr-auto" style={{ color: subtleText }}>
                {faqs.length} check{faqs.length !== 1 ? "s" : ""} available
              </p>
              <button
                onClick={() => handleUserResponse("No")}
                disabled={isTyping}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-40"
                style={{ background: noBtnBg, border: `1px solid ${noBtnBdr}`, color: noBtnTxt }}
                onMouseEnter={e => { if (!isTyping) e.currentTarget.style.background = noBtnHov; }}
                onMouseLeave={e => { e.currentTarget.style.background = noBtnBg; }}
              >
                No
              </button>
              <button
                onClick={() => handleUserResponse("Yes")}
                disabled={isTyping}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-40"
                style={{ background: "rgba(37,99,235,0.90)", border: "1px solid rgba(37,99,235,0.50)" }}
                onMouseEnter={e => { if (!isTyping) e.currentTarget.style.background = "#2563eb"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(37,99,235,0.90)"; }}
              >
                Yes
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
