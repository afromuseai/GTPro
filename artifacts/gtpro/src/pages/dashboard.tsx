import React, { useState, useEffect, useRef } from "react";
import { useGetDashboardStats, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Bot, TrendingUp, ArrowUpRight, ArrowDownRight, Play, Pause, Square, Zap, Clock, Cpu, Shield, CheckCircle, Wifi, WifiOff, Target, ShieldAlert, Crosshair, BarChart3, Activity, Check, AlertTriangle, LineChart, ChevronDown, ChevronUp, Layers, Radar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useBotEngine, Strategy, DurationKey, LogType, TradeRecord, TradeOutcome } from "@/engine/bot-engine";
import { useSignalEngine } from "@/engine/signal-engine";
import type { Signal } from "@/engine/signal-engine";
import { useFleetEngine } from "@/engine/fleet-engine";
import { useMarketData } from "@/engine/market-data";
import type { FeedState } from "@/engine/market-data";
import { useLiquidity } from "@/engine/liquidity-engine";
import { useLearning } from "@/engine/learning/learning-engine";
import { TrendingUp as TrendingUpIcon, TrendingDown as TrendingDownIcon, Minus as MinusIcon, Brain } from "lucide-react";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};
const cardItem = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] } },
};

const STRATEGIES: Strategy[] = ["Sweep & Reclaim", "Absorption Reversal", "Void Continuation"];
const DURATIONS: DurationKey[] = ["1h", "3h", "6h", "12h"];

const STRATEGY_DESC: Record<Strategy, string> = {
  "Sweep & Reclaim":     "Targets liquidity sweeps below key levels, enters on reclaim confirmation.",
  "Absorption Reversal": "Identifies aggressive order absorption at extremes for counter-trend entries.",
  "Void Continuation":   "Follows institutional flow through imbalance zones for trend continuation.",
};

const LOG_COLORS: Record<LogType, string> = {
  system: "bg-muted-foreground/40",
  signal: "bg-primary",
  trade:  "bg-blue-400",
  profit: "bg-emerald-400",
  warn:   "bg-amber-400",
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return [h, m, s].map(n => String(n).padStart(2, "0")).join(":");
}

function useCountdown(endTime: number | null): number {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!endTime) { setRemaining(0); return; }
    const tick = () => setRemaining(Math.max(0, endTime - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime]);
  return remaining;
}

// ── Circular confidence gauge ─────────────────────────────────────────────────

