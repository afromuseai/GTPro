import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, referralCodes, referrals, users, transactions } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

function getUserId(req: Parameters<typeof getAuth>[0]): string | null {
  return getAuth(req)?.userId ?? null;
}

function genCode(clerkId: string): string {
  const base = clerkId.slice(-6).toUpperCase().replace(/[^A-Z0-9]/g, "X");
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `GT-${base}${rand}`;
}

// ── GET /api/referral/code ────────────────────────────────────────────────────

router.get("/referral/code", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    let [existing] = await db.select().from(referralCodes).where(eq(referralCodes.userId, userId));
    if (!existing) {
      const code = genCode(userId);
      [existing] = await db.insert(referralCodes).values({ userId, code }).returning();
    }
    res.json({ code: existing!.code });
  } catch {
    res.status(500).json({ error: "Failed to get referral code" });
  }
});

// ── GET /api/referral/stats ───────────────────────────────────────────────────

router.get("/referral/stats", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const myReferrals = await db.select().from(referrals).where(eq(referrals.referrerId, userId));
    const completed   = myReferrals.filter(r => r.status === "completed");
    const pending     = myReferrals.filter(r => r.status === "pending");
    const totalEarned = completed.reduce((s, r) => s + r.creditAmount, 0);
    res.json({
      total:       myReferrals.length,
      completed:   completed.length,
      pending:     pending.length,
      totalEarned: +totalEarned.toFixed(2),
      referrals:   myReferrals.slice(0, 20).map(r => ({
        email:      r.referredEmail,
        status:     r.status,
        credits:    r.creditAmount,
        createdAt:  r.createdAt,
      })),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch referral stats" });
  }
});

// ── POST /api/referral/apply ──────────────────────────────────────────────────

router.post("/referral/apply", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { code } = req.body as { code: string };
  if (!code?.trim()) { res.status(400).json({ error: "code is required" }); return; }

  try {
    // Find the referral code
    const [codeRow] = await db.select().from(referralCodes).where(eq(referralCodes.code, code.trim().toUpperCase()));
    if (!codeRow) { res.status(404).json({ error: "Invalid referral code" }); return; }
    if (codeRow.userId === userId) { res.status(400).json({ error: "Cannot use your own referral code" }); return; }

    // Check if this user was already referred
    const [alreadyReferred] = await db.select().from(referrals).where(eq(referrals.referredUserId, userId));
    if (alreadyReferred) { res.status(400).json({ error: "You have already used a referral code" }); return; }

    // Get referred user's email
    const [referredUser] = await db.select().from(users).where(eq(users.clerkId, userId));
    if (!referredUser) { res.status(404).json({ error: "User not found" }); return; }

    const CREDIT_AMOUNT = 5;

    // Create referral record (pending until referred user completes onboarding)
    await db.insert(referrals).values({
      referrerId:     codeRow.userId,
      referredUserId: userId,
      referredEmail:  referredUser.email,
      creditAmount:   CREDIT_AMOUNT,
      status:         "completed",
      completedAt:    new Date(),
    });

    // Credit the referrer
    await db.update(users)
      .set({ balance: referredUser.balance + CREDIT_AMOUNT })
      .where(eq(users.clerkId, codeRow.userId));

    // Credit the new user
    await db.update(users)
      .set({ balance: referredUser.balance + CREDIT_AMOUNT })
      .where(eq(users.clerkId, userId));

    // Record transactions
    await db.insert(transactions).values([
      {
        userId:      codeRow.userId,
        type:        "bonus",
        amount:      CREDIT_AMOUNT,
        description: `Referral bonus — ${referredUser.email} joined`,
        status:      "completed",
      },
      {
        userId:      userId,
        type:        "bonus",
        amount:      CREDIT_AMOUNT,
        description: "Welcome bonus — referral code applied",
        status:      "completed",
      },
    ]);

    res.json({ ok: true, creditsEarned: CREDIT_AMOUNT });
  } catch (err) {
    console.error("Referral apply error:", err);
    res.status(500).json({ error: "Failed to apply referral code" });
  }
});

export default router;
