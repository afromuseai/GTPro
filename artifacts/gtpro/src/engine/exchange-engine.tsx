import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";

export interface ExchangeAccount {
  exchange:      string;
  testnet:       boolean;
  demo:          boolean;
  balance:       number;
  walletBalance: number;
  connected:     boolean;
  error?:        string;
}

export interface ExchangeStatus {
  connected:     boolean;
  exchange:      string;
  testnet:       boolean;
  balance:       number;
  walletBalance: number;
}

export interface EntryOrderResult {
  entryOrderId: number;
  tpOrderId:    number;
  slOrderId:    number;
}

interface ExchangeContextValue {
  accounts:      ExchangeAccount[];
  status:        ExchangeStatus | null;
  isLoading:     boolean;
  placeEntry:    (params: {
    direction:   "long" | "short";
    symbol?:     string;
    quantity:    string;
    takeProfit:  string;
    stopLoss:    string;
  }) => Promise<EntryOrderResult | null>;
  closePosition: (params: {
    direction: "long" | "short";
    symbol?:   string;
    quantity:  string;
  }) => Promise<void>;
  refreshStatus: () => Promise<void>;
}

export const ExchangeContext = createContext<ExchangeContextValue>({
  accounts:      [],
  status:        null,
  isLoading:     true,
  placeEntry:    async () => null,
  closePosition: async () => {},
  refreshStatus: async () => {},
});

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export function ExchangeProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const [accounts,  setAccounts]  = useState<ExchangeAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const apiFetch = useCallback(async (path: string, init?: RequestInit) => {
    let token: string | null = null;
    try { token = await getToken(); } catch {}
    return fetch(`${BASE}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
    });
  }, [getToken]);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await apiFetch("/api/exchange/accounts");
      if (!res.ok) { setAccounts([]); return; }
      const data = (await res.json()) as ExchangeAccount[];
      setAccounts(Array.isArray(data) ? data : []);
    } catch {
      setAccounts([]);
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    refreshStatus();
    pollRef.current = setInterval(refreshStatus, 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [refreshStatus]);

  // Backward-compat: expose first connected account as `status`
  const firstConnected = accounts.find(a => a.connected) ?? null;
  const status: ExchangeStatus | null = firstConnected
    ? {
        connected:     true,
        exchange:      firstConnected.exchange,
        testnet:       firstConnected.testnet,
        balance:       firstConnected.balance,
        walletBalance: firstConnected.walletBalance,
      }
    : null;

  const placeEntry = useCallback(async (params: {
    direction:  "long" | "short";
    symbol?:    string;
    quantity:   string;
    takeProfit: string;
    stopLoss:   string;
  }): Promise<EntryOrderResult | null> => {
    try {
      const res = await apiFetch("/api/exchange/order/entry", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ symbol: "BTCUSDT", ...params }),
      });
      if (!res.ok) return null;
      return (await res.json()) as EntryOrderResult;
    } catch {
      return null;
    }
  }, []);

  const closePosition = useCallback(async (params: {
    direction: "long" | "short";
    symbol?:   string;
    quantity:  string;
  }): Promise<void> => {
    try {
      await apiFetch("/api/exchange/order/close", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ symbol: "BTCUSDT", ...params }),
      });
      setTimeout(refreshStatus, 1500);
    } catch {}
  }, [refreshStatus]);

  return (
    <ExchangeContext.Provider value={{ accounts, status, isLoading, placeEntry, closePosition, refreshStatus }}>
      {children}
    </ExchangeContext.Provider>
  );
}

export function useExchange() {
  return useContext(ExchangeContext);
}
