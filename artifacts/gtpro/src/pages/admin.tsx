import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Cpu, Bot, Users, BarChart2, Settings2, LogOut, Activity,
  AlertTriangle, CheckCircle, Clock, Zap, TrendingUp, Server,
  Eye, Lock, ChevronRight, RefreshCw, Rocket, Edit2, Save, X,
  DollarSign, Search,
} from "lucide-react";
import { useAdminAuth } from "@/contexts/admin-auth";
import { Button } from "@/components/ui/button";
import { useFleetEngine } from "@/engine/fleet-engine";
import { useBotEngine } from "@/engine/bot-engine";
import { useExchange } from "@/engine/exchange-engine";
import { useMarketData } from "@/engine/market-data";
import { useLocation } from "wouter";
import { useClerk, useUser, useAuth } from "@clerk/react";

// ── Re-export everything from fleets page so admin sees it ──────────────────
import { FleetsPage } from "@/pages/fleets";

// ── Helpers ─────────────────────────────────────────────────────────────────

function SeverityBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    critical: "border-red-500/30 bg-red-500/10 text-red-400",
    high:     "border-orange-400/30 bg-orange-400/10 text-orange-400",
    medium:   "border-amber-400/30 bg-amber-400/10 text-amber-400",
    low:      "border-emerald-400/30 bg-emerald-400/10 text-emerald-400",
    info:     "border-blue-400/30 bg-blue-400/10 text-blue-400",
  };
  return (
    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider ${map[level] ?? map.info}`}>
      {level}
    </span>
  );
}

function StatCard({ label, value, sub, color = "text-foreground", icon: Icon }:
  { label: string; value: string | number; sub?: string; color?: string; icon: React.ElementType }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] p-4"
      style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 52% 5.5%) 100%)" }}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={13} className="text-primary/70" />
        <span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground/50">{label}</span>
      </div>
      <div className={`text-[22px] font-black tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground/40 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview",  label: "Overview",    icon: BarChart2 },
  { id: "users",     label: "Users",       icon: Users     },
  { id: "fleets",    label: "Fleet Mgmt",  icon: Rocket    },
  { id: "security",  label: "Security",    icon: Shield    },
  { id: "platform",  label: "Platform",    icon: Server    },
  { id: "settings",  label: "Settings",    icon: Settings2 },
] as const;

type TabId = typeof TABS[number]["id"];

// ── Users Tab ─────────────────────────────────────────────────────────────────

interface AdminUser {
  id: number | string;
  clerkId: string;
  email: string;
  billingPlan: string;
  balance: number;
  lockedBalance: number;
  totalSpent: number;
  createdAt: string;
  note: string | null;
  isAdmin?: boolean;
}

const PLANS = ["all", "free", "starter", "pro", "enterprise", "admin"] as const;
type PlanFilter = typeof PLANS[number];

const PLAN_COLORS: Record<string, string> = {
  free:       "border-white/[0.1] text-muted-foreground/60",
  starter:    "border-blue-400/30 text-blue-400",
  pro:        "border-primary/30 text-primary",
  enterprise: "border-violet-400/30 text-violet-400",
  admin:      "border-violet-400/40 text-violet-400",
};

