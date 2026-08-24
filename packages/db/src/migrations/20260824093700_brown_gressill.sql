CREATE TYPE "public"."ticket_currency" AS ENUM('EUR', 'GBP', 'USD');--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "ticket_currency" "ticket_currency" DEFAULT 'EUR' NOT NULL;