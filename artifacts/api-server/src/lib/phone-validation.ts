import {
  parsePhoneNumber,
  isValidPhoneNumber,
  ParseError,
} from "libphonenumber-js";

// ── Number types that are NOT accepted ───────────────────────────────────────
// libphonenumber-js types: MOBILE, FIXED_LINE, FIXED_LINE_OR_MOBILE,
// VOIP, PREMIUM_RATE, TOLL_FREE, SHARED_COST, PERSONAL_NUMBER,
// PAGER, UAN, VOICEMAIL, UNKNOWN
const REJECTED_TYPES = new Set([
  "VOIP",
  "PREMIUM_RATE",
  "TOLL_FREE",
  "SHARED_COST",
  "PERSONAL_NUMBER",
  "PAGER",
  "UAN",
  "VOICEMAIL",
]);

// ── Temp / disposable email domains ─────────────────────────────────────────
const TEMP_EMAIL_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org",
  "guerrillamail.biz", "guerrillamail.de", "guerrillamail.info",
  "10minutemail.com", "10minutemail.net", "10minutemail.org",
  "tempmail.com", "tempmail.net", "temp-mail.org", "temp-mail.io",
  "throwam.com", "throwaway.email", "trashmail.com", "trashmail.at",
  "trashmail.io", "trashmail.me", "trashmail.net", "trashmail.org",
  "dispostable.com", "discard.email", "discardmail.com",
  "yopmail.com", "yopmail.fr", "yopmail.net",
  "sharklasers.com", "guerrillamailblock.com", "grr.la", "spam4.me",
  "fakeinbox.com", "mailnull.com", "spamgourmet.com", "maildrop.cc",
  "nwytg.com", "spamtrap.ro", "spam.la", "byom.de",
  "anonaddy.com", "anonymize.com", "spamex.com", "mailbucket.org",
  "emailtemporario.com.br", "spoofmail.de", "fakemail.net",
  "getairmail.com", "spamfree24.org", "spaml.de", "spamspot.com",
  "mailmetrash.com", "filzmail.com", "kurzepost.de", "objectmail.com",
]);

export interface PhoneValidationResult {
  valid: boolean;
  reason?: string;
  isVoIP?: boolean;
  isTemporal?: boolean;
  normalized?: string;
}

export interface EmailValidationResult {
  valid: boolean;
  reason?: string;
  isTempEmail?: boolean;
}

// ── validatePhoneNumber ───────────────────────────────────────────────────────
export function validatePhoneNumber(phone: string): PhoneValidationResult {
  const cleaned = phone.trim();

  if (!cleaned) {
    return { valid: false, reason: "Phone number is required." };
  }

  // Must include a + country code to be parseable
  if (!cleaned.startsWith("+")) {
    return {
      valid: false,
      reason: "Phone number must include a country code (e.g. +1 555 123 4567).",
    };
  }

  let parsed: ReturnType<typeof parsePhoneNumber>;
  try {
    parsed = parsePhoneNumber(cleaned);
  } catch (err) {
    if (err instanceof ParseError) {
      return {
        valid: false,
        reason: "Invalid phone number format. Please include your country code (e.g. +1 555 123 4567).",
      };
    }
    return { valid: false, reason: "Could not parse phone number." };
  }

  // libphonenumber-js full structural + country validity check
  if (!isValidPhoneNumber(cleaned)) {
    return {
      valid: false,
      reason: `This does not appear to be a valid phone number for ${parsed.country ?? "your region"}. Please double-check the number and country code.`,
    };
  }

  // Check number type
  const numberType = parsed.getType();
  if (numberType && REJECTED_TYPES.has(numberType)) {
    return {
      valid: false,
      reason: "VoIP, virtual, toll-free, and premium-rate numbers are not supported. Please use a real mobile or landline number.",
      isVoIP: true,
    };
  }

  const normalized = parsed.number; // E.164 format
  return { valid: true, normalized };
}

// ── validateEmail ─────────────────────────────────────────────────────────────
export function validateEmail(email: string): EmailValidationResult {
  const lower = email.toLowerCase().trim();

  if (!lower || !lower.includes("@")) {
    return { valid: false, reason: "Invalid email address." };
  }

  const parts = lower.split("@");
  if (parts.length !== 2 || !parts[1] || !parts[1].includes(".")) {
    return { valid: false, reason: "Invalid email address." };
  }

  const domain = parts[1];

  if (TEMP_EMAIL_DOMAINS.has(domain)) {
    return {
      valid: false,
      reason: "Temporary or disposable email addresses are not allowed. Please use your real email address.",
      isTempEmail: true,
    };
  }

  if ((domain === "gmail.com" || domain === "googlemail.com") && parts[0].includes("+")) {
    return {
      valid: false,
      reason: "Email aliases (using +) are not allowed. Please use your primary email address.",
      isTempEmail: true,
    };
  }

  return { valid: true };
}

// ── generateVerificationCode ──────────────────────────────────────────────────
export function generateVerificationCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ── isCodeExpired ─────────────────────────────────────────────────────────────
export function isCodeExpired(sentAt: Date): boolean {
  const TEN_MINUTES_MS = 10 * 60 * 1000;
  return Date.now() - sentAt.getTime() > TEN_MINUTES_MS;
}
