CREATE TYPE "public"."coupon_duration" AS ENUM('once', 'repeating', 'forever');--> statement-breakpoint
CREATE TYPE "public"."discount_status" AS ENUM('active', 'ended');--> statement-breakpoint
CREATE TYPE "public"."credit_grant_source" AS ENUM('downgrade_proration', 'manual', 'goodwill', 'coupon');--> statement-breakpoint
CREATE TYPE "public"."proration_credit_policy" AS ENUM('credit_next_cycle', 'none');--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"environment" "environment" NOT NULL,
	"code" text NOT NULL,
	"duration" "coupon_duration" NOT NULL,
	"amount_off" bigint,
	"percent_off" smallint,
	"duration_in_cycles" smallint,
	"redeem_by" timestamp with time zone,
	"max_redemptions" integer,
	"times_redeemed" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_exactly_one_kind" CHECK (("coupons"."amount_off" is not null)::int + ("coupons"."percent_off" is not null)::int = 1),
	CONSTRAINT "coupons_percent_range" CHECK ("coupons"."percent_off" is null or ("coupons"."percent_off" between 1 and 100))
);
--> statement-breakpoint
CREATE TABLE "discounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"environment" "environment" NOT NULL,
	"coupon_id" uuid NOT NULL,
	"customer_id" uuid,
	"subscription_id" uuid,
	"cycles_remaining" smallint,
	"start_at" timestamp with time zone DEFAULT now() NOT NULL,
	"end_at" timestamp with time zone,
	"status" "discount_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discounts_exactly_one_target" CHECK (("discounts"."customer_id" is not null)::int + ("discounts"."subscription_id" is not null)::int = 1)
);
--> statement-breakpoint
CREATE TABLE "credit_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"environment" "environment" NOT NULL,
	"customer_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"remaining" bigint NOT NULL,
	"source" "credit_grant_source" NOT NULL,
	"source_reference" text,
	"ledger_transaction_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_grants_remaining_range" CHECK ("credit_grants"."remaining" >= 0 and "credit_grants"."remaining" <= "credit_grants"."amount")
);
--> statement-breakpoint
CREATE TABLE "org_billing_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"environment" "environment" NOT NULL,
	"partial_collection_enabled" boolean DEFAULT false NOT NULL,
	"proration_credit_policy" "proration_credit_policy" DEFAULT 'credit_next_cycle' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "amount_remaining" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "credit_total" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "source_reference" text;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_grants" ADD CONSTRAINT "credit_grants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_grants" ADD CONSTRAINT "credit_grants_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_billing_settings" ADD CONSTRAINT "org_billing_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_reference_unique" ON "coupons" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_code_unique" ON "coupons" USING btree ("organization_id","environment","code");--> statement-breakpoint
CREATE INDEX "coupons_keyset_idx" ON "coupons" USING btree ("organization_id","environment","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "discounts_reference_unique" ON "discounts" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "discounts_active_sub_unique" ON "discounts" USING btree ("subscription_id") WHERE "discounts"."status" = 'active' and "discounts"."subscription_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "discounts_active_customer_unique" ON "discounts" USING btree ("customer_id") WHERE "discounts"."status" = 'active' and "discounts"."customer_id" is not null;--> statement-breakpoint
CREATE INDEX "discounts_keyset_idx" ON "discounts" USING btree ("organization_id","environment","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "credit_grants_reference_unique" ON "credit_grants" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "credit_grants_oldest_first_idx" ON "credit_grants" USING btree ("organization_id","environment","customer_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "org_billing_settings_org_env_unique" ON "org_billing_settings" USING btree ("organization_id","environment");