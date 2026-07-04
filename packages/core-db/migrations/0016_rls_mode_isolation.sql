DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nombaone_rls') THEN
    CREATE ROLE nombaone_rls NOLOGIN;
  END IF;
END $$
--> statement-breakpoint
GRANT USAGE ON SCHEMA "public" TO nombaone_rls
--> statement-breakpoint
GRANT nombaone_rls TO CURRENT_USER
--> statement-breakpoint
ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY "mode_isolation" ON "api_keys"
  USING ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
  WITH CHECK ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "api_keys" TO nombaone_rls
--> statement-breakpoint
ALTER TABLE "coupons" ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY "mode_isolation" ON "coupons"
  USING ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
  WITH CHECK ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "coupons" TO nombaone_rls
--> statement-breakpoint
ALTER TABLE "credit_grants" ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY "mode_isolation" ON "credit_grants"
  USING ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
  WITH CHECK ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "credit_grants" TO nombaone_rls
--> statement-breakpoint
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY "mode_isolation" ON "customers"
  USING ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
  WITH CHECK ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "customers" TO nombaone_rls
--> statement-breakpoint
ALTER TABLE "discounts" ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY "mode_isolation" ON "discounts"
  USING ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
  WITH CHECK ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "discounts" TO nombaone_rls
--> statement-breakpoint
ALTER TABLE "domain_events" ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY "mode_isolation" ON "domain_events"
  USING ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
  WITH CHECK ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "domain_events" TO nombaone_rls
--> statement-breakpoint
ALTER TABLE "dunning_attempts" ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY "mode_isolation" ON "dunning_attempts"
  USING ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
  WITH CHECK ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "dunning_attempts" TO nombaone_rls
--> statement-breakpoint
ALTER TABLE "examples" ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY "mode_isolation" ON "examples"
  USING ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
  WITH CHECK ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "examples" TO nombaone_rls
--> statement-breakpoint
ALTER TABLE "invoice_line_items" ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY "mode_isolation" ON "invoice_line_items"
  USING ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
  WITH CHECK ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "invoice_line_items" TO nombaone_rls
--> statement-breakpoint
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY "mode_isolation" ON "invoices"
  USING ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
  WITH CHECK ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "invoices" TO nombaone_rls
--> statement-breakpoint
ALTER TABLE "ledger_accounts" ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY "mode_isolation" ON "ledger_accounts"
  USING ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
  WITH CHECK ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "ledger_accounts" TO nombaone_rls
--> statement-breakpoint
ALTER TABLE "ledger_transactions" ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY "mode_isolation" ON "ledger_transactions"
  USING ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
  WITH CHECK ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "ledger_transactions" TO nombaone_rls
--> statement-breakpoint
ALTER TABLE "nomba_webhook_events" ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY "mode_isolation" ON "nomba_webhook_events"
  USING ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
  WITH CHECK ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "nomba_webhook_events" TO nombaone_rls
--> statement-breakpoint
ALTER TABLE "org_billing_settings" ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY "mode_isolation" ON "org_billing_settings"
  USING ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
  WITH CHECK ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "org_billing_settings" TO nombaone_rls
--> statement-breakpoint
ALTER TABLE "org_nomba_accounts" ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY "mode_isolation" ON "org_nomba_accounts"
  USING ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
  WITH CHECK ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "org_nomba_accounts" TO nombaone_rls
--> statement-breakpoint
ALTER TABLE "org_sessions" ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY "mode_isolation" ON "org_sessions"
  USING ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
  WITH CHECK ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "org_sessions" TO nombaone_rls
--> statement-breakpoint
ALTER TABLE "payment_methods" ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY "mode_isolation" ON "payment_methods"
  USING ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
  WITH CHECK ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "payment_methods" TO nombaone_rls
--> statement-breakpoint
ALTER TABLE "payouts" ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY "mode_isolation" ON "payouts"
  USING ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
  WITH CHECK ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "payouts" TO nombaone_rls
--> statement-breakpoint
ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY "mode_isolation" ON "plans"
  USING ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
  WITH CHECK ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "plans" TO nombaone_rls
--> statement-breakpoint
ALTER TABLE "prices" ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY "mode_isolation" ON "prices"
  USING ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
  WITH CHECK ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "prices" TO nombaone_rls
--> statement-breakpoint
ALTER TABLE "refunds" ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY "mode_isolation" ON "refunds"
  USING ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
  WITH CHECK ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "refunds" TO nombaone_rls
--> statement-breakpoint
ALTER TABLE "settlements" ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY "mode_isolation" ON "settlements"
  USING ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
  WITH CHECK ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "settlements" TO nombaone_rls
--> statement-breakpoint
ALTER TABLE "subscription_items" ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY "mode_isolation" ON "subscription_items"
  USING ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
  WITH CHECK ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "subscription_items" TO nombaone_rls
--> statement-breakpoint
ALTER TABLE "subscription_periods" ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY "mode_isolation" ON "subscription_periods"
  USING ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
  WITH CHECK ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "subscription_periods" TO nombaone_rls
--> statement-breakpoint
ALTER TABLE "subscription_schedules" ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY "mode_isolation" ON "subscription_schedules"
  USING ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
  WITH CHECK ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "subscription_schedules" TO nombaone_rls
--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY "mode_isolation" ON "subscriptions"
  USING ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
  WITH CHECK ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "subscriptions" TO nombaone_rls
--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY "mode_isolation" ON "webhook_endpoints"
  USING ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
  WITH CHECK ("mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode")
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "webhook_endpoints" TO nombaone_rls
--> statement-breakpoint
ALTER TABLE "ledger_entries" ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY "mode_isolation" ON "ledger_entries"
  USING (EXISTS (SELECT 1 FROM "ledger_transactions" p WHERE p."id" = "ledger_entries"."transaction_id"
    AND p."mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode"))
  WITH CHECK (EXISTS (SELECT 1 FROM "ledger_transactions" p WHERE p."id" = "ledger_entries"."transaction_id"
    AND p."mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode"))
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "ledger_entries" TO nombaone_rls
--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY "mode_isolation" ON "webhook_deliveries"
  USING (EXISTS (SELECT 1 FROM "webhook_endpoints" p WHERE p."id" = "webhook_deliveries"."endpoint_id"
    AND p."mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode"))
  WITH CHECK (EXISTS (SELECT 1 FROM "webhook_endpoints" p WHERE p."id" = "webhook_deliveries"."endpoint_id"
    AND p."mode" = NULLIF(current_setting('app.mode', true), '')::"public"."mode"))
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "webhook_deliveries" TO nombaone_rls
