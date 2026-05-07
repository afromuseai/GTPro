import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, alertPreferences } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function getUserId(req: Parameters<typeof getAuth>[0]): string | null {
  return getAuth(req)?.userId ?? null;
}

// ── GET /api/alerts/preferences ───────────────────────────────────────────────

router.get("/alerts/preferences", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const [prefs] = await db.select().from(alertPreferences).where(eq(alertPreferences.userId, userId));
    if (!prefs) {
      res.json({
        emailEnabled: false, smsEnabled: false, phoneNumber: null,
        onTradeOpen: true, onTradeClose: true, onStopLoss: true,
        onTakeProfit: true, onBotStop: true, onHighSignal: false,
        webhookUrl: null, webhookEnabled: false,
      });
      return;
    }
    res.json(prefs);
  } catch {
    res.status(500).json({ error: "Failed to fetch alert preferences" });
  }
});

// ── PUT /api/alerts/preferences ───────────────────────────────────────────────

router.put("/alerts/preferences", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const {
    emailEnabled, smsEnabled, phoneNumber,
    onTradeOpen, onTradeClose, onStopLoss, onTakeProfit, onBotStop, onHighSignal,
    webhookUrl, webhookEnabled,
  } = req.body as Partial<{
    emailEnabled: boolean; smsEnabled: boolean; phoneNumber: string;
    onTradeOpen: boolean; onTradeClose: boolean; onStopLoss: boolean;
    onTakeProfit: boolean; onBotStop: boolean; onHighSignal: boolean;
    webhookUrl: string; webhookEnabled: boolean;
  }>;

  try {
    const existing = await db.select().from(alertPreferences).where(eq(alertPreferences.userId, userId));
    const data = {
      userId,
      emailEnabled:   emailEnabled   ?? false,
      smsEnabled:     smsEnabled     ?? false,
      phoneNumber:    phoneNumber    ?? null,
      onTradeOpen:    onTradeOpen    ?? true,
      onTradeClose:   onTradeClose   ?? true,
      onStopLoss:     onStopLoss     ?? true,
      onTakeProfit:   onTakeProfit   ?? true,
      onBotStop:      onBotStop      ?? true,
      onHighSignal:   onHighSignal   ?? false,
      webhookUrl:     webhookUrl     ?? null,
      webhookEnabled: webhookEnabled ?? false,
      updatedAt:      new Date(),
    };

    if (existing.length > 0) {
      await db.update(alertPreferences).set(data).where(eq(alertPreferences.userId, userId));
    } else {
      await db.insert(alertPreferences).values(data);
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to save alert preferences" });
  }
});

// ── POST /api/alerts/send ─────────────────────────────────────────────────────
// Called internally by the bot engine (via client API call) to trigger SMS/webhook

router.post("/alerts/send", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { event, message } = req.body as { event: string; message: string };
  if (!event || !message) { res.status(400).json({ error: "event and message required" }); return; }

  try {
    const [prefs] = await db.select().from(alertPreferences).where(eq(alertPreferences.userId, userId));
    if (!prefs) { res.json({ sent: false, reason: "no_prefs" }); return; }

    const eventMap: Record<string, keyof typeof prefs> = {
      trade_open:   "onTradeOpen",
      trade_close:  "onTradeClose",
      stop_loss:    "onStopLoss",
      take_profit:  "onTakeProfit",
      bot_stop:     "onBotStop",
      high_signal:  "onHighSignal",
    };

    const prefKey = eventMap[event];
    if (prefKey && !prefs[prefKey]) { res.json({ sent: false, reason: "event_disabled" }); return; }

    let smsSent = false;
    let webhookSent = false;

    if (prefs.smsEnabled && prefs.phoneNumber && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER) {
      try {
        const creds = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
        const body = new URLSearchParams({
          To:   prefs.phoneNumber,
          From: process.env.TWILIO_FROM_NUMBER,
          Body: `GTPro Alert: ${message}`,
        });
        const twilioRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
          { method: "POST", headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" }, body }
        );
        smsSent = twilioRes.ok;
      } catch { /* Twilio not configured */ }
    }

    if (prefs.webhookEnabled && prefs.webhookUrl) {
      try {
        const webhookRes = await fetch(prefs.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event, message, timestamp: Date.now(), platform: "GTPro" }),
          signal: AbortSignal.timeout(5000),
        });
        webhookSent = webhookRes.ok;
      } catch { /* webhook failed */ }
    }

    res.json({ sent: smsSent || webhookSent, smsSent, webhookSent });
  } catch {
    res.status(500).json({ error: "Failed to send alert" });
  }
});

export default router;
