CREATE TYPE "public"."subscription_schedule_status" AS ENUM('active', 'released', 'canceled');--> statement-breakpoint
CREATE TABLE "subscription_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"environment" "environment" NOT NULL,
	"subscription_id" uuid NOT NULL,
	"period_index" integer NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"invoice_id" uuid,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_periods_period_index_nonneg" CHECK ("subscription_periods"."period_index" >= 0)
);
--> statement-breakpoint
CREATE TABLE "subscription_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"environment" "environment" NOT NULL,
	"subscription_id" uuid NOT NULL,
	"status" "subscription_schedule_status" DEFAULT 'active' NOT NULL,
	"phases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_methods" ADD COLUMN "expiring_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "next_billing_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "trial_will_end_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscription_periods" ADD CONSTRAINT "subscription_periods_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_periods" ADD CONSTRAINT "subscription_periods_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_periods" ADD CONSTRAINT "subscription_periods_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_schedules" ADD CONSTRAINT "subscription_schedules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_schedules" ADD CONSTRAINT "subscription_schedules_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_periods_sub_period_unique" ON "subscription_periods" USING btree ("subscription_id","period_index");--> statement-breakpoint
CREATE INDEX "subscription_periods_due_idx" ON "subscription_periods" USING btree ("organization_id","environment","period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_schedules_reference_unique" ON "subscription_schedules" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "subscription_schedules_keyset_idx" ON "subscription_schedules" USING btree ("organization_id","environment","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "subscription_schedules_subscription_idx" ON "subscription_schedules" USING btree ("organization_id","environment","subscription_id");--> statement-breakpoint
CREATE INDEX "subscriptions_due_idx" ON "subscriptions" USING btree ("organization_id","environment","next_billing_at");