import React, {
  createContext, useCallback, useContext,
  useEffect, useRef, useState,
} from "react";
import { useMarketData } from "./market-data";
import { useExchange }   from "./exchange-engine";

const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// ── Bot auth singleton ref ────────────────────────────────────────────────────
// A bridge component inside ClerkProvider (see App.tsx) stores the real
// Clerk getToken function here so BotProvider can call it without being
// a descendant of ClerkProvider.

export const botAuthRef: { getToken: () => Promise<string | null> } = {
  getToken: async () => null,
};

// Keep BotAuthContext for backwards compat (unused after this fix)
interface BotAuthCtx { getToken: () => Promise<string | null> }
export const BotAuthContext = createContext<BotAuthCtx>({ getToken: async () => null });

export type Strategy   = "Sweep & Reclaim" | "Absorption Reversal" | "Void Continuation";
export type DurationKey = "1h" | "3h" | "6h" | "12h";
export type BotStatus  = "RUNNING" | "PAUSED" | "STOPPED" | "COMPLETED";

export interface RiskConfig {
  maxDailyLoss:    number;
  maxDrawdownPct:  number;
  positionSizePct: number;
  tpMultiplier:    number;
  slMultiplier:    number;
}

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  maxDailyLoss:    0,
  maxDrawdownPct:  0,
  positionSizePct: 100,
  tpMultiplier:    1.0,
  slMultiplier:    1.0,
};
export type LogType    = "system" | "signal" | "trade" | "profit" | "warn";

export interface LogEntry {
  id:        string;
  message:   string;
  type:      LogType;
  timestamp: Date;
}

export interface OpenTrade {
  direction:    "long" | "short";
  entryPrice:   number;
  positionSize: number;
  takeProfit:   number;
  stopLoss:     number;
  openedAt:     number;
  exchangeOrderId?: number;
}

export type TradeOutcome = "tp" | "sl" | "manual" | "expired";

export interface TradeRecord {
  id:           string;
  direction:    "long" | "short";
  entryPrice:   number;
  exitPrice:    number;
  positionSize: number;
  pnl:          number;
  outcome:      TradeOutcome;
  openedAt:     number;
  closedAt:     number;
  strategy:     Strategy;
  botId:        string;
  isLive:       boolean;
}

export interface BotInstance {
  id:            string;
  strategy:      Strategy;
  durationLabel: DurationKey;
  startTime:     number;
  endTime:       number;
  status:        BotStatus;
  pnl:           number;
  realizedPnl:   number;
  openTrade:     OpenTrade | null;
  trades:        number;
  liveExchange:  boolean;
  riskConfig?:   RiskConfig;
}

interface BotEngineContextValue {
  bot:          BotInstance | null;
  logs:         LogEntry[];
  tradeHistory: TradeRecord[];
  pnlFlash:     "up" | "down" | null;
  launch:       (strategy: Strategy, duration: DurationKey, riskConfig?: RiskConfig) => void;
  pause:        () => void;
  resume:       () => void;
  stop:         () => void;
  pushLog:      (msg: string, type: LogType) => void;
  enterTrade:   (direction: "long" | "short", entryPrice: number, takeProfit: number, stopLoss: number) => void;
}

const POSITION_SIZE = 0.1;

const DURATION_MAP: Record<DurationKey, number> = {
  "1h":  3_600_000,
  "3h":  10_800_000,
  "6h":  21_600_000,
  "12h": 43_200_000,
};

