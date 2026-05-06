import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet, type PaymentMethod } from "@/engine/wallet-engine";
import { Button } from "@/components/ui/button";
import {
  Wallet, Lock, Activity, Info, AlertTriangle, RefreshCw,
  CreditCard, Building2, CheckCircle, X, Zap, Star, Shield,
  Gift, ChevronRight, ArrowRight,
} from "lucide-react";

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const TX_LABELS: Record<string, string> = {
  deposit:       "Credit Deposit",
  usage:         "Service Usage",
  refund:        "Credit Refund",
  plan_purchase: "Plan Purchase",
  welcome_bonus: "Welcome Bonus",
};

const TX_COLORS: Record<string, string> = {
  deposit:       "bg-emerald-400/10 text-emerald-400",
  welcome_bonus: "bg-primary/10 text-primary",
  refund:        "bg-blue-400/10 text-blue-400",
  usage:         "bg-red-400/10 text-red-400",
  plan_purchase: "bg-amber-400/10 text-amber-400",
};

const CREDIT_PACKAGES = [
  {
    id:          "starter",
    label:       "Starter",
    amount:      25,
    hours:       "~50",
    rate:        "$0.50/hr",
    desc:        "Perfect for exploring strategies and running short sessions.",
    features:    ["50 bot-hours of execution", "Real-time AI analysis", "ABF signal access", "Basic fleet monitoring"],
    highlight:   false,
    icon:        Zap,
    iconColor:   "text-blue-400",
    borderColor: "border-white/[0.08]",
    bg:          "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)",
  },
  {
    id:          "professional",
    label:       "Professional",
    amount:      100,
    hours:       "~250",
    rate:        "$0.40/hr",
    desc:        "For active traders running multiple simultaneous strategies.",
    features:    ["250 bot-hours of execution", "Priority AI processing", "All fleet access (ABF, SBF, VCBF)", "Advanced security monitoring", "Real-time P&L analytics"],
    highlight:   true,
    icon:        Star,
    iconColor:   "text-primary",
    borderColor: "border-primary/35",
    bg:          "linear-gradient(145deg, hsl(228 45% 10%) 0%, hsl(228 50% 7%) 100%)",
  },
  {
    id:          "institutional",
    label:       "Institutional",
    amount:      500,
    hours:       "~1,400",
    rate:        "$0.35/hr",
    desc:        "Maximum throughput for institutional-grade operations.",
    features:    ["1,400+ bot-hours of execution", "Dedicated fleet allocation", "SBF priority threat monitoring", "Full audit log access", "API rate limit exemptions"],
    highlight:   false,
    icon:        Shield,
    iconColor:   "text-violet-400",
    borderColor: "border-white/[0.08]",
    bg:          "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)",
  },
];

// ── Payment modal ─────────────────────────────────────────────────────────────

function formatCardNumber(v: string) {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(v: string) {
  const digits = v.replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) return digits.slice(0, 2) + "/" + digits.slice(2);
  return digits;
}

interface PaymentModalProps {
  pkg:      typeof CREDIT_PACKAGES[0];
  onClose:  () => void;
  onPaid:   () => void;
  deposit:  (amount: number, pm: PaymentMethod) => Promise<{ success: boolean; newBalance: number }>;
}

