import { createHmac } from "crypto";

export interface OKXConfig {
  apiKey:     string;
  apiSecret:  string;
  passphrase: string;
  baseUrl:    string;
}

export interface AccountBalance {
  availableBalance:   string;
  totalWalletBalance: string;
}

export const getBaseUrl = (_testnet: boolean) => "https://www.okx.com";
export const requiresPassphrase = true;

async function signedGet<T>(cfg: OKXConfig, path: string): Promise<T> {
  const ts = new Date().toISOString();
  const payload = ts + "GET" + path;
  const sign = createHmac("sha256", cfg.apiSecret).update(payload).digest("base64");

  const res = await fetch(`${cfg.baseUrl}${path}`, {
    headers: {
      "OK-ACCESS-KEY":        cfg.apiKey,
      "OK-ACCESS-SIGN":       sign,
      "OK-ACCESS-TIMESTAMP":  ts,
      "OK-ACCESS-PASSPHRASE": cfg.passphrase,
      "Content-Type":         "application/json",
    },
  });
  const data = await res.json() as T & { code: string; msg: string };
  if (data.code !== "0") throw new Error(`OKX ${data.code}: ${data.msg}`);
  return data;
}

export async function getAccount(cfg: OKXConfig): Promise<AccountBalance> {
  const data = await signedGet<{
    data: Array<{ totalEq: string; details: Array<{ ccy: string; availEq: string; availBal: string }> }>;
  }>(cfg, "/api/v5/account/balance");

  const account = data.data?.[0];
  const usdt = account?.details?.find(d => d.ccy === "USDT") ?? account?.details?.[0];
  return {
    availableBalance:   usdt?.availEq   ?? usdt?.availBal ?? "0",
    totalWalletBalance: account?.totalEq ?? "0",
  };
}
