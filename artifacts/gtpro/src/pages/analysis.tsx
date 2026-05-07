import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, TrendingUp, TrendingDown, Minus, Activity, BarChart3, Zap, Clock,
  Target, Shield, ShieldAlert, Crosshair, Check, AlertTriangle, LineChart,
  ArrowUpRight, ArrowDownRight, Wifi, WifiOff, RefreshCw, ChevronDown,
} from "lucide-react";
import { useSignalEngine, SignalType } from "@/engine/signal-engine";
import { useMarketData } from "@/engine/market-data";
import { CandlestickChart } from "@/components/candlestick-chart";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 5)  return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function useNow() {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const ACCENT: Record<SignalType, { color: string; glow: string; badge: string; bar: string }> = {
  BUY:  { color: "#34d399", glow: "rgba(52,211,153,0.08)",  badge: "bg-emerald-500/10 border-emerald-400/30 text-emerald-300", bar: "from-emerald-500 to-emerald-300" },
  SELL: { color: "#f87171", glow: "rgba(248,113,113,0.08)", badge: "bg-red-500/10 border-red-400/30 text-red-300",             bar: "from-red-500 to-red-300"     },
  HOLD: { color: "#c8a84b", glow: "rgba(200,168,75,0.06)",  badge: "bg-primary/10 border-primary/25 text-primary",             bar: "from-primary to-amber-300"   },
};

interface PairPrice {
  ticker: string;
  price: number;
  changePct24h: number;
  timestamp: number;
}

function usePairPrices() {
  const [pairs, setPairs] = useState<PairPrice[]>([]);

  useEffect(() => {
    async function fetch_pairs() {
      try {
        const res = await fetch("/api/market/pairs");
        if (res.ok) {
          setPairs(await res.json());
        }
      } catch {
        // Fallback: empty pairs list
      }
    }

    fetch_pairs();
    const interval = setInterval(fetch_pairs, 10000);
    return () => clearInterval(interval);
  }, []);

  return pairs;
}

// ── Circular gauge (same style as dashboard) ──────────────────────────────────

function ConfidenceGauge({ confidence, type }: { confidence: number; type: SignalType }) {
  const r   = 52;
  const cx  = 64;
  const cy  = 64;
  const arc = 2 * Math.PI * r * 0.75;
  const fill = (confidence / 100) * arc;
  const color = ACCENT[type].color;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 128, height: 128 }}>
      <svg width={128} height={128} className="absolute inset-0" style={{ overflow: "visible" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={8}
          strokeDasharray={`${arc} ${2 * Math.PI * r}`} strokeLinecap="round"
          transform={`rotate(-225 ${cx} ${cy})`} />
        <motion.circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${arc} ${2 * Math.PI * r}`}
          initial={{ strokeDashoffset: arc }}
          animate={{ strokeDashoffset: arc - fill }}
          transition={{ duration: 1.0, ease: "easeOut" }}
          strokeLinecap="round"
          transform={`rotate(-225 ${cx} ${cy})`}
          style={{ filter: `drop-shadow(0 0 6px ${color}55)` }} />
      </svg>
      <div className="flex flex-col items-center justify-center rounded-full"
        style={{ width: 86, height: 86, background: `${color}0d`, border: `1px solid ${color}25` }}>
        <span className="text-[26px] font-black leading-none tabular-nums" style={{ color }}>{confidence}</span>
        <span className="text-[8px] font-black tracking-[0.2em] uppercase mt-0.5" style={{ color: `${color}70` }}>CONF%</span>
      </div>
    </div>
  );
}

// ── Mini sparkline for pairs ──────────────────────────────────────────────────

function MiniSparkline({ up }: { up: boolean }) {
  const color = up ? "#34d399" : "#f87171";
  const pts = Array.from({ length: 12 }, (_, i) => {
    const base = 20;
    const drift = up ? i * 1.2 : -i * 1.2;
    return base + drift + (Math.sin(i * 1.3) * 4) + (Math.random() * 3 - 1.5);
  });
  const min = Math.min(...pts), max = Math.max(...pts), range = max - min || 1;
  const W = 56, H = 20;
  const step = W / (pts.length - 1);
  const coords: [number, number][] = pts.map((p, i) => [i * step, H - ((p - min) / range) * H * 0.85 - H * 0.075]);
  const tension = 0.3;
  let d = `M ${coords[0][0].toFixed(1)} ${coords[0][1].toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i - 1] ?? coords[i];
    const p1 = coords[i]; const p2 = coords[i + 1]; const p3 = coords[i + 2] ?? p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) * tension, cp1y = p1[1] + (p2[1] - p0[1]) * tension;
    const cp2x = p2[0] - (p3[0] - p1[0]) * tension, cp2y = p2[1] - (p3[1] - p1[1]) * tension;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  const last = coords[coords.length - 1];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <path d={d} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2" fill={color} />
    </svg>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const CHART_PAIRS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "AVAX/USDT"];

