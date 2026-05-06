import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Bot, Cpu, Activity, CheckCircle, AlertTriangle, Clock, Zap, TrendingUp, Link, ShieldAlert, ShieldCheck, Bug, Wrench, Loader2, X, Ban, Users, RefreshCw, Server } from "lucide-react";
import { useFleetEngine, FleetLog, FleetId, SecurityEvent, PatchAction, formatUptime } from "@/engine/fleet-engine";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";


// ── Types / helpers ───────────────────────────────────────────────────────────

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 5)  return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

function useNow() {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => { const id = setInterval(() => setNow(Date.now()), 2000); return () => clearInterval(id); }, []);
  return now;
}

const LOG_LEVEL_DOT: Record<string, string> = {
  success: "bg-emerald-400",
  info:    "bg-blue-400",
  warn:    "bg-amber-400",
  alert:   "bg-red-400",
};

const LOG_LEVEL_TEXT: Record<string, string> = {
  success: "text-emerald-400/80",
  info:    "text-blue-400/80",
  warn:    "text-amber-400",
  alert:   "text-red-400",
};

// ── Mini log list ─────────────────────────────────────────────────────────────

function MiniLog({ logs }: { logs: FleetLog[] }) {
  useNow();
  return (
    <div className="space-y-1.5 max-h-[112px] overflow-hidden">
      <AnimatePresence initial={false}>
        {logs.slice(0, 4).map(log => (
          <motion.div
            key={log.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
            className="flex items-start gap-2"
          >
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-[5px] ${LOG_LEVEL_DOT[log.level]}`} />
            <span className={`text-[11px] leading-relaxed ${LOG_LEVEL_TEXT[log.level]}`}>
              {log.message}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ label, color }: { label: string; color: string }) {
  const colors: Record<string, string> = {
    green:  "border-emerald-400/25 bg-emerald-400/8 text-emerald-400",
    blue:   "border-blue-400/25 bg-blue-400/8 text-blue-400",
    amber:  "border-amber-400/25 bg-amber-400/8 text-amber-400",
    red:    "border-red-400/25 bg-red-400/8 text-red-400",
  };
  const dotColors: Record<string, string> = {
    green: "bg-emerald-400", blue: "bg-blue-400", amber: "bg-amber-400", red: "bg-red-400",
  };
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold tracking-widest uppercase ${colors[color]}`}>
      <motion.div
        className={`w-1.5 h-1.5 rounded-full ${dotColors[color]}`}
        animate={{ opacity: [1, 0.3, 1], scale: [1, 0.75, 1] }}
        transition={{ duration: 1.8, repeat: Infinity }}
      />
      {label}
    </div>
  );
}

// ── Fleet Card ────────────────────────────────────────────────────────────────

interface FleetCardProps {
  id: FleetId;
  name: string;
  fullName: string;
  desc: string;
  icon: React.ElementType;
  accentColor: string;
  statusLabel: string;
  statusColor: string;
  stats: Array<{ label: string; value: string | number }>;
  logs: FleetLog[];
  badge?: string;
  badgeColor?: string;
}

function FleetCard({ id, name, fullName, desc, icon: Icon, accentColor, statusLabel, statusColor, stats, logs, badge, badgeColor }: FleetCardProps) {
  const borderAccent: Record<string, string> = {
    blue:    "border-blue-400/20 hover:border-blue-400/35",
    emerald: "border-emerald-400/20 hover:border-emerald-400/35",
    primary: "border-primary/20 hover:border-primary/35",
  };
  const topAccent: Record<string, string> = {
    blue:    "via-blue-400/40",
    emerald: "via-emerald-400/40",
    primary: "via-primary/40",
  };
  const iconBg: Record<string, string> = {
    blue:    "bg-blue-400/10 border-blue-400/20 text-blue-400",
    emerald: "bg-emerald-400/10 border-emerald-400/20 text-emerald-400",
    primary: "bg-primary/10 border-primary/15 text-primary",
  };
  const badgeBgMap: Record<string, string> = {
    green:  "bg-emerald-400/10 border-emerald-400/25 text-emerald-400",
    blue:   "bg-blue-400/10 border-blue-400/25 text-blue-400",
    amber:  "bg-amber-400/10 border-amber-400/25 text-amber-400",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      transition={{ duration: 0.5 }}
      className={`rounded-2xl border overflow-hidden transition-all duration-300 ${borderAccent[accentColor]}`}
      style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 52% 5.5%) 100%)" }}
    >
      <div className={`h-px bg-gradient-to-r from-transparent ${topAccent[accentColor]} to-transparent`} />
      <div className="p-5">

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${iconBg[accentColor]}`}>
              <Icon size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[11px] font-black tracking-[0.16em] uppercase text-muted-foreground/60">{id}</span>
                {badge && badgeColor && (
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider ${badgeBgMap[badgeColor]}`}>
                    {badge}
                  </span>
                )}
              </div>
              <h3 className="text-[14px] font-black leading-tight">{name}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
            </div>
          </div>
          <StatusBadge label={statusLabel} color={statusColor} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {stats.map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-white/[0.05] p-2.5 text-center"
              style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground/60 mb-1 leading-tight">{label}</div>
              <div className="text-[15px] font-black tabular-nums">{value}</div>
            </div>
          ))}
        </div>

        {/* Live log feed */}
        <div className="rounded-xl border border-white/[0.05] p-3"
          style={{ background: "rgba(0,0,0,0.15)" }}>
          <div className="flex items-center gap-1.5 mb-2.5">
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-emerald-400"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className="text-[9px] font-black tracking-[0.22em] uppercase text-muted-foreground/50">Live Events</span>
          </div>
          {logs.length === 0 ? (
            <div className="text-[11px] text-muted-foreground/40 italic">Awaiting events…</div>
          ) : (
            <MiniLog logs={logs} />
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Security Intelligence Panel ───────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, { dot: string; badge: string; text: string }> = {
  low:      { dot: "bg-blue-400",    badge: "border-blue-400/25 bg-blue-400/8 text-blue-400",       text: "text-blue-400"    },
  medium:   { dot: "bg-amber-400",   badge: "border-amber-400/25 bg-amber-400/8 text-amber-400",     text: "text-amber-400"   },
  high:     { dot: "bg-red-400",     badge: "border-red-400/25 bg-red-400/8 text-red-400",           text: "text-red-400"     },
  critical: { dot: "bg-red-500",     badge: "border-red-500/30 bg-red-500/10 text-red-400",          text: "text-red-400 font-black" },
};

const SOURCE_STYLES: Record<string, string> = {
  SBF:  "text-blue-400 bg-blue-400/10 border-blue-400/25",
  VCBF: "text-emerald-400 bg-emerald-400/10 border-emerald-400/25",
};

function SecurityEventRow({ event, patches }: { event: SecurityEvent; patches: PatchAction[] }) {
  const sev  = SEVERITY_STYLES[event.severity] ?? SEVERITY_STYLES["medium"];
  const patch = patches.find(p => p.eventId === event.id);
  useNow();

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-xl border overflow-hidden transition-all duration-300 ${
        event.patched ? "border-white/[0.05]" : "border-red-400/25"
      }`}
      style={{ background: event.patched ? "rgba(255,255,255,0.02)" : "rgba(239,68,68,0.04)" }}
    >
      <div className="p-3">
        <div className="flex items-start gap-2.5">
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-[5px] ${sev.dot} ${!event.patched ? "animate-pulse" : ""}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border shrink-0 tracking-wider ${SOURCE_STYLES[event.source]}`}>
                {event.source}
              </span>
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border tracking-wider ${sev.badge}`}>
                {event.severity.toUpperCase()}
              </span>
              <span className="text-[11px] font-bold truncate">{event.type}</span>
              <span className="text-[10px] text-muted-foreground/35 ml-auto shrink-0">
                {timeAgo(event.timestamp)}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground/60 mt-1 leading-relaxed">{event.description}</p>

            {/* Patch result */}
            <AnimatePresence>
              {patch && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  transition={{ duration: 0.3 }}
                  className="mt-2 pt-2 border-t border-white/[0.06] flex items-start gap-2"
                >
                  <ShieldCheck size={11} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-black text-emerald-400">{patch.action}</span>
                    <span className="text-[10px] text-muted-foreground/50 ml-1.5">{patch.description}</span>
                  </div>
                </motion.div>
              )}
              {!event.patched && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-2 flex items-center gap-1.5"
                >
                  <motion.div
                    className="w-1 h-1 rounded-full bg-amber-400"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  />
                  <span className="text-[10px] text-amber-400/70 font-bold">Patch in progress…</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Threat Alert Banner ───────────────────────────────────────────────────────

function ThreatAlertBanner() {
  const { sbfStats } = useFleetEngine();
  const [dismissed, setDismissed] = useState(false);
  const prevLevel = React.useRef(sbfStats.threatLevel);

  // Auto-clear dismiss when threat level drops back to low
  React.useEffect(() => {
    if (prevLevel.current !== "low" && sbfStats.threatLevel === "low") {
      setDismissed(false);
    }
    prevLevel.current = sbfStats.threatLevel;
  }, [sbfStats.threatLevel]);

  const isHigh = sbfStats.threatLevel === "high";
  const isMed  = sbfStats.threatLevel === "medium";
  const show   = (isHigh || isMed) && !dismissed;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.3 }}
          className={`relative rounded-2xl border overflow-hidden flex items-center gap-3 px-5 py-4 ${
            isHigh
              ? "border-red-500/40 bg-red-500/10"
              : "border-amber-500/40 bg-amber-500/10"
          }`}
        >
          {/* Pulsing glow line */}
          <motion.div
            className={`absolute top-0 left-0 right-0 h-[2px] ${isHigh ? "bg-red-500" : "bg-amber-500"}`}
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />

          {/* Icon */}
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${
              isHigh ? "bg-red-500/20" : "bg-amber-500/20"
            }`}
          >
            <ShieldAlert size={16} className={isHigh ? "text-red-400" : "text-amber-400"} />
          </motion.div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className={`text-[13px] font-bold ${isHigh ? "text-red-300" : "text-amber-300"}`}>
              {isHigh ? "HIGH THREAT DETECTED" : "ELEVATED THREAT LEVEL"}
            </div>
            <div className="text-[11px] text-muted-foreground/70 mt-0.5">
              SBF is detecting {isHigh ? "critical" : "elevated"} security activity —{" "}
              {sbfStats.alertCount} auth failure{sbfStats.alertCount !== 1 ? "s" : ""},{" "}
              {sbfStats.threatsBlocked} rate-limit hit{sbfStats.threatsBlocked !== 1 ? "s" : ""} in the last 60 seconds
            </div>
          </div>

          {/* Dismiss */}
          <button
            onClick={() => setDismissed(true)}
            className="shrink-0 p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors text-muted-foreground/50 hover:text-muted-foreground"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── SBF Audit Log Panel ───────────────────────────────────────────────────────

function SBFAuditPanel() {
  const { sbfAuditLog } = useFleetEngine();

  const levelColor = {
    ok:   "text-emerald-400",
    info: "text-blue-400/80",
    warn: "text-amber-400",
  };
  const levelDot = {
    ok:   "bg-emerald-400",
    info: "bg-blue-400",
    warn: "bg-amber-400",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.18 }}
      className="rounded-2xl border border-white/[0.07] overflow-hidden"
      style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 52% 5%) 100%)" }}
    >
      <div className="h-px bg-gradient-to-r from-transparent via-blue-400/20 to-transparent" />
      <div className="p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <Shield size={15} className="text-blue-400" />
          <h3 className="text-[14px] font-bold">SBF Startup Audit</h3>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-blue-400/20 text-[10px] text-blue-400">
            <motion.div className="w-1 h-1 rounded-full bg-blue-400"
              animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
            Live
          </div>
        </div>

        {sbfAuditLog.length === 0 ? (
          <div className="flex items-center gap-2 py-2">
            <Loader2 size={13} className="animate-spin text-muted-foreground/40" />
            <span className="text-[12px] text-muted-foreground/40 italic">Waiting for fleet verification…</span>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {sbfAuditLog.map((entry, i) => (
                <motion.div
                  key={entry.ts + i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.04 }}
                  className="flex items-start gap-2.5"
                >
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-[5px] ${levelDot[entry.level]}`} />
                  <div className="flex-1 min-w-0">
                    <span className={`text-[12px] leading-relaxed ${levelColor[entry.level]}`}>
                      {entry.message}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/30 shrink-0 tabular-nums">
                    {new Date(entry.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function SecurityIntelPanel() {
  const { securityEvents, patchActions, sbfPatchCount, vcbfPatchCount } = useFleetEngine();
  const [sourceFilter, setSourceFilter] = useState<"ALL" | "SBF" | "VCBF">("ALL");
  useNow();

  const filtered = sourceFilter === "ALL" ? securityEvents : securityEvents.filter(e => e.source === sourceFilter);
  const openCount   = securityEvents.filter(e => !e.patched).length;
  const critCount   = securityEvents.filter(e => e.severity === "critical").length;
  const totalPatched = sbfPatchCount + vcbfPatchCount;

  if (securityEvents.length === 0) return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-white/[0.07] overflow-hidden"
      style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 52% 5%) 100%)" }}
    >
      <div className="h-px bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />
      <div className="p-5">
        <div className="flex items-center gap-2.5 mb-2">
          <ShieldCheck size={15} className="text-emerald-400" />
          <h3 className="text-[14px] font-bold">Security Intelligence</h3>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-emerald-400/20 text-[10px] text-emerald-400">
            <motion.div className="w-1 h-1 rounded-full bg-emerald-400" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
            Monitoring
          </div>
        </div>
        <p className="text-[12px] text-muted-foreground/50 italic">
          SBF and VCBF are actively scanning — no threats or vulnerabilities detected yet.
        </p>
      </div>
    </motion.div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.22 }}
      className="rounded-2xl border border-white/[0.07] overflow-hidden"
      style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 52% 5%) 100%)" }}
    >
      <div className="h-px bg-gradient-to-r from-transparent via-red-400/25 to-transparent" />
      <div className="p-5">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <ShieldAlert size={15} className="text-red-400" />
            <h3 className="text-[14px] font-bold">Security Intelligence</h3>
            {openCount > 0 && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-red-400/25 text-[10px] text-red-400 font-bold">
                <motion.div className="w-1 h-1 rounded-full bg-red-400" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.7, repeat: Infinity }} />
                {openCount} Open
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {(["ALL", "SBF", "VCBF"] as const).map(f => (
              <button
                key={f}
                onClick={() => setSourceFilter(f)}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all duration-150 ${
                  sourceFilter === f
                    ? f === "SBF"  ? "border-blue-400/40 bg-blue-400/10 text-blue-400"
                    : f === "VCBF" ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-400"
                    : "border-white/[0.12] bg-white/[0.04] text-foreground"
                    : "border-white/[0.06] text-muted-foreground/50 hover:border-white/[0.12] hover:text-muted-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: "Events",         value: securityEvents.length,  color: "text-foreground" },
            { label: "Critical",       value: critCount,               color: critCount > 0 ? "text-red-400" : "text-foreground" },
            { label: "Auto-Patched",   value: totalPatched,            color: "text-emerald-400" },
            { label: "Open",           value: openCount,               color: openCount > 0 ? "text-amber-400" : "text-emerald-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-white/[0.05] p-2.5 text-center"
              style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="text-[9px] font-bold tracking-wider uppercase text-muted-foreground/50 mb-1">{label}</div>
              <div className={`text-[18px] font-black tabular-nums ${color}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* Event list */}
        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {filtered.slice(0, 20).map(event => (
              <SecurityEventRow key={event.id} event={event} patches={patchActions} />
            ))}
          </AnimatePresence>
          {filtered.length === 0 && (
            <div className="text-[12px] text-muted-foreground/40 italic py-2">No events for this fleet…</div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Unified system log ────────────────────────────────────────────────────────

const FLEET_LABEL_COLORS: Record<FleetId, string> = {
  SBF:  "text-blue-400 bg-blue-400/10 border-blue-400/25",
  VCBF: "text-emerald-400 bg-emerald-400/10 border-emerald-400/25",
  ABF:  "text-primary bg-primary/10 border-primary/25",
  HBF:  "text-violet-400 bg-violet-400/10 border-violet-400/25",
};

function SystemLog({ logs, filter }: { logs: FleetLog[]; filter: FleetId | "ALL" }) {
  useNow();
  const filtered = filter === "ALL" ? logs : logs.filter(l => l.fleet === filter);
  return (
    <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
      <AnimatePresence initial={false}>
        {filtered.slice(0, 40).map(log => (
          <motion.div
            key={log.id}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-start gap-2.5"
          >
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border shrink-0 mt-0.5 tracking-wider ${FLEET_LABEL_COLORS[log.fleet]}`}>
              {log.fleet}
            </span>
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-[5px] ${LOG_LEVEL_DOT[log.level]}`} />
            <div className="flex-1 min-w-0">
              <span className={`text-[11px] leading-relaxed ${LOG_LEVEL_TEXT[log.level]}`}>{log.message}</span>
              <span className="text-[10px] text-muted-foreground/30 ml-2">{timeAgo(log.timestamp)}</span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      {filtered.length === 0 && (
        <div className="text-[12px] text-muted-foreground/40 italic py-2">No events yet…</div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function FleetsPage() {
  const { sbfLogs, vcbfLogs, abfLogs, allLogs, sbfStats, vcbfStats, abfStats } = useFleetEngine();
  const [logFilter, setLogFilter] = useState<FleetId | "ALL">("ALL");
  const now = useNow();

  const totalEvents = sbfStats.eventsProcessed + vcbfStats.eventsProcessed + abfStats.eventsProcessed;
  const systemHealthColor = vcbfStats.healthScore >= 90 ? "text-emerald-400" : vcbfStats.healthScore >= 75 ? "text-amber-400" : "text-red-400";

  return (
    <div className="space-y-7 max-w-6xl mx-auto w-full">

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="flex items-start justify-between"
      >
        <div>
          <h2 className="text-2xl font-black tracking-tight">System Fleets</h2>
          <p className="text-[13px] text-muted-foreground mt-1">
            Three autonomous bot fleets running continuously in parallel — 24/7, non-stop.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/8 text-emerald-400 text-[11px] font-bold">
            <motion.div className="w-1.5 h-1.5 rounded-full bg-emerald-400"
              animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.4, repeat: Infinity }} />
            All Systems Operational
          </div>
        </div>
      </motion.div>

      {/* ── System summary strip ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        {[
          { label: "Total Events", value: totalEvents.toLocaleString(), icon: Activity, color: "text-primary" },
          { label: "System Health", value: `${vcbfStats.healthScore}/100`, icon: CheckCircle, color: systemHealthColor },
          { label: "Threat Level", value: sbfStats.threatLevel.toUpperCase(), icon: Shield, color: sbfStats.threatLevel === "low" ? "text-emerald-400" : "text-amber-400" },
          { label: "Uptime",       value: formatUptime(abfStats.uptimeSeconds), icon: Clock, color: "text-blue-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-white/[0.06] p-3.5"
            style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 52% 6%) 100%)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Icon size={13} className={color} />
              <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/60">{label}</span>
            </div>
            <div className={`text-[20px] font-black tabular-nums ${color}`}>{value}</div>
          </div>
        ))}
      </motion.div>

      {/* ── Fleet cards ── */}
      <div className="grid md:grid-cols-3 gap-5">

        {/* ABF */}
        <FleetCard
          id="ABF"
          name="Agent Bot Fleet"
          fullName="Agent Bot Fleet"
          desc="AI market analysis and signal generation engine — active per user session."
          icon={Bot}
          accentColor="primary"
          statusLabel="Active"
          statusColor="green"
          stats={[
            { label: "Signals",    value: abfStats.signalsGenerated },
            { label: "Decisions",  value: abfStats.decisionsToday },
            { label: "Win Rate",   value: `${abfStats.winRate.toFixed(1)}%` },
          ]}
          logs={abfLogs}
          badge="Core Engine"
          badgeColor="amber"
        />

        {/* SBF */}
        <FleetCard
          id="SBF"
          name="Security Bot Fleet"
          fullName="Security Bot Fleet"
          desc="Continuous authentication, session integrity, and API usage monitoring."
          icon={Shield}
          accentColor="blue"
          statusLabel="Monitoring"
          statusColor="blue"
          stats={[
            { label: "Sessions",  value: sbfStats.sessionsValidated },
            { label: "Threats",   value: sbfStats.threatsBlocked },
            { label: "Alerts",    value: sbfStats.alertCount },
          ]}
          logs={sbfLogs}
          badge={sbfStats.threatLevel === "low" ? "Threat: Low" : "Threat: Med"}
          badgeColor={sbfStats.threatLevel === "low" ? "green" : "amber"}
        />

        {/* VCBF */}
        <FleetCard
          id="VCBF"
          name="Vulnerability Check"
          fullName="Vulnerability Check Bot Fleet"
          desc="Signal integrity validator — checks every ABF signal before execution."
          icon={Cpu}
          accentColor="emerald"
          statusLabel="Scanning"
          statusColor="green"
          stats={[
            { label: "Checked",  value: vcbfStats.signalsChecked },
            { label: "Approved", value: vcbfStats.signalsApproved },
            { label: "Warned",   value: vcbfStats.signalsWarned + vcbfStats.signalsBlocked },
          ]}
          logs={vcbfLogs}
          badge={vcbfStats.status === "nominal" ? "Nominal" : "Degraded"}
          badgeColor={vcbfStats.status === "nominal" ? "green" : "amber"}
        />
      </div>

      {/* ── Unified System Log ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.2 }}
        className="rounded-2xl border border-white/[0.07] overflow-hidden"
        style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 52% 5%) 100%)" }}
      >
        <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <Activity size={15} className="text-primary" />
              <h3 className="text-[14px] font-bold">Unified System Log</h3>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-white/[0.08] text-[10px] text-muted-foreground/50">
                <motion.div className="w-1 h-1 rounded-full bg-emerald-400"
                  animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
                Live
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {(["ALL", "ABF", "SBF", "VCBF"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setLogFilter(f)}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all duration-150 ${
                    logFilter === f
                      ? f === "SBF"  ? "border-blue-400/40 bg-blue-400/10 text-blue-400"
                      : f === "VCBF" ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-400"
                      : f === "ABF"  ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-white/[0.12] bg-white/[0.04] text-foreground"
                      : "border-white/[0.06] text-muted-foreground/50 hover:border-white/[0.12] hover:text-muted-foreground"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <SystemLog logs={allLogs} filter={logFilter} />
        </div>
      </motion.div>

      {/* ── Threat Alert Banner ── */}
      <ThreatAlertBanner />

      {/* ── SBF Audit Log ── */}
      <SBFAuditPanel />

      {/* ── Active Sessions ── */}
      <ActiveSessionsTable />

      {/* ── Security Intelligence ── */}
      <SecurityIntelPanel />

      {/* ── Execution history (if any signals executed) ── */}
      <ExecutionHistoryPanel />
    </div>
  );
}

// ── Active Sessions Table ─────────────────────────────────────────────────────

interface SessionEntry {
  ip:           string;
  rawIp:        string;
  requestCount: number;
  lastSeen:     number;
  isBlocked:    boolean;
}

function tsAgo(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 5)  return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function ActiveSessionsTable() {
  const [sessions,   setSessions]   = useState<SessionEntry[]>([]);
  const [userCount,  setUserCount]  = useState(0);
  const [blocked,    setBlocked]    = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [revoking,   setRevoking]   = useState<string | null>(null);
  const [, forceRender] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/fleet/sessions`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json() as { sessions: SessionEntry[]; activeUserCount: number; blockedCount: number };
      setSessions(data.sessions);
      setUserCount(data.activeUserCount);
      setBlocked(data.blockedCount);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10_000);
    const tick = setInterval(() => forceRender(n => n + 1), 5_000);
    return () => { clearInterval(id); clearInterval(tick); };
  }, [refresh]);

  const revoke = async (rawIp: string) => {
    setRevoking(rawIp);
    try {
      await fetch(`${BASE}/api/fleet/sessions/revoke`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawIp }),
      });
      await refresh();
    } catch {}
    finally { setRevoking(null); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.2 }}
      className="rounded-2xl border border-white/[0.07] overflow-hidden"
      style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 52% 5%) 100%)" }}
    >
      <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      <div className="p-5">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <Users size={15} className="text-primary" />
            <h3 className="text-[14px] font-bold">Active Sessions</h3>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-white/[0.08] text-[10px] text-muted-foreground/50">
              <motion.div className="w-1 h-1 rounded-full bg-emerald-400"
                animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
              Live
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Summary pills */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-400/20 bg-emerald-400/8 text-[10px] font-bold text-emerald-400">
                <Server size={9} /> {userCount} Auth'd Users
              </div>
              {blocked > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-red-400/25 bg-red-400/8 text-[10px] font-bold text-red-400">
                  <Ban size={9} /> {blocked} Blocked
                </div>
              )}
            </div>
            <button onClick={refresh}
              className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-muted-foreground transition-colors hover:bg-white/[0.04]">
              <RefreshCw size={12} />
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center gap-2 py-3">
            <Loader2 size={13} className="animate-spin text-muted-foreground/40" />
            <span className="text-[12px] text-muted-foreground/40 italic">Loading session data…</span>
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-xl border border-white/[0.05] px-4 py-5 text-center"
            style={{ background: "rgba(255,255,255,0.02)" }}>
            <p className="text-[12px] text-muted-foreground/50 italic">No active sessions recorded yet. Sessions appear as requests are made to the platform.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-5 px-4 py-2 text-[10px] font-black tracking-[0.18em] uppercase text-muted-foreground/40 border-b border-white/[0.06]"
              style={{ background: "rgba(0,0,0,0.2)" }}>
              <span>IP Address</span>
              <span className="col-span-1 text-center">Requests</span>
              <span className="col-span-1 text-center">Last Seen</span>
              <span className="col-span-1 text-center">Status</span>
              <span className="col-span-1 text-right">Action</span>
            </div>

            <AnimatePresence initial={false}>
              {sessions.map((s, i) => (
                <motion.div
                  key={s.rawIp}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.25, delay: i * 0.03 }}
                  className={`grid grid-cols-5 items-center px-4 py-3 border-b border-white/[0.04] last:border-0 transition-colors ${
                    s.isBlocked ? "bg-red-400/[0.04]" : "hover:bg-white/[0.025]"
                  }`}
                >
                  {/* IP */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.isBlocked ? "bg-red-400" : "bg-emerald-400"}`} />
                    <span className="font-mono text-[11px] text-foreground truncate">{s.ip}</span>
                  </div>

                  {/* Request count */}
                  <div className="text-center">
                    <span className="font-mono text-[12px] font-bold tabular-nums">{s.requestCount}</span>
                  </div>

                  {/* Last seen */}
                  <div className="text-center">
                    <span className="text-[11px] text-muted-foreground">{tsAgo(s.lastSeen)}</span>
                  </div>

                  {/* Status */}
                  <div className="flex justify-center">
                    {s.isBlocked ? (
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full border border-red-400/30 bg-red-400/10 text-red-400 tracking-wider uppercase">
                        Revoked
                      </span>
                    ) : (
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full border border-emerald-400/25 bg-emerald-400/8 text-emerald-400 tracking-wider uppercase">
                        Active
                      </span>
                    )}
                  </div>

                  {/* Revoke */}
                  <div className="flex justify-end">
                    {!s.isBlocked ? (
                      <motion.button
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => revoke(s.rawIp)}
                        disabled={revoking === s.rawIp}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-400/20 bg-red-400/5 text-red-400/70 hover:text-red-400 hover:border-red-400/35 hover:bg-red-400/10 transition-all text-[10px] font-bold disabled:opacity-50"
                      >
                        {revoking === s.rawIp
                          ? <Loader2 size={10} className="animate-spin" />
                          : <Ban size={10} />}
                        Revoke
                      </motion.button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/30 italic">blocked</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground/30 mt-3 leading-relaxed">
          IPs are partially obfuscated for privacy. Revoking blocks all future requests from that IP until server restart.
        </p>
      </div>
    </motion.div>
  );
}

function ExecutionHistoryPanel() {
  const { executedSignals } = useFleetEngine();
  if (executedSignals.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-white/[0.07] overflow-hidden"
      style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 52% 5%) 100%)" }}
    >
      <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      <div className="p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <Zap size={14} className="text-primary" />
          <h3 className="text-[14px] font-bold">Execution History</h3>
          <span className="text-[11px] text-muted-foreground/50">{executedSignals.length} trade{executedSignals.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="space-y-2">
          {executedSignals.slice(0, 10).map(e => (
            <div key={e.signalId} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-white/[0.05]"
              style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className={`text-[11px] font-black px-2 py-0.5 rounded border ${
                e.type === "BUY"
                  ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-400"
                  : "border-red-400/25 bg-red-400/10 text-red-400"
              }`}>{e.type}</div>
              <div className="text-[12px] font-bold font-mono">{e.ticker}</div>
              <div className="text-[12px] text-muted-foreground">{e.confidence}% confidence</div>
              <div className="flex-1" />
              {e.pnl !== null ? (
                <div className={`text-[13px] font-black ${e.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {e.pnl >= 0 ? "+" : ""}${e.pnl.toFixed(2)}
                </div>
              ) : (
                <div className="text-[11px] text-muted-foreground/50 italic">Filling…</div>
              )}
              <div className="text-[10px] text-muted-foreground/40">
                {e.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
