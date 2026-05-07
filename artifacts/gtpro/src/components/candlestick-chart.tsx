import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
} from "lightweight-charts";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";

interface OKXCandle {
  ts:    number;
  open:  number;
  high:  number;
  low:   number;
  close: number;
  vol:   number;
}

export type Timeframe = "1m" | "5m" | "15m" | "1H" | "4H" | "1D";

interface CandlestickChartProps {
  symbol?:    string;
  height?:    number;
  className?: string;
}

const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: "1m",  value: "1m"  },
  { label: "5m",  value: "5m"  },
  { label: "15m", value: "15m" },
  { label: "1H",  value: "1H"  },
  { label: "4H",  value: "4H"  },
  { label: "1D",  value: "1D"  },
];

const TF_TO_OKX: Record<Timeframe, string> = {
  "1m":  "1m",
  "5m":  "5m",
  "15m": "15m",
  "1H":  "1H",
  "4H":  "4H",
  "1D":  "1D",
};

export function CandlestickChart({ symbol = "BTC/USDT", height = 360, className = "" }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const seriesRef    = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const [tf,      setTf]      = useState<Timeframe>("1H");
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);
  const [lastClose, setLastClose] = useState<number | null>(null);
  const [changeDir, setChangeDir] = useState<"up" | "down" | null>(null);

  const fetchAndRender = useCallback(async (timeframe: Timeframe) => {
    setLoading(true);
    setError(false);
    try {
      const bar = TF_TO_OKX[timeframe];
      const encoded = encodeURIComponent(symbol);
      const res = await fetch(`/api/market/candles/${encoded}?bar=${bar}&limit=200`);
      if (!res.ok) throw new Error("fetch failed");
      const raw: OKXCandle[] = await res.json();

      const candles: CandlestickData<Time>[] = raw.map(c => ({
        time:  (Math.floor(c.ts / 1000)) as Time,
        open:  c.open,
        high:  c.high,
        low:   c.low,
        close: c.close,
      }));

      if (seriesRef.current && candles.length > 0) {
        seriesRef.current.setData(candles);
        chartRef.current?.timeScale().fitContent();
        const last = candles[candles.length - 1];
        const prev = candles[candles.length - 2];
        if (last && prev) {
          setChangeDir(last.close >= prev.close ? "up" : "down");
          setLastClose(last.close);
        }
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background:  { type: ColorType.Solid, color: "transparent" },
        textColor:   "rgba(255,255,255,0.35)",
      },
      grid: {
        vertLines:   { color: "rgba(255,255,255,0.04)" },
        horzLines:   { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: {
        mode:        CrosshairMode.Normal,
        vertLine:    { color: "rgba(200,168,75,0.4)", labelBackgroundColor: "#D4AF37" },
        horzLine:    { color: "rgba(200,168,75,0.4)", labelBackgroundColor: "#D4AF37" },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.06)",
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderColor:     "rgba(255,255,255,0.06)",
        timeVisible:     true,
        secondsVisible:  false,
      },
      handleScroll:    true,
      handleScale:     true,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor:          "#34d399",
      downColor:        "#f87171",
      borderUpColor:    "#34d399",
      borderDownColor:  "#f87171",
      wickUpColor:      "#34d399",
      wickDownColor:    "#f87171",
    });

    chartRef.current  = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current  = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    fetchAndRender(tf);
  }, [tf, symbol, fetchAndRender]);

  return (
    <div className={`flex flex-col gap-0 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.05]">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold">{symbol}</span>
          {lastClose !== null && (
            <>
              <span className="text-[12px] font-black tabular-nums">
                ${lastClose >= 1000 ? lastClose.toLocaleString(undefined, { maximumFractionDigits: 0 }) : lastClose.toFixed(4)}
              </span>
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${changeDir === "up" ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"}`}>
                {changeDir === "up" ? "▲" : "▼"}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Timeframe buttons */}
          <div className="flex items-center gap-1">
            {TIMEFRAMES.map(t => (
              <button
                key={t.value}
                onClick={() => setTf(t.value)}
                className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                  tf === t.value
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "text-muted-foreground/50 hover:text-foreground hover:bg-white/[0.05]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={() => fetchAndRender(tf)}
            className="p-1.5 rounded text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.05] transition-all"
          >
            <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          </button>

          {/* Feed status */}
          {error
            ? <WifiOff size={10} className="text-red-400/60" />
            : <Wifi    size={10} className="text-emerald-400/60" />
          }
        </div>
      </div>

      {/* Chart container */}
      <div className="relative" style={{ height }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin opacity-60" />
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            <WifiOff size={18} className="text-muted-foreground/30 mb-2" />
            <span className="text-[11px] text-muted-foreground/40">Unable to load chart data</span>
            <button onClick={() => fetchAndRender(tf)} className="mt-2 text-[10px] text-primary/60 underline">Retry</button>
          </div>
        )}
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      </div>
    </div>
  );
}
