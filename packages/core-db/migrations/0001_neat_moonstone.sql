CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"environment" "environment" NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_reference_unique" ON "customers" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_org_env_email_unique" ON "customers" USING btree ("organization_id","environment","email");--> statement-breakpoint
CREATE INDEX "customers_keyset_idx" ON "customers" USING btree ("organization_id","environment","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);