import { Router } from "express";

const router = Router();

interface OKXCandle {
  ts:    number;
  open:  number;
  high:  number;
  low:   number;
  close: number;
  vol:   number;
}

interface BacktestTrade {
  entryTime:  number;
  exitTime:   number;
  direction:  "long" | "short";
  entryPrice: number;
  exitPrice:  number;
  pnl:        number;
  outcome:    "tp" | "sl";
}

interface BacktestResult {
  totalTrades:    number;
  winRate:        number;
  totalPnl:       number;
  maxDrawdown:    number;
  sharpeRatio:    number;
  avgWin:         number;
  avgLoss:        number;
  profitFactor:   number;
  trades:         BacktestTrade[];
  equityCurve:    { time: number; equity: number }[];
}

const OKX_SYMBOL_MAP: Record<string, string> = {
  "BTC/USDT":  "BTC-USDT",
  "ETH/USDT":  "ETH-USDT",
  "SOL/USDT":  "SOL-USDT",
  "BNB/USDT":  "BNB-USDT",
  "AVAX/USDT": "AVAX-USDT",
  "MATIC/USDT":"POL-USDT",
};

async function fetchCandles(symbol: string, bar: string, limit: number): Promise<OKXCandle[]> {
  const instId = OKX_SYMBOL_MAP[symbol] ?? "BTC-USDT";
  try {
    const res = await fetch(
      `https://www.okx.com/api/v5/market/candles?instId=${instId}&bar=${bar}&limit=${limit}`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const json = await res.json() as { code: string; data: string[][] };
    if (json.code !== "0" || !json.data) return [];
    return json.data.map(row => ({
      ts:    parseInt(row[0]!),
      open:  parseFloat(row[1]!),
      high:  parseFloat(row[2]!),
      low:   parseFloat(row[3]!),
      close: parseFloat(row[4]!),
      vol:   parseFloat(row[5]!),
    })).reverse();
  } catch {
    return [];
  }
}

function calcEMA(prices: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i === 0) { ema.push(prices[0]!); continue; }
    ema.push(prices[i]! * k + ema[i - 1]! * (1 - k));
  }
  return ema;
}

function calcRSI(prices: number[], period = 14): number[] {
  const rsi: number[] = [];
  for (let i = 0; i < period; i++) rsi.push(50);
  for (let i = period; i < prices.length; i++) {
    let gains = 0; let losses = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = prices[j]! - prices[j - 1]!;
      if (diff > 0) gains += diff; else losses -= diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(100 - 100 / (1 + rs));
  }
  return rsi;
}

