import { createHmac } from "crypto";

export interface PhemexConfig {
  apiKey:    string;
  apiSecret: string;
  baseUrl:   string;
}

export interface AccountBalance {
  availableBalance:   string;
  totalWalletBalance: string;
}

export const getBaseUrl = (testnet: boolean) =>
  testnet ? "https://testnet-api.phemex.com" : "https://api.phemex.com";

async function signedGet<T>(cfg: PhemexConfig, path: string, query = ""): Promise<T> {
  const expiry = Math.floor(Date.now() / 1000) + 60;
  const payload = path + query + expiry.toString();
  const sign    = createHmac("sha256", cfg.apiSecret).update(payload).digest("hex");

  const url = `${cfg.baseUrl}${path}${query ? "?" + query : ""}`;
  const res = await fetch(url, {
    headers: {
      "x-phemex-access-token":         cfg.apiKey,
      "x-phemex-request-expiry":       expiry.toString(),
      "x-phemex-request-signature":    sign,
    },
  });
  const data = await res.json() as T & { code?: number; msg?: string };
  if (!res.ok) throw new Error(`Phemex ${(data as { code?: number }).code ?? res.status}: ${(data as { msg?: string }).msg ?? ""}`);
  return data;
}

export async function getAccount(cfg: PhemexConfig): Promise<AccountBalance> {
  const data = await signedGet<{
    data?: { account?: { accountBalanceRv: string; totalUsedBalanceRv: string } };
  }>(cfg, "/g-accounts/accountPositions", "currency=USDT");

  const acc   = data.data?.account;
  const total = parseFloat(acc?.accountBalanceRv  ?? "0");
  const used  = parseFloat(acc?.totalUsedBalanceRv ?? "0");
  return {
    availableBalance:   Math.max(0, total - used).toFixed(2),
    totalWalletBalance: total.toFixed(2),
  };
}
