import React, { createContext, useContext, useEffect, useRef, useState } from "react";

export type DataMode  = "live" | "simulated";
export type FeedState = "connecting" | "live" | "reconnecting";
export type Trend    = "up" | "down" | "sideways";

export interface MarketTick {
  price:     number;
  volume:    number;
  spread:    number;
  timestamp: number;
}

export interface MarketDataContextValue {
  currentPrice:   number;
  priceHistory:   MarketTick[];
  volume:         number;
  spread:         number;
  priceChangePct: number;   // session change
  changePct24h:   number;   // 24-hour change from CoinGecko
  trend:          Trend;
  volatility:     number;
  dataMode:       DataMode;
  feedState:      FeedState;
  ticker:         "BTC/USDT";
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const BTC_BASE = 95_000; // rough fallback — replaced by real price immediately

const defaultCtx: MarketDataContextValue = {
  currentPrice:   BTC_BASE,
  priceHistory:   [],
  volume:         0,
  spread:         0,
  priceChangePct: 0,
  changePct24h:   0,
  trend:          "sideways",
  volatility:     0,
  dataMode:       "simulated",
  feedState:      "connecting",
  ticker:         "BTC/USDT",
};

export const MarketDataContext = createContext<MarketDataContextValue>(defaultCtx);

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcTrend(history: MarketTick[]): Trend {
  if (history.length < 10) return "sideways";
  const recent = history.slice(-5).map(t => t.price);
  const older  = history.slice(-10, -5).map(t => t.price);
  const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
  const avgOlder  = older.reduce((a, b)  => a + b, 0) / older.length;
  const diff = (avgRecent - avgOlder) / avgOlder;
  if (diff > 0.0003)  return "up";
  if (diff < -0.0003) return "down";
  return "sideways";
}

function calcVolatility(history: MarketTick[]): number {
  if (history.length < 5) return 0;
  const prices = history.slice(-20).map(t => t.price);
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((sum, p) => sum + (p - mean) ** 2, 0) / prices.length;
  return Math.sqrt(variance) / mean;
}

// ── Server-proxied CoinGecko SSE feed ─────────────────────────────────────────

interface ServerPriceTick {
  price:        number;
  volume:       number;
  spread:       number;
  changePct24h: number;
  timestamp:    number;
}

function useServerFeed(
  onTick:   (tick: MarketTick, changePct24h: number) => void,
  onStatus: (mode: DataMode) => void,
) {
  const failedRef  = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let es: EventSource | null = null;
    let failTimer: ReturnType<typeof setTimeout>;
    let retryTimer: ReturnType<typeof setTimeout>;

    function connect() {
      if (!mountedRef.current) return;
      try {
        es = new EventSource("/api/market/stream");

        // If no message within 30s, assume feed is down
        failTimer = setTimeout(() => {
          if (!mountedRef.current) return;
          if (!failedRef.current) {
            failedRef.current = true;
            onStatus("simulated");
          }
        }, 30_000);

        es.onopen = () => {
          clearTimeout(failTimer);
        };

        es.onmessage = (ev) => {
          clearTimeout(failTimer);
          if (!mountedRef.current) return;
          try {
            const data = JSON.parse(ev.data as string) as ServerPriceTick;
            if (data.price > 0) {
              failedRef.current = false;
              onStatus("live");
              onTick(
                { price: data.price, volume: data.volume, spread: data.spread, timestamp: data.timestamp },
                data.changePct24h,
              );
            }
          } catch { /* ignore parse errors */ }
        };

        es.onerror = () => {
          clearTimeout(failTimer);
          if (!mountedRef.current) return;
          es?.close();
          if (!failedRef.current) {
            failedRef.current = true;
            onStatus("simulated");
          }
          // Retry after 5s
          retryTimer = setTimeout(connect, 5_000);
        };
      } catch {
        failedRef.current = true;
        onStatus("simulated");
      }
    }

    connect();

    return () => {
      mountedRef.current = false;
      clearTimeout(failTimer);
      clearTimeout(retryTimer);
      es?.close();
    };
  }, [onTick, onStatus]);

  return failedRef;
}

