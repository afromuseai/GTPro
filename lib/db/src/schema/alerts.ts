import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const alertPreferences = pgTable("alert_preferences", {
  id:              text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId:          text("user_id").notNull().unique(),
  emailEnabled:    boolean("email_enabled").notNull().default(false),
  smsEnabled:      boolean("sms_enabled").notNull().default(false),
  phoneNumber:     text("phone_number"),
  onTradeOpen:     boolean("on_trade_open").notNull().default(true),
  onTradeClose:    boolean("on_trade_close").notNull().default(true),
  onStopLoss:      boolean("on_stop_loss").notNull().default(true),
  onTakeProfit:    boolean("on_take_profit").notNull().default(true),
  onBotStop:       boolean("on_bot_stop").notNull().default(true),
  onHighSignal:    boolean("on_high_signal").notNull().default(false),
  webhookUrl:      text("webhook_url"),
  webhookEnabled:  boolean("webhook_enabled").notNull().default(false),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
  updatedAt:       timestamp("updated_at").defaultNow().notNull(),
});

export type AlertPreferences       = typeof alertPreferences.$inferSelect;
export type InsertAlertPreferences = typeof alertPreferences.$inferInsert;
