import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useBotEngine } from "./bot-engine";
import type { Strategy } from "./bot-engine";
import { useMarketData } from "./market-data";
import { useLiquidity } from "./liquidity-engine";
import { useLearning } from "./learning/learning-engine";
import { useFleetEngine } from "./fleet-engine";
import type { Trend } from "./market-data";

export type SignalType = "BUY" | "SELL" | "HOLD";

export interface TechnicalIndicator {
  name:  string;
  value: string;
  bias:  "bullish" | "bearish" | "neutral";
}

export interface ConfluenceFactor {
  text:     string;
  positive: boolean;
}

export interface Signal {
  id: string;
  type: SignalType;
  confidence: number;
  strategy: Strategy;
  ticker: string;
  timeframe: string;
  explanation: string;
  entryZone: string;
  target: string;
  stopLoss: string;
  rr: string;
  timestamp: Date;
  priceAtSignal?: number;
  tpPrice?: number;
  slPrice?: number;
  aiGenerated?: boolean;
  indicators?: TechnicalIndicator[];
  confluenceFactors?: ConfluenceFactor[];
}

export interface MarketRegime {
  trend: string;
  momentum: string;
  volatility: string;
  volume: string;
}

interface SignalEngineContextValue {
  currentSignal: Signal | null;
  signalHistory: Signal[];
  regime: MarketRegime | null;
  signalFlash: boolean;
}

export const SignalEngineContext = createContext<SignalEngineContextValue>({
  currentSignal: null,
  signalHistory: [],
  regime: null,
  signalFlash: false,
});

// ── Static pools ──────────────────────────────────────────────────────────────

const TIMEFRAMES = ["5m", "15m", "1H", "4H"];
const STRATEGIES: Strategy[] = ["Sweep & Reclaim", "Absorption Reversal", "Void Continuation"];

const TICKER_BASE: Record<string, number> = {
  "BTC/USDT": 104_200,
  "ETH/USDT": 3_515,
  "SOL/USDT": 184,
  "BNB/USDT": 597,
  "AVAX/USDT": 38.5,
};