export function AnalysisPage() {
  const { currentSignal, signalHistory, regime, signalFlash } = useSignalEngine();
  const { currentPrice, trend, volatility, dataMode, priceChangePct } = useMarketData();
  const [tab, setTab] = useState<"indicators" | "confluence" | "reasoning">("indicators");
  const [chartPair, setChartPair] = useState("BTC/USDT");
  const [showPairPicker, setShowPairPicker] = useState(false);
  const pairs = usePairPrices();
  useNow();

  const sig  = currentSignal;
  const type = sig?.type ?? "HOLD";
  const a    = ACCENT[type];

  const bullCount = sig?.indicators?.filter(i => i.bias === "bullish").length ?? 0;
  const bearCount = sig?.indicators?.filter(i => i.bias === "bearish").length ?? 0;
  const posConf   = sig?.confluenceFactors?.filter(f => f.positive).length ?? 0;
  const totConf   = sig?.confluenceFactors?.length ?? 0;

  // Derived win stats from history
  const totalSig  = signalHistory.filter(s => s.type !== "HOLD").length;
  const buySigs   = signalHistory.filter(s => s.type === "BUY").length;
  const sellSigs  = signalHistory.filter(s => s.type === "SELL").length;

  return (
    <div className="space-y-5 max-w-6xl mx-auto w-full">

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(200,168,75,0.12)", border: "1px solid rgba(200,168,75,0.2)" }}>
              <Brain size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-[22px] font-black tracking-tight">AI Signal Engine</h2>
              <p className="text-[12px] text-muted-foreground">Real-time market intelligence · Algorithmic order flow analysis · ABF Neural Core</p>
            </div>
          </div>

          {/* Live stats strip */}
          <div className="flex items-center gap-5 text-[11px]">
            <div className="flex items-center gap-1.5">
              <motion.div className="w-2 h-2 rounded-full bg-emerald-400"
                animate={{ opacity: [1, 0.3, 1], scale: [1, 0.7, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }} />
              <span className="text-emerald-400 font-bold">Engine Active</span>
            </div>
            <div className="text-muted-foreground/50">
              Signals Today: <span className="text-foreground font-bold">{signalHistory.length}</span>
            </div>
            <div className="text-muted-foreground/50">
              BUY: <span className="text-emerald-400 font-bold">{buySigs}</span>
              {" · "}
              SELL: <span className="text-red-400 font-bold">{sellSigs}</span>
            </div>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black tracking-widest uppercase ${
              dataMode === "live" ? "border-emerald-400/25 bg-emerald-400/8 text-emerald-400" : "border-amber-400/25 bg-amber-400/8 text-amber-400/80"
            }`}>
              {dataMode === "live" ? <Wifi size={9} /> : <WifiOff size={9} />}
              {dataMode === "live" ? "Live CoinGecko" : "Real-Time Fallback"}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Candlestick Chart ── */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.04 }}>
        <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
          style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
            <div className="flex items-center gap-2">
              <BarChart3 size={13} className="text-primary" />
              <span className="text-[12px] font-bold">Price Chart</span>
            </div>
            {/* Pair picker */}
            <div className="relative">
              <button
                onClick={() => setShowPairPicker(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/[0.08] text-[11px] font-bold text-muted-foreground hover:text-foreground hover:border-white/[0.14] transition-all"
                style={{ background: "rgba(255,255,255,0.03)" }}>
                {chartPair}
                <ChevronDown size={10} />
              </button>
              <AnimatePresence>
                {showPairPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-1 z-20 rounded-xl border border-white/[0.1] py-1 shadow-xl min-w-[130px]"
                    style={{ background: "hsl(228 52% 8%)" }}>
                    {CHART_PAIRS.map(p => (
                      <button key={p} onClick={() => { setChartPair(p); setShowPairPicker(false); }}
                        className={`w-full text-left px-3 py-2 text-[11px] font-bold transition-colors hover:bg-white/[0.05] ${p === chartPair ? "text-primary" : "text-muted-foreground"}`}>
                        {p}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <CandlestickChart symbol={chartPair} height={320} />
        </div>
      </motion.div>

      {/* ── Main signal card — full width ── */}
      <AnimatePresence mode="wait">
        {sig ? (
          <motion.div
            key={sig.id}
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.35 }}
          >
            <div className="relative rounded-2xl border overflow-hidden"
              style={{
                borderColor: `${a.color}28`,
                boxShadow: `0 0 80px ${a.glow}, 0 0 30px ${a.glow}`,
                background: "linear-gradient(160deg, hsl(228 48% 8%) 0%, hsl(228 55% 5%) 100%)",
              }}>

              {/* Animated accent line */}
              <motion.div className="absolute top-0 left-0 right-0 h-[2px]"
                style={{ background: `linear-gradient(90deg, transparent, ${a.color}, transparent)` }}
                animate={{ opacity: signalFlash ? [0.8, 1, 0.8] : [0.3, 0.6, 0.3] }}
                transition={{ duration: signalFlash ? 0.4 : 2.5, repeat: Infinity }} />

              {/* ── Signal hero row ── */}
              <div className="px-7 pt-6 pb-5 grid grid-cols-[auto_1fr_auto] gap-8 items-start border-b border-white/[0.05]">

                {/* Left: Gauge */}
                <div className="flex flex-col items-center gap-2">
                  <ConfidenceGauge confidence={sig.confidence} type={type} />
                  <span className="text-[9px] font-black tracking-[0.2em] uppercase text-muted-foreground/35">Signal Strength</span>
                </div>

                {/* Center: Signal info */}
                <div className="py-1 space-y-4">
                  {/* Direction + ticker */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <motion.div
                      key={sig.id + "badge"}
                      initial={{ scale: 1.15, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`inline-flex items-center gap-2 px-5 py-2 rounded-full border text-[15px] font-black tracking-widest uppercase ${a.badge}`}>
                      {type === "BUY" ? <TrendingUp size={16} /> : type === "SELL" ? <TrendingDown size={16} /> : <Minus size={16} />}
                      {type}
                    </motion.div>
                    <div className="text-[17px] font-black">{sig.ticker}</div>
                    <div className="px-2.5 py-1 rounded-lg border border-white/[0.1] text-[11px] font-bold text-muted-foreground/70"
                      style={{ background: "rgba(255,255,255,0.03)" }}>
                      {sig.timeframe}
                    </div>
                    <div className="px-2.5 py-1 rounded-full border border-primary/20 text-[11px] font-bold text-primary/70"
                      style={{ background: "rgba(200,168,75,0.06)" }}>
                      {sig.strategy}
                    </div>
                    {sig.aiGenerated && (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-full border border-purple-400/20 text-[9px] font-black tracking-widest uppercase text-purple-300/70"
                        style={{ background: "rgba(168,85,247,0.06)" }}>
                        <Brain size={8} /> AI
                      </div>
                    )}
                  </div>

                  {/* Price levels */}
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: "Entry Zone",   value: sig.entryZone, Icon: Crosshair,   color: "rgba(255,255,255,0.75)" },
                      { label: "Take Profit",  value: sig.target,    Icon: Target,      color: "#34d399" },
                      { label: "Stop Loss",    value: sig.stopLoss,  Icon: ShieldAlert, color: "#f87171" },
                      { label: "Risk/Reward",  value: sig.rr,        Icon: BarChart3,   color: a.color   },
                    ].map(({ label, value, Icon, color }) => (
                      <div key={label} className="rounded-xl px-3.5 py-3"
                        style={{ background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Icon size={10} style={{ color: "rgba(255,255,255,0.25)" }} />
                          <span className="text-[9px] font-bold tracking-[0.16em] uppercase text-muted-foreground/45">{label}</span>
                        </div>
                        <div className="text-[13px] font-bold font-mono tabular-nums" style={{ color }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-center gap-1.5">
                    <Clock size={10} className="text-muted-foreground/30" />
                    <span className="text-[11px] text-muted-foreground/40">
                      Signal generated {timeAgo(sig.timestamp)} · {sig.timestamp.toLocaleTimeString()}
                      {sig.priceAtSignal ? ` · Price at signal: $${sig.priceAtSignal.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : ""}
                    </span>
                  </div>
                </div>

                {/* Right: Market regime */}
                {regime && (
                  <div className="w-44 shrink-0">
                    <div className="text-[9px] font-black tracking-[0.2em] uppercase text-muted-foreground/35 mb-3">Market Regime</div>
                    {[
                      { label: "Trend",      value: regime.trend },
                      { label: "Momentum",   value: regime.momentum },
                      { label: "Volatility", value: regime.volatility },
                      { label: "Volume",     value: regime.volume },
                    ].map(({ label, value }) => {
                      const pos = ["Strongly Bullish", "Bullish", "Accelerating", "Above Average"].includes(value);
                      const neg = ["Strongly Bearish", "Bearish", "Decelerating", "High"].includes(value);
                      const c = pos ? "#34d399" : neg ? "#f87171" : "rgba(255,255,255,0.45)";
                      return (
                        <div key={label} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                          <span className="text-[11px] text-muted-foreground/50">{label}</span>
                          <span className="text-[11px] font-bold" style={{ color: c }}>{value}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Deep analysis tabs ── */}
              <div className="border-b border-white/[0.05]">
                <div className="flex items-center px-7 gap-0">
                  {([
                    { key: "indicators",  label: "Technical Indicators", badge: `${bullCount}B · ${bearCount}S` },
                    { key: "confluence",  label: "Confluence",           badge: `${posConf}/${totConf}` },
                    { key: "reasoning",   label: "Signal Reasoning",     badge: sig.aiGenerated ? "AI" : "Engine" },
                  ] as const).map(({ key, label, badge }) => (
                    <button key={key} onClick={() => setTab(key)}
                      className={`px-5 py-3.5 text-[11px] font-bold tracking-wide border-b-2 transition-all duration-200 flex items-center gap-2 ${
                        tab === key
                          ? "border-primary text-foreground"
                          : "border-transparent text-muted-foreground/50 hover:text-muted-foreground/80"
                      }`}>
                      {label}
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                        tab === key ? "bg-primary/15 text-primary" : "bg-white/[0.05] text-muted-foreground/40"
                      }`}>{badge}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-7 py-5">
                <AnimatePresence mode="wait">
                  {tab === "indicators" && (
                    <motion.div key="ind" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                      {sig.indicators && sig.indicators.length > 0 ? (
                        <div className="grid grid-cols-6 gap-3">
                          {sig.indicators.map(ind => {
                            const pos = ind.bias === "bullish"; const neg = ind.bias === "bearish";
                            const c = pos ? "#34d399" : neg ? "#f87171" : "rgba(255,255,255,0.35)";
                            const bg = pos ? "rgba(52,211,153,0.08)" : neg ? "rgba(248,113,113,0.08)" : "rgba(255,255,255,0.03)";
                            const border = pos ? "rgba(52,211,153,0.2)" : neg ? "rgba(248,113,113,0.2)" : "rgba(255,255,255,0.07)";
                            return (
                              <div key={ind.name} className="rounded-xl px-3.5 py-3 flex flex-col gap-1.5"
                                style={{ background: bg, border: `1px solid ${border}` }}>
                                <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-muted-foreground/45">{ind.name}</div>
                                <div className="text-[13px] font-bold tabular-nums" style={{ color: c }}>{ind.value}</div>
                                <div className="inline-flex items-center self-start px-1.5 py-0.5 rounded text-[8px] font-black tracking-wider uppercase"
                                  style={{ background: `${c}18`, border: `1px solid ${c}30`, color: c }}>
                                  {ind.bias === "bullish" ? "Bull" : ind.bias === "bearish" ? "Bear" : "Neut"}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-[12px] text-muted-foreground/40 text-center py-6">Indicators load on next signal…</div>
                      )}
                    </motion.div>
                  )}

                  {tab === "confluence" && (
                    <motion.div key="conf" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                      {sig.confluenceFactors && sig.confluenceFactors.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3">
                          {sig.confluenceFactors.map((f, i) => (
                            <div key={i} className="flex items-start gap-3 rounded-xl px-4 py-3"
                              style={{ background: f.positive ? "rgba(52,211,153,0.05)" : "rgba(245,158,11,0.05)", border: `1px solid ${f.positive ? "rgba(52,211,153,0.15)" : "rgba(245,158,11,0.15)"}` }}>
                              <div className={`mt-0.5 w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${f.positive ? "bg-emerald-500/15 border border-emerald-400/25" : "bg-amber-500/15 border border-amber-400/25"}`}>
                                {f.positive ? <Check size={10} className="text-emerald-400" /> : <AlertTriangle size={9} className="text-amber-400" />}
                              </div>
                              <span className="text-[12px] text-muted-foreground/75 leading-snug">{f.text}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[12px] text-muted-foreground/40 text-center py-6">Confluence loads on next signal…</div>
                      )}
                    </motion.div>
                  )}

                  {tab === "reasoning" && (
                    <motion.div key="reas" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                      <div className="rounded-xl px-5 py-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <p className="text-[13px] text-foreground/80 leading-relaxed">{sig.explanation}</p>
                      </div>
                      {sig.aiGenerated && (
                        <div className="flex items-center gap-1.5 mt-3">
                          <Brain size={10} className="text-purple-400/50" />
                          <span className="text-[10px] text-purple-400/50 font-bold">Generated by ABF AI Engine</span>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl border border-white/[0.07] h-64 flex items-center justify-center"
            style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}>
            <div className="text-center">
              <motion.div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center mx-auto mb-3"
                animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }}>
                <Brain size={20} className="text-primary" />
              </motion.div>
              <div className="text-[13px] text-muted-foreground">Initialising AI engine…</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom grid: Pairs + Performance + Session ── */}
      <div className="grid md:grid-cols-3 gap-5">

        {/* Market pairs */}
        <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
          style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}>
          <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={13} className="text-primary" />
              <span className="text-[12px] font-bold">Live Pairs</span>
            </div>
            <span className="text-[10px] text-muted-foreground/40 font-mono">{pairs.length} pairs</span>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {pairs.length > 0 ? (
              pairs.map(({ ticker, price, changePct24h }) => {
                const up = changePct24h >= 0;
                return (
                  <div key={ticker} className="px-5 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-bold">{ticker}</div>
                      <div className={`text-[10px] font-bold mt-0.5 ${up ? "text-emerald-400" : "text-red-400"}`}>
                        {up ? "+" : ""}{changePct24h.toFixed(2)}%
                      </div>
                    </div>
                    <MiniSparkline up={up} />
                    <div className="text-right">
                      <div className="text-[12px] font-bold font-mono tabular-nums">
                        ${price >= 1 ? price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : price.toFixed(4)}
                      </div>
                      <div className="text-[9px] text-emerald-400/60 font-bold mt-0.5">LIVE</div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-5 py-6 text-center text-[11px] text-muted-foreground/40">Loading live data…</div>
            )}
          </div>
        </div>

        {/* Session performance */}
        <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
          style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}>
          <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-2">
            <Zap size={13} className="text-primary" />
            <span className="text-[12px] font-bold">Session Performance</span>
          </div>
          <div className="px-5 py-4 space-y-4">
            {[
              { label: "Signals Generated",  value: signalHistory.length.toString(),    color: "rgba(255,255,255,0.8)" },
              { label: "Actionable (BUY/SELL)", value: totalSig.toString(),             color: a.color },
              { label: "BUY Signals",         value: buySigs.toString(),                color: "#34d399" },
              { label: "SELL Signals",        value: sellSigs.toString(),               color: "#f87171" },
              { label: "AI Generated",        value: signalHistory.filter(s => s.aiGenerated).length.toString(), color: "#a78bfa" },
              { label: "Avg Confidence",      value: signalHistory.length > 0 ? `${Math.round(signalHistory.reduce((a, s) => a + s.confidence, 0) / signalHistory.length)}%` : "—", color: a.color },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground/55">{label}</span>
                <span className="text-[14px] font-black tabular-nums" style={{ color }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Engine status */}
        <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
          style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}>
          <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-2">
            <Brain size={13} className="text-primary" />
            <span className="text-[12px] font-bold">ABF Engine Status</span>
          </div>
          <div className="px-5 py-4 space-y-4">
            {[
              { label: "Neural Core",       value: "Active", color: "#34d399" },
              { label: "AI Engine",         value: "GTPro Intelligence", color: "#a78bfa" },
              { label: "Market Feed",       value: dataMode === "live" ? "CoinGecko Live" : "Real-Time Fallback", color: dataMode === "live" ? "#34d399" : "#f59e0b" },
              { label: "BTC Price",         value: currentPrice > 0 ? `$${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "Loading…", color: "rgba(255,255,255,0.8)" },
              { label: "Volatility",        value: `${(volatility * 10000).toFixed(1)} bps`, color: volatility > 0.004 ? "#f87171" : "#34d399" },
              { label: "Signal Interval",   value: "6–12 sec", color: "rgba(255,255,255,0.5)" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground/55">{label}</span>
                <span className="text-[12px] font-bold" style={{ color }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Signal history — full width ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
        <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
          style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}>
          <div className="h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
          <div className="px-6 py-4 border-b border-white/[0.05] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Activity size={14} className="text-primary" />
              <h3 className="text-[13px] font-bold">Signal History</h3>
            </div>
            <span className="text-[11px] text-muted-foreground/40">Last {Math.min(signalHistory.length, 15)} signals</span>
          </div>

          {signalHistory.length === 0 ? (
            <div className="p-10 text-center">
              <RefreshCw size={20} className="text-muted-foreground/30 mx-auto mb-2" />
              <div className="text-[13px] text-muted-foreground/40">Waiting for signals…</div>
            </div>
          ) : (
            <div>
              {/* Table header */}
              <div className="grid grid-cols-[80px_1fr_80px_1fr_100px_100px_80px_64px] gap-4 px-6 py-2.5 border-b border-white/[0.04]">
                {["Type", "Strategy", "Ticker", "Entry Zone", "Target", "Stop Loss", "R:R", "Time"].map(h => (
                  <div key={h} className="text-[9px] font-black tracking-[0.18em] uppercase text-muted-foreground/30">{h}</div>
                ))}
              </div>
              <div className="divide-y divide-white/[0.03]">
                <AnimatePresence initial={false}>
                  {signalHistory.slice(0, 15).map((s, i) => {
                    const sa = ACCENT[s.type];
                    return (
                      <motion.div key={s.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: i === 0 ? 0 : 0 }}
                        className="grid grid-cols-[80px_1fr_80px_1fr_100px_100px_80px_64px] gap-4 px-6 py-3 items-center hover:bg-white/[0.015] transition-colors"
                      >
                        <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[9px] font-black tracking-wider uppercase ${sa.badge}`}>
                          {s.type === "BUY" ? <TrendingUp size={8} /> : s.type === "SELL" ? <TrendingDown size={8} /> : <Minus size={8} />}
                          {s.type}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold truncate">{s.strategy}</div>
                          <div className="text-[10px] text-muted-foreground/45 truncate">{s.confidence}% confidence</div>
                        </div>
                        <div className="text-[11px] font-bold font-mono">{s.ticker}</div>
                        <div className="text-[11px] font-mono text-muted-foreground/70 truncate">{s.entryZone}</div>
                        <div className="text-[11px] font-mono font-bold text-emerald-400 truncate">{s.target}</div>
                        <div className="text-[11px] font-mono font-bold text-red-400 truncate">{s.stopLoss}</div>
                        <div className="text-[11px] font-bold" style={{ color: sa.color }}>{s.rr}</div>
                        <div className="text-[10px] text-muted-foreground/35 text-right">{timeAgo(s.timestamp)}</div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
