"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../providers/AuthProvider";
import { useTheme } from "../../providers/ThemeProvider";
import "./login.css";

// Mini orbital visual
const OrbitalVisual = () => {
  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setMounted(true);
    let animationFrameId: number;
    const startTime = Date.now();
    const renderLoop = () => {
      setTick((Date.now() - startTime) / 1000 * 60);
      animationFrameId = requestAnimationFrame(renderLoop);
    };
    renderLoop();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  if (!mounted) return <svg viewBox="0 0 540 540" width="100%" height="100%" style={{ display: 'block' }} />;

  const t = tick * 0.05;
  return (
    <svg viewBox="0 0 540 540" width="100%" height="100%" style={{ display: 'block' }}>
      <defs>
        <radialGradient id="lpBore" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.55" />
          <stop offset="60%" stopColor="var(--accent)" stopOpacity="0.10" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* outer dial */}
      <circle cx="270" cy="270" r="260" fill="none" stroke="var(--hairline)" strokeWidth="0.5" />
      <circle cx="270" cy="270" r="230" fill="none" stroke="var(--hairline)" strokeWidth="0.4" strokeDasharray="2 6" />
      <circle cx="270" cy="270" r="190" fill="none" stroke="var(--hairline-strong)" strokeWidth="0.6" />

      {/* tick marks around outer */}
      {Array.from({ length: 72 }).map((_, i) => {
        const a = (i / 72) * Math.PI * 2;
        const r1 = 260, r2 = i % 6 === 0 ? 248 : 254;
        return <line key={i}
          x1={270 + Math.cos(a) * r1} y1={270 + Math.sin(a) * r1}
          x2={270 + Math.cos(a) * r2} y2={270 + Math.sin(a) * r2}
          stroke="var(--hairline-strong)" strokeWidth={i % 6 === 0 ? 0.7 : 0.3} />;
      })}

      {/* compass labels */}
      <g fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-3)">
        <text x="270" y="20" textAnchor="middle">000</text>
        <text x="520" y="274" textAnchor="middle">090</text>
        <text x="270" y="528" textAnchor="middle">180</text>
        <text x="20" y="274" textAnchor="middle">270</text>
      </g>

      {/* bore composition */}
      <g transform="translate(270 270)">
        <ellipse cx="0" cy="0" rx="140" ry="140" fill="url(#lpBore)" />
        <ellipse cx="0" cy="0" rx="120" ry="120" fill="none" stroke="var(--accent)" strokeWidth="0.8" opacity="0.6" />
        <ellipse cx="0" cy="0" rx="100" ry="100" fill="none" stroke="var(--hairline-strong)" strokeWidth="0.5" />
        <ellipse cx="0" cy="0" rx="80" ry="80" fill="none" stroke="var(--hairline)" strokeWidth="0.4" />

        {/* rotating field rings */}
        {[0, 1, 2, 3, 4].map((i) => (
          <ellipse key={i}
            cx="0" cy="0"
            rx={50 + i * 16}
            ry={(50 + i * 16) * 0.35}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="0.4"
            opacity={0.7 - i * 0.12}
            transform={`rotate(${(t * 12 + i * 24) % 360})`}
          />
        ))}

        {/* center */}
        <circle cx="0" cy="0" r="3" fill="var(--accent)" />
        <circle cx="0" cy="0" r="8" fill="none" stroke="var(--accent)" strokeWidth="0.5" opacity="0.5">
          <animate attributeName="r" values="8;20;8" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0;0.6" dur="2.4s" repeatCount="indefinite" />
        </circle>

        {/* coordinate readouts */}
        <g fontFamily="var(--font-mono)" fontSize="8" fill="var(--fg-3)" opacity="0.8">
          <text x="0" y="-148" textAnchor="middle">ISO · 0.0,0.0,0.0</text>
          <text x="0" y="158" textAnchor="middle">B0 · 2.9981 T</text>
        </g>
      </g>

      {/* corner brackets */}
      <g stroke="var(--accent)" strokeWidth="0.8" fill="none" opacity="0.6">
        <path d="M30 30 L30 50 M30 30 L50 30" />
        <path d="M510 30 L510 50 M510 30 L490 30" />
        <path d="M30 510 L30 490 M30 510 L50 510" />
        <path d="M510 510 L510 490 M510 510 L490 510" />
      </g>
    </svg>
  );
};

