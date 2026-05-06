// ── VOIP / Temporal number detection ────────────────────────────────────────
// Known VOIP provider prefixes and number ranges (US-centric, expandable)
const VOIP_PREFIXES = [
  "+1800", "+1888", "+1877", "+1866", "+1855", "+1844", "+1833", // toll-free
];

// Known VOIP / virtual number area codes in US
const VOIP_AREA_CODES = new Set([
  "500", "521", "522", "533", "544", "566", "577", "588", // personal communication services
  "900", // premium
]);

// Patterns that match clearly virtual / app-issued numbers
const VOIP_PATTERNS = [
  /^\+1(472|473)\d{7}$/, // Google Voice typical
  /^\+1(770|404|678)\d{7}$/, // some VOIP blocks
];

// Temp / anonymous SIM services (TextNow, Google Voice, etc.) keyword identifiers
// In a production system, you'd call a carrier lookup API (e.g., Numverify, Twilio Lookup)
const BLOCKED_CARRIERS = ["TextNow", "Google Voice", "Bandwidth", "Twilio", "Vonage", "Skype"];

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
  "pecinan.com", "perspektivy.info", "pfui.ru", "proxymail.eu",
  "rcpt.at", "recode.me", "recursor.net", "rejectmail.com",
  "rklips.com", "safetypost.de", "sharedmailbox.org", "spam.be",
  "spamcorpse.com", "spamfree.eu", "spamgourmet.net", "spamgourmet.org",
  "incognitomail.com", "incognitomail.net", "incognitomail.org",
  "jetable.com", "jetable.fr.nf", "jetable.net", "jetable.org",
  "kasmail.com", "klassmaster.com", "klzlk.com", "kulturbotschaft.de",
  "lol.ovpn.to", "lookugly.com", "lortemail.dk", "lt2.de",
  "m4ilweb.info", "mail.by", "mail4trash.com", "maildu.de",
  "maileimer.de", "mailexpire.com", "mailguard.me", "mailimate.com",
  "mailme24.com", "mailmoat.com", "mailnew.com", "mailscrap.com",
  "mailslapping.com", "mailzilla.org",
  "mytempemail.com", "meltmail.com", "mierdamail.com",
  "mintemail.com", "mintemail.net",
  "moncourrier.fr.nf", "monemail.fr.nf", "monmail.fr.nf",
  "nospamfor.us", "nurfuerspam.de", "oe1.myftp.org",
  "onewaymail.com", "online.ms", "oopi.org",
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

// ── normalizePhone ────────────────────────────────────────────────────────────
// Returns E.164 format or null if invalid
function normalizePhone(phone: string): string | null {
  // Strip all non-digit characters except leading +
  const stripped = phone.replace(/[^\d+]/g, "");
  // Must start with + and have 7-15 digits
  const e164 = stripped.startsWith("+") ? stripped : `+${stripped}`;
  if (!/^\+\d{7,15}$/.test(e164)) return null;
  return e164;
}

// ── validatePhoneNumber ───────────────────────────────────────────────────────
export function validatePhoneNumber(phone: string): PhoneValidationResult {
  const normalized = normalizePhone(phone);

  if (!normalized) {
    return { valid: false, reason: "Invalid phone number format. Please include country code (e.g. +1 234 567 8900)." };
  }

  // Must have country code
  if (!normalized.startsWith("+")) {
    return { valid: false, reason: "Phone number must include country code (e.g. +1)." };
  }

  // Block US toll-free and PCS numbers (clear VOIP signals)
  if (normalized.startsWith("+1")) {
    const areaCode = normalized.slice(2, 5);
    if (VOIP_AREA_CODES.has(areaCode)) {
      return {
        valid: false,
        reason: "This number appears to be a virtual or VoIP number. A real mobile or landline is required.",
        isVoIP: true,
      };
    }
  }

  // Check VOIP prefixes
  for (const prefix of VOIP_PREFIXES) {
    if (normalized.startsWith(prefix)) {
      return {
        valid: false,
        reason: "Toll-free and virtual numbers are not accepted. Please use your real mobile number.",
        isVoIP: true,
      };
    }
  }

  // Check VOIP patterns
  for (const pattern of VOIP_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        valid: false,
        reason: "This number is associated with a virtual phone service. Please use your real mobile number.",
        isVoIP: true,
      };
    }
  }

  // Too short to be a real number
  if (normalized.length < 8) {
    return { valid: false, reason: "Phone number is too short." };
  }

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

  // Block known temp/disposable email domains
  if (TEMP_EMAIL_DOMAINS.has(domain)) {
    return {
      valid: false,
      reason: "Temporary or disposable email addresses are not allowed. Please use your real email address.",
      isTempEmail: true,
    };
  }

  // Block + aliasing from common providers used for throwaway
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
// Returns true if the code is older than 10 minutes
export function isCodeExpired(sentAt: Date): boolean {
  const TEN_MINUTES_MS = 10 * 60 * 1000;
  return Date.now() - sentAt.getTime() > TEN_MINUTES_MS;
}
