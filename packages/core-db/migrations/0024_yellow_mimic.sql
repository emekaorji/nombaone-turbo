CREATE TYPE "public"."payout_account_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TABLE "org_payout_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"mode" "mode" NOT NULL,
	"bank_code" text NOT NULL,
	"bank_name" text NOT NULL,
	"account_number" text NOT NULL,
	"account_name" text NOT NULL,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "payout_account_status" DEFAULT 'active' NOT NULL,
	"is_default" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_billing_settings" ADD COLUMN "payout_hold_hours" numeric DEFAULT '3' NOT NULL;--> statement-breakpoint
ALTER TABLE "org_payout_accounts" ADD CONSTRAINT "org_payout_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "org_payout_accounts_reference_unique" ON "org_payout_accounts" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "org_payout_accounts_default_unique" ON "org_payout_accounts" USING btree ("organization_id","mode") WHERE "org_payout_accounts"."is_default";--> statement-breakpoint
CREATE UNIQUE INDEX "org_payout_accounts_account_unique" ON "org_payout_accounts" USING btree ("organization_id","mode","bank_code","account_number");--> statement-breakpoint
CREATE INDEX "org_payout_accounts_org_idx" ON "org_payout_accounts" USING btree ("organization_id","mode");--> statement-breakpoint
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_tenant_balance_non_negative" CHECK ("ledger_accounts"."key" IS NULL OR "ledger_accounts"."key" NOT LIKE 'tenant_settlement:%' OR "ledger_accounts"."balance" >= 0);