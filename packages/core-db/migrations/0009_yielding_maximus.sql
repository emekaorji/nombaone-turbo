CREATE TYPE "public"."default_collection_method" AS ENUM('charge_automatically', 'send_invoice');--> statement-breakpoint
CREATE TYPE "public"."dunning_attempt_status" AS ENUM('scheduled', 'attempting', 'succeeded', 'rescheduled', 'card_update_required', 'exhausted');--> statement-breakpoint
CREATE TYPE "public"."dunning_branch" AS ENUM('reschedule', 'card_update_required', 'short_path');--> statement-breakpoint
CREATE TABLE "dunning_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"environment" "environment" NOT NULL,
	"subscription_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"status" "dunning_attempt_status" NOT NULL,
	"branch" "dunning_branch" NOT NULL,
	"rail_key" text,
	"failure_reason" text,
	"gateway_message" text,
	"outcome" text,
	"scheduled_at" timestamp with time zone NOT NULL,
	"executed_at" timestamp with time zone,
	"next_attempt_at" timestamp with time zone,
	"comms_sent_at" timestamp with time zone,
	"comms_event_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_billing_settings" ADD COLUMN "dunning_max_attempts" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "org_billing_settings" ADD COLUMN "dunning_intervals_hours" jsonb DEFAULT '[24,72,120,168]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "org_billing_settings" ADD COLUMN "dunning_max_window_hours" integer DEFAULT 336 NOT NULL;--> statement-breakpoint
ALTER TABLE "org_billing_settings" ADD COLUMN "grace_period_hours" integer DEFAULT 72 NOT NULL;--> statement-breakpoint
ALTER TABLE "org_billing_settings" ADD COLUMN "payday_days" jsonb DEFAULT '[26,27,28,29,30,1]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "org_billing_settings" ADD COLUMN "payday_pull_forward_days" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "org_billing_settings" ADD COLUMN "payday_bias_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "org_billing_settings" ADD COLUMN "default_collection_method" "default_collection_method" DEFAULT 'charge_automatically' NOT NULL;--> statement-breakpoint
ALTER TABLE "org_billing_settings" ADD COLUMN "comms_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "dunning_attempts" ADD CONSTRAINT "dunning_attempts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dunning_attempts" ADD CONSTRAINT "dunning_attempts_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dunning_attempts" ADD CONSTRAINT "dunning_attempts_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dunning_attempts_reference_unique" ON "dunning_attempts" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "dunning_attempts_invoice_attempt_unique" ON "dunning_attempts" USING btree ("invoice_id","attempt_number");--> statement-breakpoint
CREATE INDEX "dunning_attempts_due_idx" ON "dunning_attempts" USING btree ("environment","next_attempt_at") WHERE "dunning_attempts"."status" = 'scheduled';--> statement-breakpoint
CREATE INDEX "dunning_attempts_keyset_idx" ON "dunning_attempts" USING btree ("organization_id","environment","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);