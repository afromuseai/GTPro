import { db, users, botSessions, transactions } from "@workspace/db";
import { eq } from "drizzle-orm";

// ── Credit packages (aligned with landing page pricing) ───────────────────────
export const CREDIT_PACKAGES = {
  starter: {
    id:          "starter",
    displayName: "Starter",
    amount:      25,
    botHours:    50,
    hourlyRate:  0.50,
    description: "Perfect for exploring strategies and running short sessions.",
    features:    ["50 bot-hours of execution", "Real-time AI analysis", "ABF signal access", "Basic fleet monitoring"],
  },
  professional: {
    id:          "professional",
    displayName: "Professional",
    amount:      100,
    botHours:    250,
    hourlyRate:  0.40,
    description: "For active traders running multiple simultaneous strategies.",
    features:    ["250 bot-hours of execution", "Priority AI processing", "All fleet access (ABF, SBF, VCBF)", "Advanced security monitoring", "Real-time P&L analytics"],
    highlight:   true,
  },
  institutional: {
    id:          "institutional",
    displayName: "Institutional",
    amount:      500,
    botHours:    1400,
    hourlyRate:  0.35,
    description: "Maximum throughput for institutional-grade operations.",
    features:    ["1,400+ bot-hours of execution", "Dedicated fleet allocation", "SBF priority threat monitoring", "Full audit log access", "API rate limit exemptions"],
  },
} as const;

export type CreditPackageId = keyof typeof CREDIT_PACKAGES;

// ── Internal plan config (kept for session billing) ───────────────────────────
export const PLANS = {
  free: {
    price:         0,
    includedHours: 0,
    hourlyRate:    0.50,   // aligned with Starter package rate
    displayName:   "Free",
  },
  weekly: {
    price:         15,
    includedHours: 12,
    hourlyRate:    0.40,   // aligned with Professional package rate
    displayName:   "Weekly",
    durationDays:  7,
  },
  monthly: {
    price:         49,
    includedHours: 50,
    hourlyRate:    0.35,   // aligned with Institutional package rate
    displayName:   "Monthly",
    durationDays:  30,
  },
} as const;

export type PlanType = keyof typeof PLANS;

// ── Payment method validation ─────────────────────────────────────────────────
export interface CardPayment {
  type:       "card";
  number:     string;
  expiry:     string;
  cvv:        string;
  holderName: string;
}

export interface BankPayment {
  type:          "bank";
  accountNumber: string;
  routingNumber: string;
  accountHolder: string;
}

export type PaymentMethod = CardPayment | BankPayment;

export function validatePaymentMethod(pm: PaymentMethod): string | null {
  if (pm.type === "card") {
    const digits = pm.number.replace(/\s/g, "");
    if (!digits || digits.length < 13 || digits.length > 19 || !/^\d+$/.test(digits)) {
      return "Invalid card number";
    }
    if (!pm.expiry || !/^\d{2}\/\d{2}$/.test(pm.expiry)) {
      return "Expiry must be MM/YY";
    }
    if (!pm.cvv || pm.cvv.length < 3 || pm.cvv.length > 4 || !/^\d+$/.test(pm.cvv)) {
      return "Invalid CVV";
    }
    if (!pm.holderName?.trim()) {
      return "Cardholder name is required";
    }
  } else if (pm.type === "bank") {
    if (!pm.accountNumber?.trim() || pm.accountNumber.trim().length < 4) {
      return "Invalid account number";
    }
    const routing = pm.routingNumber.replace(/\s/g, "");
    if (!routing || routing.length !== 9 || !/^\d+$/.test(routing)) {
      return "Routing number must be exactly 9 digits";
    }
    if (!pm.accountHolder?.trim()) {
      return "Account holder name is required";
    }
  } else {
    return "Unsupported payment method";
  }
  return null;
}

// ── User management ───────────────────────────────────────────────────────────

