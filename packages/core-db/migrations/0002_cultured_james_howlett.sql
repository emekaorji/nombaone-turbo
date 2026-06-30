CREATE TYPE "public"."plan_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."price_billing_scheme" AS ENUM('per_unit', 'tiered');--> statement-breakpoint
CREATE TYPE "public"."price_interval" AS ENUM('day', 'week', 'month', 'year');--> statement-breakpoint
CREATE TYPE "public"."price_usage_type" AS ENUM('licensed', 'metered');--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"environment" "environment" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "plan_status" DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"environment" "environment" NOT NULL,
	"plan_id" uuid NOT NULL,
	"unit_amount" bigint NOT NULL,
	"currency" text DEFAULT 'NGN' NOT NULL,
	"interval" "price_interval" NOT NULL,
	"interval_count" integer DEFAULT 1 NOT NULL,
	"usage_type" "price_usage_type" DEFAULT 'licensed' NOT NULL,
	"billing_scheme" "price_billing_scheme" DEFAULT 'per_unit' NOT NULL,
	"trial_period_days" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prices_unit_amount_positive" CHECK ("prices"."unit_amount" > 0),
	CONSTRAINT "prices_interval_count_positive" CHECK ("prices"."interval_count" > 0),
	CONSTRAINT "prices_trial_days_nonneg" CHECK ("prices"."trial_period_days" >= 0),
	CONSTRAINT "prices_currency_ngn" CHECK ("prices"."currency" = 'NGN')
);
--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plans_reference_unique" ON "plans" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "plans_org_env_name_unique" ON "plans" USING btree ("organization_id","environment","name");--> statement-breakpoint
CREATE INDEX "plans_keyset_idx" ON "plans" USING btree ("organization_id","environment","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "prices_reference_unique" ON "prices" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "prices_plan_active_idx" ON "prices" USING btree ("plan_id","active");--> statement-breakpoint
CREATE INDEX "prices_keyset_idx" ON "prices" USING btree ("organization_id","environment","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);