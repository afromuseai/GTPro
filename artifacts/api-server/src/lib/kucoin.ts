import { createHmac } from "crypto";

export interface KuCoinConfig {
  apiKey:     string;
  apiSecret:  string;
  passphrase: string;
  baseUrl:    string;
}

export interface AccountBalance {
  availableBalance:   string;
  totalWalletBalance: string;
}

export const getBaseUrl = (_testnet: boolean) => "https://api.kucoin.com";
export const requiresPassphrase = true;

async function signedGet<T>(cfg: KuCoinConfig, path: string): Promise<T> {
  const ts       = Date.now().toString();
  const payload  = ts + "GET" + path;
  const sign     = createHmac("sha256", cfg.apiSecret).update(payload).digest("base64");
  const ppSign   = createHmac("sha256", cfg.apiSecret).update(cfg.passphrase).digest("base64");

  const res = await fetch(`${cfg.baseUrl}${path}`, {
    headers: {
      "KC-API-KEY":         cfg.apiKey,
      "KC-API-SIGN":        sign,
      "KC-API-TIMESTAMP":   ts,
      "KC-API-PASSPHRASE":  ppSign,
      "KC-API-KEY-VERSION": "2",
      "Content-Type":       "application/json",
    },
  });
  const data = await res.json() as { code: string; msg: string; data: T };
  if (data.code !== "200000") throw new Error(`KuCoin ${data.code}: ${data.msg}`);
  return data.data;
}

export async function getAccount(cfg: KuCoinConfig): Promise<AccountBalance> {
  const accounts = await signedGet<Array<{ currency: string; balance: string; available: string; type: string }>>(
    cfg, "/api/v1/accounts",
  );
  const usdt = accounts.filter(a => a.currency === "USDT");
  const avail = usdt.reduce((s, a) => s + parseFloat(a.available), 0);
  const total = usdt.reduce((s, a) => s + parseFloat(a.balance), 0);
  return {
    availableBalance:   avail.toFixed(2),
    totalWalletBalance: total.toFixed(2),
  };
}
