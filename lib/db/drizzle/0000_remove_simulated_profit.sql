CREATE TABLE "exchange_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"exchange" text NOT NULL,
	"endpoint" text NOT NULL,
	"encrypted_api_key" text NOT NULL,
	"encrypted_api_secret" text NOT NULL,
	"encrypted_passphrase" text,
	"testnet" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "bot_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"strategy" text NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"estimated_duration_hours" real NOT NULL,
	"actual_duration_hours" real,
	"hourly_rate" real NOT NULL,
	"estimated_cost" real NOT NULL,
	"total_cost" real,
	"paid_from_plan" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"amount" real NOT NULL,
	"session_id" text,
	"plan_type" text,
	"status" text DEFAULT 'completed' NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"clerk_id" text NOT NULL,
	"email" text NOT NULL,
	"balance" real DEFAULT 0 NOT NULL,
	"locked_balance" real DEFAULT 0 NOT NULL,
	"total_spent" real DEFAULT 0 NOT NULL,
	"billing_plan" text DEFAULT 'free' NOT NULL,
	"plan_expires_at" timestamp,
	"included_hours" integer DEFAULT 0 NOT NULL,
	"used_hours" integer DEFAULT 0 NOT NULL,
	"has_completed_onboarding" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_auth_status" (
	"id" text PRIMARY KEY NOT NULL,
	"clerk_id" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"phone_number" text,
	"phone_verified" boolean DEFAULT false NOT NULL,
	"phone_verification_code" text,
	"phone_verification_sent_at" timestamp,
	"email_verified" boolean DEFAULT false NOT NULL,
	"signup_completed" boolean DEFAULT false NOT NULL,
	"signup_completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_auth_status_clerk_id_unique" UNIQUE("clerk_id")
);
