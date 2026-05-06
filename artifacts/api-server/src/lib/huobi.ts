import { createHmac } from "crypto";

export interface HuobiConfig {
  apiKey:    string;
  apiSecret: string;
  baseUrl:   string;
}

export interface AccountBalance {
  availableBalance:   string;
  totalWalletBalance: string;
}

export const getBaseUrl = (_testnet: boolean) => "https://api.huobi.pro";

async function signedGet<T>(cfg: HuobiConfig, path: string): Promise<T> {
  const now        = new Date().toISOString().slice(0, 19);
  const host       = new URL(cfg.baseUrl).host;
  const params: Record<string, string> = {
    AccessKeyId:      cfg.apiKey,
    SignatureMethod:  "HmacSHA256",
    SignatureVersion: "2",
    Timestamp:        now,
  };
  const qs       = Object.keys(params).sort().map(k => `${k}=${encodeURIComponent(params[k])}`).join("&");
  const payload  = `GET\n${host}\n${path}\n${qs}`;
  const sign     = createHmac("sha256", cfg.apiSecret).update(payload).digest("base64");

  const url = `${cfg.baseUrl}${path}?${qs}&Signature=${encodeURIComponent(sign)}`;
  const res = await fetch(url);
  const data = await res.json() as T & { status?: string; "err-msg"?: string };
  if ((data as { status?: string }).status === "error") {
    throw new Error(`Huobi: ${(data as { "err-msg"?: string })["err-msg"] ?? "Unknown error"}`);
  }
  return data;
}

export async function getAccount(cfg: HuobiConfig): Promise<AccountBalance> {
  const accounts = await signedGet<{ data: Array<{ id: number; type: string }> }>(
    cfg, "/v1/account/accounts",
  );
  const spot = accounts.data?.find(a => a.type === "spot");
  if (!spot) throw new Error("No Huobi spot account found");

  const bal = await signedGet<{ data: { list: Array<{ currency: string; type: string; balance: string }> } }>(
    cfg, `/v1/account/accounts/${spot.id}/balance`,
  );
  const usdt = bal.data?.list?.filter(b => b.currency === "usdt");
  const avail = parseFloat(usdt?.find(b => b.type === "trade")?.balance ?? "0");
  const frozen = parseFloat(usdt?.find(b => b.type === "frozen")?.balance ?? "0");
  return {
    availableBalance:   avail.toFixed(2),
    totalWalletBalance: (avail + frozen).toFixed(2),
  };
}
