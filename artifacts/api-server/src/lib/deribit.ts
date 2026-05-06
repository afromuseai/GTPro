export interface DeribitConfig {
  apiKey:    string;
  apiSecret: string;
  baseUrl:   string;
}

export interface AccountBalance {
  availableBalance:   string;
  totalWalletBalance: string;
}

export const getBaseUrl = (testnet: boolean) =>
  testnet ? "https://test.deribit.com" : "https://www.deribit.com";

async function authenticate(cfg: DeribitConfig): Promise<string> {
  const res = await fetch(`${cfg.baseUrl}/api/v2/public/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id:      1,
      method:  "public/auth",
      params: {
        grant_type:    "client_credentials",
        client_id:     cfg.apiKey,
        client_secret: cfg.apiSecret,
      },
    }),
  });
  const data = await res.json() as { result?: { access_token: string }; error?: { message: string } };
  if (data.error) throw new Error(`Deribit auth: ${data.error.message}`);
  return data.result!.access_token;
}

export async function getAccount(cfg: DeribitConfig): Promise<AccountBalance> {
  const token = await authenticate(cfg);
  const res   = await fetch(
    `${cfg.baseUrl}/api/v2/private/get_account_summary?currency=USDT&extended=true`,
    { headers: { "Authorization": `Bearer ${token}` } },
  );
  const data  = await res.json() as {
    result?: { available_funds: number; balance: number };
    error?:  { message: string };
  };
  if (data.error) throw new Error(`Deribit: ${data.error.message}`);
  const r = data.result!;
  return {
    availableBalance:   (r.available_funds ?? 0).toFixed(2),
    totalWalletBalance: (r.balance         ?? 0).toFixed(2),
  };
}
