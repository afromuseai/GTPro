import React, { useState } from "react";
import { motion } from "framer-motion";
import { useWallet } from "@/engine/wallet-engine";
import { Button } from "@/components/ui/button";
import {
  Wallet, TrendingUp, Lock, Zap, Clock, Activity,
  Info, AlertTriangle, Plus, RefreshCw, ChevronRight,
} from "lucide-react";

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const QUICK_AMOUNTS = [25, 50, 100, 200];

const TX_LABELS: Record<string, string> = {
  deposit:      "Credit Deposit",
  usage:        "Service Usage",
  refund:       "Credit Refund",
  plan_purchase:"Plan Purchase",
};

export function WalletPage() {
  const { user, transactions, deposit, subscribePlan, refreshWallet, isLoading, error } = useWallet();
  const [depositing,  setDepositing]  = useState(false);
  const [customAmt,   setCustomAmt]   = useState("");
  const [subBusy,     setSubBusy]     = useState<string | null>(null);
  const [depositErr,  setDepositErr]  = useState("");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle size={28} className="text-amber-400" />
        <div className="text-center">
          <p className="text-[14px] font-semibold text-foreground mb-1">Unable to load wallet</p>
          <p className="text-[12px] text-muted-foreground">{error ?? "Authentication required. Please sign in to access your wallet."}</p>
        </div>
        <button onClick={refreshWallet}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/[0.1] text-[12px] font-medium text-muted-foreground hover:text-foreground hover:border-white/20 transition-all">
          <RefreshCw size={13} /> Retry
        </button>
      </div>
    );
  }

  const handleDeposit = async (amount: number) => {
    if (depositing || amount < 10 || amount > 500) return;
    setDepositing(true);
    setDepositErr("");
    try {
      await deposit(amount);
      setCustomAmt("");
    } catch (err) {
      setDepositErr(err instanceof Error ? err.message : "Deposit failed");
    } finally {
      setDepositing(false);
    }
  };

  const handleSubscribe = async (plan: string) => {
    setSubBusy(plan);
    try {
      await subscribePlan(plan);
    } catch (err) {
      console.error(err);
    } finally {
      setSubBusy(null);
    }
  };

  const availableCredits = user.balance - user.lockedBalance;
  const planPct = user.includedHours > 0
    ? Math.min(1, user.usedHours / user.includedHours)
    : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <Wallet size={22} className="text-primary" /> Service Credits
            </h2>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Manage credits for bot execution &amp; AI analysis
            </p>
          </div>
          <button onClick={refreshWallet}
            className="p-2 rounded-lg hover:bg-white/[0.05] text-muted-foreground/60 hover:text-foreground transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>
      </motion.div>

      {/* ── Disclaimer banner ───────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.05 }}
        className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 flex gap-3">
        <Info size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-300/90 leading-relaxed">
          <span className="font-bold">GTPro Service Credits</span> are used exclusively to access platform services
          (bot execution, AI analysis). Credits are <span className="font-bold">non-withdrawable</span> and cannot
          be converted to cash. All analysis and execution is powered by real market data and
          do not represent real financial returns.
        </p>
      </motion.div>

      {/* ── Balance stats grid ──────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Service Credits",
            sub: "Available to spend",
            value: availableCredits,
            icon: Wallet,
            color: "text-emerald-400",
            bg: "bg-emerald-400/8 border-emerald-400/15",
          },
          {
            label: "Locked Credits",
            sub: "In active sessions",
            value: user.lockedBalance,
            icon: Lock,
            color: "text-amber-400",
            bg: "bg-amber-400/8 border-amber-400/15",
          },
          {
            label: "Total Credits Spent",
            sub: "Lifetime usage cost",
            value: user.totalSpent,
            icon: Activity,
            color: "text-violet-400",
            bg: "bg-violet-400/8 border-violet-400/15",
          },
        ].map(({ label, sub, value, icon: Icon, color, bg }) => (
          <div key={label} className={`rounded-xl border p-4 ${bg}`}
            style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 52% 5%) 100%)" }}>
            <div className="flex items-center gap-1.5 mb-2">
              <Icon size={13} className={color} />
              <span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground/50">{label}</span>
            </div>
            <div className={`text-[22px] font-black tabular-nums ${color}`}>
              ${value.toFixed(2)}
            </div>
            <div className="text-[10px] text-muted-foreground/40 mt-0.5">{sub}</div>
          </div>
        ))}
      </motion.div>

      {/* ── Plan + Deposit row ──────────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* Current plan */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12 }}
          className="rounded-xl border border-primary/20 p-5"
          style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 52% 5%) 100%)" }}>

          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap size={15} className="text-primary" />
              <h3 className="text-[13px] font-bold">Current Plan</h3>
            </div>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary uppercase tracking-wider">
              {user.billingPlan}
            </span>
          </div>

          {user.billingPlan === "free" ? (
            <div className="space-y-3">
              <p className="text-[12px] text-muted-foreground/70 leading-relaxed">
                Upgrade to reduce your per-hour execution rate. Credits are deducted from your plan's included hours first.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm"
                  onClick={() => handleSubscribe("weekly")}
                  disabled={subBusy !== null}
                  className="h-9 text-[11px] border-primary/30 text-primary hover:bg-primary/10 flex flex-col gap-0">
                  <span className="font-bold">Weekly</span>
                  <span className="text-[9px] opacity-60">$15 · 12h included</span>
                </Button>
                <Button size="sm"
                  onClick={() => handleSubscribe("monthly")}
                  disabled={subBusy !== null}
                  className="h-9 text-[11px] flex flex-col gap-0">
                  <span className="font-bold">Monthly</span>
                  <span className="text-[9px] opacity-70">$49 · 50h included</span>
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground/40">
                Free rate: $1.80/hr &nbsp;·&nbsp; Weekly: $1.20/hr &nbsp;·&nbsp; Monthly: $0.90/hr
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[10px] text-muted-foreground/50 mb-0.5">Hours consumed</div>
                  <div className="text-[20px] font-black tabular-nums">
                    {user.usedHours}
                    <span className="text-[14px] text-muted-foreground/50 font-normal"> / {user.includedHours}h</span>
                  </div>
                </div>
                <span className="text-[11px] text-primary/70 font-bold">
                  {user.includedHours - user.usedHours}h left
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${planPct * 100}%` }}
                  transition={{ duration: 0.7 }}
                />
              </div>
              {user.planExpiresAt && (
                <div className="text-[11px] text-muted-foreground/50 flex items-center gap-1.5">
                  <Clock size={11} />
                  Plan expires {formatDate(user.planExpiresAt)}
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Add service credits */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}
          className="rounded-xl border border-emerald-400/15 p-5"
          style={{ background: "linear-gradient(145deg, rgba(16,185,129,0.04) 0%, transparent 100%)" }}>

          <div className="flex items-center gap-2 mb-4">
            <Plus size={15} className="text-emerald-400" />
            <h3 className="text-[13px] font-bold">Add Service Credits</h3>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              {QUICK_AMOUNTS.map(amt => (
                <Button key={amt} variant="outline" size="sm"
                  onClick={() => handleDeposit(amt)}
                  disabled={depositing}
                  className="h-8 text-[11px] font-bold border-white/10 hover:border-emerald-400/30 hover:text-emerald-400">
                  ${amt}
                </Button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="number"
                value={customAmt}
                onChange={e => { setCustomAmt(e.target.value); setDepositErr(""); }}
                placeholder="Custom amount ($10–$500)"
                min={10} max={500}
                className="flex-1 h-8 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/40"
              />
              <Button size="sm" onClick={() => handleDeposit(Number(customAmt))}
                disabled={depositing || !customAmt}
                className="h-8 text-[11px] px-3">
                {depositing ? "..." : <ChevronRight size={14} />}
              </Button>
            </div>

            {depositErr && (
              <p className="text-[11px] text-red-400 flex items-center gap-1">
                <AlertTriangle size={11} /> {depositErr}
              </p>
            )}

            <p className="text-[10px] text-muted-foreground/40 flex items-center gap-1">
              <Lock size={10} /> Credits are non-refundable and non-withdrawable
            </p>
          </div>
        </motion.div>
      </div>

      {/* ── Transaction history ─────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}
        className="rounded-xl border border-white/[0.07] p-5"
        style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 52% 5%) 100%)" }}>

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[13px] font-bold flex items-center gap-2">
            <Activity size={14} className="text-blue-400" /> Transaction History
          </h3>
          <span className="text-[10px] text-muted-foreground/40">{transactions.length} records</span>
        </div>

        <div className="space-y-1.5">
          {transactions.length === 0 ? (
            <div className="text-[12px] text-muted-foreground/50 text-center py-8">No transactions yet</div>
          ) : (
            transactions.slice(0, 30).map((txn, i) => {
              const isDebit = txn.amount < 0;
              const label = TX_LABELS[txn.type] ?? txn.type;
              return (
                <motion.div
                  key={txn.id}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18, delay: i * 0.015 }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-white/[0.04] hover:border-white/[0.09] transition-colors"
                  style={{ background: "rgba(255,255,255,0.015)" }}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black flex-shrink-0 ${
                    isDebit
                      ? "bg-red-400/10 text-red-400"
                      : "bg-emerald-400/10 text-emerald-400"
                  }`}>
                    {isDebit ? "−" : "+"}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold">{label}</div>
                    <div className="text-[10px] text-muted-foreground/50 truncate">{txn.description}</div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className={`text-[12px] font-black tabular-nums ${isDebit ? "text-red-400" : "text-emerald-400"}`}>
                      {isDebit ? "−" : "+"}${Math.abs(txn.amount).toFixed(2)}
                    </div>
                    <div className="text-[10px] text-muted-foreground/40">{formatDate(txn.createdAt)}</div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </motion.div>

      {/* ── Bottom disclaimer ───────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.25 }}
        className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 text-center">
        <p className="text-[10px] text-muted-foreground/40 leading-relaxed">
          GTPro is a trading intelligence and automation platform. Service credits are used exclusively for accessing
          platform services and are non-withdrawable. All metrics displayed reflect real system behavior and do not
          represent real financial returns or investment advice.
        </p>
      </motion.div>

    </div>
  );
}
