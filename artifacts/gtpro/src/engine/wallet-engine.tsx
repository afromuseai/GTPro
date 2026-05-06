import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";

export interface WalletUser {
  id:              string;
  email:           string;
  balance:         number;
  lockedBalance:   number;
  totalSpent:      number;
  billingPlan:     string;
  planExpiresAt:   Date | null;
  isExpired:       boolean;
  includedHours:   number;
  usedHours:       number;
  activeSessions:  number;
}

export interface Transaction {
  id:          string;
  type:        string;
  amount:      number;
  description: string;
  createdAt:   Date;
}

export interface BotSession {
  id:                string;
  strategy:          string;
  status:            string;
  startTime:         Date;
  endTime:           Date | null;
  estimatedDuration: number;
  actualDuration:    number | null;
  totalCost:         number | null;
  simulatedProfit:   number | null;
}

interface WalletContextValue {
  user:             WalletUser | null;
  transactions:     Transaction[];
  isLoading:        boolean;
  error:            string | null;
  refreshWallet:    () => Promise<void>;
  deposit:          (amount: number) => Promise<{ success: boolean; newBalance: number }>;
  subscribePlan:    (plan: string) => Promise<{ success: boolean; plan: string; expiresAt: Date | null; newBalance: number }>;
  startBotSession:  (strategy: string, estimatedHours: number) => Promise<{ sessionId: string; estimatedCost: number; hourlyRate: number; paidFromPlan: boolean }>;
  endBotSession:    (sessionId: string, simulatedProfit?: number) => Promise<{ actualCost: number; refund: number; simulatedProfit: number }>;
  getSession:       (sessionId: string) => Promise<BotSession>;
}

export const WalletContext = createContext<WalletContextValue>({
  user:             null,
  transactions:     [],
  isLoading:        false,
  error:            null,
  refreshWallet:    async () => {},
  deposit:          async () => ({ success: false, newBalance: 0 }),
  subscribePlan:    async () => ({ success: false, plan: "free", expiresAt: null, newBalance: 0 }),
  startBotSession:  async () => ({ sessionId: "", estimatedCost: 0, hourlyRate: 0, paidFromPlan: false }),
  endBotSession:    async () => ({ actualCost: 0, refund: 0, simulatedProfit: 0 }),
  getSession:       async () => ({} as BotSession),
});

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [user,         setUser]         = useState<WalletUser | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const authFetch = useCallback(async (path: string, init?: RequestInit) => {
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

  const refreshWallet = useCallback(async () => {
    try {
      const res = await authFetch("/api/billing/user");
      if (!res.ok) throw new Error(`Failed to fetch wallet (${res.status})`);
      const data = (await res.json()) as WalletUser;
      data.planExpiresAt = data.planExpiresAt ? new Date(data.planExpiresAt) : null;
      setUser(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet fetch failed");
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  const refreshTransactions = useCallback(async () => {
    try {
      const res = await authFetch("/api/billing/transactions");
      if (!res.ok) return;
      const data = (await res.json()) as Transaction[];
      setTransactions(
        data.map(t => ({ ...t, createdAt: new Date(t.createdAt) })),
      );
    } catch {}
  }, [authFetch]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setIsLoading(false);
      setUser(null);
      return;
    }
    refreshWallet();
    refreshTransactions();
    pollRef.current = setInterval(() => {
      refreshWallet();
      refreshTransactions();
    }, 15_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isLoaded, isSignedIn, refreshWallet, refreshTransactions]);

  const deposit = useCallback(async (amount: number) => {
    const res = await authFetch("/api/billing/deposit", {
      method: "POST",
      body: JSON.stringify({ amount }),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      throw new Error(err.error ?? "Deposit failed");
    }
    const data = await res.json() as { success: boolean; newBalance: number };
    await refreshWallet();
    await refreshTransactions();
    return data;
  }, [authFetch, refreshWallet, refreshTransactions]);

  const subscribePlan = useCallback(async (plan: string) => {
    const res = await authFetch("/api/billing/subscribe", {
      method: "POST",
      body: JSON.stringify({ plan }),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      throw new Error(err.error ?? "Plan change failed");
    }
    const data = (await res.json()) as { success: boolean; plan: string; expiresAt: string | null; newBalance: number };
    await refreshWallet();
    await refreshTransactions();
    return { ...data, expiresAt: data.expiresAt ? new Date(data.expiresAt) : null };
  }, [authFetch, refreshWallet, refreshTransactions]);

  const startBotSession = useCallback(async (strategy: string, estimatedHours: number) => {
    const res = await authFetch("/api/bot/session/start", {
      method: "POST",
      body: JSON.stringify({ strategy, estimatedHours }),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      throw new Error(err.error ?? "Session start failed");
    }
    await refreshWallet();
    return await res.json() as { sessionId: string; estimatedCost: number; hourlyRate: number; paidFromPlan: boolean };
  }, [authFetch, refreshWallet]);

  const endBotSession = useCallback(async (sessionId: string, simulatedProfit = 0) => {
    const res = await authFetch("/api/bot/session/end", {
      method: "POST",
      body: JSON.stringify({ sessionId, simulatedProfit }),
    });
    if (!res.ok) throw new Error("Session end failed");
    await refreshWallet();
    await refreshTransactions();
    return await res.json() as { actualCost: number; refund: number; simulatedProfit: number };
  }, [authFetch, refreshWallet, refreshTransactions]);

  const getSession = useCallback(async (sessionId: string) => {
    const res = await authFetch(`/api/bot/session/${sessionId}`);
    if (!res.ok) throw new Error("Session fetch failed");
    const data = (await res.json()) as BotSession;
    data.startTime = new Date(data.startTime);
    data.endTime = data.endTime ? new Date(data.endTime) : null;
    return data;
  }, [authFetch]);

  return (
    <WalletContext.Provider
      value={{ user, transactions, isLoading, error, refreshWallet, deposit, subscribePlan, startBotSession, endBotSession, getSession }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
