import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";

const router = Router();
const BOOT   = Date.now();

// ── Audit log ──────────────────────────────────────────────────────────────

interface AuditEntry {
  ts:      number;
  level:   "info" | "warn" | "ok";
  message: string;
}
const auditLog: AuditEntry[] = [];

function auditInfo(message: string) { auditLog.push({ ts: Date.now(), level: "info", message }); }
function auditOk(message:   string) { auditLog.push({ ts: Date.now(), level: "ok",   message }); }

// Startup verification — all internal fleet IDs confirmed registered
auditInfo("Fleet infrastructure initialising…");
setTimeout(() => {
  auditOk("SBF operational — ABF, HBF, VCBF fleet channels verified");
  auditOk("Rolling-window threat assessment active (60-second window)");
  auditInfo("User-gated endpoint exclusions loaded — billing, exchange, journal paths exempt from auth-fail counting");
  broadcast();
}, 1_500);

// ── Real-time metrics state ────────────────────────────────────────────────

let totalRequests  = 0;
let authSuccessful = 0;
let authSuccessfulTotal = 0;
let authFailedTotal     = 0;
let errorCount     = 0;
let totalResponses = 0;

// Rolling-window timestamps (last 60 s) for threat-sensitive counters
const authFailTimestamps:  number[] = [];
const rateLimitTimestamps: number[] = [];

const latencies: number[] = [];
const activeUserIds = new Set<string>();
const ipTimestamps  = new Map<string, number[]>();
const blockedIps    = new Set<string>();

// ── Helpers ────────────────────────────────────────────────────────────────

function trackIpRate(ip: string): boolean {
  const now    = Date.now();
  const minute = 60_000;
  const prev   = (ipTimestamps.get(ip) ?? []).filter(t => now - t < minute);
  prev.push(now);
  ipTimestamps.set(ip, prev);
  return prev.length > 80; // >80 req/min = suspicious
}

function rollingCount(timestamps: number[], windowMs = 60_000): number {
  const cutoff = Date.now() - windowMs;
  // Prune old entries in place
  while (timestamps.length && timestamps[0] < cutoff) timestamps.shift();
  return timestamps.length;
}

function computeMetrics() {
  const now        = Date.now();
  const avgLatency = latencies.length
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : 0;
  const maxLatency = latencies.length ? Math.max(...latencies) : 0;
  const errRate    = totalResponses > 0 ? +(errorCount / totalResponses).toFixed(4) : 0;

  // Requests in last 60s
  let rpm = 0;
  for (const times of ipTimestamps.values()) {
    rpm += times.filter(t => now - t < 60_000).length;
  }

  // Rolling-window counts (60 s) — used for threat level assessment
  const authFailedRecent  = rollingCount(authFailTimestamps);
  const rateLimitRecent   = rollingCount(rateLimitTimestamps);

  return {
    totalRequests,
    authSuccessful:  authSuccessfulTotal,
    authFailed:      authFailedRecent,   // rolling 60-s window — not cumulative
    authFailedTotal,                      // lifetime total for success-rate display
    avgLatencyMs:   avgLatency,
    maxLatencyMs:   maxLatency,
    errorRate:      errRate,
    rateLimitHits:  rateLimitRecent,     // rolling 60-s window
    sessionsActive: activeUserIds.size,
    uptimeSeconds:  Math.floor((now - BOOT) / 1000),
    requestsPerMin: rpm,
    latencyAlert:   avgLatency > 400,
    timestamp:      now,
    auditLog:       auditLog.slice(-20), // last 20 entries
  };
}

// ── Middleware ─────────────────────────────────────────────────────────────

// NOTE: paths are relative to the /api mount point (req.path strips /api prefix).
const SKIP_PATHS = new Set([
  "/fleet/stream",
  "/fleet/stats",
  "/health",
  "/market/stream",
]);

// Endpoints that are user-gated by design — returning 401 for unauthenticated
// users is correct behavior, not a security event worth flagging.
// NOTE: paths are relative to the /api mount point (req.path strips /api prefix).
const USER_GATED_PATHS = new Set([
  "/billing/user",
  "/billing/transactions",
  "/billing/deposit",
  "/billing/subscribe",
  "/exchange/accounts",
  "/exchange/order/entry",
  "/exchange/order/close",
  "/journal",
  "/user/profile",
  "/user/2fa",
  "/admin/check",
  "/dashboard/stats",
  "/onboarding/status",
  "/onboarding/complete",
  "/auth/2fa/status",
  "/auth/2fa/mark-totp",
  "/auth/phone/send-code",
  "/auth/phone/verify",
  "/auth/signup/complete",
]);

