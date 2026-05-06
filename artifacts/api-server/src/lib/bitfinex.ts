import { createHmac } from "crypto";

export interface BitfinexConfig {
  apiKey:    string;
  apiSecret: string;
  baseUrl:   string;
}

export interface AccountBalance {
  availableBalance:   string;
  totalWalletBalance: string;
}

export const getBaseUrl = (_testnet: boolean) => "https://api.bitfinex.com";

async function signedPost<T>(cfg: BitfinexConfig, path: string, body: Record<string, unknown> = {}): Promise<T> {
  const nonce   = Date.now().toString();
  const payload = `/api${path}${nonce}${JSON.stringify(body)}`;
  const sign    = createHmac("sha384", cfg.apiSecret).update(payload).digest("hex");

  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method: "POST",
    headers: {
      "bfx-apikey":    cfg.apiKey,
      "bfx-nonce":     nonce,
      "bfx-signature": sign,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Bitfinex ${res.status}: ${res.statusText}`);
  return res.json() as T;
}

export async function getAccount(cfg: BitfinexConfig): Promise<AccountBalance> {
  const wallets = await signedPost<Array<[string, string, number, unknown, number]>>(
    cfg, "/v2/auth/r/wallets",
  );
  const usdWallets = wallets.filter(w => w[1] === "USD" || w[1] === "UST");
  const total  = usdWallets.reduce((s, w) => s + (w[2] ?? 0), 0);
  const avail  = usdWallets.reduce((s, w) => s + (w[4] ?? w[2] ?? 0), 0);
  return {
    availableBalance:   avail.toFixed(2),
    totalWalletBalance: total.toFixed(2),
  };
}
