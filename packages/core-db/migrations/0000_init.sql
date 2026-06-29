CREATE TYPE "public"."environment" AS ENUM('test', 'live');--> statement-breakpoint
CREATE TYPE "public"."org_user_role" AS ENUM('owner', 'admin', 'developer', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."operator_density" AS ENUM('compact', 'cozy', 'comfortable');--> statement-breakpoint
CREATE TYPE "public"."operator_role" AS ENUM('super_admin', 'operator', 'support', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."operator_theme" AS ENUM('light', 'dark', 'system');--> statement-breakpoint
CREATE TYPE "public"."ledger_account_kind" AS ENUM('asset', 'liability', 'revenue', 'expense', 'system');--> statement-breakpoint
CREATE TYPE "public"."ledger_transaction_kind" AS ENUM('charge', 'reversal', 'adjustment', 'settlement', 'fee');--> statement-breakpoint
CREATE TYPE "public"."ledger_direction" AS ENUM('debit', 'credit');--> statement-breakpoint
CREATE TYPE "public"."webhook_delivery_status" AS ENUM('pending', 'succeeded', 'failed', 'dead');--> statement-breakpoint
CREATE TYPE "public"."example_kind" AS ENUM('standard', 'priority');--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "org_user_role" DEFAULT 'owner' NOT NULL,
	"password_hash" text NOT NULL,
	"totp_secret_encrypted" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"environment" "environment" DEFAULT 'test' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"environment" "environment" NOT NULL,
	"name" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operator_id" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_reference" text,
	"summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operator_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operator_id" text NOT NULL,
	"theme" "operator_theme" DEFAULT 'system' NOT NULL,
	"density" "operator_density" DEFAULT 'cozy' NOT NULL,
	"default_environment" text DEFAULT 'live' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operator_preferences_operator_id_unique" UNIQUE("operator_id")
);
--> statement-breakpoint
CREATE TABLE "operators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "operator_role" DEFAULT 'viewer' NOT NULL,
	"password_hash" text NOT NULL,
	"totp_secret_encrypted" text,
	"token_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"environment" "environment" NOT NULL,
	"kind" "ledger_account_kind" NOT NULL,
	"key" text,
	"currency" text DEFAULT 'NGN' NOT NULL,
	"balance" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"environment" "environment" NOT NULL,
	"kind" "ledger_transaction_kind" NOT NULL,
	"reverses_transaction_id" uuid,
	"memo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"direction" "ledger_direction" NOT NULL,
	"amount" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_entries_amount_positive" CHECK ("ledger_entries"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "domain_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"environment" "environment" NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"environment" "environment" NOT NULL,
	"url" text NOT NULL,
	"enabled_events" jsonb DEFAULT '["*"]'::jsonb NOT NULL,
	"signing_secret_hash" text NOT NULL,
	"signing_secret_prefix" text NOT NULL,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"status" "webhook_delivery_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"response_status" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "examples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"environment" "environment" NOT NULL,
	"kind" "example_kind" DEFAULT 'standard' NOT NULL,
	"amount" bigint NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "examples_amount_positive" CHECK ("examples"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "org_users" ADD CONSTRAINT "org_users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_sessions" ADD CONSTRAINT "org_sessions_user_id_org_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."org_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_sessions" ADD CONSTRAINT "org_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_org_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."org_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_user_id_org_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."org_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_events" ADD CONSTRAINT "domain_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_event_id_domain_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."domain_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "examples" ADD CONSTRAINT "examples_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_reference_unique" ON "organizations" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "organizations_created_idx" ON "organizations" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "org_users_reference_unique" ON "org_users" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "org_users_email_unique" ON "org_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "org_users_org_idx" ON "org_users" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "org_sessions_token_hash_unique" ON "org_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "org_sessions_user_idx" ON "org_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_token_idx" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_reference_unique" ON "api_keys" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_key_hash_unique" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "api_keys_org_env_idx" ON "api_keys" USING btree ("organization_id","environment");--> statement-breakpoint
CREATE INDEX "admin_audit_log_created_idx" ON "admin_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "operators_email_unique" ON "operators" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_accounts_reference_unique" ON "ledger_accounts" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_accounts_key_unique" ON "ledger_accounts" USING btree ("organization_id","environment","key") WHERE "ledger_accounts"."key" is not null;--> statement-breakpoint
CREATE INDEX "ledger_accounts_org_env_idx" ON "ledger_accounts" USING btree ("organization_id","environment");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_transactions_reference_unique" ON "ledger_transactions" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "ledger_transactions_keyset_idx" ON "ledger_transactions" USING btree ("organization_id","environment","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ledger_entries_tx_idx" ON "ledger_entries" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_account_idx" ON "ledger_entries" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "domain_events_reference_unique" ON "domain_events" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "domain_events_keyset_idx" ON "domain_events" USING btree ("organization_id","environment","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_endpoints_reference_unique" ON "webhook_endpoints" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "webhook_endpoints_org_env_idx" ON "webhook_endpoints" USING btree ("organization_id","environment");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_deliveries_reference_unique" ON "webhook_deliveries" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_due_idx" ON "webhook_deliveries" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "examples_reference_unique" ON "examples" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "examples_keyset_idx" ON "examples" USING btree ("organization_id","environment","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);