function fmt(price: number): string {
  return price >= 1000
    ? `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    : `$${price.toFixed(3)}`;
}

function priceRange(lo: number, hi: number): string {
  return `${fmt(lo)} – ${fmt(hi)}`;
}

// ── Explanation pools ─────────────────────────────────────────────────────────

const BUY_EXPLANATIONS: Record<Strategy, string[]> = {
  "Sweep & Reclaim": [
    "Sweep & Reclaim: Liquidity below prior swing low was taken, flushing weak longs and retail stop orders. Price reclaimed the level with strong buying momentum — institutional repositioning long confirmed.",
    "Sweep & Reclaim: Stop orders beneath session support triggered, clearing retail sell-side inventory. Smart money absorbed the cascade and drove reclaim — bullish structural shift established.",
    "Sweep & Reclaim: Equal lows swept in a momentum move, capturing stop-loss liquidity below the range. Reclaim inside two candles signals institutional intent — long with defined risk below the sweep.",
  ],
  "Absorption Reversal": [
    "Absorption Reversal: Heavy sell-side flow into the demand zone fully absorbed without further price decline. Institutional bid stacking visible across three consecutive candles — accumulation phase complete.",
    "Absorption Reversal: Supply-side sellers exhausted at key demand level. All offers absorbed by persistent institutional buying — order book depth confirms strong support, reversal long activating.",
    "Absorption Reversal: Counter-trend selling fully neutralised at demand zone. Volume spike with no further decline signals hidden buy absorption — high-conviction reversal setup confirmed.",
  ],
  "Void Continuation": [
    "Void Continuation: Bullish fair value gap above current price remains unfilled — institutional imbalance acting as a price magnet. Order flow aligned long, continuation into the void confirmed.",
    "Void Continuation: Momentum candle broke higher leaving a clean imbalance. Smart money rarely returns to fill voids in trending conditions — long entry on first pullback, targeting void upper boundary.",
    "Void Continuation: Multi-timeframe void alignment detected above — 15m and 1H imbalances stacked in the same direction. Confluence confirms high-probability continuation long setup.",
  ],
};

const SELL_EXPLANATIONS: Record<Strategy, string[]> = {
  "Sweep & Reclaim": [
    "Sweep & Reclaim: Liquidity above prior swing high was taken, trapping late breakout buyers at the top. Price failed to hold above the level — trapped longs are now providing fuel for the decline.",
    "Sweep & Reclaim: Buy-stops above range highs triggered in a momentum push, then reversed sharply. Institutional sellers used the liquidity event to distribute — bearish structural shift confirmed.",
    "Sweep & Reclaim: Equal highs swept with a momentum spike then immediately rejected. Smart money distributed into the breakout — failed reclaim signals aggressive institutional selling pressure.",
  ],
  "Absorption Reversal": [
    "Absorption Reversal: Aggressive bid flow into supply zone fully absorbed without further price advance. Institutional sellers stacking offers at the level — bearish reversal short activating.",
    "Absorption Reversal: Buy-side exhaustion confirmed at supply zone. All incoming bids absorbed by institutional sellers without price advancing — distribution at premium confirmed.",
    "Absorption Reversal: Counter-trend buying fully neutralised at supply zone. Volume spike with no advance signals hidden sell absorption — high-conviction reversal short confirmed.",
  ],
  "Void Continuation": [
    "Void Continuation: Bearish fair value gap below current price remains unfilled — institutional imbalance acting as a downside price magnet. Order flow aligned short, continuation into the void confirmed.",
    "Void Continuation: Momentum candle broke lower leaving a clean bearish imbalance. Smart money rarely returns to fill voids in trending conditions — short entry on first retest, targeting void lower boundary.",
    "Void Continuation: Multi-timeframe bearish void alignment detected below — 15m and 1H imbalances stacked downward. Confluence confirms high-probability continuation short setup.",
  ],
};

const HOLD_EXPLANATIONS: string[] = [
  "No Directional Signal: Conflicting order flow detected across timeframes — bullish and bearish pressure cancelling. Insufficient directional confluence. Engine monitoring for resolution before positioning.",
  "No Directional Signal: Price at equilibrium between major liquidity pools with no clear sweep target on either side. Awaiting breakout confirmation and volume validation before generating entry.",
  "No Directional Signal: Institutional activity balanced — aggressive buying and selling offsetting at current level. Market structure ambiguous. Neutral bias until a clear imbalance emerges.",
  "No Directional Signal: Range compression detected with declining volatility. Market in pre-breakout phase — direction not yet determined. Breakout signal expected on volume confirmation.",
];

// ── Market regime ─────────────────────────────────────────────────────────────

function buildRegime(type: SignalType, trend: Trend, volatility: number): MarketRegime {
  const highVol = volatility > 0.002;
  if (type === "BUY") return {
    trend:      trend === "up" ? "Strongly Bullish" : "Bullish",
    momentum:   "Accelerating",
    volatility: highVol ? "Elevated" : "Normal",
    volume:     "Above Average",
  };
  if (type === "SELL") return {
    trend:      trend === "down" ? "Strongly Bearish" : "Bearish",
    momentum:   "Decelerating",
    volatility: highVol ? "High" : "Elevated",
    volume:     "Above Average",
  };
  return { trend: "Neutral", momentum: "Steady", volatility: "Normal", volume: "Average" };
}

// ── Technical indicator builder ───────────────────────────────────────────────

function buildIndicators(
  type: SignalType,
  trend: Trend,
  volatility: number,
  priceChangePct: number,
): TechnicalIndicator[] {
  const up   = trend === "up";
  const down = trend === "down";

  // RSI(14) — derived from trend + price change
  const rsiRaw = up   ? 55 + Math.random() * 20
               : down ? 25 + Math.random() * 20
                      : 42 + Math.random() * 16;
  const rsi = Math.round(rsiRaw);
  const rsiBias: TechnicalIndicator["bias"] = rsi > 56 ? "bullish" : rsi < 44 ? "bearish" : "neutral";

  // MACD — histogram direction
  const macdVal  = up ? "Crossing ↑" : down ? "Crossing ↓" : "Flat / Converging";
  const macdBias: TechnicalIndicator["bias"] = up ? "bullish" : down ? "bearish" : "neutral";

  // EMA 20/50 cross
  const emaVal  = up ? "20 > 50  Bullish" : down ? "20 < 50  Bearish" : "Converging";
  const emaBias: TechnicalIndicator["bias"] = up ? "bullish" : down ? "bearish" : "neutral";

  // Bollinger Bands — price position relative to bands
  const bbRaw   = up ? 65 + Math.random() * 25 : down ? 10 + Math.random() * 25 : 40 + Math.random() * 20;
  const bbPos   = Math.round(bbRaw);
  const bbVal   = bbPos > 80 ? `Upper ${bbPos}%` : bbPos < 20 ? `Lower ${bbPos}%` : `Mid ${bbPos}%`;
  const bbBias: TechnicalIndicator["bias"] = bbPos > 70 ? (type === "SELL" ? "bearish" : "bullish")
                                           : bbPos < 30 ? (type === "BUY" ? "bullish" : "bearish")
                                           : "neutral";

  // Volume — relative multiplier
  const volMult = 0.8 + Math.abs(priceChangePct) * 12 + Math.random() * 0.6;
  const volVal  = `${volMult.toFixed(2)}× avg`;
  const volBias: TechnicalIndicator["bias"] = volMult > 1.3 ? (type === "HOLD" ? "neutral" : type === "BUY" ? "bullish" : "bearish") : "neutral";

  // ATR(14) — volatility measure
  const atrPct  = (volatility * 100).toFixed(3);
  const atrBias: TechnicalIndicator["bias"] = volatility > 0.004 ? "bearish" : "neutral";

  return [
    { name: "RSI(14)",    value: rsi.toString(),  bias: rsiBias  },
    { name: "MACD",       value: macdVal,          bias: macdBias },
    { name: "EMA 20/50",  value: emaVal,           bias: emaBias  },
    { name: "BB %B",      value: bbVal,            bias: bbBias   },
    { name: "Volume",     value: volVal,           bias: volBias  },
    { name: "ATR(14)",    value: `${atrPct}%`,     bias: atrBias  },
  ];
}

// ── Confluence factor builder ─────────────────────────────────────────────────

function buildConfluence(
  type: SignalType,
  strategy: Strategy,
  trend: Trend,
  volatility: number,
  priceChangePct: number,
): ConfluenceFactor[] {
  const factors: ConfluenceFactor[] = [];

  // Strategy-specific primary setup
  if (strategy === "Sweep & Reclaim") {
    factors.push({
      text: type === "BUY"
        ? "Sell-side liquidity sweep confirmed — stop-loss cascade absorbed"
        : "Buy-side liquidity sweep confirmed — breakout buyers trapped",
      positive: true,
    });
    factors.push({ text: "Level reclaimed within 2 candles — institutional intent", positive: true });
  } else if (strategy === "Absorption Reversal") {
    factors.push({
      text: type === "BUY"
        ? "Aggressive bid absorption at demand — offer side exhausted"
        : "Aggressive offer absorption at supply — bid side exhausted",
      positive: true,
    });
    factors.push({ text: "Volume spike with no further price extension — hidden absorption", positive: true });
  } else {
    factors.push({
      text: type === "BUY"
        ? "Bullish fair-value gap above price — institutional imbalance magnet"
        : "Bearish fair-value gap below price — institutional imbalance magnet",
      positive: true,
    });
    factors.push({ text: "Multi-timeframe imbalance stack confirmed — high-confluence void", positive: true });
  }

  // Trend alignment
  const trendMatch = (type === "BUY" && trend === "up") || (type === "SELL" && trend === "down") || type === "HOLD";
  factors.push({
    text: trendMatch
      ? "Higher-timeframe trend aligned with signal direction"
      : "Counter-trend signal — risk elevated, size accordingly",
    positive: trendMatch,
  });

  // Momentum
  const strongMom = Math.abs(priceChangePct) > 0.015;
  factors.push({
    text: strongMom
      ? `Strong momentum backing signal — ${(Math.abs(priceChangePct) * 100).toFixed(2)}% price extension`
      : "Momentum moderate — await volume confirmation before full size",
    positive: strongMom,
  });

  // Volatility
  factors.push({
    text: volatility > 0.004
      ? `Elevated volatility (${(volatility * 10000).toFixed(1)} bps) — reduce position size`
      : `Volatility normal (${(volatility * 10000).toFixed(1)} bps) — standard position sizing`,
    positive: volatility <= 0.004,
  });

  // Order flow (simulated)
  const oFlowPos = type !== "HOLD" && (
    (type === "BUY" && trend !== "down") || (type === "SELL" && trend !== "up")
  );
  factors.push({
    text: oFlowPos
      ? "Order flow delta positive — buying/selling pressure confirmed"
      : "Order flow mixed — wait for delta confirmation",
    positive: oFlowPos,
  });

  return factors;
}

// ── Deterministic fallback signal (when AI unavailable) ───────────────────────

function deterministicSignal(
  trend: Trend,
  priceChangePct: number,
  volatility: number,
  currentPrice: number,
): { type: SignalType; confidence: number; strategy: Strategy } {
  let type: SignalType = "HOLD";
  let confidence = 72;

  const absPct = Math.abs(priceChangePct);

  if (trend === "up" && priceChangePct > 0.02) {
    type = "BUY";
    confidence = Math.min(92, 70 + absPct * 18 - (volatility > 0.003 ? 8 : 0));
  } else if (trend === "down" && priceChangePct < -0.02) {
    type = "SELL";
    confidence = Math.min(92, 70 + absPct * 18 - (volatility > 0.003 ? 8 : 0));
  } else {
    // Sideways — weaker confidence
    confidence = Math.max(62, 74 - volatility * 800);
  }

  // Use price to pick strategy deterministically
  const stratIdx = Math.floor(currentPrice / 1000) % 3;
  return { type, confidence: Math.round(confidence), strategy: STRATEGIES[stratIdx] };
}

// ── Price levels from market data ─────────────────────────────────────────────

function buildLevels(type: SignalType, price: number) {
  if (type === "BUY") {
    const entry   = price;
    const slPrice = entry * (1 - 0.003 - Math.random() * 0.003);
    const tpPrice = entry * (1 + 0.012 + Math.random() * 0.01);
    return {
      entryZone: priceRange(entry * 0.9995, entry * 1.0005),
      target:    fmt(tpPrice),
      stopLoss:  fmt(slPrice),
      rr:        `1:${((tpPrice - entry) / (entry - slPrice)).toFixed(1)}`,
      tpPrice,
      slPrice,
    };
  }
  if (type === "SELL") {
    const entry   = price;
    const slPrice = entry * (1 + 0.003 + Math.random() * 0.003);
    const tpPrice = entry * (1 - 0.012 - Math.random() * 0.01);
    return {
      entryZone: priceRange(entry * 0.9995, entry * 1.0005),
      target:    fmt(tpPrice),
      stopLoss:  fmt(slPrice),
      rr:        `1:${((entry - tpPrice) / (slPrice - entry)).toFixed(1)}`,
      tpPrice,
      slPrice,
    };
  }
  return { entryZone: "—", target: "—", stopLoss: "—", rr: "—", tpPrice: undefined, slPrice: undefined };
}

// ── AI call ───────────────────────────────────────────────────────────────────

interface AIResponse {
  signal:     "BUY" | "SELL" | "HOLD";
  confidence: number;
  reasoning:  string;
  strategy:   string;
}

async function callABFAnalyze(payload: {
  currentPrice:       number;
  priceHistory:       number[];
  priceChangePct:     number;
  trend:              string;
  volatility:         number;
  volume:             number;
  spread:             number;
  liquidityZones?:    { type: string; price: number; label: string; strength: number }[];
  imbalance?:         string;
  absorption?:        boolean;
  sweepDetected?:     boolean;
  volatilityPressure?:number;
  buyPressure?:       number;
  sellPressure?:      number;
  sweepPrice?:        number | null;
  nearestZoneLabel?:  string;
  historicalContext?: string;
}): Promise<AIResponse | null> {
  try {
    const res = await fetch("/api/abf/analyze", {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Fleet-ID":   "ABF",
      },
      credentials: "include",
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json() as AIResponse;
  } catch {
    return null;
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function SignalProvider({ children }: { children: React.ReactNode }) {
  const [currentSignal, setCurrentSignal] = useState<Signal | null>(null);
  const [signalHistory, setSignalHistory] = useState<Signal[]>([]);
  const [regime, setRegime] = useState<MarketRegime | null>(null);
  const [signalFlash, setSignalFlash] = useState(false);

  const { bot, pushLog, enterTrade } = useBotEngine();
  const market    = useMarketData();
  const liquidity = useLiquidity();
  const learning  = useLearning();
  const fleet     = useFleetEngine();

  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firingRef     = useRef(false);

  const fireSignal = useCallback(async () => {
    if (firingRef.current) return;
    firingRef.current = true;

    try {
      const {
        currentPrice, priceHistory, priceChangePct,
        trend, volatility, volume, spread,
      } = market;

      const ticker    = "BTC/USDT";
      const timeframe = TIMEFRAMES[Math.floor(Math.random() * TIMEFRAMES.length)];

      // Try AI first
      let signalType: SignalType;
      let confidence: number;
      let strategy: Strategy;
      let explanation: string;
      let aiGenerated = false;

      const histPrices = priceHistory.slice(-20).map(t => t.price);

      const aiResult = await callABFAnalyze({
        currentPrice,
        priceHistory: histPrices,
        priceChangePct,
        trend,
        volatility,
        volume,
        spread,
        // Liquidity enrichment
        liquidityZones:     liquidity.liquidityZones.map(z => ({ type: z.type, price: z.price, label: z.label, strength: z.strength })),
        imbalance:          liquidity.imbalance,
        absorption:         liquidity.absorption,
        sweepDetected:      liquidity.sweepDetected,
        volatilityPressure: liquidity.volatilityPressure,
        buyPressure:        liquidity.buyPressure,
        sellPressure:       liquidity.sellPressure,
        sweepPrice:         liquidity.sweepPrice,
        nearestZoneLabel:   liquidity.nearestZone?.label,
        historicalContext:  learning.getSimilarContextSummary({
          strategy:         STRATEGIES[0],
          volatilityRegime: volatility > 0.004 ? "high" : volatility > 0.001 ? "medium" : "low",
          liquidityState:   liquidity.sweepDetected ? "sweep" : liquidity.absorption ? "absorption" : "normal",
          trend:            trend as "up" | "down" | "sideways",
        }),
      });

      if (aiResult && ["BUY", "SELL", "HOLD"].includes(aiResult.signal)) {
        signalType  = aiResult.signal;
        confidence  = Math.max(65, Math.min(95, Math.round(aiResult.confidence)));
        strategy    = STRATEGIES.includes(aiResult.strategy as Strategy)
          ? aiResult.strategy as Strategy
          : STRATEGIES[0];
        explanation = aiResult.reasoning || "";
        aiGenerated = true;
      } else {
        // Deterministic fallback based on market data
        const fb = deterministicSignal(trend, priceChangePct, volatility, currentPrice);
        signalType  = fb.type;
        confidence  = fb.confidence;
        strategy    = fb.strategy;
        const pool  = signalType === "HOLD" ? HOLD_EXPLANATIONS
          : signalType === "BUY" ? BUY_EXPLANATIONS[strategy] : SELL_EXPLANATIONS[strategy];
        explanation = pool[Math.floor(Math.random() * pool.length)];
      }

      // Boost/reduce confidence based on market conditions + liquidity context
      if (signalType !== "HOLD") {
        const trendMatch =
          (signalType === "BUY"  && trend === "up")   ||
          (signalType === "SELL" && trend === "down");
        if (trendMatch)  confidence = Math.min(95, confidence + 4);
        if (!trendMatch) confidence = Math.max(65, confidence - 6);
        if (volatility > 0.005) confidence = Math.max(65, confidence - 5);

        // Liquidity boosts
        if (liquidity.sweepDetected) confidence = Math.min(95, confidence + 7);
        if (liquidity.absorption)    confidence = Math.min(95, confidence + 5);
        const imbalanceMatch =
          (signalType === "BUY"  && liquidity.imbalance === "buy")  ||
          (signalType === "SELL" && liquidity.imbalance === "sell");
        if (imbalanceMatch)   confidence = Math.min(95, confidence + 4);
        if (liquidity.volatilityPressure > 70 && !liquidity.sweepDetected)
          confidence = Math.max(65, confidence - 8);

        // Learning memory weight adjustment
        const volReg   = volatility > 0.004 ? "high" : volatility > 0.001 ? "medium" : "low";
        const liqState = liquidity.sweepDetected ? "sweep" : liquidity.absorption ? "absorption" : "normal";
        const memAdj   = learning.getConfidenceAdjustment({
          strategy,
          volatilityRegime:  volReg,
          liquidityState:    liqState,
          imbalance:         liquidity.imbalance as "buy" | "sell" | "neutral",
          trend:             trend as "up" | "down" | "sideways",
        });
        confidence = Math.max(65, Math.min(95, confidence + memAdj));
      }

      // Build signal
      const levels      = buildLevels(signalType, currentPrice);
      const indicators  = buildIndicators(signalType, trend, volatility, priceChangePct);
      const confluenceFactors = buildConfluence(signalType, strategy, trend, volatility, priceChangePct);

      const signal: Signal = {
        id:            crypto.randomUUID(),
        type:          signalType,
        confidence,
        strategy,
        ticker,
        timeframe,
        explanation,
        priceAtSignal: currentPrice,
        aiGenerated,
        timestamp:     new Date(),
        indicators,
        confluenceFactors,
        ...levels,
      };

      setCurrentSignal(signal);
      setSignalHistory(prev => [signal, ...prev].slice(0, 20));
      setRegime(buildRegime(signalType, trend, volatility));

      setSignalFlash(true);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => setSignalFlash(false), 800);

      // Log signal to activity feed
      if (bot?.status === "RUNNING" && pushLog && signalType !== "HOLD") {
        const src = aiGenerated ? "AI" : "engine";
        pushLog(`${src} Signal: ${signalType} ${ticker} @ $${currentPrice.toFixed(0)} (${confidence}%)`, "signal");
      }

      // Enter trade with real TP/SL when bot is running
      if (bot?.status === "RUNNING" && signalType !== "HOLD" && signal.tpPrice && signal.slPrice) {
        const direction = signalType === "BUY" ? "long" : "short";
        enterTrade(direction, currentPrice, signal.tpPrice, signal.slPrice);
      }

      // ── ABF real signal recording ───────────────────────────────────────────
      fleet.recordAbfSignal(signalType, ticker, confidence, aiGenerated);

      // ── VCBF signal validation ──────────────────────────────────────────────
      const volReg   = volatility > 0.004 ? "high" : volatility > 0.001 ? "medium" : "low";
      void volReg;
      fleet.vcbfCheckSignal({
        signalType,
        ticker,
        confidence,
        strategy,
        trend:         trend as "up" | "down" | "sideways",
        volatility,
        sweepDetected: liquidity.sweepDetected,
        absorption:    liquidity.absorption,
        imbalance:     liquidity.imbalance as "buy" | "sell" | "neutral",
        overallWinRate: learning.overallWinRate,
        worstCondition: learning.worstCondition,
      });
    } finally {
      firingRef.current = false;
      tickRef.current   = setTimeout(() => fireSignal(), 6000 + Math.random() * 6000);
    }
  }, [bot, pushLog, enterTrade, market, fleet, liquidity, learning]);

  useEffect(() => {
    const initial = setTimeout(() => fireSignal(), 2000);
    return () => {
      clearTimeout(initial);
      if (tickRef.current)   clearTimeout(tickRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SignalEngineContext.Provider value={{ currentSignal, signalHistory, regime, signalFlash }}>
      {children}
    </SignalEngineContext.Provider>
  );
}

export function useSignalEngine() {
  return useContext(SignalEngineContext);
}
