ALTER TABLE "items" ADD COLUMN "base_name" varchar(200);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "wear" varchar(32);--> statement-breakpoint
CREATE INDEX "items_base_name_idx" ON "items" USING btree ("base_name");--> statement-breakpoint
UPDATE "items" SET "wear" = substring("name" from '\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$'), "base_name" = regexp_replace("name", '\s*\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$', '') WHERE "base_name" IS NULL;
