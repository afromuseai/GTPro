import React from "react";
import { motion } from "framer-motion";
import { useLearning } from "@/engine/learning/learning-engine";
import { Trophy, TrendingDown, BarChart3, Activity, Target, Zap } from "lucide-react";

const cardItem = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4 } },
};
const container = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.07 } },
};

// ── Mini equity curve SVG ─────────────────────────────────────────────────────

function EquityCurve({ data }: { data: { equity: number }[] }) {
  if (data.length < 2) {
    return (
      <div className="h-28 flex items-center justify-center text-[11px] text-muted-foreground/30 italic">
        Building equity curve…
      </div>
    );
  }

  const W = 600, H = 112;
  const values = data.map(d => d.equity);
  const min    = Math.min(...values);
  const max    = Math.max(...values);
  const range  = max - min || 1;

  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 12) - 4;
    return [x, y] as [number, number];
  });

  // Smooth catmull-rom
  function catmull(pts: [number, number][]) {
    if (pts.length < 2) return "";
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
      const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
      const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
      const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`;
    }
    return d;
  }

  const linePath = catmull(pts);
  const last     = values[values.length - 1];
  const first    = values[0];
  const isUp     = last >= first;
  const lineColor = isUp ? "#34d399" : "#f87171";
  const areaPath  = `${linePath} L${W},${H} L0,${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28" preserveAspectRatio="none">
      <defs>
        <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={lineColor} stopOpacity="0.18" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
        <filter id="eqGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <path d={areaPath} fill="url(#equityFill)" />
      <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2" filter="url(#eqGlow)" strokeLinecap="round" />
      {/* Live dot */}
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4" fill={lineColor} />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="8" fill={lineColor} fillOpacity="0.2">
        <animate attributeName="r" values="4;10;4" dur="2s" repeatCount="indefinite" />
        <animate attributeName="fill-opacity" values="0.2;0;0.2" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

// ── Win rate ring ─────────────────────────────────────────────────────────────

function WinRing({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  const r   = 38;
  const circ = 2 * Math.PI * r;
  const dash = circ * rate;
  const color = pct >= 60 ? "#34d399" : pct >= 45 ? "#f59e0b" : "#f87171";
  return (
    <div className="relative flex items-center justify-center">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
        <circle cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 48 48)" style={{ filter: `drop-shadow(0 0 6px ${color}88)` }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-[20px] font-black tabular-nums" style={{ color }}>{pct}%</span>
        <span className="text-[8px] font-bold tracking-widest uppercase text-muted-foreground/40">Win Rate</span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function PerformancePage() {
  const learning = useLearning();

  const recentTrades = learning.tradeHistory.slice(0, 10);
  const totalPnl     = learning.tradeHistory.reduce((s, t) => s + t.pnl, 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <h1 className="text-[22px] font-black tracking-tight">Performance Memory</h1>
        <p className="text-[13px] text-muted-foreground/50 mt-0.5">
          Self-improving learning engine — outcomes drive future signal confidence
        </p>
      </motion.div>

      {/* ── Top stats ── */}
      <motion.div className="grid grid-cols-4 gap-4" variants={container} initial="hidden" animate="show">
        {[
          { label: "Total Trades",    value: learning.totalTrades,                    color: "#c8a84b", icon: Activity },
          { label: "Win Rate",        value: `${(learning.overallWinRate*100).toFixed(1)}%`, color: learning.overallWinRate >= 0.55 ? "#34d399" : "#f87171", icon: Target },
          { label: "Total PnL",       value: `${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`, color: totalPnl >= 0 ? "#34d399" : "#f87171", icon: TrendingDown },
          { label: "Best Strategy",   value: learning.bestStrategy.replace(" & ", " & ").split(" ")[0] + "…", color: "#a78bfa", icon: Trophy },
        ].map(({ label, value, color, icon: Icon }) => (
          <motion.div key={label} variants={cardItem}>
            <div className="rounded-2xl border border-white/[0.07] p-5"
              style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground/40">{label}</span>
                <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                  <Icon size={12} style={{ color }} />
                </div>
              </div>
              <div className="text-[20px] font-black tabular-nums truncate" style={{ color }}>{value}</div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Equity curve + Win ring ── */}
      <motion.div className="grid grid-cols-3 gap-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>

        {/* Equity curve */}
        <div className="col-span-2 rounded-2xl border border-white/[0.07] overflow-hidden"
          style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}>
          <div className="px-5 pt-4 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[12px] font-bold">Equity Curve</span>
                <span className="text-[10px] text-muted-foreground/40 ml-2">Cumulative trade outcomes</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[9px] text-muted-foreground/40 font-bold uppercase tracking-widest">Live</span>
              </div>
            </div>
          </div>
          <div className="px-2 pb-3">
            <EquityCurve data={learning.equityCurve} />
          </div>
        </div>

        {/* Win rate ring */}
        <div className="rounded-2xl border border-white/[0.07] p-5 flex flex-col items-center justify-center gap-4"
          style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}>
          <WinRing rate={learning.overallWinRate} />
          <div className="text-center space-y-1.5">
            <div className="flex items-center gap-2 justify-center">
              <div className="w-2 h-2 rounded-full bg-emerald-400/60" />
              <span className="text-[10px] text-muted-foreground/50">Best: <span className="text-emerald-400 font-bold">{learning.bestStrategy}</span></span>
            </div>
            <div className="flex items-center gap-2 justify-center">
              <div className="w-2 h-2 rounded-full bg-red-400/60" />
              <span className="text-[10px] text-muted-foreground/50">Worst: <span className="text-red-400 font-bold">{learning.worstCondition}</span></span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Strategy performance table ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}
        className="rounded-2xl border border-white/[0.07] overflow-hidden"
        style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}>
        <div className="px-5 py-3.5 border-b border-white/[0.05] flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center">
            <BarChart3 size={12} className="text-primary" />
          </div>
          <span className="text-[12px] font-bold">Strategy Performance</span>
          <span className="text-[10px] text-muted-foreground/40 ml-1">Memory-weighted reliability scores</span>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {learning.strategyStats.length === 0 ? (
            <div className="px-5 py-8 text-center text-[12px] text-muted-foreground/30 italic">No strategy data yet</div>
          ) : learning.strategyStats.map(s => {
            const wr      = Math.round(s.winRate * 100);
            const barW    = `${s.reliabilityScore}%`;
            const barColor = s.reliabilityScore >= 65 ? "#34d399" : s.reliabilityScore >= 45 ? "#f59e0b" : "#f87171";
            return (
              <div key={s.strategy} className="px-5 py-3.5 grid grid-cols-5 gap-4 items-center">
                <div className="col-span-1">
                  <div className="text-[12px] font-bold truncate">{s.strategy}</div>
                  <div className="text-[10px] text-muted-foreground/40">{s.trades} trades</div>
                </div>
                <div className="text-center">
                  <div className="text-[11px] font-black" style={{ color: wr >= 55 ? "#34d399" : "#f87171" }}>{wr}%</div>
                  <div className="text-[9px] text-muted-foreground/35 uppercase tracking-widest">Win Rate</div>
                </div>
                <div className="text-center">
                  <div className={`text-[11px] font-black ${s.avgPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {s.avgPnl >= 0 ? "+" : ""}${s.avgPnl.toFixed(1)}
                  </div>
                  <div className="text-[9px] text-muted-foreground/35 uppercase tracking-widest">Avg PnL</div>
                </div>
                <div className="text-center">
                  <div className="text-[11px] font-black text-red-400/70">${s.maxDrawdown.toFixed(0)}</div>
                  <div className="text-[9px] text-muted-foreground/35 uppercase tracking-widest">Max DD</div>
                </div>
                <div className="col-span-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-muted-foreground/40 uppercase tracking-widest">Reliability</span>
                    <span className="text-[9px] font-black" style={{ color: barColor }}>{s.reliabilityScore}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <motion.div animate={{ width: barW }} transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full rounded-full" style={{ background: barColor }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* ── Memory weights ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}
        className="rounded-2xl border border-white/[0.07] overflow-hidden"
        style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}>
        <div className="px-5 py-3.5 border-b border-white/[0.05] flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center">
            <Zap size={12} className="text-primary" />
          </div>
          <span className="text-[12px] font-bold">Adaptive Memory Weights</span>
          <span className="text-[10px] text-muted-foreground/40 ml-1">Applied to ABF signal confidence</span>
        </div>
        <div className="grid grid-cols-4 divide-x divide-white/[0.04] px-0">
          {[
            { label: "Sweep/Absorption", val: learning.memoryWeight.sweepAbsorption },
            { label: "High Volatility",  val: learning.memoryWeight.highVolatility },
            { label: "Trend Aligned",    val: learning.memoryWeight.trendAligned },
            { label: "Buy Imbalance",    val: learning.memoryWeight.buyImbalance },
          ].map(({ label, val }) => {
            const color  = val > 3 ? "#34d399" : val < -3 ? "#f87171" : "rgba(255,255,255,0.4)";
            const sign   = val > 0 ? "+" : "";
            const barPct = Math.abs(val) / 15 * 100;
            return (
              <div key={label} className="px-4 py-4">
                <div className="text-[9px] font-black tracking-[0.16em] uppercase text-muted-foreground/35 mb-2">{label}</div>
                <div className="text-[18px] font-black tabular-nums" style={{ color }}>{sign}{val}</div>
                <div className="mt-2 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${barPct}%`, background: color }} />
                </div>
                <div className="text-[9px] text-muted-foreground/30 mt-1">
                  {Math.abs(val) < 3 ? "Neutral" : val > 0 ? "Boosting confidence" : "Reducing confidence"}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* ── Recent trades ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }}
        className="rounded-2xl border border-white/[0.07] overflow-hidden"
        style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}>
        <div className="px-5 py-3.5 border-b border-white/[0.05]">
          <span className="text-[12px] font-bold">Recent Trade Outcomes</span>
          <span className="text-[10px] text-muted-foreground/40 ml-2">Last 10 trades in learning memory</span>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {recentTrades.length === 0 ? (
            <div className="px-5 py-8 text-center text-[12px] text-muted-foreground/30 italic">No trades recorded yet</div>
          ) : recentTrades.map(t => (
            <div key={t.tradeId} className="px-5 py-2.5 grid grid-cols-6 gap-3 items-center text-[11px]">
              <div>
                <span className={`px-1.5 py-0.5 rounded font-black text-[9px] tracking-wider ${t.signalType === "BUY" ? "bg-emerald-400/15 text-emerald-400" : "bg-red-400/15 text-red-400"}`}>
                  {t.signalType}
                </span>
              </div>
              <div className="font-mono text-muted-foreground/50 text-[10px]">${t.entryPrice.toFixed(0)}</div>
              <div className="text-muted-foreground/50 truncate text-[10px]">{t.strategy.split(" ")[0]}</div>
              <div className="text-[10px]">
                <span className={`font-bold ${t.volatilityRegime === "high" ? "text-red-400" : t.volatilityRegime === "low" ? "text-emerald-400" : "text-amber-400"}`}>
                  {t.volatilityRegime}
                </span>
                <span className="text-muted-foreground/30"> vol</span>
              </div>
              <div className={`font-black tabular-nums ${t.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
              </div>
              <div className="flex justify-end">
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${t.won ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"}`}>
                  {t.won ? "WIN" : "LOSS"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
