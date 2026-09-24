CREATE TYPE "public"."item_withdrawal_status" AS ENUM('searching', 'waiting_accept', 'completed', 'failed', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."user_item_status" ADD VALUE 'withdrawn';--> statement-breakpoint
CREATE TABLE "item_withdrawals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"user_item_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"price" numeric(18, 2) NOT NULL,
	"trade_url" varchar(256) NOT NULL,
	"provider" varchar(32) NOT NULL,
	"external_id" varchar(128),
	"trade_offer_id" varchar(64),
	"status" "item_withdrawal_status" DEFAULT 'searching' NOT NULL,
	"status_message" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "steam_trade_url" varchar(256);--> statement-breakpoint
ALTER TABLE "item_withdrawals" ADD CONSTRAINT "item_withdrawals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_withdrawals" ADD CONSTRAINT "item_withdrawals_user_item_id_user_items_id_fk" FOREIGN KEY ("user_item_id") REFERENCES "public"."user_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_withdrawals" ADD CONSTRAINT "item_withdrawals_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "item_withdrawals_user_idx" ON "item_withdrawals" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "item_withdrawals_status_idx" ON "item_withdrawals" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "item_withdrawals_active_item_uq" ON "item_withdrawals" USING btree ("user_item_id") WHERE status in ('searching','waiting_accept','completed');