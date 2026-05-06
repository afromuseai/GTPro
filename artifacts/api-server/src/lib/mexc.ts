import { createHmac } from "crypto";

export interface MEXCConfig {
  apiKey:    string;
  apiSecret: string;
  baseUrl:   string;
}

export interface AccountBalance {
  availableBalance:   string;
  totalWalletBalance: string;
}

// MEXC Futures (contract) API — NOT the spot API
// Spot is api.mexc.com; futures is contract.mexc.com with a different auth scheme
export const getBaseUrl = (_testnet: boolean) => "https://contract.mexc.com";

async function safeJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    const snippet = text.slice(0, 120).replace(/\s+/g, " ").trim();
    throw new Error(
      `MEXC returned a non-JSON response (status ${res.status}). ` +
      `Preview: ${snippet || "(empty)"}`,
    );
  }
}

// MEXC Futures signature: HMAC-SHA256(secretKey, apiKey + timestamp + queryString)
async function signedGet<T>(
  cfg:    MEXCConfig,
  path:   string,
  params: Record<string, string> = {},
): Promise<T> {
  const ts        = Date.now().toString();
  const qs        = new URLSearchParams(params).toString();
  const payload   = cfg.apiKey + ts + qs;
  const signature = createHmac("sha256", cfg.apiSecret).update(payload).digest("hex");

  const url = `${cfg.baseUrl}${path}${qs ? "?" + qs : ""}`;
  const res = await fetch(url, {
    headers: {
      "ApiKey":       cfg.apiKey,
      "Request-Time": ts,
      "Signature":    signature,
      "Content-Type": "application/json",
    },
  });

  const data = await safeJson<T & { success?: boolean; code?: number; message?: string }>(res);
  if (!res.ok || data.success === false) {
    throw new Error(`MEXC ${data.code ?? res.status}: ${data.message ?? res.statusText}`);
  }
  return data;
}

interface MEXCAsset {
  currency:         string;
  availableBalance: string;
  cashBalance:      string;
  frozenBalance:    string;
}

export async function getAccount(cfg: MEXCConfig): Promise<AccountBalance> {
  const data = await signedGet<{ success: boolean; data: MEXCAsset[] }>(
    cfg, "/api/v1/private/account/assets",
  );
  const usdt  = data.data?.find(a => a.currency === "USDT");
  const avail = parseFloat(usdt?.availableBalance ?? "0");
  const total = parseFloat(usdt?.cashBalance      ?? "0");
  return {
    availableBalance:   avail.toFixed(2),
    totalWalletBalance: total.toFixed(2),
  };
}
