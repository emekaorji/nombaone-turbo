CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'revoked', 'expired');--> statement-breakpoint
CREATE TABLE "org_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "org_user_role" DEFAULT 'developer' NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by_user_id" uuid,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_invitations" ADD CONSTRAINT "org_invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_invitations" ADD CONSTRAINT "org_invitations_invited_by_user_id_org_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."org_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "org_invitations_reference_unique" ON "org_invitations" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "org_invitations_token_hash_unique" ON "org_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "org_invitations_org_status_idx" ON "org_invitations" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "org_invitations_pending_email_unique" ON "org_invitations" USING btree ("organization_id","email") WHERE "org_invitations"."status" = 'pending';