CREATE TABLE "case_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(80) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upgrade_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"upgrade_id" uuid NOT NULL,
	"user_item_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"value" numeric(18, 2) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "category_id" uuid;--> statement-breakpoint
ALTER TABLE "upgrade_sources" ADD CONSTRAINT "upgrade_sources_upgrade_id_upgrades_id_fk" FOREIGN KEY ("upgrade_id") REFERENCES "public"."upgrades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upgrade_sources" ADD CONSTRAINT "upgrade_sources_user_item_id_user_items_id_fk" FOREIGN KEY ("user_item_id") REFERENCES "public"."user_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upgrade_sources" ADD CONSTRAINT "upgrade_sources_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "case_categories_slug_uq" ON "case_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "case_categories_sort_idx" ON "case_categories" USING btree ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "upgrade_sources_user_item_uq" ON "upgrade_sources" USING btree ("user_item_id");--> statement-breakpoint
CREATE INDEX "upgrade_sources_upgrade_idx" ON "upgrade_sources" USING btree ("upgrade_id");--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_category_id_case_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."case_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cases_category_idx" ON "cases" USING btree ("category_id");