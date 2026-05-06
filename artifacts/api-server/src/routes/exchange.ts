import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, exchangeCredentials } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "../lib/encrypt.js";
import {
  placeMarketOrder,
  placeLimitOrder,
  placeStopMarketOrder,
  cancelAllOrders,
  fmtPrice,
  fmtQty,
} from "../lib/binance.js";
import {
  getExchangeAdapter,
  isKnownExchange,
  EXCHANGES_REQUIRING_PASSPHRASE,
} from "../lib/exchange-registry.js";

const exchangeRouter = Router();

function getUserId(req: Parameters<typeof getAuth>[0]): string | null {
  const auth = getAuth(req);
  return auth?.userId ?? null;
}

// ── POST /api/exchange/connect ────────────────────────────────────────────────

exchangeRouter.post("/exchange/connect", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { exchange, apiKey, apiSecret, passphrase, testnet, demo } = req.body as {
    exchange:    string;
    apiKey:      string;
    apiSecret:   string;
    passphrase?: string;
    testnet?:    boolean;
    demo?:       boolean;
  };

  if (!exchange || !apiKey || !apiSecret) {
    return res.status(400).json({ error: "exchange, apiKey, and apiSecret are required" });
  }

  if (!isKnownExchange(exchange)) {
    return res.status(400).json({ error: `Unsupported exchange: ${exchange}` });
  }

  const needsPassphrase = EXCHANGES_REQUIRING_PASSPHRASE.includes(exchange as typeof EXCHANGES_REQUIRING_PASSPHRASE[number]);
  if (needsPassphrase && !passphrase?.trim()) {
    return res.status(400).json({ error: `${exchange} requires a passphrase` });
  }

  const adapter    = getExchangeAdapter(exchange)!;
  const isTestnet  = Boolean(testnet);
  const isDemo     = Boolean(demo);
  // Demo mode uses separate endpoints with virtual funds but real credentials
  const baseUrl =
    exchange === "Binance"
      ? (await import("../lib/binance.js")).getBaseUrl(isTestnet, isDemo)
      : exchange === "Bybit"
      ? (await import("../lib/bybit.js")).getBaseUrl(isTestnet, isDemo)
      : adapter.getBaseUrl(isTestnet);

  try {
    const account = await adapter.getAccount({
      apiKey,
      apiSecret,
      passphrase: passphrase ?? undefined,
      baseUrl,
    });

    const encKey    = encrypt(apiKey);
    const encSecret = encrypt(apiSecret);
    const encPass   = passphrase ? encrypt(passphrase) : null;

    await db.delete(exchangeCredentials).where(
      and(eq(exchangeCredentials.userId, userId), eq(exchangeCredentials.exchange, exchange)),
    );
    await db.insert(exchangeCredentials).values({
      userId,
      exchange,
      endpoint:            baseUrl,
      encryptedApiKey:     encKey,
      encryptedApiSecret:  encSecret,
      encryptedPassphrase: encPass ?? undefined,
      testnet:             isTestnet,
    });

    req.log.info({ exchange, testnet: isTestnet, demo: isDemo }, "Exchange connected");

    return res.json({
      connected:     true,
      exchange,
      testnet:       isTestnet,
      demo:          isDemo,
      balance:       parseFloat(account.availableBalance),
      walletBalance: parseFloat(account.totalWalletBalance),
    });
  } catch (err) {
    req.log.warn({ err, exchange }, "Exchange connection validation failed");
    const raw = err instanceof Error ? err.message : String(err);
    const lo = raw.toLowerCase();
    const isBinanceGeoBlock =
      lo.includes("restricted location") ||
      lo.includes("eligibility") ||
      lo.includes("-1099");
    // Per Bybit docs: "IP addresses located in the US or Mainland China are restricted
    // and will return a 403 Forbidden error for requests to Bybit API."
    const isBybitGeoBlock =
      exchange === "Bybit" && (lo.includes("bybit_geo_blocked") || lo.includes("403"));
    if (isBinanceGeoBlock) {
      return res.status(451).json({
        error:   "geo_blocked",
        message: "Binance explicitly blocks API connections from US-based servers. Deploy GTPro outside the US to use Binance, or connect a different exchange.",
      });
    }
    if (isBybitGeoBlock) {
      return res.status(451).json({
        error:   "geo_blocked",
        message: "Bybit explicitly blocks API connections from US and China IP addresses (403 Forbidden — documented in their API guide). This server runs in the US, so Bybit is inaccessible from here. Use MEXC, OKX, or KuCoin instead, or self-host GTPro on a non-US server.",
      });
    }
    return res.status(400).json({ error: raw });
  }
});

// ── GET /api/exchange/accounts ────────────────────────────────────────────────
// Returns all connected exchanges for the current user

exchangeRouter.get("/exchange/accounts", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const creds = await db
    .select()
    .from(exchangeCredentials)
    .where(eq(exchangeCredentials.userId, userId));

  if (!creds.length) return res.json([]);

  const results = await Promise.allSettled(
    creds.map(async cred => {
      const adapter = getExchangeAdapter(cred.exchange);
      if (!adapter) throw new Error(`Unknown exchange: ${cred.exchange}`);

      const apiKey     = decrypt(cred.encryptedApiKey);
      const apiSecret  = decrypt(cred.encryptedApiSecret);
      const passphrase = cred.encryptedPassphrase ? decrypt(cred.encryptedPassphrase) : undefined;
      const account    = await adapter.getAccount({ apiKey, apiSecret, passphrase, baseUrl: cred.endpoint });

      const isDemo = cred.endpoint === "https://demo-fapi.binance.com" ||
                     cred.endpoint === "https://api-demo.bybit.com";
      return {
        exchange:      cred.exchange,
        testnet:       cred.testnet,
        demo:          isDemo,
        balance:       parseFloat(account.availableBalance),
        walletBalance: parseFloat(account.totalWalletBalance),
        connected:     true,
      };
    }),
  );

  const connected = results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    req.log.warn({ exchange: creds[i].exchange, err: r.reason }, "Exchange balance fetch failed");
    return {
      exchange:      creds[i].exchange,
      testnet:       creds[i].testnet,
      balance:       0,
      walletBalance: 0,
      connected:     false,
      error:         "Cannot reach exchange",
    };
  });

  return res.json(connected);
});

