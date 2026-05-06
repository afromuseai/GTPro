import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const exchangeCredentials = pgTable("exchange_credentials", {
  id:                   text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId:               text("user_id").notNull(),
  exchange:             text("exchange").notNull(),
  endpoint:             text("endpoint").notNull(),
  encryptedApiKey:      text("encrypted_api_key").notNull(),
  encryptedApiSecret:   text("encrypted_api_secret").notNull(),
  encryptedPassphrase:  text("encrypted_passphrase"),
  testnet:              boolean("testnet").notNull().default(false),
  createdAt:            timestamp("created_at").defaultNow().notNull(),
});

export type ExchangeCredential = typeof exchangeCredentials.$inferSelect;
export type InsertExchangeCredential = typeof exchangeCredentials.$inferInsert;
