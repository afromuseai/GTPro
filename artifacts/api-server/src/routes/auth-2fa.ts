import { Router } from "express";
import { getAuth, createClerkClient } from "@clerk/express";
import { db, users } from "@workspace/db";
import { userAuthStatus } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getOrCreateUser } from "../lib/billing-logic.js";
import {
  validatePhoneNumber,
  validateEmail,
  generateVerificationCode,
  isCodeExpired,
} from "../lib/phone-validation.js";

const auth2faRouter = Router();

function getUserId(req: Parameters<typeof getAuth>[0]): string | null {
  const auth = getAuth(req);
  return auth?.userId ?? null;
}

async function upsertAuthStatus(clerkId: string, patch: Partial<typeof userAuthStatus.$inferInsert>) {
  const [existing] = await db
    .select({ id: userAuthStatus.id })
    .from(userAuthStatus)
    .where(eq(userAuthStatus.clerkId, clerkId));

  if (existing) {
    await db
      .update(userAuthStatus)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(userAuthStatus.clerkId, clerkId));
  } else {
    await db.insert(userAuthStatus).values({
      clerkId,
      email: "",
      ...patch,
    });
  }
}

// ── GET /api/auth/2fa/status ──────────────────────────────────────────────────
// Returns current 2FA / signup completion status for the user

auth2faRouter.get("/auth/2fa/status", async (req, res) => {
  const clerkId = getUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const [status] = await db
      .select()
      .from(userAuthStatus)
      .where(eq(userAuthStatus.clerkId, clerkId));

    return res.json({
      totpEnabled:      status?.totpEnabled      ?? false,
      phoneVerified:    status?.phoneVerified     ?? false,
      signupCompleted:  status?.signupCompleted   ?? false,
      phoneNumber:      status?.phoneNumber       ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch 2FA status");
    return res.status(500).json({ error: "Failed to fetch status" });
  }
});

// ── POST /api/auth/2fa/mark-totp ─────────────────────────────────────────────
// Called by the frontend after Clerk verifies the TOTP to record completion in our DB

auth2faRouter.post("/auth/2fa/mark-totp", async (req, res) => {
  const clerkId = getUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Unauthorized" });

  try {
    await upsertAuthStatus(clerkId, { totpEnabled: true });
    req.log.info({ clerkId }, "TOTP marked complete");
    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to mark TOTP");
    return res.status(500).json({ error: "Failed to update status" });
  }
});

// ── POST /api/auth/email/validate ─────────────────────────────────────────────
// Validates email — blocks temp/disposable addresses

auth2faRouter.post("/auth/email/validate", async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email) return res.status(400).json({ error: "Email required" });

  const result = validateEmail(email);
  if (!result.valid) {
    return res.status(400).json({ error: result.reason, isTempEmail: result.isTempEmail });
  }
  return res.json({ valid: true });
});

// ── POST /api/auth/phone/send-code ────────────────────────────────────────────
// Validates phone (blocks VOIP/temporal) and sends SMS code

auth2faRouter.post("/auth/phone/send-code", async (req, res) => {
  const clerkId = getUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Unauthorized" });

  const { phoneNumber } = req.body as { phoneNumber?: string };
  if (!phoneNumber) return res.status(400).json({ error: "Phone number required" });

  const validation = validatePhoneNumber(phoneNumber);
  if (!validation.valid) {
    return res.status(400).json({
      error: validation.reason,
      isVoIP: validation.isVoIP,
      isTemporal: validation.isTemporal,
    });
  }

  // Check rate-limit: no more than one code per 60 seconds
  const [existing] = await db
    .select({ phoneVerificationSentAt: userAuthStatus.phoneVerificationSentAt })
    .from(userAuthStatus)
    .where(eq(userAuthStatus.clerkId, clerkId));

  if (existing?.phoneVerificationSentAt) {
    const secsSince = (Date.now() - existing.phoneVerificationSentAt.getTime()) / 1000;
    if (secsSince < 60) {
      return res.status(429).json({
        error: `Please wait ${Math.ceil(60 - secsSince)} seconds before requesting another code.`,
      });
    }
  }

  const code = generateVerificationCode();

  try {
    await upsertAuthStatus(clerkId, {
      phoneNumber: validation.normalized,
      phoneVerificationCode: code,
      phoneVerificationSentAt: new Date(),
      phoneVerified: false,
    });

    // ── Production: send SMS via Twilio (wired when TWILIO_* secrets are set) ──
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
      const { default: twilio } = await import("twilio");
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await client.messages.create({
        to: validation.normalized!,
        from: process.env.TWILIO_PHONE_NUMBER,
        body: `Your GTPro verification code is: ${code}. Valid for 10 minutes. Do not share this code.`,
      });
    }

    req.log.info({ clerkId }, "Phone verification code sent");

    return res.json({
      success: true,
      message: "Verification code sent to your phone.",
      // Only expose code in development for testing
    });
  } catch (err) {
    req.log.error({ err }, "Failed to send phone code");
    return res.status(500).json({ error: "Failed to send verification code" });
  }
});

