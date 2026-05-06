import { Router } from "express";
import crypto from "crypto";
import { db, adminUsers } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const SECRET = process.env.SESSION_SECRET ?? "gtpro-admin-secret-fallback";

// ── Crypto helpers ──────────────────────────────────────────────────────────

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const check = crypto.pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(check), Buffer.from(hash));
}

function signToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body   = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 86_400_000 * 7 })).toString("base64url");
  const sig    = crypto.createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

function verifyToken(token: string): Record<string, unknown> | null {
  try {
    const [header, body, sig] = token.split(".");
    if (!header || !body || !sig) return null;
    const expected = crypto.createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as Record<string, unknown>;
    if (typeof payload.exp === "number" && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── Seed admin on startup ────────────────────────────────────────────────────

export async function seedAdminUser() {
  try {
    // Remove stale fake email if it somehow exists
    await db.delete(adminUsers).where(eq(adminUsers.email, "joshuaa@gmail.com"));

    // Seed joshuaa2g5 admin
    const existing1 = await db.select().from(adminUsers).where(eq(adminUsers.email, "joshuaa2g5@gmail.com")).limit(1);
    if (existing1.length === 0) {
      await db.insert(adminUsers).values({
        email:        "joshuaa2g5@gmail.com",
        passwordHash: hashPassword("Naesakim"),
        role:         "admin",
      });
    }

    // Seed starboywizikal admin
    const existing2 = await db.select().from(adminUsers).where(eq(adminUsers.email, "starboywizikal@gmail.com")).limit(1);
    if (existing2.length === 0) {
      await db.insert(adminUsers).values({
        email:        "starboywizikal@gmail.com",
        passwordHash: hashPassword("Sergeant@1965"),
        role:         "admin",
      });
    }
  } catch (err) {
    // Table may not exist yet during first migration — swallow silently
    console.error("[admin-seed] Could not seed admin user:", err);
  }
}

// ── POST /admin/login ────────────────────────────────────────────────────────

router.post("/admin/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const rows = await db.select().from(adminUsers).where(eq(adminUsers.email, email.toLowerCase().trim())).limit(1);
  if (rows.length === 0) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const admin = rows[0];
  const valid = verifyPassword(password, admin.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signToken({ sub: admin.id, email: admin.email, role: admin.role });
  res.json({ token, email: admin.email, role: admin.role });
});

// ── GET /admin/verify ────────────────────────────────────────────────────────

router.get("/admin/verify", (req, res) => {
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ ok: true, email: payload.email, role: payload.role });
});

// ── GET /admin/check?email=xxx ────────────────────────────────────────────────
// Used by the frontend to check if a Clerk-authenticated user is an admin
// No password required — Clerk handles identity; we just check the email list

router.get("/admin/check", async (req, res) => {
  const email = (req.query.email as string | undefined)?.toLowerCase().trim();
  if (!email) {
    res.status(400).json({ error: "Email required" });
    return;
  }
  const rows = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
  if (rows.length > 0) {
    res.json({ isAdmin: true, role: rows[0].role });
  } else {
    res.json({ isAdmin: false });
  }
});

export default router;
