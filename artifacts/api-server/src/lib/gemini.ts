import { createHmac } from "crypto";

export interface GeminiConfig {
  apiKey:    string;
  apiSecret: string;
  baseUrl:   string;
}

export interface AccountBalance {
  availableBalance:   string;
  totalWalletBalance: string;
}

export const getBaseUrl = (_testnet: boolean) => "https://api.gemini.com";

async function signedPost<T>(cfg: GeminiConfig, path: string, extra: Record<string, unknown> = {}): Promise<T> {
  const nonce   = Date.now().toString();
  const payload = { request: path, nonce, ...extra };
  const b64     = Buffer.from(JSON.stringify(payload)).toString("base64");
  const sign    = createHmac("sha384", cfg.apiSecret).update(b64).digest("hex");

  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method: "POST",
    headers: {
      "X-GEMINI-APIKEY":    cfg.apiKey,
      "X-GEMINI-PAYLOAD":   b64,
      "X-GEMINI-SIGNATURE": sign,
      "Content-Length":     "0",
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(`Gemini ${res.status}: ${err.message ?? res.statusText}`);
  }
  return res.json() as T;
}

export async function getAccount(cfg: GeminiConfig): Promise<AccountBalance> {
  const balances = await signedPost<Array<{ currency: string; amount: string; available: string }>>(
    cfg, "/v1/balances",
  );
  const usd = balances.find(b => b.currency === "USD" || b.currency === "GUSD");
  return {
    availableBalance:   usd?.available ?? "0",
    totalWalletBalance: usd?.amount    ?? "0",
  };
}