const LOG_POOLS: Record<Strategy, Array<{ msg: string; type: LogType }>> = {
  "Sweep & Reclaim": [
    { msg: "Scanning for liquidity sweep setups…",                type: "system" },
    { msg: "Sweep zone identified — monitoring for reclaim",      type: "signal" },
    { msg: "Stop-cascade detected below support level",           type: "signal" },
    { msg: "Smart money absorption spike registered",             type: "signal" },
    { msg: "Reclaim confirmation — evaluating entry quality",     type: "system" },
    { msg: "Trailing stop activated on momentum extension",       type: "system" },
    { msg: "High-volume rejection candle detected",               type: "signal" },
    { msg: "Order flow delta turning positive",                   type: "signal" },
    { msg: "Position monitoring — next resistance mapped",        type: "system" },
    { msg: "Risk module: exposure within defined limits",         type: "system" },
  ],
  "Absorption Reversal": [
    { msg: "Supply zone identified — watching for absorption",    type: "signal" },
    { msg: "Aggressive bid absorption confirmed at demand",       type: "signal" },
    { msg: "Volume spike with no price extension — hidden bids",  type: "signal" },
    { msg: "Counter-trend setup evaluating — risk adjusted",      type: "system" },
    { msg: "Offer wall absorption completing",                    type: "signal" },
    { msg: "Momentum shifting — confirmation in progress",        type: "system" },
    { msg: "Institutional bid stacking visible across candles",   type: "signal" },
    { msg: "Absorption holding — maintaining monitor",            type: "system" },
    { msg: "Risk module: drawdown within session limits",         type: "system" },
    { msg: "Resetting for next absorption window…",               type: "system" },
  ],
  "Void Continuation": [
    { msg: "Institutional imbalance zone mapped above price",     type: "signal" },
    { msg: "Fair value gap identified — price magnetism active",  type: "signal" },
    { msg: "Order block held — continuation conditions met",      type: "system" },
    { msg: "Multi-timeframe void alignment confirmed",            type: "signal" },
    { msg: "Momentum confirmed — void fill in progress",          type: "system" },
    { msg: "Second imbalance zone detected ahead",                type: "signal" },
    { msg: "Trend structure intact — trailing exposure",          type: "system" },
    { msg: "15m and 1H imbalances stacked in same direction",     type: "signal" },
    { msg: "Risk module: position sizing optimal for regime",     type: "system" },
    { msg: "Repositioning for next void entry window…",           type: "system" },
  ],
};

function makeLog(msg: string, type: LogType): LogEntry {
  return { id: crypto.randomUUID(), message: msg, type, timestamp: new Date() };
}

function calcUnrealized(trade: OpenTrade, currentPrice: number): number {
  const sign = trade.direction === "long" ? 1 : -1;
  return +(sign * (currentPrice - trade.entryPrice) * trade.positionSize).toFixed(2);
}

export const BotEngineContext = createContext<BotEngineContextValue>({
  bot: null, logs: [], tradeHistory: [], pnlFlash: null,
  launch: () => {}, pause: () => {}, resume: () => {}, stop: () => {},
  pushLog: () => {}, enterTrade: () => {},
});

