import { createHmac } from "crypto";

export interface CoinbaseConfig {
  apiKey:     string;
  apiSecret:  string;
  passphrase: string;
  baseUrl:    string;
}

export interface AccountBalance {
  availableBalance:   string;
  totalWalletBalance: string;
}

export const getBaseUrl = (_testnet: boolean) => "https://api.exchange.coinbase.com";
export const requiresPassphrase = true;

async function signedGet<T>(cfg: CoinbaseConfig, path: string): Promise<T> {
  const ts      = Math.floor(Date.now() / 1000).toString();
  const message = ts + "GET" + path + "";
  const sign    = createHmac("sha256", Buffer.from(cfg.apiSecret, "base64"))
    .update(message)
    .digest("base64");

  const res = await fetch(`${cfg.baseUrl}${path}`, {
    headers: {
      "CB-ACCESS-KEY":        cfg.apiKey,
      "CB-ACCESS-SIGN":       sign,
      "CB-ACCESS-TIMESTAMP":  ts,
      "CB-ACCESS-PASSPHRASE": cfg.passphrase,
      "Content-Type":         "application/json",
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(`Coinbase ${res.status}: ${err.message ?? res.statusText}`);
  }
  return res.json() as T;
}

export async function getAccount(cfg: CoinbaseConfig): Promise<AccountBalance> {
  const accounts = await signedGet<Array<{ currency: string; available: string; balance: string }>>(
    cfg, "/accounts",
  );
  const usdt = accounts.find(a => a.currency === "USD" || a.currency === "USDT");
  return {
    availableBalance:   usdt?.available ?? "0",
    totalWalletBalance: usdt?.balance   ?? "0",
  };
}
