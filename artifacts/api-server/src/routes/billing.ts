import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, users, botSessions, transactions } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  getOrCreateUser,
  getUserWallet,
  subscribeToPlan,
  calculateSessionCost,
  startBotSession,
  endBotSession,
  validatePaymentMethod,
  PLANS,
  CREDIT_PACKAGES,
  type PlanType,
  type PaymentMethod,
} from "../lib/billing-logic.js";

const billingRouter = Router();

function getUserId(req: Parameters<typeof getAuth>[0]): string | null {
  const auth = getAuth(req);
  return auth?.userId ?? null;
}

// ── GET /api/billing/user ─────────────────────────────────────────────────────

billingRouter.get("/billing/user", async (req, res) => {
  const clerkId = getUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Unauthorized" });

  res.setHeader("Cache-Control", "no-store");

  try {
    const user       = await getOrCreateUser(clerkId, "");
    const planExpiry = user.planExpiresAt ? new Date(user.planExpiresAt) : null;
    const isExpired  = planExpiry ? new Date() > planExpiry : false;

    const activeSessions = await db
      .select({ status: botSessions.status })
      .from(botSessions)
      .where(eq(botSessions.userId, user.id));

    const running = activeSessions.filter(s => s.status === "running").length;

    return res.json({
      id:            user.id,
      email:         user.email,
      balance:       parseFloat(user.balance.toString()),
      lockedBalance: parseFloat(user.lockedBalance.toString()),
      totalSpent:    parseFloat(user.totalSpent.toString()),
      billingPlan:   user.billingPlan,
      planExpiresAt: planExpiry,
      isExpired,
      includedHours: user.includedHours ?? 0,
      usedHours:     user.usedHours ?? 0,
      activeSessions: running,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch user wallet");
    res.status(500).json({ error: "Failed to fetch wallet" });
  }
});

// ── POST /api/billing/deposit ─────────────────────────────────────────────────
// Requires a valid payment method before credits are deposited.
// Validates card / bank details server-side — credits are only added after
// payment validation passes (simulated processor; swap for Stripe when ready).

billingRouter.post("/billing/deposit", async (req, res) => {
  const clerkId = getUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Unauthorized" });

  const { amount, paymentMethod } = req.body as {
    amount?:        number;
    paymentMethod?: PaymentMethod;
  };

  // ── Amount validation ────────────────────────────────────────────────────────
  if (!amount || amount < 10 || amount > 500) {
    return res.status(400).json({ error: "Deposit must be between $10 and $500" });
  }

  // ── Payment method validation — REQUIRED before any credit deposit ───────────
  if (!paymentMethod || !paymentMethod.type) {
    return res.status(400).json({ error: "A payment method (card or bank) is required to add credits" });
  }

  const pmError = validatePaymentMethod(paymentMethod);
  if (pmError) {
    return res.status(400).json({ error: pmError });
  }

  // ── Process deposit ──────────────────────────────────────────────────────────
  try {
    const user       = await getOrCreateUser(clerkId, "");
    const newBalance = user.balance + amount;

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ balance: newBalance, updatedAt: new Date() })
        .where(eq(users.id, user.id));

      await tx.insert(transactions).values({
        userId:      user.id,
        type:        "deposit",
        amount,
        description: `Credit deposit via ${paymentMethod.type === "card" ? "card" : "bank transfer"} — $${amount}`,
      });
    });

    req.log.info({ clerkId, amount, via: paymentMethod.type }, "Credit deposit successful");
    return res.json({ success: true, newBalance });
  } catch (err) {
    req.log.error({ err }, "Deposit failed");
    res.status(500).json({ error: "Deposit failed" });
  }
});

// ── POST /api/billing/subscribe ───────────────────────────────────────────────

