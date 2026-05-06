import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, TrendingUp, TrendingDown, Minus, RefreshCw,
  Trash2, Filter, DollarSign, Activity, BarChart3, Target,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, ReferenceLine, CartesianGrid,
} from "recharts";
import { Button } from "@/components/ui/button";
import { useFleetEngine } from "@/engine/fleet-engine";

const BASE_URL = (import.meta as unknown as { env: Record<string, string> }).env?.BASE_URL?.replace(/\/$/, "") ?? "";

interface JournalEntry {
  id:          string;
  signalType:  string;
  ticker:      string;
  entryPrice:  string;
  confidence:  number;
  strategy:    string;
  reasoning:   string | null;
  pnl:         string | null;
  executedAt:  string;
}

function signalColor(type: string) {
  if (type === "BUY")  return { border: "border-emerald-400/25", bg: "bg-emerald-400/8",  text: "text-emerald-400" };
  if (type === "SELL") return { border: "border-red-400/25",     bg: "bg-red-400/8",      text: "text-red-400"     };
  return                      { border: "border-white/[0.1]",    bg: "bg-white/[0.04]",   text: "text-muted-foreground" };
}

function pnlColor(pnl: number | null) {
  if (pnl == null) return "text-muted-foreground/50";
  return pnl >= 0 ? "text-emerald-400" : "text-red-400";
}