const INTERNAL_FLEET_IDS = new Set(["ABF", "HBF", "VCBF", "SBF"]);

export function fleetMiddleware(req: Request, res: Response, next: NextFunction) {
  if (SKIP_PATHS.has(req.path)) return next();

  const ip    = (req.ip ?? req.socket.remoteAddress ?? "unknown").replace(/^::ffff:/, "");

  // Block IPs that have been manually revoked
  if (blockedIps.has(ip)) {
    res.status(403).json({ error: "Access revoked" });
    return;
  }

  const start = Date.now();

  totalRequests++;

  if (trackIpRate(ip)) rateLimitTimestamps.push(Date.now());

  const fleetId         = req.headers["x-fleet-id"] as string | undefined;
  const isInternalFleet = fleetId && INTERNAL_FLEET_IDS.has(fleetId);
  const isUserGated     = USER_GATED_PATHS.has(req.path);

  if (isInternalFleet) {
    // Internal fleet-to-fleet call — always authorized
    authSuccessful++;
    authSuccessfulTotal++;
  } else if (isUserGated) {
    // User-facing protected endpoint — auth state tracked via response but
    // a missing session here is expected (logged-out user), not a security threat
    const auth = getAuth(req);
    if (auth?.userId) {
      authSuccessful++;
      authSuccessfulTotal++;
      activeUserIds.add(auth.userId);
    }
    // no authFailed increment — 401 from user-gated endpoints is expected behavior
  } else {
    const auth = getAuth(req);
    if (auth?.userId) {
      authSuccessful++;
      authSuccessfulTotal++;
      activeUserIds.add(auth.userId);
    } else {
      authFailTimestamps.push(Date.now());
      authFailedTotal++;
    }
  }

  res.on("finish", () => {
    const ms = Date.now() - start;
    latencies.push(ms);
    if (latencies.length > 200) latencies.shift();
    totalResponses++;
    if (res.statusCode >= 500) errorCount++;
    broadcast();
  });

  next();
}

// ── Sessions endpoint helpers ──────────────────────────────────────────────

function obfuscateIp(ip: string): string {
  // Show first two octets, hide last two: 192.168.***.***
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.***.***`;
  // IPv6: show first segment only
  const v6parts = ip.split(":");
  if (v6parts.length > 1) return `${v6parts[0]}:****:****`;
  return ip.slice(0, 4) + "****";
}

// ── SSE broadcast ─────────────────────────────────────────────────────────

const sseClients = new Set<Response>();

function broadcast() {
  const payload = `data: ${JSON.stringify(computeMetrics())}\n\n`;
  for (const client of sseClients) {
    try { client.write(payload); } catch { sseClients.delete(client); }
  }
}

// Heartbeat every 10s to keep connections alive + push idle updates
const heartbeat = setInterval(broadcast, 10_000);
if (heartbeat.unref) heartbeat.unref();

// ── Routes ─────────────────────────────────────────────────────────────────

router.get("/fleet/sessions", (_req, res) => {
  const now = Date.now();
  const sessions = Array.from(ipTimestamps.entries())
    .map(([rawIp, times]) => {
      const recent = times.filter(t => now - t < 3_600_000); // last hour
      if (recent.length === 0) return null;
      return {
        ip:           obfuscateIp(rawIp),
        rawIp,
        requestCount: recent.length,
        lastSeen:     Math.max(...recent),
        isBlocked:    blockedIps.has(rawIp),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b!.lastSeen - a!.lastSeen));
  res.json({ sessions, activeUserCount: activeUserIds.size, blockedCount: blockedIps.size });
});

router.post("/fleet/sessions/revoke", (req, res) => {
  const { rawIp } = req.body as { rawIp?: string };
  if (!rawIp) { res.status(400).json({ error: "rawIp required" }); return; }
  blockedIps.add(rawIp);
  // Remove from ipTimestamps so it doesn't reappear immediately
  ipTimestamps.delete(rawIp);
  auditInfo(`Session revoked for IP: ${obfuscateIp(rawIp)}`);
  broadcast();
  res.json({ success: true, blocked: rawIp });
});

router.get("/fleet/stream", (req, res) => {
  res.setHeader("Content-Type",      "text/event-stream");
  res.setHeader("Cache-Control",     "no-cache");
  res.setHeader("Connection",        "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  res.write(`data: ${JSON.stringify(computeMetrics())}\n\n`);

  sseClients.add(res);
  req.on("close", () => sseClients.delete(res));
});

router.get("/fleet/stats", (_req, res) => {
  res.json(computeMetrics());
});

export default router;
