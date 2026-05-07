import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FlaskConical, Play, TrendingUp, TrendingDown, BarChart3,
  Activity, DollarSign, Target, Shield, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";

const SYMBOLS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "AVAX/USDT"];
const BARS    = [
  { label: "5m",  value: "5m"  },
  { label: "15m", value: "15m" },
  { label: "1H",  value: "1H"  },
  { label: "4H",  value: "4H"  },
  { label: "1D",  value: "1D"  },
];
const STRATEGIES = ["EMA Crossover", "RSI Mean Reversion", "Trend Follow", "Breakout"];

interface Trade {
  entryTime:  number;
  exitTime:   number;
  direction:  "long" | "short";
  entryPrice: number;
  exitPrice:  number;
  pnl:        number;
  outcome:    "tp" | "sl";
}

interface BacktestResult {
  totalTrades:  number;
  winRate:      number;
  totalPnl:     number;
  maxDrawdown:  number;
  sharpeRatio:  number;
  avgWin:       number;
  avgLoss:      number;
  profitFactor: number;
  trades:       Trade[];
  equityCurve:  { time: number; equity: number }[];
}

function StatCard({ icon: Icon, label, value, sub, color = "text-foreground" }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] p-4"
      style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 52% 5.5%) 100%)" }}>
      <div className="flex items-center gap-2 mb-2.5">
        <Icon size={11} className="text-primary/60" />
        <span className="text-[9px] font-bold tracking-[0.18em] uppercase text-muted-foreground/40">{label}</span>
      </div>
      <div className={`text-[20px] font-black tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground/35 mt-0.5">{sub}</div>}
    </div>
  );
}

export function BacktestingPage() {
  const [symbol,   setSymbol]   = useState("BTC/USDT");
  const [bar,      setBar]      = useState("1H");
  const [strategy, setStrategy] = useState("EMA Crossover");
  const [tpPct,    setTpPct]    = useState(2);
  const [slPct,    setSlPct]    = useState(1);
  const [result,   setResult]   = useState<BacktestResult | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/backtest", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, bar, strategy, tpPct, slPct, limit: 300 }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Backtest failed"); return; }
      setResult(data);
    } catch (e) {
      setError("Network error — check your connection");
    } finally {
      setLoading(false);
    }
  }, [symbol, bar, strategy, tpPct, slPct]);

  const equityData = result?.equityCurve.map(pt => ({
    time:   new Date(pt.time).toLocaleDateString(),
    equity: pt.equity,
  })) ?? [];

  const isPositive = (result?.totalPnl ?? 0) >= 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(200,168,75,0.12)", border: "1px solid rgba(200,168,75,0.2)" }}>
            <FlaskConical size={20} className="text-primary" />
          </div>
          <div>
            <h2 className="text-[22px] font-black tracking-tight">Strategy Backtesting</h2>
            <p className="text-[12px] text-muted-foreground">Replay historical OKX candle data against trading strategies.</p>
          </div>
        </div>
      </motion.div>

      {/* Config card */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 }}>
        <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
          style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}>
          <div className="h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
          <div className="p-6">
            <div className="grid md:grid-cols-2 gap-6 mb-6">

              {/* Left column */}
              <div className="space-y-4">
                {/* Symbol */}
                <div>
                  <label className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground/50 mb-2 block">Symbol</label>
                  <div className="flex flex-wrap gap-2">
                    {SYMBOLS.map(s => (
                      <button key={s} onClick={() => setSymbol(s)}
                        className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all ${
                          symbol === s ? "border-primary/40 bg-primary/12 text-primary" : "border-white/[0.07] text-muted-foreground hover:border-white/[0.14] hover:text-foreground"
                        }`}
                        style={{ background: symbol === s ? undefined : "rgba(255,255,255,0.025)" }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Timeframe */}
                <div>
                  <label className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground/50 mb-2 block">Candle Timeframe</label>
                  <div className="flex gap-2">
                    {BARS.map(b => (
                      <button key={b.value} onClick={() => setBar(b.value)}
                        className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all ${
                          bar === b.value ? "border-primary/40 bg-primary/12 text-primary" : "border-white/[0.07] text-muted-foreground hover:border-white/[0.14] hover:text-foreground"
                        }`}
                        style={{ background: bar === b.value ? undefined : "rgba(255,255,255,0.025)" }}>
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right column */}
              <div className="space-y-4">
                {/* Strategy */}
                <div>
                  <label className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground/50 mb-2 block">Strategy</label>
                  <div className="flex flex-wrap gap-2">
                    {STRATEGIES.map(s => (
                      <button key={s} onClick={() => setStrategy(s)}
                        className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all ${
                          strategy === s ? "border-primary/40 bg-primary/12 text-primary" : "border-white/[0.07] text-muted-foreground hover:border-white/[0.14] hover:text-foreground"
                        }`}
                        style={{ background: strategy === s ? undefined : "rgba(255,255,255,0.025)" }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* TP/SL */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground/50 mb-2 block">
                      Take Profit: <span className="text-primary">{tpPct}%</span>
                    </label>
                    <input type="range" min={0.5} max={10} step={0.5} value={tpPct}
                      onChange={e => setTpPct(parseFloat(e.target.value))}
                      className="w-full accent-primary h-1.5 rounded-full" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground/50 mb-2 block">
                      Stop Loss: <span className="text-red-400">{slPct}%</span>
                    </label>
                    <input type="range" min={0.25} max={5} step={0.25} value={slPct}
                      onChange={e => setSlPct(parseFloat(e.target.value))}
                      className="w-full accent-red-500 h-1.5 rounded-full" />
                  </div>
                </div>
              </div>
            </div>

            <motion.div whileHover={{ scale: 1.012 }} whileTap={{ scale: 0.985 }}>
              <Button
                onClick={run}
                disabled={loading}
                className="w-full h-11 text-[14px] font-black bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
                {loading ? "Running Backtest…" : "Run Backtest"}
              </Button>
            </motion.div>

            {error && (
              <div className="mt-3 text-[11px] text-red-400 text-center">{error}</div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>

            {result.totalTrades === 0 ? (
              <div className="rounded-2xl border border-white/[0.07] p-10 text-center"
                style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}>
                <FlaskConical size={20} className="text-muted-foreground/25 mx-auto mb-2" />
                <div className="text-[13px] text-muted-foreground/50">No trades generated — try a different strategy or timeframe</div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Stats */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard icon={DollarSign} label="Total P&L" value={`${result.totalPnl >= 0 ? "+" : ""}$${result.totalPnl.toFixed(2)}`}
                    sub="Starting $1,000 base" color={result.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"} />
                  <StatCard icon={Activity} label="Win Rate" value={`${result.winRate}%`}
                    sub={`${result.totalTrades} trades`} color={result.winRate >= 50 ? "text-emerald-400" : "text-red-400"} />
                  <StatCard icon={BarChart3} label="Profit Factor" value={result.profitFactor >= 99 ? "∞" : result.profitFactor.toFixed(2)}
                    sub="Gross profit / gross loss" color={result.profitFactor > 1 ? "text-emerald-400" : "text-red-400"} />
                  <StatCard icon={Shield} label="Max Drawdown" value={`${result.maxDrawdown.toFixed(1)}%`}
                    sub={`Sharpe: ${result.sharpeRatio.toFixed(2)}`} color={result.maxDrawdown > 20 ? "text-red-400" : "text-amber-400"} />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <StatCard icon={TrendingUp} label="Avg Win" value={`+$${result.avgWin.toFixed(2)}`} color="text-emerald-400" />
                  <StatCard icon={TrendingDown} label="Avg Loss" value={`-$${result.avgLoss.toFixed(2)}`} color="text-red-400" />
                </div>

                {/* Equity curve */}
                {equityData.length >= 2 && (
                  <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
                    style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}>
                    <div className="px-5 py-4 border-b border-white/[0.05]">
                      <span className="text-[12px] font-bold">Equity Curve</span>
                      <span className="text-[10px] text-muted-foreground/40 ml-3">{strategy} · {bar} · {symbol}</span>
                    </div>
                    <div className="p-4">
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={equityData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                          <defs>
                            <linearGradient id="btGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={isPositive ? "#34d399" : "#f87171"} stopOpacity={0.2} />
                              <stop offset="100%" stopColor={isPositive ? "#34d399" : "#f87171"} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                          <XAxis dataKey="time" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                          <YAxis tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)" }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ background: "hsl(228 52% 8%)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 11 }} />
                          <ReferenceLine y={1000} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
                          <Area type="monotone" dataKey="equity" stroke={isPositive ? "#34d399" : "#f87171"} strokeWidth={2} fill="url(#btGrad)" dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Trade list */}
                {result.trades.length > 0 && (
                  <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
                    style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}>
                    <div className="px-5 py-4 border-b border-white/[0.05]">
                      <span className="text-[12px] font-bold">Trade Log</span>
                      <span className="text-[10px] text-muted-foreground/40 ml-3">Last {result.trades.length} trades</span>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {result.trades.map((t, i) => (
                        <div key={i} className="grid grid-cols-[80px_100px_100px_100px_80px] gap-4 px-5 py-2.5 border-b border-white/[0.03] hover:bg-white/[0.015] transition-colors">
                          <div className={`text-[10px] font-black ${t.direction === "long" ? "text-emerald-400" : "text-red-400"}`}>
                            {t.direction.toUpperCase()}
                          </div>
                          <div className="text-[10px] font-mono tabular-nums">${t.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                          <div className="text-[10px] font-mono tabular-nums">${t.exitPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                          <div className={`text-[11px] font-black tabular-nums ${t.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
                          </div>
                          <div className={`text-[9px] font-black px-1.5 py-0.5 rounded text-center ${
                            t.outcome === "tp" ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"
                          }`}>{t.outcome.toUpperCase()}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
