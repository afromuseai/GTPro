import { pgTable, text, timestamp, numeric, integer } from "drizzle-orm/pg-core";

export const tradeJournal = pgTable("trade_journal", {
  id:         text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  signalType: text("signal_type").notNull(),
  ticker:     text("ticker").notNull().default("BTC/USDT"),
  entryPrice: numeric("entry_price", { precision: 18, scale: 2 }).notNull(),
  confidence: integer("confidence").notNull(),
  strategy:   text("strategy").notNull(),
  reasoning:  text("reasoning"),
  pnl:        numeric("pnl", { precision: 18, scale: 4 }),
  executedAt: timestamp("executed_at").defaultNow().notNull(),
});

export type TradeJournalEntry    = typeof tradeJournal.$inferSelect;
export type InsertTradeJournalEntry = typeof tradeJournal.$inferInsert;