function ConfidenceGauge({ confidence, type }: { confidence: number; type: "BUY" | "SELL" | "HOLD" }) {
  const r   = 44;
  const cx  = 54;
  const cy  = 54;
  const arc = 2 * Math.PI * r * 0.75; // 270° sweep
  const fill = (confidence / 100) * arc;
  const color = type === "BUY" ? "#34d399" : type === "SELL" ? "#f87171" : "#c8a84b";
  const bgRing = "rgba(255,255,255,0.05)";

  return (
    <div className="relative flex items-center justify-center" style={{ width: 110, height: 110 }}>
      <svg width={110} height={110} className="absolute inset-0" style={{ overflow: "visible" }}>
        {/* Track ring */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={bgRing} strokeWidth={7}
          strokeDasharray={`${arc} ${2 * Math.PI * r}`}
          strokeLinecap="round"
          transform={`rotate(-225 ${cx} ${cy})`}
        />
        {/* Fill arc */}
        <motion.circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={`${arc} ${2 * Math.PI * r}`}
          initial={{ strokeDashoffset: arc }}
          animate={{ strokeDashoffset: arc - fill }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          strokeLinecap="round"
          transform={`rotate(-225 ${cx} ${cy})`}
          style={{ filter: `drop-shadow(0 0 5px ${color}55)` }}
        />
      </svg>
      {/* Centre */}
      <div className="flex flex-col items-center justify-center rounded-full"
        style={{ width: 72, height: 72, background: `${color}0d`, border: `1px solid ${color}22` }}>
        <span className="text-[22px] font-black leading-none tabular-nums" style={{ color }}>{confidence}</span>
        <span className="text-[8px] font-black tracking-[0.2em] uppercase mt-0.5" style={{ color: `${color}80` }}>CONF%</span>
      </div>
    </div>
  );
}

// ── Time ago ──────────────────────────────────────────────────────────────────

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

// ── Analysis Panel ────────────────────────────────────────────────────────────

function AnalysisPanel({ signal, accent }: { signal: Signal; accent: string }) {
  const [expanded, setExpanded] = useState(false);
  const indicators       = signal.indicators       ?? [];
  const confluenceFactors = signal.confluenceFactors ?? [];

  const biasBadge = (bias: "bullish" | "bearish" | "neutral") => {
    if (bias === "bullish") return { bg: "rgba(52,211,153,0.1)", border: "rgba(52,211,153,0.22)", color: "#34d399", label: "Bull" };
    if (bias === "bearish") return { bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.22)", color: "#f87171", label: "Bear" };
    return { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)", label: "Neut" };
  };

  const bullCount = (signal.indicators ?? []).filter(i => i.bias === "bullish").length;
  const bearCount = (signal.indicators ?? []).filter(i => i.bias === "bearish").length;
  const posCount  = (signal.confluenceFactors ?? []).filter(f => f.positive).length;
  const totalConf = (signal.confluenceFactors ?? []).length;

  return (
    <div className="border-b border-white/[0.04]">
      {/* ── Section header (clickable to expand) ── */}
      <button
        className="w-full px-5 py-3 flex items-center gap-3 hover:bg-white/[0.015] transition-colors"
        onClick={() => setExpanded(p => !p)}
      >
        <LineChart size={11} className="text-muted-foreground/30 shrink-0" />
        <span className="text-[10px] font-black tracking-[0.2em] uppercase text-muted-foreground/45">
          Technical Analysis
        </span>

        {/* Summary badges */}
        <div className="flex items-center gap-1.5 ml-1">
          {bullCount > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>
              {bullCount} Bull
            </span>
          )}
          {bearCount > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}>
              {bearCount} Bear
            </span>
          )}
          {totalConf > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: `${accent}12`, color: accent, border: `1px solid ${accent}28` }}>
              {posCount}/{totalConf} Conf.
            </span>
          )}
        </div>

        <div className="ml-auto text-muted-foreground/30">
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </div>
      </button>

      {/* ── Expanded analysis body ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-5 pb-4 space-y-4">

              {/* Technical indicators grid */}
              {indicators.length > 0 && (
                <div>
                  <div className="text-[9px] font-black tracking-[0.2em] uppercase text-muted-foreground/30 mb-2">
                    Indicators
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {indicators.map(ind => {
                      const b = biasBadge(ind.bias);
                      return (
                        <div key={ind.name} className="rounded-lg px-3 py-2"
                          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
                          <div className="text-[9px] font-bold text-muted-foreground/40 mb-1">{ind.name}</div>
                          <div className="text-[11px] font-bold tabular-nums" style={{ color: b.color }}>{ind.value}</div>
                          <div className="mt-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black tracking-wider uppercase"
                            style={{ background: b.bg, border: `1px solid ${b.border}`, color: b.color }}>
                            {b.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Confluence checklist */}
              {confluenceFactors.length > 0 && (
                <div>
                  <div className="text-[9px] font-black tracking-[0.2em] uppercase text-muted-foreground/30 mb-2">
                    Confluence Factors
                  </div>
                  <div className="space-y-1.5">
                    {confluenceFactors.map((factor, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                          factor.positive
                            ? "bg-emerald-500/10 border border-emerald-500/25"
                            : "bg-amber-500/10 border border-amber-500/25"
                        }`}>
                          {factor.positive
                            ? <Check size={9} className="text-emerald-400" />
                            : <AlertTriangle size={8} className="text-amber-400" />
                          }
                        </div>
                        <span className="text-[11px] text-muted-foreground/60 leading-snug">{factor.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI reasoning */}
              {signal.explanation && (
                <div>
                  <div className="text-[9px] font-black tracking-[0.2em] uppercase text-muted-foreground/30 mb-2">
                    Signal Reasoning
                  </div>
                  <div className="rounded-lg px-3 py-2.5"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <p className="text-[11px] text-muted-foreground/55 leading-relaxed">{signal.explanation}</p>
                  </div>
                  {signal.aiGenerated && (
                    <div className="flex items-center gap-1 mt-2">
                      <Brain size={9} className="text-purple-400/50" />
                      <span className="text-[9px] text-purple-400/50 font-bold">Generated by ABF AI Engine</span>
                    </div>
                  )}
                </div>
              )}

              {/* VCBF check result */}
              <VCBFCheckBadge />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── VCBF Check Badge ──────────────────────────────────────────────────────────

function VCBFCheckBadge() {
  const { vcbfLatestCheck } = useFleetEngine();
  if (!vcbfLatestCheck) return null;

  const { result, reasons, signalType, confidence } = vcbfLatestCheck;

  const cfg = {
    APPROVED: {
      border: "rgba(52,211,153,0.2)", bg: "rgba(52,211,153,0.06)", color: "#34d399",
      icon: "✓", label: "VCBF Approved",
    },
    WARNED: {
      border: "rgba(251,191,36,0.22)", bg: "rgba(251,191,36,0.06)", color: "#fbbf24",
      icon: "⚠", label: "VCBF Warning",
    },
    BLOCKED: {
      border: "rgba(248,113,113,0.22)", bg: "rgba(248,113,113,0.06)", color: "#f87171",
      icon: "✗", label: "VCBF Blocked",
    },
  }[result];

  if (signalType === "HOLD" && result === "APPROVED") return null;

  return (
    <div className="rounded-lg px-3 py-2.5 space-y-2"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-black" style={{ color: cfg.color }}>{cfg.icon} {cfg.label}</span>
        <span className="text-[9px] font-bold text-muted-foreground/40 ml-auto">VCBF · {confidence}% conf.</span>
      </div>
      <div className="space-y-1">
        {reasons.map((r, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <div className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: cfg.color + "80" }} />
            <span className="text-[10px] leading-relaxed" style={{ color: cfg.color + "cc" }}>{r}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Live Signal Widget ────────────────────────────────────────────────────────

function LiveSignalWidget() {
  const { currentSignal, signalHistory, signalFlash, regime } = useSignalEngine();
  const { executionMode, setExecutionMode, executeSignal, executedSignals, maxRiskPct, setMaxRiskPct } = useFleetEngine();
  const [, setTick] = useState(0);

  // Refresh time-ago labels every 10 s
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  if (!currentSignal) return null;

  const isBuy       = currentSignal.type === "BUY";
  const isSell      = currentSignal.type === "SELL";
  const isActionable = isBuy || isSell;
  const DirIcon     = isBuy ? TrendingUpIcon : isSell ? TrendingDownIcon : MinusIcon;
  const alreadyExec = executedSignals.some(e => e.signalId === currentSignal.id);

  const accent  = isBuy ? "#34d399" : isSell ? "#f87171" : "#c8a84b";
  const glowCls = isBuy  ? "border-emerald-400/20 shadow-[0_0_60px_rgba(52,211,153,0.07)]"
                : isSell ? "border-red-400/20 shadow-[0_0_60px_rgba(248,113,113,0.07)]"
                         : "border-primary/15";
  const dirBadge = isBuy  ? "bg-emerald-500/10 border-emerald-400/25 text-emerald-300"
                 : isSell ? "bg-red-500/10 border-red-400/25 text-red-300"
                          : "bg-primary/10 border-primary/20 text-primary";

  const recentHistory = signalHistory.slice(1, 7);

  const priceLevels = [
    { label: "Entry Zone",    value: currentSignal.entryZone, Icon: Crosshair,   color: "rgba(255,255,255,0.75)" },
    { label: "Take Profit",   value: currentSignal.target,    Icon: Target,      color: "#34d399" },
    { label: "Stop Loss",     value: currentSignal.stopLoss,  Icon: ShieldAlert, color: "#f87171" },
    { label: "Risk / Reward", value: currentSignal.rr,        Icon: BarChart3,   color: accent },
  ];

  const regimeRows = regime ? [
    { label: "Trend",      value: regime.trend },
    { label: "Momentum",   value: regime.momentum },
    { label: "Volatility", value: regime.volatility },
    { label: "Volume",     value: regime.volume },
  ] : [];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className={`relative rounded-2xl border overflow-hidden transition-all duration-500 ${glowCls}`}
        style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}>

        {/* Animated accent top bar */}
        <motion.div className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
          animate={{ opacity: signalFlash ? [0.7, 1, 0.7] : [0.25, 0.55, 0.25] }}
          transition={{ duration: signalFlash ? 0.4 : 2.8, repeat: Infinity }}
        />

        {/* ── Header strip ───────────────────────────────────────────────── */}
        <div className="px-5 pt-4 pb-3 flex items-center gap-2.5 border-b border-white/[0.05]">
          {/* Live pulse */}
          <motion.div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accent }}
            animate={{ opacity: [1, 0.25, 1], scale: [1, 0.55, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <span className="text-[10px] font-black tracking-[0.22em] uppercase text-muted-foreground/50">Live Signal</span>

          <div className="w-px h-3.5 bg-white/[0.07] mx-0.5" />

          {/* Ticker */}
          <span className="text-[14px] font-black">{currentSignal.ticker}</span>

          {/* Timeframe pill */}
          <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-white/[0.09] text-muted-foreground/55"
            style={{ background: "rgba(255,255,255,0.025)" }}>
            {currentSignal.timeframe}
          </span>

          {/* Strategy chip */}
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-primary/18 text-primary/65"
            style={{ background: "rgba(200,168,75,0.06)" }}>
            {currentSignal.strategy}
          </span>

          {/* AI badge */}
          {currentSignal.aiGenerated && (
            <div className="flex items-center gap-1 text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full border border-purple-400/20 text-purple-300/65"
              style={{ background: "rgba(168,85,247,0.06)" }}>
              <Brain size={8} />AI
            </div>
          )}

          {/* Direction badge — right edge */}
          <motion.div key={currentSignal.id}
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.22 }}
            className={`ml-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-[12px] font-black tracking-widest uppercase shrink-0 ${dirBadge}`}>
            <DirIcon size={12} />
            {currentSignal.type}
          </motion.div>
        </div>

        {/* ── Main body: gauge + price levels + regime ───────────────────── */}
        <div className="px-5 py-4 grid grid-cols-[auto_1fr] gap-6 items-start border-b border-white/[0.04]">

          {/* Left: circular gauge */}
          <div className="flex flex-col items-center gap-2 pt-1">
            <ConfidenceGauge confidence={currentSignal.confidence} type={currentSignal.type as "BUY" | "SELL" | "HOLD"} />
            <span className="text-[9px] font-black tracking-[0.18em] uppercase text-muted-foreground/35">
              Signal Strength
            </span>
          </div>

          {/* Right: two sub-columns */}
          <div className="grid grid-cols-2 gap-x-8">

            {/* Price levels */}
            <div>
              <div className="text-[9px] font-black tracking-[0.2em] uppercase text-muted-foreground/35 mb-3">
                Price Levels
              </div>
              {priceLevels.map(({ label, value, Icon, color }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-white/[0.035] last:border-0">
                  <div className="flex items-center gap-1.5">
                    <Icon size={10} className="shrink-0" style={{ color: "rgba(255,255,255,0.22)" }} />
                    <span className="text-[11px] text-muted-foreground/50">{label}</span>
                  </div>
                  <span className="text-[11px] font-bold font-mono tabular-nums" style={{ color }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Market regime */}
            <div>
              <div className="text-[9px] font-black tracking-[0.2em] uppercase text-muted-foreground/35 mb-3">
                Market Regime
              </div>
              {regimeRows.map(({ label, value }) => {
                const pos = ["Strongly Bullish", "Bullish", "Accelerating", "Above Average"].includes(value);
                const neg = ["Strongly Bearish", "Bearish", "Decelerating", "High"].includes(value);
                const c   = pos ? "#34d399" : neg ? "#f87171" : "rgba(255,255,255,0.45)";
                return (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-white/[0.035] last:border-0">
                    <span className="text-[11px] text-muted-foreground/50">{label}</span>
                    <span className="text-[11px] font-bold" style={{ color: c }}>{value}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Analysis panel ─────────────────────────────────────────────── */}
        <AnalysisPanel signal={currentSignal} accent={accent} />

        {/* ── Execution strip ────────────────────────────────────────────── */}
        <div className="px-5 py-3 flex items-center gap-3 border-b border-white/[0.04]">
          {/* Mode toggle */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg border border-white/[0.08]"
            style={{ background: "rgba(0,0,0,0.25)" }}>
            {(["manual", "auto"] as const).map(m => (
              <button key={m} onClick={() => setExecutionMode(m)}
                className={`px-3 py-1 rounded-md text-[10px] font-black tracking-widest uppercase transition-all duration-200 ${
                  executionMode === m
                    ? m === "auto"
                      ? "bg-amber-500/20 border border-amber-500/30 text-amber-400"
                      : "bg-white/[0.08] border border-white/[0.1] text-foreground"
                    : "text-muted-foreground/35 hover:text-muted-foreground/65"
                }`}>
                {m === "auto" ? "⚡ Auto" : "Manual"}
              </button>
            ))}
          </div>

          {executionMode === "auto" ? (
            <div className="flex items-center gap-2 flex-1">
              <motion.div className="w-1.5 h-1.5 rounded-full bg-amber-400"
                animate={{ opacity: [1, 0.3, 1], scale: [1, 0.7, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }} />
              <span className="text-[11px] text-amber-400 font-bold">Auto-executing · max {maxRiskPct}% risk</span>
              <div className="flex items-center gap-1.5 ml-2">
                <span className="text-[10px] text-muted-foreground/35">Risk:</span>
                {[1, 2, 3, 5].map(pct => (
                  <button key={pct} onClick={() => setMaxRiskPct(pct)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-all ${
                      maxRiskPct === pct
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                        : "border-white/[0.06] text-muted-foreground/35 hover:border-white/[0.12]"
                    }`}>
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-1">
              {isActionable ? (
                alreadyExec ? (
                  <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-bold">
                    <CheckCircle size={12} /> Order submitted
                  </div>
                ) : (
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Button size="sm" variant="outline"
                      onClick={() => executeSignal(currentSignal.id, currentSignal.type as "BUY" | "SELL", currentSignal.ticker, currentSignal.confidence)}
                      className={`h-9 px-5 text-[11px] font-black gap-2 border transition-all ${
                        isBuy
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-400/40"
                          : "bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20 hover:border-red-400/40"
                      }`}>
                      <Zap size={11} />
                      Execute {currentSignal.type} · {currentSignal.ticker}
                    </Button>
                  </motion.div>
                )
              ) : (
                <span className="text-[11px] text-muted-foreground/35 italic">HOLD — no actionable entry right now</span>
              )}
              {executedSignals.length > 0 && (
                <span className="text-[10px] text-muted-foreground/30 ml-auto">
                  {executedSignals.length} trade{executedSignals.length !== 1 ? "s" : ""} this session
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Signal history ─────────────────────────────────────────────── */}
        {recentHistory.length > 0 && (
          <div className="px-5 py-3">
            <div className="text-[9px] font-black tracking-[0.2em] uppercase text-muted-foreground/30 mb-2.5">
              Signal History
            </div>
            <div className="space-y-0">
              {recentHistory.map(sig => {
                const b = sig.type === "BUY";
                const s = sig.type === "SELL";
                const c = b ? "#34d399" : s ? "#f87171" : "#c8a84b";
                const HIcon = b ? TrendingUpIcon : s ? TrendingDownIcon : MinusIcon;
                return (
                  <div key={sig.id} className="flex items-center gap-3 py-2 border-b border-white/[0.03] last:border-0">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c }} />
                    <span className="text-[10px] font-black tracking-wider uppercase w-8 shrink-0" style={{ color: c }}>
                      {sig.type}
                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground/55 shrink-0">{sig.ticker}</span>
                    <div className="flex items-center gap-1.5 flex-1">
                      <div className="h-1 rounded-full" style={{ width: `${sig.confidence * 0.5}px`, background: `${c}50`, maxWidth: 48 }} />
                      <span className="text-[10px] text-muted-foreground/35 font-mono tabular-nums">{sig.confidence}%</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground/35 shrink-0 truncate max-w-[120px]">{sig.strategy.split(" ")[0]} &amp; {sig.strategy.split(" ").slice(1).join(" ")}</span>
                    <span className="text-[10px] text-muted-foreground/25 shrink-0">{timeAgo(sig.timestamp)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Sparkline SVG — smooth bezier curve ──────────────────────────────────────

function Sparkline({ prices, color }: { prices: number[]; color: string }) {
  if (prices.length < 2) return <div className="w-full h-full" />;
  const pts  = prices.slice(-50);
  const min  = Math.min(...pts);
  const max  = Math.max(...pts);
  const range = max - min || 1;
  const W = 400, H = 64;
  const step = W / (pts.length - 1);
  const pad  = H * 0.08;

  const coords: [number, number][] = pts.map((p, i) => [
    i * step,
    H - pad - ((p - min) / range) * (H - pad * 2),
  ]);

  // Catmull-Rom → cubic bezier smooth path
  const tension = 0.35;
  let d = `M ${coords[0][0].toFixed(1)} ${coords[0][1].toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i - 1] ?? coords[i];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2] ?? p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) * tension;
    const cp1y = p1[1] + (p2[1] - p0[1]) * tension;
    const cp2x = p2[0] - (p3[0] - p1[0]) * tension;
    const cp2y = p2[1] - (p3[1] - p1[1]) * tension;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }

  const last = coords[coords.length - 1];
  const fillD = `${d} L${last[0].toFixed(1)},${H} L0,${H} Z`;
  const glowId = `glow-${color.replace("#", "")}`;
  const gradId = `grad-${color.replace("#", "")}`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.18" />
          <stop offset="75%"  stopColor={color} stopOpacity="0.04" />
          <stop offset="100%" stopColor={color} stopOpacity="0"    />
        </linearGradient>
        <filter id={glowId} x="-20%" y="-60%" width="140%" height="220%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Area fill */}
      <path d={fillD} fill={`url(#${gradId})`} />
      {/* Glow copy */}
      <path d={d} stroke={color} strokeWidth="3" fill="none" strokeOpacity="0.3" filter={`url(#${glowId})`} />
      {/* Main line */}
      <path d={d} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Live dot at end */}
      <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r="2.5" fill={color} opacity="0.9" />
      <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r="4.5" fill={color} opacity="0.15" />
    </svg>
  );
}

// ── Live Price Ticker ─────────────────────────────────────────────────────────

function PriceTicker() {
  const { currentPrice, priceHistory, priceChangePct, changePct24h, trend, dataMode, feedState, volume, spread, volatility } = useMarketData();
  const { currentSignal } = useSignalEngine();

  // When live, use real 24h change from CoinGecko; otherwise use session change
  const displayChangePct = dataMode === "live" ? changePct24h : priceChangePct;
  const isUp      = displayChangePct >= 0;
  const prices    = priceHistory.map(t => t.price);
  const lineColor = isUp ? "#34d399" : "#f87171";

  const [displayPrice, setDisplayPrice] = useState(currentPrice);
  const [flash, setFlash]               = useState<"up" | "down" | null>(null);
  const prevPrice = useRef(currentPrice);

  useEffect(() => {
    if (currentPrice !== prevPrice.current) {
      setFlash(currentPrice > prevPrice.current ? "up" : "down");
      setTimeout(() => setFlash(null), 600);
      prevPrice.current = currentPrice;
    }
    setDisplayPrice(currentPrice);
  }, [currentPrice]);

  // Derived stats
  const sessionChangeDollar = currentPrice * (displayChangePct / 100);
  const high24h = prices.length > 1 ? Math.max(...prices) : currentPrice;
  const low24h  = prices.length > 1 ? Math.min(...prices) : currentPrice;
  const sessionLabel = dataMode === "live" ? "24h" : "Session";
  const bid     = currentPrice - spread / 2;
  const ask     = currentPrice + spread / 2;

  const trendColor = trend === "up" ? "#34d399" : trend === "down" ? "#f87171" : "rgba(255,255,255,0.4)";
  const trendLabel = trend === "up" ? "Bullish" : trend === "down" ? "Bearish" : "Ranging";

  const signalType = currentSignal?.type;
  const signalColor = signalType === "BUY" ? "#34d399" : signalType === "SELL" ? "#f87171" : null;

  const stats = [
    { label: "24H High",    value: `$${high24h.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: "#34d399" },
    { label: "24H Low",     value: `$${low24h.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,  color: "#f87171" },
    { label: "Volume",      value: volume > 0 ? `${volume.toFixed(2)} BTC` : "—",                                                   color: "rgba(255,255,255,0.65)" },
    { label: "Bid",         value: bid > 0 ? `$${bid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—",  color: "#34d399" },
    { label: "Ask",         value: ask > 0 ? `$${ask.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—",  color: "#f87171" },
    { label: "Spread",      value: spread > 0 ? `$${spread.toFixed(2)}` : "—",                                                      color: "rgba(255,255,255,0.65)" },
    { label: "Volatility",  value: `${(volatility * 100).toFixed(3)}%`,                                                             color: volatility > 0.004 ? "#f87171" : "rgba(255,255,255,0.65)" },
    { label: "Regime",      value: trendLabel,                                                                                       color: trendColor },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl border border-white/[0.07] overflow-hidden relative"
      style={{ background: "linear-gradient(160deg, hsl(228 48% 8%) 0%, hsl(228 55% 5%) 60%, hsl(228 60% 4%) 100%)" }}
    >
      {/* Subtle glow behind price */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 60% 50% at 20% 50%, ${isUp ? "rgba(52,211,153,0.035)" : "rgba(248,113,113,0.035)"} 0%, transparent 70%)` }} />

      {/* Top accent line */}
      <motion.div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent 0%, ${lineColor}60 30%, ${lineColor}80 50%, ${lineColor}60 70%, transparent 100%)` }}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      <div className="px-6 pt-5 pb-0">
        {/* ── Header row ── */}
        <div className="flex items-center gap-3 mb-4">
          {/* BTC badge */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.25) 0%, rgba(245,158,11,0.1) 100%)", border: "1px solid rgba(245,158,11,0.3)" }}>
              <span className="text-[14px] font-black text-amber-400">₿</span>
            </div>
            <div>
              <div className="text-[14px] font-black tracking-tight">BTC/USDT</div>
              <div className="text-[9px] font-bold tracking-[0.16em] uppercase text-muted-foreground/40">Perpetual · Spot</div>
            </div>
          </div>

          <div className="w-px h-6 bg-white/[0.07] mx-1" />

          {/* Market feed status pill */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black tracking-widest uppercase ${
            feedState === "live"
              ? "border-emerald-400/25 bg-emerald-400/8 text-emerald-400"
              : feedState === "reconnecting"
              ? "border-amber-400/25 bg-amber-400/8 text-amber-400/80"
              : "border-white/[0.12] bg-white/[0.04] text-muted-foreground/60"
          }`}>
            <motion.div className={`w-1.5 h-1.5 rounded-full ${
              feedState === "live" ? "bg-emerald-400" : feedState === "reconnecting" ? "bg-amber-400" : "bg-white/30"
            }`}
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }} />
            {feedState === "live" ? "Live Feed" : feedState === "reconnecting" ? "Reconnecting…" : "Connecting…"}
          </div>

          {/* Signal badge */}
          {signalType && signalColor && signalType !== "HOLD" && (
            <motion.div
              key={currentSignal?.id}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black tracking-widest uppercase"
              style={{ borderColor: `${signalColor}35`, background: `${signalColor}10`, color: signalColor }}
            >
              {signalType === "BUY" ? <TrendingUpIcon size={9} /> : <TrendingDownIcon size={9} />}
              {signalType} Signal
            </motion.div>
          )}

          {/* Trend chip */}
          <div className="ml-auto flex items-center gap-1.5 text-[10px] font-black tracking-[0.14em] uppercase"
            style={{ color: trendColor }}>
            {trend === "up" ? <TrendingUpIcon size={11} /> : trend === "down" ? <TrendingDownIcon size={11} /> : <MinusIcon size={11} />}
            {trendLabel}
          </div>
        </div>

        {/* ── Price hero row ── */}
        <div className="flex items-end gap-4 mb-4">
          <motion.div
            key={Math.round(displayPrice * 10)}
            animate={{ color: flash === "up" ? "#34d399" : flash === "down" ? "#f87171" : "#f8fafc" }}
            transition={{ duration: 0.2 }}
            className="text-[38px] font-black tabular-nums tracking-tight leading-none"
          >
            ${displayPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </motion.div>

          <div className="pb-1.5 flex flex-col items-start gap-0.5">
            {/* Dollar change */}
            <div className={`text-[13px] font-bold tabular-nums ${isUp ? "text-emerald-400" : "text-red-400"}`}>
              {isUp ? "+" : "−"}${Math.abs(sessionChangeDollar).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            {/* Pct change */}
            <div className={`flex items-center gap-0.5 text-[12px] font-bold ${isUp ? "text-emerald-400/70" : "text-red-400/70"}`}>
              {isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {isUp ? "+" : ""}{displayChangePct.toFixed(3)}% <span className="text-[9px] font-semibold opacity-50 ml-0.5">{sessionLabel}</span>
            </div>
          </div>

          {/* Flash pulse dot */}
          {flash && (
            <motion.div className={`mb-2 w-2.5 h-2.5 rounded-full ${flash === "up" ? "bg-emerald-400" : "bg-red-400"}`}
              initial={{ scale: 1.5, opacity: 1 }}
              animate={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.5 }}
            />
          )}
        </div>
      </div>

      {/* ── Full-width sparkline ── */}
      <div className="h-16 w-full px-0">
        <Sparkline prices={prices} color={lineColor} />
      </div>

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-8 border-t border-white/[0.05]">
        {stats.map((stat, i) => (
          <div key={stat.label} className={`px-4 py-3 ${i < stats.length - 1 ? "border-r border-white/[0.05]" : ""}`}>
            <div className="text-[9px] font-bold tracking-[0.16em] uppercase text-muted-foreground/35 mb-1.5">
              {stat.label}
            </div>
            <div className="text-[11px] font-bold tabular-nums font-mono" style={{ color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Liquidity Panel ───────────────────────────────────────────────────────────

function LiquidityPanel() {
  const liq = useLiquidity();

  const imbalanceColor = liq.imbalance === "buy" ? "#34d399" : liq.imbalance === "sell" ? "#f87171" : "rgba(255,255,255,0.35)";
  const imbalanceLabel = liq.imbalance === "buy" ? "BUY PRESSURE" : liq.imbalance === "sell" ? "SELL PRESSURE" : "NEUTRAL";

  const ZONE_COLORS: Record<string, string> = {
    EQH:           "#f87171",
    EQL:           "#34d399",
    SESSION_HIGH:  "#f59e0b",
    SESSION_LOW:   "#60a5fa",
    STOP_CLUSTER:  "#a78bfa",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="rounded-2xl border border-white/[0.07] overflow-hidden"
      style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.05]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center">
            <Layers size={12} className="text-primary" />
          </div>
          <div>
            <span className="text-[12px] font-bold">Liquidity &amp; Order Flow</span>
            <span className="text-[10px] text-muted-foreground/40 ml-2">Live microstructure layer</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {liq.sweepDetected && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-400/30 bg-amber-400/8 text-[9px] font-black tracking-widest uppercase text-amber-300"
            >
              <motion.div className="w-1.5 h-1.5 rounded-full bg-amber-400"
                animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
              Sweep
            </motion.div>
          )}
          {liq.absorption && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-purple-400/30 bg-purple-400/8 text-[9px] font-black tracking-widest uppercase text-purple-300"
            >
              <motion.div className="w-1.5 h-1.5 rounded-full bg-purple-400"
                animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.1, repeat: Infinity }} />
              Absorbing
            </motion.div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 divide-x divide-white/[0.05]">

        {/* Order Flow Imbalance bar */}
        <div className="px-4 py-4 col-span-1">
          <div className="text-[9px] font-black tracking-[0.18em] uppercase text-muted-foreground/35 mb-3">Order Flow</div>
          <div className="flex flex-col gap-2">
            {/* Buy bar */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-bold text-emerald-400/70 tracking-widest uppercase">Buy</span>
                <span className="text-[10px] font-black tabular-nums text-emerald-400">{liq.buyPressure}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div
                  animate={{ width: `${liq.buyPressure}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                />
              </div>
            </div>
            {/* Sell bar */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-bold text-red-400/70 tracking-widest uppercase">Sell</span>
                <span className="text-[10px] font-black tabular-nums text-red-400">{liq.sellPressure}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div
                  animate={{ width: `${liq.sellPressure}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400"
                />
              </div>
            </div>
            {/* Imbalance label */}
            <div className="mt-1 text-center">
              <span className="text-[9px] font-black tracking-[0.18em] uppercase" style={{ color: imbalanceColor }}>
                {imbalanceLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Sweep + Absorption status */}
        <div className="px-4 py-4">
          <div className="text-[9px] font-black tracking-[0.18em] uppercase text-muted-foreground/35 mb-3">Events</div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground/55">Sweep</span>
              <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-black tracking-wider uppercase ${
                liq.sweepDetected
                  ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                  : "border-white/[0.07] bg-white/[0.02] text-muted-foreground/30"
              }`}>
                <div className={`w-1 h-1 rounded-full ${liq.sweepDetected ? "bg-amber-400" : "bg-muted-foreground/20"}`} />
                {liq.sweepDetected ? "YES" : "NO"}
              </div>
            </div>
            {liq.sweepDetected && liq.sweepPrice && (
              <div className="text-[10px] text-amber-400/60 font-mono">@ ${liq.sweepPrice.toFixed(0)}</div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground/55">Absorption</span>
              <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-black tracking-wider uppercase ${
                liq.absorption
                  ? "border-purple-400/30 bg-purple-400/10 text-purple-300"
                  : "border-white/[0.07] bg-white/[0.02] text-muted-foreground/30"
              }`}>
                <div className={`w-1 h-1 rounded-full ${liq.absorption ? "bg-purple-400" : "bg-muted-foreground/20"}`} />
                {liq.absorption ? "YES" : "NO"}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground/55">Vol Pressure</span>
              <span className={`text-[11px] font-bold tabular-nums ${liq.volatilityPressure > 60 ? "text-red-400" : liq.volatilityPressure > 35 ? "text-amber-400" : "text-emerald-400"}`}>
                {liq.volatilityPressure}/100
              </span>
            </div>
          </div>
        </div>

        {/* Nearest zone */}
        <div className="px-4 py-4">
          <div className="text-[9px] font-black tracking-[0.18em] uppercase text-muted-foreground/35 mb-3">Nearest Zone</div>
          {liq.nearestZone ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: ZONE_COLORS[liq.nearestZone.type] ?? "#888" }} />
                <span className="text-[10px] font-bold" style={{ color: ZONE_COLORS[liq.nearestZone.type] ?? "#888" }}>
                  {liq.nearestZone.type.replace("_", " ")}
                </span>
              </div>
              <div className="text-[16px] font-black font-mono tabular-nums" style={{ color: ZONE_COLORS[liq.nearestZone.type] ?? "#888" }}>
                ${liq.nearestZone.price.toFixed(0)}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] text-muted-foreground/40">Strength</span>
                  <span className="text-[9px] font-bold text-muted-foreground/60">{Math.round(liq.nearestZone.strength * 100)}%</span>
                </div>
                <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${liq.nearestZone.strength * 100}%`, background: ZONE_COLORS[liq.nearestZone.type] ?? "#888" }} />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground/30 italic">Computing…</div>
          )}
        </div>

        {/* All zones list */}
        <div className="px-4 py-4">
          <div className="text-[9px] font-black tracking-[0.18em] uppercase text-muted-foreground/35 mb-3">Zone Map</div>
          <div className="space-y-1.5">
            {liq.liquidityZones.slice(0, 5).map(z => (
              <div key={z.id} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ZONE_COLORS[z.type] ?? "#888", opacity: z.strength }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-muted-foreground/45 truncate">{z.type.replace("_", " ")}</span>
                    <span className="text-[9px] font-mono font-bold ml-1 shrink-0" style={{ color: ZONE_COLORS[z.type] ?? "#888" }}>
                      ${z.price.toFixed(0)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Performance Memory Panel ──────────────────────────────────────────────────

function PerformanceMemoryPanel() {
  const learning = useLearning();

  const winPct = Math.round(learning.overallWinRate * 100);
  const ringColor = winPct >= 60 ? "#34d399" : winPct >= 45 ? "#fbbf24" : "#f87171";
  const circumference = 2 * Math.PI * 26;
  const filled = (winPct / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="relative rounded-2xl border border-white/[0.07] overflow-hidden"
      style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.25)" }}>
            <Brain size={13} className="text-violet-400" />
          </div>
          <div>
            <div className="text-[11px] font-black tracking-[0.18em] uppercase text-white/80">Performance Memory</div>
            <div className="text-[9px] text-muted-foreground/45 tracking-wide mt-0.5">Self-Improving Trade Intelligence</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider" style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.2)", color: "rgba(167,139,250,0.9)" }}>
            {learning.totalTrades} TRADES
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/[0.04]">

        {/* Win-rate ring */}
        <div className="flex flex-col items-center justify-center px-5 py-5 gap-3">
          <div className="relative">
            <svg width="64" height="64" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
              <circle
                cx="32" cy="32" r="26" fill="none"
                stroke={ringColor} strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${filled} ${circumference}`}
                style={{ transition: "stroke-dasharray 0.8s ease", filter: `drop-shadow(0 0 6px ${ringColor})` }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-[15px] font-black tabular-nums" style={{ color: ringColor }}>{winPct}%</span>
            </div>
          </div>
          <div className="text-center">
            <div className="text-[9px] font-black tracking-[0.15em] uppercase text-muted-foreground/50">Win Rate</div>
            <div className="text-[9px] text-muted-foreground/35 mt-0.5">{learning.totalTrades} recorded</div>
          </div>
        </div>

        {/* Best / Worst strategy */}
        <div className="flex flex-col justify-center px-4 py-5 gap-4">
          <div>
            <div className="text-[9px] font-black tracking-[0.15em] uppercase text-muted-foreground/35 mb-1">Best Strategy</div>
            <div className="text-[11px] font-bold text-emerald-400 leading-tight">{learning.bestStrategy}</div>
          </div>
          <div>
            <div className="text-[9px] font-black tracking-[0.15em] uppercase text-muted-foreground/35 mb-1">Worst Condition</div>
            <div className="text-[11px] font-bold text-red-400 leading-tight">{learning.worstCondition}</div>
          </div>
        </div>

        {/* Strategy stats bars */}
        <div className="px-4 py-5 col-span-2">
          <div className="text-[9px] font-black tracking-[0.15em] uppercase text-muted-foreground/35 mb-3">Strategy Performance</div>
          <div className="space-y-2.5">
            {learning.strategyStats.slice(0, 5).map(s => {
              const wr = Math.round(s.winRate * 100);
              const barColor = wr >= 60 ? "#34d399" : wr >= 45 ? "#fbbf24" : "#f87171";
              return (
                <div key={s.strategy}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-muted-foreground/60 font-medium truncate max-w-[120px]">{s.strategy}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[9px] text-muted-foreground/35">{s.trades}T</span>
                      <span className="text-[10px] font-black tabular-nums" style={{ color: barColor }}>{wr}%</span>
                    </div>
                  </div>
                  <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${wr}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      style={{ background: barColor, boxShadow: `0 0 6px ${barColor}40` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Memory weight summary */}
          <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center gap-3 flex-wrap">
            {learning.memoryWeight && (Object.entries(learning.memoryWeight) as [string, number][]).slice(0, 4).map(([key, raw]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: raw > 3 ? "#34d399" : raw < -3 ? "#f87171" : "#94a3b8" }} />
                <span className="text-[8px] text-muted-foreground/40">{key.replace(/([A-Z])/g, " $1").toLowerCase().trim()}</span>
                <span className="text-[8px] font-black" style={{ color: raw > 3 ? "#34d399" : raw < -3 ? "#f87171" : "#94a3b8" }}>
                  {raw > 0 ? `+${raw}` : raw === 0 ? "±0" : `${raw}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Trade History Table ───────────────────────────────────────────────────────

const OUTCOME_CFG: Record<TradeOutcome, { label: string; color: string; bg: string; border: string }> = {
  tp:      { label: "TP Hit",   color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.2)" },
  sl:      { label: "SL Hit",   color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" },
  manual:  { label: "Manual",   color: "#c8a84b", bg: "rgba(200,168,75,0.08)",  border: "rgba(200,168,75,0.2)" },
  expired: { label: "Expired",  color: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.18)" },
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDuration(openedAt: number, closedAt: number): string {
  const ms   = closedAt - openedAt;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ${secs % 60}s`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function TradeHistoryTable() {
  const { tradeHistory } = useBotEngine();

  const totalPnl  = tradeHistory.reduce((sum, t) => sum + t.pnl, 0);
  const wins      = tradeHistory.filter(t => t.pnl > 0).length;
  const losses    = tradeHistory.filter(t => t.pnl <= 0).length;
  const winRate   = tradeHistory.length > 0 ? Math.round((wins / tradeHistory.length) * 100) : 0;
  const winColor  = winRate >= 60 ? "#34d399" : winRate >= 45 ? "#fbbf24" : "#f87171";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="relative rounded-2xl border border-white/[0.07] overflow-hidden"
      style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400/25 to-transparent" />

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.25)" }}>
            <Activity size={13} className="text-blue-400" />
          </div>
          <div>
            <div className="text-[11px] font-black tracking-[0.18em] uppercase text-white/80">Trade History</div>
            <div className="text-[9px] text-muted-foreground/45 tracking-wide mt-0.5">Real-time closed position log</div>
          </div>
        </div>

        {/* Summary strip */}
        <div className="flex items-center gap-4">
          {tradeHistory.length > 0 && (
            <>
              <div className="text-right">
                <div className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground/40">Win Rate</div>
                <div className="text-[13px] font-black tabular-nums" style={{ color: winColor }}>{winRate}%</div>
              </div>
              <div className="w-px h-7 bg-white/[0.06]" />
              <div className="text-right">
                <div className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground/40">Net P&L</div>
                <div className={`text-[13px] font-black tabular-nums ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
                </div>
              </div>
              <div className="w-px h-7 bg-white/[0.06]" />
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-emerald-400 font-black">{wins}W</span>
                <span className="text-muted-foreground/30">/</span>
                <span className="text-red-400 font-black">{losses}L</span>
              </div>
            </>
          )}
          <div className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider"
            style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.2)", color: "rgba(96,165,250,0.9)" }}>
            {tradeHistory.length} TRADES
          </div>
        </div>
      </div>

      {tradeHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <Activity size={18} className="text-muted-foreground/25" />
          </div>
          <div className="text-center">
            <div className="text-[12px] font-bold text-muted-foreground/40">No trades yet</div>
            <div className="text-[10px] text-muted-foreground/25 mt-0.5">Launch a bot to begin trading</div>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          {/* Column headers */}
          <div className="grid px-5 py-2 border-b border-white/[0.04]"
            style={{ gridTemplateColumns: "100px 140px 70px 110px 110px 80px 90px 80px 60px" }}>
            {["Time", "Strategy", "Dir", "Entry", "Exit", "Size", "P&L", "Outcome", "Mode"].map(h => (
              <div key={h} className="text-[9px] font-black tracking-[0.18em] uppercase text-muted-foreground/30">{h}</div>
            ))}
          </div>

          {/* Rows */}
          <div className="max-h-[340px] overflow-y-auto">
            <AnimatePresence initial={false}>
              {tradeHistory.map((trade) => {
                const oc  = OUTCOME_CFG[trade.outcome];
                const dir = trade.direction === "long";
                const dirColor  = dir ? "#34d399" : "#f87171";
                const dirLabel  = dir ? "▲ LONG" : "▼ SHORT";
                const pnlColor  = trade.pnl >= 0 ? "#34d399" : "#f87171";
                const pnlSign   = trade.pnl >= 0 ? "+" : "";

                return (
                  <motion.div
                    key={trade.id}
                    initial={{ opacity: 0, x: -12, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: "auto" }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    <div className="grid px-5 py-2.5 border-b border-white/[0.025] hover:bg-white/[0.015] transition-colors items-center"
                      style={{ gridTemplateColumns: "100px 140px 70px 110px 110px 80px 90px 80px 60px" }}>

                      {/* Time */}
                      <div>
                        <div className="text-[10px] font-mono text-muted-foreground/60">{formatTime(trade.closedAt)}</div>
                        <div className="text-[8px] text-muted-foreground/30 mt-0.5">{formatDuration(trade.openedAt, trade.closedAt)}</div>
                      </div>

                      {/* Strategy */}
                      <div className="text-[9px] text-muted-foreground/55 font-medium leading-tight pr-2 truncate">
                        {trade.strategy}
                      </div>

                      {/* Direction */}
                      <div className="text-[10px] font-black" style={{ color: dirColor }}>{dirLabel}</div>

                      {/* Entry */}
                      <div className="text-[11px] font-bold tabular-nums text-white/70">
                        ${trade.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>

                      {/* Exit */}
                      <div className="text-[11px] font-bold tabular-nums text-white/70">
                        ${trade.exitPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>

                      {/* Size */}
                      <div className="text-[10px] font-mono text-muted-foreground/50">{trade.positionSize} BTC</div>

                      {/* P&L */}
                      <div className="text-[12px] font-black tabular-nums" style={{ color: pnlColor }}>
                        {pnlSign}${trade.pnl.toFixed(2)}
                      </div>

                      {/* Outcome badge */}
                      <div>
                        <span className="text-[8px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded"
                          style={{ background: oc.bg, border: `1px solid ${oc.border}`, color: oc.color }}>
                          {oc.label}
                        </span>
                      </div>

                      {/* Live / Sim */}
                      <div>
                        {trade.isLive ? (
                          <span className="text-[8px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded"
                            style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171" }}>
                            LIVE
                          </span>
                        ) : (
                          <span className="text-[8px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded"
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)" }}>
                            SIM
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export function DashboardPage() {
  const { data: stats, isLoading } = useGetDashboardStats({ query: { queryKey: getGetDashboardStatsQueryKey() } });
  const { bot, logs, pnlFlash, launch, pause, resume, stop } = useBotEngine();
  const { currentPrice } = useMarketData();

  const [selectedStrategy, setSelectedStrategy] = useState<Strategy>("Sweep & Reclaim");
  const [selectedDuration, setSelectedDuration] = useState<DurationKey>("1h");
  const remaining = useCountdown(bot?.status === "RUNNING" ? bot.endTime : null);

  const totalPnl = (stats?.pnlToday ?? 0) + (bot?.pnl ?? 0);
  const activeBots = bot && (bot.status === "RUNNING" || bot.status === "PAUSED") ? 1 : 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">

      {/* ── Market ticker ── */}
      <PriceTicker />

      {/* ── Liquidity & Order Flow Panel ── */}
      <LiquidityPanel />

      {/* ── Performance Memory Panel ── */}
      <PerformanceMemoryPanel />

      {/* ── Metric cards ── */}
      <motion.div className="grid gap-4 md:grid-cols-3" variants={container} initial="hidden" animate="show">

        {/* Balance */}
        <motion.div variants={cardItem} whileHover={{ y: -4, transition: { duration: 0.2 } }}>
          <div className="group relative rounded-2xl border border-white/[0.07] overflow-hidden transition-all duration-300 hover:border-primary/25 hover:shadow-[0_12px_48px_rgba(0,0,0,0.5)]"
            style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}>
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-muted-foreground">Total Balance</span>
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center">
                  <DollarSign size={14} className="text-primary" />
                </div>
              </div>
              {isLoading ? <Skeleton className="h-8 w-32" /> : (
                <div className="text-3xl font-black tracking-tight">${stats?.balance?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "0.00"}</div>
              )}
              <div className="flex items-center gap-1 mt-1.5">
                <ArrowUpRight size={12} className="text-emerald-400" />
                <span className="text-[12px] text-emerald-400 font-medium">Ready to deploy</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Active Bots */}
        <motion.div variants={cardItem} whileHover={{ y: -4, transition: { duration: 0.2 } }}>
          <div className={`group relative rounded-2xl border overflow-hidden transition-all duration-500 ${activeBots > 0 ? "border-primary/30 shadow-[0_0_40px_rgba(200,168,75,0.12)]" : "border-white/[0.07]"}`}
            style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}>
            <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent ${activeBots > 0 ? "via-primary/60" : "via-white/10"} to-transparent`} />
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-muted-foreground">Active Bots</span>
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${activeBots > 0 ? "bg-primary/20 border-primary/30" : "bg-primary/10 border-primary/15"}`}>
                  <Bot size={14} className="text-primary" />
                </div>
              </div>
              <div className="text-3xl font-black tracking-tight">{activeBots}</div>
              <div className="flex items-center gap-1.5 mt-1.5">
                {activeBots > 0 && (
                  <motion.div
                    className="w-2 h-2 rounded-full bg-emerald-400"
                    animate={{ opacity: [1, 0.3, 1], scale: [1, 0.85, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
                <span className={`text-[12px] font-medium ${activeBots > 0 ? "text-emerald-400" : "text-muted-foreground"}`}>
                  {activeBots > 0 ? `${bot!.strategy}` : "No active strategies"}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* P&L */}
        <motion.div variants={cardItem} whileHover={{ y: -4, transition: { duration: 0.2 } }}>
          <div className="group relative rounded-2xl border border-white/[0.07] overflow-hidden transition-all duration-300 hover:border-primary/25"
            style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}>
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-muted-foreground">P&L Today</span>
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center">
                  <TrendingUp size={14} className="text-primary" />
                </div>
              </div>
              <motion.div
                key={Math.round(totalPnl * 10)}
                className={`text-3xl font-black tracking-tight transition-colors duration-700 ${
                  pnlFlash === "up" ? "text-emerald-300" : pnlFlash === "down" ? "text-red-300" : "text-foreground"
                }`}
              >
                {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
              </motion.div>
              <div className="flex items-center gap-1 mt-1.5">
                {totalPnl >= 0
                  ? <ArrowUpRight size={12} className="text-emerald-400" />
                  : <ArrowDownRight size={12} className="text-red-400" />
                }
                <span className={`text-[12px] font-medium ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {bot ? `${bot.trades} trades executed` : "Awaiting bot activity"}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* ── Trade History Table ── */}
      <TradeHistoryTable />

      {/* ── Live Signal Widget ── */}
      <LiveSignalWidget />

      {/* ── Main grid: Bot section + Log ── */}
      <div className="grid md:grid-cols-3 gap-5">

        {/* Left 2/3: Bot Launcher OR Active Bot Card */}
        <div className="md:col-span-2 space-y-5">
          <AnimatePresence mode="wait">

            {/* Active Bot Card */}
            {bot && (bot.status === "RUNNING" || bot.status === "PAUSED") ? (
              <motion.div
                key="active-bot"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35 }}
              >
                <div className={`relative rounded-2xl border overflow-hidden ${
                  bot.status === "RUNNING"
                    ? "border-primary/30 shadow-[0_0_60px_rgba(200,168,75,0.1),0_0_30px_rgba(200,168,75,0.06)]"
                    : "border-amber-500/25"
                }`}
                  style={{ background: "linear-gradient(145deg, hsl(228 42% 9%) 0%, hsl(228 50% 6%) 100%)" }}>

                  {/* Animated gold top bar */}
                  <motion.div
                    className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent"
                    animate={bot.status === "RUNNING" ? { opacity: [0.6, 1, 0.6] } : { opacity: 0.3 }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                  />

                  <div className="p-6">
                    {/* Header row */}
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <div className="flex items-center gap-2.5 mb-1">
                          <motion.div
                            className={`w-2.5 h-2.5 rounded-full ${bot.status === "RUNNING" ? "bg-emerald-400" : "bg-amber-400"}`}
                            animate={{ opacity: bot.status === "RUNNING" ? [1, 0.3, 1] : 1, scale: bot.status === "RUNNING" ? [1, 0.8, 1] : 1 }}
                            transition={{ duration: 1.4, repeat: Infinity }}
                          />
                          <span className={`text-[12px] font-black tracking-widest uppercase ${bot.status === "RUNNING" ? "text-emerald-400" : "text-amber-400"}`}>
                            {bot.status}
                          </span>
                        </div>
                        <h3 className="text-[18px] font-black">{bot.strategy}</h3>
                        <p className="text-[12px] text-muted-foreground mt-0.5">{STRATEGY_DESC[bot.strategy]}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-1">Session Duration</div>
                        <div className="text-[13px] font-bold">{bot.durationLabel}</div>
                      </div>
                    </div>

                    {/* Metrics row */}
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="rounded-xl border border-white/[0.06] p-3.5 text-center"
                        style={{ background: "rgba(255,255,255,0.025)" }}>
                        <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2">Live P&L</div>
                        <motion.div
                          key={Math.round(bot.pnl * 10)}
                          initial={{ scale: 1.08 }}
                          animate={{ scale: 1 }}
                          transition={{ duration: 0.25 }}
                          className={`text-2xl font-black tabular-nums transition-colors duration-500 ${
                            pnlFlash === "up" ? "text-emerald-300" :
                            pnlFlash === "down" ? "text-red-300" :
                            bot.pnl >= 0 ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {bot.pnl >= 0 ? "+" : ""}${bot.pnl.toFixed(2)}
                        </motion.div>
                        {bot.realizedPnl !== bot.pnl && (
                          <div className="text-[9px] text-muted-foreground/40 mt-1 tabular-nums">
                            Realized: {bot.realizedPnl >= 0 ? "+" : ""}${bot.realizedPnl.toFixed(2)}
                          </div>
                        )}
                      </div>

                      <div className="rounded-xl border border-white/[0.06] p-3.5 text-center"
                        style={{ background: "rgba(255,255,255,0.025)" }}>
                        <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2">Trades</div>
                        <div className="text-2xl font-black tabular-nums">{bot.trades}</div>
                        <div className="text-[9px] text-muted-foreground/40 mt-1">closed</div>
                      </div>

                      <div className="rounded-xl border border-white/[0.06] p-3.5 text-center"
                        style={{ background: "rgba(255,255,255,0.025)" }}>
                        <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2">Time Left</div>
                        <div className="text-2xl font-black tabular-nums font-mono text-primary">
                          {bot.status === "RUNNING" ? formatCountdown(remaining) : "—"}
                        </div>
                      </div>
                    </div>

                    {/* Open position strip */}
                    {bot.openTrade ? (() => {
                      const t = bot.openTrade;
                      const unrealized = t.direction === "long"
                        ? (currentPrice - t.entryPrice) * t.positionSize
                        : (t.entryPrice - currentPrice) * t.positionSize;
                      const isGain = unrealized >= 0;
                      const distToTp = Math.abs(((t.direction === "long" ? t.takeProfit : t.takeProfit) - currentPrice) / currentPrice * 100);
                      const distToSl = Math.abs((t.stopLoss - currentPrice) / currentPrice * 100);
                      return (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mb-5 rounded-xl border px-4 py-3 flex items-center gap-4 flex-wrap"
                          style={{
                            borderColor: isGain ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)",
                            background:  isGain ? "rgba(52,211,153,0.04)" : "rgba(248,113,113,0.04)",
                          }}
                        >
                          {/* Direction badge */}
                          <div className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase shrink-0 ${
                            t.direction === "long"
                              ? "bg-emerald-400/15 text-emerald-400 border border-emerald-400/25"
                              : "bg-red-400/15 text-red-400 border border-red-400/25"
                          }`}>
                            {t.direction === "long" ? "▲ LONG" : "▼ SHORT"}
                          </div>

                          {/* Entry */}
                          <div className="text-center shrink-0">
                            <div className="text-[9px] font-bold tracking-[0.16em] uppercase text-muted-foreground/40 mb-0.5">Entry</div>
                            <div className="text-[13px] font-black tabular-nums">${t.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                          </div>

                          {/* Current */}
                          <div className="text-center shrink-0">
                            <div className="text-[9px] font-bold tracking-[0.16em] uppercase text-muted-foreground/40 mb-0.5">Current</div>
                            <div className="text-[13px] font-black tabular-nums">${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                          </div>

                          {/* TP */}
                          <div className="text-center shrink-0">
                            <div className="text-[9px] font-bold tracking-[0.16em] uppercase text-muted-foreground/40 mb-0.5">TP</div>
                            <div className="text-[13px] font-black tabular-nums text-emerald-400">${t.takeProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            <div className="text-[8px] text-muted-foreground/35">{distToTp.toFixed(2)}% away</div>
                          </div>

                          {/* SL */}
                          <div className="text-center shrink-0">
                            <div className="text-[9px] font-bold tracking-[0.16em] uppercase text-muted-foreground/40 mb-0.5">SL</div>
                            <div className="text-[13px] font-black tabular-nums text-red-400">${t.stopLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            <div className="text-[8px] text-muted-foreground/35">{distToSl.toFixed(2)}% away</div>
                          </div>

                          {/* Unrealized P&L */}
                          <div className="ml-auto text-right shrink-0">
                            <div className="text-[9px] font-bold tracking-[0.16em] uppercase text-muted-foreground/40 mb-0.5">Unrealized</div>
                            <motion.div
                              key={Math.round(unrealized * 100)}
                              initial={{ scale: 1.05 }}
                              animate={{ scale: 1 }}
                              className={`text-[18px] font-black tabular-nums ${isGain ? "text-emerald-400" : "text-red-400"}`}
                            >
                              {isGain ? "+" : ""}${unrealized.toFixed(2)}
                            </motion.div>
                            <div className="text-[9px] text-muted-foreground/35">{t.positionSize} BTC position</div>
                          </div>
                        </motion.div>
                      );
                    })() : (
                      <div className="mb-5 rounded-xl border border-white/[0.05] px-4 py-3 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 animate-pulse" />
                        <span className="text-[11px] text-muted-foreground/40">No open position — waiting for next signal</span>
                      </div>
                    )}

                    {/* Controls */}
                    <div className="flex gap-3">
                      {bot.status === "RUNNING" ? (
                        <Button onClick={pause} variant="outline" size="sm"
                          className="flex-1 h-10 text-[13px] font-bold border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/50 gap-2 transition-all">
                          <Pause size={14} /> Pause Bot
                        </Button>
                      ) : (
                        <Button onClick={resume} variant="outline" size="sm"
                          className="flex-1 h-10 text-[13px] font-bold border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/50 gap-2 transition-all">
                          <Play size={14} /> Resume
                        </Button>
                      )}
                      <Button onClick={stop} variant="outline" size="sm"
                        className="flex-1 h-10 text-[13px] font-bold border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 gap-2 transition-all">
                        <Square size={14} /> Stop Bot
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* Bot Launcher */
              <motion.div
                key="launcher"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35 }}
              >
                <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
                  style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}>
                  <div className="h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
                  <div className="p-6">
                    <div className="flex items-center gap-2.5 mb-6">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center">
                        <Zap size={16} className="text-primary" />
                      </div>
                      <div>
                        <h3 className="text-[15px] font-bold">Bot Launcher</h3>
                        <p className="text-[12px] text-muted-foreground">Select a strategy and activate GTPro's execution engine.</p>
                      </div>
                    </div>

                    {/* Strategy select */}
                    <div className="mb-5">
                      <div className="text-[11px] font-bold tracking-[0.16em] uppercase text-muted-foreground mb-3">Strategy</div>
                      <div className="grid gap-2">
                        {STRATEGIES.map(s => (
                          <motion.button
                            key={s}
                            onClick={() => setSelectedStrategy(s)}
                            whileHover={{ x: 2 }}
                            whileTap={{ scale: 0.99 }}
                            transition={{ duration: 0.15 }}
                            className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 ${
                              selectedStrategy === s
                                ? "border-primary/40 bg-primary/8 text-foreground"
                                : "border-white/[0.07] text-muted-foreground hover:border-white/[0.14] hover:text-foreground"
                            }`}
                            style={selectedStrategy === s ? {} : { background: "rgba(255,255,255,0.02)" }}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className={`text-[13px] font-bold ${selectedStrategy === s ? "text-primary" : ""}`}>{s}</div>
                                <div className="text-[11px] opacity-70 mt-0.5 leading-relaxed">{STRATEGY_DESC[s]}</div>
                              </div>
                              {selectedStrategy === s && (
                                <motion.div
                                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                                  className="w-2 h-2 rounded-full bg-primary shrink-0 ml-3"
                                />
                              )}
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Duration select */}
                    <div className="mb-6">
                      <div className="text-[11px] font-bold tracking-[0.16em] uppercase text-muted-foreground mb-3">Duration</div>
                      <div className="grid grid-cols-4 gap-2">
                        {DURATIONS.map(d => (
                          <motion.button
                            key={d}
                            onClick={() => setSelectedDuration(d)}
                            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                            className={`py-2.5 rounded-xl border text-[13px] font-bold transition-all duration-200 ${
                              selectedDuration === d
                                ? "border-primary/40 bg-primary/12 text-primary"
                                : "border-white/[0.07] text-muted-foreground hover:border-white/[0.14] hover:text-foreground"
                            }`}
                            style={{ background: selectedDuration === d ? undefined : "rgba(255,255,255,0.025)" }}
                          >
                            {d}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Launch */}
                    <motion.div whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        onClick={() => launch(selectedStrategy, selectedDuration)}
                        className="w-full h-12 text-[15px] font-black bg-primary text-primary-foreground hover:bg-primary/90 glow-btn transition-all duration-300 gap-2"
                      >
                        <Play size={16} fill="currentColor" /> Launch Bot
                      </Button>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* When bot is active, show a mini re-launch panel below */}
          {bot && (bot.status === "RUNNING" || bot.status === "PAUSED") && (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="rounded-xl border border-white/[0.06] p-4 flex items-center justify-between"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <Clock size={14} />
                <span>A bot session is currently active. Stop it to reconfigure and launch a new strategy.</span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Right 1/3: Activity Log */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.25 }}
        >
          <div className="rounded-2xl border border-white/[0.07] h-full flex flex-col"
            style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)", maxHeight: "520px" }}>
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.05] shrink-0">
              <h3 className="text-[13px] font-bold tracking-tight">Activity Log</h3>
              <div className="flex items-center gap-1.5">
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                />
                <span className="text-[10px] font-semibold tracking-widest uppercase text-emerald-400">Live</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <AnimatePresence initial={false}>
                {logs.map(entry => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -10, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: "auto" }}
                    transition={{ duration: 0.3 }}
                    className="flex items-start gap-2.5"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${LOG_COLORS[entry.type]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium leading-relaxed">{entry.message}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {entry.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
