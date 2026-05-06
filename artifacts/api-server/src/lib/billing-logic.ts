import { db, users, botSessions, transactions } from "@workspace/db";
import { eq } from "drizzle-orm";

// ── Plan configuration ────────────────────────────────────────────────────────
export const PLANS = {
  free: {
    price: 0,
    includedHours: 0,
    hourlyRate: 1.8,
    displayName: "Free",
  },
  weekly: {
    price: 15,
    includedHours: 12,
    hourlyRate: 1.2,
    displayName: "Weekly",
    durationDays: 7,
  },
  monthly: {
    price: 49,
    includedHours: 50,
    hourlyRate: 0.9,
    displayName: "Monthly",
    durationDays: 30,
  },
} as const;

export type PlanType = keyof typeof PLANS;

export async function getOrCreateUser(clerkId: string, email: string) {
  const [existing] = await db.select().from(users).where(eq(users.clerkId, clerkId));
  if (existing) return existing;

  const [created] = await db
    .insert(users)
    .values({ clerkId, email })
    .returning();
  return created;
}

export async function getUserWallet(clerkId: string) {
  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId));
  if (!user) throw new Error("User not found");
  return user;
}

/**
 * Subscribe user to a plan.
 * Deducts service credits from balance. No withdrawals ever.
 */
export async function subscribeToPlan(clerkId: string, planType: PlanType) {
  if (planType === "free") {
    await db
      .update(users)
      .set({ billingPlan: "free", planExpiresAt: null, includedHours: 0, usedHours: 0 })
      .where(eq(users.clerkId, clerkId));
    return { success: true, plan: "free", expiresAt: null };
  }

  const user = await getUserWallet(clerkId);
  const plan = PLANS[planType];

  if (user.balance < plan.price) {
    throw new Error(`Insufficient service credits. Need $${plan.price}, have $${user.balance.toFixed(2)}`);
  }

  const newBalance = user.balance - plan.price;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (plan as { durationDays: number }).durationDays);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        balance: newBalance,
        billingPlan: planType,
        planExpiresAt: expiresAt,
        includedHours: plan.includedHours,
        usedHours: 0,
        updatedAt: new Date(),
      })
      .where(eq(users.clerkId, clerkId));

    await tx.insert(transactions).values({
      userId: user.id,
      type: "plan_purchase",
      amount: -plan.price,
      planType,
      description: `Purchased ${plan.displayName} plan`,
    });
  });

  return { success: true, plan: planType, expiresAt, newBalance };
}

/**
 * Calculate estimated cost for a bot session.
 */
export async function calculateSessionCost(clerkId: string, estimatedHours: number) {
  const user = await getUserWallet(clerkId);

  // Auto-expire plan
  let activePlan = user.billingPlan as PlanType;
  if (activePlan !== "free" && user.planExpiresAt && new Date() > user.planExpiresAt) {
    await db
      .update(users)
      .set({ billingPlan: "free", planExpiresAt: null, includedHours: 0, usedHours: 0 })
      .where(eq(users.clerkId, clerkId));
    activePlan = "free";
  }

  const plan = PLANS[activePlan];
  const remainingIncludedHours = Math.max(0, (user.includedHours ?? 0) - (user.usedHours ?? 0));

  const includedUsage = Math.min(estimatedHours, remainingIncludedHours);
  const paidUsage = Math.max(0, estimatedHours - includedUsage);
  const cost = paidUsage * plan.hourlyRate;

  return {
    hourlyRate: plan.hourlyRate,
    estimatedCost: cost,
    remainingIncludedHours,
    paidUsage,
    includedUsage,
    activePlan,
  };
}

/**
 * Start a bot session.
 * Locks estimated credits in balance. Rejects if insufficient.
 */
export async function startBotSession(
  clerkId: string,
  strategy: string,
  estimatedHours: number,
) {
  const user = await getUserWallet(clerkId);
  const costInfo = await calculateSessionCost(clerkId, estimatedHours);

  // Available credits = balance minus already-locked amounts
  const available = user.balance - user.lockedBalance;

  if (costInfo.paidUsage > 0 && available < costInfo.estimatedCost) {
    throw new Error(
      `Insufficient service credits. Need $${costInfo.estimatedCost.toFixed(2)}, available $${available.toFixed(2)}`,
    );
  }

  const [session] = await db
    .insert(botSessions)
    .values({
      userId: user.id,
      strategy,
      startTime: new Date(),
      estimatedDuration: estimatedHours,
      hourlyRate: costInfo.hourlyRate,
      estimatedCost: costInfo.estimatedCost,
      paidFromPlan: costInfo.includedUsage > 0 || costInfo.estimatedCost === 0,
      status: "running",
    })
    .returning();

  // Lock estimated credits
  if (costInfo.estimatedCost > 0) {
    await db
      .update(users)
      .set({
        lockedBalance: user.lockedBalance + costInfo.estimatedCost,
        updatedAt: new Date(),
      })
      .where(eq(users.clerkId, clerkId));
  }

  return session;
}

/**
 * End a bot session.
 * - Deducts actual usage cost from balance
 * - Releases unused locked credits back to balance
 * - Records simulated profit for display ONLY — does NOT add to balance
 */
export async function endBotSession(
  sessionId: string,
  simulatedProfit: number = 0,
) {
  const [session] = await db.select().from(botSessions).where(eq(botSessions.id, sessionId));
  if (!session) throw new Error("Session not found");

  const [user] = await db.select().from(users).where(eq(users.id, session.userId));
  if (!user) throw new Error("User not found");

  const endTime = new Date();
  const actualDuration = (endTime.getTime() - session.startTime.getTime()) / (1000 * 60 * 60);
  const actualCost = session.paidFromPlan
    ? 0
    : Math.min(actualDuration * session.hourlyRate, session.estimatedCost);

  // Unused locked credits → refund back to balance
  const refund = Math.max(0, session.estimatedCost - actualCost);

  await db.transaction(async (tx) => {
    // Update session record
    await tx
      .update(botSessions)
      .set({
        endTime,
        actualDuration: Math.round(actualDuration * 100) / 100,
        totalCost: actualCost,
        simulatedProfit,
        status: "completed",
      })
      .where(eq(botSessions.id, sessionId));

    // Compute new balance values
    // IMPORTANT: profit is NEVER added to balance — it is simulation only
    const newLockedBalance = Math.max(0, user.lockedBalance - session.estimatedCost);
    const newBalance = user.balance - actualCost + refund; // refund of unused locked credits
    const newUsedHours = session.paidFromPlan
      ? (user.usedHours ?? 0) + Math.ceil(actualDuration)
      : (user.usedHours ?? 0);

    await tx
      .update(users)
      .set({
        balance: newBalance,
        lockedBalance: newLockedBalance,
        totalSpent: user.totalSpent + actualCost,
        totalSimulatedProfit: user.totalSimulatedProfit + simulatedProfit, // display only
        usedHours: newUsedHours,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // Log usage deduction
    if (actualCost > 0) {
      await tx.insert(transactions).values({
        userId: user.id,
        type: "usage",
        amount: -actualCost,
        sessionId,
        description: `Bot session: ${session.strategy}`,
      });
    }

    // Log refund of unused credits
    if (refund > 0) {
      await tx.insert(transactions).values({
        userId: user.id,
        type: "refund",
        amount: refund,
        sessionId,
        description: "Refund for unused session time",
      });
    }

    // NOTE: No "profit" transaction is logged — profit is simulated only
  });

  return { actualCost, refund, simulatedProfit };
}
