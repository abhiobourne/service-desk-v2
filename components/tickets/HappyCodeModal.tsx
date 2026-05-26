"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, ShieldCheck } from "lucide-react";

const ANIMATION_CSS = `
  @keyframes hc-shake{10%,90%{transform:translate3d(-1px,0,0)}20%,80%{transform:translate3d(2px,0,0)}30%,50%,70%{transform:translate3d(-4px,0,0)}40%,60%{transform:translate3d(4px,0,0)}}
  @keyframes hc-pop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.12);opacity:1}100%{transform:scale(1);opacity:1}}
  @keyframes hc-otp-tick{0%{transform:scale(1)}40%{transform:scale(1.08)}100%{transform:scale(1)}}
  @keyframes hc-spin{to{transform:rotate(360deg)}}
  .hc-shake{animation:hc-shake 380ms cubic-bezier(.36,.07,.19,.97)}
  .hc-pop{animation:hc-pop 380ms cubic-bezier(.18,.89,.32,1.28)}
  .hc-otp-tick{animation:hc-otp-tick 360ms cubic-bezier(.18,.89,.32,1.28)}
  .hc-spin{animation:hc-spin 700ms linear infinite}
`;

const DIGIT_COUNT = 6;
const EMPTY = Array(DIGIT_COUNT).fill("");

type Phase = "input" | "locked";
type SlotState = "idle" | "error" | "success";

export interface HappyCodeModalProps {
  open: boolean;
  onClose: () => void;
  onVerify: (code: string) => Promise<boolean>;
  ticketId: string;
  maxAttempts?: number;
}

export function HappyCodeModal({ open, onClose, onVerify, ticketId, maxAttempts = 5 }: HappyCodeModalProps) {
  const [digits, setDigits] = useState<string[]>(EMPTY);
  const [slotState, setSlotState] = useState<SlotState>("idle");
  const [isShaking, setIsShaking] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [phase, setPhase] = useState<Phase>("input");
  const [attemptsLeft, setAttemptsLeft] = useState(maxAttempts);
  const [errorMsg, setErrorMsg] = useState("");
  const inputRefs = useRef<Array<HTMLInputElement | null>>(Array(DIGIT_COUNT).fill(null));
  const cssInjected = useRef(false);

  useEffect(() => {
    if (cssInjected.current) return;
    const tag = document.createElement("style");
    tag.textContent = ANIMATION_CSS;
    document.head.appendChild(tag);
    cssInjected.current = true;
  }, []);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setDigits(EMPTY.slice());
    setSlotState("idle");
    setIsShaking(false);
    setIsVerifying(false);
    setPhase("input");
    setAttemptsLeft(maxAttempts);
    setErrorMsg("");
  }, [open, maxAttempts]);

  useEffect(() => {
    if (phase === "input") setTimeout(() => inputRefs.current[0]?.focus(), 80);
  }, [phase]);

  const doVerify = async (code: string) => {
    if (isVerifying || phase === "locked") return;
    setIsVerifying(true);
    const ok = await onVerify(code);
    setIsVerifying(false);
    if (ok) {
      setSlotState("success");
      setTimeout(() => onClose(), 400);
      return;
    }
    const remaining = attemptsLeft - 1;
    setAttemptsLeft(remaining);
    setSlotState("error");
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 420);
    setErrorMsg(remaining > 0
      ? `Incorrect code · ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining`
      : "Too many incorrect attempts. Please contact support.");
    if (remaining <= 0) {
      setTimeout(() => setPhase("locked"), 800);
    } else {
      setTimeout(() => {
        setDigits(EMPTY.slice()); setSlotState("idle"); setErrorMsg("");
        inputRefs.current[0]?.focus();
      }, 450);
    }
  };

  const handleChange = (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(-1);
    const next = [...digits]; next[i] = val; setDigits(next);
    if (slotState !== "idle") { setSlotState("idle"); setErrorMsg(""); }
    if (val && i < DIGIT_COUNT - 1) inputRefs.current[i + 1]?.focus();
    else if (val && i === DIGIT_COUNT - 1 && next.every(Boolean)) doVerify(next.join(""));
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[i]) { const next = [...digits]; next[i] = ""; setDigits(next); }
      else if (i > 0) inputRefs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, DIGIT_COUNT);
    if (!pasted) return;
    const next = EMPTY.slice();
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, DIGIT_COUNT - 1)]?.focus();
    if (pasted.length === DIGIT_COUNT) doVerify(pasted);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-lg bg-[#0c0e16] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onPaste={handlePaste}
      >
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-white/30 hover:text-white/70 transition z-10">
          <X className="w-5 h-5" />
        </button>
        <div className="p-10">
          <div className="flex justify-center mb-5">
            <div className="w-12 h-12 rounded-2xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-violet-400" />
            </div>
          </div>
          <div className="text-center mb-6">
            <h2 className="text-base font-semibold text-white">Enter Happy Code</h2>
            <p className="text-xs font-mono text-white/40 mt-1.5">Enter the 6-digit code the client shared with you</p>
          </div>
          <div className={`flex justify-center gap-2 ${isShaking ? "hc-shake" : ""}`}>
            {digits.map((d, i) => {
              let cls = "w-12 h-16 text-center rounded-lg border outline-none text-2xl font-bold font-mono caret-violet-400 placeholder:text-white/15 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ";
              if (slotState === "error") cls += "border-red-500 bg-red-500/10 text-red-400 ";
              else if (slotState === "success") cls += "border-emerald-500 bg-emerald-500/10 text-emerald-400 hc-otp-tick ";
              else if (d) cls += "border-white/30 bg-white/5 text-white ";
              else cls += "border-white/10 bg-white/3 text-white focus:border-violet-500/60 focus:[box-shadow:0_0_0_3px_rgba(139,92,246,0.2)] ";
              return (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  placeholder="·"
                  disabled={phase === "locked" || isVerifying}
                  onChange={(e) => handleChange(i, e)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className={cls}
                />
              );
            })}
          </div>
          <div className="min-h-[18px] mt-3 text-center">
            {errorMsg && <p className={`text-xs font-mono ${phase === "locked" ? "text-red-400 font-medium" : "text-red-400"}`}>{errorMsg}</p>}
          </div>
          {isVerifying && (
            <div className="mt-4 flex items-center justify-center gap-2 text-xs font-mono text-white/30">
              <span className="hc-spin inline-block w-3 h-3 rounded-full border border-white/20 border-t-white/60" />
              Verifying…
            </div>
          )}
          {attemptsLeft < maxAttempts && attemptsLeft > 0 && phase === "input" && !isVerifying && (
            <p className="text-center text-[11px] font-mono text-white/30 mt-3">
              {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