function StatCard({ icon: Icon, label, value, sub, color = "text-foreground" }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] p-4"
      style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 52% 5.5%) 100%)" }}>
      <div className="flex items-center gap-2 mb-2.5">
        <Icon size={12} className="text-primary/60" />
        <span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground/50">{label}</span>
      </div>
      <div className={`text-[22px] font-black tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground/40 mt-0.5">{sub}</div>}
    </div>
  );
}

interface PnlPoint { date: string; cumPnl: number; pnl: number; }

function PnlChart({ entries }: { entries: JournalEntry[] }) {
  const sorted = [...entries]
    .filter(e => e.pnl != null)
    .sort((a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime());

  if (sorted.length < 2) return null;

  let cum = 0;
  const data: PnlPoint[] = sorted.map(e => {
    const p = parseFloat(e.pnl!);
    cum += p;
    const d = new Date(e.executedAt);
    return {
      date: `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`,
      cumPnl: parseFloat(cum.toFixed(4)),
      pnl: parseFloat(p.toFixed(4)),
    };
  });

  const maxAbs = Math.max(...data.map(d => Math.abs(d.cumPnl)), 1);
  const isPositive = data[data.length - 1]?.cumPnl >= 0;
  const lineColor = isPositive ? "#34d399" : "#f87171";

  return (
    <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
      style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 52% 5.5%) 100%)" }}>
      <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      <div className="px-5 py-4 flex items-center gap-2.5 border-b border-white/[0.05]">
        <BarChart3 size={14} className="text-primary/70" />
        <h3 className="text-[14px] font-bold">Cumulative P&L</h3>
        <span className="text-[11px] text-muted-foreground/40 ml-auto">{sorted.length} closed trades</span>
      </div>
      <div className="px-2 pb-4 pt-3" style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: "rgba(255,255,255,0.25)" }}
              axisLine={false} tickLine={false}
              interval={Math.max(0, Math.floor(data.length / 5) - 1)}
            />
            <YAxis
              domain={[-maxAbs * 1.15, maxAbs * 1.15]}
              tick={{ fontSize: 9, fill: "rgba(255,255,255,0.25)" }}
              axisLine={false} tickLine={false}
              tickFormatter={(v: number) => `$${v.toFixed(1)}`}
              width={46}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(228 52% 6%)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                fontSize: 11,
                color: "#e2e8f0",
              }}
              formatter={(value: number, name: string) => [
                `${value >= 0 ? "+" : ""}${value.toFixed(4)} USDT`,
                name === "cumPnl" ? "Cumulative P&L" : "Trade P&L",
              ]}
            />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />
            <Line
              type="monotone" dataKey="cumPnl"
              stroke={lineColor} strokeWidth={2}
              dot={false} activeDot={{ r: 4, fill: lineColor, stroke: "none" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function JournalPage() {
  const [entries,   setEntries]   = useState<JournalEntry[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState<"ALL" | "BUY" | "SELL">("ALL");
  const [deleting,  setDeleting]  = useState<string | null>(null);
  const { executedSignals } = useFleetEngine();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/journal`);
      if (res.ok) {
        const data = await res.json() as JournalEntry[];
        setEntries(data);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await fetch(`${BASE_URL}/api/journal/${id}`, { method: "DELETE" });
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch { /* ignore */ } finally {
      setDeleting(null);
    }
  };

  const filtered = filter === "ALL"
    ? entries
    : entries.filter(e => e.signalType === filter);

  const totalPnl = entries.reduce((sum, e) => sum + (e.pnl ? parseFloat(e.pnl) : 0), 0);
  const wins     = entries.filter(e => e.pnl && parseFloat(e.pnl) > 0).length;
  const losses   = entries.filter(e => e.pnl && parseFloat(e.pnl) < 0).length;
  const winRate  = entries.length > 0 ? ((wins / entries.length) * 100).toFixed(1) : "—";

  const avgConf  = entries.length > 0
    ? Math.round(entries.reduce((s, e) => s + e.confidence, 0) / entries.length)
    : 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-black tracking-tight">Trade Journal</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Full history of all executed signals with outcomes
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}
          className="flex items-center gap-2 text-[12px] border border-white/[0.08] hover:border-white/[0.15]">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Activity}    label="Total Entries"   value={entries.length}      sub="all signals logged" />
        <StatCard icon={DollarSign}  label="Total P&L"       value={`${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)} USDT`}
          color={totalPnl >= 0 ? "text-emerald-400" : "text-red-400"} sub={`${wins} wins · ${losses} losses`} />
        <StatCard icon={BarChart3}   label="Win Rate"        value={winRate === "—" ? "—" : `${winRate}%`}
          color="text-primary" sub={entries.length > 0 ? `${wins}W / ${losses}L` : "no data yet"} />
        <StatCard icon={Target}      label="Avg Confidence"  value={avgConf > 0 ? `${avgConf}%` : "—"}
          color="text-blue-400" sub="signal quality" />
      </div>

      {/* P&L Chart */}
      <PnlChart entries={entries} />

      {/* In-memory executed signals (not yet persisted) */}
      {executedSignals.length > 0 && entries.length === 0 && (
        <div className="rounded-2xl border border-amber-400/15 p-5"
          style={{ background: "rgba(245,158,11,0.03)" }}>
          <div className="flex items-center gap-2.5 mb-4">
            <Activity size={14} className="text-amber-400/70" />
            <h3 className="text-[14px] font-bold text-amber-400/90">Session Signals</h3>
            <span className="text-[11px] text-muted-foreground/40 ml-auto">saved to database when trades close</span>
          </div>
          <div className="space-y-2">
            {[...executedSignals].reverse().slice(0, 5).map((s, i) => {
              const c = signalColor(s.type);
              return (
                <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${c.border}`}
                  style={{ background: "rgba(255,255,255,0.02)" }}>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${c.border} ${c.bg} ${c.text}`}>{s.type}</span>
                  <span className="text-[12px] text-muted-foreground flex-1">{s.ticker}</span>
                  <span className="text-[11px] text-muted-foreground/50">{(s.confidence * 100).toFixed(0)}% conf</span>
                  <span className={`text-[12px] font-bold tabular-nums ${pnlColor(s.pnl)}`}>
                    {s.pnl != null ? `${s.pnl >= 0 ? "+" : ""}${s.pnl.toFixed(2)} USDT` : "pending"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Journal table */}
      <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
        style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 52% 5.5%) 100%)" }}>

        <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        <div className="px-5 py-4 flex items-center justify-between border-b border-white/[0.05]">
          <div className="flex items-center gap-2.5">
            <BookOpen size={14} className="text-primary/70" />
            <h3 className="text-[14px] font-bold">Journal Entries</h3>
            <span className="text-[11px] text-muted-foreground/40">{filtered.length} records</span>
          </div>
          <div className="flex items-center gap-1">
            <Filter size={11} className="text-muted-foreground/40 mr-1" />
            {(["ALL", "BUY", "SELL"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                  filter === f ? "bg-primary/15 text-primary border border-primary/25" : "text-muted-foreground/40 hover:text-muted-foreground border border-transparent"
                }`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32 text-[12px] text-muted-foreground/40">
            <RefreshCw size={16} className="animate-spin mr-2" /> Loading journal…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <BookOpen size={28} className="text-muted-foreground/20 mb-3" />
            <p className="text-[13px] text-muted-foreground/50 font-medium">No journal entries yet</p>
            <p className="text-[11px] text-muted-foreground/30 mt-1">
              Entries are saved automatically when the bot closes a trade
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {["Signal", "Ticker", "Entry Price", "Confidence", "Strategy", "P&L", "Date", ""].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold tracking-wider uppercase text-muted-foreground/40">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {filtered.map((entry, i) => {
                    const c   = signalColor(entry.signalType);
                    const pnl = entry.pnl ? parseFloat(entry.pnl) : null;
                    const date = new Date(entry.executedAt);
                    return (
                      <motion.tr
                        key={entry.id}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.18, delay: i * 0.01 }}
                        className="border-b border-white/[0.03] hover:bg-white/[0.015] transition-colors group"
                      >
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-black ${c.border} ${c.bg} ${c.text}`}>
                            {entry.signalType === "BUY"  ? <TrendingUp  size={9} /> :
                             entry.signalType === "SELL" ? <TrendingDown size={9} /> :
                                                           <Minus        size={9} />}
                            {entry.signalType}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold">{entry.ticker}</td>
                        <td className="px-4 py-3 font-mono tabular-nums">
                          ${parseFloat(entry.entryPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] max-w-[60px]">
                              <div className="h-full rounded-full bg-primary"
                                style={{ width: `${entry.confidence}%` }} />
                            </div>
                            <span className="tabular-nums text-muted-foreground">{entry.confidence}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[160px] truncate" title={entry.strategy}>
                          {entry.strategy}
                        </td>
                        <td className={`px-4 py-3 font-bold tabular-nums ${pnlColor(pnl)}`}>
                          {pnl != null
                            ? `${pnl >= 0 ? "+" : ""}${pnl.toFixed(4)} USDT`
                            : <span className="text-muted-foreground/30 text-[11px] italic">pending</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-muted-foreground/40 text-[11px] tabular-nums">
                          {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => void handleDelete(entry.id)}
                            disabled={deleting === entry.id}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground/30 hover:text-red-400 transition-all p-1 rounded"
                            title="Delete entry"
                          >
                            {deleting === entry.id
                              ? <RefreshCw size={11} className="animate-spin" />
                              : <Trash2 size={11} />}
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reasoning panel — latest entry */}
      {filtered.length > 0 && filtered[0].reasoning && (
        <div className="rounded-2xl border border-white/[0.07] p-5"
          style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 52% 5.5%) 100%)" }}>
          <div className="flex items-center gap-2.5 mb-3">
            <Activity size={13} className="text-primary/60" />
            <h3 className="text-[13px] font-bold">Latest Signal Reasoning</h3>
            <span className="text-[11px] text-muted-foreground/40 ml-auto">
              {new Date(filtered[0].executedAt).toLocaleString()}
            </span>
          </div>
          <p className="text-[13px] text-muted-foreground leading-relaxed">{filtered[0].reasoning}</p>
        </div>
      )}
    </div>
  );
}