billingRouter.post("/billing/subscribe", async (req, res) => {
  const clerkId = getUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Unauthorized" });

  const { plan } = req.body as { plan?: string };
  if (!plan || !["free", "weekly", "monthly"].includes(plan)) {
    return res.status(400).json({ error: "Invalid plan type" });
  }

  try {
    const result = await subscribeToPlan(clerkId, plan as PlanType);
    req.log.info({ clerkId, plan }, "Plan subscribed");
    return res.json(result);
  } catch (err) {
    req.log.warn({ err }, "Subscribe failed");
    const msg = err instanceof Error ? err.message : "Subscribe failed";
    res.status(400).json({ error: msg });
  }
});

// ── GET /api/billing/transactions ─────────────────────────────────────────────

billingRouter.get("/billing/transactions", async (req, res) => {
  const clerkId = getUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const user = await getOrCreateUser(clerkId, "");
    const txns = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, user.id))
      .orderBy(desc(transactions.createdAt));

    return res.json(
      txns
        .filter(t => t.type !== "profit")
        .map(t => ({
          id:          t.id,
          type:        t.type,
          amount:      parseFloat(t.amount.toString()),
          description: t.description,
          createdAt:   t.createdAt,
        })),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to fetch transactions");
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// ── POST /api/bot/session/start ───────────────────────────────────────────────

billingRouter.post("/bot/session/start", async (req, res) => {
  const clerkId = getUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Unauthorized" });

  const { strategy, estimatedHours } = req.body as {
    strategy?:       string;
    estimatedHours?: number;
  };
  if (!strategy || !estimatedHours || estimatedHours <= 0) {
    return res.status(400).json({ error: "Invalid strategy or duration" });
  }

  try {
    const session  = await startBotSession(clerkId, strategy, estimatedHours);
    const costInfo = await calculateSessionCost(clerkId, estimatedHours);

    req.log.info({ clerkId, strategy, estimatedHours, cost: costInfo.estimatedCost }, "Bot session started");

    return res.json({
      sessionId:              session.id,
      strategy:               session.strategy,
      estimatedHours,
      estimatedCost:          costInfo.estimatedCost,
      hourlyRate:             costInfo.hourlyRate,
      paidFromPlan:           costInfo.includedUsage > 0,
      remainingIncludedHours: costInfo.remainingIncludedHours,
    });
  } catch (err) {
    req.log.warn({ err }, "Failed to start session");
    const msg = err instanceof Error ? err.message : "Failed to start session";
    res.status(400).json({ error: msg });
  }
});

// ── POST /api/bot/session/end ─────────────────────────────────────────────────

billingRouter.post("/bot/session/end", async (req, res) => {
  const clerkId = getUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Unauthorized" });

  const { sessionId, simulatedProfit = 0 } = req.body as {
    sessionId?:       string;
    simulatedProfit?: number;
  };
  if (!sessionId) return res.status(400).json({ error: "Session ID required" });

  try {
    const result = await endBotSession(sessionId, simulatedProfit);
    req.log.info({ clerkId, sessionId, simulatedProfit, cost: result.actualCost }, "Bot session ended");
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to end session");
    const msg = err instanceof Error ? err.message : "Failed to end session";
    res.status(400).json({ error: msg });
  }
});

// ── GET /api/bot/session/:id ──────────────────────────────────────────────────

billingRouter.get("/bot/session/:id", async (req, res) => {
  const clerkId = getUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.params;
  try {
    const user      = await getUserWallet(clerkId);
    const [session] = await db
      .select()
      .from(botSessions)
      .where(eq(botSessions.id, id));

    if (!session || session.userId !== user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    return res.json({
      id:                session.id,
      strategy:          session.strategy,
      status:            session.status,
      startTime:         session.startTime,
      endTime:           session.endTime,
      estimatedDuration: session.estimatedDuration,
      actualDuration:    session.actualDuration,
      totalCost:         session.totalCost ? parseFloat(session.totalCost.toString()) : null,
      simulatedProfit:   session.simulatedProfit ? parseFloat(session.simulatedProfit.toString()) : null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch session");
    res.status(500).json({ error: "Failed to fetch session" });
  }
});

// ── GET /api/billing/plans ────────────────────────────────────────────────────

billingRouter.get("/billing/plans", (_req, res) => {
  return res.json({ plans: PLANS, packages: CREDIT_PACKAGES });
});

export default billingRouter;
