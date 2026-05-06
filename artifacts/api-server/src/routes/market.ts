import { Router } from "express";
import type { Response } from "express";

const router = Router();

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PriceTick {
  price:        number;
  volume:       number;   // approx BTC volume from 24h USD vol
  spread:       number;   // estimated from price
  changePct24h: number;
  timestamp:    number;
}

// ── In-memory cache & SSE client registry ─────────────────────────────────────

let cachedTick: PriceTick | null = null;
const sseClients = new Set<Response>();

// ── Types for multi-pair data ─────────────────────────────────────────────────

export interface PairPrice {
  ticker: string;
  price: number;
  changePct24h: number;
  timestamp: number;
}

let cachedPairs: PairPrice[] = [];

// ── CoinGecko fetch ───────────────────────────────────────────────────────────

async function fetchPrice(): Promise<PriceTick | null> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true",
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json() as {
      bitcoin: { usd: number; usd_24h_vol: number; usd_24h_change: number };
    };
    const price = data.bitcoin?.usd;
    if (!price || price <= 0) return null;

    return {
      price,
      volume:       +(data.bitcoin.usd_24h_vol / price / 1000).toFixed(2),
      spread:       +(price * 0.00012).toFixed(2),
      changePct24h: +(data.bitcoin.usd_24h_change ?? 0).toFixed(4),
      timestamp:    Date.now(),
    };
  } catch {
    return null;
  }
}

// ── Fetch all trading pairs from CoinGecko ─────────────────────────────────────

async function fetchPairs(): Promise<PairPrice[]> {
  try {
    const ids = "bitcoin,ethereum,solana,binancecoin,avalanche-2,polygon";
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return [];
    const data = await res.json() as Record<string, { usd: number; usd_24h_change: number }>;

    const mapping: Record<string, string> = {
      bitcoin: "BTC/USDT",
      ethereum: "ETH/USDT",
      solana: "SOL/USDT",
      binancecoin: "BNB/USDT",
      "avalanche-2": "AVAX/USDT",
      polygon: "MATIC/USDT",
    };

    return Object.entries(mapping)
      .map(([id, ticker]) => {
        const coin = data[id];
        if (!coin?.usd || coin.usd <= 0) return null;
        return {
          ticker,
          price: coin.usd,
          changePct24h: +(coin.usd_24h_change ?? 0).toFixed(2),
          timestamp: Date.now(),
        };
      })
      .filter((p): p is PairPrice => p !== null);
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

// ── Polling loop (every 5s — well within CoinGecko free-tier 30 req/min) ─────

async function poll() {
  const tick = await fetchPrice();
  if (tick) {
    cachedTick = tick;
    broadcast(tick);
  }
}

poll(); // fetch immediately on startup
const interval = setInterval(poll, 5000);
if (interval.unref) interval.unref(); // don't block Node exit

// ── Pairs polling loop (every 10s) ─────────────────────────────────────────────

async function pollPairs() {
  const pairs = await fetchPairs();
  if (pairs.length > 0) {
    cachedPairs = pairs;
  }
}

pollPairs(); // fetch immediately on startup
const pairsInterval = setInterval(pollPairs, 10000);
if (pairsInterval.unref) pairsInterval.unref();

// ── Routes ────────────────────────────────────────────────────────────────────

// SSE stream — clients subscribe for real-time price ticks
router.get("/market/stream", (req, res) => {
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  // Flush cached tick immediately so client doesn't wait 5s
  if (cachedTick) {
    res.write(`data: ${JSON.stringify(cachedTick)}\n\n`);
  }

  sseClients.add(res);
  req.on("close", () => sseClients.delete(res));
});

// One-shot REST price snapshot
router.get("/market/price", (_req, res) => {
  if (!cachedTick) {
    res.status(503).json({ error: "Price not yet available — fetching" });
    return;
  }
  res.json(cachedTick);
});

// Get all trading pair prices
router.get("/market/pairs", (_req, res) => {
  res.json(cachedPairs.length > 0 ? cachedPairs : []);
});

export default router;
