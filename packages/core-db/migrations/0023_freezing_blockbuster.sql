ALTER TYPE "public"."dunning_branch" ADD VALUE 'payment_reminder';--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "reminder_sent_for_index" integer;--> statement-breakpoint
ALTER TABLE "org_billing_settings" ADD COLUMN "renewal_reminder_lead_hours" numeric DEFAULT '24' NOT NULL;--> statement-breakpoint
-- ── HEAL THE DATA BEFORE CONSTRAINING IT ────────────────────────────────────
-- The unique index at the bottom is correct: one customer holding the SAME card token twice is two
-- records of ONE physical card, and every path that resolves a payment method assumes it cannot
-- happen. But it cannot be added to a database that already violates it, and production did — 29
-- groups, 47 redundant rows, all sandbox test sentinels (`test_success`, `test_decline_*`), because
-- the test-instrument endpoint that mints them is not idempotent. So this migration failed there,
-- production sat three migrations behind, and nothing said why.
--
-- Deleting the redundant rows is not enough, and getting the ORDER wrong is worse than not doing it:
--
--   • `subscriptions.default_payment_method_id` references these rows ON DELETE SET NULL. 31 live
--     subscriptions pointed at a row we remove — so a bare DELETE would not error, it would quietly
--     strip the card off 31 paying subscriptions and stop them renewing. Repoint them FIRST.
--
--   • 18 of the rows we remove were the customer's `is_default` card. Dropping them leaves those
--     customers with no default at all, and a subscription with no card of its own falls back to the
--     customer default — so those renewals would silently stop too. The survivor must inherit it.
--     It cannot inherit it BEFORE the delete: `payment_methods_default_unique (customer_id, mode)
--     WHERE is_default` permits exactly one, so both flagged at once is a constraint violation.
--     Hence the temp table — the delete has to happen first, and something has to remember who to
--     promote afterwards.
--
-- The survivor is the NEWEST row in each group. Every statement is idempotent: on a database with no
-- duplicates the temp table is empty and all of this matches nothing.

CREATE TEMP TABLE "_pm_dedupe" ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    id,
    is_default,
    row_number() OVER w AS rn,
    first_value(id) OVER w AS keeper
  FROM "payment_methods"
  WHERE "token_key" IS NOT NULL
  WINDOW w AS (PARTITION BY "customer_id", "token_key" ORDER BY "created_at" DESC, "id" DESC)
)
SELECT id AS loser_id, keeper, is_default AS loser_was_default
FROM ranked
WHERE rn > 1;--> statement-breakpoint

UPDATE "subscriptions" s
SET "default_payment_method_id" = d.keeper
FROM "_pm_dedupe" d
WHERE s."default_payment_method_id" = d.loser_id;--> statement-breakpoint

DELETE FROM "payment_methods" pm
USING "_pm_dedupe" d
WHERE pm.id = d.loser_id;--> statement-breakpoint

UPDATE "payment_methods" k
SET "is_default" = true
FROM (SELECT DISTINCT keeper FROM "_pm_dedupe" WHERE loser_was_default) d
WHERE k.id = d.keeper
  AND NOT k."is_default";--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "payment_methods_customer_token_unique" ON "payment_methods" USING btree ("customer_id","token_key") WHERE "payment_methods"."token_key" IS NOT NULL;