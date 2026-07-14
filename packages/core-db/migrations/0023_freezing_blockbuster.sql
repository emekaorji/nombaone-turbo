ALTER TYPE "public"."dunning_branch" ADD VALUE 'payment_reminder';--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "reminder_sent_for_index" integer;--> statement-breakpoint
ALTER TABLE "org_billing_settings" ADD COLUMN "renewal_reminder_lead_hours" numeric DEFAULT '24' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_methods_customer_token_unique" ON "payment_methods" USING btree ("customer_id","token_key") WHERE "payment_methods"."token_key" IS NOT NULL;