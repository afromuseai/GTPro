import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, notifications, users } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { getOrCreateUser } from "../lib/billing-logic.js";

const router = Router();

function getUserId(req: Parameters<typeof getAuth>[0]): string | null {
  const auth = getAuth(req);
  return auth?.userId ?? null;
}

// ── GET /api/notifications ────────────────────────────────────────────────────
router.get("/notifications", async (req, res) => {
  const clerkId = getUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const user = await getOrCreateUser(clerkId, "");
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
    return res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch notifications");
    return res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// ── POST /api/notifications ───────────────────────────────────────────────────
// User creates a notification for themselves (bot events, login events, etc.)
router.post("/notifications", async (req, res) => {
  const clerkId = getUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Unauthorized" });

  const { type, title, message, link } = req.body as {
    type?:    string;
    title?:   string;
    message?: string;
    link?:    string;
  };
  if (!type || !title || !message) {
    return res.status(400).json({ error: "type, title, and message are required" });
  }

  try {
    const user = await getOrCreateUser(clerkId, "");
    const [notif] = await db
      .insert(notifications)
      .values({ userId: user.id, type, title, message, link: link ?? null })
      .returning();
    return res.status(201).json(notif);
  } catch (err) {
    req.log.error({ err }, "Failed to create notification");
    return res.status(500).json({ error: "Failed to create notification" });
  }
});

// ── POST /api/notifications/read-all ─────────────────────────────────────────
router.post("/notifications/read-all", async (req, res) => {
  const clerkId = getUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const user = await getOrCreateUser(clerkId, "");
    await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.userId, user.id));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to mark all read");
    return res.status(500).json({ error: "Failed to mark all read" });
  }
});

// ── PATCH /api/notifications/:id/read ────────────────────────────────────────
router.patch("/notifications/:id/read", async (req, res) => {
  const clerkId = getUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.params;
  try {
    const user = await getOrCreateUser(clerkId, "");
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to mark notification read");
    return res.status(500).json({ error: "Failed to mark notification read" });
  }
});

// ── DELETE /api/notifications/:id ────────────────────────────────────────────
router.delete("/notifications/:id", async (req, res) => {
  const clerkId = getUserId(req);
  if (!clerkId) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.params;
  try {
    const user = await getOrCreateUser(clerkId, "");
    await db
      .delete(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete notification");
    return res.status(500).json({ error: "Failed to delete notification" });
  }
});

export default router;
