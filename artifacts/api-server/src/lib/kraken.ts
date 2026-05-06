import { createHmac, createHash } from "crypto";

export interface KrakenConfig {
  apiKey:    string;
  apiSecret: string;
  baseUrl:   string;
}

export interface AccountBalance {
  availableBalance:   string;
  totalWalletBalance: string;
}

export const getBaseUrl = (_testnet: boolean) => "https://api.kraken.com";

function getKrakenSign(path: string, nonce: string, postData: string, secret: string): string {
  const message  = path + createHash("sha256").update(nonce + postData).digest("binary");
  const secretBuf = Buffer.from(secret, "base64");
  return createHmac("sha512", secretBuf).update(message, "binary").digest("base64");
}

async function privatePost<T>(cfg: KrakenConfig, path: string, params: Record<string, string> = {}): Promise<T> {
  const nonce    = Date.now().toString();
  const postData = new URLSearchParams({ nonce, ...params }).toString();
  const sign     = getKrakenSign(path, nonce, postData, cfg.apiSecret);

  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method: "POST",
    headers: {
      "API-Key":      cfg.apiKey,
      "API-Sign":     sign,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: postData,
  });
  const data = await res.json() as { error: string[]; result: T };
  if (data.error?.length) throw new Error(`Kraken: ${data.error.join(", ")}`);
  return data.result;
}

export async function getAccount(cfg: KrakenConfig): Promise<AccountBalance> {
  const balances = await privatePost<Record<string, string>>(cfg, "/0/private/Balance");
  const usdtBal  = parseFloat(balances["USDT"] ?? balances["ZUSD"] ?? "0");
  return {
    availableBalance:   usdtBal.toFixed(2),
    totalWalletBalance: usdtBal.toFixed(2),
  };
}