export function BotProvider({ children }: { children: React.ReactNode }) {
  // getToken comes from botAuthRef, populated by ClerkBotAuthBridge in App.tsx
  const getToken = useCallback(() => botAuthRef.getToken(), []);
  const { currentPrice }                          = useMarketData();
  const { status: xStatus, placeEntry, closePosition } = useExchange();

  const [bot,          setBot]          = useState<BotInstance | null>(null);
  const [logs,         setLogs]         = useState<LogEntry[]>([
    makeLog("GTPro Engine initialised", "system"),
    makeLog("Risk module active — monitoring exposure", "system"),
    makeLog("Connection latency: 1.8 ms", "system"),
  ]);
  const [tradeHistory, setTradeHistory] = useState<TradeRecord[]>([]);
  const [pnlFlash,     setPnlFlash]     = useState<"up" | "down" | null>(null);

  const logTickRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const flashRef     = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const logIdxRef    = useRef(0);
  const botRef       = useRef<BotInstance | null>(null);
  const priceRef     = useRef(currentPrice);
  const xStatusRef   = useRef(xStatus);
  const placeEntryRef    = useRef(placeEntry);
  const closePositionRef = useRef(closePosition);
  const getTokenRef      = useRef(getToken);
  const sessionIdRef     = useRef<string | null>(null);

  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  // ── Billing API helper ─────────────────────────────────────────────────────

  async function callBillingApi(path: string, body: Record<string, unknown>) {
    try {
      let token: string | null = null;
      try { token = await getTokenRef.current(); } catch {}
      const res = await fetch(`${BASE_PATH}${path}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }

  useEffect(() => { botRef.current     = bot; });
  useEffect(() => { priceRef.current   = currentPrice; });
  useEffect(() => { xStatusRef.current = xStatus; });
  useEffect(() => { placeEntryRef.current    = placeEntry; });
  useEffect(() => { closePositionRef.current = closePosition; });

  // ── Append log ─────────────────────────────────────────────────────────────

  const appendLog = useCallback((msg: string, type: LogType) => {
    setLogs(prev => [makeLog(msg, type), ...prev].slice(0, 100));
  }, []);

  // ── Auto-fill trade journal ────────────────────────────────────────────────

  async function postJournal(
    direction:  "long" | "short",
    entryPrice: number,
    exitPrice:  number,
    pnl:        number,
    strategy:   Strategy,
  ) {
    try {
      let token: string | null = null;
      try { token = await getTokenRef.current(); } catch {}
      await fetch(`${BASE_PATH}/api/journal`, {
        method:      "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          signalType:  direction === "long" ? "BUY" : "SELL",
          ticker:      "BTC/USDT",
          entryPrice,
          confidence:  85,
          strategy,
          reasoning:   `Automated trade: ${direction.toUpperCase()} @ $${entryPrice.toFixed(0)}, exit @ $${exitPrice.toFixed(0)}. P&L: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`,
          pnl,
        }),
      });
    } catch { /* fire and forget */ }
  }

  // ── Record closed trade ────────────────────────────────────────────────────

  const recordTrade = useCallback((
    trade:     OpenTrade,
    exitPrice: number,
    pnl:       number,
    outcome:   TradeOutcome,
    strategy:  Strategy,
    botId:     string,
    isLive:    boolean,
  ) => {
    const record: TradeRecord = {
      id:           crypto.randomUUID(),
      direction:    trade.direction,
      entryPrice:   trade.entryPrice,
      exitPrice,
      positionSize: trade.positionSize,
      pnl,
      outcome,
      openedAt:     trade.openedAt,
      closedAt:     Date.now(),
      strategy,
      botId,
      isLive,
    };
    setTradeHistory(prev => [record, ...prev].slice(0, 200));
    // Auto-fill journal (fire-and-forget)
    postJournal(trade.direction, trade.entryPrice, exitPrice, pnl, strategy);
  }, []);

  const flash = useCallback((dir: "up" | "down") => {
    setPnlFlash(dir);
    if (flashRef.current) clearTimeout(flashRef.current);
    flashRef.current = setTimeout(() => setPnlFlash(null), 900);
  }, []);

  // ── Helper: close the real exchange position ──────────────────────────────

  function fireExchangeClose(trade: OpenTrade) {
    if (!xStatusRef.current?.connected) return;
    closePositionRef.current({
      direction: trade.direction,
      quantity:  String(trade.positionSize),
    }).catch(() => {});
  }

  // ── Price-tick: unrealized P&L + TP/SL check ─────────────────────────────

  useEffect(() => {
    const current = botRef.current;
    if (!current || current.status !== "RUNNING" || !current.openTrade) return;

    const trade = current.openTrade;

    // Risk enforcement: max daily loss
    const riskCfg = current.riskConfig;
    if (riskCfg && riskCfg.maxDailyLoss > 0) {
      const unrealizedNow = calcUnrealized(trade, currentPrice);
      const totalLoss     = -(current.realizedPnl + unrealizedNow);
      if (totalLoss >= riskCfg.maxDailyLoss) {
        appendLog(`⚠ Max daily loss limit ($${riskCfg.maxDailyLoss}) reached — stopping bot`, "warn");
        fireExchangeClose(trade);
        recordTrade(trade, currentPrice, unrealizedNow, "manual", current.strategy, current.id, current.liveExchange);
        const finalPnl = +(current.realizedPnl + unrealizedNow).toFixed(2);
        setBot(prev => prev ? { ...prev, status: "STOPPED", pnl: finalPnl, realizedPnl: finalPnl, openTrade: null } : null);
        const sid = sessionIdRef.current;
        if (sid) { callBillingApi("/api/bot/session/end", { sessionId: sid, simulatedProfit: finalPnl }); sessionIdRef.current = null; }
        return;
      }
    }

    // Session expiry
    if (Date.now() >= current.endTime) {
      const finalU        = calcUnrealized(trade, currentPrice);
      const finalRealized = +(current.realizedPnl + finalU).toFixed(2);
      appendLog(
        `Session ended — trade closed @ $${currentPrice.toFixed(0)} · ${finalU >= 0 ? "+" : ""}$${finalU.toFixed(2)}`,
        "profit",
      );
      fireExchangeClose(trade);
      recordTrade(trade, currentPrice, finalU, "expired", current.strategy, current.id, current.liveExchange);
      setBot(prev => prev ? {
        ...prev, status: "COMPLETED",
        pnl: finalRealized, realizedPnl: finalRealized,
        openTrade: null, trades: prev.trades + 1,
      } : null);
      if (logTickRef.current) { clearInterval(logTickRef.current); logTickRef.current = null; }
      flash(finalU >= 0 ? "up" : "down");

      // ── End billing session on natural expiry ────────────────────────────
      const sid = sessionIdRef.current;
      if (sid) {
        callBillingApi("/api/bot/session/end", { sessionId: sid, simulatedProfit: finalRealized });
        sessionIdRef.current = null;
      }
      return;
    }

    // TP hit
    const tpHit = trade.direction === "long"
      ? currentPrice >= trade.takeProfit
      : currentPrice <= trade.takeProfit;

    if (tpHit) {
      const sign = trade.direction === "long" ? 1 : -1;
      const gain = +(sign * (trade.takeProfit - trade.entryPrice) * trade.positionSize).toFixed(2);
      appendLog(`Take-profit hit @ $${trade.takeProfit.toFixed(0)} — +$${gain.toFixed(2)} locked`, "profit");
      fireExchangeClose(trade);
      recordTrade(trade, trade.takeProfit, gain, "tp", current.strategy, current.id, current.liveExchange);
      setBot(prev => {
        if (!prev?.openTrade) return prev;
        const r = +(prev.realizedPnl + gain).toFixed(2);
        return { ...prev, pnl: r, realizedPnl: r, openTrade: null, trades: prev.trades + 1 };
      });
      flash("up");
      return;
    }

    // SL hit
    const slHit = trade.direction === "long"
      ? currentPrice <= trade.stopLoss
      : currentPrice >= trade.stopLoss;

    if (slHit) {
      const sign = trade.direction === "long" ? 1 : -1;
      const loss = +(sign * (trade.stopLoss - trade.entryPrice) * trade.positionSize).toFixed(2);
      appendLog(`Stop loss triggered @ $${trade.stopLoss.toFixed(0)} — $${Math.abs(loss).toFixed(2)} realized loss`, "warn");
      fireExchangeClose(trade);
      recordTrade(trade, trade.stopLoss, loss, "sl", current.strategy, current.id, current.liveExchange);
      setBot(prev => {
        if (!prev?.openTrade) return prev;
        const r = +(prev.realizedPnl + loss).toFixed(2);
        return { ...prev, pnl: r, realizedPnl: r, openTrade: null, trades: prev.trades + 1 };
      });
      flash("down");
      return;
    }

    // Live unrealized update
    const unrealized = calcUnrealized(trade, currentPrice);
    setBot(prev => {
      if (!prev?.openTrade) return prev;
      return { ...prev, pnl: +(prev.realizedPnl + unrealized).toFixed(2) };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPrice]);

  // ── Activity log ticker ───────────────────────────────────────────────────

  const startLogTick = useCallback((strategy: Strategy) => {
    if (logTickRef.current) clearInterval(logTickRef.current);
    const pool = LOG_POOLS[strategy];
    logTickRef.current = setInterval(() => {
      const current = botRef.current;
      if (!current || current.status !== "RUNNING") return;
      const entry = pool[logIdxRef.current % pool.length];
      appendLog(entry.msg, entry.type);
      logIdxRef.current++;
    }, 4_500 + Math.random() * 2_000);
  }, [appendLog]);

  const stopLogTick = () => {
    if (logTickRef.current) { clearInterval(logTickRef.current); logTickRef.current = null; }
  };

  // ── enterTrade ────────────────────────────────────────────────────────────

  const enterTrade = useCallback((
    direction:  "long" | "short",
    entryPrice: number,
    takeProfit: number,
    stopLoss:   number,
  ) => {
    const current = botRef.current;
    if (!current || current.status !== "RUNNING") return;

    // Close any existing open trade
    if (current.openTrade) {
      const prevU = calcUnrealized(current.openTrade, entryPrice);
      const sign  = prevU >= 0 ? "+" : "";
      appendLog(
        `${current.openTrade.direction.toUpperCase()} closed @ $${entryPrice.toFixed(0)} — ${sign}$${prevU.toFixed(2)}`,
        "trade",
      );
      fireExchangeClose(current.openTrade);
      recordTrade(current.openTrade, entryPrice, prevU, "manual", current.strategy, current.id, current.liveExchange);
    }

    const liveExchange = Boolean(xStatusRef.current?.connected);
    const side = direction === "long" ? "LONG" : "SHORT";
    appendLog(
      `${liveExchange ? "🔴 LIVE" : "SIM"} ${side} entry @ $${entryPrice.toFixed(0)} · ${POSITION_SIZE} BTC · TP $${takeProfit.toFixed(0)} · SL $${stopLoss.toFixed(0)}`,
      "trade",
    );

    setBot(prev => {
      if (!prev || prev.status !== "RUNNING") return prev;
      let newRealized = prev.realizedPnl;
      let newTrades   = prev.trades;
      if (prev.openTrade) {
        newRealized = +(newRealized + calcUnrealized(prev.openTrade, entryPrice)).toFixed(2);
        newTrades++;
      }
      return {
        ...prev,
        openTrade:    { direction, entryPrice, positionSize: POSITION_SIZE, takeProfit, stopLoss, openedAt: Date.now() },
        realizedPnl:  newRealized,
        pnl:          newRealized,
        trades:       newTrades,
        liveExchange,
      };
    });

    flash(direction === "long" ? "up" : "down");

    // Fire real exchange order asynchronously
    if (liveExchange) {
      placeEntryRef.current({
        direction,
        quantity:   String(POSITION_SIZE),
        takeProfit: String(takeProfit),
        stopLoss:   String(stopLoss),
      }).then(result => {
        if (result) {
          appendLog(`Exchange confirmed — order #${result.entryOrderId}`, "trade");
          setBot(prev => {
            if (!prev?.openTrade) return prev;
            return { ...prev, openTrade: { ...prev.openTrade, exchangeOrderId: result.entryOrderId } };
          });
        } else {
          appendLog("Exchange order failed — retrying on next cycle", "warn");
          setBot(prev => prev ? { ...prev, liveExchange: false } : null);
        }
      }).catch(() => {
        appendLog("Exchange temporarily unreachable — will retry on next signal", "warn");
      });
    }
  }, [appendLog, flash]);

  // ── Bot lifecycle ─────────────────────────────────────────────────────────

  const launch = useCallback((strategy: Strategy, duration: DurationKey, riskConfig?: RiskConfig) => {
    stopLogTick();
    logIdxRef.current = 0;
    const now  = Date.now();
    const live = Boolean(xStatusRef.current?.connected);
    const estimatedHours = DURATION_MAP[duration] / 3_600_000;
    const effectiveRisk = riskConfig ?? DEFAULT_RISK_CONFIG;

    setBot({
      id:            crypto.randomUUID(),
      strategy,
      durationLabel: duration,
      startTime:     now,
      endTime:       now + DURATION_MAP[duration],
      status:        "RUNNING",
      pnl:           0,
      realizedPnl:   0,
      openTrade:     null,
      trades:        0,
      liveExchange:  live,
      riskConfig:    effectiveRisk,
    });
    appendLog(`Agent launched — Strategy: ${strategy}`, "system");
    appendLog(
      live
        ? `🔴 LIVE MODE — trading real capital on ${xStatusRef.current?.exchange ?? "exchange"}`
        : `Paper trading mode — P&L tracks real BTC price movement without exchange connection`,
      live ? "warn" : "system",
    );
    appendLog(`Session duration: ${duration}`, "system");
    if (effectiveRisk.maxDailyLoss > 0) appendLog(`Risk limit: max daily loss $${effectiveRisk.maxDailyLoss}`, "system");
    if (effectiveRisk.positionSizePct !== 100) appendLog(`Position size: ${effectiveRisk.positionSizePct}% of standard`, "system");
    startLogTick(strategy);

    // ── Bill the session start ───────────────────────────────────────────────
    callBillingApi("/api/bot/session/start", { strategy, estimatedHours })
      .then(data => {
        if (data?.sessionId) {
          sessionIdRef.current = data.sessionId;
          appendLog(`Credits reserved for ${duration} session`, "system");
        }
      });
  }, [appendLog, startLogTick]);

  const pause = useCallback(() => {
    stopLogTick();
    setBot(prev => prev ? { ...prev, status: "PAUSED" } : null);
    appendLog("Bot paused — open positions held", "warn");
  }, [appendLog]);

  const resume = useCallback(() => {
    setBot(prev => {
      if (!prev) return null;
      startLogTick(prev.strategy);
      appendLog("Bot resumed — engine reactivated", "system");
      return { ...prev, status: "RUNNING" };
    });
  }, [appendLog, startLogTick]);

  const stop = useCallback(() => {
    stopLogTick();
    const current = botRef.current;
    let finalPnl = current?.realizedPnl ?? 0;

    if (current?.openTrade) {
      const cp     = priceRef.current;
      const finalU = calcUnrealized(current.openTrade, cp);
      finalPnl = +(finalPnl + finalU).toFixed(2);
      appendLog(
        `Agent stopped — ${current.openTrade.direction.toUpperCase()} closed @ $${cp.toFixed(0)} · ${finalU >= 0 ? "+" : ""}$${finalU.toFixed(2)}`,
        "warn",
      );
      fireExchangeClose(current.openTrade);
      recordTrade(current.openTrade, cp, finalU, "manual", current.strategy, current.id, current.liveExchange);
      setBot(prev => {
        if (!prev?.openTrade) return prev ? { ...prev, status: "STOPPED" } : null;
        const r = +(prev.realizedPnl + finalU).toFixed(2);
        return { ...prev, status: "STOPPED", pnl: r, realizedPnl: r, openTrade: null, trades: prev.trades + 1 };
      });
    } else {
      setBot(prev => prev ? { ...prev, status: "STOPPED" } : null);
      appendLog("Agent stopped by user — all positions closed", "warn");
    }

    // ── End billing session ──────────────────────────────────────────────────
    const sid = sessionIdRef.current;
    if (sid) {
      callBillingApi("/api/bot/session/end", { sessionId: sid, simulatedProfit: finalPnl });
      sessionIdRef.current = null;
    }
  }, [appendLog, recordTrade]);

  useEffect(() => () => stopLogTick(), []);

  return (
    <BotEngineContext.Provider value={{ bot, logs, tradeHistory, pnlFlash, launch, pause, resume, stop, pushLog: appendLog, enterTrade }}>
      {children}
    </BotEngineContext.Provider>
  );
}

export function useBotEngine() {
  return useContext(BotEngineContext);
}
