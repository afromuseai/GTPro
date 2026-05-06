import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TradeRecord {
  tradeId:           string;
  botId:             string;
  symbol:            string;
  signalType:        "BUY" | "SELL";
  strategy:          string;
  entryPrice:        number;
  exitPrice:         number;
  pnl:               number;
  roi:               number;
  duration:          number;
  won:               boolean;
  confidenceAtEntry: number;
  // Context at time of trade
  volatilityRegime:  "low" | "medium" | "high";
  liquidityState:    "sweep" | "absorption" | "normal";
  imbalance:         "buy" | "sell" | "neutral";
  trend:             "up" | "down" | "sideways";
  timestamp:         Date;
}

export interface StrategyStats {
  strategy:        string;
  trades:          number;
  wins:            number;
  winRate:         number;
  avgPnl:          number;
  totalPnl:        number;
  maxDrawdown:     number;
  reliabilityScore: number;
}

export interface MemoryWeight {
  // Context key → adjustment factor (-15 to +15)
  sweepAbsorption:   number;
  highVolatility:    number;
  lowVolatility:     number;
  trendAligned:      number;
  trendAgainst:      number;
  buyImbalance:      number;
  sellImbalance:     number;
}

export interface LearningContext {
  tradeHistory:        TradeRecord[];
  strategyStats:       StrategyStats[];
  memoryWeight:        MemoryWeight;
  equityCurve:         { time: Date; equity: number }[];
  overallWinRate:      number;
  totalTrades:         number;
  bestStrategy:        string;
  worstCondition:      string;
  // Adaptive confidence adjustment based on recent history
  getConfidenceAdjustment: (params: {
    strategy:          string;
    volatilityRegime:  "low" | "medium" | "high";
    liquidityState:    "sweep" | "absorption" | "normal";
    imbalance:         "buy" | "sell" | "neutral";
    trend:             "up" | "down" | "sideways";
  }) => number;
  // Record a new trade outcome
  recordTrade: (trade: Omit<TradeRecord, "tradeId" | "timestamp" | "won" | "roi">) => void;
  // Get similar historical context for AI prompt enrichment
  getSimilarContextSummary: (params: {
    strategy:         string;
    volatilityRegime: "low" | "medium" | "high";
    liquidityState:   "sweep" | "absorption" | "normal";
    trend:            "up" | "down" | "sideways";
  }) => string;
}

// ── Storage key ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "gtpro_learning_v1";
const MAX_HISTORY  = 200;

function loadFromStorage(): TradeRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as TradeRecord[];
    return arr.map(t => ({ ...t, timestamp: new Date(t.timestamp) }));
  } catch { return []; }
}

function saveToStorage(history: TradeRecord[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_HISTORY))); } catch { /* ignore */ }
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_WEIGHT: MemoryWeight = {
  sweepAbsorption: 0, highVolatility: 0, lowVolatility: 0,
  trendAligned: 0, trendAgainst: 0, buyImbalance: 0, sellImbalance: 0,
};

