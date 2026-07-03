CREATE TYPE "public"."refund_status" AS ENUM('pending', 'ledger_only', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'ledger_posted', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"environment" "environment" NOT NULL,
	"settlement_id" uuid NOT NULL,
	"sub_account_ref" text NOT NULL,
	"amount_kobo" bigint NOT NULL,
	"merchant_tx_ref" text NOT NULL,
	"status" "refund_status" DEFAULT 'ledger_only' NOT NULL,
	"provider_reference" text,
	"ledger_transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refunds_amount_positive" CHECK ("refunds"."amount_kobo" > 0)
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"environment" "environment" NOT NULL,
	"sub_account_ref" text NOT NULL,
	"amount_kobo" bigint NOT NULL,
	"bank_code" text NOT NULL,
	"account_number" text NOT NULL,
	"resolved_account_name" text,
	"merchant_tx_ref" text NOT NULL,
	"status" "payout_status" DEFAULT 'pending' NOT NULL,
	"provider_reference" text,
	"failure_reason" text,
	"ledger_transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payouts_amount_positive" CHECK ("payouts"."amount_kobo" > 0)
);
--> statement-breakpoint
ALTER TABLE "org_billing_settings" ADD COLUMN "min_withdrawable_kobo" bigint;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_settlement_id_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."settlements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_reference_unique" ON "refunds" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_merchant_tx_ref_unique" ON "refunds" USING btree ("merchant_tx_ref");--> statement-breakpoint
CREATE INDEX "refunds_settlement_idx" ON "refunds" USING btree ("organization_id","environment","settlement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payouts_reference_unique" ON "payouts" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "payouts_merchant_tx_ref_unique" ON "payouts" USING btree ("merchant_tx_ref");--> statement-breakpoint
CREATE INDEX "payouts_keyset_idx" ON "payouts" USING btree ("organization_id","environment","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);