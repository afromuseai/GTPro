import { createHmac } from "crypto";

export interface BitMEXConfig {
  apiKey:    string;
  apiSecret: string;
  baseUrl:   string;
}

export interface AccountBalance {
  availableBalance:   string;
  totalWalletBalance: string;
}

export const getBaseUrl = (testnet: boolean) =>
  testnet ? "https://testnet.bitmex.com" : "https://www.bitmex.com";

async function signedGet<T>(cfg: BitMEXConfig, path: string, query = ""): Promise<T> {
  const expires  = Math.floor(Date.now() / 1000) + 60;
  const verb     = "GET";
  const fullPath = path + (query ? "?" + query : "");
  const payload  = verb + fullPath + expires;
  const sign     = createHmac("sha256", cfg.apiSecret).update(payload).digest("hex");

  const res = await fetch(`${cfg.baseUrl}${fullPath}`, {
    headers: {
      "api-expires":   expires.toString(),
      "api-key":       cfg.apiKey,
      "api-signature": sign,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(`BitMEX ${res.status}: ${err.error?.message ?? res.statusText}`);
  }
  return res.json() as T;
}

export async function getAccount(cfg: BitMEXConfig): Promise<AccountBalance> {
  const margin = await signedGet<{ amount: number; availableMargin: number }>(
    cfg, "/api/v1/user/margin", "currency=XBt",
  );
  const toUsd = (satoshi: number) => (satoshi / 1e8).toFixed(2);
  return {
    availableBalance:   toUsd(margin.availableMargin ?? 0),
    totalWalletBalance: toUsd(margin.amount          ?? 0),
  };
}