const DEFAULT_CTX: LearningContext = {
  tradeHistory: [], strategyStats: [], memoryWeight: DEFAULT_WEIGHT,
  equityCurve: [], overallWinRate: 0, totalTrades: 0,
  bestStrategy: "—", worstCondition: "—",
  getConfidenceAdjustment: () => 0,
  recordTrade: () => {},
  getSimilarContextSummary: () => "No historical data available — using neutral weights.",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeStrategyStats(history: TradeRecord[]): StrategyStats[] {
  const map = new Map<string, TradeRecord[]>();
  for (const t of history) {
    const arr = map.get(t.strategy) ?? [];
    arr.push(t);
    map.set(t.strategy, arr);
  }
  return Array.from(map.entries()).map(([strategy, trades]) => {
    const wins      = trades.filter(t => t.won).length;
    const winRate   = trades.length ? wins / trades.length : 0;
    const avgPnl    = trades.length ? trades.reduce((s, t) => s + t.pnl, 0) / trades.length : 0;
    const totalPnl  = trades.reduce((s, t) => s + t.pnl, 0);
    // Max drawdown: largest peak-to-trough over cumulative PnL
    let peak = 0, trough = 0, maxDD = 0, cum = 0;
    for (const t of trades) {
      cum += t.pnl;
      if (cum > peak) { peak = cum; trough = cum; }
      if (cum < trough) { trough = cum; maxDD = Math.max(maxDD, peak - trough); }
    }
    const reliabilityScore = Math.round(winRate * 60 + Math.min(20, Math.max(0, avgPnl / 5)) + (trades.length >= 5 ? 20 : trades.length * 4));
    return { strategy, trades: trades.length, wins, winRate, avgPnl, totalPnl, maxDrawdown: maxDD, reliabilityScore };
  });
}

function computeMemoryWeight(history: TradeRecord[]): MemoryWeight {
  if (history.length < 3) return DEFAULT_WEIGHT;
  const recent = history.slice(0, 30);

  function winRateFor(filter: (t: TradeRecord) => boolean): number {
    const subset = recent.filter(filter);
    if (subset.length < 2) return 0.5;
    return subset.filter(t => t.won).length / subset.length;
  }

  const toAdj = (wr: number) => Math.round((wr - 0.5) * 30); // -15 to +15

  return {
    sweepAbsorption: toAdj(winRateFor(t => t.liquidityState !== "normal")),
    highVolatility:  toAdj(winRateFor(t => t.volatilityRegime === "high")),
    lowVolatility:   toAdj(winRateFor(t => t.volatilityRegime === "low")),
    trendAligned:    toAdj(winRateFor(t => (t.signalType === "BUY" && t.trend === "up") || (t.signalType === "SELL" && t.trend === "down"))),
    trendAgainst:    toAdj(winRateFor(t => (t.signalType === "BUY" && t.trend === "down") || (t.signalType === "SELL" && t.trend === "up"))),
    buyImbalance:    toAdj(winRateFor(t => t.imbalance === "buy")),
    sellImbalance:   toAdj(winRateFor(t => t.imbalance === "sell")),
  };
}

function buildEquityCurve(history: TradeRecord[]): { time: Date; equity: number }[] {
  let equity = 10000;
  return [...history].reverse().map(t => {
    equity += t.pnl;
    return { time: t.timestamp, equity: +equity.toFixed(2) };
  });
}

// ── Context ───────────────────────────────────────────────────────────────────

export const LearningContext = createContext<LearningContext>(DEFAULT_CTX);

export function LearningProvider({ children }: { children: React.ReactNode }) {
  const [tradeHistory, setTradeHistory] = useState<TradeRecord[]>(() => loadFromStorage());

  // ── Derived state ──────────────────────────────────────────────────────────

  const strategyStats   = computeStrategyStats(tradeHistory);
  const memoryWeight    = computeMemoryWeight(tradeHistory);
  const equityCurve     = buildEquityCurve(tradeHistory);
  const totalTrades     = tradeHistory.length;
  const overallWinRate  = totalTrades ? tradeHistory.filter(t => t.won).length / totalTrades : 0;
  const bestStrategy    = strategyStats.sort((a, b) => b.reliabilityScore - a.reliabilityScore)[0]?.strategy ?? "—";

  // Worst condition = context with most losses
  const worstCondition = (() => {
    if (tradeHistory.length < 3) return "—";
    const recent = tradeHistory.slice(0, 20);
    const highVolLosses = recent.filter(t => t.volatilityRegime === "high" && !t.won).length;
    const trendAgainst  = recent.filter(t => ((t.signalType === "BUY" && t.trend === "down") || (t.signalType === "SELL" && t.trend === "up")) && !t.won).length;
    if (highVolLosses >= trendAgainst && highVolLosses > 1) return "High Volatility";
    if (trendAgainst > 1) return "Counter-Trend";
    return "—";
  })();

  // ── Adaptive confidence adjustment ────────────────────────────────────────

  const getConfidenceAdjustment = useCallback((params: {
    strategy:          string;
    volatilityRegime:  "low" | "medium" | "high";
    liquidityState:    "sweep" | "absorption" | "normal";
    imbalance:         "buy" | "sell" | "neutral";
    trend:             "up" | "down" | "sideways";
  }): number => {
    if (tradeHistory.length < 3) return 0;
    let adj = 0;

    // Strategy-level reliability
    const ss = strategyStats.find(s => s.strategy === params.strategy);
    if (ss && ss.trades >= 3) {
      adj += Math.round((ss.winRate - 0.5) * 16); // -8 to +8
    }

    // Memory weights for context
    if (params.liquidityState !== "normal") adj += Math.round(memoryWeight.sweepAbsorption * 0.5);
    if (params.volatilityRegime === "high")  adj += Math.round(memoryWeight.highVolatility  * 0.5);
    if (params.volatilityRegime === "low")   adj += Math.round(memoryWeight.lowVolatility   * 0.5);
    if (params.imbalance === "buy")          adj += Math.round(memoryWeight.buyImbalance     * 0.4);
    if (params.imbalance === "sell")         adj += Math.round(memoryWeight.sellImbalance    * 0.4);

    return Math.max(-15, Math.min(15, adj));
  }, [tradeHistory, strategyStats, memoryWeight]);

  // ── Similar context summary for AI prompt ─────────────────────────────────

  const getSimilarContextSummary = useCallback((params: {
    strategy:         string;
    volatilityRegime: "low" | "medium" | "high";
    liquidityState:   "sweep" | "absorption" | "normal";
    trend:            "up" | "down" | "sideways";
  }): string => {
    if (tradeHistory.length < 3) return "No historical data — using neutral weights.";

    const similar = tradeHistory.filter(t =>
      t.strategy === params.strategy ||
      t.volatilityRegime === params.volatilityRegime ||
      t.liquidityState === params.liquidityState
    ).slice(0, 20);

    if (similar.length === 0) return "No similar historical trades found — using neutral weights.";

    const wins    = similar.filter(t => t.won).length;
    const wr      = (wins / similar.length * 100).toFixed(0);
    const avgPnl  = (similar.reduce((s, t) => s + t.pnl, 0) / similar.length).toFixed(2);
    const ss      = strategyStats.find(s => s.strategy === params.strategy);
    const ssWr    = ss ? `${(ss.winRate * 100).toFixed(0)}%` : "unknown";
    const adj     = getConfidenceAdjustment({ ...params, imbalance: "neutral" });
    const adjStr  = adj > 0 ? `+${adj}` : `${adj}`;

    return `Historical context (last ${similar.length} similar trades): ${wr}% win rate, avg PnL $${avgPnl}. Strategy "${params.strategy}" historical win rate: ${ssWr}. Volatility regime "${params.volatilityRegime}" + liquidity "${params.liquidityState}". Confidence adjustment: ${adjStr}. Adjust recommendation based on historical performance context.`;
  }, [tradeHistory, strategyStats, getConfidenceAdjustment]);

  // ── Record trade ──────────────────────────────────────────────────────────

  const recordTrade = useCallback((trade: Omit<TradeRecord, "tradeId" | "timestamp" | "won" | "roi">) => {
    const won = trade.pnl > 0;
    const roi = trade.entryPrice > 0 ? (trade.pnl / (trade.entryPrice * 0.01)) : 0;
    const record: TradeRecord = {
      ...trade,
      tradeId:   crypto.randomUUID(),
      timestamp: new Date(),
      won,
      roi: +roi.toFixed(4),
    };
    setTradeHistory(prev => {
      const next = [record, ...prev].slice(0, MAX_HISTORY);
      saveToStorage(next);
      return next;
    });
  }, []);

  // ── Seed some initial trades for demo realism ─────────────────────────────

  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    if (tradeHistory.length > 0) return; // already has data

    const strategies  = ["Sweep & Reclaim", "Absorption Reversal", "Void Continuation"] as const;
    const volRegimes  = ["low", "medium", "high"] as const;
    const liqStates   = ["sweep", "absorption", "normal"] as const;
    const imbalances  = ["buy", "sell", "neutral"] as const;
    const trends      = ["up", "down", "sideways"] as const;

    const seed: Omit<TradeRecord, "tradeId" | "timestamp" | "won" | "roi">[] = Array.from({ length: 30 }, (_, i) => {
      const strategy = strategies[i % 3];
      const vol      = volRegimes[Math.floor(Math.random() * 3)];
      const liq      = liqStates[Math.floor(Math.random() * 3)];
      const trend    = trends[Math.floor(Math.random() * 3)];
      const sigType  = Math.random() > 0.5 ? "BUY" : "SELL" as "BUY" | "SELL";
      const entry    = 93000 + Math.random() * 4000;
      // Sweep+absorption → higher win rate; high vol → lower
      const winProb  = liq !== "normal" ? 0.72 : vol === "high" ? 0.42 : 0.55;
      const won      = Math.random() < winProb;
      const pnl      = won ? Math.random() * 90 + 10 : -(Math.random() * 60 + 5);
      return {
        botId: "ABF", symbol: "BTC/USDT", signalType: sigType, strategy,
        entryPrice: entry, exitPrice: entry + (won ? 80 : -50),
        pnl: +pnl.toFixed(2), duration: Math.floor(Math.random() * 300 + 60),
        liquidityContext: {}, volatilityContext: {},
        confidenceAtEntry: Math.floor(Math.random() * 20 + 68),
        volatilityRegime: vol, liquidityState: liq,
        imbalance: imbalances[Math.floor(Math.random() * 3)], trend,
      };
    });

    const now = Date.now();
    const records: TradeRecord[] = seed.map((t, i) => ({
      ...t, tradeId: crypto.randomUUID(), won: t.pnl > 0,
      roi: +(t.pnl / (t.entryPrice * 0.01)).toFixed(4),
      timestamp: new Date(now - (seed.length - i) * 7 * 60_000),
    }));

    setTradeHistory(records);
    saveToStorage(records);
  }, []);

  const value: LearningContext = {
    tradeHistory, strategyStats, memoryWeight, equityCurve,
    overallWinRate, totalTrades, bestStrategy, worstCondition,
    getConfidenceAdjustment, recordTrade, getSimilarContextSummary,
  };

  return (
    <LearningContext.Provider value={value}>
      {children}
    </LearningContext.Provider>
  );
}

export function useLearning() {
  return useContext(LearningContext);
}