// ── Simulated random-walk fallback ────────────────────────────────────────────

function useSimulatedFeed(
  basePrice: number,
  onTick:    (tick: MarketTick) => void,
  active:    boolean,
) {
  const priceRef = useRef(basePrice);
  const driftRef = useRef(0);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    priceRef.current = basePrice;
  }, [basePrice]);

  useEffect(() => {
    const id = setInterval(() => {
      if (!activeRef.current) return;
      driftRef.current = driftRef.current * 0.92 + (Math.random() - 0.5) * 0.0008;
      const pct  = driftRef.current + (Math.random() - 0.5) * 0.0012;
      priceRef.current = priceRef.current * (1 + pct);
      // Keep within ±15% of base
      const lo = basePrice * 0.85;
      const hi = basePrice * 1.15;
      priceRef.current = Math.max(lo, Math.min(hi, priceRef.current));

      const price  = +priceRef.current.toFixed(2);
      const spread = +(price * (0.00005 + Math.random() * 0.00015)).toFixed(2);
      const vol    = +(Math.random() * 120 + 40).toFixed(2);

      onTick({ price, volume: vol, spread, timestamp: Date.now() });
    }, 3_000);
    return () => clearInterval(id);
  }, [basePrice, onTick]);
}

// ── Provider ──────────────────────────────────────────────────────────────────

const MAX_HISTORY = 50;

export function MarketDataProvider({ children }: { children: React.ReactNode }) {
  const [history,       setHistory]       = useState<MarketTick[]>([]);
  const [dataMode,      setDataMode]      = useState<DataMode>("simulated");
  const [feedState,     setFeedState]     = useState<FeedState>("connecting");
  const [changePct24h,  setChangePct24h]  = useState(0);
  // Track whether server feed has ever given us a live price
  const livePriceRef    = useRef(BTC_BASE);
  const serverFailedRef = useRef(false);
  const hadLiveRef      = useRef(false);

  const appendTick = React.useCallback((tick: MarketTick) => {
    livePriceRef.current = tick.price;
    setHistory(prev => {
      const next = [...prev, tick];
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
    });
  }, []);

  const handleServerTick = React.useCallback((tick: MarketTick, pct24h: number) => {
    appendTick(tick);
    setChangePct24h(pct24h);
  }, [appendTick]);

  const handleStatus = React.useCallback((mode: DataMode) => {
    if (mode === "simulated") {
      serverFailedRef.current = true;
      setFeedState(hadLiveRef.current ? "reconnecting" : "connecting");
    }
    if (mode === "live") {
      serverFailedRef.current = false;
      hadLiveRef.current      = true;
      setFeedState("live");
    }
    setDataMode(mode);
  }, []);

  // Primary: server-proxied CoinGecko SSE
  useServerFeed(handleServerTick, handleStatus);

  // Fallback: only fires when server feed is down
  useSimulatedFeed(
    livePriceRef.current,
    React.useCallback((tick) => {
      if (serverFailedRef.current) appendTick(tick);
    }, [appendTick]),
    serverFailedRef.current,
  );

  // Derived values
  const last    = history[history.length - 1];
  const first   = history[0];
  const current = last?.price   ?? livePriceRef.current;
  const start   = first?.price  ?? current;

  const value: MarketDataContextValue = {
    currentPrice:   current,
    priceHistory:   history,
    volume:         last?.volume ?? 0,
    spread:         last?.spread ?? 0,
    priceChangePct: start > 0 ? ((current - start) / start) * 100 : 0,
    changePct24h,
    trend:          calcTrend(history),
    volatility:     calcVolatility(history),
    dataMode,
    feedState,
    ticker:         "BTC/USDT",
  };

  return (
    <MarketDataContext.Provider value={value}>
      {children}
    </MarketDataContext.Provider>
  );
}

export function useMarketData() {
  return useContext(MarketDataContext);
}
