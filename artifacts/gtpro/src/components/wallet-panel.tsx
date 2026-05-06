import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/engine/wallet-engine";
import {
  Wallet, Plus, TrendingUp, Lock, Clock, AlertCircle, CheckCircle, Loader2,
  Zap, DollarSign,
} from "lucide-react";

export function WalletPanel() {
  const { user, deposit, subscribePlan, isLoading, error } = useWallet();
  const [showDeposit,  setShowDeposit]  = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositing,   setDepositing]   = useState(false);
  const [depositError, setDepositError] = useState("");
  const [depositSuccess, setDepositSuccess] = useState(false);

  const [showPlanUpgrade, setShowPlanUpgrade] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [planError, setPlanError] = useState("");

  if (isLoading) return <div className="text-muted-foreground">Loading wallet...</div>;
  if (!user) return <div className="text-red-400">Failed to load wallet</div>;

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(depositAmount);
    if (!amt || amt < 10 || amt > 500) {
      setDepositError("Amount must be between $10 and $500");
      return;
    }

    setDepositing(true);
    setDepositError("");
    try {
      await deposit(amt);
      setDepositSuccess(true);
      setDepositAmount("");
      await new Promise(r => setTimeout(r, 1500));
      setDepositSuccess(false);
      setShowDeposit(false);
    } catch (err) {
      setDepositError(err instanceof Error ? err.message : "Deposit failed");
    } finally {
      setDepositing(false);
    }
  };

  const handlePlanUpgrade = async () => {
    if (!selectedPlan) return;
    setUpgrading(true);
    setPlanError("");
    try {
      const result = await subscribePlan(selectedPlan);
      if (result.success) {
        await new Promise(r => setTimeout(r, 1200));
        setShowPlanUpgrade(false);
        setSelectedPlan(null);
      }
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : "Plan upgrade failed");
    } finally {
      setUpgrading(false);
    }
  };

  const planExpiry = user.planExpiresAt ? new Date(user.planExpiresAt) : null;
  const timeToExpiry = planExpiry ? Math.max(0, Math.ceil((planExpiry.getTime() - Date.now()) / (1000 * 60 * 60))) : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-primary" />
          <h3 className="text-sm font-bold">Wallet & Billing</h3>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowDeposit(v => !v)}
          className="h-7 px-2.5 text-[11px] font-semibold gap-1.5"
        >
          {showDeposit ? "Cancel" : <><Plus size={12} /> Deposit</>}
        </Button>
      </div>

      {/* Deposit form */}
      <AnimatePresence>
        {showDeposit && (
          <motion.form
            onSubmit={handleDeposit}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="rounded-lg border border-primary/20 p-3 space-y-2 bg-primary/5"
          >
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  min="10"
                  max="500"
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  placeholder="Amount (10-500)"
                  className="h-8 pl-5 text-[12px]"
                />
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={depositing || depositSuccess}
                className="h-8 px-3 text-[11px]"
              >
                {depositing ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : depositSuccess ? (
                  <CheckCircle size={12} />
                ) : (
                  "Deposit"
                )}
              </Button>
            </div>
            {depositError && (
              <div className="text-[10px] text-red-400 flex gap-1">
                <AlertCircle size={11} className="shrink-0 mt-0.5" />
                {depositError}
              </div>
            )}
          </motion.form>
        )}
      </AnimatePresence>

      {/* Wallet stats grid */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        {[
          { label: "Balance", value: `$${user.balance.toFixed(2)}`, icon: DollarSign, color: "text-emerald-400" },
          { label: "Locked", value: `$${user.lockedBalance.toFixed(2)}`, icon: Lock, color: "text-amber-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-lg border border-white/[0.06] p-2.5 text-center" style={{ background: "rgba(255,255,255,0.02)" }}>
            <Icon size={12} className={`${color} mx-auto mb-1`} />
            <div className="font-bold text-[12px] text-foreground">{value}</div>
            <div className="text-[9px] text-muted-foreground/60 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Plan info */}
      <div className="rounded-lg border border-white/[0.06] p-3" style={{ background: "rgba(255,255,255,0.02)" }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Zap size={12} className="text-primary" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Plan</span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary">
            {user.billingPlan.toUpperCase()}
          </span>
        </div>

        {user.billingPlan === "free" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowPlanUpgrade(true)}
            className="w-full h-7 text-[10px] font-bold text-primary border-primary/30 hover:bg-primary/10"
          >
            Upgrade to Premium
          </Button>
        )}

        {user.billingPlan !== "free" && (
          <>
            <div className="text-[10px] text-muted-foreground/70 mt-1">
              {user.usedHours} / {user.includedHours} hours used
            </div>
            <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden mt-1.5">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${(user.usedHours / user.includedHours) * 100}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
            {planExpiry && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 mt-2">
                <Clock size={10} />
                Expires in {timeToExpiry}h
              </div>
            )}
          </>
        )}
      </div>

      {/* Plan upgrade modal */}
      <AnimatePresence>
        {showPlanUpgrade && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
            onClick={() => setShowPlanUpgrade(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="rounded-xl border border-primary/20 p-4 max-w-sm bg-slate-950"
            >
              <h3 className="text-sm font-bold mb-3">Upgrade Your Plan</h3>
              <div className="space-y-2 mb-4">
                {[
                  { id: "weekly", name: "Weekly", price: "$15", hours: "12 hours", desc: "$1.2/hr after" },
                  { id: "monthly", name: "Monthly", price: "$49", hours: "50 hours", desc: "$0.9/hr after" },
                ].map(plan => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`w-full rounded-lg border p-2.5 text-left text-[11px] transition-all ${
                      selectedPlan === plan.id
                        ? "border-primary/50 bg-primary/10"
                        : "border-white/[0.1] hover:border-white/[0.2]"
                    }`}
                  >
                    <div className="font-bold text-primary">{plan.name}</div>
                    <div className="text-muted-foreground/70 mt-0.5">
                      {plan.price} • {plan.hours} included
                    </div>
                    <div className="text-[10px] text-muted-foreground/50 mt-1">{plan.desc}</div>
                  </button>
                ))}
              </div>

              {planError && (
                <div className="text-[10px] text-red-400 mb-3 flex gap-1">
                  <AlertCircle size={11} className="shrink-0" />
                  {planError}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handlePlanUpgrade}
                  disabled={!selectedPlan || upgrading}
                  size="sm"
                  className="flex-1 h-8 text-[11px]"
                >
                  {upgrading ? <Loader2 size={12} className="animate-spin mr-1" /> : "Continue"}
                </Button>
                <Button
                  onClick={() => setShowPlanUpgrade(false)}
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-[11px]"
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="text-[10px] text-red-400 p-2 rounded border border-red-500/20 bg-red-500/5 flex gap-1">
          <AlertCircle size={12} className="shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
