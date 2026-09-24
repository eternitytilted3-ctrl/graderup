ALTER TABLE "items" ADD COLUMN "market_hash_name" varchar(200);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "market_price" numeric(18, 2);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "price_source" varchar(32);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "price_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "price_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "items_market_hash_name_uq" ON "items" USING btree ("market_hash_name");