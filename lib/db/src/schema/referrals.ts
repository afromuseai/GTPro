import { pgTable, text, real, timestamp, boolean } from "drizzle-orm/pg-core";

export const referralCodes = pgTable("referral_codes", {
  id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId:    text("user_id").notNull().unique(),
  code:      text("code").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const referrals = pgTable("referrals", {
  id:              text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  referrerId:      text("referrer_id").notNull(),
  referredUserId:  text("referred_user_id").notNull().unique(),
  referredEmail:   text("referred_email").notNull(),
  creditAmount:    real("credit_amount").notNull().default(10),
  status:          text("status").notNull().default("pending"),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
  completedAt:     timestamp("completed_at"),
});

export type ReferralCode    = typeof referralCodes.$inferSelect;
export type Referral        = typeof referrals.$inferSelect;
export type InsertReferral  = typeof referrals.$inferInsert;
