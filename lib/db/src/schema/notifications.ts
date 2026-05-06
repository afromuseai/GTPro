import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const notifications = pgTable("notifications", {
  id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId:    text("user_id").notNull(),
  type:      text("type").notNull(),
  title:     text("title").notNull(),
  message:   text("message").notNull(),
  read:      boolean("read").notNull().default(false),
  link:      text("link"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Notification    = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
