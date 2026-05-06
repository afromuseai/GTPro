import { pgTable, text, real, integer, timestamp, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id:                    text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clerkId:               text("clerk_id").notNull().unique(),
  email:                 text("email").notNull().unique(),
  balance:               real("balance").notNull().default(0),         // service credits only
  lockedBalance:         real("locked_balance").notNull().default(0),  // credits locked for active sessions
  totalSpent:            real("total_spent").notNull().default(0),

  // Plan info
  billingPlan:    text("billing_plan").notNull().default("free"), // free, weekly, monthly
  planExpiresAt:  timestamp("plan_expires_at"),
  includedHours:  integer("included_hours").notNull().default(0),
  usedHours:      integer("used_hours").notNull().default(0),

  // Onboarding
  hasCompletedOnboarding: boolean("has_completed_onboarding").notNull().default(false),

  // Simulated profit tracking (display only — never added to balance)
  totalSimulatedProfit: real("total_simulated_profit").notNull().default(0),

  createdAt:      timestamp("created_at").defaultNow().notNull(),
  updatedAt:      timestamp("updated_at").defaultNow().notNull(),
});

export const botSessions = pgTable("bot_sessions", {
  id:               text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId:           text("user_id").notNull(),
  strategy:         text("strategy").notNull(),

  startTime:        timestamp("start_time").notNull(),
  endTime:          timestamp("end_time"),
  estimatedDuration:real("estimated_duration_hours").notNull(),
  actualDuration:   real("actual_duration_hours"),

  hourlyRate:       real("hourly_rate").notNull(),
  estimatedCost:    real("estimated_cost").notNull(),
  totalCost:        real("total_cost"),
  paidFromPlan:     boolean("paid_from_plan").notNull().default(false),

  status:           text("status").notNull().default("running"),

  // Simulated profit recorded at session end (display only)
  simulatedProfit:  real("simulated_profit"),

  createdAt:        timestamp("created_at").defaultNow().notNull(),
});

export const transactions = pgTable("transactions", {
  id:           text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId:       text("user_id").notNull(),
  // type: deposit | usage | refund | plan_purchase   ("profit" no longer used)
  type:         text("type").notNull(),
  amount:       real("amount").notNull(),

  sessionId:    text("session_id"),
  planType:     text("plan_type"),

  status:       text("status").notNull().default("completed"),
  description:  text("description"),

  createdAt:    timestamp("created_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type BotSession = typeof botSessions.$inferSelect;
export type InsertBotSession = typeof botSessions.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;
