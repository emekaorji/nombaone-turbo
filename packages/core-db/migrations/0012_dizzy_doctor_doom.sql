CREATE TYPE "public"."nomba_account_status" AS ENUM('pending', 'active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."org_settlement_mode" AS ENUM('split_at_collection', 'collect_then_payout');--> statement-breakpoint
CREATE TYPE "public"."settlement_status" AS ENUM('pending', 'settled', 'reconciled', 'failed', 'refunded');--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"environment" "environment" NOT NULL,
	"invoice_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"sub_account_ref" text NOT NULL,
	"split_reference" text,
	"merchant_tx_ref" text NOT NULL,
	"gross_kobo" bigint NOT NULL,
	"platform_fee_kobo" bigint NOT NULL,
	"net_to_tenant_kobo" bigint NOT NULL,
	"ledger_transaction_id" uuid,
	"status" "settlement_status" DEFAULT 'settled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settlements_split_balances" CHECK ("settlements"."gross_kobo" = "settlements"."platform_fee_kobo" + "settlements"."net_to_tenant_kobo" and "settlements"."platform_fee_kobo" >= 0 and "settlements"."net_to_tenant_kobo" >= 0)
);
--> statement-breakpoint
ALTER TABLE "org_nomba_accounts" ADD COLUMN "sub_account_id" text;--> statement-breakpoint
ALTER TABLE "org_nomba_accounts" ADD COLUMN "status" "nomba_account_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "org_billing_settings" ADD COLUMN "rate_limit_per_minute" integer;--> statement-breakpoint
ALTER TABLE "org_billing_settings" ADD COLUMN "monthly_request_quota" bigint;--> statement-breakpoint
ALTER TABLE "org_billing_settings" ADD COLUMN "settlement_mode" "org_settlement_mode" DEFAULT 'split_at_collection' NOT NULL;--> statement-breakpoint
ALTER TABLE "org_billing_settings" ADD COLUMN "platform_fee_bps" integer;--> statement-breakpoint
ALTER TABLE "org_billing_settings" ADD COLUMN "platform_fee_min_kobo" bigint;--> statement-breakpoint
ALTER TABLE "org_billing_settings" ADD COLUMN "platform_fee_max_kobo" bigint;--> statement-breakpoint
ALTER TABLE "org_billing_settings" ADD COLUMN "branding" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "settlements_reference_unique" ON "settlements" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "settlements_merchant_tx_ref_unique" ON "settlements" USING btree ("merchant_tx_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "settlements_invoice_unique" ON "settlements" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "settlements_keyset_idx" ON "settlements" USING btree ("organization_id","environment","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "settlements_status_idx" ON "settlements" USING btree ("organization_id","environment","status");