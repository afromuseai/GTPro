import { createHmac } from "crypto";

export interface BybitConfig {
  apiKey:    string;
  apiSecret: string;
  baseUrl:   string;
}

export interface AccountBalance {
  availableBalance:   string;
  totalWalletBalance: string;
}

export const getBaseUrl = (testnet: boolean) =>
  testnet ? "https://api-testnet.bybit.com" : "https://api.bybit.com";

async function signedGet<T>(cfg: BybitConfig, path: string, params: Record<string, string> = {}): Promise<T> {
  const ts = Date.now().toString();
  const recvWindow = "5000";
  const qs = new URLSearchParams(params).toString();
  const payload = ts + cfg.apiKey + recvWindow + qs;
  const sign = createHmac("sha256", cfg.apiSecret).update(payload).digest("hex");

  const url = `${cfg.baseUrl}${path}${qs ? "?" + qs : ""}`;
  const res = await fetch(url, {
    headers: {
      "X-BAPI-API-KEY":      cfg.apiKey,
      "X-BAPI-SIGN":         sign,
      "X-BAPI-TIMESTAMP":    ts,
      "X-BAPI-RECV-WINDOW":  recvWindow,
    },
  });
  const data = await res.json() as T & { retCode: number; retMsg: string };
  if (data.retCode !== 0) throw new Error(`Bybit ${data.retCode}: ${data.retMsg}`);
  return data;
}

export async function getAccount(cfg: BybitConfig): Promise<AccountBalance> {
  const data = await signedGet<{ result: { list: Array<{ totalAvailableBalance: string; totalWalletBalance: string }> } }>(
    cfg, "/v5/account/wallet-balance", { accountType: "UNIFIED" },
  );
  const wallet = data.result?.list?.[0];
  if (!wallet) throw new Error("No Bybit wallet found");
  return {
    availableBalance:   wallet.totalAvailableBalance ?? "0",
    totalWalletBalance: wallet.totalWalletBalance    ?? "0",
  };
}
