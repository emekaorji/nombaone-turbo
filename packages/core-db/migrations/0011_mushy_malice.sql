ALTER TABLE "webhook_deliveries" ADD COLUMN "replayed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD COLUMN "replay_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "webhook_deliveries_status_list_idx" ON "webhook_deliveries" USING btree ("organization_id","status","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);