ALTER TABLE "upgrades" ADD COLUMN "bonus_type" varchar(16);--> statement-breakpoint
ALTER TABLE "upgrades" ADD COLUMN "bonus_zone_start" integer;--> statement-breakpoint
ALTER TABLE "upgrades" ADD COLUMN "bonus_zone_size" integer;--> statement-breakpoint
ALTER TABLE "upgrades" ADD COLUMN "bonus_hit" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "upgrades" ADD COLUMN "bonus_payout" numeric(18, 2);