// ── POST /api/auth/phone/verify ───────────────────────────────────────────────
// Verifies the SMS code submitted by the user

auth2faRouter.post("/auth/phone/verify", async (req, res) => {
  const clerkId = getUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Unauthorized" });

  const { code } = req.body as { code?: string };
  if (!code || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: "A 6-digit verification code is required." });
  }

  try {
    const [record] = await db
      .select()
      .from(userAuthStatus)
      .where(eq(userAuthStatus.clerkId, clerkId));

    if (!record) {
      return res.status(400).json({ error: "No phone verification in progress. Please send a code first." });
    }

    if (record.phoneVerificationCode !== code) {
      return res.status(400).json({ error: "Incorrect code. Please check and try again." });
    }

    if (record.phoneVerificationSentAt && isCodeExpired(record.phoneVerificationSentAt)) {
      return res.status(400).json({ error: "Code has expired. Please request a new one." });
    }

    await db
      .update(userAuthStatus)
      .set({
        phoneVerified: true,
        phoneVerificationCode: null,
        updatedAt: new Date(),
      })
      .where(eq(userAuthStatus.clerkId, clerkId));

    req.log.info({ clerkId }, "Phone verified");
    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Phone verification failed");
    return res.status(500).json({ error: "Verification failed" });
  }
});

// ── POST /api/auth/signup/complete ────────────────────────────────────────────
// Marks signup as complete — ONLY if TOTP + phone are both verified

auth2faRouter.post("/auth/signup/complete", async (req, res) => {
  const clerkId = getUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const [record] = await db
      .select()
      .from(userAuthStatus)
      .where(eq(userAuthStatus.clerkId, clerkId));

    if (!record?.totpEnabled) {
      return res.status(400).json({
        error: "Authenticator app (TOTP) verification is required before completing registration.",
        missing: "totp",
      });
    }

    if (!record?.phoneVerified) {
      return res.status(400).json({
        error: "Phone number verification is required before completing registration.",
        missing: "phone",
      });
    }

    await db
      .update(userAuthStatus)
      .set({
        signupCompleted: true,
        signupCompletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userAuthStatus.clerkId, clerkId));

    // Ensure the user exists in the billing/users table so onboarding and
    // wallet features work immediately after signup completes.
    try {
      const clerkApi = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
      const clerkUser = await clerkApi.users.getUser(clerkId);
      const email =
        clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)
          ?.emailAddress ??
        clerkUser.emailAddresses[0]?.emailAddress ??
        `${clerkId}@unknown.invalid`;
      await getOrCreateUser(clerkId, email);
    } catch (userErr) {
      // Non-fatal — user creation can be retried via onboarding/complete
      req.log.warn({ userErr }, "Could not pre-create user record after signup");
    }

    req.log.info({ clerkId }, "Signup completed — TOTP + phone verified");
    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Signup completion failed");
    return res.status(500).json({ error: "Failed to complete signup" });
  }
});

// ── POST /api/onboarding/complete ────────────────────────────────────────────
// Marks onboarding as complete for the user

auth2faRouter.post("/onboarding/complete", async (req, res) => {
  const clerkId = getUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Ensure the user row exists — create if it doesn't (e.g. Clerk webhook missed)
    let [user] = await db.select().from(users).where(eq(users.clerkId, clerkId));

    if (!user) {
      try {
        const clerkApi = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
        const clerkUser = await clerkApi.users.getUser(clerkId);
        const email =
          clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)
            ?.emailAddress ??
          clerkUser.emailAddresses[0]?.emailAddress ??
          `${clerkId}@unknown.invalid`;
        user = await getOrCreateUser(clerkId, email);
      } catch {
        // Fallback: create with placeholder email using unique clerkId
        user = await getOrCreateUser(clerkId, `${clerkId}@placeholder.invalid`);
      }
    }

    await db
      .update(users)
      .set({ hasCompletedOnboarding: true, updatedAt: new Date() })
      .where(eq(users.clerkId, clerkId));

    req.log.info({ clerkId }, "Onboarding completed");
    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Onboarding completion failed");
    return res.status(500).json({ error: "Failed to complete onboarding" });
  }
});

// ── GET /api/onboarding/status ───────────────────────────────────────────────

auth2faRouter.get("/onboarding/status", async (req, res) => {
  const clerkId = getUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId));

    // If the user row doesn't exist yet (pre-billing first-login), they haven't
    // completed onboarding — return false rather than 404 to avoid redirect loops.
    return res.json({ hasCompletedOnboarding: user?.hasCompletedOnboarding ?? false });
  } catch (err) {
    req.log.error({ err }, "Onboarding status check failed");
    return res.status(500).json({ error: "Failed to check onboarding status" });
  }
});

export default auth2faRouter;