const IconEye = ({ on, size = 16 }: { on: boolean, size?: number }) => on ? (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8Z" />
    <circle cx="8" cy="8" r="2" />
  </svg>
) : (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 4.5C3.5 6 5.5 7.5 8 7.5s4.5-1.5 6-3M3 6.5 2 8M5 7.5 4.5 9.5M11 7.5 11.5 9.5M13 6.5 14 8" />
  </svg>
);

const IconMail = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
    <rect x="2" y="3.5" width="12" height="9" rx="1" />
    <path d="m2.5 4.5 5.5 4 5.5-4" />
  </svg>
);
const IconLock = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
    <rect x="3" y="7" width="10" height="7" rx="1.2" />
    <path d="M5 7V5a3 3 0 0 1 6 0v2" />
    <circle cx="8" cy="10.5" r="1" />
  </svg>
);
const IconShield = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
    <path d="M8 1.5 L13.5 4 V8.5 C13.5 11 11 13.5 8 14.5 C5 13.5 2.5 11 2.5 8.5 V4 Z" />
  </svg>
);
const IconArrow = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
);
const IconGlobe = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
    <circle cx="8" cy="8" r="5.5" />
    <ellipse cx="8" cy="8" rx="2.5" ry="5.5" />
    <path d="M2.5 8h11" />
  </svg>
);

const LiveClock = () => {
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!now) return <span className="font-mono">--:--:-- UTC</span>;
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');
  return <span className="font-mono">{hh}:{mm}:{ss} UTC</span>;
};

function useLiveValue(base: number, drift: number, ms: number) {
  const [val, setVal] = useState(base);
  useEffect(() => {
    const id = setInterval(() => {
      setVal(base + (Math.random() - 0.5) * drift * 2);
    }, ms);
    return () => clearInterval(id);
  }, [base, drift, ms]);
  return val;
}

