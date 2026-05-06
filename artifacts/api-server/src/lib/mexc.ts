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

export const getBaseUrl = (_testnet: boolean) => "https://api.mexc.com";

async function signedGet<T>(cfg: MEXCConfig, path: string, params: Record<string, string> = {}): Promise<T> {
  const ts = Date.now().toString();
  const sp = new URLSearchParams({ ...params, timestamp: ts });
  sp.append("signature", createHmac("sha256", cfg.apiSecret).update(sp.toString()).digest("hex"));

  const res = await fetch(`${cfg.baseUrl}${path}?${sp}`, {
    headers: { "X-MEXC-APIKEY": cfg.apiKey },
  });
  const data = await res.json() as T & { code?: number; msg?: string };
  if (!res.ok) throw new Error(`MEXC ${(data as { code?: number }).code ?? res.status}: ${(data as { msg?: string }).msg ?? res.statusText}`);
  return data;
}

export async function getAccount(cfg: MEXCConfig): Promise<AccountBalance> {
  const data = await signedGet<{ balances: Array<{ asset: string; free: string; locked: string }> }>(
    cfg, "/api/v3/account",
  );
  const usdt  = data.balances?.find(b => b.asset === "USDT");
  const avail = parseFloat(usdt?.free ?? "0");
  const total = avail + parseFloat(usdt?.locked ?? "0");
  return {
    availableBalance:   avail.toFixed(2),
    totalWalletBalance: total.toFixed(2),
  };
}
