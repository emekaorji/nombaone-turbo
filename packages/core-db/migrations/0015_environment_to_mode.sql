ALTER TYPE "public"."environment" RENAME TO "mode";
--> statement-breakpoint
ALTER TYPE "public"."mode" RENAME VALUE 'test' TO 'sandbox';
--> statement-breakpoint
ALTER TABLE "org_sessions" RENAME COLUMN "environment" TO "mode";
--> statement-breakpoint
ALTER TABLE "api_keys" RENAME COLUMN "environment" TO "mode";
--> statement-breakpoint
ALTER TABLE "ledger_accounts" RENAME COLUMN "environment" TO "mode";
--> statement-breakpoint
ALTER TABLE "ledger_transactions" RENAME COLUMN "environment" TO "mode";
--> statement-breakpoint
ALTER TABLE "domain_events" RENAME COLUMN "environment" TO "mode";
--> statement-breakpoint
ALTER TABLE "webhook_endpoints" RENAME COLUMN "environment" TO "mode";
--> statement-breakpoint
ALTER TABLE "customers" RENAME COLUMN "environment" TO "mode";
--> statement-breakpoint
ALTER TABLE "plans" RENAME COLUMN "environment" TO "mode";
--> statement-breakpoint
ALTER TABLE "prices" RENAME COLUMN "environment" TO "mode";
--> statement-breakpoint
ALTER TABLE "payment_methods" RENAME COLUMN "environment" TO "mode";
--> statement-breakpoint
ALTER TABLE "nomba_webhook_events" RENAME COLUMN "environment" TO "mode";
--> statement-breakpoint
ALTER TABLE "org_nomba_accounts" RENAME COLUMN "environment" TO "mode";
--> statement-breakpoint
ALTER TABLE "subscriptions" RENAME COLUMN "environment" TO "mode";
--> statement-breakpoint
ALTER TABLE "subscription_items" RENAME COLUMN "environment" TO "mode";
--> statement-breakpoint
ALTER TABLE "subscription_periods" RENAME COLUMN "environment" TO "mode";
--> statement-breakpoint
ALTER TABLE "subscription_schedules" RENAME COLUMN "environment" TO "mode";
--> statement-breakpoint
ALTER TABLE "invoices" RENAME COLUMN "environment" TO "mode";
--> statement-breakpoint
ALTER TABLE "invoice_line_items" RENAME COLUMN "environment" TO "mode";
--> statement-breakpoint
ALTER TABLE "coupons" RENAME COLUMN "environment" TO "mode";
--> statement-breakpoint
ALTER TABLE "discounts" RENAME COLUMN "environment" TO "mode";
--> statement-breakpoint
ALTER TABLE "credit_grants" RENAME COLUMN "environment" TO "mode";
--> statement-breakpoint
ALTER TABLE "org_billing_settings" RENAME COLUMN "environment" TO "mode";
--> statement-breakpoint
ALTER TABLE "dunning_attempts" RENAME COLUMN "environment" TO "mode";
--> statement-breakpoint
ALTER TABLE "settlements" RENAME COLUMN "environment" TO "mode";
--> statement-breakpoint
ALTER TABLE "refunds" RENAME COLUMN "environment" TO "mode";
--> statement-breakpoint
ALTER TABLE "payouts" RENAME COLUMN "environment" TO "mode";
--> statement-breakpoint
ALTER TABLE "examples" RENAME COLUMN "environment" TO "mode";
