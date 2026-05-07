import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Copy, Check, Users, DollarSign, Clock, ChevronRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@clerk/react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface ReferralStats {
  total:       number;
  completed:   number;
  pending:     number;
  totalEarned: number;
  referrals:   { email: string; status: string; credits: number; createdAt: string }[];
}

function useReferral() {
  const { getToken } = useAuth();
  const [code,    setCode]    = useState<string | null>(null);
  const [stats,   setStats]   = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);

  const authFetch = useCallback(async (url: string, opts: RequestInit = {}) => {
    const token = await getToken().catch(() => null);
    return fetch(url, {
      ...opts,
      credentials: "include",
      headers: {
        ...(opts.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }, [getToken]);

  useEffect(() => {
    async function load() {
      try {
        const [codeRes, statsRes] = await Promise.all([
          authFetch(`${BASE}/api/referral/code`),
          authFetch(`${BASE}/api/referral/stats`),
        ]);
        if (codeRes.ok)  setCode((await codeRes.json()).code);
        if (statsRes.ok) setStats(await statsRes.json());
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [authFetch]);

  const applyCode = useCallback(async (code: string): Promise<{ ok: boolean; error?: string; credits?: number }> => {
    const res = await authFetch(`${BASE}/api/referral/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error };
    return { ok: true, credits: data.creditsEarned };
  }, [authFetch]);

  return { code, stats, loading, applyCode };
}

export function ReferralPage() {
  const { code, stats, loading, applyCode } = useReferral();
  const [copied,    setCopied]    = useState(false);
  const [applyVal,  setApplyVal]  = useState("");
  const [applying,  setApplying]  = useState(false);
  const [applyMsg,  setApplyMsg]  = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const copyCode = useCallback(() => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const copyLink = useCallback(() => {
    if (!code) return;
    const link = `${window.location.origin}${BASE}/sign-up?ref=${code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handleApply = useCallback(async () => {
    if (!applyVal.trim()) return;
    setApplying(true);
    setApplyMsg(null);
    const result = await applyCode(applyVal.trim());
    if (result.ok) {
      setApplyMsg({ type: "ok", text: `+${result.credits} credits added to your account!` });
      setApplyVal("");
    } else {
      setApplyMsg({ type: "err", text: result.error ?? "Failed to apply code" });
    }
    setApplying(false);
  }, [applyVal, applyCode]);

  return (
    <div className="space-y-6 max-w-3xl mx-auto w-full">

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(200,168,75,0.12)", border: "1px solid rgba(200,168,75,0.2)" }}>
            <Gift size={20} className="text-primary" />
          </div>
          <div>
            <h2 className="text-[22px] font-black tracking-tight">Referral Program</h2>
            <p className="text-[12px] text-muted-foreground">Earn $5 credits for every friend who joins GTPro.</p>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      {!loading && stats && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 }}>
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: Users,      label: "Total Referrals", value: stats.total,                        color: "text-foreground" },
              { icon: Check,      label: "Completed",       value: stats.completed,                    color: "text-emerald-400" },
              { icon: DollarSign, label: "Credits Earned",  value: `$${stats.totalEarned}`,             color: "text-primary" },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="rounded-2xl border border-white/[0.07] p-5"
                style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 52% 5.5%) 100%)" }}>
                <div className="flex items-center gap-2 mb-2.5">
                  <Icon size={11} className="text-primary/60" />
                  <span className="text-[9px] font-bold tracking-[0.18em] uppercase text-muted-foreground/40">{label}</span>
                </div>
                <div className={`text-[24px] font-black tabular-nums ${color}`}>{value}</div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* My code */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.08 }}>
        <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
          style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}>
          <div className="h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
          <div className="p-6">
            <h3 className="text-[15px] font-bold mb-1">Your Referral Code</h3>
            <p className="text-[12px] text-muted-foreground mb-5">Share your code and both you and your friend earn $5 credits when they complete onboarding.</p>

            {loading ? (
              <div className="h-14 rounded-xl border border-white/[0.07] animate-pulse" style={{ background: "rgba(255,255,255,0.03)" }} />
            ) : code ? (
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center justify-between rounded-xl border border-primary/25 px-5 py-3.5"
                  style={{ background: "rgba(200,168,75,0.06)" }}>
                  <span className="text-[22px] font-black tracking-[0.08em] text-primary font-mono">{code}</span>
                  <Zap size={16} className="text-primary/40" />
                </div>
                <Button onClick={copyCode} variant="outline" size="sm"
                  className="h-12 px-4 border-white/[0.1] text-muted-foreground hover:text-foreground gap-2">
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            ) : (
              <div className="text-[12px] text-muted-foreground/40">Loading your code…</div>
            )}

            {code && (
              <button onClick={copyLink}
                className="mt-3 text-[11px] text-primary/50 hover:text-primary/80 transition-colors flex items-center gap-1.5">
                <Copy size={10} />
                Copy invite link
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Apply a code */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 }}>
        <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
          style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}>
          <div className="p-6">
            <h3 className="text-[15px] font-bold mb-1">Have a Referral Code?</h3>
            <p className="text-[12px] text-muted-foreground mb-5">Enter a friend's referral code to claim your $5 welcome credits.</p>

            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  value={applyVal}
                  onChange={e => setApplyVal(e.target.value.toUpperCase())}
                  placeholder="GT-XXXXXX"
                  className="h-11 font-mono tracking-wider border-white/[0.1] bg-white/[0.03] text-sm"
                  onKeyDown={e => { if (e.key === "Enter") handleApply(); }}
                />
              </div>
              <Button onClick={handleApply} disabled={applying || !applyVal.trim()}
                className="h-11 px-5 font-bold gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                {applying ? <Clock size={13} className="animate-spin" /> : <ChevronRight size={13} />}
                Apply
              </Button>
            </div>

            <AnimatePresence>
              {applyMsg && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className={`mt-3 text-[12px] font-medium px-3 py-2 rounded-lg ${
                    applyMsg.type === "ok"
                      ? "text-emerald-400 bg-emerald-400/8 border border-emerald-400/15"
                      : "text-red-400 bg-red-400/8 border border-red-400/15"
                  }`}>
                  {applyMsg.text}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Referral history */}
      {stats && stats.referrals.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.12 }}>
          <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
            style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}>
            <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-2">
              <Users size={13} className="text-primary" />
              <span className="text-[12px] font-bold">Referred Users</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {stats.referrals.map((r, i) => (
                <div key={i} className="px-5 py-3.5 flex items-center gap-4 hover:bg-white/[0.015] transition-colors">
                  <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/15 flex items-center justify-center text-[12px] font-black text-primary">
                    {r.email[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold truncate">{r.email}</div>
                    <div className="text-[10px] text-muted-foreground/40 mt-0.5">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-[12px] font-black text-primary">+{r.credits} CR</div>
                  <div className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
                    r.status === "completed"
                      ? "border-emerald-400/25 bg-emerald-400/8 text-emerald-400"
                      : "border-amber-400/25 bg-amber-400/8 text-amber-400"
                  }`}>
                    {r.status.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* How it works */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.15 }}>
        <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
          style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}>
          <div className="px-5 py-4 border-b border-white/[0.05]">
            <span className="text-[12px] font-bold">How It Works</span>
          </div>
          <div className="p-5">
            <div className="space-y-4">
              {[
                { step: "1", title: "Share your code", desc: "Copy your referral code and share it with friends or on social media." },
                { step: "2", title: "Friend signs up",  desc: "Your friend creates a GTPro account using your referral code." },
                { step: "3", title: "Both earn credits", desc: "You earn $5 credits and your friend gets $5 welcome credits instantly." },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex items-start gap-4">
                  <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-[11px] font-black text-primary shrink-0 mt-0.5">
                    {step}
                  </div>
                  <div>
                    <div className="text-[13px] font-bold">{title}</div>
                    <div className="text-[11px] text-muted-foreground/60 mt-0.5">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
