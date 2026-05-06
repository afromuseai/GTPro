import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const userAuthStatus = pgTable("user_auth_status", {
  id:                       text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clerkId:                  text("clerk_id").notNull().unique(),
  email:                    text("email").notNull().default(""),

  totpEnabled:              boolean("totp_enabled").notNull().default(false),

  phoneNumber:              text("phone_number"),
  phoneVerified:            boolean("phone_verified").notNull().default(false),
  phoneVerificationCode:    text("phone_verification_code"),
  phoneVerificationSentAt:  timestamp("phone_verification_sent_at"),

  emailVerified:            boolean("email_verified").notNull().default(false),

  signupCompleted:          boolean("signup_completed").notNull().default(false),
  signupCompletedAt:        timestamp("signup_completed_at"),

  createdAt:                timestamp("created_at").defaultNow().notNull(),
  updatedAt:                timestamp("updated_at").defaultNow().notNull(),
});
