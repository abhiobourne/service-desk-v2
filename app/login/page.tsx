"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Cpu, UserCheck, Radio, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "../../providers/AuthProvider";

export default function LoginPage() {
  return (
    <React.Suspense fallback={<div className="h-screen bg-[#06070a]" />}>
      <LoginInner />
    </React.Suspense>
  );
}

function LoginInner() {
  const { user, login, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "/";

  const [operatorId, setOperatorId] = useState("");
  const [biometricPassphrase, setBiometricPassphrase] = useState("");
  const [loginStatus, setLoginStatus] = useState<"idle" | "scanning" | "success" | "error">("idle");
  const [loginProgressText, setLoginProgressText] = useState("");
  const [loginError, setLoginError] = useState("");

  // If already authenticated, push back to return URL
  useEffect(() => {
    if (!authLoading && user) {
      router.replace(returnUrl);
    }
  }, [authLoading, user, router, returnUrl]);

  const handleSecureAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorId || !biometricPassphrase) {
      setLoginError("Please enter both Industrial ID and passphrase.");
      return;
    }
    setLoginError("");
    setLoginStatus("scanning");
    setLoginProgressText("AUTHENTICATING WITH INDUSTRIAL OS BACKEND...");
    try {
      await login(operatorId, biometricPassphrase);
      setLoginProgressText("ACCESS GRANTED. DECRYPTING STORAGE DECK...");
      setLoginStatus("success");
      setTimeout(() => router.replace(returnUrl), 600);
    } catch (err: any) {
      setLoginStatus("error");
      setLoginError(err?.message || "Authentication failed. Check credentials.");
      setTimeout(() => setLoginStatus("idle"), 2500);
    }
  };

  if (authLoading) {
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

  return (
    <div className="fixed inset-0 z-50 bg-[#07090e] flex items-center justify-center font-mono overflow-hidden select-none">
      {/* Animated wireframe background */}
      <div className="absolute inset-0 opacity-15 pointer-events-none flex items-center justify-center scale-150 animate-[spin_60s_linear_infinite]">
        <div className="w-[600px] h-[600px] border-4 border-dashed border-[#06b6d4]/40 rounded-full flex items-center justify-center">
          <div className="w-[450px] h-[450px] border border-[#06b6d4]/30 rounded-full flex items-center justify-center">
            <div className="w-[300px] h-[300px] border-2 border-dotted border-[#06b6d4]/20 rounded-full" />
          </div>
        </div>
      </div>
      <div className="absolute top-24 left-32 text-[#a3e635] text-xs font-mono tracking-widest animate-pulse">• RNG: 8.442 uT</div>
      <div className="absolute bottom-24 right-48 text-white/40 text-xs font-mono tracking-wider">
        ▪ AXIS-Z: <span className="text-[#06b6d4]">ALIGNED</span>
      </div>
      <div className="absolute bottom-8 left-8 flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#a3e635]/20 bg-[#a3e635]/5 text-[#a3e635] text-[10px] font-mono tracking-wider uppercase">
        <span className="w-1.5 h-1.5 rounded-full bg-[#a3e635] animate-ping" />
        <span>SYSTEM STATUS: NOMINAL</span>
      </div>

      {/* Login Card */}
      <form
        onSubmit={handleSecureAccess}
        className="w-full max-w-sm bg-[#0c0e16]/90 border border-white/5 p-8 rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8),0_0_30px_rgba(163,230,53,0.03)] backdrop-blur-md relative z-10 flex flex-col items-center"
      >
        <div className="h-12 w-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center mb-4 shadow-[inset_0_0_10px_rgba(255,255,255,0.05)]">
          <Cpu className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-lg font-bold tracking-wider text-white text-center">Industrial OS</h2>
        <span className="text-[9px] font-mono text-[#06b6d4] tracking-widest uppercase mt-1 mb-6 block text-center">
          Mission Control Access
        </span>

        <div className="w-full space-y-2 mb-4">
          <label className="text-[10px] uppercase tracking-wider text-white/40 font-mono block">Industrial ID</label>
          <div className="relative">
            <input
              type="text"
              required
              value={operatorId}
              onChange={(e) => setOperatorId(e.target.value)}
              placeholder="Enter Operator ID"
              disabled={loginStatus === "scanning"}
              className="w-full bg-white/5 border border-white/10 rounded-md py-2.5 pl-10 pr-4 text-xs font-mono text-white placeholder-white/20 focus:outline-none focus:border-[#a3e635]/40 transition"
            />
            <UserCheck className="absolute left-3.5 top-3 h-3.5 w-3.5 text-white/30" />
          </div>
        </div>

        <div className="w-full space-y-2 mb-6">
          <label className="text-[10px] uppercase tracking-wider text-white/40 font-mono block">Biometric Passphrase</label>
          <div className="relative">
            <input
              type="password"
              required
              value={biometricPassphrase}
              onChange={(e) => setBiometricPassphrase(e.target.value)}
              placeholder="•••••••••••••"
              disabled={loginStatus === "scanning"}
              className="w-full bg-white/5 border border-white/10 rounded-md py-2.5 pl-10 pr-4 text-xs font-mono text-white placeholder-white/20 focus:outline-none focus:border-[#a3e635]/40 transition"
            />
            <Radio className="absolute left-3.5 top-3 h-3.5 w-3.5 text-white/30" />
          </div>
        </div>

        {loginError && (
          <div className="w-full px-3 py-2 rounded bg-red-950/40 border border-red-500/30 text-red-400 text-[10px] font-mono text-center mb-4">
            {loginError}
          </div>
        )}

        <button
          type="submit"
          disabled={loginStatus === "scanning"}
          className="w-full py-3 bg-[#a3e635] hover:bg-[#bef264] text-black font-bold text-xs uppercase tracking-widest rounded-md transition duration-200 flex items-center justify-center gap-2 disabled:bg-white/5 disabled:text-white/35 border border-[#a3e635]"
        >
          <span>{loginStatus === "scanning" ? "Authenticating..." : "Secure Access"}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => alert("Access request log dispatched to primary network supervisor.")}
          className="mt-4 text-[10px] text-white/30 hover:text-white transition uppercase hover:underline"
        >
          Request Access
        </button>

        {(loginStatus === "scanning" || loginStatus === "success") && (
          <>
            <div className="absolute inset-0 bg-[#a3e635]/[0.02] rounded-xl pointer-events-none" />
            <div className="absolute left-0 right-0 h-[2px] bg-[#a3e635] shadow-[0_0_8px_#a3e635] animate-[bounce_2s_infinite] pointer-events-none" />
            <div className="absolute bottom-16 left-6 right-6 text-center text-[8px] font-mono text-[#a3e635] tracking-widest uppercase animate-pulse">
              {loginProgressText}
            </div>
          </>
        )}
      </form>
    </div>
  );
}
