import { Router } from "express";
import type { Response } from "express";

const router = Router();

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PriceTick {
  price:        number;
  volume:       number;   // 24h base asset volume
  spread:       number;   // real bid-ask spread
  changePct24h: number;
  timestamp:    number;
}

export interface PairPrice {
  ticker:       string;
  price:        number;
  changePct24h: number;
  timestamp:    number;
}

// ── In-memory cache & SSE client registry ─────────────────────────────────────

let cachedTick: PriceTick | null = null;
let cachedPairs: PairPrice[] = [];
const sseClients = new Set<Response>();

// ── OKX symbol map ────────────────────────────────────────────────────────────

interface OKXTicker {
  instId:    string;
  last:      string;
  askPx:     string;
  bidPx:     string;
  vol24h:    string;   // base asset volume (e.g. BTC)
  open24h:   string;   // 24h open price for % change calculation
}

interface OKXResponse {
  code: string;
  data: OKXTicker[];
}

const PAIR_MAP: Record<string, string> = {
  "BTC-USDT":  "BTC/USDT",
  "ETH-USDT":  "ETH/USDT",
  "SOL-USDT":  "SOL/USDT",
  "BNB-USDT":  "BNB/USDT",
  "AVAX-USDT": "AVAX/USDT",
  "POL-USDT":  "MATIC/USDT",   // MATIC rebranded to POL on OKX
};

// ── OKX fetch — BTC/USDT ticker ───────────────────────────────────────────────

async function fetchPrice(): Promise<PriceTick | null> {
  try {
    const res = await fetch(
      "https://www.okx.com/api/v5/market/ticker?instId=BTC-USDT",
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;

    const json = await res.json() as OKXResponse;
    if (json.code !== "0" || !json.data?.[0]) return null;

    const t = json.data[0];
    const price   = parseFloat(t.last);
    const bid     = parseFloat(t.bidPx);
    const ask     = parseFloat(t.askPx);
    const open24h = parseFloat(t.open24h);
    if (!price || price <= 0) return null;

    const spread      = ask > 0 && bid > 0 ? +(ask - bid).toFixed(2) : +(price * 0.00012).toFixed(2);
    const changePct24h = open24h > 0 ? +((price - open24h) / open24h * 100).toFixed(4) : 0;

    return {
      price,
      volume:       +(parseFloat(t.vol24h)).toFixed(2),
      spread,
      changePct24h,
      timestamp:    Date.now(),
    };
  } catch {
    return null;
  }
}

// ── OKX fetch — all trading pairs ─────────────────────────────────────────────

async function fetchPairs(): Promise<PairPrice[]> {
  try {
    const results = await Promise.all(
      Object.keys(PAIR_MAP).map(async (instId) => {
        const res = await fetch(
          `https://www.okx.com/api/v5/market/ticker?instId=${instId}`,
          { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000) }
        );
        if (!res.ok) return null;
        const json = await res.json() as OKXResponse;
        if (json.code !== "0" || !json.data?.[0]) return null;

        const t       = json.data[0];
        const price   = parseFloat(t.last);
        const open24h = parseFloat(t.open24h);
        if (!price || price <= 0) return null;

        return {
          ticker:       PAIR_MAP[instId],
          price,
          changePct24h: open24h > 0 ? +((price - open24h) / open24h * 100).toFixed(2) : 0,
          timestamp:    Date.now(),
        } as PairPrice;
      })
    );
    return results.filter((p): p is PairPrice => p !== null);
  } catch {
    return [];
  }
}

// ── Broadcast to all SSE clients ─────────────────────────────────────────────

function broadcast(tick: PriceTick) {
  const payload = `data: ${JSON.stringify(tick)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// ── Polling loops ─────────────────────────────────────────────────────────────

async function poll() {
  const tick = await fetchPrice();
  if (tick) {
    cachedTick = tick;
    broadcast(tick);
  }
}

async function pollPairs() {
  const pairs = await fetchPairs();
  if (pairs.length > 0) {
    cachedPairs = pairs;
  }
}

poll();
pollPairs();

const interval      = setInterval(poll,      3000);
const pairsInterval = setInterval(pollPairs, 5000);

if (interval.unref)      interval.unref();
if (pairsInterval.unref) pairsInterval.unref();

// ── Routes ────────────────────────────────────────────────────────────────────

router.get("/market/stream", (req, res) => {
  res.setHeader("Content-Type",      "text/event-stream");
  res.setHeader("Cache-Control",     "no-cache");
  res.setHeader("Connection",        "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  if (cachedTick) {
    res.write(`data: ${JSON.stringify(cachedTick)}\n\n`);
  }

  sseClients.add(res);
  req.on("close", () => sseClients.delete(res));
});

router.get("/market/price", (_req, res) => {
  if (!cachedTick) {
    res.status(503).json({ error: "Price not yet available — fetching" });
    return;
  }
  res.json(cachedTick);
});

router.get("/market/pairs", (_req, res) => {
  res.json(cachedPairs.length > 0 ? cachedPairs : []);
});

export default router;
