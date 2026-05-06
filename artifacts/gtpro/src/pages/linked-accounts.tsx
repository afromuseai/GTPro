import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  LinkIcon, Plus, X, Eye, EyeOff, Loader2, CheckCircle,
  AlertCircle, Lock, KeyRound, UserCheck, Wifi, WifiOff, Zap, TestTube,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useExchange } from "@/engine/exchange-engine";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Broker =
  | "Binance" | "Bybit" | "OKX" | "Kraken" | "Coinbase"
  | "KuCoin" | "Bitfinex" | "Gate.io" | "MEXC" | "Deribit"
  | "MT5" | "MT4" | "cTrader" | "Phemex" | "Huobi" | "Gemini" | "BitMEX";

type BrokerCategory = "All" | "Crypto" | "Derivatives" | "Forex";
type ConnectMode    = "api" | "terminal";

interface BrokerMeta {
  color:       string;
  bg:          string;
  border:      string;
  desc:        string;
  category:    Exclude<BrokerCategory, "All">;
  connectMode: ConnectMode;
  live?:       boolean;
  passphrase?: boolean;
}

// ── Broker config ─────────────────────────────────────────────────────────────

const BROKER_CONFIG: Record<Broker, BrokerMeta> = {
  "Binance":  { color: "text-yellow-400",  bg: "bg-yellow-400/10",  border: "border-yellow-400/25",  desc: "Futures (USDT-M)",    category: "Crypto",      connectMode: "api",      live: true },
  "Bybit":    { color: "text-orange-400",  bg: "bg-orange-400/10",  border: "border-orange-400/25",  desc: "Derivatives",          category: "Crypto",      connectMode: "api",      live: true },
  "OKX":      { color: "text-slate-300",   bg: "bg-slate-300/10",   border: "border-slate-300/25",   desc: "Spot & Futures",       category: "Crypto",      connectMode: "api",      live: true, passphrase: true },
  "Kraken":   { color: "text-violet-400",  bg: "bg-violet-400/10",  border: "border-violet-400/25",  desc: "Spot & Margin",        category: "Crypto",      connectMode: "api",      live: true },
  "Coinbase": { color: "text-blue-400",    bg: "bg-blue-400/10",    border: "border-blue-400/25",    desc: "Advanced Trade",       category: "Crypto",      connectMode: "api",      live: true, passphrase: true },
  "KuCoin":   { color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/25", desc: "Spot & Futures",       category: "Crypto",      connectMode: "api",      live: true, passphrase: true },
  "Bitfinex": { color: "text-lime-400",    bg: "bg-lime-400/10",    border: "border-lime-400/25",    desc: "Margin & Spot",        category: "Crypto",      connectMode: "api",      live: true },
  "Gate.io":  { color: "text-rose-400",    bg: "bg-rose-400/10",    border: "border-rose-400/25",    desc: "Spot & Perpetuals",    category: "Crypto",      connectMode: "api",      live: true },
  "MEXC":     { color: "text-cyan-400",    bg: "bg-cyan-400/10",    border: "border-cyan-400/25",    desc: "Spot & Futures",       category: "Crypto",      connectMode: "api",      live: true },
  "Huobi":    { color: "text-red-400",     bg: "bg-red-400/10",     border: "border-red-400/25",     desc: "Spot & Futures",       category: "Crypto",      connectMode: "api",      live: true },
  "Gemini":   { color: "text-sky-300",     bg: "bg-sky-300/10",     border: "border-sky-300/25",     desc: "Spot & Derivatives",   category: "Crypto",      connectMode: "api",      live: true },
  "Deribit":  { color: "text-amber-400",   bg: "bg-amber-400/10",   border: "border-amber-400/25",   desc: "Options & Futures",    category: "Derivatives", connectMode: "api",      live: true },
  "Phemex":   { color: "text-purple-400",  bg: "bg-purple-400/10",  border: "border-purple-400/25",  desc: "Perpetuals",           category: "Derivatives", connectMode: "api",      live: true },
  "BitMEX":   { color: "text-red-300",     bg: "bg-red-300/10",     border: "border-red-300/25",     desc: "Perpetuals & Spot",    category: "Derivatives", connectMode: "api",      live: true },
  "MT5":      { color: "text-indigo-400",  bg: "bg-indigo-400/10",  border: "border-indigo-400/25",  desc: "Forex & CFDs",         category: "Forex",       connectMode: "terminal" },
  "MT4":      { color: "text-blue-300",    bg: "bg-blue-300/10",    border: "border-blue-300/25",    desc: "Forex & CFDs",         category: "Forex",       connectMode: "terminal" },
  "cTrader":  { color: "text-teal-400",    bg: "bg-teal-400/10",    border: "border-teal-400/25",    desc: "Forex & CFDs",         category: "Forex",       connectMode: "terminal" },
};

const ALL_BROKERS    = Object.keys(BROKER_CONFIG) as Broker[];
const CATEGORIES: BrokerCategory[] = ["All", "Crypto", "Derivatives", "Forex"];

// Terminal accounts stored in localStorage
interface TerminalAccount {
  id:     string;
  broker: Broker;
  login:  string;
  addedAt: string;
}

function loadTerminalAccounts(): TerminalAccount[] {
  try { return JSON.parse(localStorage.getItem("gtpro_terminal_accounts") ?? "[]"); }
  catch { return []; }
}
function saveTerminalAccounts(a: TerminalAccount[]) {
  localStorage.setItem("gtpro_terminal_accounts", JSON.stringify(a));
}

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
async function apiFetch(path: string, init?: RequestInit) {
  return fetch(`${BASE}${path}`, { credentials: "include", ...init });
}

// ── Live Account Card ─────────────────────────────────────────────────────────

function LiveAccountCard({
  exchange, balance, walletBalance, testnet, demo, connected, onDisconnect, disconnecting,
}: {
  exchange:     string;
  balance:      number;
  walletBalance:number;
  testnet:      boolean;
  demo:         boolean;
  connected:    boolean;
  onDisconnect: () => void;
  disconnecting:boolean;
}) {
  const cfg = BROKER_CONFIG[exchange as Broker] ?? BROKER_CONFIG["Bybit"];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`rounded-2xl border overflow-hidden ${connected ? cfg.border : "border-white/[0.08]"}`}
      style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}
    >
      <div className={`h-px bg-gradient-to-r from-transparent ${connected ? `via-${cfg.color.replace("text-", "")}/40` : "via-white/[0.06]"} to-transparent`} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${cfg.bg} border ${cfg.border} flex items-center justify-center`}>
              {connected
                ? <Wifi size={16} className={cfg.color} />
                : <WifiOff size={16} className="text-muted-foreground" />
              }
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[14px] font-black ${cfg.color}`}>{exchange}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  !connected
                    ? "text-red-400 border-red-400/30 bg-red-400/10"
                    : demo
                    ? "text-blue-400 border-blue-400/30 bg-blue-400/10"
                    : testnet
                    ? "text-amber-400 border-amber-400/30 bg-amber-400/10"
                    : "text-emerald-400 border-emerald-400/30 bg-emerald-400/10"
                }`}>
                  {!connected ? "ERROR" : demo ? "DEMO" : testnet ? "TESTNET" : "LIVE"}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{cfg.desc}</div>
            </div>
          </div>

          <Button
            variant="outline" size="sm" onClick={onDisconnect} disabled={disconnecting}
            className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-300 text-[11px] font-semibold shrink-0 h-7 px-2.5"
          >
            {disconnecting ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
            <span className="ml-1">Disconnect</span>
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { label: "Available Balance", value: `$${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
            { label: "Wallet Balance",    value: `$${walletBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
            { label: "Status",            value: connected ? "Active" : "Error" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-white/[0.06] p-3" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-1">{label}</div>
              <div className={`text-[13px] font-bold ${label === "Status" ? (connected ? "text-emerald-400" : "text-red-400") : "text-foreground"}`}>{value}</div>
            </div>
          ))}
        </div>

        {connected && (
          <div className="flex items-center gap-2 mt-3 px-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-muted-foreground">
              Connected · Bots will execute real orders on this account
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function LinkedAccountsPage() {
  const { accounts, refreshStatus } = useExchange();

  const [terminalAccounts, setTerminalAccounts] = useState<TerminalAccount[]>(loadTerminalAccounts);
  const [showForm,      setShowForm]      = useState(false);
  const [broker,        setBroker]        = useState<Broker>("Binance");
  const [category,      setCategory]      = useState<BrokerCategory>("All");

  const [apiKey,        setApiKey]        = useState("");
  const [secretKey,     setSecretKey]     = useState("");
  const [passphrase,    setPassphrase]    = useState("");
  const [showSecret,    setShowSecret]    = useState(false);
  const [showPass,      setShowPass]      = useState(false);
  const [testnetMode,   setTestnetMode]   = useState(false);
  const [demoMode,      setDemoMode]      = useState(false);

  const [server,        setServer]        = useState("");
  const [login,         setLogin]         = useState("");
  const [password,      setPassword]      = useState("");
  const [showTermPass,  setShowTermPass]  = useState(false);

  const [connecting,    setConnecting]    = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [success,       setSuccess]       = useState(false);
  const [error,         setError]         = useState("");
  const [geoBlocked,   setGeoBlocked]    = useState(false);

  const cfg          = BROKER_CONFIG[broker];
  const isTerminal   = cfg.connectMode === "terminal";
  const isLive       = Boolean(cfg.live);
  const needsPass    = Boolean(cfg.passphrase);

  const filteredBrokers = ALL_BROKERS.filter(
    b => category === "All" || BROKER_CONFIG[b].category === category,
  );

  function resetForm() {
    setApiKey(""); setSecretKey(""); setPassphrase(""); setServer(""); setLogin(""); setPassword("");
    setShowSecret(false); setShowPass(false); setShowTermPass(false); setError(""); setGeoBlocked(false);
    setTestnetMode(false); setDemoMode(false);
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (isTerminal) {
      if (!server.trim() || !login.trim() || !password.trim()) {
        setError("Server address, login number, and password are required."); return;
      }
    } else {
      if (!apiKey.trim() || !secretKey.trim()) {
        setError("Both API Key and Secret Key are required."); return;
      }
      if (needsPass && !passphrase.trim()) {
        setError(`${broker} requires a Passphrase.`); return;
      }
    }

    setConnecting(true);

    if (!isTerminal) {
      try {
        const res = await apiFetch("/api/exchange/connect", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            exchange: broker,
            apiKey,
            apiSecret:  secretKey,
            passphrase: needsPass ? passphrase : undefined,
            testnet:    testnetMode,
            demo:       demoMode,
          }),
        });
        const data = await res.json() as { connected?: boolean; error?: string; message?: string };
        if (!res.ok || !data.connected) {
          if (data.error === "geo_blocked" || res.status === 451) {
            setGeoBlocked(true);
          } else {
            setError(data.message ?? data.error ?? `Failed to connect to ${broker}. Check your API credentials.`);
          }
          setConnecting(false); return;
        }
        await refreshStatus();
        setSuccess(true);
        await new Promise(r => setTimeout(r, 1200));
        setSuccess(false);
        setShowForm(false);
        resetForm();
      } catch {
        setError("Network error — could not reach the server.");
      } finally {
        setConnecting(false);
      }
      return;
    }

    // Terminal-based (MT4/MT5/cTrader) — local only
    await new Promise(r => setTimeout(r, 1500));
    const newAcc: TerminalAccount = {
      id:      crypto.randomUUID(),
      broker,
      login:   login.trim(),
      addedAt: new Date().toISOString(),
    };
    const updated = [...terminalAccounts, newAcc];
    setTerminalAccounts(updated);
    saveTerminalAccounts(updated);
    setSuccess(true);
    await new Promise(r => setTimeout(r, 1200));
    setSuccess(false);
    setShowForm(false);
    resetForm();
    setConnecting(false);
  }

  async function handleDisconnect(exchange: string) {
    setDisconnecting(exchange);
    try {
      await apiFetch(`/api/exchange/disconnect?exchange=${encodeURIComponent(exchange)}`, { method: "DELETE" });
      await refreshStatus();
    } catch {}
    setDisconnecting(null);
  }

  function removeTerminalAccount(id: string) {
    const updated = terminalAccounts.filter(a => a.id !== id);
    setTerminalAccounts(updated);
    saveTerminalAccounts(updated);
  }

  const totalAccounts = accounts.length + terminalAccounts.length;

  return (
    <div className="space-y-7 max-w-5xl mx-auto w-full">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="flex items-center justify-between"
      >
        <div>
          <h2 className="text-2xl font-black tracking-tight">Linked Accounts</h2>
          <p className="text-[13px] text-muted-foreground mt-1">
            Connect exchange accounts to deploy capital with your bots.
            <span className="text-muted-foreground/50"> · {ALL_BROKERS.length} platforms supported</span>
          </p>
        </div>
        <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
          <Button
            onClick={() => setShowForm(v => !v)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-2 transition-all duration-300"
          >
            {showForm ? <X size={15} /> : <Plus size={15} />}
            {showForm ? "Cancel" : "Connect Account"}
          </Button>
        </motion.div>
      </motion.div>

      {/* Security trust strip */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1 }}
        className="grid md:grid-cols-3 gap-3"
      >
        {[
          { icon: Lock,      color: "text-emerald-400", border: "border-emerald-400/18", bg: "bg-emerald-400/[0.04]", title: "No Withdrawal Access",    desc: "GTPro only requests trade execution permissions — never withdrawal." },
          { icon: KeyRound,  color: "text-primary",     border: "border-primary/18",     bg: "bg-primary/[0.04]",     title: "AES-256 Encrypted Keys",  desc: "API keys are encrypted server-side. Raw keys are never stored in plaintext." },
          { icon: UserCheck, color: "text-blue-400",    border: "border-blue-400/18",    bg: "bg-blue-400/[0.04]",    title: "You Control Execution",   desc: "Stop any bot instantly. Full risk control remains yours at all times." },
        ].map(({ icon: Icon, color, border, bg, title, desc }) => (
          <div key={title} className={`flex items-start gap-3 p-3.5 rounded-xl border ${border} ${bg}`}>
            <div className={`w-7 h-7 rounded-lg border ${border} flex items-center justify-center shrink-0 mt-0.5`}
              style={{ background: "rgba(255,255,255,0.04)" }}>
              <Icon size={13} className={color} />
            </div>
            <div>
              <div className="text-[12px] font-bold mb-0.5">{title}</div>
              <div className="text-[11px] text-muted-foreground leading-relaxed">{desc}</div>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Connect Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -16, scaleY: 0.92 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -12, scaleY: 0.95 }}
            transition={{ duration: 0.32 }}
            style={{ transformOrigin: "top" }}
          >
            <div className="rounded-2xl border border-primary/20 overflow-hidden"
              style={{ background: "linear-gradient(160deg, hsl(228 45% 8%) 0%, hsl(228 52% 6%) 100%)" }}>
              <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
              <div className="p-6">
                <h3 className="text-[15px] font-bold mb-5 flex items-center gap-2">
                  <LinkIcon size={15} className="text-primary" />
                  Connect Exchange Account
                </h3>

                <form onSubmit={handleConnect} className="space-y-5">

                  {/* Broker selector */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-[11px] font-bold tracking-[0.16em] uppercase text-muted-foreground">
                        Select Platform
                      </Label>
                      <div className="flex gap-1.5">
                        {CATEGORIES.map(cat => (
                          <button key={cat} type="button" onClick={() => setCategory(cat)}
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all duration-150 ${
                              category === cat
                                ? "border-primary/40 bg-primary/10 text-primary"
                                : "border-white/[0.07] text-muted-foreground/60 hover:border-white/[0.14] hover:text-muted-foreground"
                            }`}>{cat}</button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      <AnimatePresence mode="popLayout">
                        {filteredBrokers.map(b => {
                          const c = BROKER_CONFIG[b];
                          const selected = broker === b;
                          return (
                            <motion.button
                              key={b} layout type="button" onClick={() => { setBroker(b); resetForm(); }}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                              transition={{ duration: 0.15 }}
                              className={`rounded-xl border p-3 text-left transition-all duration-200 relative ${
                                selected
                                  ? `${c.bg} ${c.border} ${c.color}`
                                  : "border-white/[0.07] text-muted-foreground hover:border-white/[0.14] hover:text-foreground"
                              }`}
                              style={{ background: selected ? undefined : "rgba(255,255,255,0.02)" }}
                            >
                              <div className={`text-[12px] font-black leading-tight ${selected ? c.color : ""}`}>{b}</div>
                              <div className="text-[10px] mt-0.5 opacity-60 leading-tight">{c.desc}</div>
                              <div className="text-[9px] mt-1.5 font-bold tracking-wider uppercase opacity-50">{c.category}</div>
                              {c.live && (
                                <span className="absolute top-1.5 right-1.5 text-[8px] font-bold tracking-wider text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded px-1 py-0.5">LIVE</span>
                              )}
                            </motion.button>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Selected broker info bar */}
                  <div className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border ${cfg.border} ${cfg.bg}`}>
                    <div className={`w-2 h-2 rounded-full ${cfg.color.replace("text-", "bg-")}`} />
                    <span className={`text-[12px] font-bold ${cfg.color}`}>{broker}</span>
                    <span className="text-[12px] text-muted-foreground">— {cfg.desc}</span>
                    {isLive && (
                      <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                        <Zap size={10} />REAL EXECUTION
                      </span>
                    )}
                  </div>

                  {/* Credentials */}
                  <AnimatePresence mode="wait">
                    {isTerminal ? (
                      <motion.div key="terminal"
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}
                        className="space-y-4"
                      >
                        <div className={`flex items-start gap-2.5 p-3 rounded-xl border ${cfg.border} ${cfg.bg}`}>
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${cfg.color.replace("text-", "bg-")}`} />
                          <p className="text-[12px] text-muted-foreground leading-relaxed">
                            {broker === "cTrader"
                              ? "Enter your cTrader account ID, server, and trading password."
                              : `Connect using your ${broker} broker credentials — the same login you use in the ${broker} terminal.`}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[12px] font-semibold text-muted-foreground">
                            {broker === "cTrader" ? "Server / Host" : "Broker Server Address"}
                          </Label>
                          <Input value={server} onChange={e => setServer(e.target.value)}
                            placeholder={broker === "cTrader" ? "e.g. demo.ctraderapi.com" : "e.g. ICMarkets-Live01"}
                            className="h-10 bg-white/[0.04] border-white/[0.08] focus:border-primary/40 text-[13px] font-mono" autoComplete="off" />
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[12px] font-semibold text-muted-foreground">
                              {broker === "cTrader" ? "Account ID" : "Login Number"}
                            </Label>
                            <Input value={login} onChange={e => setLogin(e.target.value)}
                              placeholder={broker === "cTrader" ? "e.g. 12345678" : "e.g. 84921037"}
                              className="h-10 bg-white/[0.04] border-white/[0.08] focus:border-primary/40 text-[13px] font-mono" autoComplete="off" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[12px] font-semibold text-muted-foreground">Trading Password</Label>
                            <div className="relative">
                              <Input type={showTermPass ? "text" : "password"} value={password}
                                onChange={e => setPassword(e.target.value)} placeholder="Trading password…"
                                className="h-10 bg-white/[0.04] border-white/[0.08] focus:border-primary/40 text-[13px] font-mono pr-10" autoComplete="off" />
                              <button type="button" onClick={() => setShowTermPass(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                                {showTermPass ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div key={`api-${broker}`}
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}
                        className="space-y-4"
                      >
                        {/* Network mode selector for Binance + Bybit (Live / Demo / Testnet) */}
                        {(broker === "Binance" || broker === "Bybit") && (
                          <div className="p-3.5 rounded-xl border border-white/[0.07]"
                            style={{ background: "rgba(255,255,255,0.02)" }}>
                            <div className="flex items-center gap-2 mb-3">
                              <TestTube size={14} className="text-amber-400 shrink-0" />
                              <div className="text-[12px] font-bold">Network Mode</div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { id: "live",    label: "Live",         desc: "Real funds",                      color: "text-emerald-400", border: "border-emerald-400/30", bg: "bg-emerald-400/10" },
                                { id: "demo",    label: "Demo Trading", desc: "Virtual funds, real credentials", color: "text-blue-400",    border: "border-blue-400/30",    bg: "bg-blue-400/10" },
                                { id: "testnet", label: "Testnet",      desc: "Separate testnet keys",           color: "text-amber-400",   border: "border-amber-400/30",   bg: "bg-amber-400/10" },
                              ].map(opt => {
                                const active = opt.id === "demo" ? demoMode : opt.id === "testnet" ? (testnetMode && !demoMode) : (!testnetMode && !demoMode);
                                return (
                                  <button key={opt.id} type="button"
                                    onClick={() => {
                                      setDemoMode(opt.id === "demo");
                                      setTestnetMode(opt.id === "testnet");
                                    }}
                                    className={`rounded-xl border p-2.5 text-left transition-all duration-150 ${
                                      active ? `${opt.border} ${opt.bg} ${opt.color}` : "border-white/[0.07] text-muted-foreground hover:border-white/[0.14]"
                                    }`}
                                    style={{ background: active ? undefined : "rgba(255,255,255,0.02)" }}
                                  >
                                    <div className={`text-[11px] font-bold leading-tight ${active ? opt.color : ""}`}>{opt.label}</div>
                                    <div className="text-[10px] mt-0.5 opacity-60 leading-tight">{opt.desc}</div>
                                  </button>
                                );
                              })}
                            </div>
                            {demoMode && broker === "Binance" && (
                              <p className="text-[11px] text-blue-300/70 mt-2.5 leading-relaxed">
                                Use your real Binance credentials — demo trading uses virtual funds at <span className="font-mono text-blue-300/90">demo-fapi.binance.com</span>.
                              </p>
                            )}
                            {demoMode && broker === "Bybit" && (
                              <div className="mt-2.5 space-y-1.5">
                                <p className="text-[11px] text-blue-300/70 leading-relaxed">
                                  Demo trading uses virtual funds at <span className="font-mono text-blue-300/90">api-demo.bybit.com</span>.
                                </p>
                                <p className="text-[11px] text-amber-300/70 leading-relaxed font-medium">
                                  ⚠ You must generate the API key from <strong className="text-amber-300/90">within Bybit Demo Trading mode</strong> — mainnet keys will not work here.
                                </p>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                  Steps: Log in to Bybit → Switch to Demo Trading → Avatar → API → Create key.
                                </p>
                              </div>
                            )}
                            {testnetMode && !demoMode && broker === "Binance" && (
                              <p className="text-[11px] text-amber-300/70 mt-2.5 leading-relaxed">
                                Requires separate testnet keys from <span className="font-mono text-amber-300/90">testnet.binancefuture.com</span>.
                              </p>
                            )}
                            {testnetMode && !demoMode && broker === "Bybit" && (
                              <p className="text-[11px] text-amber-300/70 mt-2.5 leading-relaxed">
                                Requires separate testnet keys — register at <span className="font-mono text-amber-300/90">testnet.bybit.com</span>.
                              </p>
                            )}
                          </div>
                        )}

                        {/* Testnet toggle for other exchanges */}
                        {(broker === "Deribit" || broker === "BitMEX" || broker === "Phemex") && (
                          <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/[0.07]"
                            style={{ background: "rgba(255,255,255,0.02)" }}>
                            <div className="flex items-center gap-2.5">
                              <TestTube size={14} className="text-amber-400 shrink-0" />
                              <div>
                                <div className="text-[12px] font-bold">Testnet Mode</div>
                                <div className="text-[11px] text-muted-foreground">Connect to {broker} testnet — no real capital at risk.</div>
                              </div>
                            </div>
                            <Switch checked={testnetMode} onCheckedChange={setTestnetMode} />
                          </div>
                        )}

                        {/* Exchange-specific guidance */}
                        <div className={`flex items-start gap-2.5 p-3 rounded-xl border ${cfg.border} ${cfg.bg}`}>
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${cfg.color.replace("text-", "bg-")}`} />
                          <p className="text-[12px] text-muted-foreground leading-relaxed">
                            <strong className={cfg.color}>{broker}</strong>{" "}
                            {broker === "Binance" && <>Create API keys at <strong className="text-foreground">binance.com → API Management</strong>. Enable <strong className="text-foreground">Futures trading only</strong> — never enable withdrawal.</>}
                            {broker === "Bybit" && <>Create API keys at <strong className="text-foreground">bybit.com → API</strong>. Enable <strong className="text-foreground">Derivatives / USDT Perpetual</strong> permissions.</>}
                            {broker === "OKX" && <>Create API keys at <strong className="text-foreground">okx.com → API</strong>. Enable <strong className="text-foreground">Trade</strong> permissions. A <strong className="text-foreground">Passphrase</strong> is set during key creation.</>}
                            {broker === "Kraken" && <>Create API keys at <strong className="text-foreground">kraken.com → Security → API</strong>. Enable <strong className="text-foreground">Query Funds</strong> and <strong className="text-foreground">Create & Modify Orders</strong>.</>}
                            {broker === "Coinbase" && <>Create API keys at <strong className="text-foreground">coinbase.com → Settings → API</strong>. A <strong className="text-foreground">Passphrase</strong> is auto-generated during key creation.</>}
                            {broker === "KuCoin" && <>Create API keys at <strong className="text-foreground">kucoin.com → API Management</strong>. Set a <strong className="text-foreground">Passphrase</strong> during key creation.</>}
                            {broker === "Bitfinex" && <>Create API keys at <strong className="text-foreground">bitfinex.com → API Keys</strong>. Enable <strong className="text-foreground">Orders</strong> and <strong className="text-foreground">Wallets</strong> permissions.</>}
                            {broker === "Gate.io" && <>Create API keys at <strong className="text-foreground">gate.io → API Management</strong>. Enable <strong className="text-foreground">Spot / Margin Trade</strong> permissions.</>}
                            {broker === "MEXC" && <>Create API keys at <strong className="text-foreground">mexc.com → API Management</strong>. Enable <strong className="text-foreground">Trade</strong> permissions.</>}
                            {broker === "Deribit" && <>Create API keys at <strong className="text-foreground">deribit.com → Settings → API</strong>. Use <strong className="text-foreground">Client ID</strong> as API Key and <strong className="text-foreground">Client Secret</strong> as Secret Key.</>}
                            {broker === "Phemex" && <>Create API keys at <strong className="text-foreground">phemex.com → API Management</strong>. Enable <strong className="text-foreground">Trading</strong> permissions only.</>}
                            {broker === "BitMEX" && <>Create API keys at <strong className="text-foreground">bitmex.com → API</strong>. Enable <strong className="text-foreground">Order</strong> permissions.</>}
                            {broker === "Huobi" && <>Create API keys at <strong className="text-foreground">huobi.com → API Management</strong>. Enable <strong className="text-foreground">Trade</strong> permissions.</>}
                            {broker === "Gemini" && <>Create API keys at <strong className="text-foreground">gemini.com → API Settings</strong>. Enable <strong className="text-foreground">Trader</strong> role.</>}
                          </p>
                        </div>

                        {/* API Key + Secret */}
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[12px] font-semibold text-muted-foreground">
                              {broker === "Deribit" ? "Client ID" : "API Key"}
                            </Label>
                            <Input value={apiKey} onChange={e => setApiKey(e.target.value)}
                              placeholder={broker === "Deribit" ? "Paste your Client ID…" : "Paste your API key…"}
                              className="h-10 bg-white/[0.04] border-white/[0.08] focus:border-primary/40 text-[13px] font-mono" autoComplete="off" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[12px] font-semibold text-muted-foreground">
                              {broker === "Deribit" ? "Client Secret" : "Secret Key"}
                            </Label>
                            <div className="relative">
                              <Input type={showSecret ? "text" : "password"} value={secretKey}
                                onChange={e => setSecretKey(e.target.value)}
                                placeholder={broker === "Deribit" ? "Paste your Client Secret…" : "Paste your secret key…"}
                                className="h-10 bg-white/[0.04] border-white/[0.08] focus:border-primary/40 text-[13px] font-mono pr-10" autoComplete="off" />
                              <button type="button" onClick={() => setShowSecret(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                                {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Passphrase field (OKX, KuCoin, Coinbase) */}
                        {needsPass && (
                          <div className="space-y-2">
                            <Label className="text-[12px] font-semibold text-muted-foreground">Passphrase</Label>
                            <div className="relative">
                              <Input type={showPass ? "text" : "password"} value={passphrase}
                                onChange={e => setPassphrase(e.target.value)}
                                placeholder="Enter your API passphrase…"
                                className="h-10 bg-white/[0.04] border-white/[0.08] focus:border-primary/40 text-[13px] font-mono pr-10" autoComplete="off" />
                              <button type="button" onClick={() => setShowPass(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="flex items-start gap-2.5 p-3 rounded-xl border border-white/[0.06]"
                          style={{ background: "rgba(255,255,255,0.02)" }}>
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
                          <p className="text-[12px] text-muted-foreground leading-relaxed">
                            Keys are AES-256 encrypted server-side.{" "}
                            <strong className="text-foreground">Enable: trading permissions only.</strong> Disable: withdrawals, transfers.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {geoBlocked && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2.5"
                    >
                      <div className="flex items-center gap-2 text-amber-400">
                        <AlertCircle size={14} className="shrink-0" />
                        <span className="text-[12px] font-bold">Binance Region Restriction</span>
                      </div>
                      <p className="text-[11px] text-amber-300/80 leading-relaxed">
                        Binance blocks API connections from US-based servers. Because GTPro runs on US infrastructure, it cannot reach Binance directly.
                      </p>
                      <div className="text-[11px] text-muted-foreground space-y-1.5 leading-relaxed">
                        <p className="font-semibold text-foreground/80">Your options:</p>
                        <p>• <strong className="text-foreground/70">Use Bybit</strong> — fully supported, no geo-restrictions, same features.</p>
                        <p>• <strong className="text-foreground/70">Deploy to EU/Asia</strong> — self-host GTPro on a non-US server where Binance is accessible.</p>
                      </div>
                    </motion.div>
                  )}

                  {error && !geoBlocked && (
                    <div className="flex items-start gap-2 text-red-400 text-[13px] p-3 rounded-xl border border-red-500/20 bg-red-500/5">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button type="submit" disabled={connecting || success}
                      className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold h-11 gap-2">
                      {connecting ? (
                        <><Loader2 size={15} className="animate-spin" /> Validating…</>
                      ) : success ? (
                        <><CheckCircle size={15} /> Connected</>
                      ) : (
                        <><LinkIcon size={15} /> {isLive ? "Connect & Verify" : "Add Account"}</>
                      )}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => { setShowForm(false); resetForm(); }}
                      className="border-white/[0.1] h-11 px-5">
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connected Accounts */}
      <div className="space-y-4">
        <AnimatePresence>
          {accounts.map(acc => (
            <LiveAccountCard
              key={acc.exchange}
              exchange={acc.exchange}
              balance={acc.balance}
              walletBalance={acc.walletBalance}
              testnet={acc.testnet}
              demo={acc.demo ?? false}
              connected={acc.connected}
              onDisconnect={() => handleDisconnect(acc.exchange)}
              disconnecting={disconnecting === acc.exchange}
            />
          ))}
        </AnimatePresence>

        {/* Terminal accounts */}
        {terminalAccounts.map(acc => {
          const c = BROKER_CONFIG[acc.broker] ?? BROKER_CONFIG["MT5"];
          return (
            <motion.div
              key={acc.id}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="rounded-2xl border border-white/[0.08] overflow-hidden"
              style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}
            >
              <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
              <div className="p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center`}>
                    <Wifi size={14} className={c.color} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[13px] font-black ${c.color}`}>{acc.broker}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border text-emerald-400 border-emerald-400/25 bg-emerald-400/10">CONNECTED</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">Login ••••{acc.login.slice(-4)}</div>
                  </div>
                </div>
                <button onClick={() => removeTerminalAccount(acc.id)}
                  className="w-8 h-8 rounded-lg border border-white/[0.07] flex items-center justify-center text-muted-foreground/60 hover:text-red-400 hover:border-red-500/30 transition-all">
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          );
        })}

        {/* Empty state */}
        {totalAccounts === 0 && !showForm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl border border-white/[0.06] p-10 text-center"
            style={{ background: "rgba(255,255,255,0.01)" }}
          >
            <div className="w-14 h-14 rounded-2xl border border-white/[0.08] bg-white/[0.02] flex items-center justify-center mx-auto mb-4">
              <LinkIcon size={20} className="text-muted-foreground/40" />
            </div>
            <h3 className="text-[15px] font-bold mb-2">No accounts linked</h3>
            <p className="text-[13px] text-muted-foreground max-w-xs mx-auto">
              Connect your first exchange account to start executing live trades with GTPro bots.
            </p>
            <Button onClick={() => setShowForm(true)} size="sm"
              className="mt-5 bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 text-[12px] font-semibold">
              <Plus size={13} className="mr-1.5" /> Connect Exchange
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
