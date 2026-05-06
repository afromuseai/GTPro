import { createHmac, createHash } from "crypto";

export interface GateIOConfig {
  apiKey:    string;
  apiSecret: string;
  baseUrl:   string;
}

export interface AccountBalance {
  availableBalance:   string;
  totalWalletBalance: string;
}

export const getBaseUrl = (_testnet: boolean) => "https://api.gateio.ws";

async function signedGet<T>(cfg: GateIOConfig, path: string, query = ""): Promise<T> {
  const ts          = Math.floor(Date.now() / 1000).toString();
  const bodyHash    = createHash("sha512").update("").digest("hex");
  const signStr     = `GET\n${path}\n${query}\n${bodyHash}\n${ts}`;
  const sign        = createHmac("sha512", cfg.apiSecret).update(signStr).digest("hex");

  const url = `${cfg.baseUrl}${path}${query ? "?" + query : ""}`;
  const res = await fetch(url, {
    headers: {
      "KEY":       cfg.apiKey,
      "SIGN":      sign,
      "Timestamp": ts,
      "Accept":    "application/json",
    },
  });
  if (!res.ok) throw new Error(`Gate.io ${res.status}: ${res.statusText}`);
  return res.json() as T;
}

export async function getAccount(cfg: GateIOConfig): Promise<AccountBalance> {
  const accounts = await signedGet<Array<{ currency: string; available: string; locked: string }>>(
    cfg, "/api/v4/spot/accounts",
  );
  const usdt  = accounts.find(a => a.currency === "USDT");
  const avail = parseFloat(usdt?.available ?? "0");
  const total = avail + parseFloat(usdt?.locked ?? "0");
  return {
    availableBalance:   avail.toFixed(2),
    totalWalletBalance: total.toFixed(2),
  };
}
