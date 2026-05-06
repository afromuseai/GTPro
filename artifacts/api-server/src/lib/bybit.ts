import { createHmac } from "crypto";

export interface BybitConfig {
  apiKey:    string;
  apiSecret: string;
  baseUrl:   string;
}

export interface AccountBalance {
  availableBalance:   string;
  totalWalletBalance: string;
}

// Live: api.bybit.com  |  Demo: api-demo.bybit.com  |  Testnet: api-testnet.bybit.com
export const getBaseUrl = (testnet: boolean, demo = false): string =>
  demo    ? "https://api-demo.bybit.com"    :
  testnet ? "https://api-testnet.bybit.com" :
            "https://api.bybit.com";

async function safeJson<T>(res: Response): Promise<T> {
  // Per Bybit docs: US and China IP addresses receive 403 Forbidden (non-JSON HTML page)
  if (res.status === 403) {
    throw new Error("bybit_geo_blocked");
  }
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    const snippet = text.slice(0, 120).replace(/\s+/g, " ").trim();
    throw new Error(
      `Bybit returned a non-JSON response (status ${res.status}). ` +
      `Preview: ${snippet || "(empty)"}`,
    );
  }
}

async function signedGet<T>(cfg: BybitConfig, path: string, params: Record<string, string> = {}): Promise<T> {
  const ts         = Date.now().toString();
  const recvWindow = "5000";
  const qs         = new URLSearchParams(params).toString();
  const payload    = ts + cfg.apiKey + recvWindow + qs;
  const sign       = createHmac("sha256", cfg.apiSecret).update(payload).digest("hex");

  const url = `${cfg.baseUrl}${path}${qs ? "?" + qs : ""}`;
  const res = await fetch(url, {
    headers: {
      "X-BAPI-API-KEY":     cfg.apiKey,
      "X-BAPI-SIGN":        sign,
      "X-BAPI-TIMESTAMP":   ts,
      "X-BAPI-RECV-WINDOW": recvWindow,
    },
  });

  const data = await safeJson<T & { retCode: number; retMsg: string }>(res);
  if (data.retCode !== 0) throw new Error(`Bybit ${data.retCode}: ${data.retMsg}`);
  return data;
}

// Per Bybit V5 docs: wallet-balance only supports accountType=UNIFIED
export async function getAccount(cfg: BybitConfig): Promise<AccountBalance> {
  const data = await signedGet<{
    result: { list: Array<{ totalAvailableBalance: string; totalWalletBalance: string }> };
  }>(cfg, "/v5/account/wallet-balance", { accountType: "UNIFIED" });

  const wallet = data.result?.list?.[0];
  if (!wallet) throw new Error("No Bybit wallet found. Ensure your account is a Unified Trading Account and the API key has read permissions.");
  return {
    availableBalance:   wallet.totalAvailableBalance ?? "0",
    totalWalletBalance: wallet.totalWalletBalance    ?? "0",
  };
}