function PaymentModal({ pkg, onClose, onPaid, deposit }: PaymentModalProps) {
  const [tab, setTab] = useState<"card" | "bank">("card");

  const [cardNumber,  setCardNumber]  = useState("");
  const [cardExpiry,  setCardExpiry]  = useState("");
  const [cardCvv,     setCardCvv]     = useState("");
  const [cardName,    setCardName]    = useState("");

  const [bankAccount, setBankAccount] = useState("");
  const [bankRouting, setBankRouting] = useState("");
  const [bankHolder,  setBankHolder]  = useState("");

  const [paying,   setPaying]   = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState(false);

  const handlePay = async () => {
    setError("");
    let pm: PaymentMethod;

    if (tab === "card") {
      const digits = cardNumber.replace(/\s/g, "");
      if (!digits || digits.length < 13) { setError("Enter a valid card number"); return; }
      if (!cardExpiry || !/^\d{2}\/\d{2}$/.test(cardExpiry)) { setError("Expiry must be MM/YY (e.g. 08/27)"); return; }
      if (!cardCvv || cardCvv.length < 3) { setError("Enter a valid CVV"); return; }
      if (!cardName.trim()) { setError("Cardholder name is required"); return; }
      pm = { type: "card", number: digits, expiry: cardExpiry, cvv: cardCvv, holderName: cardName.trim() };
    } else {
      if (!bankAccount.trim() || bankAccount.trim().length < 4) { setError("Enter a valid account number"); return; }
      const routing = bankRouting.replace(/\s/g, "");
      if (!routing || routing.length !== 9) { setError("Routing number must be exactly 9 digits"); return; }
      if (!bankHolder.trim()) { setError("Account holder name is required"); return; }
      pm = { type: "bank", accountNumber: bankAccount.trim(), routingNumber: routing, accountHolder: bankHolder.trim() };
    }

    setPaying(true);
    try {
      await deposit(pkg.amount, pm);
      setSuccess(true);
      setTimeout(() => { onPaid(); onClose(); }, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        className="relative w-full max-w-md rounded-2xl border border-white/[0.1] overflow-hidden z-10"
        style={{ background: "linear-gradient(145deg, hsl(228 45% 9%) 0%, hsl(228 52% 6%) 100%)" }}
        initial={{ scale: 0.93, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.93, y: 20 }}
        transition={{ duration: 0.22 }}
      >
        <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-white/[0.06]">
          <div>
            <div className="text-[10px] font-black tracking-[0.2em] uppercase text-muted-foreground/50 mb-1">Complete Purchase</div>
            <div className="text-[18px] font-black">{pkg.label} Package</div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-[26px] font-black tabular-nums" style={{ color: "#D4AF37" }}>${pkg.amount}</span>
              <span className="text-[12px] text-muted-foreground">· {pkg.hours} bot-hours · {pkg.rate}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.07] text-muted-foreground/50 hover:text-foreground transition-colors mt-0.5">
            <X size={16} />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center gap-4 py-12 px-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
              className="w-16 h-16 rounded-full bg-emerald-400/15 border border-emerald-400/30 flex items-center justify-center"
            >
              <CheckCircle size={32} className="text-emerald-400" />
            </motion.div>
            <div className="text-center">
              <div className="text-[16px] font-black text-emerald-400 mb-1">Payment Successful!</div>
              <div className="text-[12px] text-muted-foreground/60">${pkg.amount} in service credits added to your account</div>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Payment method tabs */}
            <div className="flex rounded-xl border border-white/[0.08] overflow-hidden bg-white/[0.02]">
              {(["card", "bank"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setError(""); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[12px] font-bold transition-all ${
                    tab === t
                      ? "bg-white/[0.08] text-foreground"
                      : "text-muted-foreground/50 hover:text-muted-foreground"
                  }`}
                >
                  {t === "card" ? <CreditCard size={13} /> : <Building2 size={13} />}
                  {t === "card" ? "Credit / Debit Card" : "Bank Transfer"}
                </button>
              ))}
            </div>

            {/* Card form */}
            {tab === "card" && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-1 block">Card Number</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="1234 5678 9012 3456"
                    value={cardNumber}
                    onChange={e => setCardNumber(formatCardNumber(e.target.value))}
                    maxLength={19}
                    className="w-full h-10 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/30 tracking-widest"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-1 block">Expiry (MM/YY)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="08/27"
                      value={cardExpiry}
                      onChange={e => setCardExpiry(formatExpiry(e.target.value))}
                      maxLength={5}
                      className="w-full h-10 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/30"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-1 block">CVV</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      placeholder="•••"
                      value={cardCvv}
                      onChange={e => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      maxLength={4}
                      className="w-full h-10 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/30"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-1 block">Cardholder Name</label>
                  <input
                    type="text"
                    placeholder="Full name on card"
                    value={cardName}
                    onChange={e => setCardName(e.target.value)}
                    className="w-full h-10 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/30"
                  />
                </div>
              </div>
            )}

            {/* Bank form */}
            {tab === "bank" && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-1 block">Account Holder Name</label>
                  <input
                    type="text"
                    placeholder="Full legal name"
                    value={bankHolder}
                    onChange={e => setBankHolder(e.target.value)}
                    className="w-full h-10 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-1 block">Routing Number (9 digits)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="021000021"
                    value={bankRouting}
                    onChange={e => setBankRouting(e.target.value.replace(/\D/g, "").slice(0, 9))}
                    maxLength={9}
                    className="w-full h-10 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-1 block">Account Number</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Your bank account number"
                    value={bankAccount}
                    onChange={e => setBankAccount(e.target.value.replace(/\D/g, "").slice(0, 17))}
                    maxLength={17}
                    className="w-full h-10 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/30"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground/40 flex items-center gap-1.5">
                  <Lock size={10} /> ACH bank transfer · 1–3 business days to clear
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-red-400/25 bg-red-400/8">
                <AlertTriangle size={12} className="text-red-400 shrink-0" />
                <p className="text-[11px] text-red-400">{error}</p>
              </div>
            )}

            {/* Pay button */}
            <Button
              onClick={handlePay}
              disabled={paying}
              className="w-full h-11 text-[13px] font-black"
              style={{ background: "linear-gradient(135deg, #D4AF37, #b8922e)", color: "#0D1221" }}
            >
              {paying ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-[#0D1221]/40 border-t-[#0D1221] rounded-full animate-spin" />
                  Processing…
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  {tab === "card" ? <CreditCard size={14} /> : <Building2 size={14} />}
                  Pay ${pkg.amount} &mdash; Add {pkg.hours} Bot-Hours
                  <ArrowRight size={14} className="ml-0.5" />
                </span>
              )}
            </Button>

            <p className="text-[10px] text-muted-foreground/35 text-center flex items-center justify-center gap-1">
              <Lock size={9} /> Secured · Credits are non-refundable and non-withdrawable
            </p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function WalletPage() {
  const { user, transactions, deposit, refreshWallet, isLoading, error } = useWallet();

  const [selectedPkg,  setSelectedPkg]  = useState<typeof CREDIT_PACKAGES[0] | null>(null);
  const [showModal,    setShowModal]    = useState(false);

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

  const availableCredits = user.balance - user.lockedBalance;
  const isNewUser        = transactions.length <= 1 && user.balance <= 5 && user.totalSpent === 0;

  const openPackage = (pkg: typeof CREDIT_PACKAGES[0]) => {
    setSelectedPkg(pkg);
    setShowModal(true);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <Wallet size={22} className="text-primary" /> Service Credits
            </h2>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Manage credits for bot execution &amp; AI analysis · No subscriptions · Pay only for what you run
            </p>
          </div>
          <button onClick={refreshWallet}
            className="p-2 rounded-lg hover:bg-white/[0.05] text-muted-foreground/60 hover:text-foreground transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>
      </motion.div>

      {/* ── Welcome bonus banner (new users) ────────────────────────────────── */}
      {isNewUser && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
          className="rounded-xl border border-primary/30 bg-primary/6 px-4 py-3 flex gap-3 items-start"
        >
          <Gift size={16} className="text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] font-bold text-primary mb-0.5">$5 Free Credits — Welcome to GTPro!</p>
            <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
              We've added <span className="font-bold text-primary">$5 in free service credits</span> to your account to get you started. 
              Purchase any credit package below to unlock more bot-hours.
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Disclaimer ──────────────────────────────────────────────────────── */}
      {!isNewUser && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.05 }}
          className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 flex gap-3">
          <Info size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-300/90 leading-relaxed">
            <span className="font-bold">GTPro Service Credits</span> are used exclusively to access platform services
            (bot execution, AI analysis). Credits are <span className="font-bold">non-withdrawable</span> and cannot
            be converted to cash.
          </p>
        </motion.div>
      )}

      {/* ── Balance stats ────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }}
        className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          {
            label: "Available Credits",
            sub:   "Ready to spend",
            value: availableCredits,
            icon:  Wallet,
            color: "text-emerald-400",
            bg:    "border-emerald-400/15",
          },
          {
            label: "Locked Credits",
            sub:   "In active sessions",
            value: user.lockedBalance,
            icon:  Lock,
            color: "text-amber-400",
            bg:    "border-amber-400/15",
          },
          {
            label: "Total Spent",
            sub:   "Lifetime usage",
            value: user.totalSpent,
            icon:  Activity,
            color: "text-violet-400",
            bg:    "border-violet-400/15",
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

      {/* ── Credit packages ──────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12 }}>
        <div className="flex items-center gap-2 mb-4">
          <CreditCard size={14} className="text-primary" />
          <h3 className="text-[14px] font-bold">Add Service Credits</h3>
          <span className="text-[10px] text-muted-foreground/40 ml-1">· Credits never expire · Cancel anytime</span>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {CREDIT_PACKAGES.map((pkg, i) => {
            const Icon = pkg.icon;
            return (
              <motion.div
                key={pkg.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.14 + i * 0.07 }}
                whileHover={{ y: -4, transition: { duration: 0.18 } }}
                className={`relative rounded-2xl border overflow-hidden flex flex-col ${pkg.borderColor}`}
                style={{ background: pkg.bg }}
              >
                {pkg.highlight && (
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent" />
                )}
                {pkg.highlight && (
                  <div className="absolute top-3 right-3 text-[8px] font-black tracking-[0.18em] uppercase px-2 py-0.5 rounded-full border border-primary/40 bg-primary/15 text-primary">
                    Most Popular
                  </div>
                )}

                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      pkg.highlight ? "bg-primary/15 border border-primary/20" : "bg-white/[0.05] border border-white/[0.08]"
                    }`}>
                      <Icon size={15} className={pkg.iconColor} />
                    </div>
                    <span className="text-[11px] font-black tracking-[0.15em] uppercase text-muted-foreground/50">{pkg.label}</span>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-[32px] font-black tabular-nums" style={{ color: "#D4AF37" }}>${pkg.amount}</span>
                      <span className="text-[12px] text-muted-foreground">in credits</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-bold text-primary">{pkg.hours} bot-hours</span>
                      <span className="text-[10px] text-muted-foreground/50">· {pkg.rate}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/60 mt-2 leading-relaxed">{pkg.desc}</p>
                  </div>

                  <div className="space-y-1.5 mb-5 flex-1">
                    {pkg.features.map(f => (
                      <div key={f} className="flex items-start gap-2">
                        <CheckCircle size={11} className="text-primary/70 shrink-0 mt-0.5" />
                        <span className="text-[11px] text-muted-foreground/70">{f}</span>
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={() => openPackage(pkg)}
                    className={`w-full h-10 text-[12px] font-bold transition-all ${
                      pkg.highlight
                        ? "text-[#0D1221]"
                        : "border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-foreground"
                    }`}
                    style={pkg.highlight ? { background: "linear-gradient(135deg, #D4AF37, #b8922e)", color: "#0D1221" } : undefined}
                    variant={pkg.highlight ? "default" : "outline"}
                  >
                    Add ${pkg.amount} Credits <ChevronRight size={13} className="ml-1" />
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>

        <p className="text-[10px] text-muted-foreground/35 text-center mt-4 flex items-center justify-center gap-1.5">
          <Lock size={9} />
          All credits are non-expiring · No subscriptions · Real-time usage transparency
        </p>
      </motion.div>

      {/* ── Execution rate info ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.22 }}
        className="rounded-xl border border-white/[0.07] p-4"
        style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 52% 5%) 100%)" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Zap size={13} className="text-blue-400" />
          <h3 className="text-[13px] font-bold">Bot Execution Rate</h3>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Starter ($25)",       rate: "$0.50/hr", hours: "50h",    color: "text-blue-400"   },
            { label: "Professional ($100)",  rate: "$0.40/hr", hours: "250h",   color: "text-primary"    },
            { label: "Institutional ($500)", rate: "$0.35/hr", hours: "1,400h", color: "text-violet-400" },
          ].map(({ label, rate, hours, color }) => (
            <div key={label} className="text-center rounded-lg border border-white/[0.05] p-3 bg-white/[0.02]">
              <div className={`text-[16px] font-black tabular-nums ${color}`}>{rate}</div>
              <div className="text-[10px] font-bold text-muted-foreground/60 mt-0.5">{hours} included</div>
              <div className="text-[9px] text-muted-foreground/40 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground/40 mt-3">
          Credits are consumed at the rate shown above per active bot-hour. Unused credits are returned automatically when sessions end early.
        </p>
      </motion.div>

      {/* ── Transaction history ──────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.27 }}
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
              const label   = TX_LABELS[txn.type] ?? txn.type;
              const dotCls  = TX_COLORS[txn.type] ?? (isDebit ? "bg-red-400/10 text-red-400" : "bg-emerald-400/10 text-emerald-400");
              return (
                <motion.div
                  key={txn.id}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18, delay: i * 0.015 }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-white/[0.04] hover:border-white/[0.09] transition-colors"
                  style={{ background: "rgba(255,255,255,0.015)" }}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black flex-shrink-0 ${dotCls}`}>
                    {txn.type === "welcome_bonus" ? <Gift size={13} /> : (isDebit ? "−" : "+")}
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

      {/* ── Bottom disclaimer ────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.3 }}
        className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 text-center">
        <p className="text-[10px] text-muted-foreground/40 leading-relaxed">
          GTPro is a trading intelligence and automation platform. Service credits are used exclusively for accessing
          platform services and are non-withdrawable. All metrics displayed reflect real system behavior and do not
          represent real financial returns or investment advice.
        </p>
      </motion.div>

      {/* ── Payment modal ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showModal && selectedPkg && (
          <PaymentModal
            pkg={selectedPkg}
            onClose={() => { setShowModal(false); setSelectedPkg(null); }}
            onPaid={() => {}}
            deposit={deposit}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
