import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3, TrendingUp, TrendingDown, Activity, DollarSign,
  Layers, Clock, ArrowUpRight, ArrowDownRight, RefreshCw,
} from "lucide-react";
import { useBotEngine } from "@/engine/bot-engine";
import { useMarketData } from "@/engine/market-data";
import { useFleetEngine } from "@/engine/fleet-engine";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

interface SessionStats {
  id:              string;
  strategy:        string;
  status:          string;
  startTime:       string;
  endTime:         string | null;
  actualDuration:  number | null;
  simulatedProfit: number | null;
  totalCost:       number | null;
}

function useSessionHistory() {
  const [sessions, setSessions] = useState<SessionStats[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/billing/sessions", { credentials: "include" });
        if (res.ok) setSessions(await res.json());
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  return { sessions, loading };
}

function StatCard({ icon: Icon, label, value, sub, color = "text-foreground" }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] p-5"
      style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 52% 5.5%) 100%)" }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center">
          <Icon size={13} className="text-primary" />
        </div>
        <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground/50">{label}</span>
      </div>
      <div className={`text-[26px] font-black tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground/40 mt-0.5">{sub}</div>}
    </div>
  );
}

export function PortfolioPage() {
  const { bot, tradeHistory, pnlFlash } = useBotEngine();
  const { currentPrice } = useMarketData();
  const { activeBots }   = useFleetEngine();
  const { sessions, loading } = useSessionHistory();

  const totalRealizedPnl = tradeHistory.reduce((s, t) => s + t.pnl, 0);
  const openPnl = bot?.openTrade
    ? (bot.openTrade.direction === "long" ? 1 : -1) * (currentPrice - bot.openTrade.entryPrice) * bot.openTrade.positionSize
    : 0;
  const totalPnl = totalRealizedPnl + openPnl;

  const wins   = tradeHistory.filter(t => t.pnl > 0);
  const losses = tradeHistory.filter(t => t.pnl <= 0);
  const winRate = tradeHistory.length > 0 ? (wins.length / tradeHistory.length * 100) : 0;

  // Equity curve from trade history
  let cum = 0;
  const equityCurve = tradeHistory
    .slice()
    .reverse()
    .map(t => {
      cum += t.pnl;
      return {
        time: new Date(t.closedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        equity: +cum.toFixed(2),
        pnl: +t.pnl.toFixed(2),
      };
    });

  const isPositive = totalPnl >= 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(200,168,75,0.12)", border: "1px solid rgba(200,168,75,0.2)" }}>
            <Layers size={20} className="text-primary" />
          </div>
          <div>
            <h2 className="text-[22px] font-black tracking-tight">Portfolio</h2>
            <p className="text-[12px] text-muted-foreground">Aggregate view of all positions and session performance.</p>
          </div>
        </div>
      </motion.div>

      {/* Stats grid */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 }}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={DollarSign} label="Total P&L" value={`${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`}
            sub="Realized + Unrealized"
            color={isPositive ? "text-emerald-400" : "text-red-400"} />
          <StatCard icon={BarChart3} label="Win Rate" value={`${winRate.toFixed(1)}%`}
            sub={`${wins.length}W / ${losses.length}L (${tradeHistory.length} total)`}
            color={winRate >= 50 ? "text-emerald-400" : "text-red-400"} />
          <StatCard icon={Activity} label="Active Bots" value={activeBots}
            sub={bot?.strategy ?? "No active strategy"} />
          <StatCard icon={TrendingUp} label="Avg Win" value={wins.length ? `+$${(wins.reduce((s,t)=>s+t.pnl,0)/wins.length).toFixed(2)}` : "—"}
            sub={losses.length ? `Avg Loss: -$${Math.abs(losses.reduce((s,t)=>s+t.pnl,0)/losses.length).toFixed(2)}` : "No losses"}
            color="text-emerald-400" />
        </div>
      </motion.div>

      {/* Open position */}
      <AnimatePresence>
        {bot?.openTrade && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}>
            <div className="rounded-2xl border overflow-hidden"
              style={{
                borderColor: openPnl >= 0 ? "rgba(52,211,153,0.25)" : "rgba(248,113,113,0.25)",
                background:  openPnl >= 0 ? "rgba(52,211,153,0.03)" : "rgba(248,113,113,0.03)",
              }}>
              <div className="px-5 py-3.5 border-b flex items-center justify-between"
                style={{ borderColor: openPnl >= 0 ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)" }}>
                <div className="flex items-center gap-2">
                  <motion.div className={`w-2 h-2 rounded-full ${openPnl >= 0 ? "bg-emerald-400" : "bg-red-400"}`}
                    animate={{ opacity: [1, 0.3, 1], scale: [1, 0.7, 1] }}
                    transition={{ duration: 1.4, repeat: Infinity }} />
                  <span className="text-[12px] font-bold">Open Position — BTC/USDT</span>
                </div>
                <span className="text-[10px] text-muted-foreground/40 font-mono">
                  Live · Bot: {bot.strategy}
                </span>
              </div>
              <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { label: "Direction",  value: bot.openTrade.direction.toUpperCase(), color: bot.openTrade.direction === "long" ? "text-emerald-400" : "text-red-400" },
                  { label: "Entry Price", value: `$${bot.openTrade.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
                  { label: "Current",    value: `$${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
                  { label: "Unrealized P&L", value: `${openPnl >= 0 ? "+" : ""}$${openPnl.toFixed(2)}`, color: openPnl >= 0 ? "text-emerald-400" : "text-red-400" },
                  { label: "Size",       value: `${bot.openTrade.positionSize} BTC` },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div className="text-[9px] font-bold tracking-[0.16em] uppercase text-muted-foreground/40 mb-0.5">{label}</div>
                    <div className={`text-[14px] font-black tabular-nums ${color ?? ""}`}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Equity curve */}
      {equityCurve.length >= 2 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
            style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}>
            <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-2">
              <BarChart3 size={13} className="text-primary" />
              <span className="text-[12px] font-bold">Equity Curve</span>
              <span className="text-[10px] text-muted-foreground/40 ml-auto">{tradeHistory.length} trades</span>
            </div>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={equityCurve} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                  <defs>
                    <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={isPositive ? "#34d399" : "#f87171"} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={isPositive ? "#34d399" : "#f87171"} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "hsl(228 52% 8%)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 11 }} labelStyle={{ color: "rgba(255,255,255,0.5)" }} />
                  <Area type="monotone" dataKey="equity" stroke={isPositive ? "#34d399" : "#f87171"} strokeWidth={2} fill="url(#eqGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      )}

      {/* Recent trades */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
        <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
          style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}>
          <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={13} className="text-primary" />
              <span className="text-[12px] font-bold">Recent Trades</span>
            </div>
            <span className="text-[10px] text-muted-foreground/40">Session memory</span>
          </div>

          {tradeHistory.length === 0 ? (
            <div className="p-10 text-center">
              <Clock size={18} className="text-muted-foreground/25 mx-auto mb-2" />
              <div className="text-[12px] text-muted-foreground/40">No trades yet — launch a bot to start</div>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-[80px_1fr_100px_100px_100px_80px] gap-4 px-5 py-2.5 border-b border-white/[0.04]">
                {["Direction", "Strategy", "Entry", "Exit", "P&L", "Outcome"].map(h => (
                  <div key={h} className="text-[9px] font-black tracking-[0.16em] uppercase text-muted-foreground/30">{h}</div>
                ))}
              </div>
              <div className="divide-y divide-white/[0.03]">
                {tradeHistory.slice(0, 20).map((t) => (
                  <motion.div key={t.id}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25 }}
                    className="grid grid-cols-[80px_1fr_100px_100px_100px_80px] gap-4 px-5 py-3 items-center hover:bg-white/[0.015] transition-colors">
                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black border self-start ${
                      t.direction === "long"
                        ? "border-emerald-400/25 bg-emerald-400/8 text-emerald-400"
                        : "border-red-400/25 bg-red-400/8 text-red-400"
                    }`}>
                      {t.direction === "long" ? <TrendingUp size={8} /> : <TrendingDown size={8} />}
                      {t.direction.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold truncate">{t.strategy}</div>
                      <div className="text-[9px] text-muted-foreground/35 font-mono">{new Date(t.openedAt).toLocaleTimeString()}</div>
                    </div>
                    <div className="text-[11px] font-mono tabular-nums">${t.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    <div className="text-[11px] font-mono tabular-nums">${t.exitPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    <div className={`text-[12px] font-black tabular-nums ${t.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
                    </div>
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full border self-start text-center ${
                      t.outcome === "tp" ? "border-emerald-400/20 bg-emerald-400/8 text-emerald-400"
                      : t.outcome === "sl" ? "border-red-400/20 bg-red-400/8 text-red-400"
                      : "border-white/[0.1] bg-white/[0.04] text-muted-foreground/50"
                    }`}>
                      {t.outcome.toUpperCase()}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Session history */}
      {sessions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
            style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}>
            <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-2">
              <Clock size={13} className="text-primary" />
              <span className="text-[12px] font-bold">Session History</span>
              {loading && <RefreshCw size={10} className="text-muted-foreground/30 animate-spin ml-auto" />}
            </div>
            <div className="divide-y divide-white/[0.04]">
              {sessions.slice(0, 10).map(s => (
                <div key={s.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-white/[0.015] transition-colors">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.status === "running" ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/30"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold truncate">{s.strategy}</div>
                    <div className="text-[10px] text-muted-foreground/40 mt-0.5 font-mono">
                      {new Date(s.startTime).toLocaleDateString()} · {s.actualDuration ? `${s.actualDuration.toFixed(1)}h` : "ongoing"}
                    </div>
                  </div>
                  <div className={`text-[12px] font-black tabular-nums ${s.simulatedProfit != null ? (s.simulatedProfit >= 0 ? "text-emerald-400" : "text-red-400") : "text-muted-foreground/30"}`}>
                    {s.simulatedProfit != null ? `${s.simulatedProfit >= 0 ? "+" : ""}$${s.simulatedProfit.toFixed(2)}` : "—"}
                  </div>
                  <div className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
                    s.status === "running" ? "border-emerald-400/25 bg-emerald-400/8 text-emerald-400"
                    : s.status === "completed" ? "border-white/[0.1] bg-white/[0.04] text-muted-foreground/50"
                    : "border-amber-400/25 bg-amber-400/8 text-amber-400"
                  }`}>
                    {s.status.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
