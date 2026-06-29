CREATE TABLE "docs_page_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_slug" text NOT NULL,
	"helpful" boolean NOT NULL,
	"anonymous_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "docs_page_feedback_page_created_idx" ON "docs_page_feedback" USING btree ("page_slug","created_at" DESC NULLS LAST);