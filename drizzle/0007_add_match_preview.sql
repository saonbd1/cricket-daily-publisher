-- Run this against the Supabase project's SQL editor (this is the pattern the
-- project already follows for schema changes — see DEPLOYMENT.md: the
-- "add_board_post_url" migration was applied the same way). The generated
-- drizzle-kit SQL files in this folder track schema history for local
-- reference only; they are not executed automatically against Supabase.
ALTER TABLE "fixtures" ADD COLUMN IF NOT EXISTS "previewText" text;
ALTER TABLE "fixtures" ADD COLUMN IF NOT EXISTS "previewGeneratedAt" timestamptz;
