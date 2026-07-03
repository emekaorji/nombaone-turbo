CREATE TYPE "public"."cancellation_reason" AS ENUM('voluntary', 'involuntary');--> statement-breakpoint
CREATE TYPE "public"."collection_method" AS ENUM('charge_automatically', 'send_invoice');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'paused', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."billing_reason" AS ENUM('subscription_create', 'subscription_cycle', 'subscription_update', 'manual');--> statement-breakpoint
CREATE TYPE "public"."invoice_line_kind" AS ENUM('subscription', 'proration', 'discount', 'credit', 'adjustment');--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"environment" "environment" NOT NULL,
	"customer_id" uuid NOT NULL,
	"price_id" uuid NOT NULL,
	"default_payment_method_id" uuid,
	"status" "subscription_status" NOT NULL,
	"collection_method" "collection_method" DEFAULT 'charge_automatically' NOT NULL,
	"current_period_index" integer DEFAULT 0 NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"billing_cycle_anchor" timestamp with time zone,
	"trial_start" timestamp with time zone,
	"trial_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"paused_at" timestamp with time zone,
	"pause_max_days" integer,
	"cancellation_reason" "cancellation_reason",
	"version" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"environment" "environment" NOT NULL,
	"subscription_id" uuid NOT NULL,
	"price_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_amount" bigint NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"environment" "environment" NOT NULL,
	"customer_id" uuid NOT NULL,
	"subscription_id" uuid,
	"period_index" integer,
	"billing_reason" "billing_reason" NOT NULL,
	"currency" text DEFAULT 'NGN' NOT NULL,
	"subtotal" bigint NOT NULL,
	"discount_total" bigint DEFAULT 0 NOT NULL,
	"total" bigint NOT NULL,
	"amount_due" bigint NOT NULL,
	"amount_paid" bigint DEFAULT 0 NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"ledger_transaction_id" uuid,
	"due_date" timestamp with time zone,
	"finalized_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"environment" "environment" NOT NULL,
	"invoice_id" uuid NOT NULL,
	"subscription_item_id" uuid,
	"kind" "invoice_line_kind" NOT NULL,
	"description" text NOT NULL,
	"amount" bigint NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_price_id_prices_id_fk" FOREIGN KEY ("price_id") REFERENCES "public"."prices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_default_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("default_payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_items" ADD CONSTRAINT "subscription_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_items" ADD CONSTRAINT "subscription_items_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_items" ADD CONSTRAINT "subscription_items_price_id_prices_id_fk" FOREIGN KEY ("price_id") REFERENCES "public"."prices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_subscription_item_id_subscription_items_id_fk" FOREIGN KEY ("subscription_item_id") REFERENCES "public"."subscription_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_reference_unique" ON "subscriptions" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "subscriptions_keyset_idx" ON "subscriptions" USING btree ("organization_id","environment","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "subscriptions_customer_idx" ON "subscriptions" USING btree ("organization_id","environment","customer_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("organization_id","environment","status");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_items_reference_unique" ON "subscription_items" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "subscription_items_subscription_idx" ON "subscription_items" USING btree ("organization_id","environment","subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_reference_unique" ON "invoices" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_subscription_period_unique" ON "invoices" USING btree ("subscription_id","period_index") WHERE "invoices"."subscription_id" is not null;--> statement-breakpoint
CREATE INDEX "invoices_keyset_idx" ON "invoices" USING btree ("organization_id","environment","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "invoices_customer_idx" ON "invoices" USING btree ("organization_id","environment","customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_line_items_reference_unique" ON "invoice_line_items" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "invoice_line_items_invoice_idx" ON "invoice_line_items" USING btree ("organization_id","environment","invoice_id");