function UsersTab() {
  const { getToken } = useAuth();
  const [users, setUsers]       = useState<AdminUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");
  const [editing, setEditing]   = useState<number | string | null>(null);
  const [draft, setDraft]       = useState<Partial<AdminUser>>({});
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function authHeaders(): Promise<Record<string, string>> {
    try {
      const token = await getToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
      return {};
    }
  }

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        credentials: "include",
        headers: await authHeaders(),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json() as AdminUser[];
      setUsers(data);
    } catch {
      setError("Could not load users");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function saveUser(id: number | string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error("Failed");
      await fetchUsers();
      setEditing(null);
      setDraft({});
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const filtered = users.filter(u => {
    const matchSearch = search === "" ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.clerkId.toLowerCase().includes(search.toLowerCase());
    const matchPlan = planFilter === "all"
      || (planFilter === "admin" ? u.isAdmin : u.billingPlan === planFilter);
    return matchSearch && matchPlan;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-black">Platform Users</h2>
          <p className="text-[12px] text-muted-foreground/50 mt-0.5">{users.length} registered users</p>
        </div>
        <button onClick={fetchUsers}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] text-[12px] text-muted-foreground hover:text-foreground hover:border-white/[0.15] transition-all">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Search + Plan filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by email or Clerk ID…"
            className="w-full pl-8 pr-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-[13px] placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40 transition-colors"
          />
        </div>
        <div className="flex items-center gap-1.5 p-1 rounded-xl border border-white/[0.07] bg-white/[0.02] shrink-0">
          {PLANS.map(plan => {
            const active = planFilter === plan;
            const colorCls = plan === "all" ? "text-foreground" : PLAN_COLORS[plan] ?? "text-muted-foreground/60";
            return (
              <button
                key={plan}
                onClick={() => setPlanFilter(plan)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                  active
                    ? plan === "all"
                      ? "bg-white/[0.08] text-foreground"
                      : `bg-white/[0.06] border ${PLAN_COLORS[plan] ?? "border-white/[0.1]"}`
                    : `hover:bg-white/[0.04] text-muted-foreground/40 hover:text-muted-foreground/70`
                }`}
              >
                {plan === "all" ? "All" : plan}
                {plan !== "all" && (
                  <span className="ml-1 opacity-60">
                    {plan === "admin"
                      ? users.filter(u => u.isAdmin).length
                      : users.filter(u => u.billingPlan === plan).length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl border border-red-500/25 bg-red-500/5 text-[12px] text-red-400 flex items-center gap-2">
          <AlertTriangle size={13} /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={12} /></button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-16 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="py-12 text-center text-[13px] text-muted-foreground/40">No users found</div>
          )}
          {filtered.map(user => {
            const isEditing = editing === user.id;
            return (
              <motion.div key={user.id}
                layout
                className="rounded-xl border border-white/[0.07] overflow-hidden"
                style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 52% 5%) 100%)" }}>
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                      <Users size={14} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-bold truncate">{user.email}</span>
                        {user.isAdmin && (
                          <span className="px-1.5 py-0.5 rounded-md bg-violet-500/15 border border-violet-400/30 text-[10px] font-bold text-violet-400 uppercase tracking-wide flex items-center gap-1">
                            <Shield size={8} /> Admin
                          </span>
                        )}
                        <span className={`px-1.5 py-0.5 rounded-md bg-primary/10 border border-primary/15 text-[10px] font-bold text-primary uppercase tracking-wide ${user.billingPlan === "admin" ? "opacity-50" : ""}`}>
                          {user.billingPlan}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground/30 font-mono">{user.clerkId || "—"}</span>
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        {isEditing ? (
                          <>
                            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
                              Balance
                              <input
                                type="number" step="0.01"
                                value={draft.balance ?? 0}
                                onChange={e => setDraft(d => ({ ...d, balance: parseFloat(e.target.value) || 0 }))}
                                className="w-24 px-2 py-0.5 rounded-lg border border-white/[0.1] bg-white/[0.04] text-[12px] text-foreground focus:outline-none focus:border-primary/40"
                              />
                            </label>
                            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
                              Plan
                              <select
                                value={draft.billingPlan ?? user.billingPlan}
                                onChange={e => setDraft(d => ({ ...d, billingPlan: e.target.value }))}
                                className="px-2 py-0.5 rounded-lg border border-white/[0.1] bg-[hsl(228_45%_10%)] text-[12px] text-foreground focus:outline-none focus:border-primary/40">
                                {["free","starter","pro","enterprise"].map(p => <option key={p} value={p}>{p}</option>)}
                              </select>
                            </label>
                            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 flex-1">
                              Note
                              <input
                                type="text"
                                value={draft.note ?? ""}
                                onChange={e => setDraft(d => ({ ...d, note: e.target.value }))}
                                placeholder="Admin note…"
                                className="flex-1 min-w-0 px-2 py-0.5 rounded-lg border border-white/[0.1] bg-white/[0.04] text-[12px] text-foreground focus:outline-none focus:border-primary/40"
                              />
                            </label>
                          </>
                        ) : (
                          <>
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                              <DollarSign size={10} className="text-emerald-400" />
                              <span className="text-emerald-400 font-bold">${user.balance.toFixed(2)}</span> balance
                            </span>
                            <span className="text-[11px] text-muted-foreground/40">
                              ${user.lockedBalance.toFixed(2)} locked
                            </span>
                            <span className="text-[11px] text-muted-foreground/40">
                              ${user.totalSpent.toFixed(2)} spent
                            </span>
                            {user.note && (
                              <span className="text-[11px] text-amber-400/60 italic truncate max-w-xs">{user.note}</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isEditing ? (
                        <>
                          <button onClick={() => { setEditing(null); setDraft({}); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/[0.08] text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                            <X size={11} /> Cancel
                          </button>
                          <button onClick={() => saveUser(user.id)} disabled={saving}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/15 border border-primary/25 text-[11px] text-primary hover:bg-primary/20 transition-colors disabled:opacity-50">
                            <Save size={11} /> {saving ? "Saving…" : "Save"}
                          </button>
                        </>
                      ) : (
                        <button onClick={() => { setEditing(user.id); setDraft({ balance: user.balance, billingPlan: user.billingPlan, note: user.note ?? "" }); }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/[0.08] text-[11px] text-muted-foreground hover:text-foreground hover:border-white/[0.15] transition-colors">
                          <Edit2 size={11} /> Edit
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab() {
  const { sbfStats, vcbfStats, abfStats, executedSignals, sbfPatchCount, vcbfPatchCount, securityEvents } = useFleetEngine();
  const { bot } = useBotEngine();
  const { status: exStatus } = useExchange();
  const { currentPrice, priceChangePct } = useMarketData();

  const totalEvents  = sbfStats.eventsProcessed + vcbfStats.eventsProcessed + abfStats.eventsProcessed;
  const totalPatches = sbfPatchCount + vcbfPatchCount;
  const criticals    = securityEvents.filter(e => e.severity === "critical").length;

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Activity}   label="Total Events"    value={totalEvents.toLocaleString()} sub="all fleet ticks" />
        <StatCard icon={Shield}     label="Patches Applied" value={totalPatches} sub={`SBF ${sbfPatchCount} · VCBF ${vcbfPatchCount}`} color="text-emerald-400" />
        <StatCard icon={AlertTriangle} label="Critical Threats" value={criticals} sub="unresolved" color={criticals > 0 ? "text-red-400" : "text-emerald-400"} />
        <StatCard icon={TrendingUp} label="BTC/USDT" value={`$${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} sub={`${priceChangePct >= 0 ? "+" : ""}${priceChangePct.toFixed(2)}% today`} color={priceChangePct >= 0 ? "text-emerald-400" : "text-red-400"} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Fleet health */}
        <div className="rounded-2xl border border-white/[0.07] p-5"
          style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 52% 5.5%) 100%)" }}>
          <div className="flex items-center gap-2.5 mb-4">
            <Bot size={14} className="text-primary/70" />
            <h3 className="text-[14px] font-bold">Fleet Health</h3>
          </div>
          <div className="space-y-3">
            {[
              { name: "ABF",  label: "Agent Bot Fleet",          status: bot?.status === "RUNNING" ? "online" : "idle",            pct: abfStats.winRate ?? 0,       color: "bg-emerald-400" },
              { name: "SBF",  label: "Security Bot Fleet",       status: sbfStats.threatLevel === "low" ? "nominal" : "elevated", pct: Math.min(100, (sbfStats.uptimeSeconds / 3600) * 100 || 99), color: "bg-blue-400"   },
              { name: "VCBF", label: "Vulnerability / Core BF",  status: vcbfStats.status,                                         pct: vcbfStats.healthScore ?? 99, color: "bg-violet-400" },
            ].map(f => (
              <div key={f.name} className="flex items-center gap-3">
                <div className="w-10 text-[11px] font-black text-muted-foreground/50">{f.name}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-muted-foreground">{f.label}</span>
                    <span className="text-[10px] font-bold text-muted-foreground/40 capitalize">{f.status}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06]">
                    <motion.div className={`h-full rounded-full ${f.color}`}
                      initial={{ width: 0 }} animate={{ width: `${f.pct}%` }}
                      transition={{ duration: 0.9, ease: "easeOut" }} />
                  </div>
                </div>
                <div className="text-[11px] font-bold tabular-nums w-8 text-right">{f.pct.toFixed(0)}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* Exchange */}
        <div className="rounded-2xl border border-white/[0.07] p-5"
          style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 52% 5.5%) 100%)" }}>
          <div className="flex items-center gap-2.5 mb-4">
            <Zap size={14} className="text-primary/70" />
            <h3 className="text-[14px] font-bold">Exchange Status</h3>
          </div>
          {exStatus ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-white/[0.05]">
                <span className="text-[12px] text-muted-foreground">Connection</span>
                <span className={`text-[12px] font-bold ${exStatus.connected ? "text-emerald-400" : "text-red-400"}`}>
                  {exStatus.connected ? "Connected" : "Disconnected"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/[0.05]">
                <span className="text-[12px] text-muted-foreground">Exchange</span>
                <span className="text-[12px] font-bold capitalize">{exStatus.exchange}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/[0.05]">
                <span className="text-[12px] text-muted-foreground">Mode</span>
                <span className={`text-[12px] font-bold ${exStatus.testnet ? "text-amber-400" : "text-emerald-400"}`}>
                  {exStatus.testnet ? "Testnet" : "Live"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-[12px] text-muted-foreground">Wallet Balance</span>
                <span className="text-[14px] font-black text-emerald-400">${exStatus.balance.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-20 text-[12px] text-muted-foreground/40">
              No exchange connected
            </div>
          )}
        </div>
      </div>

      {/* Recent trades */}
      <div className="rounded-2xl border border-white/[0.07] p-5"
        style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 52% 5.5%) 100%)" }}>
        <div className="flex items-center gap-2.5 mb-4">
          <Activity size={14} className="text-primary/70" />
          <h3 className="text-[14px] font-bold">Recent Executed Signals</h3>
          <span className="text-[11px] text-muted-foreground/40 ml-auto">{executedSignals.length} total</span>
        </div>
        {executedSignals.length === 0 ? (
          <div className="text-[12px] text-muted-foreground/40 text-center py-6">No signals executed yet</div>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {[...executedSignals].reverse().slice(0, 10).map((s, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-white/[0.04]"
                style={{ background: "rgba(255,255,255,0.02)" }}>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                  s.type === "BUY"
                    ? "border-emerald-400/25 bg-emerald-400/8 text-emerald-400"
                    : "border-red-400/25 bg-red-400/8 text-red-400"
                }`}>{s.type}</span>
                <span className="text-[11px] text-muted-foreground flex-1">{s.ticker} · {(s.confidence * 100).toFixed(0)}% conf</span>
                <span className={`text-[12px] font-bold tabular-nums ${
                  (s.pnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
                }`}>
                  {(s.pnl ?? 0) >= 0 ? "+" : ""}{(s.pnl ?? 0).toFixed(2)} USDT
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Security Tab ─────────────────────────────────────────────────────────────

function SecurityTab() {
  const { securityEvents, patchActions, sbfPatchCount, vcbfPatchCount, sbfStats, vcbfStats } = useFleetEngine();
  const [filter, setFilter] = useState<"all" | "sbf" | "vcbf">("all");

  const filtered = filter === "all" ? securityEvents
    : securityEvents.filter(e => e.source.toLowerCase() === filter);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Shield}       label="SBF Patches"     value={sbfPatchCount}            sub="applied" color="text-blue-400" />
        <StatCard icon={Cpu}          label="VCBF Patches"    value={vcbfPatchCount}           sub="applied" color="text-violet-400" />
        <StatCard icon={AlertTriangle} label="SBF Threat"     value={sbfStats.threatLevel.toUpperCase()} color={sbfStats.threatLevel === "low" ? "text-emerald-400" : "text-red-400"} />
        <StatCard icon={CheckCircle}  label="VCBF Health"     value={`${vcbfStats.healthScore}%`}         color="text-emerald-400" />
      </div>

      {/* Event feed */}
      <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
        style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 52% 5.5%) 100%)" }}>
        <div className="h-px bg-gradient-to-r from-transparent via-red-400/30 to-transparent" />
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <Eye size={14} className="text-red-400/70" />
              <h3 className="text-[14px] font-bold">Security Event Feed</h3>
              <span className="text-[11px] text-muted-foreground/40">{securityEvents.length} events</span>
            </div>
            <div className="flex items-center gap-1">
              {(["all", "sbf", "vcbf"] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                    filter === f ? "bg-primary/15 text-primary border border-primary/25" : "text-muted-foreground/40 hover:text-muted-foreground border border-transparent"
                  }`}>
                  {f === "all" ? "All" : f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-[12px] text-muted-foreground/40">
              <div className="text-center">
                <CheckCircle size={20} className="text-emerald-400/40 mx-auto mb-2" />
                No security events detected
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              <AnimatePresence>
                {[...filtered].reverse().map((evt, i) => (
                  <motion.div key={evt.id}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.02 }}
                    className="flex items-start gap-3 px-3.5 py-2.5 rounded-xl border border-white/[0.04]"
                    style={{ background: "rgba(255,255,255,0.02)" }}>
                    <div className="mt-0.5 shrink-0"><SeverityBadge level={evt.severity} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold">{evt.type.replace(/_/g, " ")}</div>
                      <div className="text-[11px] text-muted-foreground/60 truncate">{evt.description}</div>
                      {evt.patched && (
                        <div className="text-[10px] text-emerald-400/70 mt-0.5">✓ Auto-patch applied</div>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground/30 shrink-0 text-right">
                      <span className="px-1.5 py-0.5 rounded border border-white/[0.06] bg-white/[0.03] font-mono">{evt.source}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Patch actions */}
      {patchActions.length > 0 && (
        <div className="rounded-2xl border border-white/[0.07] p-5"
          style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 52% 5.5%) 100%)" }}>
          <div className="flex items-center gap-2.5 mb-4">
            <RefreshCw size={14} className="text-emerald-400/70" />
            <h3 className="text-[14px] font-bold">Patch Actions Applied</h3>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {[...patchActions].reverse().slice(0, 12).map((p, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-white/[0.04]"
                style={{ background: "rgba(255,255,255,0.02)" }}>
                <CheckCircle size={12} className="text-emerald-400 shrink-0" />
                <span className="text-[12px] font-medium flex-1">{p.action}</span>
                <span className="text-[10px] text-muted-foreground/30 font-mono">{p.source}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Platform Tab ──────────────────────────────────────────────────────────────

function PlatformTab() {
  const { abfStats, sbfStats, vcbfStats } = useFleetEngine();
  const { currentPrice } = useMarketData();

  const stats = [
    { label: "API Version",         value: "v2.4.1",               icon: Server },
    { label: "Database",            value: "PostgreSQL 15",         icon: Server },
    { label: "Auth Provider",       value: "Clerk SSO",            icon: Lock },
    { label: "Encryption",          value: "AES-256-GCM",          icon: Shield },
    { label: "Market Feed",         value: "OKX (Real-time SSE)",  icon: TrendingUp },
    { label: "BTC Reference Price", value: `$${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: TrendingUp },
    { label: "ABF Events",          value: abfStats.eventsProcessed.toLocaleString(), icon: Activity },
    { label: "SBF Events",          value: sbfStats.eventsProcessed.toLocaleString(), icon: Shield },
    { label: "VCBF Events",         value: vcbfStats.eventsProcessed.toLocaleString(), icon: Cpu },
    { label: "Signals Generated",   value: abfStats.signalsGenerated.toLocaleString(), icon: Zap },
    { label: "Environment",         value: import.meta.env.DEV ? "Development" : "Production", icon: Server },
    { label: "Runtime",             value: "Node.js + React 19",   icon: Server },
  ];

  return (
    <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
      style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 52% 5.5%) 100%)" }}>
      <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      <div className="p-5">
        <div className="flex items-center gap-2.5 mb-5">
          <Server size={14} className="text-primary/70" />
          <h3 className="text-[14px] font-bold">Platform Information</h3>
        </div>
        <div className="grid sm:grid-cols-2 gap-1">
          {stats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-white/[0.04]"
              style={{ background: "rgba(255,255,255,0.02)" }}>
              <Icon size={12} className="text-primary/50 shrink-0" />
              <span className="text-[12px] text-muted-foreground flex-1">{label}</span>
              <span className="text-[12px] font-bold tabular-nums">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Settings Tab ─────────────────────────────────────────────────────────────

function AdminSettingsTab() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const [, navigate] = useLocation();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "—";

  return (
    <div className="space-y-4 max-w-xl">
      <div className="rounded-2xl border border-white/[0.07] p-5"
        style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 52% 5.5%) 100%)" }}>
        <h3 className="text-[14px] font-bold mb-4">Admin Account</h3>
        <div className="space-y-2">
          {[
            { label: "Email",    value: email },
            { label: "Role",     value: "Administrator" },
            { label: "Access",   value: "Full Platform" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-white/[0.04]">
              <span className="text-[12px] text-muted-foreground">{label}</span>
              <span className="text-[12px] font-bold">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-red-400/15 p-5"
        style={{ background: "rgba(239,68,68,0.03)" }}>
        <h3 className="text-[13px] font-bold text-red-400/80 mb-3">Danger Zone</h3>
        <Button variant="ghost" size="sm"
          className="text-[12px] text-red-400/70 hover:text-red-400 border border-red-400/20 hover:border-red-400/40 h-8 px-4"
          onClick={() => { void signOut(); navigate("/"); }}>
          <LogOut size={12} className="mr-2" /> Sign Out
        </Button>
      </div>
    </div>
  );
}

// ── Main Admin Page ───────────────────────────────────────────────────────────

export function AdminPage() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const adminEmail = user?.emailAddresses?.[0]?.emailAddress ?? "Admin";

  return (
    <div className="min-h-[100dvh] bg-background text-foreground"
      style={{ background: "radial-gradient(ellipse 80% 40% at 50% -5%, rgba(212,175,55,0.05) 0%, transparent 60%), hsl(228 55% 4%)" }}>

      {/* Admin top bar */}
      <header className="border-b border-white/[0.06] px-6 h-14 flex items-center justify-between shrink-0"
        style={{ background: "rgba(5, 8, 16, 0.97)", backdropFilter: "blur(20px)" }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center">
            <Shield size={14} className="text-primary" />
          </div>
          <div>
            <span className="text-[14px] font-black" style={{ color: "#D4AF37" }}>GTPro</span>
            <span className="text-[14px] font-bold text-muted-foreground/50 ml-1.5">Admin Panel</span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase border border-red-400/25 bg-red-400/8 text-red-400">
            Restricted
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <motion.div className="w-1.5 h-1.5 rounded-full bg-emerald-400"
              animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }} />
            <span className="text-[11px] text-emerald-400 font-bold">{adminEmail}</span>
          </div>
          <div className="w-px h-4 bg-white/[0.08]" />
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors">
            <ChevronRight size={12} /> Dashboard
          </button>
          <div className="w-px h-4 bg-white/[0.08]" />
          <button
            onClick={() => { void signOut(); navigate("/"); }}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            <LogOut size={12} /> Sign Out
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div className="border-b border-white/[0.06] px-6 flex items-center gap-1"
        style={{ background: "rgba(5, 8, 16, 0.95)" }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`relative flex items-center gap-2 px-4 py-3.5 text-[12px] font-bold transition-all ${
              activeTab === id ? "text-foreground" : "text-muted-foreground/50 hover:text-muted-foreground"
            }`}>
            <Icon size={13} />
            {label}
            {activeTab === id && (
              <motion.div layoutId="admin-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full"
                transition={{ duration: 0.2 }} />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="p-6 md:p-8 max-w-6xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}>

            {activeTab === "overview"  && <OverviewTab />}
            {activeTab === "users"    && <UsersTab />}
            {activeTab === "fleets"   && (
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <Rocket size={16} className="text-primary" />
                  <h2 className="text-[18px] font-black">Fleet Management</h2>
                  <span className="text-[11px] text-muted-foreground/40 ml-2">Admin view — full control</span>
                </div>
                <FleetsPage />
              </div>
            )}
            {activeTab === "security"  && <SecurityTab />}
            {activeTab === "platform"  && <PlatformTab />}
            {activeTab === "settings"  && <AdminSettingsTab />}

          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
