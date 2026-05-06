import { Router } from "express";
import crypto from "crypto";
import { getAuth } from "@clerk/express";
import { db, adminUsers, users } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

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

export function verifyToken(token: string): Record<string, unknown> | null {
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

// ── Admin JWT middleware (separate admin session) ─────────────────────────────

function requireAdminJwt(req: Parameters<typeof getAuth>[0], res: any, next: any) {
  const auth = (req as any).headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).adminPayload = payload;
  next();
}

// ── Clerk-based admin middleware ───────────────────────────────────────────────
// Used by admin panel routes accessed via Clerk SSO

async function requireClerkAdmin(req: Parameters<typeof getAuth>[0], res: any, next: any) {
  const clerkAuth = getAuth(req);
  if (!clerkAuth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    // Look up the platform user by Clerk userId → get their email → check adminUsers
    const platformUser = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.clerkId, clerkAuth.userId))
      .limit(1);

    const email = platformUser[0]?.email?.toLowerCase().trim();
    if (!email) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const adminRow = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
    if (adminRow.length === 0) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  } catch {
    res.status(500).json({ error: "Auth check failed" });
  }
}

// ── Seed admin on startup ────────────────────────────────────────────────────

export async function seedAdminUser() {
  try {
    await db.delete(adminUsers).where(eq(adminUsers.email, "joshuaa@gmail.com"));

    const existing1 = await db.select().from(adminUsers).where(eq(adminUsers.email, "joshuaa2g5@gmail.com")).limit(1);
    if (existing1.length === 0) {
      await db.insert(adminUsers).values({
        email:        "joshuaa2g5@gmail.com",
        passwordHash: hashPassword("Naesakim"),
        role:         "admin",
      });
    }

    const existing2 = await db.select().from(adminUsers).where(eq(adminUsers.email, "starboywizikal@gmail.com")).limit(1);
    if (existing2.length === 0) {
      await db.insert(adminUsers).values({
        email:        "starboywizikal@gmail.com",
        passwordHash: hashPassword("Sergeant@1965"),
        role:         "admin",
      });
    }
  } catch (err) {
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

// ── GET /admin/users ──────────────────────────────────────────────────────────
// Returns all platform users (requires Clerk admin auth)

router.get("/admin/users", requireClerkAdmin, async (req, res) => {
  try {
    const allUsers = await db
      .select({
        id:           users.id,
        clerkId:      users.clerkId,
        email:        users.email,
        balance:      users.balance,
        lockedBalance:users.lockedBalance,
        totalSpent:   users.totalSpent,
        billingPlan:  users.billingPlan,
        usedHours:    users.usedHours,
        includedHours:users.includedHours,
        createdAt:    users.createdAt,
        updatedAt:    users.updatedAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    return res.json(
      allUsers.map(u => ({
        ...u,
        balance:       parseFloat((u.balance ?? 0).toString()),
        lockedBalance: parseFloat((u.lockedBalance ?? 0).toString()),
        totalSpent:    parseFloat((u.totalSpent ?? 0).toString()),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to fetch admin users");
    return res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ── PATCH /admin/users/:id ────────────────────────────────────────────────────
// Update a platform user's balance or plan (requires Clerk admin auth)

router.patch("/admin/users/:id", requireClerkAdmin, async (req, res) => {
  const { id } = req.params;
  const { balance, lockedBalance, billingPlan, note } = req.body as {
    balance?:       number;
    lockedBalance?: number;
    billingPlan?:   string;
    note?:          string;
  };

  if (balance !== undefined && (typeof balance !== "number" || balance < 0)) {
    return res.status(400).json({ error: "Balance must be a non-negative number" });
  }
  if (lockedBalance !== undefined && (typeof lockedBalance !== "number" || lockedBalance < 0)) {
    return res.status(400).json({ error: "Locked balance must be a non-negative number" });
  }

  try {
    const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: "User not found" });

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (balance      !== undefined) updateData.balance       = balance;
    if (lockedBalance !== undefined) updateData.lockedBalance = lockedBalance;
    if (billingPlan   !== undefined) updateData.billingPlan   = billingPlan;

    const [updated] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();

    req.log.info({ id, changes: updateData, note }, "Admin updated user");
    return res.json({
      id:            updated.id,
      email:         updated.email,
      balance:       parseFloat((updated.balance ?? 0).toString()),
      lockedBalance: parseFloat((updated.lockedBalance ?? 0).toString()),
      totalSpent:    parseFloat((updated.totalSpent ?? 0).toString()),
      billingPlan:   updated.billingPlan,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update user");
    return res.status(500).json({ error: "Failed to update user" });
  }
});

export default router;
