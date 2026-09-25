CREATE TABLE "presence" (
	"visitor_id" varchar(32) PRIMARY KEY NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "presence_seen_idx" ON "presence" USING btree ("seen_at");