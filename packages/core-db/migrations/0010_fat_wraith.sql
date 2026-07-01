ALTER TABLE "invoices" ADD COLUMN "last_failure_reason" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "last_gateway_message" text;