function LoginScreen() {
  const { theme } = useTheme();
  const accent = 'cyan';
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);

  const { user, login, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "/";

  const [loginStatus, setLoginStatus] = useState<"idle" | "scanning" | "error">("idle");
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(returnUrl);
    }
  }, [authLoading, user, router, returnUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !pw) {
      setLoginError("Please enter your credentials.");
      return;
    }
    setLoginError("");
    setLoginStatus("scanning");
    try {
      await login(email, pw);
      setTimeout(() => router.replace(returnUrl), 600);
    } catch (err: any) {
      setLoginStatus("error");
      setLoginError(err?.message || "Authentication failed. Check credentials.");
      setTimeout(() => setLoginStatus("idle"), 2500);
    }
  };

  const helium = useLiveValue(76.2, 0.02, 1200);
  const uptime = useLiveValue(99.71, 0.005, 1500);

  return (
    <div className="lp" data-theme={theme || "dark"} style={{ '--accent-h': accent === 'cyan' ? '200' : accent === 'amber' ? '75' : accent === 'magenta' ? '340' : '155' } as any}>
      {/* Brand */}
      <div className="lp-brand">
        <div className="lp-brand-grid" />
        <div className="lp-brand-glow" />
        <div className="lp-scan" />
        <div className="lp-reg tl" />
        <div className="lp-reg bl" />

        <div className="lp-visual">
          <OrbitalVisual />
        </div>

        <div className="lp-header">
          <div className="lp-mark">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
              <path d="M2 12 6 4l2 5 2-5 4 8" />
            </svg>
          </div>
          <div>
            <div className="lp-wordmark">Meridian</div>
            <div className="lp-wordmark-sub">Imaging Systems OS · v8.2</div>
          </div>
        </div>

        <div className="lp-hero">
          <div className="lp-eyebrow">
            <span className="bar" />
            Industrial Operating System
          </div>
          <h1 className="lp-headline">
            Every machine you operate, <em>monitored as one.</em>
          </h1>
          <p className="lp-sub">
            Live telemetry, guided diagnostics, and component-level service for your entire imaging fleet. Sign in to your operations console.
          </p>
        </div>

        {/* Telemetry strip */}
        <div className="lp-telemetry">
          <div className="lp-tele">
            <div className="lp-tele-label">Systems Online</div>
            <div className="lp-tele-val">142<span className="lp-tele-unit">/ 144</span></div>
          </div>
          <div className="lp-tele">
            <div className="lp-tele-label">Mean Uptime · 30d</div>
            <div className="lp-tele-val">{uptime.toFixed(2)}<span className="lp-tele-unit">%</span></div>
          </div>
          <div className="lp-tele">
            <div className="lp-tele-label">Cryo Reserves Avg</div>
            <div className="lp-tele-val">{helium.toFixed(1)}<span className="lp-tele-unit">% He</span></div>
          </div>
        </div>

        <div className="lp-status">
          <div className="lp-status-item">
            <span className="dot" />
            <span>All services operational</span>
          </div>
          <div className="lp-status-item" style={{ marginLeft: 'auto' }}>
            <IconGlobe />
            <span>US-EAST-1 · <LiveClock /></span>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="lp-form-wrap">
        <div className="lp-reg tr" />
        <div className="lp-reg br" />

        <div className="lp-top-meta">
          <span>BUILD · 2026.05.27 · #af2b1c0</span>
          <span className="lp-region-pill">
            <IconGlobe size={11} />
            English · United States
          </span>
        </div>

        <form className="lp-form" onSubmit={handleSubmit}>
          <div className="lp-title">
            <h2>Sign in to Service Desk</h2>
            <p>Use your work email or your hospital's identity provider.</p>
          </div>

          <div className="lp-field">
            <label className="lp-label">
              <span>Work email</span>
            </label>
            <div className="lp-input">
              <IconMail />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@hospital.org" autoComplete="email" disabled={loginStatus === "scanning"} />
            </div>
          </div>

          <div className="lp-field">
            <label className="lp-label">
              <span>Password</span>
              <a href="#" tabIndex={-1}>Forgot →</a>
            </label>
            <div className="lp-input">
              <IconLock />
              <input type={show ? 'text' : 'password'} required value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••••" autoComplete="current-password" disabled={loginStatus === "scanning"} />
              <button type="button" onClick={() => setShow(!show)} style={{
                background: 'transparent', border: 0, padding: 0, cursor: 'pointer',
                color: 'var(--fg-3)', display: 'grid', placeItems: 'center',
              }} title={show ? 'Hide' : 'Show'}>
                <IconEye on={show} />
              </button>
            </div>
          </div>

          {loginError && (
            <div className="w-full px-3 py-2 rounded bg-rose-950/40 border border-rose-500/30 text-rose-400 text-xs text-center">
              {loginError}
            </div>
          )}

          <div className="lp-row">
            <label className="lp-checkbox">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} disabled={loginStatus === "scanning"} />
              <span className="lp-checkbox-box" />
              <span>Trust this workstation · 30 days</span>
            </label>
          </div>

          <button type="submit" className="lp-submit" disabled={loginStatus === "scanning"}>
            {loginStatus === "scanning" ? "Authenticating..." : "Continue"} <IconArrow />
          </button>
        </form>

        <div className="lp-help" style={{ marginTop: "auto" }}>
          <div className="lp-help-glyph"><IconShield /></div>
          <div>
            <h4 className="lp-help-title">Hospital-managed access</h4>
            <p className="lp-help-body">
              Your access scope is provisioned by your IT administrator. Contact your site's biomedical engineering team to request additional machine permissions.
            </p>
          </div>
        </div>

        <div className="lp-footer">
          <span>© 2026 Servide Desk Industrial · All rights reserved</span>
          <span style={{ display: 'flex', gap: 16 }}>
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Status</a>
            <a href="#">Support</a>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={<div className="h-screen bg-[#06070a]" />}>
      <LoginScreen />
    </React.Suspense>
  );
}
