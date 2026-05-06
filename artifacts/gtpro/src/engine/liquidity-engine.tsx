import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useMarketData, MarketTick } from "./market-data";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ZoneType = "EQH" | "EQL" | "SESSION_HIGH" | "SESSION_LOW" | "STOP_CLUSTER";
export type Imbalance = "buy" | "sell" | "neutral";

export interface LiquidityZone {
  id:         string;
  type:       ZoneType;
  price:      number;
  label:      string;
  strength:   number;   // 0–1
  proximity:  number;   // 0–1, 1 = price is right at zone
}

export interface LiquidityState {
  liquidityZones:     LiquidityZone[];
  imbalance:          Imbalance;
  absorption:         boolean;
  sweepDetected:      boolean;
  volatilityPressure: number;    // 0–100
  buyPressure:        number;    // 0–100
  sellPressure:       number;    // 0–100
  nearestZone:        LiquidityZone | null;
  sweepPrice:         number | null;
}

interface LiquidityContextValue {
  liquidity: LiquidityState;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_STATE: LiquidityState = {
  liquidityZones:     [],
  imbalance:          "neutral",
  absorption:         false,
  sweepDetected:      false,
  volatilityPressure: 0,
  buyPressure:        50,
  sellPressure:       50,
  nearestZone:        null,
  sweepPrice:         null,
};

export const LiquidityContext = createContext<LiquidityContextValue>({
  liquidity: DEFAULT_STATE,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function proximity(price: number, zonePrice: number): number {
  const dist = Math.abs(price - zonePrice) / price;
  return Math.max(0, 1 - dist / 0.005); // 0.5% range = full proximity
}

function buildZones(history: MarketTick[], currentPrice: number): LiquidityZone[] {
  if (history.length < 10) return [];

  const prices  = history.map(t => t.price);
  const recent  = history.slice(-30);

  // Rolling session high / low (last 30 ticks)
  const sessionHigh = Math.max(...recent.map(t => t.price));
  const sessionLow  = Math.min(...recent.map(t => t.price));

  // Equal highs — find price clusters near session high (within 0.1%)
  const tolerance = currentPrice * 0.001;
  const nearHigh  = prices.filter(p => Math.abs(p - sessionHigh) < tolerance);
  const nearLow   = prices.filter(p => Math.abs(p - sessionLow)  < tolerance);

  // Stop clusters — 0.3% above highs and below lows
  const stopAbove = sessionHigh * 1.003;
  const stopBelow = sessionLow  * 0.997;

  const zones: LiquidityZone[] = [
    {
      id:        "session-high",
      type:      "SESSION_HIGH",
      price:     sessionHigh,
      label:     `Session High  $${sessionHigh.toFixed(0)}`,
      strength:  0.75 + Math.random() * 0.25,
      proximity: proximity(currentPrice, sessionHigh),
    },
    {
      id:        "session-low",
      type:      "SESSION_LOW",
      price:     sessionLow,
      label:     `Session Low  $${sessionLow.toFixed(0)}`,
      strength:  0.75 + Math.random() * 0.25,
      proximity: proximity(currentPrice, sessionLow),
    },
  ];

  if (nearHigh.length >= 2) {
    zones.push({
      id:        "eqh",
      type:      "EQH",
      price:     sessionHigh,
      label:     `Equal Highs (EQH)  $${sessionHigh.toFixed(0)}`,
      strength:  Math.min(1, nearHigh.length * 0.18),
      proximity: proximity(currentPrice, sessionHigh),
    });
  }
  if (nearLow.length >= 2) {
    zones.push({
      id:        "eql",
      type:      "EQL",
      price:     sessionLow,
      label:     `Equal Lows (EQL)  $${sessionLow.toFixed(0)}`,
      strength:  Math.min(1, nearLow.length * 0.18),
      proximity: proximity(currentPrice, sessionLow),
    });
  }
  zones.push({
    id:        "stop-above",
    type:      "STOP_CLUSTER",
    price:     stopAbove,
    label:     `Stop Cluster (Above)  $${stopAbove.toFixed(0)}`,
    strength:  0.55 + Math.random() * 0.3,
    proximity: proximity(currentPrice, stopAbove),
  });
  zones.push({
    id:        "stop-below",
    type:      "STOP_CLUSTER",
    price:     stopBelow,
    label:     `Stop Cluster (Below)  $${stopBelow.toFixed(0)}`,
    strength:  0.55 + Math.random() * 0.3,
    proximity: proximity(currentPrice, stopBelow),
  });

  // Sort by proximity to current price (highest first)
  return zones.sort((a, b) => b.proximity - a.proximity);
}

function detectSweep(
  history: MarketTick[],
  sessionHigh: number,
  sessionLow:  number,
): { detected: boolean; price: number | null } {
  if (history.length < 4) return { detected: false, price: null };

  const recent4 = history.slice(-4).map(t => t.price);
  const prev    = history.slice(-8, -4).map(t => t.price);
  if (prev.length === 0) return { detected: false, price: null };

  const prevHigh = Math.max(...prev);
  const prevLow  = Math.min(...prev);
  const curHigh  = Math.max(...recent4);
  const curLow   = Math.min(...recent4);
  const cur      = recent4[recent4.length - 1];

  // Swept above prev high then came back below
  if (curHigh > prevHigh * 1.0005 && cur < prevHigh) {
    return { detected: true, price: curHigh };
  }
  // Swept below prev low then came back above
  if (curLow < prevLow * 0.9995 && cur > prevLow) {
    return { detected: true, price: curLow };
  }
  return { detected: false, price: null };
}

function detectAbsorption(history: MarketTick[]): boolean {
  if (history.length < 6) return false;
  const recent6 = history.slice(-6);
  const volumes  = recent6.map(t => t.volume);
  const prices   = recent6.map(t => t.price);
  const avgVol   = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const maxVol   = Math.max(...volumes);
  const priceMove = Math.abs(prices[prices.length - 1] - prices[0]) / prices[0];
  // High volume relative to recent average, but price didn't move much → absorption
  return maxVol > avgVol * 1.6 && priceMove < 0.001;
}

function calcPressure(history: MarketTick[]): { buy: number; sell: number } {
  if (history.length < 8) return { buy: 50, sell: 50 };
  const recent = history.slice(-8);
  let buyVol = 0, sellVol = 0;
  for (let i = 1; i < recent.length; i++) {
    const up = recent[i].price > recent[i - 1].price;
    if (up) buyVol  += recent[i].volume;
    else    sellVol += recent[i].volume;
  }
  const total = buyVol + sellVol || 1;
  return {
    buy:  Math.round((buyVol  / total) * 100),
    sell: Math.round((sellVol / total) * 100),
  };
}

function calcImbalance(buy: number, sell: number): Imbalance {
  if (buy - sell >  15) return "buy";
  if (sell - buy > 15)  return "sell";
  return "neutral";
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function LiquidityProvider({ children }: { children: React.ReactNode }) {
  const { currentPrice, priceHistory, volatility } = useMarketData();
  const [liquidity, setLiquidity] = useState<LiquidityState>(DEFAULT_STATE);
  const prevPriceRef = useRef(currentPrice);

  const compute = useCallback(() => {
    if (priceHistory.length < 4) return;

    const zones = buildZones(priceHistory, currentPrice);

    const prices     = priceHistory.map(t => t.price);
    const sessionHi  = Math.max(...prices.slice(-30));
    const sessionLo  = Math.min(...prices.slice(-30));

    const sweep      = detectSweep(priceHistory, sessionHi, sessionLo);
    const absorption = detectAbsorption(priceHistory);
    const { buy, sell } = calcPressure(priceHistory);
    const imbalance  = calcImbalance(buy, sell);
    const volPressure = Math.min(100, Math.round(volatility * 25_000));
    const nearest    = zones.find(z => z.proximity > 0.1) ?? zones[0] ?? null;

    setLiquidity({
      liquidityZones:     zones,
      imbalance,
      absorption,
      sweepDetected:      sweep.detected,
      volatilityPressure: volPressure,
      buyPressure:        buy,
      sellPressure:       sell,
      nearestZone:        nearest ?? null,
      sweepPrice:         sweep.price,
    });

    prevPriceRef.current = currentPrice;
  }, [currentPrice, priceHistory, volatility]);

  useEffect(() => {
    compute();
  }, [compute]);

  return (
    <LiquidityContext.Provider value={{ liquidity }}>
      {children}
    </LiquidityContext.Provider>
  );
}

export function useLiquidity() {
  return useContext(LiquidityContext).liquidity;
}
