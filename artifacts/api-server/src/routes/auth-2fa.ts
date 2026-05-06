import { Router } from "express";
import { getAuth, createClerkClient } from "@clerk/express";
import { db, users } from "@workspace/db";
import { userAuthStatus } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { getOrCreateUser } from "../lib/billing-logic.js";
import {
  validatePhoneNumber,
  validateEmail,
  generateVerificationCode,
  isCodeExpired,
} from "../lib/phone-validation.js";

// ── Pure-crypto TOTP helpers (RFC 6238 / RFC 4226) ───────────────────────────

function base32Decode(input: string): Buffer {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const str = input.toUpperCase().replace(/=+$/, "");
  const output: number[] = [];
  let bits = 0, value = 0;
  for (const ch of str) {
    const idx = chars.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { output.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(output);
}

function generateTotpSecret(): string {
  // Proper RFC 4648 base32 encoding of 20 random bytes → 32-character secret.
  // 20 bytes × 8 bits = 160 bits; 160 / 5 bits-per-char = exactly 32 chars (no padding needed).
  // Authenticator apps require secrets that are multiples of 8 base32 chars (16, 24, 32…).
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const raw = crypto.randomBytes(20);
  let result = "";
  let buf = 0, bitsLeft = 0;
  for (const byte of raw) {
    buf = (buf << 8) | byte;
    bitsLeft += 8;
    while (bitsLeft >= 5) {
      bitsLeft -= 5;
      result += chars[(buf >> bitsLeft) & 0x1f];
    }
  }
  return result; // always 32 chars for 20-byte input
}

function computeTotp(secret: string, window = 0): string {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / 30) + window;
  const buf = Buffer.alloc(8);
  let tmp = counter;
  for (let i = 7; i >= 0; i--) { buf[i] = tmp & 0xff; tmp = Math.floor(tmp / 256); }
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (
    ((hmac[offset]     & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) <<  8) |
     (hmac[offset + 3] & 0xff)
  ) % 1_000_000;
  return code.toString().padStart(6, "0");
}

function verifyTotp(secret: string, token: string, drift = 1): boolean {
  for (let w = -drift; w <= drift; w++) {
    if (computeTotp(secret, w) === token) return true;
  }
  return false;
}

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
// Validates phone (blocks VOIP/virtual) and sends SMS code via Twilio

auth2faRouter.post("/auth/phone/send-code", async (req, res) => {
  const clerkId = getUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Unauthorized" });

  const { phoneNumber } = req.body as { phoneNumber?: string };
  if (!phoneNumber) return res.status(400).json({ error: "Phone number required." });

  // ── Step 1: structural validity via libphonenumber-js ────────────────────
  const validation = validatePhoneNumber(phoneNumber);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.reason, isVoIP: validation.isVoIP });
  }

  const hasTwilio =
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER;

  // ── Step 2: Twilio Lookup — line type check (catches virtual/VoIP) ───────
  if (hasTwilio) {
    try {
      const { default: twilio } = await import("twilio");
      const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
      const lookup = await client.lookups.v2
        .phoneNumbers(validation.normalized!)
        .fetch({ fields: "line_type_intelligence" });

      const lineType: string | undefined =
        (lookup as any).lineTypeIntelligence?.type?.toLowerCase();

      const BLOCKED_LINE_TYPES = ["voip", "nonFixedVoip", "virtual", "toll-free", "premium-rate"];
      if (lineType && BLOCKED_LINE_TYPES.some((t) => lineType.includes(t))) {
        return res.status(400).json({
          error: `This number is registered as a ${lineType} line and is not supported. Please use a real mobile or landline number.`,
          isVoIP: true,
        });
      }
    } catch (lookupErr: any) {
      // Lookup errors (e.g. unknown number) treated as invalid
      req.log.warn({ lookupErr }, "Twilio Lookup failed");
      if (lookupErr?.status === 404 || lookupErr?.code === 20404) {
        return res.status(400).json({
          error: "This phone number could not be verified. Please check the number and try again.",
        });
      }
      // Non-404 errors (API issues): fall through and allow — don't block real users
    }
  }

  // ── Step 3: Rate-limit — one code per 60 seconds ─────────────────────────
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

    // ── Step 4: Send SMS ──────────────────────────────────────────────────
    if (hasTwilio) {
      const { default: twilio } = await import("twilio");
      const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
      await client.messages.create({
        to: validation.normalized!,
        from: process.env.TWILIO_PHONE_NUMBER!,
        body: `Your GTPro verification code is: ${code}. Valid for 10 minutes. Do not share this code.`,
      });
      req.log.info({ clerkId }, "Phone verification code sent via Twilio");
      return res.json({ success: true, message: "Verification code sent to your phone." });
    } else if (process.env.NODE_ENV === "development") {
      // Dev mode: no Twilio — return the code directly so the flow can be tested
      req.log.warn({ clerkId, code }, "Dev mode: returning SMS code in response (Twilio not configured)");
      return res.json({
        success: true,
        message: "Dev mode: SMS not sent. Use the code shown below.",
        devCode: code,
      });
    } else {
      // Production with no Twilio configured
      req.log.warn({ clerkId }, "SMS not sent — no Twilio credentials configured");
      return res.status(503).json({
        error: "SMS service is not available. Please contact support.",
      });
    }
  } catch (err: any) {
    req.log.error({ err }, "Failed to send phone code");
    // Surface Twilio-specific rejection messages (e.g. landline, unroutable)
    const twilioMsg: string | undefined = err?.message;
    if (twilioMsg && (twilioMsg.includes("unroutable") || twilioMsg.includes("landline") || twilioMsg.includes("not a mobile"))) {
      return res.status(400).json({ error: "This number cannot receive SMS. Please use a mobile number." });
    }
    return res.status(500).json({ error: "Failed to send verification code. Please try again." });
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

// ── POST /api/auth/2fa/setup ───────────────────────────────────────────────
// Generates a server-side TOTP secret and returns an otpauth URI

auth2faRouter.post("/auth/2fa/setup", async (req, res) => {
  const clerkId = getUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const secret = generateTotpSecret();
    // Standard otpauth URI: otpauth://totp/Issuer:account?secret=…&issuer=…
    const issuer = "GTPro";
    const account = (req.body as { email?: string }).email?.trim() || clerkId;
    const label = encodeURIComponent(`${issuer}:${account}`);
    const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;

    await upsertAuthStatus(clerkId, { totpSecret: secret, totpEnabled: false });

    req.log.info({ clerkId }, "TOTP secret generated");
    return res.json({ success: true, uri, secret });
  } catch (err) {
    req.log.error({ err }, "Failed to create TOTP");
    return res.status(500).json({ error: "Failed to generate TOTP" });
  }
});

// ── POST /api/auth/2fa/verify-totp ────────────────────────────────────────
// Verifies a TOTP code against the stored secret

auth2faRouter.post("/auth/2fa/verify-totp", async (req, res) => {
  const clerkId = getUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Unauthorized" });

  const { code } = req.body as { code?: string };
  if (!code || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: "A 6-digit code is required." });
  }

  try {
    const [record] = await db
      .select({ totpSecret: userAuthStatus.totpSecret })
      .from(userAuthStatus)
      .where(eq(userAuthStatus.clerkId, clerkId));

    if (!record?.totpSecret) {
      return res.status(400).json({ error: "No TOTP setup in progress. Please start setup first." });
    }

    const isValid = verifyTotp(record.totpSecret, code);
    if (!isValid) {
      return res.status(400).json({ error: "Invalid code. Please try again." });
    }

    await upsertAuthStatus(clerkId, { totpEnabled: true });
    req.log.info({ clerkId }, "TOTP verified and enabled");
    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "TOTP verification failed");
    return res.status(500).json({ error: "Verification failed" });
  }
});

export default auth2faRouter;
