import { Router } from "express";
import crypto from "crypto";
import { getAuth, clerkClient } from "@clerk/express";
import { db, adminUsers, users, transactions, notifications } from "@workspace/db";
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
// Looks up the Clerk user's primary email directly via clerkClient,
// then checks that email against the admin_users table.
// This works even if the admin has never completed platform onboarding.

async function requireClerkAdmin(req: Parameters<typeof getAuth>[0], res: any, next: any) {
  const clerkAuth = getAuth(req);
  if (!clerkAuth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const clerkUser = await clerkClient.users.getUser(clerkAuth.userId);
    const email = clerkUser.emailAddresses
      .find(e => e.id === clerkUser.primaryEmailAddressId)
      ?.emailAddress?.toLowerCase().trim()
      ?? clerkUser.emailAddresses[0]?.emailAddress?.toLowerCase().trim();

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
// Returns all platform users + admin users (requires Clerk admin auth)

router.get("/admin/users", requireClerkAdmin, async (req, res) => {
  try {
    const [allUsers, allAdmins] = await Promise.all([
      db.select({
        id:           users.id,
        clerkId:      users.clerkId,
        email:        users.email,
        balance:      users.balance,
        lockedBalance:users.lockedBalance,
        totalSpent:   users.totalSpent,
        billingPlan:  users.billingPlan,
        usedHours:    users.usedHours,
        includedHours:users.includedHours,
        note:         users.note,
        createdAt:    users.createdAt,
        updatedAt:    users.updatedAt,
      }).from(users).orderBy(desc(users.createdAt)),
      db.select().from(adminUsers),
    ]);

    const adminEmailSet = new Set(allAdmins.map(a => a.email.toLowerCase().trim()));
    const platformEmailSet = new Set(allUsers.map(u => (u.email ?? "").toLowerCase().trim()));

    // Platform users, flagged if they are also admins
    const platformRows = allUsers.map(u => ({
      ...u,
      balance:       parseFloat((u.balance ?? 0).toString()),
      lockedBalance: parseFloat((u.lockedBalance ?? 0).toString()),
      totalSpent:    parseFloat((u.totalSpent ?? 0).toString()),
      note:          u.note ?? null,
      isAdmin:       adminEmailSet.has((u.email ?? "").toLowerCase().trim()),
    }));

    // Admin users who have no platform account yet
    const adminOnlyRows = allAdmins
      .filter(a => !platformEmailSet.has(a.email.toLowerCase().trim()))
      .map(a => ({
        id:           `admin-${a.id}`,
        clerkId:      "",
        email:        a.email,
        balance:      0,
        lockedBalance:0,
        totalSpent:   0,
        billingPlan:  "admin",
        usedHours:    0,
        includedHours:0,
        note:         `Admin role: ${a.role}`,
        createdAt:    a.createdAt,
        updatedAt:    a.createdAt,
        isAdmin:      true,
      }));

    return res.json([...platformRows, ...adminOnlyRows]);
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
    let platformId = id;

    // Admin-only user — auto-provision a platform account on first edit
    if (id.startsWith("admin-")) {
      const adminUuid = id.slice("admin-".length);
      const [adminRow] = await db.select().from(adminUsers).where(eq(adminUsers.id, adminUuid)).limit(1);
      if (!adminRow) return res.status(404).json({ error: "Admin user not found" });

      // Check for existing platform account by email
      const [existing] = await db.select().from(users).where(eq(users.email, adminRow.email)).limit(1);
      if (existing) {
        platformId = existing.id;
      } else {
        // Create a minimal platform account for this admin
        const syntheticClerkId = `admin:${adminRow.email}`;
        const [created] = await db.insert(users).values({
          clerkId:  syntheticClerkId,
          email:    adminRow.email,
          billingPlan: billingPlan ?? "free",
          note:     note !== undefined ? (note === "" ? null : note) : `Admin role: ${adminRow.role}`,
        }).returning();
        platformId = created.id;
      }
    }

    const [existing] = await db.select().from(users).where(eq(users.id, platformId)).limit(1);
    if (!existing) return res.status(404).json({ error: "User not found" });

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (balance       !== undefined) updateData.balance       = balance;
    if (lockedBalance !== undefined) updateData.lockedBalance = lockedBalance;
    if (billingPlan   !== undefined) updateData.billingPlan   = billingPlan;
    if (note          !== undefined) updateData.note          = note === "" ? null : note;

    const [updated] = await db.update(users).set(updateData).where(eq(users.id, platformId)).returning();

    // Record a transaction + push notification whenever the admin changes balance
    if (balance !== undefined) {
      const prevBalance = parseFloat((existing.balance ?? 0).toString());
      const newBalance  = parseFloat(balance.toString());
      const delta       = newBalance - prevBalance;

      if (delta !== 0) {
        const isCredit = delta > 0;
        const absAmt   = Math.abs(delta).toFixed(2);

        await db.insert(transactions).values({
          userId:      platformId,
          type:        isCredit ? "admin_credit" : "admin_debit",
          amount:      Math.abs(delta),
          description: isCredit
            ? `Admin credit adjustment: +$${absAmt}`
            : `Admin debit adjustment: -$${absAmt}`,
          status: "completed",
        });

        // Push a real-time notification so the user's wallet refreshes instantly
        await db.insert(notifications).values({
          userId:  platformId,
          type:    "balance_updated",
          title:   isCredit ? "Credits Added" : "Balance Adjusted",
          message: isCredit
            ? `An admin credited $${absAmt} to your account. New balance: $${newBalance.toFixed(2)}.`
            : `An admin adjusted your balance by -$${absAmt}. New balance: $${newBalance.toFixed(2)}.`,
          link:    "/wallet",
        });
      }
    }

    req.log.info({ id: platformId, changes: updateData }, "Admin updated user");
    return res.json({
      id:            updated.id,
      email:         updated.email,
      balance:       parseFloat((updated.balance ?? 0).toString()),
      lockedBalance: parseFloat((updated.lockedBalance ?? 0).toString()),
      totalSpent:    parseFloat((updated.totalSpent ?? 0).toString()),
      billingPlan:   updated.billingPlan,
      note:          updated.note ?? null,
      isAdmin:       false,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update user");
    return res.status(500).json({ error: "Failed to update user" });
  }
});

export default router;
