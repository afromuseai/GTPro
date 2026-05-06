import { createHmac } from "crypto";

export interface BinanceConfig {
  apiKey:    string;
  apiSecret: string;
  baseUrl:   string;
}

// Binance BTCUSDT futures precision
export const PRICE_PRECISION = 2;   // e.g. 84512.50
export const QTY_PRECISION   = 3;   // e.g. 0.100

export function fmtPrice(n: number) { return n.toFixed(PRICE_PRECISION); }
export function fmtQty(n: number)   { return n.toFixed(QTY_PRECISION);   }

function sign(qs: string, secret: string): string {
  return createHmac("sha256", secret).update(qs).digest("hex");
}

async function req<T>(
  cfg:    BinanceConfig,
  method: "GET" | "POST" | "DELETE",
  path:   string,
  params: Record<string, string | number | boolean> = {},
  signed = false,
): Promise<T> {
  const ts = Date.now();
  const sp = new URLSearchParams(
    Object.entries(signed ? { ...params, timestamp: ts } : params)
      .map(([k, v]) => [k, String(v)]),
  );
  if (signed) sp.append("signature", sign(sp.toString(), cfg.apiSecret));

  const isBody = method === "POST";
  const url    = isBody ? `${cfg.baseUrl}${path}` : `${cfg.baseUrl}${path}?${sp}`;

  const res = await fetch(url, {
    method,
    headers: {
      "X-MBX-APIKEY": cfg.apiKey,
      ...(isBody ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: isBody ? sp.toString() : undefined,
  });

  const data = (await res.json()) as T & { code?: number; msg?: string };
  if (!res.ok) throw new Error(`Binance ${data.code ?? res.status}: ${data.msg ?? res.statusText}`);
  return data;
}

// ── Account ────────────────────────────────────────────────────────────────────

export interface FuturesAccount {
  totalWalletBalance:    string;
  totalUnrealizedProfit: string;
  totalMarginBalance:    string;
  availableBalance:      string;
  feeTier:               number;
}
export const getFuturesAccount = (cfg: BinanceConfig) =>
  req<FuturesAccount>(cfg, "GET", "/fapi/v2/account", {}, true);

// ── Orders ─────────────────────────────────────────────────────────────────────

export interface OrderResult {
  orderId:       number;
  symbol:        string;
  side:          string;
  type:          string;
  origQty:       string;
  price:         string;
  stopPrice:     string;
  status:        string;
  clientOrderId: string;
}

/** Market order — used for entries and emergency market closes. */
export const placeMarketOrder = (
  cfg: BinanceConfig,
  symbol: string,
  side: "BUY" | "SELL",
  quantity: string,
  reduceOnly = false,
) =>
  req<OrderResult>(cfg, "POST", "/fapi/v1/order", {
    symbol,
    side,
    type:     "MARKET",
    quantity,
    ...(reduceOnly ? { reduceOnly: "true" } : {}),
  }, true);

/** GTC limit order — used as take-profit. */
export const placeLimitOrder = (
  cfg: BinanceConfig,
  symbol: string,
  side: "BUY" | "SELL",
  quantity: string,
  price: string,
) =>
  req<OrderResult>(cfg, "POST", "/fapi/v1/order", {
    symbol,
    side,
    type:        "LIMIT",
    timeInForce: "GTC",
    quantity,
    price,
    reduceOnly:  "true",
  }, true);

/** Stop-market order — used as stop-loss. */
export const placeStopMarketOrder = (
  cfg: BinanceConfig,
  symbol: string,
  side: "BUY" | "SELL",
  quantity: string,
  stopPrice: string,
) =>
  req<OrderResult>(cfg, "POST", "/fapi/v1/order", {
    symbol,
    side,
    type:       "STOP_MARKET",
    quantity,
    stopPrice,
    reduceOnly: "true",
  }, true);

/** Cancel all open orders for a symbol (used before new entry). */
export const cancelAllOrders = (cfg: BinanceConfig, symbol: string) =>
  req<{ code: number; msg: string }>(cfg, "DELETE", "/fapi/v1/allOpenOrders", { symbol }, true);

/** Get all open orders for a symbol. */
export const getOpenOrders = (cfg: BinanceConfig, symbol: string) =>
  req<OrderResult[]>(cfg, "GET", "/fapi/v1/openOrders", { symbol }, true);

// ── Registry-compatible exports ────────────────────────────────────────────────

export const getBaseUrl = (testnet: boolean) =>
  testnet ? "https://testnet.binancefuture.com" : "https://fapi.binance.com";

export async function getAccount(cfg: BinanceConfig): Promise<{ availableBalance: string; totalWalletBalance: string }> {
  const account = await getFuturesAccount(cfg);
  return {
    availableBalance:   account.availableBalance,
    totalWalletBalance: account.totalWalletBalance,
  };
}