// ── GET /api/exchange/status ──────────────────────────────────────────────────
// Returns the first (primary) connected exchange — kept for backward compat

exchangeRouter.get("/exchange/status", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const [cred] = await db
    .select()
    .from(exchangeCredentials)
    .where(eq(exchangeCredentials.userId, userId))
    .limit(1);

  if (!cred) return res.json({ connected: false });

  try {
    const adapter    = getExchangeAdapter(cred.exchange);
    if (!adapter) return res.json({ connected: false });

    const apiKey     = decrypt(cred.encryptedApiKey);
    const apiSecret  = decrypt(cred.encryptedApiSecret);
    const passphrase = cred.encryptedPassphrase ? decrypt(cred.encryptedPassphrase) : undefined;
    const account    = await adapter.getAccount({ apiKey, apiSecret, passphrase, baseUrl: cred.endpoint });

    return res.json({
      connected:     true,
      exchange:      cred.exchange,
      testnet:       cred.testnet,
      balance:       parseFloat(account.availableBalance),
      walletBalance: parseFloat(account.totalWalletBalance),
    });
  } catch (err) {
    req.log.warn({ err }, "Exchange status ping failed");
    return res.json({ connected: false, error: "Cannot reach exchange" });
  }
});

// ── DELETE /api/exchange/disconnect ──────────────────────────────────────────

exchangeRouter.delete("/exchange/disconnect", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { exchange } = req.query as { exchange?: string };

  if (exchange) {
    await db.delete(exchangeCredentials).where(
      and(eq(exchangeCredentials.userId, userId), eq(exchangeCredentials.exchange, exchange)),
    );
  } else {
    await db.delete(exchangeCredentials).where(eq(exchangeCredentials.userId, userId));
  }

  return res.json({ success: true });
});

// ── POST /api/exchange/order/entry ───────────────────────────────────────────
// Places: 1) MARKET entry, 2) LIMIT take-profit, 3) STOP_MARKET stop-loss
// Always uses Binance-compatible execution (first connected Binance cred)

exchangeRouter.post("/exchange/order/entry", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const [cred] = await db
    .select()
    .from(exchangeCredentials)
    .where(eq(exchangeCredentials.userId, userId))
    .limit(1);

  if (!cred) return res.status(404).json({ error: "No exchange connected" });

  const {
    direction,
    symbol     = "BTCUSDT",
    quantity,
    takeProfit,
    stopLoss,
  } = req.body as {
    direction:  "long" | "short";
    symbol?:    string;
    quantity:   string;
    takeProfit: string;
    stopLoss:   string;
  };

  try {
    const apiKey    = decrypt(cred.encryptedApiKey);
    const apiSecret = decrypt(cred.encryptedApiSecret);
    const cfg       = { apiKey, apiSecret, baseUrl: cred.endpoint };

    const entrySide = direction === "long" ? "BUY"  : "SELL";
    const closeSide = direction === "long" ? "SELL" : "BUY";

    const qty   = fmtQty(parseFloat(quantity));
    const tpStr = fmtPrice(parseFloat(takeProfit));
    const slStr = fmtPrice(parseFloat(stopLoss));

    await cancelAllOrders(cfg, symbol).catch(() => {});
    const entryOrder = await placeMarketOrder(cfg, symbol, entrySide, qty);
    const tpOrder    = await placeLimitOrder(cfg, symbol, closeSide, qty, tpStr);
    const slOrder    = await placeStopMarketOrder(cfg, symbol, closeSide, qty, slStr);

    req.log.info(
      { entryOrderId: entryOrder.orderId, tpOrderId: tpOrder.orderId, slOrderId: slOrder.orderId, direction, symbol },
      "Exchange trade entered",
    );

    return res.json({
      entryOrderId: entryOrder.orderId,
      tpOrderId:    tpOrder.orderId,
      slOrderId:    slOrder.orderId,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to place entry order on exchange");
    const msg = err instanceof Error ? err.message : "Order placement failed";
    return res.status(500).json({ error: msg });
  }
});

// ── POST /api/exchange/order/close ───────────────────────────────────────────

exchangeRouter.post("/exchange/order/close", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const [cred] = await db
    .select()
    .from(exchangeCredentials)
    .where(eq(exchangeCredentials.userId, userId))
    .limit(1);

  if (!cred) return res.status(404).json({ error: "No exchange connected" });

  const { symbol = "BTCUSDT", direction, quantity } = req.body as {
    symbol?:   string;
    direction: "long" | "short";
    quantity:  string;
  };

  try {
    const apiKey    = decrypt(cred.encryptedApiKey);
    const apiSecret = decrypt(cred.encryptedApiSecret);
    const cfg       = { apiKey, apiSecret, baseUrl: cred.endpoint };

    await cancelAllOrders(cfg, symbol).catch(() => {});

    const closeSide = direction === "long" ? "SELL" : "BUY";
    const qty       = fmtQty(parseFloat(quantity));
    await placeMarketOrder(cfg, symbol, closeSide, qty, true);

    req.log.info({ direction, symbol }, "Exchange position closed");
    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to close position on exchange");
    const msg = err instanceof Error ? err.message : "Close failed";
    return res.status(500).json({ error: msg });
  }
});

export default exchangeRouter;