export async function getOrCreateUser(clerkId: string, email: string) {
  const [existing] = await db.select().from(users).where(eq(users.clerkId, clerkId));
  if (existing) return existing;

  // New user — grant $5 free welcome credits
  const WELCOME_CREDIT = 5;

  await db
    .insert(users)
    .values({ clerkId, email, balance: WELCOME_CREDIT })
    .onConflictDoNothing()
    .execute();

  // Record the welcome credit as a transaction
  const [newUser] = await db.select().from(users).where(eq(users.clerkId, clerkId));
  if (newUser) {
    await db.insert(transactions).values({
      userId:      newUser.id,
      type:        "welcome_bonus",
      amount:      WELCOME_CREDIT,
      description: "Welcome bonus — $5 free credits for new accounts",
    }).execute();
  }

  return newUser;
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
  const expiresAt  = new Date();
  expiresAt.setDate(expiresAt.getDate() + (plan as { durationDays: number }).durationDays);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        balance:        newBalance,
        billingPlan:    planType,
        planExpiresAt:  expiresAt,
        includedHours:  plan.includedHours,
        usedHours:      0,
        updatedAt:      new Date(),
      })
      .where(eq(users.clerkId, clerkId));

    await tx.insert(transactions).values({
      userId:      user.id,
      type:        "plan_purchase",
      amount:      -plan.price,
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

  const plan                  = PLANS[activePlan];
  const remainingIncludedHours = Math.max(0, (user.includedHours ?? 0) - (user.usedHours ?? 0));
  const includedUsage          = Math.min(estimatedHours, remainingIncludedHours);
  const paidUsage              = Math.max(0, estimatedHours - includedUsage);
  const cost                   = paidUsage * plan.hourlyRate;

  return {
    hourlyRate:              plan.hourlyRate,
    estimatedCost:           cost,
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
  clerkId:        string,
  strategy:       string,
  estimatedHours: number,
) {
  const user     = await getUserWallet(clerkId);
  const costInfo = await calculateSessionCost(clerkId, estimatedHours);

  const available = user.balance - user.lockedBalance;

  if (costInfo.paidUsage > 0 && available < costInfo.estimatedCost) {
    throw new Error(
      `Insufficient service credits. Need $${costInfo.estimatedCost.toFixed(2)}, available $${available.toFixed(2)}`,
    );
  }

  const [session] = await db
    .insert(botSessions)
    .values({
      userId:            user.id,
      strategy,
      startTime:         new Date(),
      estimatedDuration: estimatedHours,
      hourlyRate:        costInfo.hourlyRate,
      estimatedCost:     costInfo.estimatedCost,
      paidFromPlan:      costInfo.includedUsage > 0 || costInfo.estimatedCost === 0,
      status:            "running",
    })
    .returning();

  if (costInfo.estimatedCost > 0) {
    await db
      .update(users)
      .set({
        lockedBalance: user.lockedBalance + costInfo.estimatedCost,
        updatedAt:     new Date(),
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
  sessionId:       string,
  simulatedProfit: number = 0,
) {
  const [session] = await db.select().from(botSessions).where(eq(botSessions.id, sessionId));
  if (!session) throw new Error("Session not found");

  const [user] = await db.select().from(users).where(eq(users.id, session.userId));
  if (!user) throw new Error("User not found");

  const endTime        = new Date();
  const actualDuration = (endTime.getTime() - session.startTime.getTime()) / (1000 * 60 * 60);
  const actualCost     = session.paidFromPlan
    ? 0
    : Math.min(actualDuration * session.hourlyRate, session.estimatedCost);

  const refund = Math.max(0, session.estimatedCost - actualCost);

  await db.transaction(async (tx) => {
    await tx
      .update(botSessions)
      .set({
        endTime,
        actualDuration:  Math.round(actualDuration * 100) / 100,
        totalCost:       actualCost,
        simulatedProfit,
        status:          "completed",
      })
      .where(eq(botSessions.id, sessionId));

    const newLockedBalance = Math.max(0, user.lockedBalance - session.estimatedCost);
    const newBalance       = user.balance - actualCost + refund;
    const newUsedHours     = session.paidFromPlan
      ? (user.usedHours ?? 0) + Math.ceil(actualDuration)
      : (user.usedHours ?? 0);

    await tx
      .update(users)
      .set({
        balance:              newBalance,
        lockedBalance:        newLockedBalance,
        totalSpent:           user.totalSpent + actualCost,
        totalSimulatedProfit: user.totalSimulatedProfit + simulatedProfit,
        usedHours:            newUsedHours,
        updatedAt:            new Date(),
      })
      .where(eq(users.id, user.id));

    if (actualCost > 0) {
      await tx.insert(transactions).values({
        userId:      user.id,
        type:        "usage",
        amount:      -actualCost,
        sessionId,
        description: `Bot session: ${session.strategy}`,
      });
    }

    if (refund > 0) {
      await tx.insert(transactions).values({
        userId:      user.id,
        type:        "refund",
        amount:      refund,
        sessionId,
        description: "Refund for unused session time",
      });
    }
  });

  return { actualCost, refund, simulatedProfit };
}
