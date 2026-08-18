CREATE TYPE "public"."billing_interval" AS ENUM('monthly', 'annual');--> statement-breakpoint
ALTER TYPE "public"."subscription_status" ADD VALUE 'trialing' BEFORE 'active';--> statement-breakpoint
CREATE TABLE "activation_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activation_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "activation_tokens" ADD CONSTRAINT "activation_tokens_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activation_tokens_user_id_idx" ON "activation_tokens" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "venue_subscriptions" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "venue_profiles" DROP COLUMN "is_active";