function runBacktest(
  candles: OKXCandle[],
  strategy: string,
  tpPct: number,
  slPct: number,
): BacktestResult {
  const closes = candles.map(c => c.close);
  const ema9   = calcEMA(closes, 9);
  const ema21  = calcEMA(closes, 21);
  const ema50  = calcEMA(closes, 50);
  const rsi    = calcRSI(closes, 14);

  const trades: BacktestTrade[] = [];
  let equity = 1000;
  const equityCurve: { time: number; equity: number }[] = [{ time: candles[0]!.ts, equity }];

  let position: { direction: "long" | "short"; entry: number; entryTime: number; tp: number; sl: number } | null = null;

  for (let i = 51; i < candles.length; i++) {
    const c = candles[i]!;
    const prevClose = closes[i - 1]!;

    if (position) {
      const hit_tp = position.direction === "long" ? c.high >= position.tp : c.low <= position.tp;
      const hit_sl = position.direction === "long" ? c.low <= position.sl  : c.high >= position.sl;

      if (hit_sl || hit_tp) {
        const exitPrice = hit_tp ? position.tp : position.sl;
        const sign      = position.direction === "long" ? 1 : -1;
        const pnlPct    = sign * (exitPrice - position.entry) / position.entry;
        const pnl       = +(equity * pnlPct).toFixed(2);
        equity          = +(equity + pnl).toFixed(2);
        trades.push({
          entryTime:  position.entryTime,
          exitTime:   c.ts,
          direction:  position.direction,
          entryPrice: position.entry,
          exitPrice,
          pnl,
          outcome:    hit_tp ? "tp" : "sl",
        });
        equityCurve.push({ time: c.ts, equity });
        position = null;
      }
      continue;
    }

    let direction: "long" | "short" | null = null;

    if (strategy === "EMA Crossover") {
      const crossed_up   = ema9[i - 1]! <= ema21[i - 1]! && ema9[i]! > ema21[i]!;
      const crossed_down = ema9[i - 1]! >= ema21[i - 1]! && ema9[i]! < ema21[i]!;
      if (crossed_up   && rsi[i]! < 70) direction = "long";
      if (crossed_down && rsi[i]! > 30) direction = "short";

    } else if (strategy === "RSI Mean Reversion") {
      if (rsi[i]! < 30 && rsi[i]! > rsi[i - 1]!) direction = "long";
      if (rsi[i]! > 70 && rsi[i]! < rsi[i - 1]!) direction = "short";

    } else if (strategy === "Trend Follow") {
      const aboveAll = closes[i]! > ema9[i]! && ema9[i]! > ema21[i]! && ema21[i]! > ema50[i]!;
      const belowAll = closes[i]! < ema9[i]! && ema9[i]! < ema21[i]! && ema21[i]! < ema50[i]!;
      const prevAbove = prevClose > ema9[i - 1]! && ema9[i - 1]! > ema21[i - 1]!;
      const prevBelow = prevClose < ema9[i - 1]! && ema9[i - 1]! < ema21[i - 1]!;
      if (aboveAll && !prevAbove && rsi[i]! > 50) direction = "long";
      if (belowAll && !prevBelow && rsi[i]! < 50) direction = "short";

    } else {
      const breakout = c.close > Math.max(...candles.slice(i - 20, i).map(x => x.high));
      const breakdown = c.close < Math.min(...candles.slice(i - 20, i).map(x => x.low));
      if (breakout)  direction = "long";
      if (breakdown) direction = "short";
    }

    if (direction) {
      const tp = direction === "long"
        ? +(c.close * (1 + tpPct / 100)).toFixed(2)
        : +(c.close * (1 - tpPct / 100)).toFixed(2);
      const sl = direction === "long"
        ? +(c.close * (1 - slPct / 100)).toFixed(2)
        : +(c.close * (1 + slPct / 100)).toFixed(2);
      position = { direction, entry: c.close, entryTime: c.ts, tp, sl };
    }
  }

  if (!trades.length) {
    return { totalTrades: 0, winRate: 0, totalPnl: 0, maxDrawdown: 0, sharpeRatio: 0, avgWin: 0, avgLoss: 0, profitFactor: 0, trades: [], equityCurve: [] };
  }

  const wins   = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl <= 0);
  const winRate = +(wins.length / trades.length * 100).toFixed(1);
  const totalPnl = +trades.reduce((s, t) => s + t.pnl, 0).toFixed(2);
  const avgWin  = wins.length  ? +(wins.reduce((s, t) => s + t.pnl, 0) / wins.length).toFixed(2)   : 0;
  const avgLoss = losses.length ? +(Math.abs(losses.reduce((s, t) => s + t.pnl, 0)) / losses.length).toFixed(2) : 0;
  const profitFactor = avgLoss > 0 ? +(avgWin * wins.length / (avgLoss * losses.length)).toFixed(2) : 99;

  let peak = 1000; let maxDD = 0;
  for (const pt of equityCurve) {
    if (pt.equity > peak) peak = pt.equity;
    const dd = (peak - pt.equity) / peak * 100;
    if (dd > maxDD) maxDD = dd;
  }

  const pnls = trades.map(t => t.pnl);
  const avgPnl = pnls.reduce((a, b) => a + b, 0) / pnls.length;
  const stdDev = Math.sqrt(pnls.reduce((s, p) => s + (p - avgPnl) ** 2, 0) / pnls.length);
  const sharpeRatio = stdDev > 0 ? +(avgPnl / stdDev * Math.sqrt(252)).toFixed(2) : 0;

  return {
    totalTrades: trades.length,
    winRate,
    totalPnl,
    maxDrawdown: +maxDD.toFixed(2),
    sharpeRatio,
    avgWin,
    avgLoss,
    profitFactor,
    trades: trades.slice(-50),
    equityCurve,
  };
}

// ── POST /api/backtest ────────────────────────────────────────────────────────

router.post("/backtest", async (req, res) => {
  const {
    symbol   = "BTC/USDT",
    bar      = "1H",
    strategy = "EMA Crossover",
    tpPct    = 2,
    slPct    = 1,
    limit    = 300,
  } = req.body as {
    symbol?:   string;
    bar?:      string;
    strategy?: string;
    tpPct?:    number;
    slPct?:    number;
    limit?:    number;
  };

  const candles = await fetchCandles(symbol, bar, Math.min(limit, 300));
  if (candles.length < 60) {
    res.status(503).json({ error: "Not enough candle data — try again shortly" });
    return;
  }

  const result = runBacktest(candles, strategy, tpPct, slPct);
  res.json(result);
});

// ── GET /api/market/candles/:symbol ─ (also used by frontend for TradingView)

router.get("/market/candles/:symbol", async (req, res) => {
  const symbol = decodeURIComponent(req.params.symbol ?? "BTC/USDT");
  const bar    = (req.query.bar as string) ?? "1m";
  const limit  = Math.min(parseInt((req.query.limit as string) ?? "200", 10), 300);

  const candles = await fetchCandles(symbol, bar, limit);
  if (!candles.length) {
    res.status(503).json({ error: "Unable to fetch candle data" });
    return;
  }
  res.json(candles);
});

export default router;
