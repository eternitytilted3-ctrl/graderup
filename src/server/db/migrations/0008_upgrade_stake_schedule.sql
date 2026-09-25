ALTER TABLE "upgrades" ADD COLUMN "balance_stake" numeric(18, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "upgrade_bonus_cycle" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "upgrade_bonus_in" integer DEFAULT 0 NOT NULL;