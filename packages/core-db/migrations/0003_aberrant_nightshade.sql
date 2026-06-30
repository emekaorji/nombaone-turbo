CREATE TYPE "public"."payment_method_kind" AS ENUM('card', 'mandate', 'virtual_account');--> statement-breakpoint
CREATE TYPE "public"."payment_method_status" AS ENUM('setup_pending', 'consent_pending', 'active', 'removed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."nomba_webhook_event_status" AS ENUM('received', 'processed', 'ignored', 'failed');--> statement-breakpoint
CREATE TYPE "public"."org_nomba_account_kind" AS ENUM('parent', 'subaccount');--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"environment" "environment" NOT NULL,
	"customer_id" uuid NOT NULL,
	"kind" "payment_method_kind" NOT NULL,
	"status" "payment_method_status" DEFAULT 'setup_pending' NOT NULL,
	"token_key" text,
	"brand" text,
	"last4" text,
	"exp_month" integer,
	"exp_year" integer,
	"token_expiry" text,
	"mandate_id" text,
	"account_ref" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nomba_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"organization_id" uuid,
	"environment" "environment" NOT NULL,
	"provider" text DEFAULT 'nomba' NOT NULL,
	"request_id" text NOT NULL,
	"event_type" text NOT NULL,
	"status" "nomba_webhook_event_status" DEFAULT 'received' NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_nomba_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"environment" "environment" NOT NULL,
	"nomba_account_id" text NOT NULL,
	"account_ref" text NOT NULL,
	"kind" "org_nomba_account_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nomba_webhook_events" ADD CONSTRAINT "nomba_webhook_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_nomba_accounts" ADD CONSTRAINT "org_nomba_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_methods_reference_unique" ON "payment_methods" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_methods_default_unique" ON "payment_methods" USING btree ("customer_id","environment") WHERE "payment_methods"."is_default";--> statement-breakpoint
CREATE INDEX "payment_methods_customer_idx" ON "payment_methods" USING btree ("organization_id","environment","customer_id");--> statement-breakpoint
CREATE INDEX "payment_methods_keyset_idx" ON "payment_methods" USING btree ("organization_id","environment","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "nomba_webhook_events_reference_unique" ON "nomba_webhook_events" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "nomba_webhook_events_provider_request_unique" ON "nomba_webhook_events" USING btree ("provider","request_id");--> statement-breakpoint
CREATE INDEX "nomba_webhook_events_keyset_idx" ON "nomba_webhook_events" USING btree ("environment","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "org_nomba_accounts_reference_unique" ON "org_nomba_accounts" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "org_nomba_accounts_org_env_kind_unique" ON "org_nomba_accounts" USING btree ("organization_id","environment","kind");