import { Router } from "express";
import { db, tradeJournal } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const router = Router();

// ── GET /api/journal ──────────────────────────────────────────────────────────

router.get("/journal", async (_req, res) => {
  try {
    const entries = await db
      .select()
      .from(tradeJournal)
      .orderBy(desc(tradeJournal.executedAt))
      .limit(200);
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch journal" });
  }
});

// ── POST /api/journal ─────────────────────────────────────────────────────────

router.post("/journal", async (req, res) => {
  const { signalType, ticker, entryPrice, confidence, strategy, reasoning } =
    req.body as {
      signalType: string;
      ticker: string;
      entryPrice: number;
      confidence: number;
      strategy: string;
      reasoning?: string;
    };

  if (!signalType || typeof entryPrice !== "number" || typeof confidence !== "number") {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  try {
    const [entry] = await db
      .insert(tradeJournal)
      .values({
        signalType,
        ticker:     ticker ?? "BTC/USDT",
        entryPrice: String(entryPrice),
        confidence,
        strategy:   strategy ?? "—",
        reasoning:  reasoning ?? null,
      })
      .returning();
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: "Failed to save journal entry" });
  }
});

// ── PATCH /api/journal/:id ────────────────────────────────────────────────────

router.patch("/journal/:id", async (req, res) => {
  const { id } = req.params;
  const { pnl } = req.body as { pnl?: number };

  try {
    const [updated] = await db
      .update(tradeJournal)
      .set({ pnl: pnl != null ? String(pnl) : null })
      .where(eq(tradeJournal.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Failed to update entry" });
  }
});

// ── DELETE /api/journal/:id ───────────────────────────────────────────────────

router.delete("/journal/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await db.delete(tradeJournal).where(eq(tradeJournal.id, id));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete entry" });
  }
});

export default router;
