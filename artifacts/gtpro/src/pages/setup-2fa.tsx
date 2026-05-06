import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import {
  Shield, Smartphone, Copy, Check, ArrowRight,
  AlertTriangle, Phone, Lock, Loader2, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";

const IS_DEV = import.meta.env.DEV;

type Step = "totp-setup" | "totp-verify" | "phone-entry" | "phone-verify" | "complete";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiPost(path: string, body: object) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

async function apiGet(path: string) {
  const res = await fetch(`${BASE}${path}`, { credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export function Setup2FAPage() {
  const { user, isLoaded } = useUser();
  const [, navigate]       = useLocation();

  const [step,         setStep]        = React.useState<Step>("totp-setup");
  const [qrCode,       setQrCode]      = React.useState("");
  const [totpSecret,   setTotpSecret]  = React.useState("");
  const [copied,       setCopied]      = React.useState(false);
  const [totpCode,     setTotpCode]    = React.useState("");
  const [phone,        setPhone]       = React.useState("");
  const [smsCode,      setSmsCode]     = React.useState("");
  const [devSmsCode,   setDevSmsCode]  = React.useState("");
  const [busy,         setBusy]        = React.useState(false);
  const [error,        setError]       = React.useState("");
  const [resendTimer,  setResendTimer] = React.useState(0);

  // Check if user already completed 2FA setup, or is admin (both bypass)
  React.useEffect(() => {
    if (!isLoaded) return;
    const email = user?.emailAddresses?.[0]?.emailAddress;
    if (email) {
      fetch(`${BASE}/api/admin/check?email=${encodeURIComponent(email)}`, { credentials: "include" })
        .then(r => r.json())
        .then((d) => { if (d.isAdmin) navigate("/dashboard"); })
        .catch(() => {});
    }
    apiGet("/api/auth/2fa/status").then((s) => {
      if (s.signupCompleted) navigate("/dashboard");
    }).catch(() => {});
  }, [isLoaded, user]);

  // Countdown timer for SMS resend
  React.useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  // ── TOTP: init ──────────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (step !== "totp-setup" || !isLoaded || !user) return;
    if (qrCode) return;

    (async () => {
      try {
        const factor = await user.createTOTP();

        setQrCode(factor.totp_uri); // ✅ correct field
        setTotpSecret(factor.secret ?? "");
      } catch (err) {
        console.error(err);
        setError("Failed to initialise authenticator setup. Please refresh.");
      }
    })();
    console.log(data);
  }, [step, isLoaded, user]);

  // ── TOTP: verify code ───────────────────────────────────────────────────────
  async function handleVerifyTotp() {
    if (!user || totpCode.length !== 6) return;
    setBusy(true); setError("");
    try {
      await user.verifyTOTP({ code: totpCode });
      // Record in our DB
      await apiPost("/api/auth/2fa/mark-totp", {});
      setTotpCode("");
      setStep("phone-entry");
    } catch (err: any) {
      setError(err.message ?? "Invalid code. Please try again.");
      setTotpCode("");
    } finally {
      setBusy(false);
    }
  }

  // ── Phone: send code ─────────────────────────────────────────────────────────
  async function handleSendSms() {
    if (!phone.trim()) return;
    setBusy(true); setError("");
    try {
      const data = await apiPost("/api/auth/phone/send-code", { phoneNumber: phone.trim() });
      setDevSmsCode(data.devCode ?? ""); // dev only
      setResendTimer(60);
      setStep("phone-verify");
    } catch (err: any) {
      setError(err.message ?? "Failed to send code. Check the number and try again.");
    } finally {
      setBusy(false);
    }
  }

  // ── Phone: verify code ───────────────────────────────────────────────────────
  async function handleVerifyPhone() {
    if (smsCode.length !== 6) return;
    setBusy(true); setError("");
    try {
      await apiPost("/api/auth/phone/verify", { code: smsCode });
      // Both TOTP + phone done — complete signup
      await apiPost("/api/auth/signup/complete", {});
      setStep("complete");
      setTimeout(() => navigate("/dashboard"), 2500);
    } catch (err: any) {
      setError(err.message ?? "Invalid code. Please try again.");
      setSmsCode("");
    } finally {
      setBusy(false);
    }
  }

  // ── Resend ───────────────────────────────────────────────────────────────────
  async function handleResend() {
    if (resendTimer > 0) return;
    setError("");
    try {
      const data = await apiPost("/api/auth/phone/send-code", { phoneNumber: phone.trim() });
      setDevSmsCode(data.devCode ?? "");
      setResendTimer(60);
    } catch (err: any) {
      setError(err.message ?? "Failed to resend code.");
    }
  }

  const handleCopy = () => {
    if (!totpSecret) return;
    navigator.clipboard.writeText(totpSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isLoaded) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const pageStyle = {
    background: "radial-gradient(ellipse 80% 60% at 50% 10%, rgba(212,175,55,0.08) 0%, transparent 60%), hsl(228 55% 4%)",
  };
  const cardStyle = {
    background: "linear-gradient(145deg, hsl(228 45% 7%) 0%, hsl(228 52% 5%) 100%)",
  };

  // Progress steps
  const progressSteps = [
    { id: "totp", label: "Auth App", done: ["phone-entry", "phone-verify", "complete"].includes(step) },
    { id: "phone", label: "Phone", done: step === "complete" },
  ];

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4 py-8" style={pageStyle}>
      <div className="w-full max-w-[500px] space-y-6">

        {/* Header */}
        <div className="text-center">
          <motion.div
            className="w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-4"
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 2.5, repeat: Infinity }}>
            <Shield size={30} className="text-primary" />
          </motion.div>
          <h1 className="text-3xl font-black mb-1" style={{ color: "#D4AF37" }}>Secure Your Account</h1>
          <p className="text-muted-foreground text-sm">Both steps are mandatory before you can access GTPro</p>
        </div>

        {/* Progress bar */}
        {step !== "complete" && (
          <div className="flex items-center gap-2">
            {progressSteps.map((s, i) => (
              <React.Fragment key={s.id}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-[11px] font-bold transition-all duration-500 ${
                    s.done
                      ? "bg-emerald-500 border-emerald-400 text-white"
                      : "border-primary/40 text-primary/60"
                  }`}>
                    {s.done ? <Check size={12} /> : i + 1}
                  </div>
                  <span className={`text-[12px] font-semibold ${s.done ? "text-emerald-400" : "text-muted-foreground"}`}>
                    {s.label}
                  </span>
                </div>
                {i < progressSteps.length - 1 && (
                  <div className={`flex-1 h-px transition-all duration-500 ${s.done ? "bg-emerald-500/50" : "bg-white/10"}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">

          {/* ── STEP 1: TOTP Setup ─────────────────────────────────────── */}
          {(step === "totp-setup") && (
            <motion.div key="totp-setup"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}
              className="rounded-2xl border border-white/[0.08] p-6 space-y-5" style={cardStyle}>

              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <Smartphone size={18} className="text-primary" />
                </div>
                <div>
                  <div className="font-bold text-[14px]">Step 1 of 2 — Authenticator App</div>
                  <div className="text-[11px] text-muted-foreground">Required — cannot be skipped</div>
                </div>
              </div>

              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                <div className="flex gap-2">
                  <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-300">
                    You must set up an authenticator app (Google Authenticator, Authy, or Microsoft Authenticator) before you can access the platform.
                  </p>
                </div>
              </div>

              {qrCode ? (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <div className="p-3 bg-white rounded-xl">
                      {qrCode.startsWith("otpauth://") ? (
                        <QRCodeSVG value={qrCode} size={176} bgColor="#ffffff" fgColor="#0D1221" level="M" />
                      ) : (
                        <img src={qrCode} alt="2FA QR Code" className="w-44 h-44" />
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1.5 text-center">Or enter this setup key manually:</p>
                    <div className="flex items-center gap-2 bg-white/[0.04] rounded-lg p-2.5 border border-white/[0.08]">
                      <code className="flex-1 text-[12px] font-mono tracking-wider break-all">{totpSecret}</code>
                      <button onClick={handleCopy}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0">
                        {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} className="text-muted-foreground" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                      <p className="text-[11px] text-red-300">{error}</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[12px] font-bold block">Enter 6-digit code from your app:</label>
                    <input
                      type="text" inputMode="numeric"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      onKeyDown={(e) => e.key === "Enter" && totpCode.length === 6 && handleVerifyTotp()}
                      maxLength={6} placeholder="000000"
                      disabled={busy}
                      className="w-full px-4 py-3 text-center text-2xl font-bold tracking-[0.4em] rounded-lg border border-white/[0.1] bg-white/[0.03] focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                    />
                  </div>

                  <Button onClick={handleVerifyTotp}
                    disabled={totpCode.length !== 6 || busy}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-10 rounded-lg font-bold">
                    {busy ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                    {busy ? "Verifying..." : "Verify & Continue"} <ArrowRight size={14} className="ml-2" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">Generating QR code…</span>
                </div>
              )}
            </motion.div>
          )}

          {/* ── STEP 2: Phone Entry ──────────────────────────────────────── */}
          {step === "phone-entry" && (
            <motion.div key="phone-entry"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}
              className="rounded-2xl border border-white/[0.08] p-6 space-y-5" style={cardStyle}>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <Check size={16} className="text-emerald-400" />
                </div>
                <div className="text-[12px] text-emerald-400 font-semibold">Authenticator app verified</div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <Phone size={18} className="text-primary" />
                </div>
                <div>
                  <div className="font-bold text-[14px]">Step 2 of 2 — Phone Verification</div>
                  <div className="text-[11px] text-muted-foreground">Required — real mobile numbers only</div>
                </div>
              </div>

              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
                <p className="text-[11px] text-blue-300">
                  Enter your real mobile number including country code (e.g. +1 555 123 4567). VoIP, virtual, and temporary numbers are not accepted.
                </p>
              </div>

              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                  <div className="flex gap-2">
                    <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-red-300">{error}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[12px] font-bold block">Mobile phone number:</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleSendSms()}
                  placeholder="+1 555 123 4567"
                  disabled={busy}
                  className="w-full px-4 py-2.5 rounded-lg border border-white/[0.1] bg-white/[0.03] text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                />
                <p className="text-[10px] text-muted-foreground">Include country code. Standard SMS rates apply.</p>
              </div>

              <Button onClick={handleSendSms}
                disabled={!phone.trim() || busy}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-10 rounded-lg font-bold">
                {busy ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                {busy ? "Sending..." : "Send Verification Code"} <ArrowRight size={14} className="ml-2" />
              </Button>
            </motion.div>
          )}

          {/* ── STEP 3: Phone Code Entry ─────────────────────────────────── */}
          {step === "phone-verify" && (
            <motion.div key="phone-verify"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}
              className="rounded-2xl border border-white/[0.08] p-6 space-y-5" style={cardStyle}>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <Lock size={18} className="text-primary" />
                </div>
                <div>
                  <div className="font-bold text-[14px]">Enter SMS Code</div>
                  <div className="text-[11px] text-muted-foreground">Sent to {phone}</div>
                </div>
              </div>

              {IS_DEV && devSmsCode && (
                <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3">
                  <p className="text-[11px] text-yellow-300 font-mono">
                    Dev mode code: <span className="font-bold tracking-widest">{devSmsCode}</span>
                  </p>
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                  <p className="text-[11px] text-red-300">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[12px] font-bold block">6-digit verification code:</label>
                <input
                  type="text" inputMode="numeric"
                  value={smsCode}
                  onChange={(e) => { setSmsCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && smsCode.length === 6 && handleVerifyPhone()}
                  maxLength={6} placeholder="000000"
                  disabled={busy}
                  autoFocus
                  className="w-full px-4 py-3 text-center text-2xl font-bold tracking-[0.4em] rounded-lg border border-white/[0.1] bg-white/[0.03] focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                />
                <p className="text-[10px] text-muted-foreground">Code expires in 10 minutes.</p>
              </div>

              <Button onClick={handleVerifyPhone}
                disabled={smsCode.length !== 6 || busy}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-10 rounded-lg font-bold">
                {busy ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                {busy ? "Verifying..." : "Verify & Complete Setup"} <ArrowRight size={14} className="ml-2" />
              </Button>

              <div className="flex items-center justify-between">
                <button onClick={() => { setStep("phone-entry"); setError(""); setSmsCode(""); }}
                  className="text-[11px] text-muted-foreground hover:text-white transition-colors">
                  Wrong number?
                </button>
                <button onClick={handleResend}
                  disabled={resendTimer > 0}
                  className="flex items-center gap-1 text-[11px] text-primary/70 hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  <RefreshCw size={11} />
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend code"}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── STEP 4: Complete ─────────────────────────────────────────── */}
          {step === "complete" && (
            <motion.div key="complete"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center space-y-4">

              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center mx-auto">
                <Shield size={36} className="text-emerald-400" />
              </motion.div>

              <div>
                <h2 className="text-2xl font-black text-emerald-400 mb-1">Account Secured!</h2>
                <p className="text-muted-foreground text-sm">
                  Authenticator app and phone number verified. Your account is fully protected.
                </p>
              </div>

              <div className="flex flex-col gap-2 text-left">
                {[
                  { icon: Smartphone, label: "Authenticator app enabled" },
                  { icon: Phone,      label: "Phone number verified" },
                  { icon: Lock,       label: "Account access secured" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-400 flex-shrink-0" />
                    <span className="text-[12px] text-emerald-300">{label}</span>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-muted-foreground animate-pulse">Redirecting to dashboard…</p>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
